import { Maximize, Menu, Pause, Play } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { usePlayback } from "../engine/playback";
import { timecode } from "../model/time";
import { IconFit } from "../ui/icons";
import { Stage } from "./Stage";

export { Stage } from "./Stage";

/* ───────────── player ───────────── */
export function PlayerPanel() {
  const { frame, playing, toggle, seek, fps, totalFrames, levels } = usePlayback();
  const [original, setOriginal] = useState(true);
  const scrubRef = useRef<HTMLDivElement>(null);
  const pct = totalFrames > 0 ? (frame / totalFrames) * 100 : 0;

  const seekFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const el = scrubRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * totalFrames);
  };
  // The real level meter: read from the sound engine's analysers while playing (flat when there is no sound).
  const [l1, l2] = playing ? levels() : [0, 0];

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
