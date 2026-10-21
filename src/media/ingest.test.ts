import { describe, expect, it, vi } from "vitest";
import { validateProject } from "../model/schema";
import { createSampleProject } from "../model/sample";
import { addAssets } from "../store/commands";
import { ingestFiles, NO_SPACE, NOT_MEDIA, type ImportItem, type IngestDeps } from "./ingest";
import { ProbeError, type Probe } from "./probe";

const file = (name: string, type = "", size = 10) =>
  new File([new Uint8Array(size)], name, { type });

function deps(over: Partial<IngestDeps> = {}) {
  const stored = new Map<string, Blob>();
  let n = 0;
  const d: IngestDeps = {
    probe: vi.fn(async (f: File, hint): Promise<Probe> => ({
      kind: hint,
      durationSec: hint === "image" ? 0 : 2.5,
      width: hint === "audio" ? undefined : 1920,
      height: hint === "audio" ? undefined : 1080,
      mime: f.type,
    })),
    poster: vi.fn(async (_f: File, p: Probe) =>
      p.kind === "audio" ? null : new Blob(["poster"], { type: "image/jpeg" }),
    ),
    peaks: vi.fn(async (_f: File, p: Probe) => (p.kind === "audio" ? [10, 100, 30] : null)),
    put: vi.fn(async (id: string, b: Blob) => void stored.set(id, b)),
    remove: vi.fn(async (id: string) => void stored.delete(id)),
    newId: (prefix: string) => `${prefix}-${++n}`,
    fps: 60,
    ...over,
  };
  return { d, stored };
}

describe("ingestFiles", () => {
  it("imports a video, a photo and audio with correct frames, sizes and stored blobs", async () => {
    const { d, stored } = deps();
    const r = await ingestFiles(
      [
        file("a.mov", "video/quicktime", 100),
        file("b.heic", "", 200),
        file("c.m4a", "audio/mp4", 300),
      ],
      d,
    );
    expect(r.failed).toEqual([]);
    const [v, img, a] = r.assets;
    expect(v).toMatchObject({
      kind: "video",
      name: "a.mov",
      durationFrames: 150,
      width: 1920,
      height: 1080,
      mime: "video/quicktime",
      bytes: 100,
    });
    expect(img).toMatchObject({ kind: "image", name: "b.heic", durationFrames: 300 }); // photos default to 5 s
    expect(a).toMatchObject({ kind: "audio", durationFrames: 150, peaks: [10, 100, 30] });
    expect(a.width).toBeUndefined();
    // file + poster stored for video/photo, file only for audio
    expect(stored.size).toBe(5);
    expect(v.source).toEqual({ type: "stored", mediaId: "media-2" });
    expect(stored.has("media-2")).toBe(true);
    expect(stored.has("media-2:poster")).toBe(true);
    expect(a.source.type === "stored" && stored.has(`${a.source.mediaId}:poster`)).toBe(false);
  });

  it("rounds durations to whole frames at the project fps, and never produces 0 frames", async () => {
    const { d } = deps({
      fps: 30,
      probe: vi.fn(async () => ({ kind: "video" as const, durationSec: 0.001, mime: "" })),
    });
    const r = await ingestFiles([file("tiny.mp4", "video/mp4")], d);
    expect(r.assets[0].durationFrames).toBe(1);
    const { d: d2 } = deps({
      probe: vi.fn(async () => ({ kind: "video" as const, durationSec: 27.9667, mime: "" })),
    });
    const r2 = await ingestFiles([file("x.mp4", "video/mp4")], d2);
    expect(r2.assets[0].durationFrames).toBe(1678);
    expect(Number.isInteger(r2.assets[0].durationFrames)).toBe(true);
  });

  it("uses the probed kind (an audio-only .mp4 becomes audio)", async () => {
    const { d } = deps({
      probe: vi.fn(async () => ({ kind: "audio" as const, durationSec: 3, mime: "video/mp4" })),
    });
    const r = await ingestFiles([file("podcast.mp4", "video/mp4")], d);
    expect(r.assets[0].kind).toBe("audio");
  });

  it("rejects non-media, empty and oversized files with clear messages — and keeps going", async () => {
    const { d } = deps();
    const big = file("huge.mp4", "video/mp4");
    Object.defineProperty(big, "size", { value: 3 * 1024 ** 3 });
    const r = await ingestFiles(
      [
        file("notes.txt", "text/plain"),
        file("empty.mp4", "video/mp4", 0),
        big,
        file("ok.mp4", "video/mp4"),
      ],
      d,
    );
    expect(r.assets.map((a) => a.name)).toEqual(["ok.mp4"]);
    expect(r.failed).toHaveLength(3);
    expect(r.failed[0]).toEqual({ name: "notes.txt", message: NOT_MEDIA });
    expect(r.failed[1].message).toMatch(/empty/);
    expect(r.failed[2].message).toMatch(/too large \(3\.0 GB\)/);
    expect(d.probe).toHaveBeenCalledTimes(1); // rejected before any decoding
  });

  it("a file the browser can't read fails with the probe's message; the rest still import", async () => {
    const probe = vi.fn(async (f: File, hint: "video" | "audio" | "image"): Promise<Probe> => {
      if (f.name === "broken.mp4")
        throw new ProbeError("This browser can’t play this video format.");
      return { kind: hint, durationSec: 1, mime: "" };
    });
    const { d, stored } = deps({ probe });
    const r = await ingestFiles(
      [file("broken.mp4", "video/mp4"), file("fine.mp4", "video/mp4")],
      d,
    );
    expect(r.assets).toHaveLength(1);
    expect(r.failed).toEqual([
      { name: "broken.mp4", message: "This browser can’t play this video format." },
    ]);
    expect(stored.size).toBe(2); // nothing stored for the broken one
  });

  it("a missing poster or waveform never blocks the import", async () => {
    const { d } = deps({
      poster: vi.fn(async () => {
        throw new Error("iOS refused to paint");
      }),
      peaks: vi.fn(async () => {
        throw new Error("decode failed");
      }),
    });
    const r = await ingestFiles([file("a.mp4", "video/mp4"), file("b.m4a", "audio/mp4")], d);
    expect(r.failed).toEqual([]);
    expect(r.assets).toHaveLength(2);
    expect("peaks" in r.assets[1]).toBe(false);
  });

  it("storage full → friendly message, and everything stored for that file is cleaned up", async () => {
    let puts = 0;
    const quota = new DOMException("full", "QuotaExceededError");
    const { d, stored } = deps({
      put: vi.fn(async (id: string, b: Blob) => {
        if (++puts === 2) throw quota; // the file went in; the poster didn't fit
        stored.set(id, b);
      }),
    });
    const r = await ingestFiles([file("a.mp4", "video/mp4")], d);
    expect(r.assets).toEqual([]);
    expect(r.failed[0].message).toBe(NO_SPACE);
    expect(stored.size).toBe(0); // the already-stored file was removed
  });

  it("an unexpected error gives a generic message (and is logged), not a crash", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d } = deps({
      put: vi.fn(async () => {
        throw new Error("weird");
      }),
    });
    const r = await ingestFiles([file("a.mp4", "video/mp4")], d);
    expect(r.failed[0].message).toBe("Something went wrong while importing this file.");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("works one file at a time and reports each state change", async () => {
    const order: string[] = [];
    const { d } = deps({
      probe: vi.fn(async (f: File, hint) => {
        order.push(`start ${f.name}`);
        await Promise.resolve();
        order.push(`end ${f.name}`);
        return { kind: hint, durationSec: 1, mime: "" } as Probe;
      }),
    });
    const snaps: ImportItem[][] = [];
    await ingestFiles([file("1.mp4", "video/mp4"), file("2.mp4", "video/mp4")], d, (items) =>
      snaps.push(items),
    );
    expect(order).toEqual(["start 1.mp4", "end 1.mp4", "start 2.mp4", "end 2.mp4"]);
    expect(snaps[0].map((i) => i.state)).toEqual(["queued", "queued"]);
    expect(snaps.at(-1)!.map((i) => i.state)).toEqual(["done", "done"]);
    expect(snaps.some((s) => s[0].state === "working" && s[1].state === "queued")).toBe(true);
  });

  it("imported assets always form a valid project", async () => {
    const { d } = deps();
    const r = await ingestFiles(
      [file("a.mov", "video/quicktime"), file("b.png", "image/png"), file("c.mp3", "audio/mpeg")],
      d,
    );
    const p = addAssets(r.assets).apply(createSampleProject(1));
    expect(validateProject(p)).toEqual([]);
  });
});
