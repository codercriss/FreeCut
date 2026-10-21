import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleProject } from "../model/sample";
import { createProjectStore } from "../store/projectStore";
import { importStore } from "./importStore";
import { importMedia } from "./importer";
import type { IngestDeps } from "./ingest";

const file = (name: string, type: string) => new File([new Uint8Array(8)], name, { type });
let n = 0;
const fakeDeps = (over: Partial<IngestDeps> = {}): IngestDeps => ({
  probe: async (_f, hint) => ({ kind: hint, durationSec: 2, width: 100, height: 100, mime: "" }),
  poster: async () => ({ blob: null, notes: [] }),
  peaks: async () => null,
  put: async () => undefined,
  remove: async () => undefined,
  newId: (p) => `${p}-${++n}`,
  fps: 60,
  ...over,
});

beforeEach(() => importStore.setState({ running: false, items: [], summary: null }));

describe("importMedia", () => {
  it("adds the whole batch to the project as ONE undo step", async () => {
    const store = createProjectStore(createSampleProject(1));
    const before = store.getProject().assets.length;
    const r = await importMedia(
      [file("a.mp4", "video/mp4"), file("b.png", "image/png"), file("c.mp3", "audio/mpeg")],
      store,
      fakeDeps(),
    );
    expect(r.assets).toHaveLength(3);
    expect(store.getProject().assets).toHaveLength(before + 3);
    expect(store.getState().past).toHaveLength(1);
    store.undo();
    expect(store.getProject().assets).toHaveLength(before);
  });

  it("publishes progress and a summary for the toast", async () => {
    const store = createProjectStore(createSampleProject(1));
    const states: boolean[] = [];
    const off = importStore.subscribe(() => states.push(importStore.getState().running));
    await importMedia(
      [file("a.mp4", "video/mp4"), file("bad.txt", "text/plain")],
      store,
      fakeDeps(),
    );
    off();
    expect(states[0]).toBe(true);
    expect(importStore.getState().running).toBe(false);
    const s = importStore.getState().summary!;
    expect(s.added).toBe(1);
    expect(s.failed).toEqual([{ name: "bad.txt", message: "Not a video, audio or photo file." }]);
  });

  it("changes nothing in the project when every file fails", async () => {
    const store = createProjectStore(createSampleProject(1));
    const p = store.getProject();
    await importMedia([file("x.txt", "text/plain")], store, fakeDeps());
    expect(store.getProject()).toBe(p);
    expect(store.getState().past).toHaveLength(0);
    expect(importStore.getState().summary!.added).toBe(0);
  });

  it("queues overlapping imports instead of running them at once", async () => {
    const store = createProjectStore(createSampleProject(1));
    let active = 0;
    let max = 0;
    const slow = fakeDeps({
      probe: async (_f, hint) => {
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return { kind: hint, durationSec: 1, mime: "" };
      },
    });
    await Promise.all([
      importMedia([file("a.mp4", "video/mp4")], store, slow),
      importMedia([file("b.mp4", "video/mp4")], store, slow),
    ]);
    expect(max).toBe(1);
    expect(store.getState().past).toHaveLength(2);
  });

  it("a failure in one import doesn't poison the queue", async () => {
    const store = createProjectStore(createSampleProject(1));
    const boom = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = fakeDeps({
      put: async () => {
        throw new Error("boom");
      },
    });
    await importMedia([file("a.mp4", "video/mp4")], store, bad);
    const ok = await importMedia([file("b.mp4", "video/mp4")], store, fakeDeps());
    expect(ok.assets).toHaveLength(1);
    boom.mockRestore();
  });
});
