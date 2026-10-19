import { describe, expect, it } from "vitest";
import { createSampleProject } from "../model/sample";
import type { Project } from "../model/types";
import { setClipOpacity, setTrackMuted } from "./commands";
import { createProjectStore, type Command } from "./projectStore";

function setup(opts: { coalesceMs?: number; historyLimit?: number } = {}) {
  let t = 1000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const store = createProjectStore(createSampleProject(1), { now: clock.now, ...opts });
  const clip = (s = store) => s.getProject().clips[0];
  return { store, clock, clip };
}

describe("project store — undo / redo", () => {
  it("executes a command, then undoes and redoes it", () => {
    const { store } = setup();
    expect(store.getProject().tracks[1].muted).toBe(false);
    expect(store.execute(setTrackMuted("track-main", true))).toBe(true);
    expect(store.getProject().tracks[1].muted).toBe(true);
    expect(store.undo()).toBe(true);
    expect(store.getProject().tracks[1].muted).toBe(false);
    expect(store.redo()).toBe(true);
    expect(store.getProject().tracks[1].muted).toBe(true);
  });
  it("records nothing for a no-op command", () => {
    const { store } = setup();
    expect(store.execute(setTrackMuted("track-main", false))).toBe(false);
    expect(store.getState().past).toHaveLength(0);
    expect(store.undo()).toBe(false);
  });
  it("new edits clear the redo stack", () => {
    const { store } = setup();
    store.execute(setTrackMuted("track-main", true));
    store.undo();
    expect(store.getState().future).toHaveLength(1);
    store.execute(setTrackMuted("track-audio-1", true));
    expect(store.getState().future).toHaveLength(0);
    expect(store.redo()).toBe(false);
  });
  it("undo/redo are safe when empty", () => {
    const { store } = setup();
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(false);
  });
  it("shares unchanged parts between snapshots (cheap history)", () => {
    const { store } = setup();
    const before = store.getProject();
    store.execute(setTrackMuted("track-main", true));
    const after = store.getProject();
    expect(after.clips).toBe(before.clips);
    expect(after.assets).toBe(before.assets);
    expect(after.tracks).not.toBe(before.tracks);
  });
  it("stamps updatedAt on edits, undo and redo", () => {
    const { store, clock } = setup();
    clock.advance(500);
    store.execute(setTrackMuted("track-main", true));
    expect(store.getProject().updatedAt).toBe(1500);
    clock.advance(500);
    store.undo();
    expect(store.getProject().updatedAt).toBe(2000);
  });
  it("caps history at the limit, dropping the oldest", () => {
    const { store } = setup({ historyLimit: 3 });
    for (let i = 0; i < 5; i++) store.execute(setTrackMuted("track-main", i % 2 === 0));
    expect(store.getState().past).toHaveLength(3);
  });
  it("replaceProject swaps the project and clears history", () => {
    const { store } = setup();
    store.execute(setTrackMuted("track-main", true));
    const other: Project = { ...createSampleProject(9), id: "other" };
    store.replaceProject(other);
    expect(store.getProject().id).toBe("other");
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().future).toHaveLength(0);
  });
  it("notifies subscribers and bumps revision", () => {
    const { store } = setup();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    const r0 = store.getState().revision;
    store.execute(setTrackMuted("track-main", true));
    store.undo();
    off();
    store.redo();
    expect(calls).toBe(2);
    expect(store.getState().revision).toBe(r0 + 3);
  });
});

describe("project store — coalescing (slider drags)", () => {
  it("merges quick edits with the same key into ONE undo step", () => {
    const { store, clock, clip } = setup();
    for (const v of [90, 80, 70, 60]) {
      store.execute(setClipOpacity("clip-main", v));
      clock.advance(50);
    }
    expect(store.getState().past).toHaveLength(1);
    expect(clip().opacity).toBe(60);
    store.undo();
    expect(clip().opacity).toBe(100); // back to the value before the whole drag
    store.redo();
    expect(clip().opacity).toBe(60);
  });
  it("does not merge after a pause", () => {
    const { store, clock } = setup({ coalesceMs: 600 });
    store.execute(setClipOpacity("clip-main", 90));
    clock.advance(700);
    store.execute(setClipOpacity("clip-main", 80));
    expect(store.getState().past).toHaveLength(2);
  });
  it("does not merge across different keys or different clips", () => {
    const { store } = setup();
    store.execute(setClipOpacity("clip-main", 90));
    store.execute(setTrackMuted("track-main", true));
    store.execute(setClipOpacity("clip-main", 80));
    expect(store.getState().past).toHaveLength(3);
    store.execute(setClipOpacity("clip-audio", 50));
    expect(store.getState().past).toHaveLength(4);
  });
  it("after an undo, a quick edit must NOT merge into the older entry that is now on top (barrier)", () => {
    const { store, clock, clip } = setup({ coalesceMs: 5000 });
    store.execute(setClipOpacity("clip-main", 90)); // A  (opacity)
    clock.advance(100);
    store.execute(setTrackMuted("track-main", true)); // B  (different key, so its own entry)
    store.undo(); // A is now the top of history, and still "recent"
    clock.advance(100);
    store.execute(setClipOpacity("clip-main", 70)); // C — same key as A and well within coalesceMs
    expect(store.getState().past).toHaveLength(2); // A and C stay separate undo steps
    store.undo();
    expect(clip().opacity).toBe(90); // undoing C must return to A's value, not skip past A
  });
  it("never merges the first edit after an undo into the entry before it", () => {
    const { store, clock, clip } = setup();
    store.execute(setClipOpacity("clip-main", 90));
    clock.advance(10);
    store.execute(setClipOpacity("clip-main", 80)); // coalesced → one entry (before = 100)
    store.undo();
    expect(clip().opacity).toBe(100);
    clock.advance(10);
    store.execute(setClipOpacity("clip-main", 70)); // must be its own, fresh entry
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().past[0].before.clips[0].opacity).toBe(100);
    store.undo();
    expect(clip().opacity).toBe(100);
  });
});

describe("project store — transactions", () => {
  it("groups several commands into one undo step", () => {
    const { store, clip } = setup();
    store.transaction("Style clip", () => {
      store.execute(setClipOpacity("clip-main", 40));
      store.execute(setTrackMuted("track-main", true));
      store.execute(setTrackMuted("track-audio-1", true));
    });
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().past[0].label).toBe("Style clip");
    store.undo();
    expect(clip().opacity).toBe(100);
    expect(store.getProject().tracks.every((t) => !t.muted)).toBe(true);
  });
  it("rolls everything back if the callback throws", () => {
    const { store, clip } = setup();
    expect(() =>
      store.transaction("Boom", () => {
        store.execute(setClipOpacity("clip-main", 10));
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(clip().opacity).toBe(100);
    expect(store.getState().past).toHaveLength(0);
  });
  it("records nothing when the transaction changed nothing", () => {
    const { store } = setup();
    store.transaction("noop", () => store.execute(setTrackMuted("track-main", false)));
    expect(store.getState().past).toHaveLength(0);
  });
  it("nested transactions collapse into the outer one", () => {
    const { store } = setup();
    store.transaction("outer", () => {
      store.execute(setTrackMuted("track-main", true));
      store.transaction("inner", () => store.execute(setTrackMuted("track-audio-1", true)));
    });
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().past[0].label).toBe("outer");
  });
  it("refuses undo while a transaction is open", () => {
    const { store } = setup();
    store.execute(setTrackMuted("track-main", true));
    store.transaction("t", () => {
      expect(store.undo()).toBe(false);
    });
  });
});

describe("Command contract", () => {
  it("a custom command works through the same pipeline", () => {
    const { store } = setup();
    const rename: Command = { type: "x", label: "Rename", apply: (p) => ({ ...p, name: "New" }) };
    store.execute(rename);
    expect(store.getProject().name).toBe("New");
    store.undo();
    expect(store.getProject().name).toBe("This is a title");
  });
});
