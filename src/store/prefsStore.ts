import { createStore } from "./createStore";

/** Appearance: follow the system (auto) or force dark / light. See `src/app/theme.ts`. */
export type Theme = "auto" | "dark" | "light";
export const THEMES: readonly Theme[] = ["auto", "dark", "light"];
const isTheme = (v: unknown): v is Theme => v === "auto" || v === "dark" || v === "light";

/** Timeline toggles + appearance. Editor preferences (not project data), remembered per device. */
export interface Prefs {
  magnet: boolean;
  snap: boolean;
  link: boolean;
  axis: boolean;
  theme: Theme;
}

const KEY = "freecut.prefs";
// Matches the prototype's initial toggle states; the app has always been dark, so appearance
// starts by following the system rather than forcing a change on anyone.
export const DEFAULT_PREFS: Prefs = {
  magnet: false,
  snap: true,
  link: false,
  axis: false,
  theme: "auto",
};

const BOOLEAN_KEYS = ["magnet", "snap", "link", "axis"] as const;

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null;
    if (raw && typeof raw === "object") {
      const out = { ...DEFAULT_PREFS };
      for (const k of BOOLEAN_KEYS) if (typeof raw[k] === "boolean") out[k] = raw[k];
      if (isTheme(raw.theme)) out.theme = raw.theme; // saved before v1.4.3: default "auto"
      return out;
    }
  } catch {
    /* storage unavailable or corrupt — fall through to defaults */
  }
  return { ...DEFAULT_PREFS };
}

export const prefsStore = createStore<Prefs>(load());

prefsStore.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefsStore.getState()));
  } catch {
    /* private mode / quota — preferences just won't persist */
  }
});

export const togglePref = (k: keyof Prefs) => prefsStore.setState((p) => ({ ...p, [k]: !p[k] }));

/** Choose the appearance. `theme.ts` reacts by switching the live palette. */
export const setTheme = (theme: Theme) =>
  prefsStore.setState((p) => (p.theme === theme ? p : { ...p, theme }));
