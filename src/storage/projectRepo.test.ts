import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { ProjectLoadError } from "../model/migrations";
import { createEmptyProject, createSampleProject } from "../model/sample";
import { resetDbCache, StorageUnavailableError, openDb, idbGet } from "./idb";
import {
  deleteProject,
  getLastProjectId,
  listProjects,
  loadProject,
  loadRawProject,
  quarantineRaw,
  saveProject,
  setLastProjectId,
} from "./projectRepo";

beforeEach(() => {
  resetDbCache();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe("project repository (real IndexedDB semantics via fake-indexeddb)", () => {
  it("saves and loads a project, intact", async () => {
    const p = createSampleProject(123);
    await saveProject(p);
    expect(await loadProject(p.id)).toEqual(p);
  });
  it("returns undefined for a missing project", async () => {
    expect(await loadProject("nope")).toBeUndefined();
  });
  it("overwrites on re-save (same id)", async () => {
    const p = createSampleProject(1);
    await saveProject(p);
    await saveProject({ ...p, name: "Renamed", updatedAt: 2 });
    expect((await loadProject(p.id))!.name).toBe("Renamed");
    expect(await listProjects()).toHaveLength(1);
  });
  it("lists newest first with durations", async () => {
    await saveProject({ ...createSampleProject(1), id: "a", name: "A", updatedAt: 10 });
    await saveProject({ ...createEmptyProject("b", "B", 1), updatedAt: 30 });
    await saveProject({ ...createSampleProject(1), id: "c", name: "C", updatedAt: 20 });
    const list = await listProjects();
    expect(list.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(list[0].durationFrames).toBe(0);
    expect(list[1].durationFrames).toBe(1678);
  });
  it("deletes", async () => {
    const p = createSampleProject(1);
    await saveProject(p);
    await deleteProject(p.id);
    expect(await loadProject(p.id)).toBeUndefined();
  });
  it("remembers the last-opened project id", async () => {
    expect(await getLastProjectId()).toBeUndefined();
    await setLastProjectId("abc");
    expect(await getLastProjectId()).toBe("abc");
  });
  it("migrates / validates on load and rejects corrupt records", async () => {
    const p = createSampleProject(1);
    const bad = { ...p, clips: [{ id: "x" }] };
    await (await import("./idb")).idbPut("projects", bad);
    await expect(loadProject(p.id)).rejects.toBeInstanceOf(ProjectLoadError);
    expect(await loadRawProject(p.id)).toEqual(bad); // the raw bytes are still retrievable
  });
  it("quarantines unreadable data under meta without touching projects", async () => {
    const key = await quarantineRaw("p1", { junk: true }, "invalid: test", 42);
    expect(key).toBe("quarantine:p1:42");
    const row = await idbGet<{ value: { raw: unknown; reason: string } }>("meta", key);
    expect(row!.value.raw).toEqual({ junk: true });
    expect(await listProjects()).toEqual([]);
  });
  it("is durable across a reopened connection", async () => {
    await saveProject(createSampleProject(5));
    resetDbCache(); // simulate a page reload: new connection, same underlying DB
    expect((await loadProject("sample-project"))!.createdAt).toBe(5);
  });
});

describe("storage unavailable", () => {
  it("reports StorageUnavailableError when there is no IndexedDB", async () => {
    resetDbCache();
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    await expect(openDb()).rejects.toBeInstanceOf(StorageUnavailableError);
    await expect(saveProject(createSampleProject(1))).rejects.toBeInstanceOf(
      StorageUnavailableError,
    );
  });
  it("reports it when open() throws synchronously (Firefox private mode)", async () => {
    resetDbCache();
    (globalThis as { indexedDB: unknown }).indexedDB = {
      open() {
        throw new Error("The operation is insecure.");
      },
    };
    await expect(openDb()).rejects.toBeInstanceOf(StorageUnavailableError);
  });
  it("recovers once storage works again (failed opens aren't cached)", async () => {
    resetDbCache();
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    await expect(openDb()).rejects.toBeInstanceOf(StorageUnavailableError);
    (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
    await expect(saveProject(createSampleProject(1))).resolves.toBeUndefined();
  });
});
