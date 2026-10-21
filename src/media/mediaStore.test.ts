import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createSampleProject } from "../model/sample";
import type { Asset, Project } from "../model/types";
import { idbPut, resetDbCache } from "../storage/idb";
import { quarantineRaw, saveProject } from "../storage/projectRepo";
import {
  deleteMedia,
  getMedia,
  isQuotaError,
  listMediaIds,
  mediaKeysOfAsset,
  posterIdOf,
  putMedia,
  rawMediaKeys,
  referencedMediaKeys,
  SWEEP_GRACE_MS,
  sweepOrphanMedia,
  totalMediaBytes,
} from "./mediaStore";

beforeEach(() => {
  resetDbCache();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

const stored = (id: string, mediaId: string): Asset => ({
  id,
  kind: "video",
  name: id,
  durationFrames: 60,
  source: { type: "stored", mediaId },
});
const withAssets = (assets: Asset[], id = "sample-project"): Project => ({
  ...createSampleProject(1),
  id,
  assets: [...createSampleProject(1).assets, ...assets],
});
const blob = (s: string, type = "video/mp4") => new Blob([s], { type });
const OLD = Date.now() - 2 * SWEEP_GRACE_MS;

describe("media store", () => {
  it("stores, reads back, lists and deletes blobs", async () => {
    await putMedia("m1", blob("hello", "audio/wav"));
    await putMedia("m2", blob("world!"));
    expect(await (await getMedia("m1"))!.text()).toBe("hello");
    expect((await getMedia("m1"))!.type).toBe("audio/wav");
    expect((await listMediaIds()).sort()).toEqual(["m1", "m2"]);
    expect(await totalMediaBytes()).toBe(11);
    await deleteMedia("m1");
    expect(await getMedia("m1")).toBeUndefined();
    expect(await listMediaIds()).toEqual(["m2"]);
  });

  it("survives a reconnect (durable)", async () => {
    await putMedia("m1", blob("persist"));
    resetDbCache();
    expect(await (await getMedia("m1"))!.text()).toBe("persist");
  });
});

describe("database upgrade v1 → v2 (a real user's phone already has a v1 database)", () => {
  it("keeps existing projects and the last-project pointer, and adds the media store", async () => {
    // Build a genuine v1 database exactly as Phase 0 did.
    const v1 = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("freecut", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("projects", { keyPath: "id" });
        req.result.createObjectStore("meta", { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const old = { ...createSampleProject(5), schemaVersion: 1, name: "Edited on iPhone" };
    await new Promise<void>((resolve) => {
      const tx = v1.transaction(["projects", "meta"], "readwrite");
      tx.objectStore("projects").put(old);
      tx.objectStore("meta").put({ key: "lastProjectId", value: old.id });
      tx.oncomplete = () => resolve();
    });
    v1.close();

    // Now the new code opens it.
    const { loadProject, getLastProjectId } = await import("../storage/projectRepo");
    const p = await loadProject(old.id);
    expect(p!.name).toBe("Edited on iPhone");
    expect(p!.schemaVersion).toBe(2); // migrated in memory
    expect(await getLastProjectId()).toBe(old.id);
    await putMedia("m1", blob("x")); // the new store exists
    expect(await listMediaIds()).toEqual(["m1"]);
  });
});

describe("keys", () => {
  it("an imported asset needs its file and its poster; demo assets need nothing", () => {
    expect(mediaKeysOfAsset(stored("a", "m1"))).toEqual(["m1", "m1:poster"]);
    expect(mediaKeysOfAsset(createSampleProject(1).assets[0])).toEqual([]);
    expect(posterIdOf("m9")).toBe("m9:poster");
    expect([...referencedMediaKeys(withAssets([stored("a", "m1")]))].sort()).toEqual([
      "m1",
      "m1:poster",
    ]);
  });
  it("rawMediaKeys is tolerant of junk", () => {
    expect(rawMediaKeys(null)).toEqual([]);
    expect(rawMediaKeys("x")).toEqual([]);
    expect(rawMediaKeys({ assets: "no" })).toEqual([]);
    expect(
      rawMediaKeys({ assets: [null, 1, {}, { source: null }, { source: { type: "stored" } }] }),
    ).toEqual([]);
    expect(
      rawMediaKeys({
        schemaVersion: 99,
        clips: "garbage",
        assets: [{ source: { type: "stored", mediaId: "z" } }],
      }),
    ).toEqual(["z", "z:poster"]);
  });
  it("recognises storage-full errors", () => {
    expect(isQuotaError(new DOMException("full", "QuotaExceededError"))).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error("other"))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe("sweepOrphanMedia — must never delete anything still needed", () => {
  it("deletes old unreferenced media, keeps referenced media and its poster", async () => {
    await saveProject(withAssets([stored("a", "keep")]));
    await putMedia("keep", blob("1"), OLD);
    await putMedia("keep:poster", blob("2"), OLD);
    await putMedia("orphan", blob("3"), OLD);
    await putMedia("orphan:poster", blob("4"), OLD);
    expect(await sweepOrphanMedia()).toBe(2);
    expect((await listMediaIds()).sort()).toEqual(["keep", "keep:poster"]);
  });
  it("never deletes a fresh record (an import stores the blob before the project references it)", async () => {
    await putMedia("importing-now", blob("1"));
    expect(await sweepOrphanMedia()).toBe(0);
    expect(await listMediaIds()).toEqual(["importing-now"]);
  });
  it("keeps media referenced by a CORRUPT / unknown-schema project we can't open", async () => {
    await idbPut("projects", {
      id: "weird",
      schemaVersion: 99,
      clips: "garbage",
      assets: [{ source: { type: "stored", mediaId: "theirs" } }],
    });
    await putMedia("theirs", blob("1"), OLD);
    await putMedia("unrelated", blob("2"), OLD);
    await sweepOrphanMedia();
    expect(await listMediaIds()).toEqual(["theirs"]);
  });
  it("keeps media referenced by a QUARANTINED project (it must stay recoverable)", async () => {
    await quarantineRaw(
      "p",
      { assets: [{ source: { type: "stored", mediaId: "recover-me" } }] },
      "invalid",
    );
    await putMedia("recover-me", blob("1"), OLD);
    await sweepOrphanMedia();
    expect(await listMediaIds()).toEqual(["recover-me"]);
  });
  it("considers every project, not just the current one", async () => {
    await saveProject(withAssets([stored("a", "m-a")], "p1"));
    await saveProject(withAssets([stored("b", "m-b")], "p2"));
    await putMedia("m-a", blob("1"), OLD);
    await putMedia("m-b", blob("2"), OLD);
    expect(await sweepOrphanMedia()).toBe(0);
  });
  it("is a no-op on an empty store", async () => {
    expect(await sweepOrphanMedia()).toBe(0);
  });
});
