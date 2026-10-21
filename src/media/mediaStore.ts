import type { Asset, Project } from "../model/types";
import { idbDelete, idbGet, idbGetAll, idbGetAllKeys, idbPut } from "../storage/idb";

/**
 * Imported media lives in IndexedDB as Blobs (store `media`). Why not OPFS yet: see Knowledge_Contribution R-002 —
 * the easy main-thread write API only reached Safari recently, older iPhones would need a Worker path, and IndexedDB
 * Blobs already work everywhere we target. The `MediaRecord` shape and these functions hide the choice from callers.
 */
export interface MediaRecord {
  id: string;
  blob: Blob;
  mime: string;
  bytes: number;
  /** Epoch ms when stored — the orphan sweep never touches fresh records. */
  at: number;
}

export const posterIdOf = (mediaId: string): string => `${mediaId}:poster`;

export async function putMedia(id: string, blob: Blob, now: number = Date.now()): Promise<void> {
  const rec: MediaRecord = { id, blob, mime: blob.type, bytes: blob.size, at: now };
  await idbPut("media", rec);
}

export async function getMedia(id: string): Promise<Blob | undefined> {
  return (await idbGet<MediaRecord>("media", id))?.blob;
}

export const deleteMedia = (id: string) => idbDelete("media", id);

export async function listMediaIds(): Promise<string[]> {
  return (await idbGetAllKeys("media")).map(String);
}

/** Total bytes of stored media (for a future storage screen). */
export async function totalMediaBytes(): Promise<number> {
  return (await idbGetAll<MediaRecord>("media")).reduce((n, r) => n + r.bytes, 0);
}

export function isQuotaError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    ((e as { name?: string }).name === "QuotaExceededError" || (e as { code?: number }).code === 22)
  );
}

/** Ask the browser not to evict our data under storage pressure. Best effort; Safari often answers "no". */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

/** Every media key an asset needs (the file and its poster). */
export function mediaKeysOfAsset(a: Asset): string[] {
  return a.source.type === "stored" ? [a.source.mediaId, posterIdOf(a.source.mediaId)] : [];
}

export function referencedMediaKeys(p: Project): Set<string> {
  return new Set(p.assets.flatMap(mediaKeysOfAsset));
}

/**
 * Tolerant extraction from a RAW stored value (possibly corrupt or from an unknown schema): collect any
 * `assets[].source.mediaId` we can find without validating, so a project we can't open keeps its media.
 */
export function rawMediaKeys(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null) return [];
  const assets = (raw as { assets?: unknown }).assets;
  if (!Array.isArray(assets)) return [];
  const out: string[] = [];
  for (const a of assets) {
    const src = (a as { source?: { type?: unknown; mediaId?: unknown } } | null)?.source;
    if (src && src.type === "stored" && typeof src.mediaId === "string")
      out.push(src.mediaId, posterIdOf(src.mediaId));
  }
  return out;
}

/** How long a new record is protected from the sweep (an import stores the blob before the project references it). */
export const SWEEP_GRACE_MS = 10 * 60 * 1000;

/**
 * Delete media no project (including quarantined, unreadable ones) references. Runs at startup, when the undo
 * history is empty, so nothing deleted here can be needed by an undo. Fresh records are always kept.
 * Returns the number of records removed.
 */
export async function sweepOrphanMedia(now: number = Date.now()): Promise<number> {
  const keep = new Set<string>();
  for (const raw of await idbGetAll<unknown>("projects"))
    rawMediaKeys(raw).forEach((k) => keep.add(k));
  for (const row of await idbGetAll<{ key?: string; value?: { raw?: unknown } }>("meta")) {
    if (typeof row.key === "string" && row.key.startsWith("quarantine:"))
      rawMediaKeys(row.value?.raw).forEach((k) => keep.add(k));
  }
  let removed = 0;
  for (const rec of await idbGetAll<MediaRecord>("media")) {
    if (keep.has(rec.id) || now - rec.at < SWEEP_GRACE_MS) continue;
    await idbDelete("media", rec.id);
    removed += 1;
  }
  return removed;
}
