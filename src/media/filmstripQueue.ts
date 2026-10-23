import type { Asset } from "../model/types";
import { makeFilmstrip, type StripMeta, type StripResult } from "./filmstrip";
import { getMedia, getMediaRecord, putMedia, stripIdOf } from "./mediaStore";
import { refreshMedia } from "./useMediaUrl";

export interface QueueDeps {
  hasStrip(id: string): Promise<boolean>;
  getFile(mediaId: string): Promise<Blob | undefined>;
  make(file: Blob, durationSec: number): Promise<StripResult>;
  save(id: string, blob: Blob, meta: StripMeta): Promise<void>;
  refresh(id: string): void;
  warn(message: string): void;
}

const realDeps: QueueDeps = {
  hasStrip: async (id) => !!(await getMediaRecord(id)),
  getFile: (id) => getMedia(id),
  make: (file, dur) => makeFilmstrip(file, dur),
  save: (id, blob, meta) => putMedia(id, blob, Date.now(), meta),
  refresh: refreshMedia,
  warn: (m) => console.warn(m),
};

const jobs = new Map<string, Promise<void>>(); // one job per video per page load (also remembers failures)
let chain: Promise<unknown> = Promise.resolve();

/** Forget everything (tests; also lets a retry happen after fixing the cause). */
export function resetFilmstripQueue(): void {
  jobs.clear();
  chain = Promise.resolve();
}

/**
 * Make sure an imported video has a filmstrip sprite. Cheap to call repeatedly: it checks storage first, builds
 * at most once per video per page load, builds one video at a time (a phone decodes one video comfortably), and
 * never throws — if it can't, the timeline keeps showing the poster.
 */
export function requestFilmstrip(
  asset: Asset,
  durationSec: number,
  deps: QueueDeps = realDeps,
): Promise<void> {
  if (asset.source.type !== "stored" || asset.kind !== "video" || durationSec <= 0)
    return Promise.resolve();
  const mediaId = asset.source.mediaId;
  const existing = jobs.get(mediaId);
  if (existing) return existing;
  const stripId = stripIdOf(mediaId);
  const run = async () => {
    try {
      if (await deps.hasStrip(stripId)) return;
      const file = await deps.getFile(mediaId);
      if (!file) return deps.warn(`[FreeCut] filmstrip: stored file for "${asset.name}" not found`);
      const r = await deps.make(file, durationSec);
      if (r.blob && r.meta) {
        await deps.save(stripId, r.blob, r.meta);
        deps.refresh(stripId);
      } else {
        deps.warn(`[FreeCut] filmstrip for "${asset.name}" not made: ${r.notes.join(" · ")}`);
      }
    } catch (e) {
      deps.warn(
        `[FreeCut] filmstrip for "${asset.name}" failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };
  const job = chain.then(run, run);
  chain = job.catch(() => undefined);
  jobs.set(mediaId, job);
  return job;
}
