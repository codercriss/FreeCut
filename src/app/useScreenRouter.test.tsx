// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEditorState, screenForPopState, useScreenRouter } from "./useScreenRouter";

const pop = (state: unknown) =>
  act(() => void window.dispatchEvent(new PopStateEvent("popstate", { state })));

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "");
});
afterEach(() => vi.useRealTimers());

describe("screenForPopState", () => {
  it("maps history entries to screens", () => {
    expect(screenForPopState({ freecut: "editor" })).toBe("editor");
    expect(screenForPopState(null)).toBe("home");
    expect(screenForPopState({ other: 1 })).toBe("home");
    expect(screenForPopState("editor")).toBe("home");
    expect(isEditorState(undefined)).toBe(false);
  });
});

describe("useScreenRouter", () => {
  it("opens the editor with its own history entry", () => {
    const { result } = renderHook(() => useScreenRouter());
    expect(result.current.screen).toBe("home");
    act(() => result.current.openEditor({ sheet: "media" }));
    expect(result.current.screen).toBe("editor");
    expect(result.current.launch).toEqual({ sheet: "media" });
    expect(isEditorState(window.history.state)).toBe(true);
  });

  it("Back returns Home", () => {
    const { result } = renderHook(() => useScreenRouter());
    act(() => result.current.openEditor());
    pop(null);
    expect(result.current.screen).toBe("home");
  });

  it("REGRESSION (Handover S1): Forward returns to the editor instead of staying on Home", () => {
    const entered = vi.fn();
    const { result } = renderHook(() => useScreenRouter(entered));
    act(() => result.current.openEditor());
    expect(entered).toHaveBeenCalledTimes(1);
    pop(null); // Back
    expect(result.current.screen).toBe("home");
    pop({ freecut: "editor" }); // Forward
    expect(result.current.screen).toBe("editor");
    expect(entered).toHaveBeenCalledTimes(2); // selection etc. is re-initialised on every entry
  });

  it("keeps both layers mounted for the transition, then drops the outgoing one", () => {
    const { result } = renderHook(() => useScreenRouter());
    act(() => result.current.openEditor());
    expect(result.current.leaving).toBe("home");
    act(() => void vi.advanceTimersByTime(600));
    expect(result.current.leaving).toBeNull();
  });

  it("goHome() uses history.back() when on the editor entry (keeps history tidy)", () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    const { result } = renderHook(() => useScreenRouter());
    act(() => result.current.openEditor());
    act(() => result.current.nav.goHome());
    expect(back).toHaveBeenCalledTimes(1);
    back.mockRestore();
  });

  it("goHome() navigates directly when there is no editor history entry", () => {
    const { result } = renderHook(() => useScreenRouter());
    act(() => result.current.openEditor());
    window.history.replaceState(null, ""); // e.g. history was reset
    act(() => result.current.nav.goHome());
    expect(result.current.screen).toBe("home");
  });

  it("a reload on an editor history entry is normalised so Back/Forward stay in sync", () => {
    window.history.replaceState({ freecut: "editor" }, "");
    renderHook(() => useScreenRouter());
    expect(window.history.state).toBeNull();
  });

  it("ignores a pop to the screen it is already on", () => {
    const entered = vi.fn();
    const { result } = renderHook(() => useScreenRouter(entered));
    pop({ freecut: "editor" });
    expect(result.current.screen).toBe("editor");
    pop({ freecut: "editor" });
    expect(entered).toHaveBeenCalledTimes(1);
  });
});
