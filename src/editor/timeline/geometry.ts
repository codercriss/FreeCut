import type { Frame, Track, TrackKind } from "../../model/types";

/**
 * Timeline geometry — ONE place that turns time into pixels, so the ruler, clips and playhead can never
 * disagree (they did in v1.0.0: Handover K1b). Pure functions, unit-tested.
 */

export interface TimeScale {
  fps: number;
  /** Pixels per second at the current zoom. */
  pps: number;
  /** x (px) of frame 0 inside the timeline canvas. */
  origin: number;
  frameToX(frame: Frame): number;
  xToFrame(x: number): Frame;
  /** Width in px of a span of frames. */
  framesToWidth(frames: Frame): number;
}

export function createTimeScale(fps: number, pps: number, origin = 0): TimeScale {
  return {
    fps,
    pps,
    origin,
    frameToX: (frame) => origin + (frame / fps) * pps,
    xToFrame: (x) => Math.round(((x - origin) / pps) * fps),
    framesToWidth: (frames) => (frames / fps) * pps,
  };
}

/* ── desktop ── */
/** x of 00:00 inside the desktop timeline canvas (the prototype's clips also started at x = 0). */
export const DESKTOP_ORIGIN = 0;
/**
 * Desktop pixels-per-second at zoom factor 1. The prototype already DREW its clips at 22.3 px/s (the
 * 27 s 58 f video clip = 624 px, the audio clip at 117 px / 224 px) but its ruler and playhead used 4.17 px/s
 * from an arbitrary origin. Everything now uses this one value.
 */
export const DESKTOP_BASE_PPS = 22.3;
export const MIN_TIMELINE_SECONDS = 60;
/** Empty space kept after the last clip so there's room to drop/extend. */
export const TIMELINE_TAIL_SECONDS = 30;

/** Zoom slider (0–100) → scale factor 0.4 … 1.6 (50 → 1.0). */
export const zoomToScale = (zoom: number): number => 0.4 + (zoom / 100) * 1.2;

export function timelineSeconds(durationFrames: Frame, fps: number): number {
  return Math.max(MIN_TIMELINE_SECONDS, Math.ceil(durationFrames / fps) + TIMELINE_TAIL_SECONDS);
}

/* ── phone ── */
export const MOBILE_BASE_PPS = 28;
export const MOBILE_SCALE_MIN = 0.4;
export const MOBILE_SCALE_MAX = 3.5;

/* ── ruler ── */
const RULER_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300];

/** First "nice" label step (seconds) whose pixel spacing is at least `minGapPx`. */
export function rulerStep(pps: number, minGapPx: number): number {
  return RULER_STEPS.find((s) => s * pps >= minGapPx) ?? 600;
}

/* ── rows ── */
export interface RowMetrics {
  height: number;
  /** Clip box inset from the row's top, and the clip's own height. */
  clipInsetTop: number;
  clipHeight: number;
}

export interface LayoutMetrics {
  rulerHeight: number;
  /** Extra space between the ruler and the first row. */
  topPad: number;
  rows: Record<TrackKind, RowMetrics>;
}

export const DESKTOP_METRICS: LayoutMetrics = {
  rulerHeight: 16,
  topPad: 0,
  rows: {
    overlay: { height: 55, clipInsetTop: 4, clipHeight: 47 },
    main: { height: 63, clipInsetTop: 4, clipHeight: 55 },
    audio: { height: 40, clipInsetTop: 1, clipHeight: 38 },
  },
};

export const MOBILE_METRICS: LayoutMetrics = {
  rulerHeight: 22,
  topPad: 8,
  rows: {
    overlay: { height: 55, clipInsetTop: 4, clipHeight: 47 },
    main: { height: 63, clipInsetTop: 4, clipHeight: 55 },
    audio: { height: 40, clipInsetTop: 2, clipHeight: 38 },
  },
};

export interface TrackRow {
  track: Track;
  top: number;
  height: number;
  clipTop: number;
  clipHeight: number;
}

/** Stack `tracks` (already in visual order) under the ruler. Returns rows and the total content height. */
export function layoutTracks(
  tracks: Track[],
  metrics: LayoutMetrics,
): { rows: TrackRow[]; height: number } {
  let y = metrics.rulerHeight + metrics.topPad;
  const rows = tracks.map((track) => {
    const m = metrics.rows[track.kind];
    const row: TrackRow = {
      track,
      top: y,
      height: m.height,
      clipTop: y + m.clipInsetTop,
      clipHeight: m.clipHeight,
    };
    y += m.height;
    return row;
  });
  return { rows, height: y };
}
