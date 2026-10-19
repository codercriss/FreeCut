import { createContext, useCallback, useContext, type ReactNode } from "react";
import type { Project } from "../model/types";
import { useStore } from "./createStore";
import type { ProjectStore } from "./projectStore";
import { projectStore } from "./singleton";

const Ctx = createContext<ProjectStore>(projectStore);

/** Provide a different store (tests, future multi-project). Defaults to the app singleton. */
export function ProjectStoreProvider({
  store,
  children,
}: {
  store: ProjectStore;
  children: ReactNode;
}) {
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useProjectStore = (): ProjectStore => useContext(Ctx);

/** Select a slice of the current project. Selector must be pure; return stable references where possible. */
export function useProject<T>(selector: (p: Project) => T, isEqual?: (a: T, b: T) => boolean): T {
  const store = useProjectStore();
  return useStore(store, (s) => selector(s.project), isEqual);
}

const canUndoSel = (s: { past: unknown[] }) => s.past.length > 0;
const canRedoSel = (s: { future: unknown[] }) => s.future.length > 0;

export function useUndoRedo() {
  const store = useProjectStore();
  const canUndo = useStore(store, canUndoSel);
  const canRedo = useStore(store, canRedoSel);
  const undo = useCallback(() => store.undo(), [store]);
  const redo = useCallback(() => store.redo(), [store]);
  return { canUndo, canRedo, undo, redo };
}
