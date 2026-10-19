import type { Frame } from "./types";

/** Zero-pad to 2 digits. */
export const pad2 = (n: number): string => String(n).padStart(2, "0");

export const secondsToFrames = (seconds: number, fps: number): Frame => Math.round(seconds * fps);
export const framesToSeconds = (frame: Frame, fps: number): number => frame / fps;

/** HH:MM:SS:FF — FF counts frames within the second. */
export function timecode(frame: Frame, fps: number): string {
  const f = Math.max(0, Math.floor(frame));
  const ff = f % fps;
  const t = Math.floor(f / fps);
  return `${pad2(Math.floor(t / 3600))}:${pad2(Math.floor(t / 60) % 60)}:${pad2(t % 60)}:${pad2(ff)}`;
}

/** MM:SS from whole seconds (used for ruler labels and thumbnails). */
export const mmss = (seconds: number): string =>
  `${pad2(Math.floor(seconds / 60))}:${pad2(Math.floor(seconds) % 60)}`;

/** HH:MM:SS from a frame count (clip chips). */
export function hhmmss(frame: Frame, fps: number): string {
  const t = Math.floor(Math.max(0, frame) / fps);
  return `${pad2(Math.floor(t / 3600))}:${pad2(Math.floor(t / 60) % 60)}:${pad2(t % 60)}`;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Local wall-clock HH:MM:SS for "Saved locally at …". */
export function clockTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
