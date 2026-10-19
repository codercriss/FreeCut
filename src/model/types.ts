/**
 * Project model v1 — the single source of truth for everything the editor shows.
 *
 * Rules:
 *  - Plain JSON only (no classes, Maps, Dates, undefined) so it can be stored, diffed and migrated.
 *  - All time values are INTEGER FRAMES at `settings.fps`. Never floating seconds.
 *  - Objects are treated as immutable; commands return new objects (structural sharing).
 *  - Any change to this shape needs a `schemaVersion` bump + migration (see migrations.ts).
 */

/** Integer frame count at the project's fps. */
export type Frame = number;
export type Id = string;

export const SCHEMA_VERSION = 1 as const;

export interface ProjectSettings {
  fps: number;
  width: number;
  height: number;
  /** Display label for the canvas ratio, e.g. "16:9". */
  ratio: string;
}

export type AssetKind = "video" | "audio" | "image";

/** Where an asset's pixels/samples come from. */
export type AssetSource =
  /** Built-in generated SVG artwork used by the demo project. */
  | { type: "generated"; scene: string; thumb: string }
  /** Phase 1: an imported file stored in the Origin Private File System. */
  | { type: "opfs"; path: string };

export interface Asset {
  id: Id;
  kind: AssetKind;
  name: string;
  durationFrames: Frame;
  width?: number;
  height?: number;
  source: AssetSource;
}

/**
 * `main`    – the primary video track (magnet/ripple behaviour arrives in Phase 2)
 * `overlay` – picture-in-picture / stickers etc.
 * `audio`   – audio-only clips
 * Track ORDER in `Project.tracks` is visual order, top to bottom.
 */
export type TrackKind = "main" | "overlay" | "audio";

export interface Track {
  id: Id;
  kind: TrackKind;
  name: string;
  muted: boolean;
  locked: boolean;
  hidden: boolean;
}

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";

export interface ClipFilter {
  name: string;
  /** 0–100 */
  strength: number;
}

export interface ClipEffect {
  id: Id;
  type: string;
  name: string;
}

/** Which Properties sections are switched on for this clip (the little checkboxes). */
export interface ClipSections {
  filters: boolean;
  effects: boolean;
  transform: boolean;
  blend: boolean;
}

export type ClipSection = keyof ClipSections;

export interface ClipTransform {
  /**
   * UI-semantic "Zoom" slider value 0–100 (50 = default). NOT yet applied to pixels.
   * Phase 3 replaces this with a real `scale` percentage via a v2 migration.
   */
  zoom: number;
  x: number;
  y: number;
  /** Degrees. */
  rotation: number;
}

export interface Clip {
  id: Id;
  trackId: Id;
  assetId: Id;
  /** Timeline position of the clip's first frame. */
  start: Frame;
  /** Length on the timeline, in frames. */
  duration: Frame;
  /** First source frame used (offset into the asset, in source frames). */
  sourceIn: Frame;
  /** Playback speed multiplier; 1 = normal. Timeline length = source length / speed. */
  speed: number;
  transform: ClipTransform;
  /** 0–100 */
  opacity: number;
  blend: BlendMode;
  filter: ClipFilter | null;
  effects: ClipEffect[];
  sections: ClipSections;
}

export interface Marker {
  id: Id;
  frame: Frame;
  label: string;
}

export interface Project {
  schemaVersion: typeof SCHEMA_VERSION;
  id: Id;
  name: string;
  /** Epoch milliseconds. */
  createdAt: number;
  updatedAt: number;
  settings: ProjectSettings;
  assets: Asset[];
  tracks: Track[];
  clips: Clip[];
  markers: Marker[];
}
