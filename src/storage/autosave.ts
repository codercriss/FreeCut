import type { Project } from "../model/types";
import { createStore, type Store } from "../store/createStore";
import type { ProjectStore } from "../store/projectStore";
import { StorageUnavailableError } from "./idb";

export type SaveState = "idle" | "saving" | "saved" | "error" | "unavailable";

export interface SaveStatus {
  state: SaveState;
  /** Epoch ms of the last successful save (or of the loaded project's last save). */
  savedAt: number | null;
  error: string | null;
}

export const saveStatusStore: Store<SaveStatus> = createStore<SaveStatus>({
  state: "idle",
  savedAt: null,
  error: null,
});

export interface AutosaveOptions {
  store: ProjectStore;
  save: (project: Project) => Promise<void>;
  status?: Store<SaveStatus>;
  debounceMs?: number;
  /** First retry delay after a failed save; doubles up to `maxRetryMs`. */
  retryMs?: number;
  maxRetryMs?: number;
  now?: () => number;
  /** Also flush when the page is hidden/closed (browser only). */
  flushOnHide?: boolean;
}

export interface Autosave {
  /** Save any pending change right now and wait for it. */
  flush(): Promise<void>;
  stop(): void;
}

/**
 * Debounced, serialised autosave. Watches the project store; saves the LATEST project after `debounceMs`
 * of quiet. Never overlaps two writes, never loses a change made during a write, retries transient errors
 * with backoff, and stops trying (reporting "unavailable") when storage can't work at all.
 */
export function startAutosave(opts: AutosaveOptions): Autosave {
  const { store, save } = opts;
  const status = opts.status ?? saveStatusStore;
  const debounceMs = opts.debounceMs ?? 500;
  const now = opts.now ?? Date.now;
  const maxRetry = opts.maxRetryMs ?? 30_000;
  let retryDelay = opts.retryMs ?? 2_000;

  let lastSaved: Project = store.getProject();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inflight: Promise<void> | null = null;
  let stopped = false;
  let disabled = false; // storage unavailable: stop trying until the next explicit change after reload

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const schedule = (ms: number) => {
    if (stopped || disabled) return;
    clearTimer();
    timer = setTimeout(() => void run(), ms);
  };

  async function run(): Promise<void> {
    clearTimer();
    if (inflight) return inflight; // the in-flight save re-checks for newer changes when it finishes
    const project = store.getProject();
    if (project === lastSaved || stopped || disabled) return;
    status.setState((s) => ({ ...s, state: "saving" }));
    inflight = (async () => {
      try {
        await save(project);
        lastSaved = project;
        retryDelay = opts.retryMs ?? 2_000;
        status.setState({ state: "saved", savedAt: now(), error: null });
      } catch (e) {
        if (e instanceof StorageUnavailableError) {
          disabled = true;
          status.setState({ state: "unavailable", savedAt: null, error: e.message });
        } else {
          status.setState((s) => ({
            ...s,
            state: "error",
            error: e instanceof Error ? e.message : String(e),
          }));
          schedule(retryDelay);
          retryDelay = Math.min(retryDelay * 2, maxRetry);
        }
      } finally {
        inflight = null;
      }
      // Changed while we were writing? Go again (debounced).
      if (
        !disabled &&
        !stopped &&
        store.getProject() !== lastSaved &&
        status.getState().state !== "error"
      )
        schedule(debounceMs);
    })();
    return inflight;
  }

  const unsubscribe = store.subscribe(() => {
    if (store.getProject() !== lastSaved) schedule(debounceMs);
  });

  const onHide = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") return;
    void run();
  };
  if (opts.flushOnHide && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
  }

  return {
    async flush() {
      clearTimer();
      while (inflight) await inflight;
      await run();
      while (inflight) await inflight;
    },
    stop() {
      stopped = true;
      clearTimer();
      unsubscribe();
      if (opts.flushOnHide && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onHide);
        window.removeEventListener("pagehide", onHide);
      }
    },
  };
}
