import { beforeEach, describe, expect, it } from "vitest";
import { holdBusy, isBusy, pulseBusy, resetBusy, whenQuiet } from "./busy";

beforeEach(() => resetBusy());

describe("busy gate", () => {
  it("is quiet when nothing is going on", () => {
    expect(isBusy(1000)).toBe(false);
  });

  it("is busy while something holds it, and quiet again once every hold is released", () => {
    const a = holdBusy();
    const b = holdBusy();
    expect(isBusy(0)).toBe(true);
    a();
    expect(isBusy(0)).toBe(true);
    b();
    expect(isBusy(0)).toBe(false);
  });

  it("ignores a second release of the same hold", () => {
    const a = holdBusy();
    const b = holdBusy();
    a();
    a();
    expect(isBusy(0)).toBe(true); // b still holds
    b();
    expect(isBusy(0)).toBe(false);
  });

  it("is busy for a while after a pulse, then quiet", () => {
    pulseBusy(500, 1000);
    expect(isBusy(1200)).toBe(true);
    expect(isBusy(1499)).toBe(true);
    expect(isBusy(1500)).toBe(false);
  });

  it("a later pulse extends the busy time and a shorter one never cuts it short", () => {
    pulseBusy(500, 1000);
    pulseBusy(100, 1100); // would end at 1200 — earlier than 1500
    expect(isBusy(1400)).toBe(true);
    pulseBusy(500, 1400);
    expect(isBusy(1850)).toBe(true);
    expect(isBusy(1900)).toBe(false);
  });
});

describe("whenQuiet", () => {
  it("returns at once when idle", async () => {
    const slept: number[] = [];
    await whenQuiet({ now: () => 0, sleep: async (ms) => void slept.push(ms) });
    expect(slept).toEqual([]);
  });

  it("waits, checking regularly, until a hold is released", async () => {
    const release = holdBusy();
    const slept: number[] = [];
    await whenQuiet({
      pollMs: 100,
      now: () => 0,
      sleep: async (ms) => {
        slept.push(ms);
        if (slept.length === 3) release();
      },
    });
    expect(slept).toEqual([100, 100, 100]);
  });

  it("waits out a pulse using the clock it is given", async () => {
    pulseBusy(300, 0);
    let t = 0;
    const slept: number[] = [];
    await whenQuiet({
      pollMs: 100,
      now: () => t,
      sleep: async (ms) => {
        slept.push(ms);
        t += ms;
      },
    });
    expect(slept).toHaveLength(3);
    expect(t).toBe(300);
  });
});
