import { describe, expect, it } from "vitest";
import { createSampleProject } from "../model/sample";
import { validateProject } from "../model/schema";
import type { Project } from "../model/types";
import {
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
