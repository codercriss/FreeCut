import type { MediaKind } from "./classify";

export interface Probe {
  kind: MediaKind;
  /** Seconds. 0 for images. */
  durationSec: number;
  width?: number;
  height?: number;
  mime: string;
}

/** An error whose message is safe to show to the person importing. */
export class ProbeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProbeError";
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(onTimeout()), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });

function once(el: EventTarget, ok: string, bad = "error"): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (e: Event) => {
      el.removeEventListener(ok, done);
      el.removeEventListener(bad, done);
      if (e.type === ok) resolve();
      else reject(new Error(bad));
    };
    el.addEventListener(ok, done);
    el.addEventListener(bad, done);
  });
}

export function makeMediaElement(kind: "video" | "audio"): HTMLVideoElement | HTMLAudioElement {
  const el = document.createElement(kind);
  el.preload = "metadata";
  el.muted = true; // required on iOS for programmatic loading/seeking without a gesture
  (el as HTMLVideoElement).playsInline = true;
  el.setAttribute("playsinline", "");
  return el;
}

function release(el: HTMLMediaElement | HTMLImageElement, url: string): void {
  try {
    el.removeAttribute("src");
    if ("load" in el) el.load();
  } finally {
    URL.revokeObjectURL(url);
  }
}

const UNREADABLE =
  "This browser can’t read this file. It may be damaged or in a format it doesn’t support.";

/** Read a file's real kind, duration and dimensions using the browser's own decoders. */
export async function probeMedia(file: File, hint: MediaKind, timeoutMs = 12000): Promise<Probe> {
  const url = URL.createObjectURL(file);
  try {
    if (hint === "image") {
      const img = new Image();
      img.src = url;
      try {
        await withTimeout(
          img.decode(),
          timeoutMs,
          () => new ProbeError("Reading this photo took too long."),
        );
      } catch (e) {
        if (e instanceof ProbeError) throw e;
        throw new ProbeError("This browser can’t open this photo format.");
      }
      const out: Probe = {
        kind: "image",
        durationSec: 0,
        width: img.naturalWidth,
        height: img.naturalHeight,
        mime: file.type,
      };
      release(img, url);
      return out;
    }

    const el = makeMediaElement(hint);
    el.src = url;
    try {
      await withTimeout(
        once(el, "loadedmetadata"),
        timeoutMs,
        () => new ProbeError("Reading this file took too long."),
      );
    } catch (e) {
      if (e instanceof ProbeError) throw e;
      throw new ProbeError(
        hint === "video"
          ? "This browser can’t play this video format."
          : "This browser can’t play this audio format.",
      );
    }

    let duration = el.duration;
    // Some recordings (e.g. streamed WebM) report Infinity until you seek to the end.
    if (!Number.isFinite(duration)) {
      try {
        el.currentTime = 1e101;
        await withTimeout(once(el, "timeupdate"), 4000, () => new ProbeError(UNREADABLE));
        duration = el.duration;
        el.currentTime = 0;
      } catch {
        /* fall through to the check below */
      }
    }
    if (!Number.isFinite(duration) || duration <= 0) throw new ProbeError(UNREADABLE);

    const v = el as HTMLVideoElement;
    // A "video" file with no picture (audio in an MP4/WebM container) is really audio.
    const kind: MediaKind = hint === "video" && v.videoWidth === 0 ? "audio" : hint;
    const out: Probe = {
      kind,
      durationSec: duration,
      width: kind === "video" ? v.videoWidth : undefined,
      height: kind === "video" ? v.videoHeight : undefined,
      mime: file.type,
    };
    release(el, url);
    return out;
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e instanceof ProbeError ? e : new ProbeError(UNREADABLE);
  }
}

export { withTimeout, once };
