import type { Asset, Clip, Frame, Id, Project, Track } from "./types";

export const trackById = (p: Project, id: Id): Track | undefined =>
  p.tracks.find((t) => t.id === id);
export const assetById = (p: Project, id: Id): Asset | undefined =>
  p.assets.find((a) => a.id === id);
export const clipById = (p: Project, id: Id): Clip | undefined => p.clips.find((c) => c.id === id);

export const clipEnd = (c: Clip): Frame => c.start + c.duration;

export const clipsOnTrack = (p: Project, trackId: Id): Clip[] =>
  p.clips.filter((c) => c.trackId === trackId).sort((a, b) => a.start - b.start);

/** Project length = the end of the last clip (0 for an empty project). */
export function projectDuration(p: Project): Frame {
  let end = 0;
  for (const c of p.clips) end = Math.max(end, clipEnd(c));
  return end;
}

/**
 * The visual clip showing at `frame`: the topmost main/overlay track with a video/image clip there.
 * End is exclusive, so the very last frame (== duration) shows nothing.
 */
export function activeVisualClip(p: Project, frame: Frame): Clip | undefined {
  for (const track of p.tracks) {
    if (track.kind === "audio" || track.hidden) continue;
    const hit = p.clips.find((c) => {
      if (c.trackId !== track.id || frame < c.start || frame >= clipEnd(c)) return false;
      const a = assetById(p, c.assetId);
      return !!a && (a.kind === "video" || a.kind === "image");
    });
    if (hit) return hit;
  }
  return undefined;
}

/** The main video track's first clip — the default selection when the editor opens. */
export function defaultSelection(p: Project): Id[] {
  const main = p.tracks.find((t) => t.kind === "main");
  const first = main ? clipsOnTrack(p, main.id)[0] : undefined;
  return first ? [first.id] : [];
}
