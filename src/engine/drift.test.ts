import { describe, expect, it } from "vitest";
import { DRIFT, decideDrift, newDriftState } from "./drift";

describe("decideDrift", () => {
  it("leaves a video alone inside the dead zone, ahead or behind", () => {
    const s = newDriftState();
    for (const drift of [0, 0.01, -0.04, 0.079, -0.079]) {
      expect(decideDrift(s, drift, 1, 1000)).toEqual({ kind: "none" });
    }
    expect(s.correcting).toBe(false);
  });

  it("slows a video that is ahead and speeds up one that is behind, by 6 %", () => {
    const ahead = decideDrift(newDriftState(), 0.12, 1, 1000);
    expect(ahead).toEqual({ kind: "rate", rate: 1 - DRIFT.trim });
    const behind = decideDrift(newDriftState(), -0.12, 1, 1000);
    expect(behind).toEqual({ kind: "rate", rate: 1 + DRIFT.trim });
  });

  it("scales the correction by the clip's own speed", () => {
    const r = decideDrift(newDriftState(), 0.2, 2, 1000);
    expect(r).toEqual({ kind: "rate", rate: 2 * (1 - DRIFT.trim) });
  });

  it("holds the correction until the video is back within 20 ms, then restores the normal speed", () => {
    const s = newDriftState();
    expect(decideDrift(s, 0.2, 1, 1000)).toEqual({ kind: "rate", rate: 0.94 });
    // still drifting: the same correction, with no new decision (and the dead zone no longer matters)
    expect(decideDrift(s, 0.1, 1, 1033)).toEqual({ kind: "rate", rate: 0.94 });
    expect(decideDrift(s, 0.05, 1, 1066)).toEqual({ kind: "rate", rate: 0.94 });
    expect(decideDrift(s, 0.021, 1, 1099)).toEqual({ kind: "rate", rate: 0.94 });
    expect(decideDrift(s, 0.019, 1, 1132)).toEqual({ kind: "rate", rate: 1 });
    expect(s.correcting).toBe(false);
    // and then it is quiet again
    expect(decideDrift(s, 0.01, 1, 1165)).toEqual({ kind: "none" });
  });

  it("does not start a new correction within 400 ms of the last change", () => {
    const s = newDriftState();
    decideDrift(s, 0.2, 1, 1000);
    decideDrift(s, 0.0, 1, 1100); // corrected, back to normal at t=1100
    expect(decideDrift(s, 0.2, 1, 1300)).toEqual({ kind: "none" }); // only 200 ms later
    expect(decideDrift(s, 0.2, 1, 1500)).toEqual({ kind: "rate", rate: 0.94 });
  });

  it("jumps a video that is far off, but at most once per 800 ms", () => {
    const s = newDriftState();
    expect(decideDrift(s, 0.6, 1, 5000)).toEqual({ kind: "seek" });
    expect(decideDrift(s, 0.6, 1, 5400)).toEqual({ kind: "none" });
    expect(decideDrift(s, -0.9, 1, 5800)).toEqual({ kind: "seek" });
  });

  it("a jump cancels any correction in progress", () => {
    const s = newDriftState();
    decideDrift(s, 0.2, 1, 1000);
    expect(s.correcting).toBe(true);
    expect(decideDrift(s, 0.7, 1, 2000)).toEqual({ kind: "seek" });
    expect(s.correcting).toBe(false);
  });

  it("changes the rate rarely: a wobbling video produces only a handful of decisions, not one per frame", () => {
    const s = newDriftState();
    let changes = 0;
    let last = 1;
    // 5 seconds at 30 fps of a drift that wanders ±100 ms
    for (let i = 0; i < 150; i += 1) {
      const t = i * 33.3;
      const drift = 0.1 * Math.sin(t / 700);
      const a = decideDrift(s, drift, 1, t);
      if (a.kind === "rate" && a.rate !== last) {
        changes += 1;
        last = a.rate;
      }
    }
    expect(changes).toBeLessThan(12);
  });
});
