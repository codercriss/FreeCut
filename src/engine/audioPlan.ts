import { assetById, trackById } from "../model/selectors";
import type { Project } from "../model/types";

/** One clip's sound, scheduled relative to the moment playback starts. */
export interface PlanItem {
  clipId: string;
  mediaId: string;
  /** Seconds after the start at which this sound begins (0 = already under the playhead). */
  whenSec: number;
  /** Where in the clip's sound to begin, in seconds of that sound. */
  offsetSec: number;
  /** How much of the sound to play, in seconds of that sound (independent of speed). */
  lengthSec: number;
  /** Playback speed. For now it also shifts the pitch. */
  rate: number;
}

export interface AudioPlan {
  items: PlanItem[];
  /** The distinct stored files that must be decoded before this plan can play. */
  mediaIds: string[];
}

/**
 * Which sounds play, and when, if playback starts at `fromFrame`. Pure.
 *  - Video clips carry their own sound; audio clips are sound only; photos and the built-in demo footage are silent.
 *  - A muted track is left out entirely.
 *  - A clip already under the playhead starts at once, part-way in (honouring its trim and speed); a later clip starts
 *    when the playhead reaches it. Clips that have already ended are left out.
 * Whether a video file really contains sound is only known once it is decoded; the engine skips the ones that don't.
 */
export function planAudio(project: Project, fromFrame: number): AudioPlan {
  const fps = project.settings.fps;
  const items: PlanItem[] = [];
  const mediaIds: string[] = [];
  for (const clip of project.clips) {
    const track = trackById(project, clip.trackId);
    const asset = assetById(project, clip.assetId);
    if (!track || track.muted || !asset) continue;
    if (asset.kind === "image" || asset.source.type !== "stored") continue;
    if (!(clip.speed > 0)) continue;
    const end = clip.start + clip.duration;
    if (end <= fromFrame) continue;
    const begun = clip.start < fromFrame;
    const frames = end - Math.max(clip.start, fromFrame);
    const skipped = begun ? (fromFrame - clip.start) * clip.speed : 0;
    const mediaId = asset.source.mediaId;
    items.push({
      clipId: clip.id,
      mediaId,
      whenSec: begun ? 0 : (clip.start - fromFrame) / fps,
      offsetSec: (clip.sourceIn + skipped) / fps,
      lengthSec: (frames * clip.speed) / fps,
      rate: clip.speed,
    });
    if (!mediaIds.includes(mediaId)) mediaIds.push(mediaId);
  }
  return { items, mediaIds };
}

/**
 * Trim a scheduled sound that is already late: if its start time has passed, begin it now, further in, so it stays in
 * step with the clock instead of playing late. Returns null when none of it is left to play. Pure.
 */
export function catchUp(
  item: Pick<PlanItem, "offsetSec" | "lengthSec" | "rate">,
  startAt: number,
  now: number,
): { at: number; offsetSec: number; lengthSec: number } | null {
  if (startAt >= now) return { at: startAt, offsetSec: item.offsetSec, lengthSec: item.lengthSec };
  const lateBy = (now - startAt) * item.rate; // seconds of sound already gone
  const lengthSec = item.lengthSec - lateBy;
  if (lengthSec <= 0.005) return null;
  return { at: now, offsetSec: item.offsetSec + lateBy, lengthSec };
}
