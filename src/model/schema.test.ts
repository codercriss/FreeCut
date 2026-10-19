import { describe, expect, it } from "vitest";
import { createSampleProject } from "./sample";
import { validateProject } from "./schema";
import type { Project } from "./types";

const base = () => structuredClone(createSampleProject(1)) as Project;
const errors = (mut: (p: Project) => void) => {
  const p = base();
  mut(p);
  return validateProject(p);
};

describe("validateProject", () => {
  it("accepts a good project", () => expect(validateProject(base())).toEqual([]));
  it("rejects non-objects", () => {
    expect(validateProject(null)).not.toEqual([]);
    expect(validateProject([])).not.toEqual([]);
    expect(validateProject("x")).not.toEqual([]);
  });
  it("rejects a wrong schemaVersion", () => {
    expect(
      errors((p) => ((p as unknown as { schemaVersion: number }).schemaVersion = 99)).join(),
    ).toMatch(/schemaVersion/);
  });
  it("rejects non-integer frame values", () => {
    expect(errors((p) => (p.clips[0].start = 1.5)).join()).toMatch(
      /start must be a non-negative integer/,
    );
    expect(errors((p) => (p.clips[0].duration = 0)).join()).toMatch(
      /duration must be a positive integer/,
    );
  });
  it("rejects dangling references", () => {
    expect(errors((p) => (p.clips[0].trackId = "nope")).join()).toMatch(/unknown track/);
    expect(errors((p) => (p.clips[0].assetId = "nope")).join()).toMatch(/unknown asset/);
  });
  it("rejects duplicate ids", () => {
    expect(errors((p) => p.clips.push({ ...p.clips[1], start: 5000 })).join()).toMatch(
      /duplicate clip id/,
    );
  });
  it("rejects overlapping clips on one track", () => {
    expect(errors((p) => p.clips.push({ ...p.clips[0], id: "dup", start: 100 })).join()).toMatch(
      /overlap/,
    );
  });
  it("rejects out-of-range values", () => {
    expect(errors((p) => (p.clips[0].opacity = 140)).join()).toMatch(/opacity/);
    expect(errors((p) => (p.clips[0].speed = 0)).join()).toMatch(/speed/);
    expect(errors((p) => (p.clips[0].filter = { name: "x", strength: -1 })).join()).toMatch(
      /filter/,
    );
  });
  it("rejects bad settings", () => {
    expect(errors((p) => (p.settings.fps = 0)).join()).toMatch(/settings/);
  });
});
