import type { Id } from "../model/types";
import { createStore } from "./createStore";

/** Ephemeral UI state — NOT part of the project and NOT undoable. */
export interface EditorState {
  selectedClipIds: Id[];
}

export const editorStore = createStore<EditorState>({ selectedClipIds: [] });

export const setSelection = (ids: Id[]) => editorStore.setState({ selectedClipIds: ids });

export const toggleClipSelection = (id: Id) =>
  editorStore.setState((s) => ({
    selectedClipIds: s.selectedClipIds.includes(id)
      ? s.selectedClipIds.filter((x) => x !== id)
      : [...s.selectedClipIds, id],
  }));
