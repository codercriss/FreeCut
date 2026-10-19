import { sectionDefaults } from "../model/defaults";
import { clamp } from "../model/time";
import type { BlendMode, Clip, ClipSection, Id, Project } from "../model/types";
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
