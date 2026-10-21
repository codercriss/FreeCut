import type { ProjectStore } from "../store/projectStore";
import { addAssets } from "../store/commands";
import { ingestFiles, type IngestDeps, type IngestResult } from "./ingest";
import { importStore } from "./importStore";
import { deleteMedia, putMedia, requestPersistentStorage } from "./mediaStore";
import { newId } from "./classify";
import { probeMedia } from "./probe";
import { computePeaks, makePoster } from "./thumbnail";

/** The real, browser-backed dependencies. */
export const browserDeps = (fps: number): IngestDeps => ({
  probe: (f, hint) => probeMedia(f, hint),
  poster: (f, p) => makePoster(f, p),
  peaks: (f, p) => computePeaks(f, p),
  put: (id, blob) => putMedia(id, blob),
  remove: (id) => deleteMedia(id),
  newId,
  fps,
});

let chain: Promise<unknown> = Promise.resolve();

/**
 * Import files into the project: ingest (one at a time), then add all the new assets as ONE undoable command.
 * Calls made while an import is running queue up behind it.
 */
export function importMedia(
  files: File[],
  store: ProjectStore,
  deps: IngestDeps = browserDeps(store.getProject().settings.fps),
): Promise<IngestResult> {
  const run = async (): Promise<IngestResult> => {
    importStore.setState({ running: true, items: [], summary: null });
    const result = await ingestFiles(files, deps, (items) =>
      importStore.setState((s) => ({ ...s, items })),
    );
    if (result.assets.length) {
      store.execute(addAssets(result.assets));
      void requestPersistentStorage();
    }
    importStore.setState((s) => ({
      ...s,
      running: false,
      summary: { added: result.assets.length, failed: result.failed },
    }));
    return result;
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}
