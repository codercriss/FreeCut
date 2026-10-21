import { describe, expect, it } from "vitest";
import v1Fixture from "./fixtures/project.v1.json";
import v2Fixture from "./fixtures/project.v2.json";
import { migrateProject, ProjectLoadError, type Migration } from "./migrations";
import { createSampleProject } from "./sample";
import { SCHEMA_VERSION } from "./types";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof ProjectLoadError ? e.code : "other";
  }
  return "none";
};

describe("migrateProject", () => {
  it("loads the frozen v1 fixture (migrating it to the current schema) — this must pass forever", () => {
    const p = migrateProject(v1Fixture);
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.name).toBe("Frozen v1 fixture");
    expect(p.clips).toHaveLength(2);
  });
  it("v1 → v2 keeps every byte of the user's data and only changes the version", () => {
    const migrated = migrateProject(v1Fixture);
    const { schemaVersion: _a, ...rest } = migrated;
    const { schemaVersion: _b, ...orig } = v1Fixture as Record<string, unknown>;
    expect(rest).toEqual(orig);
    expect(_a).toBe(2);
    expect(_b).toBe(1);
  });
  it("loads the frozen v2 fixture, including imported (stored) assets — this must pass forever", () => {
    const p = migrateProject(v2Fixture);
    expect(p.assets.filter((a) => a.source.type === "stored")).toHaveLength(3);
    expect(p.assets.find((a) => a.id === "asset-imp-audio")!.peaks).toEqual([
      5, 40, 100, 62, 18, 0,
    ]);
    expect(p.clips.map((c) => c.id)).toContain("clip-imp-video");
  });
  it("round-trips the current sample through JSON", () => {
    const s = createSampleProject(7);
    expect(migrateProject(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it("rejects junk", () => {
    expect(code(() => migrateProject(null))).toBe("not-object");
    expect(code(() => migrateProject([]))).toBe("not-object");
    expect(code(() => migrateProject({}))).toBe("no-version");
    expect(code(() => migrateProject({ schemaVersion: 0 }))).toBe("no-version");
    expect(code(() => migrateProject({ schemaVersion: 1.5 }))).toBe("no-version");
  });
  it("refuses projects saved by a newer app instead of mangling them", () => {
    expect(code(() => migrateProject({ ...v2Fixture, schemaVersion: 99 }))).toBe("too-new");
    expect(code(() => migrateProject({ ...v2Fixture, schemaVersion: SCHEMA_VERSION + 1 }))).toBe(
      "too-new",
    );
  });
  it("reports validation problems", () => {
    try {
      migrateProject({ ...v1Fixture, clips: [{ id: "c" }] });
      expect.unreachable();
    } catch (e) {
      expect((e as ProjectLoadError).code).toBe("invalid");
      expect((e as ProjectLoadError).details.length).toBeGreaterThan(0);
    }
  });

  describe("runner (with a fake v1→v3 chain)", () => {
    const chain: Record<number, Migration> = {
      1: (r) => ({ ...r, step1: true }),
      2: (r) => ({ ...r, step2: (r.step1 ? 1 : 0) + 1 }),
    };
    it("applies each step in order and stamps the version", () => {
      const out = migrateProject(v1Fixture, {
        migrations: chain,
        target: 3,
        skipValidation: true,
      }) as unknown as Record<string, unknown>;
      expect(out.schemaVersion).toBe(3);
      expect(out.step1).toBe(true);
      expect(out.step2).toBe(2);
    });
    it("doesn't mutate its input", () => {
      const input = structuredClone(v1Fixture) as Record<string, unknown>;
      migrateProject(input, { migrations: chain, target: 3, skipValidation: true });
      expect(input.schemaVersion).toBe(1);
      expect("step1" in input).toBe(false);
    });
    it("fails clearly when a step is missing", () => {
      expect(
        code(() =>
          migrateProject(v1Fixture, {
            migrations: { 1: chain[1] },
            target: 3,
            skipValidation: true,
          }),
        ),
      ).toBe("missing-migration");
    });
  });
});
