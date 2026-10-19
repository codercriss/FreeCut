import { afterEach, describe, expect, it, vi } from "vitest";
import { rollIndex } from "./heroPick";

afterEach(() => vi.restoreAllMocks());

describe("rollIndex", () => {
  it("never repeats the previous pick, across the whole random range", () => {
    for (const count of [2, 3, 6]) {
      for (let last = 0; last < count; last++) {
        for (const r of [0, 0.0001, 0.25, 0.5, 0.75, 0.9999999]) {
          vi.spyOn(Math, "random").mockReturnValue(r);
          const i = rollIndex(count, last);
          expect(i).not.toBe(last);
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(count);
        }
      }
    }
  });
  it("can reach every other index", () => {
    const seen = new Set<number>();
    for (let k = 0; k < 6; k++) {
      vi.spyOn(Math, "random").mockReturnValue(k / 6 + 0.01);
      seen.add(rollIndex(6, 2));
    }
    expect([...seen].sort()).toEqual([0, 1, 3, 4, 5]);
  });
  it("handles an unknown / invalid last pick and tiny lists", () => {
    expect(rollIndex(1, 0)).toBe(0);
    expect(rollIndex(0, -1)).toBe(0);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(rollIndex(4, -1)).toBe(2);
    expect(rollIndex(4, 99)).toBe(2);
  });
});
