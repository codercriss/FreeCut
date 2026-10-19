import { Volume2, VolumeX } from "lucide-react";
import { useMemo } from "react";
import type { Asset, Clip, Id } from "../../model/types";
import { setTrackMuted } from "../../store/commands";
import { useProjectStore } from "../../store/ProjectContext";
import { IconAudioTrack, IconCover } from "../../ui/icons";
import { AudioClip, VideoClip } from "./Clips";
import type { TimeScale, TrackRow } from "./geometry";

interface ClipsProps {
  rows: TrackRow[];
  clips: Clip[];
  assets: Asset[];
  scale: TimeScale;
  selectedIds: Id[];
  onToggle: (id: Id) => void;
}

/** Every clip of every visible track, positioned by the shared time scale. */
export function TrackClips({ rows, clips, assets, scale, selectedIds, onToggle }: ClipsProps) {
  const byId = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);
  const rowOf = useMemo(() => new Map(rows.map((r) => [r.track.id, r])), [rows]);
  return (
    <>
      {clips.map((clip) => {
        const row = rowOf.get(clip.trackId);
        const asset = byId.get(clip.assetId);
        if (!row || !asset) return null;
        const box = {
          left: scale.frameToX(clip.start),
          width: scale.framesToWidth(clip.duration),
          top: row.clipTop,
          height: row.clipHeight,
        };
        const common = {
          clip,
          asset,
          fps: scale.fps,
          selected: selectedIds.includes(clip.id),
          onToggle: () => onToggle(clip.id),
          ...box,
        };
        return row.track.kind === "audio" ? (
          <AudioClip key={clip.id} {...common} />
        ) : (
          <VideoClip key={clip.id} {...common} />
        );
      })}
    </>
  );
}

interface HeadsProps {
  rows: TrackRow[];
  /** Class of each head row (`ve-head-row` desktop, `ve-mob-head` phone). */
  rowClass: string;
  mobile?: boolean;
}

/** Per-track controls at the left of the timeline (cover + mute on the main track, mute on audio tracks). */
export function TrackHeads({ rows, rowClass, mobile = false }: HeadsProps) {
  const store = useProjectStore();
  const toggleMute = (id: Id, muted: boolean) => store.execute(setTrackMuted(id, !muted));
  const s = mobile ? { cover: 16, vol: 16, audio: 16 } : { cover: 15, vol: 14, audio: 15 };
  return (
    <>
      {rows.map(({ track, top, height }) => {
        if (track.kind === "main") {
          return (
            <div key={track.id} className={rowClass} style={{ top, height }}>
              <button className="ve-th" aria-label="Set cover">
                <IconCover size={s.cover} strokeWidth={1.6} />
              </button>
              <button
                className={`ve-th${track.muted ? " dim" : ""}`}
                onClick={() => toggleMute(track.id, track.muted)}
                aria-label="Mute clip"
                aria-pressed={track.muted}
              >
                {track.muted ? (
                  <VolumeX size={s.vol} strokeWidth={1.7} />
                ) : (
                  <Volume2 size={s.vol} strokeWidth={1.7} />
                )}
              </button>
            </div>
          );
        }
        if (track.kind === "audio") {
          return (
            <div key={track.id} className={rowClass} style={{ top, height }}>
              <button
                className={`ve-th${track.muted ? " dim" : ""}`}
                onClick={() => toggleMute(track.id, track.muted)}
                aria-label="Mute audio track"
                aria-pressed={track.muted}
              >
                <IconAudioTrack size={s.audio} strokeWidth={1.6} />
              </button>
            </div>
          );
        }
        return null; // overlay tracks get controls in Phase 2
      })}
    </>
  );
}
