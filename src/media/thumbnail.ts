import type { Probe } from "./probe";
import { makeMediaElement, once, withTimeout } from "./probe";

/** `toBlob` normally returns in milliseconds, but a busy page can delay it; never let it hang an import. */
const canvasToBlob = (c: HTMLCanvasElement, type = "image/jpeg", q = 0.72): Promise<Blob | null> =>
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

/**
 * A small JPEG poster for a photo or video, or null when one can't be made (audio, or a decoder that won't
 * cooperate — iOS can refuse to paint video frames). Never throws: a missing poster must not block an import.
 */
export async function makePoster(file: File, probe: Probe, maxSide = 320): Promise<Blob | null> {
  if (probe.kind === "audio") return null;
  const url = URL.createObjectURL(file);
  try {
    if (probe.kind === "image") {
      const img = new Image();
      img.src = url;
      await withTimeout(img.decode(), 8000, () => new Error("decode timeout"));
      return await canvasToBlob(drawScaled(img, img.naturalWidth, img.naturalHeight, maxSide));
    }
    const v = makeMediaElement("video") as HTMLVideoElement;
    v.preload = "auto";
    v.src = url;
    await withTimeout(once(v, "loadeddata"), 8000, () => new Error("load timeout"));
    const t = Math.min(1, probe.durationSec * 0.1);
    if (t > 0) {
      v.currentTime = t;
      await withTimeout(once(v, "seeked"), 6000, () => new Error("seek timeout"));
    }
    const blob = await canvasToBlob(drawScaled(v, v.videoWidth, v.videoHeight, maxSide));
    v.removeAttribute("src");
    v.load();
    return blob;
  } catch {
    return null;
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
