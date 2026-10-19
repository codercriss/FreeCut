import { Maximize, Menu, Pause, Play } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { usePlayback } from "../engine/playback";
import { activeVisualClip, assetById } from "../model/selectors";
import { timecode } from "../model/time";
import { useProject } from "../store/ProjectContext";
import { IconFit } from "../ui/icons";
import { Scene } from "./footage/scenes";

/** The scene (generated footage) under the playhead, or null for a gap / empty project. */
export function useStageScene(frame: number): string | null {
  return useProject((p) => {
    const total = Math.max(0, frame);
    const clip = activeVisualClip(p, total);
    const asset = clip ? assetById(p, clip.assetId) : undefined;
    return asset && asset.source.type === "generated" ? asset.source.scene : null;
  });
}

/** The picture area shared by the desktop and phone players. */
export function Stage({ frame }: { frame: number }) {
  const scene = useStageScene(frame);
  return <div className="ve-video">{scene && <Scene id={scene} />}</div>;
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
