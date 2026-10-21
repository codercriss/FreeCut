import { createStore } from "../store/createStore";
import type { ImportItem } from "./ingest";

export interface ImportState {
  running: boolean;
  items: ImportItem[];
  /** Set when a batch finishes: how many were added and which failed. */
  summary: {
    added: number;
    failed: Array<{ name: string; message: string }>;
    warnings: Array<{ name: string; message: string }>;
  } | null;
}

/** What the import toast shows. Not part of the project. */
export const importStore = createStore<ImportState>({ running: false, items: [], summary: null });

export const dismissImport = () =>
  importStore.setState((s) => (s.running ? s : { running: false, items: [], summary: null }));
