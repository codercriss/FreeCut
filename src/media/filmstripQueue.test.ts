import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "../model/types";
import { requestFilmstrip, resetFilmstripQueue, type QueueDeps } from "./filmstripQueue";

const video = (
  id: string,
  source: Asset["source"] = { type: "stored", mediaId: `m-${id}` },
): Asset => ({
  id,
  kind: "video",
  name: `${id}.mov`,
  durationFrames: 600,
  source,
});
const META = { count: 10, cols: 5, rows: 2, cellW: 171, cellH: 96, durationSec: 10 };

function deps(over: Partial<QueueDeps> = {}) {
  const d: QueueDeps = {
    hasStrip: vi.fn(async () => false),
    getFile: vi.fn(async () => new Blob(["video"])),
    make: vi.fn(async () => ({ blob: new Blob(["sprite"]), meta: META, notes: ["ok"] })),
    save: vi.fn(async () => undefined),
    refresh: vi.fn(),
    warn: vi.fn(),
    ...over,
  };
  return d;
}

beforeEach(() => resetFilmstripQueue());

describe("requestFilmstrip", () => {
  it("builds the sprite, saves it with its layout, and tells the UI to refresh", async () => {
    const d = deps();
    await requestFilmstrip(video("a"), 10, d);
    expect(d.make).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d.make).mock.calls[0][1]).toBe(10);
    expect(d.save).toHaveBeenCalledWith("m-a:strip", expect.any(Blob), META);
    expect(d.refresh).toHaveBeenCalledWith("m-a:strip");
  });

  it("waits for a quiet moment before reading the file and building (the person is playing)", async () => {
    const order: string[] = [];
    let go!: () => void;
    const gate = new Promise<void>((resolve) => (go = resolve));
    const d = deps({
      pause: vi.fn(async () => {
        order.push("pause");
        await gate;
        order.push("quiet");
      }),
      getFile: vi.fn(async () => {
        order.push("read");
        return new Blob(["video"]);
      }),
    });
    const job = requestFilmstrip(video("a"), 10, d);
    await new Promise((r) => setTimeout(r, 20));
    expect(d.getFile).not.toHaveBeenCalled(); // still waiting
    go();
    await job;
    expect(order).toEqual(["pause", "quiet", "read"]);
    expect(d.make).toHaveBeenCalledTimes(1);
  });

  it("does not wait at all when the sprite already exists", async () => {
    const d = deps({ hasStrip: vi.fn(async () => true), pause: vi.fn(async () => undefined) });
    await requestFilmstrip(video("a"), 10, d);
    expect(d.pause).not.toHaveBeenCalled();
  });

  it("does nothing if the sprite already exists in storage", async () => {
    const d = deps({ hasStrip: vi.fn(async () => true) });
    await requestFilmstrip(video("a"), 10, d);
    expect(d.make).not.toHaveBeenCalled();
    expect(d.save).not.toHaveBeenCalled();
  });

  it("is a no-op for demo footage, photos, audio and zero-length media", async () => {
    const d = deps();
    await requestFilmstrip(video("g", { type: "generated", scene: "s", thumb: "t" }), 10, d);
    await requestFilmstrip({ ...video("i"), kind: "image" }, 10, d);
    await requestFilmstrip({ ...video("a"), kind: "audio" }, 10, d);
    await requestFilmstrip(video("z"), 0, d);
    expect(d.hasStrip).not.toHaveBeenCalled();
  });

  it("builds each video only once, even if many clips ask at once", async () => {
    const d = deps();
    await Promise.all([
      requestFilmstrip(video("a"), 10, d),
      requestFilmstrip(video("a"), 10, d),
      requestFilmstrip(video("a"), 10, d),
    ]);
    expect(d.make).toHaveBeenCalledTimes(1);
  });

  it("builds ONE video at a time (a phone decodes one comfortably)", async () => {
    let active = 0;
    let max = 0;
    const d = deps({
      make: vi.fn(async () => {
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return { blob: new Blob(["s"]), meta: META, notes: [] };
      }),
    });
    await Promise.all([
      requestFilmstrip(video("a"), 10, d),
      requestFilmstrip(video("b"), 10, d),
      requestFilmstrip(video("c"), 10, d),
    ]);
    expect(max).toBe(1);
    expect(d.make).toHaveBeenCalledTimes(3);
  });

  it("a failed build is reported (with the reasons), remembered, and not retried in a loop", async () => {
    const d = deps({
      make: vi.fn(async () => ({
        blob: null,
        meta: null,
        notes: ["only 1/10 frames could be reached"],
      })),
    });
    await requestFilmstrip(video("a"), 10, d);
    await requestFilmstrip(video("a"), 10, d);
    expect(d.make).toHaveBeenCalledTimes(1);
    expect(d.save).not.toHaveBeenCalled();
    expect(d.refresh).not.toHaveBeenCalled();
    expect(vi.mocked(d.warn).mock.calls[0][0]).toContain("only 1/10 frames could be reached");
  });

  it("never throws, and one failure doesn't block the next video", async () => {
    const boom = deps({
      getFile: vi.fn(async () => {
        throw new Error("disk");
      }),
    });
    await expect(requestFilmstrip(video("a"), 10, boom)).resolves.toBeUndefined();
    expect(vi.mocked(boom.warn).mock.calls[0][0]).toContain("disk");
    const ok = deps();
    await requestFilmstrip(video("b"), 10, ok);
    expect(ok.save).toHaveBeenCalledTimes(1);
  });

  it("a missing stored file is reported, not crashed on", async () => {
    const d = deps({ getFile: vi.fn(async () => undefined) });
    await requestFilmstrip(video("a"), 10, d);
    expect(vi.mocked(d.warn).mock.calls[0][0]).toContain("not found");
    expect(d.make).not.toHaveBeenCalled();
  });
});
