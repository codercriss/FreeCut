import { withTimeout } from "./probe";

/**
 * Making a still picture from a video, the iOS-proof way.
 *
 * Why this is more than "load, seek, draw": iOS Safari ignores `preload="auto"` for a video nobody asked to play
 * (metadata only), may not paint frames of an element that isn't in the page, and can fire `seeked` before a
 * frame is decodable. So we (1) attach a tiny invisible muted element to the page, (2) briefly *play* it so a
 * frame is really decoded, (3) pause, seek, wait for a presented frame, and draw — and (4) if that fails, try
 * the plain seek-only route (which some desktop browsers prefer). A blank result is distrusted and retried.
 * Every step leaves a note, so when it still fails the person (and I) can see exactly where.
 */

export interface VideoLike {
  src: string;
  muted: boolean;
  playsInline: boolean;
  preload: string;
  readonly readyState: number;
  readonly videoWidth: number;
  readonly videoHeight: number;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
  requestVideoFrameCallback?: (cb: () => void) => number;
}

export interface PosterEnv {
  createVideo(): VideoLike;
  attach(v: VideoLike): void;
  /** Remove from the page and release the decoder. */
  detach(v: VideoLike): void;
  snapshot(v: VideoLike, maxSide: number): Promise<{ blob: Blob | null; blank: boolean }>;
}

export interface PosterOptions {
  /** Whole-attempt budget. */
  totalMs?: number;
  /** Longest wait for any single browser event. */
  stepMs?: number;
}

export interface PosterResult {
  blob: Blob | null;
  /** Human-readable trail of what happened (shown when a thumbnail can't be made). */
  notes: string[];
}

/** True when sampled pixels are all (almost) black — what a canvas holds if the browser painted no frame. Pure. */
export function isBlankPixels(data: ArrayLike<number>, threshold = 4): boolean {
  const pixels = Math.floor(data.length / 4);
  if (pixels === 0) return true;
  const stride = Math.max(1, Math.floor(pixels / 400));
  for (let p = 0; p < pixels; p += stride) {
    const i = p * 4;
    if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) return false;
  }
  return true;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Short, readable cause: DOMException → its name (NotAllowedError…); other errors → their message. */
const errName = (e: unknown): string =>
  typeof DOMException !== "undefined" && e instanceof DOMException
    ? e.name
    : e instanceof Error
      ? e.message || e.name
      : String(e);

function waitForEvent(v: VideoLike, events: string[], ms: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const hooks: Array<[string, () => void]> = [];
    const cleanup = () => hooks.forEach(([e, f]) => v.removeEventListener(e, f));
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for ${events.join("/")}`));
    }, ms);
    for (const e of events) {
      const f = () => {
        clearTimeout(timer);
        cleanup();
        resolve(e);
      };
      hooks.push([e, f]);
      v.addEventListener(e, f);
    }
    const bad = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error("the video reported an error"));
    };
    hooks.push(["error", bad]);
    v.addEventListener("error", bad);
  });
}

/** Wait until the browser has presented a frame (or a short moment, where it can't tell us). */
async function presentedFrame(v: VideoLike): Promise<void> {
  if (typeof v.requestVideoFrameCallback === "function") {
    await Promise.race([
      new Promise<void>((r) => v.requestVideoFrameCallback!(() => r())),
      sleep(400),
    ]);
  } else {
    await sleep(80);
  }
}

export async function posterFromVideo(
  url: string,
  durationSec: number,
  env: PosterEnv,
  maxSide: number,
  opts: PosterOptions = {},
): Promise<PosterResult> {
  const stepMs = opts.stepMs ?? 3000;
  const deadline = Date.now() + (opts.totalMs ?? 9000);
  const left = () => Math.max(50, Math.min(stepMs, deadline - Date.now()));
  const notes: string[] = [];
  let blankFallback: Blob | null = null;

  for (const strategy of ["play", "seek"] as const) {
    if (Date.now() >= deadline) {
      notes.push("out of time");
      break;
    }
    const v = env.createVideo();
    const step: string[] = [];
    try {
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      env.attach(v);
      v.src = url;

      if (v.readyState < 1) await waitForEvent(v, ["loadedmetadata"], left());
      step.push(`metadata ${v.videoWidth}×${v.videoHeight}`);
      if (!v.videoWidth || !v.videoHeight) throw new Error("no picture size (audio-only?)");

      if (strategy === "play") {
        try {
          const p = v.play();
          if (p && typeof (p as Promise<void>).then === "function")
            await withTimeout(p as Promise<void>, left(), () => new Error("play() timed out"));
          step.push("play() ok");
        } catch (e) {
          step.push(`play() refused (${errName(e)})`);
        }
      }
      if (v.readyState < 2) {
        try {
          const got = await waitForEvent(
            v,
            ["loadeddata", "canplay", "playing", "timeupdate"],
            left(),
          );
          step.push(`frame ready via ${got}`);
        } catch (e) {
          step.push(`no frame ready (${errName(e)})`);
        }
      }
      v.pause();

      const t = Math.min(1, durationSec * 0.1);
      if (t > 0.05 && v.readyState >= 1) {
        v.currentTime = t;
        try {
          await waitForEvent(v, ["seeked"], left());
          step.push("seeked");
        } catch (e) {
          step.push(`seek failed (${errName(e)})`);
        }
      }
      await presentedFrame(v);

      const snap = await env.snapshot(v, maxSide);
      if (snap.blob && !snap.blank) {
        notes.push(`${strategy}: ${step.join(", ")}, picture ok`);
        return { blob: snap.blob, notes };
      }
      step.push(snap.blob ? "frame was blank" : "could not encode");
      // A black picture is only trustworthy if the browser really had a decoded frame (a video can start black).
      // With no decoded frame it is just an empty canvas — returning it would hide the fallbacks and the retry button.
      if (snap.blob && v.readyState >= 2) blankFallback = snap.blob;
    } catch (e) {
      step.push(`failed (${errName(e)})`);
    } finally {
      env.detach(v);
    }
    notes.push(`${strategy}: ${step.join(", ")}`);
  }
  // A genuinely-black decoded frame beats none, but only after both routes were tried.
  return { blob: blankFallback, notes };
}
