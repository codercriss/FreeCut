import { DEFAULT_SECTIONS, DEFAULT_TRANSFORM, sectionDefaults } from "../model/defaults";
import { clamp } from "../model/time";
import type { Asset, BlendMode, Clip, ClipSection, Id, Project } from "../model/types";
import type { Command } from "./projectStore";

/** Return a project with `fn` applied to one clip; the SAME project if the clip is missing or unchanged. */
function mapClip(p: Project, clipId: Id, fn: (c: Clip) => Clip): Project {
  let changed = false;
  const clips = p.clips.map((c) => {
    if (c.id !== clipId) return c;
    const next = fn(c);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...p, clips } : p;
}

const clipCmd = (
  type: string,
  label: string,
  clipId: Id,
  fn: (c: Clip) => Clip,
  coalesce = false,
): Command => ({
  type,
  label,
  coalesceKey: coalesce ? `${type}:${clipId}` : undefined,
  apply: (p) => mapClip(p, clipId, fn),
});

export const renameProject = (name: string): Command => ({
  type: "project.rename",
  label: "Rename project",
  apply: (p) => {
    const next = name.trim();
    return next && next !== p.name ? { ...p, name: next } : p;
  },
});

export const setTrackMuted = (trackId: Id, muted: boolean): Command => ({
  type: "track.mute",
  label: muted ? "Mute track" : "Unmute track",
  apply: (p) => {
    const t = p.tracks.find((x) => x.id === trackId);
    if (!t || t.muted === muted) return p;
    return { ...p, tracks: p.tracks.map((x) => (x.id === trackId ? { ...x, muted } : x)) };
  },
});

export const setClipOpacity = (clipId: Id, opacity: number): Command =>
  clipCmd(
    "clip.opacity",
    "Change opacity",
    clipId,
    (c) => {
      const v = clamp(Math.round(opacity), 0, 100);
      return v === c.opacity ? c : { ...c, opacity: v };
    },
    true,
  );

export const setFilterStrength = (clipId: Id, strength: number): Command =>
  clipCmd(
    "clip.filterStrength",
    "Change filter strength",
    clipId,
    (c) => {
      if (!c.filter) return c;
      const v = clamp(Math.round(strength), 0, 100);
      return v === c.filter.strength ? c : { ...c, filter: { ...c.filter, strength: v } };
    },
    true,
  );

export const setClipZoom = (clipId: Id, zoom: number): Command =>
  clipCmd(
    "clip.zoom",
    "Change zoom",
    clipId,
    (c) => {
      const v = clamp(Math.round(zoom), 0, 100);
      return v === c.transform.zoom ? c : { ...c, transform: { ...c.transform, zoom: v } };
    },
    true,
  );

export const setClipBlend = (clipId: Id, blend: BlendMode): Command =>
  clipCmd("clip.blend", "Change blend mode", clipId, (c) =>
    c.blend === blend ? c : { ...c, blend },
  );

export const setClipSectionEnabled = (
  clipId: Id,
  section: ClipSection,
  enabled: boolean,
): Command =>
  clipCmd("clip.section", `${enabled ? "Enable" : "Disable"} ${section}`, clipId, (c) =>
    c.sections[section] === enabled ? c : { ...c, sections: { ...c.sections, [section]: enabled } },
  );

export const removeClipEffect = (clipId: Id, effectId: Id): Command =>
  clipCmd("clip.removeEffect", "Remove effect", clipId, (c) =>
    c.effects.some((e) => e.id === effectId)
      ? { ...c, effects: c.effects.filter((e) => e.id !== effectId) }
      : c,
  );

export const resetClipSection = (clipId: Id, section: ClipSection): Command =>
  clipCmd("clip.resetSection", `Reset ${section}`, clipId, (c) => {
    const next = { ...c, ...sectionDefaults(section) };
    return JSON.stringify(next) === JSON.stringify(c) ? c : next;
  });

/* ───────────── media / timeline commands (Phase 1a) ───────────── */

/** Add imported assets to the library. One command = one undo step for a whole batch. Ids already present are skipped. */
export const addAssets = (assets: Asset[]): Command => ({
  type: "assets.add",
  label: assets.length === 1 ? "Import media" : `Import ${assets.length} files`,
  apply: (p) => {
    const have = new Set(p.assets.map((a) => a.id));
    const fresh = assets.filter((a) => !have.has(a.id));
    return fresh.length ? { ...p, assets: [...p.assets, ...fresh] } : p;
  },
});

export const renameAsset = (assetId: Id, name: string): Command => ({
  type: "asset.rename",
  label: "Rename media",
  apply: (p) => {
    const next = name.trim();
    const a = p.assets.find((x) => x.id === assetId);
    if (!a || !next || next === a.name) return p;
    return { ...p, assets: p.assets.map((x) => (x.id === assetId ? { ...x, name: next } : x)) };
  },
});

/** Remove an asset AND every clip that uses it, as one undoable step (undo brings both back). */
export const removeAsset = (assetId: Id): Command => ({
  type: "asset.remove",
  label: "Delete media",
  apply: (p) => {
    if (!p.assets.some((a) => a.id === assetId)) return p;
    return {
      ...p,
      assets: p.assets.filter((a) => a.id !== assetId),
      clips: p.clips.filter((c) => c.assetId !== assetId),
    };
  },
});

/**
 * Append a clip of `assetId` to the end of the matching track (audio → first audio track, otherwise the main
 * track). `clipId` is passed in so `apply` stays pure.
 */
export const addClipFromAsset = (assetId: Id, clipId: Id): Command => ({
  type: "clip.addFromAsset",
  label: "Add to timeline",
  apply: (p) => {
    const asset = p.assets.find((a) => a.id === assetId);
    if (!asset || asset.durationFrames <= 0 || p.clips.some((c) => c.id === clipId)) return p;
    const track = p.tracks.find((t) => t.kind === (asset.kind === "audio" ? "audio" : "main"));
    if (!track) return p;
    const start = p.clips.reduce(
      (end, c) => (c.trackId === track.id ? Math.max(end, c.start + c.duration) : end),
      0,
    );
    const clip: Clip = {
      id: clipId,
      trackId: track.id,
      assetId,
      start,
      duration: asset.durationFrames,
      sourceIn: 0,
      speed: 1,
      transform: { ...DEFAULT_TRANSFORM },
      opacity: 100,
      blend: "normal",
      filter: null,
      effects: [],
      sections: { ...DEFAULT_SECTIONS },
    };
    return { ...p, clips: [...p.clips, clip] };
  },
});
