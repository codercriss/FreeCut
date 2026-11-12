import { createStore } from "./createStore";

/** Timeline toggles. Editor preferences (not project data), remembered per device. */
export interface Prefs {
  magnet: boolean;
  snap: boolean;
  link: boolean;
  axis: boolean;
}

const KEY = "freecut.prefs";
// Matches the prototype's initial toggle states.
export const DEFAULT_PREFS: Prefs = { magnet: false, snap: true, link: false, axis: false };

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null;
    if (raw && typeof raw === "object") {
      const out = { ...DEFAULT_PREFS };
      for (const k of Object.keys(DEFAULT_PREFS) as Array<keyof Prefs>)
        if (typeof raw[k] === "boolean") out[k] = raw[k];
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
