import { describe, expect, it, vi } from "vitest";
import { createSampleProject, SAMPLE_PROJECT_ID } from "../model/sample";
import type { Project } from "../model/types";
import { StorageUnavailableError } from "../storage/idb";
import type { SaveStatus } from "../storage/autosave";
import { createStore } from "../store/createStore";
import { createProjectStore } from "../store/projectStore";
import { bootstrapProject, type BootIO } from "./bootstrap";

const status = () => createStore<SaveStatus>({ state: "idle", savedAt: null, error: null });

function deps(over: Partial<BootIO> = {}, saved: Project[] = []) {
  const store = createProjectStore(createSampleProject(1));
  const io: BootIO = {
    getLastProjectId: vi.fn(async () => undefined as string | undefined),
    loadRawProject: vi.fn(async () => undefined as unknown),
    saveProject: vi.fn(async (p: Project) => void saved.push(p)),
    setLastProjectId: vi.fn(async () => undefined),
    quarantineRaw: vi.fn(async (id: string) => `quarantine:${id}:1`),
    ...over,
  };
  return { store, io, st: status(), saved, makeSample: () => createSampleProject(555) };
}

describe("bootstrapProject", () => {
  it("first run: creates the sample project and saves it", async () => {
    const d = deps();
    const r = await bootstrapProject({
      store: d.store,
      io: d.io,
      status: d.st,
      makeSample: d.makeSample,
    });
    expect(r.source).toBe("created");
    expect(d.io.saveProject).toHaveBeenCalledTimes(1);
    expect(d.io.setLastProjectId).toHaveBeenCalledWith(SAMPLE_PROJECT_ID);
    expect(d.st.getState()).toMatchObject({ state: "saved", savedAt: 555 });
  });
  it("later runs: loads the saved project (with the user's edits) and reports its real save time", async () => {
    const saved = { ...createSampleProject(1), name: "My edit", updatedAt: 4242 };
    const d = deps({
      getLastProjectId: vi.fn(async () => saved.id),
      loadRawProject: vi.fn(async () => JSON.parse(JSON.stringify(saved))),
    });
    const r = await bootstrapProject({ store: d.store, io: d.io, status: d.st });
    expect(r.source).toBe("loaded");
    expect(d.store.getProject().name).toBe("My edit");
    expect(d.st.getState()).toMatchObject({ state: "saved", savedAt: 4242 });
    expect(d.io.saveProject).not.toHaveBeenCalled(); // loading must not rewrite the project
  });
  it("loading clears undo history (you can't undo past a reload)", async () => {
    const d = deps({
      getLastProjectId: vi.fn(async () => "sample-project"),
      loadRawProject: vi.fn(async () => createSampleProject(1)),
    });
    await bootstrapProject({ store: d.store, io: d.io, status: d.st });
    expect(d.store.getState().past).toHaveLength(0);
  });
  it("a corrupt saved project is quarantined — never deleted — and replaced by a fresh sample", async () => {
    const corrupt = { schemaVersion: 1, id: "sample-project", clips: "garbage" };
    const d = deps({
      getLastProjectId: vi.fn(async () => "sample-project"),
      loadRawProject: vi.fn(async () => corrupt),
    });
    const r = await bootstrapProject({
      store: d.store,
      io: d.io,
      status: d.st,
      makeSample: d.makeSample,
    });
    expect(r.source).toBe("recovered");
    expect(d.io.quarantineRaw).toHaveBeenCalledWith(
      "sample-project",
      corrupt,
      expect.stringContaining("invalid"),
    );
    expect(r.warning).toMatch(/quarantine:sample-project/);
    // quarantine must happen BEFORE the overwrite
    const q = vi.mocked(d.io.quarantineRaw).mock.invocationCallOrder[0];
    const s = vi.mocked(d.io.saveProject).mock.invocationCallOrder[0];
    expect(q).toBeLessThan(s);
  });
  it("a project from a NEWER app is also set aside, not mangled", async () => {
    const d = deps({
      getLastProjectId: vi.fn(async () => "sample-project"),
      loadRawProject: vi.fn(async () => ({ ...createSampleProject(1), schemaVersion: 99 })),
    });
    const r = await bootstrapProject({ store: d.store, io: d.io, status: d.st });
    expect(r.source).toBe("recovered");
    expect(r.warning).toMatch(/newer FreeCut/);
  });
  it("storage unavailable: still opens (in memory) and says so", async () => {
    const d = deps({
      getLastProjectId: vi.fn(async () => {
        throw new StorageUnavailableError();
      }),
    });
    const r = await bootstrapProject({ store: d.store, io: d.io, status: d.st });
    expect(r.source).toBe("unavailable");
    expect(r.warning).toMatch(/will not be saved/);
    expect(d.st.getState().state).toBe("unavailable");
    expect(d.store.getProject().id).toBe(SAMPLE_PROJECT_ID);
  });
  it("an unexpected storage error also degrades gracefully", async () => {
    const d = deps({
      loadRawProject: vi.fn(async () => {
        throw new Error("disk on fire");
      }),
    });
    const r = await bootstrapProject({ store: d.store, io: d.io, status: d.st });
    expect(r.source).toBe("unavailable");
    expect(r.warning).toMatch(/disk on fire/);
  });
});
