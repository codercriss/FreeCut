import type { Project } from "./types";
import { SCHEMA_VERSION } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const inRange = (v: unknown, lo: number, hi: number) => isNum(v) && v >= lo && v <= hi;

/**
 * Structural + referential validation of a project of the CURRENT schema version.
 * Returns human-readable problems; an empty array means valid.
 */
export function validateProject(raw: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(raw)) return ["project is not an object"];
  if (raw.schemaVersion !== SCHEMA_VERSION)
    errs.push(`schemaVersion is ${String(raw.schemaVersion)}, expected ${SCHEMA_VERSION}`);
  if (!isStr(raw.id)) errs.push("id missing");
  if (typeof raw.name !== "string") errs.push("name missing");
  if (!isNum(raw.createdAt) || !isNum(raw.updatedAt))
    errs.push("createdAt/updatedAt must be numbers");

  const s = raw.settings;
  if (!isObj(s) || !isInt(s.fps) || s.fps <= 0 || !isInt(s.width) || !isInt(s.height))
    errs.push("settings invalid");

  for (const key of ["assets", "tracks", "clips", "markers"] as const) {
    if (!Array.isArray(raw[key])) errs.push(`${key} must be an array`);
  }
  if (errs.length) return errs;

  const assets = raw.assets as unknown[];
  const tracks = raw.tracks as unknown[];
  const clips = raw.clips as unknown[];

  const assetIds = new Set<string>();
  assets.forEach((a, i) => {
    if (!isObj(a) || !isStr(a.id)) return void errs.push(`assets[${i}] invalid`);
    if (assetIds.has(a.id)) errs.push(`duplicate asset id ${a.id}`);
    assetIds.add(a.id);
    if (!["video", "audio", "image"].includes(String(a.kind))) errs.push(`asset ${a.id}: bad kind`);
    if (!isInt(a.durationFrames) || a.durationFrames < 0)
      errs.push(`asset ${a.id}: durationFrames must be a non-negative integer`);
    if (!isObj(a.source) || !["generated", "opfs", "stored"].includes(String(a.source.type)))
      errs.push(`asset ${a.id}: bad source`);
    else if (a.source.type === "stored" && !isStr(a.source.mediaId))
      errs.push(`asset ${a.id}: stored source needs a mediaId`);
    if (a.mime !== undefined && typeof a.mime !== "string")
      errs.push(`asset ${a.id}: mime must be a string`);
    if (a.bytes !== undefined && (!isInt(a.bytes) || a.bytes < 0))
      errs.push(`asset ${a.id}: bytes must be a non-negative integer`);
    if (a.peaks !== undefined && (!Array.isArray(a.peaks) || !a.peaks.every((n) => isNum(n))))
      errs.push(`asset ${a.id}: peaks must be an array of numbers`);
  });

  const trackIds = new Set<string>();
  tracks.forEach((t, i) => {
    if (!isObj(t) || !isStr(t.id)) return void errs.push(`tracks[${i}] invalid`);
    if (trackIds.has(t.id)) errs.push(`duplicate track id ${t.id}`);
    trackIds.add(t.id);
    if (!["main", "overlay", "audio"].includes(String(t.kind)))
      errs.push(`track ${t.id}: bad kind`);
    for (const f of ["muted", "locked", "hidden"])
      if (typeof t[f] !== "boolean") errs.push(`track ${t.id}: ${f} must be boolean`);
  });

  const clipIds = new Set<string>();
  const byTrack = new Map<string, Array<{ id: string; start: number; end: number }>>();
  clips.forEach((c, i) => {
    if (!isObj(c) || !isStr(c.id)) return void errs.push(`clips[${i}] invalid`);
    if (clipIds.has(c.id)) errs.push(`duplicate clip id ${c.id}`);
    clipIds.add(c.id);
    if (!trackIds.has(String(c.trackId)))
      errs.push(`clip ${c.id}: unknown track ${String(c.trackId)}`);
    if (!assetIds.has(String(c.assetId)))
      errs.push(`clip ${c.id}: unknown asset ${String(c.assetId)}`);
    if (!isInt(c.start) || c.start < 0)
      errs.push(`clip ${c.id}: start must be a non-negative integer`);
    if (!isInt(c.duration) || c.duration <= 0)
      errs.push(`clip ${c.id}: duration must be a positive integer`);
    if (!isInt(c.sourceIn) || c.sourceIn < 0)
      errs.push(`clip ${c.id}: sourceIn must be a non-negative integer`);
    if (!isNum(c.speed) || c.speed <= 0) errs.push(`clip ${c.id}: speed must be > 0`);
    if (!inRange(c.opacity, 0, 100)) errs.push(`clip ${c.id}: opacity out of range`);
    if (!isObj(c.transform) || !isNum(c.transform.zoom))
      errs.push(`clip ${c.id}: transform invalid`);
    if (!isObj(c.sections)) errs.push(`clip ${c.id}: sections invalid`);
    if (!Array.isArray(c.effects)) errs.push(`clip ${c.id}: effects must be an array`);
    if (c.filter !== null && (!isObj(c.filter) || !inRange(c.filter.strength, 0, 100)))
      errs.push(`clip ${c.id}: filter invalid`);
    if (isInt(c.start) && isInt(c.duration) && isStr(c.trackId)) {
      const list = byTrack.get(c.trackId) ?? [];
      list.push({ id: c.id, start: c.start, end: c.start + c.duration });
      byTrack.set(c.trackId, list);
    }
  });

  for (const [trackId, list] of byTrack) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      if (list[i].start < list[i - 1].end)
        errs.push(`track ${trackId}: clips ${list[i - 1].id} and ${list[i].id} overlap`);
    }
  }
  return errs;
}

export const isValidProject = (raw: unknown): raw is Project => validateProject(raw).length === 0;
