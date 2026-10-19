import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleProject } from "../model/sample";
import type { Project } from "../model/types";
import { setClipOpacity, setTrackMuted } from "../store/commands";
import { createStore } from "../store/createStore";
import { createProjectStore } from "../store/projectStore";
import { startAutosave, type SaveStatus } from "./autosave";
import { StorageUnavailableError } from "./idb";

const newStatus = () => createStore<SaveStatus>({ state: "idle", savedAt: null, error: null });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(saveImpl?: (p: Project) => Promise<void>) {
  const store = createProjectStore(createSampleProject(1));
  const saved: Project[] = [];
  const save = vi.fn(saveImpl ?? (async (p: Project) => void saved.push(p)));
  const status = newStatus();
  const auto = startAutosave({
    store,
    save,
    status,
    debounceMs: 500,
    retryMs: 1000,
    maxRetryMs: 4000,
    now: () => 777,
  });
  return { store, save, saved, status, auto };
}

describe("autosave", () => {
  it("does nothing until something changes", async () => {
    const { save } = setup();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });
  it("debounces a burst of edits into ONE save of the latest project", async () => {
    const { store, save, saved, status } = setup();
    for (const v of [90, 80, 70]) {
      store.execute(setClipOpacity("clip-main", v));
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(saved[0].clips[0].opacity).toBe(70);
    expect(status.getState()).toEqual({ state: "saved", savedAt: 777, error: null });
  });
  it("shows 'saving' while a write is in flight", async () => {
    let release!: () => void;
    const { store, status } = setup(() => new Promise<void>((r) => (release = r)));
    store.execute(setTrackMuted("track-main", true));
    await vi.advanceTimersByTimeAsync(600);
    expect(status.getState().state).toBe("saving");
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(status.getState().state).toBe("saved");
  });
  it("never overlaps writes, and never loses an edit made during a write", async () => {
    const releases: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    const saved: Project[] = [];
    const { store } = setup(async (p) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((r) => releases.push(r));
      saved.push(p);
      active--;
    });
    store.execute(setTrackMuted("track-main", true));
    await vi.advanceTimersByTimeAsync(600); // save #1 starts, hangs
    store.execute(setTrackMuted("track-audio-1", true)); // edit during the write
    await vi.advanceTimersByTimeAsync(600);
    expect(releases).toHaveLength(1); // #2 must wait
    releases[0]();
    await vi.advanceTimersByTimeAsync(600);
    expect(releases).toHaveLength(2);
    releases[1]();
    await vi.advanceTimersByTimeAsync(0);
    expect(maxActive).toBe(1);
    expect(saved.at(-1)!.tracks.every((t) => t.id === "track-overlay-1" || t.muted)).toBe(true);
  });
  it("retries transient failures with backoff, then recovers", async () => {
    let fails = 2;
    const { store, save, status } = setup(async () => {
      if (fails-- > 0) throw new Error("disk hiccup");
    });
    store.execute(setTrackMuted("track-main", true));
    await vi.advanceTimersByTimeAsync(600);
    expect(status.getState()).toMatchObject({ state: "error", error: "disk hiccup" });
    await vi.advanceTimersByTimeAsync(1000); // retry 1 (fails)
    expect(save).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000); // retry 2 after doubled delay (succeeds)
    expect(save).toHaveBeenCalledTimes(3);
    expect(status.getState().state).toBe("saved");
  });
  it("reports 'unavailable' and stops hammering when storage can't work at all", async () => {
    const { store, save, status } = setup(async () => {
      throw new StorageUnavailableError();
    });
    store.execute(setTrackMuted("track-main", true));
    await vi.advanceTimersByTimeAsync(600);
    expect(status.getState().state).toBe("unavailable");
    store.execute(setTrackMuted("track-audio-1", true));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("saves undo and redo too", async () => {
    const { store, saved } = setup();
    store.execute(setTrackMuted("track-main", true));
    await vi.advanceTimersByTimeAsync(600);
    store.undo();
    await vi.advanceTimersByTimeAsync(600);
    expect(saved).toHaveLength(2);
    expect(saved[1].tracks[1].muted).toBe(false);
  });
  it("flush() saves immediately and waits", async () => {
    const { store, save, auto } = setup();
    store.execute(setTrackMuted("track-main", true));
    await auto.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("stop() cancels pending work", async () => {
    const { store, save, auto } = setup();
    store.execute(setTrackMuted("track-main", true));
    auto.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });
});
