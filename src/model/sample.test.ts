import { describe, expect, it } from "vitest";
import { createEmptyProject, createSampleProject } from "./sample";
import { activeVisualClip, clipsOnTrack, defaultSelection, projectDuration } from "./selectors";
import { validateProject } from "./schema";

describe("sample project", () => {
  const p = createSampleProject(1000);

  it("is valid", () => {
    expect(validateProject(p)).toEqual([]);
  });
  it("reproduces the v1.0.0 prototype's timing", () => {
    expect(p.settings.fps).toBe(60);
    expect(projectDuration(p)).toBe(27 * 60 + 58); // 00:00:27:58
    const audio = p.clips.find((c) => c.id === "clip-audio")!;
    expect(audio.start / 60).toBeCloseTo(5.24, 1);
    expect(audio.duration / 60).toBeCloseTo(10.04, 1);
    expect(audio.speed).toBe(2);
  });
  it("keeps every clip inside its asset", () => {
    for (const c of p.clips) {
      const a = p.assets.find((x) => x.id === c.assetId)!;
      expect(c.sourceIn + c.duration * c.speed).toBeLessThanOrEqual(a.durationFrames);
    }
  });
  it("has the track layout the timeline expects (top → bottom)", () => {
    expect(p.tracks.map((t) => t.kind)).toEqual(["overlay", "main", "audio"]);
  });
  it("selects the main clip by default", () => {
    expect(defaultSelection(p)).toEqual(["clip-main"]);
  });
  it("shows the main clip, and nothing on the final (exclusive) frame", () => {
    expect(activeVisualClip(p, 0)?.id).toBe("clip-main");
    expect(activeVisualClip(p, 1677)?.id).toBe("clip-main");
    expect(activeVisualClip(p, 1678)).toBeUndefined();
  });
  it("sorts clips on a track by start", () => {
    expect(clipsOnTrack(p, "track-main").map((c) => c.id)).toEqual(["clip-main"]);
  });
  it("empty project is valid and zero-length", () => {
    const e = createEmptyProject("e1", "Empty", 5);
    expect(validateProject(e)).toEqual([]);
    expect(projectDuration(e)).toBe(0);
    expect(defaultSelection(e)).toEqual([]);
  });
});
