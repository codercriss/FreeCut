import { describe, expect, it } from "vitest";
import { clamp, clockTime, hhmmss, mmss, secondsToFrames, timecode } from "./time";

describe("time", () => {
  it("formats HH:MM:SS:FF", () => {
    expect(timecode(0, 60)).toBe("00:00:00:00");
    expect(timecode(165, 60)).toBe("00:00:02:45");
    expect(timecode(1678, 60)).toBe("00:00:27:58");
    expect(timecode(60 * 3600 + 61, 60)).toBe("01:00:01:01");
  });
  it("uses the project fps for the frame field", () => {
    expect(timecode(29, 30)).toBe("00:00:00:29");
    expect(timecode(30, 30)).toBe("00:00:01:00");
  });
  it("floors fractional and clamps negative frames", () => {
    expect(timecode(165.9, 60)).toBe("00:00:02:45");
    expect(timecode(-5, 60)).toBe("00:00:00:00");
  });
  it("formats mm:ss and hh:mm:ss", () => {
    expect(mmss(0)).toBe("00:00");
    expect(mmss(27.97)).toBe("00:27");
    expect(mmss(605)).toBe("10:05");
    expect(hhmmss(1678, 60)).toBe("00:00:27");
  });
  it("converts seconds to integer frames", () => {
    expect(secondsToFrames(2.75, 60)).toBe(165);
    expect(Number.isInteger(secondsToFrames(1.234, 30))).toBe(true);
  });
  it("clamps", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
  it("formats wall-clock time", () => {
    expect(clockTime(new Date(2026, 9, 16, 9, 5, 7).getTime())).toBe("09:05:07");
  });
});
