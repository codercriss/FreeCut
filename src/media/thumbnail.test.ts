import { describe, expect, it } from "vitest";
import { fitSize, peaksFromSamples } from "./thumbnail";

describe("fitSize", () => {
  it("fits inside the box keeping the aspect ratio", () => {
    expect(fitSize(1920, 1080, 320)).toEqual({ w: 320, h: 180 });
    expect(fitSize(1080, 1920, 320)).toEqual({ w: 180, h: 320 });
  });
  it("never upscales", () => expect(fitSize(100, 50, 320)).toEqual({ w: 100, h: 50 }));
  it("never returns a zero side", () => expect(fitSize(10000, 1, 320)).toEqual({ w: 320, h: 1 }));
});

describe("peaksFromSamples", () => {
  it("returns one 0–100 value per bucket, normalised to the loudest", () => {
    const s = new Float32Array(100);
    s[5] = 0.25;
    s[55] = -0.5; // negative samples count by magnitude
    const p = peaksFromSamples(s, 2);
    expect(p).toEqual([50, 100]);
  });
  it("is silent for silence, and empty for no samples", () => {
    expect(peaksFromSamples(new Float32Array(50), 5)).toEqual([0, 0, 0, 0, 0]);
    expect(peaksFromSamples(new Float32Array(0), 5)).toEqual([]);
    expect(peaksFromSamples(new Float32Array(10), 0)).toEqual([]);
  });
  it("handles fewer samples than buckets", () => {
    const p = peaksFromSamples(new Float32Array([0.1, 0.4]), 6);
    expect(p).toHaveLength(6);
    expect(Math.max(...p)).toBe(100);
  });
  it("produces integers in range", () => {
    const s = Float32Array.from({ length: 1000 }, (_, i) => Math.sin(i / 7) * Math.random());
    for (const v of peaksFromSamples(s, 120)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
