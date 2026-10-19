import { describe, expect, it } from "vitest";
import { createSampleProject } from "../../model/sample";
import { projectDuration } from "../../model/selectors";
import {
  createTimeScale,
  DESKTOP_BASE_PPS,
  DESKTOP_METRICS,
  DESKTOP_ORIGIN,
  layoutTracks,
  MOBILE_METRICS,
  rulerStep,
  timelineSeconds,
  zoomToScale,
} from "./geometry";

describe("TimeScale", () => {
  const s = createTimeScale(60, 30, 10);
  it("maps frames ⇄ pixels and round-trips", () => {
    expect(s.frameToX(0)).toBe(10);
    expect(s.frameToX(60)).toBe(40);
    for (const f of [0, 1, 59, 165, 1678]) expect(s.xToFrame(s.frameToX(f))).toBe(f);
  });
  it("measures widths", () => expect(s.framesToWidth(120)).toBe(60));
});

describe("K1b regression — ruler, clip and playhead agree", () => {
  const p = createSampleProject(1);
  const fps = p.settings.fps;
  it("the playhead and the ruler tick for the same time are at the same x", () => {
    for (const zoom of [0, 50, 100]) {
      const pps = DESKTOP_BASE_PPS * zoomToScale(zoom);
      const scale = createTimeScale(fps, pps, DESKTOP_ORIGIN);
      const frame = 165; // 00:00:02:45
      const rulerX = DESKTOP_ORIGIN + (frame / fps) * pps; // exactly how <Ruler> places a tick at t seconds
      expect(scale.frameToX(frame)).toBeCloseTo(rulerX, 9);
    }
  });
  it("the main clip ends exactly where the project ends", () => {
    const scale = createTimeScale(fps, DESKTOP_BASE_PPS, DESKTOP_ORIGIN);
    const main = p.clips.find((c) => c.id === "clip-main")!;
    expect(scale.frameToX(main.start + main.duration)).toBeCloseTo(
      scale.frameToX(projectDuration(p)),
      9,
    );
  });
  it("reproduces the prototype's clip pixels at the default zoom (video 624 px; audio 117 px / 224 px)", () => {
    const scale = createTimeScale(fps, DESKTOP_BASE_PPS * zoomToScale(50), DESKTOP_ORIGIN);
    const main = p.clips.find((c) => c.id === "clip-main")!;
    const audio = p.clips.find((c) => c.id === "clip-audio")!;
    expect(scale.framesToWidth(main.duration)).toBeCloseTo(624, 0);
    expect(scale.frameToX(audio.start)).toBeCloseTo(117, 0);
    expect(scale.framesToWidth(audio.duration)).toBeCloseTo(224, 0);
  });
});

describe("zoom & timeline extent", () => {
  it("maps the 0–100 slider to 0.4–1.6", () => {
    expect(zoomToScale(0)).toBeCloseTo(0.4);
    expect(zoomToScale(50)).toBeCloseTo(1);
    expect(zoomToScale(100)).toBeCloseTo(1.6);
  });
  it("always leaves room after the last clip, with a floor", () => {
    expect(timelineSeconds(0, 60)).toBe(60);
    expect(timelineSeconds(1678, 60)).toBe(60); // 28 s + 30 s tail < 60 s floor
    expect(timelineSeconds(100 * 60, 60)).toBe(130);
  });
});

describe("rulerStep", () => {
  it("picks the first nice step with enough pixels between labels", () => {
    expect(rulerStep(22.3, 40)).toBe(2);
    expect(rulerStep(8.9, 40)).toBe(5);
    expect(rulerStep(100, 40)).toBe(1);
    expect(rulerStep(28, 46)).toBe(2);
  });
  it("falls back for extreme zoom-out", () => expect(rulerStep(0.01, 40)).toBe(600));
  it("never produces labels closer than minGap", () => {
    for (const pps of [0.5, 2, 8.9, 22.3, 35.7, 98])
      expect(rulerStep(pps, 40) * pps).toBeGreaterThanOrEqual(40);
  });
});

describe("layoutTracks", () => {
  const tracks = createSampleProject(1).tracks;
  it("reproduces the prototype's desktop row positions", () => {
    const { rows, height } = layoutTracks(tracks, DESKTOP_METRICS);
    const byKind = Object.fromEntries(rows.map((r) => [r.track.kind, r]));
    expect(byKind.main.top).toBe(71); // MAIN_TOP
    expect(byKind.audio.top).toBe(134); // AUDIO_TOP
    expect(byKind.main.clipTop).toBe(75);
    expect(byKind.audio.clipTop).toBe(135);
    expect(byKind.main.clipHeight).toBe(55);
    expect(byKind.audio.clipHeight).toBe(38);
    expect(height).toBe(174);
  });
  it("reproduces the prototype's phone row positions (overlay hidden)", () => {
    const { rows } = layoutTracks(
      tracks.filter((t) => t.kind !== "overlay"),
      MOBILE_METRICS,
    );
    expect(rows[0].top).toBe(30); // M_MAIN_TOP
    expect(rows[1].top).toBe(93); // M_AUDIO_TOP
    expect(rows[0].clipTop).toBe(34);
    expect(rows[1].clipTop).toBe(95);
  });
  it("stacks rows without gaps or overlap", () => {
    const { rows } = layoutTracks(tracks, DESKTOP_METRICS);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i].top).toBe(rows[i - 1].top + rows[i - 1].height);
  });
});
