// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbCache } from "../storage/idb";
import { putMedia } from "./mediaStore";
import { refreshMedia, useMediaUrl } from "./useMediaUrl";

let created = 0;
beforeEach(() => {
  resetDbCache();
  (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  created = 0;
  URL.createObjectURL = vi.fn(() => `blob:fake-${++created}`);
  URL.revokeObjectURL = vi.fn();
});

describe("useMediaUrl", () => {
  it("returns null for no id", () => {
    const { result } = renderHook(() => useMediaUrl(null));
    expect(result.current).toBeNull();
  });
  it("loads a stored blob into an object URL", async () => {
    await putMedia("m1", new Blob(["x"], { type: "image/jpeg" }));
    const { result } = renderHook(() => useMediaUrl("m1"));
    await waitFor(() => expect(result.current).toMatch(/^blob:fake-/));
  });
  it("shares one object URL between components using the same media", async () => {
    await putMedia("shared", new Blob(["x"]));
    const a = renderHook(() => useMediaUrl("shared"));
    const b = renderHook(() => useMediaUrl("shared"));
    await waitFor(() => expect(a.result.current).not.toBeNull());
    await waitFor(() => expect(b.result.current).toBe(a.result.current));
    expect(created).toBe(1);
  });
  it("stays null (and doesn't throw) for media that doesn't exist, and can retry later", async () => {
    const { result, unmount } = renderHook(() => useMediaUrl("late"));
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current).toBeNull();
    unmount();
    await putMedia("late", new Blob(["now here"]));
    const again = renderHook(() => useMediaUrl("late"));
    await waitFor(() => expect(again.result.current).not.toBeNull());
  });
  it("doesn't crash when storage is unavailable", async () => {
    resetDbCache();
    (globalThis as { indexedDB?: unknown }).indexedDB = undefined;
    const { result } = renderHook(() => useMediaUrl("nope"));
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current).toBeNull();
  });
  it("refreshMedia makes components pick up media that was written later (a retried thumbnail)", async () => {
    const { result } = renderHook(() => useMediaUrl("m1:poster"));
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current).toBeNull(); // not there yet
    await putMedia("m1:poster", new Blob(["jpg"], { type: "image/jpeg" }));
    act(() => refreshMedia("m1:poster"));
    await waitFor(() => expect(result.current).toMatch(/^blob:fake-/));
  });
  it("refreshMedia replaces a stale URL with a new one", async () => {
    await putMedia("m2", new Blob(["old"]));
    const { result } = renderHook(() => useMediaUrl("m2"));
    await waitFor(() => expect(result.current).not.toBeNull());
    const first = result.current;
    await putMedia("m2", new Blob(["new"]));
    act(() => refreshMedia("m2"));
    // the old picture stays up while the new one loads (never flashes to null)…
    expect(result.current).toBe(first);
    // …and then it is swapped for the new one
    await waitFor(() => {
      expect(result.current).not.toBeNull();
      expect(result.current).not.toBe(first);
    });
    expect(result.current).toMatch(/^blob:fake-/);
  });
});
