// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// The store is a singleton created at import time from localStorage, so each case re-imports it
// fresh with the storage seeded the way that case needs.
async function fresh(seed?: string) {
  vi.resetModules();
  localStorage.clear();
  if (seed !== undefined) localStorage.setItem("freecut.prefs", seed);
  return await import("./prefsStore");
}

describe("prefsStore (appearance + timeline toggles)", () => {
  beforeEach(() => localStorage.clear());

  it("starts with the prototype's toggles and theme auto", async () => {
    const { prefsStore, DEFAULT_PREFS } = await fresh();
    expect(prefsStore.getState()).toEqual(DEFAULT_PREFS);
    expect(prefsStore.getState().theme).toBe("auto");
  });

  it("setTheme saves the pick and persists it to localStorage", async () => {
    const { prefsStore, setTheme } = await fresh();
    setTheme("light");
    expect(prefsStore.getState().theme).toBe("light");
    expect(JSON.parse(localStorage.getItem("freecut.prefs") ?? "{}").theme).toBe("light");
  });

  it("loads a saved theme and keeps older saves valid (theme missing → auto)", async () => {
    const { prefsStore } = await fresh(JSON.stringify({ snap: false, theme: "dark", extra: true }));
    expect(prefsStore.getState().theme).toBe("dark");
    expect(prefsStore.getState().snap).toBe(false);
    expect((prefsStore.getState() as unknown as Record<string, unknown>).extra).toBeUndefined();
    const pre = await fresh(JSON.stringify({ snap: true }));
    expect(pre.prefsStore.getState().theme).toBe("auto");
  });

  it("falls back to defaults on corrupt storage or an unknown theme value", async () => {
    const corrupt = await fresh("{ not json");
    expect(corrupt.prefsStore.getState().theme).toBe("auto");
    const junk = await fresh(JSON.stringify({ theme: "solarized" }));
    expect(junk.prefsStore.getState().theme).toBe("auto");
    const junkTypes = await fresh(JSON.stringify({ theme: null, magnet: "yes" }));
    expect(junkTypes.prefsStore.getState().theme).toBe("auto");
    expect(junkTypes.prefsStore.getState().magnet).toBe(false);
  });
});
