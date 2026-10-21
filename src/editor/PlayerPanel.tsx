import { Maximize, Menu, Pause, Play } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { usePlayback } from "../engine/playback";
import { activeVisualClip, assetById } from "../model/selectors";
import { timecode } from "../model/time";
import type { Asset } from "../model/types";
import { usePosterUrl } from "../media/useMediaUrl";
import { useProject } from "../store/ProjectContext";
import { IconFit } from "../ui/icons";
import { Scene } from "./footage/scenes";

/** The asset showing under the playhead (topmost visual clip), or undefined for a gap / empty project. */
export function useStageAsset(frame: number): Asset | undefined {
  return useProject((p) => {
    const clip = activeVisualClip(p, Math.max(0, frame));
    return clip ? assetById(p, clip.assetId) : undefined;
  });
}

/**
 * The picture area shared by the desktop and phone players. Demo assets draw their generated scene; imported
 * assets show their poster until the real decoder-backed preview arrives (Phase 1b).
 */
export function Stage({ frame }: { frame: number }) {
  const asset = useStageAsset(frame);
  const poster = usePosterUrl(asset);
  const scene = asset && asset.source.type === "generated" ? asset.source.scene : null;
  return (
    <div className="ve-video">
      {scene && <Scene id={scene} />}
      {poster && <img className="ve-stage-img" src={poster} alt="" draggable={false} />}
    </div>
  );
}

/* ───────────── player ───────────── */
export function PlayerPanel() {
  const { frame, playing, toggle, seek, fps, totalFrames } = usePlayback();
  const [original, setOriginal] = useState(true);
  const scrubRef = useRef<HTMLDivElement>(null);
  const pct = totalFrames > 0 ? (frame / totalFrames) * 100 : 0;

  const seekFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const el = scrubRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * totalFrames);
  };
  // Fake level meter until Phase 1 brings real audio.
  const l1 = playing ? 30 + 60 * Math.abs(Math.sin(frame / 7)) : 0;
  const l2 = playing ? 25 + 60 * Math.abs(Math.sin(frame / 5 + 1)) : 0;

  return (
    <section className="ve-panel ve-player" aria-label="Player">
      <div className="ve-player-head">
        <span>Player</span>
        <button className="ve-ghost" aria-label="Player menu">
          <Menu size={12} strokeWidth={1.9} />
        </button>
      </div>

      <div className="ve-stage">
        <Stage frame={frame} />
      </div>

      <div
        className="ve-scrub"
        ref={scrubRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromEvent(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) seekFromEvent(e);
        }}
      >
        <div className="ve-ticks base" />
        <div className="ve-ticks played" style={{ width: `${pct}%` }} />
        <div className="ve-scrub-mark" style={{ left: `${pct}%` }} />
      </div>

      <div className="ve-ctrl">
        <span className="ve-time now">{timecode(frame, fps)}</span>
        <span className="ve-time total">{timecode(totalFrames, fps)}</span>
        <span className="ve-meter" aria-hidden="true">
          {[l1, l2].map((l, i) => (
            <i key={i}>
              <b style={{ height: `${100 - l}%` }} />
            </i>
          ))}
        </span>

        <button className="ve-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <Pause size={14} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={14} fill="currentColor" strokeWidth={0} />
          )}
        </button>

        <div className="ve-ctrl-right">
          <button className="ve-ghost bright" aria-label="Fit">
            <IconFit size={13} strokeWidth={1.7} />
          </button>
          <button
            className={`ve-original${original ? " on" : ""}`}
            onClick={() => setOriginal((o) => !o)}
          >
            Original
          </button>
          <button className="ve-ghost bright" aria-label="Fullscreen">
            <Maximize size={12} strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </section>
  );
}
