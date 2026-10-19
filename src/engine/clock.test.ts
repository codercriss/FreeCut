import { describe, expect, it } from "vitest";
import { advance } from "./clock";

describe("advance (time-based frame stepping)", () => {
  it("advances whole frames and carries the remainder", () => {
    let acc = 0;
    let frames = 0;
    for (let i = 0; i < 6; i++) {
      const r = advance(acc, 1000 / 60 / 2, 60); // a tick every half-frame
      frames += r.frames;
      acc = r.acc;
    }
    expect(frames).toBe(3);
  });
  it("plays at the correct speed regardless of display refresh rate", () => {
    const simulate = (hz: number, seconds: number, fps: number) => {
      let acc = 0;
      let frames = 0;
      for (let i = 0; i < hz * seconds; i++) {
        const r = advance(acc, 1000 / hz, fps);
        frames += r.frames;
        acc = r.acc;
      }
      return frames;
    };
    for (const hz of [30, 60, 120, 144])
      expect(Math.abs(simulate(hz, 10, 60) - 600)).toBeLessThanOrEqual(1);
    for (const fps of [24, 30, 60])
      expect(Math.abs(simulate(60, 10, fps) - fps * 10)).toBeLessThanOrEqual(1);
  });
  it("skips frames after a long stall instead of slowing down", () => {
    expect(advance(0, 500, 60).frames).toBe(30);
  });
  it("never returns a negative remainder", () => {
    expect(advance(0.9, 1, 60).acc).toBeGreaterThanOrEqual(0);
  });
});
