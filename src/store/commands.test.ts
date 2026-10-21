import { describe, expect, it } from "vitest";
import { createEmptyProject, createSampleProject } from "../model/sample";
import { validateProject } from "../model/schema";
import type { Asset, Project } from "../model/types";
import {
  addAssets,
  addClipFromAsset,
  removeAsset,
  renameAsset,
  removeClipEffect,
  renameProject,
  resetClipSection,
  setClipBlend,
  setClipOpacity,
  setClipSectionEnabled,
  setClipZoom,
  setFilterStrength,
  setTrackMuted,
} from "./commands";
import type { Command } from "./projectStore";

const P = () => createSampleProject(1);
const run = (p: Project, c: Command) => c.apply(p);
const main = (p: Project) => p.clips.find((c) => c.id === "clip-main")!;

describe("commands", () => {
  it("setTrackMuted toggles one track and leaves others alone", () => {
    const p = run(P(), setTrackMuted("track-main", true));
    expect(p.tracks.find((t) => t.id === "track-main")!.muted).toBe(true);
    expect(p.tracks.find((t) => t.id === "track-audio-1")!.muted).toBe(false);
  });
  it("returns the SAME project for no-ops and unknown ids", () => {
    const p = P();
    expect(run(p, setTrackMuted("track-main", false))).toBe(p);
    expect(run(p, setTrackMuted("nope", true))).toBe(p);
    expect(run(p, setClipOpacity("nope", 5))).toBe(p);
    expect(run(p, setClipOpacity("clip-main", 100))).toBe(p);
    expect(run(p, removeClipEffect("clip-main", "nope"))).toBe(p);
    expect(run(p, renameProject("   "))).toBe(p);
    expect(run(p, renameProject("This is a title"))).toBe(p);
  });
  it("clamps and rounds numeric values into range", () => {
    expect(main(run(P(), setClipOpacity("clip-main", 250))).opacity).toBe(100);
    expect(main(run(P(), setClipOpacity("clip-main", -4))).opacity).toBe(0);
    expect(main(run(P(), setClipOpacity("clip-main", 41.6))).opacity).toBe(42);
    expect(main(run(P(), setClipZoom("clip-main", 500))).transform.zoom).toBe(100);
    expect(main(run(P(), setFilterStrength("clip-main", -1))).filter!.strength).toBe(0);
  });
  it("filter strength on a clip without a filter does nothing", () => {
    const p = P();
    expect(run(p, setFilterStrength("clip-audio", 80))).toBe(p);
  });
  it("sets blend mode and section flags", () => {
    expect(main(run(P(), setClipBlend("clip-main", "multiply"))).blend).toBe("multiply");
    const off = run(P(), setClipSectionEnabled("clip-main", "effects", false));
    expect(main(off).sections).toEqual({
      filters: true,
      effects: false,
      transform: true,
      blend: true,
    });
  });
  it("removes an effect by id", () => {
    const p = run(P(), removeClipEffect("clip-main", "fx-motion-blur"));
    expect(main(p).effects).toEqual([]);
  });
  it("reset restores each section's defaults", () => {
    let p = P();
    p = run(p, setFilterStrength("clip-main", 90));
    p = run(p, setClipZoom("clip-main", 10));
    p = run(p, setClipOpacity("clip-main", 20));
    p = run(p, setClipBlend("clip-main", "screen"));
    p = run(p, removeClipEffect("clip-main", "fx-motion-blur"));
    for (const s of ["filters", "transform", "blend", "effects"] as const)
      p = run(p, resetClipSection("clip-main", s));
    expect(main(p)).toEqual(main(P()));
  });
  it("reset on an already-default section is a no-op", () => {
    const p = P();
    expect(run(p, resetClipSection("clip-main", "blend"))).toBe(p);
  });
  it("always produces a valid project", () => {
    let p = P();
    p = run(p, setClipOpacity("clip-main", 33));
    p = run(p, setTrackMuted("track-audio-1", true));
    p = run(p, removeClipEffect("clip-main", "fx-motion-blur"));
    p = run(p, renameProject("  Holiday  "));
    expect(p.name).toBe("Holiday");
    expect(validateProject(p)).toEqual([]);
  });
  it("gives drag-able commands a coalesce key and discrete ones none", () => {
    expect(setClipOpacity("clip-main", 1).coalesceKey).toBe("clip.opacity:clip-main");
    expect(setClipZoom("clip-main", 1).coalesceKey).toBe("clip.zoom:clip-main");
    expect(setTrackMuted("track-main", true).coalesceKey).toBeUndefined();
    expect(setClipBlend("clip-main", "screen").coalesceKey).toBeUndefined();
  });
});

/* ───────────── media / timeline commands (Phase 1a) ───────────── */
const imported = (id: string, kind: Asset["kind"], frames: number): Asset => ({
  id,
  kind,
  name: `${id}.file`,
  durationFrames: frames,
  source: { type: "stored", mediaId: `m-${id}` },
});

describe("addAssets", () => {
  it("adds a batch and skips ids that already exist", () => {
    const base = P();
    const p = run(base, addAssets([imported("a", "video", 60), imported("b", "audio", 90)]));
    expect(p.assets).toHaveLength(base.assets.length + 2);
    expect(run(p, addAssets([imported("a", "video", 60)]))).toBe(p);
    expect(run(base, addAssets([]))).toBe(base);
  });
  it("labels one file vs many for the undo history", () => {
    expect(addAssets([imported("a", "video", 1)]).label).toBe("Import media");
    expect(addAssets([imported("a", "video", 1), imported("b", "video", 1)]).label).toBe(
      "Import 2 files",
    );
  });
});

describe("renameAsset", () => {
  const withA = () => run(P(), addAssets([imported("a", "video", 60)]));
  it("renames (trimmed) and ignores blank / unchanged / unknown", () => {
    const p = withA();
    expect(run(p, renameAsset("a", "  Beach day  ")).assets.find((a) => a.id === "a")!.name).toBe(
      "Beach day",
    );
    expect(run(p, renameAsset("a", "   "))).toBe(p);
    expect(run(p, renameAsset("a", "a.file"))).toBe(p);
    expect(run(p, renameAsset("nope", "x"))).toBe(p);
  });
});

describe("removeAsset", () => {
  it("removes the asset AND the clips that use it, and nothing else", () => {
    let p = run(P(), addAssets([imported("a", "video", 60)]));
    p = run(p, addClipFromAsset("a", "c1"));
    p = run(p, addClipFromAsset("a", "c2"));
    const out = run(p, removeAsset("a"));
    expect(out.assets.some((a) => a.id === "a")).toBe(false);
    expect(out.clips.map((c) => c.id)).toEqual(["clip-main", "clip-audio"]);
    expect(validateProject(out)).toEqual([]);
  });
  it("ignores an unknown id", () => {
    const p = P();
    expect(run(p, removeAsset("nope"))).toBe(p);
  });
});

describe("addClipFromAsset", () => {
  const withAssets = () =>
    run(
      P(),
      addAssets([
        imported("v", "video", 120),
        imported("a", "audio", 200),
        imported("i", "image", 300),
      ]),
    );

  it("appends video to the END of the main track and photos too", () => {
    let p = withAssets();
    p = run(p, addClipFromAsset("v", "c-v"));
    const c = p.clips.find((x) => x.id === "c-v")!;
    expect(c).toMatchObject({
      trackId: "track-main",
      start: 1678,
      duration: 120,
      sourceIn: 0,
      speed: 1,
      opacity: 100,
      filter: null,
      effects: [],
    });
    p = run(p, addClipFromAsset("i", "c-i"));
    expect(p.clips.find((x) => x.id === "c-i")).toMatchObject({
      trackId: "track-main",
      start: 1798,
      duration: 300,
    });
  });
  it("puts audio on the audio track after the existing audio", () => {
    const p = run(withAssets(), addClipFromAsset("a", "c-a"));
    expect(p.clips.find((x) => x.id === "c-a")).toMatchObject({
      trackId: "track-audio-1",
      start: 916,
      duration: 200,
    });
  });
  it("starts at 0 on an empty track", () => {
    const e = createEmptyProject("e", "E", 1);
    const p = run(run(e, addAssets([imported("v", "video", 50)])), addClipFromAsset("v", "c"));
    expect(p.clips[0].start).toBe(0);
  });
  it("never creates overlaps, and always yields a valid project", () => {
    let p = withAssets();
    for (let i = 0; i < 5; i++) p = run(p, addClipFromAsset("v", `c${i}`));
    expect(validateProject(p)).toEqual([]);
  });
  it("is a no-op for unknown assets, zero-length assets, duplicate clip ids and missing tracks", () => {
    const p = withAssets();
    expect(run(p, addClipFromAsset("nope", "x"))).toBe(p);
    const q = run(p, addClipFromAsset("v", "dup"));
    expect(run(q, addClipFromAsset("v", "dup"))).toBe(q);
    const zero = run(P(), addAssets([imported("z", "video", 0)]));
    expect(run(zero, addClipFromAsset("z", "c"))).toBe(zero);
    const noTracks = { ...withAssets(), tracks: [] };
    expect(run(noTracks, addClipFromAsset("v", "c"))).toBe(noTracks);
  });
});
