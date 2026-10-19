import { migrateProject, ProjectLoadError } from "../model/migrations";
import { createSampleProject, SAMPLE_PROJECT_ID } from "../model/sample";
import type { Project } from "../model/types";
import { saveStatusStore, type SaveStatus } from "../storage/autosave";
import { StorageUnavailableError } from "../storage/idb";
import * as repo from "../storage/projectRepo";
import type { Store } from "../store/createStore";
import type { ProjectStore } from "../store/projectStore";

export type BootSource = "loaded" | "created" | "recovered" | "unavailable";

export interface BootResult {
  source: BootSource;
  project: Project;
  /** Human-readable note for the UI/console (e.g. why a saved project was set aside). */
  warning?: string;
}

/** The persistence calls boot needs — a narrow interface so tests can substitute them. */
export interface BootIO {
  getLastProjectId(): Promise<string | undefined>;
  loadRawProject(id: string): Promise<unknown>;
  saveProject(project: Project): Promise<void>;
  setLastProjectId(id: string): Promise<unknown>;
  quarantineRaw(id: string, raw: unknown, reason: string): Promise<string>;
}

export interface BootDeps {
  store: ProjectStore;
  status?: Store<SaveStatus>;
  /** Persistence functions (injectable for tests). */
  io?: BootIO;
  makeSample?: () => Project;
  migrate?: (raw: unknown) => Project;
}

/**
 * Decide which project to show at startup:
 *  1. the last-opened saved project, if it loads and validates;
 *  2. otherwise a fresh sample project (a project that can't be read is quarantined, never deleted);
 *  3. if storage doesn't work at all, an in-memory sample, with status "unavailable".
 */
export async function bootstrapProject(deps: BootDeps): Promise<BootResult> {
  const { store } = deps;
  const status = deps.status ?? saveStatusStore;
  const io = deps.io ?? repo;
  const makeSample = deps.makeSample ?? createSampleProject;
  const migrate = deps.migrate ?? migrateProject;

  const adopt = (project: Project, source: BootSource, warning?: string): BootResult => {
    store.replaceProject(project);
    return { source, project, warning };
  };

  try {
    const id = (await io.getLastProjectId()) ?? SAMPLE_PROJECT_ID;
    const raw = await io.loadRawProject(id);
    if (raw !== undefined) {
      try {
        const project = migrate(raw);
        status.setState({ state: "saved", savedAt: project.updatedAt, error: null });
        return adopt(project, "loaded");
      } catch (e) {
        if (!(e instanceof ProjectLoadError)) throw e;
        const key = await io.quarantineRaw(id, raw, `${e.code}: ${e.message}`);
        const sample = makeSample();
        await io.saveProject(sample);
        await io.setLastProjectId(sample.id);
        status.setState({ state: "saved", savedAt: sample.updatedAt, error: null });
        return adopt(
          sample,
          "recovered",
          `Saved project could not be opened (${e.message}). A copy was kept as "${key}".`,
        );
      }
    }
    const sample = makeSample();
    await io.saveProject(sample);
    await io.setLastProjectId(sample.id);
    status.setState({ state: "saved", savedAt: sample.updatedAt, error: null });
    return adopt(sample, "created");
  } catch (e) {
    const unavailable = e instanceof StorageUnavailableError;
    status.setState({
      state: "unavailable",
      savedAt: null,
      error: e instanceof Error ? e.message : String(e),
    });
    return adopt(
      store.getProject(),
      "unavailable",
      unavailable
        ? "Storage is unavailable (private mode?). Changes will not be saved."
        : `Storage error: ${String(e)}`,
    );
  }
}
