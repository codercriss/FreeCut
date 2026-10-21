import type { Asset } from "../model/types";
import {
  classifyFile,
  IMAGE_SECONDS,
  MAX_FILE_BYTES,
  formatBytes,
  type MediaKind,
} from "./classify";
import { isQuotaError, posterIdOf } from "./mediaStore";
import type { PosterResult } from "./poster";
import { ProbeError, type Probe } from "./probe";

export type ItemState = "queued" | "working" | "done" | "error";

export interface ImportItem {
  key: string;
  name: string;
  state: ItemState;
  message?: string;
}

export interface IngestDeps {
  probe(file: File, hint: MediaKind): Promise<Probe>;
  poster(file: File, probe: Probe): Promise<PosterResult>;
  peaks(file: File, probe: Probe): Promise<number[] | null>;
  put(id: string, blob: Blob): Promise<void>;
  remove(id: string): Promise<void>;
  newId(prefix: string): string;
  /** Project frame rate: media durations are stored as integer frames at this rate. */
  fps: number;
}

export interface IngestResult {
  assets: Asset[];
  failed: Array<{ name: string; message: string }>;
  /** Imported fine, but something nice-to-have is missing (e.g. no preview picture). */
  warnings: Array<{ name: string; message: string }>;
}

export const NOT_MEDIA = "Not a video, audio or photo file.";
export const NO_SPACE = "Not enough storage space on this device. Free some space and try again.";
const tooBig = (n: number) =>
  `This file is too large (${formatBytes(n)}). The limit is ${formatBytes(MAX_FILE_BYTES)}.`;

/** Turn one file into an Asset, storing its bytes (and poster). Throws ProbeError-style messages for people. */
async function ingestOne(
  file: File,
  deps: IngestDeps,
): Promise<{ asset: Asset; warning?: string }> {
  const hint = classifyFile(file);
  if (!hint) throw new ProbeError(NOT_MEDIA);
  if (file.size > MAX_FILE_BYTES) throw new ProbeError(tooBig(file.size));
  if (file.size === 0) throw new ProbeError("This file is empty.");

  const probe = await deps.probe(file, hint);
  const assetId = deps.newId("asset");
  const mediaId = deps.newId("media");
  const stored: string[] = [];
  try {
    await deps.put(mediaId, file);
    stored.push(mediaId);

    // Thumbnails and waveforms are nice-to-have: failure never blocks the import.
    const [posterResult, peaks] = await Promise.all([
      deps.poster(file, probe).catch((e): PosterResult => ({
        blob: null,
        notes: [`error: ${e instanceof Error ? e.message : String(e)}`],
      })),
      deps.peaks(file, probe).catch(() => null),
    ]);
    if (posterResult.blob) {
      await deps.put(posterIdOf(mediaId), posterResult.blob);
      stored.push(posterIdOf(mediaId));
    }
    const warning =
      !posterResult.blob && probe.kind !== "audio"
        ? `No preview picture could be made (${posterResult.notes.join(" · ") || "unknown reason"}). Open its ⋯ menu → Create thumbnail to try again.`
        : undefined;

    const durationFrames =
      probe.kind === "image"
        ? Math.round(IMAGE_SECONDS * deps.fps)
        : Math.max(1, Math.round(probe.durationSec * deps.fps));
    const asset: Asset = {
      id: assetId,
      kind: probe.kind,
      name: file.name || "Untitled",
      durationFrames,
      ...(probe.width && probe.height ? { width: probe.width, height: probe.height } : {}),
      source: { type: "stored", mediaId },
      mime: file.type || probe.mime,
      bytes: file.size,
      ...(peaks ? { peaks } : {}),
    };
    return { asset, warning };
  } catch (e) {
    await Promise.all(stored.map((id) => deps.remove(id).catch(() => undefined)));
    throw e;
  }
}

const messageOf = (e: unknown): string => {
  if (e instanceof ProbeError) return e.message;
  if (isQuotaError(e)) return NO_SPACE;
  return "Something went wrong while importing this file.";
};

/**
 * Import files one at a time (phones have little memory; a big video is already a lot). One bad file never
 * stops the others. Reports every state change through `onProgress`.
 */
export async function ingestFiles(
  files: File[],
  deps: IngestDeps,
  onProgress?: (items: ImportItem[]) => void,
): Promise<IngestResult> {
  const items: ImportItem[] = files.map((f, i) => ({
    key: `${i}:${f.name}`,
    name: f.name || "Untitled",
    state: "queued",
  }));
  const emit = () => onProgress?.(items.map((i) => ({ ...i })));
  emit();
  const assets: Asset[] = [];
  const failed: IngestResult["failed"] = [];
  const warnings: IngestResult["warnings"] = [];
  for (let i = 0; i < files.length; i++) {
    items[i].state = "working";
    emit();
    try {
      const one = await ingestOne(files[i], deps);
      assets.push(one.asset);
      if (one.warning) warnings.push({ name: items[i].name, message: one.warning });
      items[i].state = "done";
    } catch (e) {
      const message = messageOf(e);
      if (!(e instanceof ProbeError) && !isQuotaError(e)) console.error("Import failed:", e);
      items[i].state = "error";
      items[i].message = message;
      failed.push({ name: items[i].name, message });
    }
    emit();
  }
  return { assets, failed, warnings };
}
