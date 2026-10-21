import { describe, expect, it } from "vitest";
import { classifyFile, formatBytes, newId } from "./classify";

const f = (name: string, type = "") => ({ name, type });

describe("classifyFile", () => {
  it("trusts the MIME type first", () => {
    expect(classifyFile(f("x", "video/mp4"))).toBe("video");
    expect(classifyFile(f("x", "audio/mpeg"))).toBe("audio");
    expect(classifyFile(f("x", "image/png"))).toBe("image");
    expect(classifyFile(f("clip.mp3", "video/mp4"))).toBe("video"); // type wins over extension
  });
  it("falls back to the extension when iOS/Android give no type", () => {
    expect(classifyFile(f("IMG_1234.MOV"))).toBe("video");
    expect(classifyFile(f("IMG_1234.HEIC"))).toBe("image");
    expect(classifyFile(f("Voice 001.m4a"))).toBe("audio");
    expect(classifyFile(f("a.b.c.JPG"))).toBe("image");
  });
  it("rejects everything else", () => {
    expect(classifyFile(f("notes.txt", "text/plain"))).toBeNull();
    expect(classifyFile(f("archive.zip"))).toBeNull();
    expect(classifyFile(f("noextension"))).toBeNull();
    expect(classifyFile(f(""))).toBeNull();
  });
});

describe("helpers", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(250 * 1024 * 1024)).toBe("250 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });
  it("makes unique, prefixed ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newId("asset")));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^asset-[a-z0-9]+$/);
  });
});
