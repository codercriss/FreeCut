import { describe, expect, it } from "vitest";
import { toneWav } from "./toneWav";

const ascii = (b: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...Array.from(b.slice(from, to)));

describe("toneWav", () => {
  it("writes a valid 16-bit mono PCM WAV header", () => {
    const b = toneWav({ seconds: 0.5, sampleRate: 8000 });
    const v = new DataView(b.buffer);
    expect(ascii(b, 0, 4)).toBe("RIFF");
    expect(ascii(b, 8, 12)).toBe("WAVE");
    expect(ascii(b, 12, 16)).toBe("fmt ");
    expect(ascii(b, 36, 40)).toBe("data");
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(8000);
    expect(v.getUint16(34, true)).toBe(16);
  });

  it("has sizes that agree with the amount of audio", () => {
    const b = toneWav({ seconds: 0.5, sampleRate: 8000 });
    const v = new DataView(b.buffer);
    expect(b.length).toBe(44 + 4000 * 2);
    expect(v.getUint32(40, true)).toBe(8000);
    expect(v.getUint32(4, true)).toBe(b.length - 8);
  });

  it("starts and ends silent (no click) and is audible in the middle but not loud", () => {
    const b = toneWav({ seconds: 0.2, sampleRate: 8000, volume: 0.3 });
    const v = new DataView(b.buffer);
    const n = (b.length - 44) / 2;
    expect(v.getInt16(44, true)).toBe(0);
    expect(Math.abs(v.getInt16(44 + (n - 1) * 2, true)) < 400).toBe(true);
    let peak = 0;
    for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(v.getInt16(44 + i * 2, true)));
    expect(peak > 5000).toBe(true);
    expect(peak <= 0.3 * 32767 + 1).toBe(true);
  });
});
