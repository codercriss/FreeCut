import { prefsStore, type Theme } from "../store/prefsStore";

/**
 * The live side of the appearance setting (Me → Appearance, `src/home/Home.tsx`). The palette itself
 * is CSS (`src/styles/theme.css`); all this does is keep `<html data-theme="…">` and the two meta
 * tags in step with the saved preference:
 *  - `data-theme` picks the palette: "auto" (default) follows `prefers-color-scheme`, "dark" and
 *    "light" force one;
 *  - `color-scheme` tells the browser how to paint its own UI (form controls, scrollbars, the
 *    select dropdown): both values for auto, the forced one otherwise;
 *  - `theme-color` tints the phone's status-bar / browser chrome.
 * index.html sets `data-theme` before first paint; this module owns it from then on, including when
 * the system theme flips while the app is open (only reachable in "auto", naturally).
 */

export const THEME_BG = { dark: "#0f0f10", light: "#f2f2f5" } as const;

export function systemPrefersLight(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: light)").matches
    : false;
}

/** What "auto" resolves to right now ("dark" when the system says nothing). */
export function resolvedTheme(theme: Theme): "dark" | "light" {
  return theme === "auto" ? (systemPrefersLight() ? "light" : "dark") : theme;
}

export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  el.dataset.theme = theme;
  document
    .querySelector('meta[name="color-scheme"]')
    ?.setAttribute("content", theme === "auto" ? "dark light" : theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_BG[resolvedTheme(theme)]);
}

/**
 * Apply the saved theme, then keep applying it. Returns a cleanup (for tests); the app itself
 * runs once for the page's lifetime.
 */
export function initTheme(): () => void {
  applyTheme(prefsStore.getState().theme);
  const offStore = prefsStore.subscribe(() => applyTheme(prefsStore.getState().theme));
  let offMedia: (() => void) | undefined;
  if (typeof window.matchMedia === "function") {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme(prefsStore.getState().theme);
    mq.addEventListener?.("change", onChange);
    offMedia = () => mq.removeEventListener?.("change", onChange);
  }
  return () => {
    offStore();
    offMedia?.();
  };
}
