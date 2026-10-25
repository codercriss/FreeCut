import {
  isBlankPixels,
  posterFromVideo,
  type PosterEnv,
  type PosterOptions,
  type PosterResult,
} from "./poster";
import type { Probe } from "./probe";
import { makeMediaElement, withTimeout } from "./probe";

export type { PosterResult } from "./poster";

/** `toBlob` normally returns in milliseconds, but a busy page can delay it; never let it hang an import. */
const canvasToBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = 0.82): Promise<Blob | null> =>
  withTimeout(
    new Promise<Blob | null>((resolve) => c.toBlob((b) => resolve(b), type, q)),
    8000,
    () => new Error("toBlob timeout"),
  );

/** Fit w×h inside a maxSide box, keeping the aspect ratio (never upscaling). */
export function fitSize(w: number, h: number, maxSide: number): { w: number; h: number } {
  const k = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

function drawScaled(
  src: CanvasImageSource,
  sw: number,
  sh: number,
  maxSide: number,
): HTMLCanvasElement {
  const { w, h } = fitSize(sw, sh, maxSide);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = "#000"; // JPEG has no alpha
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return c;
}

/** The real browser behind `posterFromVideo`: an invisible, muted, in-page `<video>`. */
const browserPosterEnv: PosterEnv = {
  createVideo: () => makeMediaElement("video") as HTMLVideoElement,
  attach(v) {
    const el = v as unknown as HTMLVideoElement;
    // Not display:none (iOS may not decode those) — just tiny, transparent and inert.
    Object.assign(el.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "2px",
      height: "2px",
      opacity: "0.01",
      pointerEvents: "none",
    });
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
  },
  detach(v) {
    const el = v as unknown as HTMLVideoElement;
    try {
      el.pause();
      el.removeAttribute("src");
      el.load();
    } finally {
      el.remove();
    }
  },
  async snapshot(v, maxSide) {
    const el = v as unknown as HTMLVideoElement;
    try {
      const c = drawScaled(el, el.videoWidth, el.videoHeight, maxSide);
      const ctx = c.getContext("2d");
      const blank = ctx ? isBlankPixels(ctx.getImageData(0, 0, c.width, c.height).data) : false;
      return { blob: await canvasToBlob(c), blank };
    } catch {
      return { blob: null, blank: false };
    }
  },
};

/**
 * A small JPEG poster for a photo or video, plus a trail of notes explaining what happened. `blob` is null when
 * none could be made (audio, or a decoder that won't cooperate). Never throws: a missing poster must not block an
 * import — and the notes let the person retry from the media menu and tell us why it failed.
 */
export async function makePosterDetailed(
  file: Blob,
  probe: Pick<Probe, "kind" | "durationSec">,
  maxSide = 512,
  opts?: PosterOptions,
): Promise<PosterResult> {
  if (probe.kind === "audio") return { blob: null, notes: ["audio has no picture"] };
  const url = URL.createObjectURL(file);
  try {
    if (probe.kind === "image") {
      const notes: string[] = [];
      try {
        const img = new Image();
        img.src = url;
        await withTimeout(img.decode(), 8000, () => new Error("decode timeout"));
        const blob = await canvasToBlob(
          drawScaled(img, img.naturalWidth, img.naturalHeight, maxSide),
        );
        return { blob, notes: ["photo decoded"] };
      } catch (e) {
        notes.push(`photo decode failed (${e instanceof Error ? e.message : String(e)})`);
      }
      try {
        if (typeof createImageBitmap === "function") {
          const bmp = await createImageBitmap(file);
          const blob = await canvasToBlob(drawScaled(bmp, bmp.width, bmp.height, maxSide));
          bmp.close?.();
          return { blob, notes: [...notes, "photo via ImageBitmap"] };
        }
      } catch (e) {
        notes.push(`ImageBitmap failed (${e instanceof Error ? e.message : String(e)})`);
      }
      return { blob: null, notes };
    }
    return await posterFromVideo(url, probe.durationSec, browserPosterEnv, maxSide, opts);
  } catch (e) {
    return { blob: null, notes: [`unexpected: ${e instanceof Error ? e.message : String(e)}`] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Per-bucket peak of |sample|, scaled 0–100. Pure → unit-tested. */
export function peaksFromSamples(samples: Float32Array, buckets: number): number[] {
  if (samples.length === 0 || buckets < 1) return [];
  const out: number[] = [];
  const size = samples.length / buckets;
  let max = 0;
  const raw: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * size);
    const to = Math.max(from + 1, Math.floor((b + 1) * size));
    let peak = 0;
    for (let i = from; i < to && i < samples.length; i++)
      peak = Math.max(peak, Math.abs(samples[i]));
    raw.push(peak);
    max = Math.max(max, peak);
  }
  for (const p of raw) out.push(max > 0 ? Math.round((p / max) * 100) : 0);
  return out;
}

/** Longest audio we'll decode in full to draw a waveform (decoded audio is large: ~10 MB per minute at 44.1 kHz). */
export const MAX_PEAK_BYTES = 60 * 1024 * 1024;

interface DecodeCtx {
  decodeAudioData(
    data: ArrayBuffer,
    ok?: (b: AudioBuffer) => void,
    bad?: (e: unknown) => void,
  ): Promise<AudioBuffer> | void;
}

/** A waveform summary for audio files, or null if it can't/shouldn't be computed. Never throws. */
export async function computePeaks(
  file: File,
  probe: Probe,
  buckets = 120,
): Promise<number[] | null> {
  if (probe.kind !== "audio" || file.size > MAX_PEAK_BYTES) return null;
  try {
    const w = window as unknown as {
      OfflineAudioContext?: new (c: number, l: number, r: number) => DecodeCtx;
      webkitOfflineAudioContext?: new (c: number, l: number, r: number) => DecodeCtx;
    };
    const Ctx = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx(1, 1, 44100);
    const data = await file.arrayBuffer();
    // Older Safari only supports the callback form; the promise form may return undefined there.
    const buf = await withTimeout(
      new Promise<AudioBuffer>((resolve, reject) => {
        const r = ctx.decodeAudioData(data, resolve, reject);
        if (r && typeof (r as Promise<AudioBuffer>).then === "function")
          (r as Promise<AudioBuffer>).then(resolve, reject);
      }),
      15000,
      () => new Error("decode timeout"),
    );
    const merged = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < ch.length; i++) merged[i] = Math.max(merged[i], Math.abs(ch[i]));
    }
    return peaksFromSamples(merged, buckets);
  } catch {
    return null;
  }
}
