import { useRef, useSyncExternalStore } from "react";
import { SCENES } from "./HeroScenes";

interface PickIdx {
  s: number;
  h: number;
}
export interface Pick extends PickIdx {
  scene: string;
  headline: string[];
}

/* ───────────── a fresh look on every app open ─────────────
   Each time the app is opened (cold launch, reload, or coming back after being away) Home shows a different hero scene
   and headline. The last pick is kept in localStorage so two opens in a row never repeat.
   · More headlines: add a [line 1, line 2] pair to HEADLINES.
   · More scenes: see HeroScenes.tsx (SCENES is the list picked from). */
export const HEADLINES = [
  ["Make your", "next video"],
  ["Make something", "worth replaying"],
  ["Turn clips into", "a story"],
  ["Frame by frame,", "make it yours"],
  ["Great videos", "start here"],
  ["Cut. Polish.", "Share."],
];
const PICK_KEY = "freecut.home.pick";
const AWAY_MS = 20000; // hidden for at least this long = the app was "re-opened"

export function rollIndex(count: number, last: number): number {
  if (count < 2) return 0;
  if (!(last >= 0 && last < count)) return Math.floor(Math.random() * count);
  const i = Math.floor(Math.random() * (count - 1)); // 0 … count-2, then skip over the last pick
  return i >= last ? i + 1 : i;
}

function readLastPick(): PickIdx {
  try {
    const v = JSON.parse(window.localStorage.getItem(PICK_KEY) ?? "null") as PickIdx | null;
    if (v && Number.isInteger(v.s) && Number.isInteger(v.h)) return v;
  } catch {
    /* storage unavailable or corrupt: fall back to a plain random pick */
  }
  return { s: -1, h: -1 };
}

function rollPick(last: PickIdx): Pick {
  const s = rollIndex(SCENES.length, last.s);
  const h = rollIndex(HEADLINES.length, last.h);
  try {
    window.localStorage.setItem(PICK_KEY, JSON.stringify({ s, h }));
  } catch {
    /* private mode: nothing to remember */
  }
  return { s, h, scene: SCENES[s], headline: HEADLINES[h] };
}

let currentPick: Pick = rollPick(readLastPick());
const pickListeners = new Set<() => void>();
const subscribePick = (fn: () => void) => {
  pickListeners.add(fn);
  return () => pickListeners.delete(fn);
};
const getPick = () => currentPick;

if (typeof document !== "undefined") {
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = Date.now();
    } else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) {
      hiddenAt = 0;
      currentPick = rollPick(currentPick);
      pickListeners.forEach((fn) => fn());
    }
  });
}

// [pick, fresh] — fresh is true when the pick changed while this Home was already on screen (app resumed), so it can fade in.
export function useOpenPick(): [Pick, boolean] {
  const pick = useSyncExternalStore(subscribePick, getPick, getPick);
  const first = useRef(pick);
  return [pick, first.current !== pick];
}
