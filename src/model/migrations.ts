import { validateProject } from "./schema";
import type { Project } from "./types";
import { SCHEMA_VERSION } from "./types";

/** Takes a project at version N (as stored) and returns it at version N+1. Must not mutate its input. */
export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registry keyed by the version a migration upgrades FROM.
 * Add `[1]: v1ToV2` here when SCHEMA_VERSION becomes 2 — and add a frozen fixture of the old
 * shape under src/model/fixtures plus a test (see Knowledge_Contribution.md → "Add a schema migration").
 */
export const MIGRATIONS: Record<number, Migration> = {
  /**
   * v1 → v2 (Phase 1a): assets gained a `stored` source type and optional `mime` / `bytes` / `peaks`.
   * Every v1 project is already a valid v2 project, so this only re-stamps the version (done by the runner).
   */
  1: (raw) => ({ ...raw }),
};

export type ProjectLoadErrorCode =
  "not-object" | "no-version" | "too-new" | "missing-migration" | "invalid";

export class ProjectLoadError extends Error {
  constructor(
    public readonly code: ProjectLoadErrorCode,
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ProjectLoadError";
  }
}

export interface MigrateOptions {
  migrations?: Record<number, Migration>;
  target?: number;
  /** Skip final validation (only for testing intermediate versions). */
  skipValidation?: boolean;
}

/** Bring any stored project up to the current schema, then validate it. Throws ProjectLoadError. */
export function migrateProject(raw: unknown, opts: MigrateOptions = {}): Project {
  const migrations = opts.migrations ?? MIGRATIONS;
  const target = opts.target ?? SCHEMA_VERSION;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ProjectLoadError("not-object", "Stored project is not an object");
  }
  let cur = raw as Record<string, unknown>;
  let v = cur.schemaVersion;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    throw new ProjectLoadError("no-version", "Stored project has no valid schemaVersion");
  }
  if (v > target) {
    throw new ProjectLoadError(
      "too-new",
      `Project was saved by a newer FreeCut (schema ${v}, this app supports ${target})`,
    );
  }
  while (v < target) {
    const step = migrations[v];
    if (!step)
      throw new ProjectLoadError("missing-migration", `No migration from schema ${v} to ${v + 1}`);
    cur = { ...step(cur), schemaVersion: v + 1 };
    v += 1;
  }
  if (!opts.skipValidation) {
    const problems = validateProject(cur);
    if (problems.length)
      throw new ProjectLoadError("invalid", "Stored project failed validation", problems);
  }
  return cur as unknown as Project;
}
