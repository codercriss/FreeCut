import { presentedFrame, waitForEvent, type PosterEnv, type VideoLike } from "./poster";
import { makeMediaElement } from "./probe";

/**
 * Filmstrip: ONE small sprite image per video holding ~20 frames spread across its length, so every cell on
 * the timeline can show the frame for its own moment (instead of one poster repeated). Built lazily the first
 * time a clip appears on the timeline; stored beside the video as `${mediaId}:strip` with its layout as `meta`.
 */

export interface StripMeta {
  /** Frames in the sprite; frame i is the picture at time (i + 0.5) / count × duration. */
  count: number;
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  durationSec: number;
}

export const STRIP_MAX_FRAMES = 24;
const CELL_H = 96;
const MAX_SPRITE_W = 2048;

/** How many frames to sample: about one a second, between 3 and 24. */
export const stripCount = (durationSec: number): number =>
  Math.max(3, Math.min(STRIP_MAX_FRAMES, Math.ceil(durationSec)));

/** Grid layout for `count` frames of a video of the given size (sprite kept under 2048 px wide for iOS canvas limits). */
export function stripLayout(
  count: number,
  videoW: number,
  videoH: number,
  durationSec = 0,
): StripMeta {
  const cellH = CELL_H;
  const cellW = Math.max(54, Math.min(192, Math.round((CELL_H * videoW) / Math.max(1, videoH))));
  const cols = Math.max(1, Math.min(count, Math.floor(MAX_SPRITE_W / cellW)));
  return { count, cols, rows: Math.ceil(count / cols), cellW, cellH, durationSec };
}

/** The times (seconds) at which frames are sampled. */
export const frameTimes = (durationSec: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * durationSec);

/** Which sprite frame best shows source time `t`. */
export const frameIndexAt = (t: number, meta: Pick<StripMeta, "count" | "durationSec">): number =>
  Math.max(
    0,
    Math.min(meta.count - 1, Math.floor((t / Math.max(1e-6, meta.durationSec)) * meta.count)),
  );

/**
 * CSS `background-size` / `background-position` that show sprite frame `index` filling a cellPxW × cellPxH box,
 * scaled to cover and centred (no neighbouring frame ever bleeds in, because the scaled frame is at least as big as the box).
 */
export function cellStyle(
  meta: StripMeta,
  index: number,
  cellPxW: number,
  cellPxH: number,
): { backgroundSize: string; backgroundPosition: string } {
  const k = Math.max(cellPxW / meta.cellW, cellPxH / meta.cellH);
  const fw = meta.cellW * k;
  const fh = meta.cellH * k;
  const col = index % meta.cols;
  const row = Math.floor(index / meta.cols);
  const x = -(col * fw) - (fw - cellPxW) / 2;
  const y = -(row * fh) - (fh - cellPxH) / 2;
  return {
    backgroundSize: `${meta.cols * fw}px ${meta.rows * fh}px`,
    backgroundPosition: `${x}px ${y}px`,
  };
}

/* ───────────── building the sprite ───────────── */

export interface StripEnv extends Pick<PosterEnv, "createVideo" | "attach" | "detach"> {
  /** Called once the video's size is known: prepare a sprite for `count` frames. */
  begin(videoW: number, videoH: number, count: number, durationSec: number): StripMeta;
  /** Draw the video's current frame into cell `index`. */
  drawCell(v: VideoLike, index: number): void;
  /** Encode the sprite. */
  finish(): Promise<Blob | null>;
}

export interface StripOptions {
  totalMs?: number;
  stepMs?: number;
}

export interface StripResult {
  blob: Blob | null;
  meta: StripMeta | null;
  notes: string[];
}

export async function stripFromVideo(
  url: string,
  durationSec: number,
  env: StripEnv,
  opts: StripOptions = {},
): Promise<StripResult> {
  const stepMs = opts.stepMs ?? 3000;
  const deadline = Date.now() + (opts.totalMs ?? 45000);
  const left = () => Math.max(50, Math.min(stepMs, deadline - Date.now()));
  const notes: string[] = [];
  const v = env.createVideo();
  try {
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    env.attach(v);
    v.src = url;
    if (v.readyState < 1) await waitForEvent(v, ["loadedmetadata"], left());
    if (!v.videoWidth || !v.videoHeight) throw new Error("no picture size");

    // Same iOS-proofing as posters: get a frame genuinely decoded before seeking around.
    try {
      const p = v.play();
      if (p && typeof (p as Promise<void>).then === "function")
        await Promise.race([
          p as Promise<void>,
          new Promise((_, rej) => setTimeout(() => rej(new Error("play() timed out")), left())),
        ]);
    } catch (e) {
      notes.push(`play() refused (${e instanceof Error ? e.message : String(e)})`);
    }
    if (v.readyState < 2) {
      try {
        await waitForEvent(v, ["loadeddata", "canplay", "playing", "timeupdate"], left());
      } catch {
        notes.push("no frame ready");
      }
    }
    v.pause();

    const count = stripCount(durationSec);
    const meta = env.begin(v.videoWidth, v.videoHeight, count, durationSec);
    let good = 0;
    const times = frameTimes(durationSec, count);
    for (let i = 0; i < count; i++) {
      if (Date.now() < deadline) {
        v.currentTime = times[i];
        try {
          await waitForEvent(v, ["seeked"], left());
          good += 1;
        } catch (e) {
          if (notes.length < 6)
            notes.push(`seek ${i} failed (${e instanceof Error ? e.message : String(e)})`);
        }
        await presentedFrame(v);
      } else if (!notes.includes("out of time")) {
        notes.push("out of time (remaining cells repeat the last frame)");
      }
      env.drawCell(v, i); // if a seek failed or time ran out this repeats the previous picture — acceptable
    }
    if (good < Math.max(2, Math.ceil(count * 0.6))) {
      notes.push(`only ${good}/${count} frames could be reached`);
      return { blob: null, meta: null, notes };
    }
    const blob = await env.finish();
    notes.push(`${good}/${count} frames ok`);
    return blob
      ? { blob, meta, notes }
      : { blob: null, meta: null, notes: [...notes, "could not encode"] };
  } catch (e) {
    notes.push(`failed (${e instanceof Error ? e.message : String(e)})`);
    return { blob: null, meta: null, notes };
  } finally {
    env.detach(v);
  }
}

/* ───────────── the real browser ───────────── */

function browserStripEnv(): StripEnv {
  let canvas: HTMLCanvasElement | null = null;
  let meta: StripMeta | null = null;
  return {
    createVideo: () => makeMediaElement("video") as unknown as VideoLike,
    attach(v) {
      const el = v as unknown as HTMLVideoElement;
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
    begin(w, h, count, durationSec) {
      meta = stripLayout(count, w, h, durationSec);
      canvas = document.createElement("canvas");
      canvas.width = meta.cols * meta.cellW;
      canvas.height = meta.rows * meta.cellH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return meta;
    },
    drawCell(v, index) {
      if (!canvas || !meta) return;
      const el = v as unknown as HTMLVideoElement;
      const ctx = canvas.getContext("2d");
      if (!ctx || !el.videoWidth) return;
      // cover-crop the video frame into the cell
      const k = Math.max(meta.cellW / el.videoWidth, meta.cellH / el.videoHeight);
      const sw = meta.cellW / k;
      const sh = meta.cellH / k;
      const dx = (index % meta.cols) * meta.cellW;
      const dy = Math.floor(index / meta.cols) * meta.cellH;
      try {
        ctx.drawImage(
          el,
          (el.videoWidth - sw) / 2,
          (el.videoHeight - sh) / 2,
          sw,
          sh,
          dx,
          dy,
          meta.cellW,
          meta.cellH,
        );
      } catch {
        /* leave the cell black */
      }
    },
    finish: () =>
      new Promise<Blob | null>((resolve) => {
        if (!canvas) return resolve(null);
        const t = setTimeout(() => resolve(null), 10000);
        canvas.toBlob(
          (b) => {
            clearTimeout(t);
            resolve(b);
          },
          "image/jpeg",
          0.62,
        );
      }),
  };
}

/** Build the filmstrip sprite for a stored video. Never throws. */
export async function makeFilmstrip(
  file: Blob,
  durationSec: number,
  opts?: StripOptions,
): Promise<StripResult> {
  const url = URL.createObjectURL(file);
  try {
    return await stripFromVideo(url, durationSec, browserStripEnv(), opts);
  } catch (e) {
    return {
      blob: null,
      meta: null,
      notes: [`unexpected: ${e instanceof Error ? e.message : String(e)}`],
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
