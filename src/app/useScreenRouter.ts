import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LaunchOptions, Nav } from "./NavContext";

export type Screen = "home" | "editor";

/**
 * Both screens stay mounted for this long while one animates out and the other in.
 * Keep it a little longer than the longest animation in styles/transitions.css.
 */
export const TRANSITION_MS = 480;

const EDITOR_STATE = { freecut: "editor" } as const;

export const isEditorState = (state: unknown): boolean =>
  typeof state === "object" &&
  state !== null &&
  (state as { freecut?: unknown }).freecut === "editor";

/** Which screen a history entry belongs to. (v1.0.0 always answered "home" — breaking the Forward button.) */
export const screenForPopState = (state: unknown): Screen =>
  isEditorState(state) ? "editor" : "home";

/**
 * Screen state + browser-history integration for Home ⇄ Editor.
 * The editor gets its own history entry so the phone/browser Back button returns Home instead of leaving the
 * app, and Forward returns to the editor.
 */
export function useScreenRouter(onEnterEditor?: () => void) {
  const [screen, setScreen] = useState<Screen>("home");
  const [leaving, setLeaving] = useState<Screen | null>(null);
  const [launch, setLaunch] = useState<LaunchOptions | null>(null);
  const screenRef = useRef<Screen>("home");
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enterRef = useRef(onEnterEditor);
  enterRef.current = onEnterEditor;

  // Single entry point for changing screen, so every route (buttons, Back/Forward, swipe back) animates the same way.
  const go = useCallback((next: Screen) => {
    const prev = screenRef.current;
    if (prev === next) return;
    screenRef.current = next;
    if (next === "editor") enterRef.current?.();
    setLeaving(prev);
    setScreen(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLeaving(null), TRANSITION_MS + 30);
  }, []);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  useEffect(() => {
    // A reload restores the editor's history entry while the app starts on Home: reset it so Back/Forward stay in sync.
    if (isEditorState(window.history.state)) {
      try {
        window.history.replaceState(null, "");
      } catch {
        /* history unavailable */
      }
    }
    const onPop = (e: PopStateEvent) => go(screenForPopState(e.state));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [go]);

  const nav = useMemo<Nav>(
    () => ({
      launch,
      goHome: () => {
        if (isEditorState(window.history.state)) window.history.back();
        else go("home");
      },
    }),
    [launch, go],
  );

  const openEditor = useCallback(
    (opts?: LaunchOptions) => {
      setLaunch(opts ?? null);
      try {
        window.history.pushState(EDITOR_STATE, "");
      } catch {
        /* history unavailable: the Home button still works */
      }
      go("editor");
    },
    [go],
  );

  return { screen, leaving, launch, nav, openEditor };
}
