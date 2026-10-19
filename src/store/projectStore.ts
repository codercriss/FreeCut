import type { Project } from "../model/types";
import { createStore, type Store } from "./createStore";

/** A named, pure edit of the project. `apply` must return the SAME object when nothing changes. */
export interface Command {
  type: string;
  /** Shown in future "Undo <label>" UI. */
  label: string;
  /** Edits with the same key made in quick succession merge into one undo step (slider drags, nudges). */
  coalesceKey?: string;
  apply(project: Project): Project;
}

export interface HistoryEntry {
  label: string;
  before: Project;
  after: Project;
  coalesceKey?: string;
  at: number;
}

export interface ProjectState {
  project: Project;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Bumps on every project change — handy for "has anything changed since X". */
  revision: number;
}

export interface ProjectStoreOptions {
  now?: () => number;
  /** Max gap between two edits for them to coalesce. */
  coalesceMs?: number;
  historyLimit?: number;
}

export interface ProjectStore extends Store<ProjectState> {
  getProject(): Project;
  /** Run a command. Returns false (and records nothing) if it changed nothing. */
  execute(cmd: Command): boolean;
  undo(): boolean;
  redo(): boolean;
  /** Group several commands into ONE undo step (e.g. a drag). Rolls back if `fn` throws. */
  transaction<T>(label: string, fn: () => T): T;
  /** Load a different project; clears history. */
  replaceProject(project: Project): void;
}

/**
 * Project state + undo/redo.
 *
 * Undo is snapshot-based: every history entry keeps the project before/after. Because commands build new
 * objects only along the changed path (structural sharing), a snapshot costs a few small objects, not a
 * copy of the project. If projects ever get large enough for this to matter we can swap in patches
 * without changing the Command API.
 */
export function createProjectStore(initial: Project, opts: ProjectStoreOptions = {}): ProjectStore {
  const now = opts.now ?? Date.now;
  const coalesceMs = opts.coalesceMs ?? 600;
  const limit = opts.historyLimit ?? 200;
  const store = createStore<ProjectState>({ project: initial, past: [], future: [], revision: 0 });

  let txnDepth = 0;
  let txnLabel = "";
  let txnBefore: Project | null = null;
  /** True after undo/redo/transaction/replace: the next edit must start a fresh history entry. */
  let barrier = false;

  const touch = (p: Project): Project => ({ ...p, updatedAt: now() });

  function execute(cmd: Command): boolean {
    const s = store.getState();
    const applied = cmd.apply(s.project);
    if (applied === s.project) return false;
    const next = touch(applied);

    if (txnDepth > 0) {
      store.setState({ ...s, project: next, revision: s.revision + 1 });
      return true;
    }

    const t = now();
    const last = s.past[s.past.length - 1];
    const wasBarrier = barrier;
    barrier = false;
    if (
      !wasBarrier &&
      last &&
      cmd.coalesceKey &&
      last.coalesceKey === cmd.coalesceKey &&
      t - last.at <= coalesceMs
    ) {
      const merged: HistoryEntry = { ...last, after: next, at: t };
      store.setState({
        project: next,
        past: [...s.past.slice(0, -1), merged],
        future: [],
        revision: s.revision + 1,
      });
      return true;
    }
    const entry: HistoryEntry = {
      label: cmd.label,
      before: s.project,
      after: next,
      coalesceKey: cmd.coalesceKey,
      at: t,
    };
    const past = [...s.past, entry];
    if (past.length > limit) past.splice(0, past.length - limit);
    store.setState({ project: next, past, future: [], revision: s.revision + 1 });
    return true;
  }

  return {
    ...store,
    getProject: () => store.getState().project,
    execute,
    undo() {
      const s = store.getState();
      const entry = s.past[s.past.length - 1];
      if (!entry || txnDepth > 0) return false;
      barrier = true;
      store.setState({
        project: touch(entry.before),
        past: s.past.slice(0, -1),
        future: [entry, ...s.future],
        revision: s.revision + 1,
      });
      return true;
    },
    redo() {
      const s = store.getState();
      const entry = s.future[0];
      if (!entry || txnDepth > 0) return false;
      barrier = true;
      store.setState({
        project: touch(entry.after),
        past: [...s.past, { ...entry, at: 0 }], // at:0 → a redo is never coalesced into
        future: s.future.slice(1),
        revision: s.revision + 1,
      });
      return true;
    },
    transaction<T>(label: string, fn: () => T): T {
      if (txnDepth === 0) {
        txnBefore = store.getState().project;
        txnLabel = label;
      }
      txnDepth += 1;
      try {
        return fn();
      } catch (err) {
        if (txnDepth === 1 && txnBefore) {
          const s = store.getState();
          store.setState({ ...s, project: txnBefore, revision: s.revision + 1 });
        }
        throw err;
      } finally {
        txnDepth -= 1;
        if (txnDepth === 0) {
          const s = store.getState();
          const before = txnBefore;
          txnBefore = null;
          barrier = true;
          // On rollback `project === before`, so nothing is recorded.
          if (before && s.project !== before) {
            const entry: HistoryEntry = { label: txnLabel, before, after: s.project, at: 0 };
            const past = [...s.past, entry];
            if (past.length > limit) past.splice(0, past.length - limit);
            store.setState({ ...s, past, future: [] });
          }
        }
      }
    },
    replaceProject(project) {
      barrier = true;
      const s = store.getState();
      store.setState({ project, past: [], future: [], revision: s.revision + 1 });
    },
  };
}
