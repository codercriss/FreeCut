import { migrateProject } from "../model/migrations";
import { projectDuration } from "../model/selectors";
import type { Frame, Project } from "../model/types";
import { idbDelete, idbGet, idbGetAll, idbPut } from "./idb";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
  durationFrames: Frame;
}

interface MetaRow {
  key: string;
  value: unknown;
}

/** Write (or overwrite) a project. Resolves once the transaction has committed. */
export async function saveProject(project: Project): Promise<void> {
  await idbPut("projects", project);
}

/** The stored value exactly as saved (un-migrated, un-validated). */
export const loadRawProject = (id: string) => idbGet<unknown>("projects", id);

/** Load, migrate to the current schema, validate. Throws ProjectLoadError / StorageUnavailableError. */
export async function loadProject(id: string): Promise<Project | undefined> {
  const raw = await loadRawProject(id);
  return raw === undefined ? undefined : migrateProject(raw);
}

export const deleteProject = (id: string) => idbDelete("projects", id);

/** Newest first. Reads each project in full — fine until Phase 9 adds a lightweight index + thumbnails. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const all = await idbGetAll<Project>("projects");
  return all
    .map((p) => ({
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      durationFrames: projectDuration(p),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

const LAST = "lastProjectId";
export async function getLastProjectId(): Promise<string | undefined> {
  const row = await idbGet<MetaRow>("meta", LAST);
  return typeof row?.value === "string" ? row.value : undefined;
}
export const setLastProjectId = (id: string) => idbPut("meta", { key: LAST, value: id });

/** Keep an unreadable project's raw bytes so nothing is destroyed when we fall back to a fresh one. */
export async function quarantineRaw(
  id: string,
  raw: unknown,
  reason: string,
  at: number = Date.now(),
): Promise<string> {
  const key = `quarantine:${id}:${at}`;
  await idbPut("meta", { key, value: { id, reason, at, raw } });
  return key;
}
