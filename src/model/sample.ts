import { DEFAULT_EFFECTS, DEFAULT_FILTER, DEFAULT_SECTIONS, DEFAULT_TRANSFORM } from "./defaults";
import type { Asset, Clip, Project, Track } from "./types";
import { SCHEMA_VERSION } from "./types";

export const SAMPLE_PROJECT_ID = "sample-project";
const FPS = 60;

/**
 * Built-in demo project: the same picture the v1.0.0 prototype showed, now expressed as data.
 * Footage is generated SVG art (see editor/footage) until Phase 1 brings real media.
 */
export function createSampleProject(now: number = Date.now()): Project {
  const gen = (scene: string, thumb = scene) => ({ type: "generated" as const, scene, thumb });
  const video = (
    id: string,
    name: string,
    seconds: number,
    scene: string,
    thumb?: string,
  ): Asset => ({
    id,
    kind: "video",
    name,
    durationFrames: seconds * FPS,
    width: 1920,
    height: 1080,
    source: gen(scene, thumb),
  });

  const assets: Asset[] = [
    // The footage on the timeline (27 s 58 f).
    {
      ...video("asset-moraine", "Moraine Lake.mov", 0, "ve-sc-moraine", "ve-sc-moraine-lite"),
      durationFrames: 27 * FPS + 58,
    },
    // Library items (the four placeholders the prototype showed).
    video("asset-cave", "CRST001334.mov", 21, "ve-sc-cave"),
    video("asset-ocean", "CRST001334.mov", 39, "ve-sc-ocean"),
    video("asset-bay", "CRST001334.mov", 34, "ve-sc-bay"),
    video("asset-mist", "CRST001334.mov", 10, "ve-sc-mist"),
    {
      id: "asset-audio",
      kind: "audio",
      name: "Audio.aac",
      durationFrames: 30 * FPS,
      source: { type: "generated", scene: "", thumb: "" },
    },
  ];

  const track = (id: string, kind: Track["kind"], name: string): Track => ({
    id,
    kind,
    name,
    muted: false,
    locked: false,
    hidden: false,
  });
  const tracks: Track[] = [
    track("track-overlay-1", "overlay", "Overlay 1"),
    track("track-main", "main", "Main"),
    track("track-audio-1", "audio", "Audio 1"),
  ];

  const base = {
    transform: { ...DEFAULT_TRANSFORM },
    opacity: 100,
    blend: "normal" as const,
    filter: { ...DEFAULT_FILTER },
    effects: DEFAULT_EFFECTS.map((e) => ({ ...e })),
    sections: { ...DEFAULT_SECTIONS },
  };
  const clips: Clip[] = [
    {
      ...base,
      id: "clip-main",
      trackId: "track-main",
      assetId: "asset-moraine",
      start: 0,
      duration: 27 * FPS + 58,
      sourceIn: 0,
      speed: 1,
    },
    {
      ...base,
      id: "clip-audio",
      trackId: "track-audio-1",
      assetId: "asset-audio",
      start: 314, // ≈ 5.24 s
      duration: 602, // ≈ 10.04 s on the timeline…
      sourceIn: 0, // …consuming 1204 source frames at 2×
      speed: 2,
      filter: null,
      effects: [],
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    id: SAMPLE_PROJECT_ID,
    name: "This is a title",
    createdAt: now,
    updatedAt: now,
    settings: { fps: FPS, width: 1920, height: 1080, ratio: "16:9" },
    assets,
    tracks,
    clips,
    markers: [],
  };
}

/** A blank project (no media). Used by tests and, from Phase 9, "New project". */
export function createEmptyProject(id: string, name: string, now: number = Date.now()): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    settings: { fps: FPS, width: 1920, height: 1080, ratio: "16:9" },
    assets: [],
    tracks: [
      {
        id: "track-overlay-1",
        kind: "overlay",
        name: "Overlay 1",
        muted: false,
        locked: false,
        hidden: false,
      },
      { id: "track-main", kind: "main", name: "Main", muted: false, locked: false, hidden: false },
      {
        id: "track-audio-1",
        kind: "audio",
        name: "Audio 1",
        muted: false,
        locked: false,
        hidden: false,
      },
    ],
    clips: [],
    markers: [],
  };
}
