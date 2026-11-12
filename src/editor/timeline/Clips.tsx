import { SlidersHorizontal, Sparkles } from "lucide-react";
import { mmss, hhmmss } from "../../model/time";
import type { Asset, Clip } from "../../model/types";
import { IconFilters } from "../../ui/icons";
import { cellStyle, frameIndexAt } from "../../media/filmstrip";
import { useFilmstrip } from "../../media/useFilmstrip";
import { usePosterUrl } from "../../media/useMediaUrl";
import { lcg } from "../../util/random";
import { Scene } from "../footage/scenes";
import { rulerStep } from "./geometry";

/** Static placeholder waveform (seeded). Replaced by real, Worker-generated waveforms in Phase 1. */
const WAVE = (() => {
  const r = lcg(7);
  return Array.from({ length: 112 }, (_, i) => {
    const env = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.21) * Math.cos(i * 0.07 + 1));
    return Math.max(0.1, Math.min(1, env * (0.45 + 0.8 * r())));
  });
})();

interface RulerProps {
  /** Pixels per second. */
  pps: number;
  /** x of 00:00. */
  origin: number;
  /** Last second to draw a tick for. */
  maxT: number;
  width: number;
  height: number;
  minGap?: number;
}

export function Ruler({ pps, origin, maxT, width, height, minGap = 40 }: RulerProps) {
  const step = rulerStep(pps, minGap);
  const X = (t: number) => origin + t * pps;
  const base = height - 6.6;
  const items = [];
  for (let t = 0; t <= maxT; t += step) {
    const x = X(t);
    items.push(
      <line key={`k${t}`} x1={x} x2={x} y1={base - 6.4} y2={base + 1.6} className="tick" />,
    );
    items.push(
      <text key={`l${t}`} x={x + 3.5} y={base}>
        {mmss(t)}
      </text>,
    );
    for (let d = 1; d < 5; d++) {
      items.push(
        <circle
          key={`d${t}-${d}`}
          cx={X(t + (step * d) / 5)}
          cy={base - 2.4}
          r=".65"
          className="dot"
        />,
      );
    }
  }
  return (
    <svg className="ve-ruler" width={width} height={height} aria-hidden="true">
      {items}
    </svg>
  );
}

interface ClipBox {
  left: number;
  width: number;
  top: number;
  height: number;
}

interface VideoClipProps extends ClipBox {
  clip: Clip;
  asset: Asset;
  fps: number;
  selected: boolean;
  onToggle: () => void;
}

export function VideoClip({
  clip,
  asset,
  fps,
  left,
  width,
  top,
  height,
  selected,
  onToggle,
}: VideoClipProps) {
  const scene = asset.source.type === "generated" ? asset.source.thumb || asset.source.scene : null;
  // A drawn demo scene costs ~500 SVG shapes per cell (zooming in used to create dozens of them), so those clips use
  // few, wider cells; photo/video cells are cheap bitmaps and keep the dense strip.
  const frames = Math.min(scene ? 10 : 90, Math.max(1, Math.round(width / 41.6)));
  const poster = usePosterUrl(asset);
  const strip = useFilmstrip(asset, fps);
  return (
    <div
      className={`ve-clip ve-vclip${selected ? " sel" : ""}`}
      style={{ left, width, top, height }}
      onClick={onToggle}
      data-clip-id={clip.id}
      aria-selected={selected}
    >
      <div className="ve-vhead">
        {/* Only advertise what the clip actually has (imported clips start with none). */}
        {clip.effects.length > 0 && (
          <span className="ve-meta">
            <Sparkles size={9} strokeWidth={2} />
            Effects – Edit
          </span>
        )}
        {clip.filter && (
          <>
            <span className="ve-meta">
              <IconFilters size={9} strokeWidth={2} />
              Filters
            </span>
            <span className="ve-meta">
              <SlidersHorizontal size={9} strokeWidth={2} />
              Adjust
            </span>
          </>
        )}
        <span className="ve-chip">{asset.name}</span>
        <span className="ve-chip">{hhmmss(clip.duration, fps)}</span>
      </div>
      <div className="ve-film">
        {Array.from({ length: frames }, (_, i) => {
          if (strip) {
            // Each cell shows the frame for ITS moment of the source (accounting for trim and speed).
            const cellW = (width - 2 - (frames - 1)) / frames; // .ve-film: 1 px padding, 1 px gaps
            const t = (clip.sourceIn + ((i + 0.5) / frames) * clip.duration * clip.speed) / fps;
            const idx = frameIndexAt(t, strip.meta);
            return (
              <div
                className="ve-frame strip"
                key={i}
                data-frame={idx}
                style={{
                  backgroundImage: `url("${strip.url}")`,
                  ...cellStyle(strip.meta, idx, cellW, 40),
                }}
              />
            );
          }
          return (
            <div
              className={`ve-frame${poster ? " poster" : ""}`}
              key={i}
              style={poster ? { backgroundImage: `url("${poster}")` } : undefined}
            >
              {scene && <Scene id={scene} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface AudioClipProps extends ClipBox {
  clip: Clip;
  asset: Asset;
  fps: number;
  selected: boolean;
  onToggle: () => void;
}

export function AudioClip({
  clip,
  asset,
  fps,
  left,
  width,
  top,
  height,
  selected,
  onToggle,
}: AudioClipProps) {
  return (
    <div
      className={`ve-clip ve-aclip${selected ? " sel" : ""}`}
      style={{ left, width, top, height }}
      onClick={onToggle}
      data-clip-id={clip.id}
      aria-selected={selected}
    >
      <div className="ve-ahead">
        {clip.speed !== 1 && <span className="ve-chip">Speed {clip.speed.toFixed(1)}x</span>}
        <span className="ve-chip">{asset.name}</span>
        <span className="ve-chip">{hhmmss(clip.duration, fps)}</span>
      </div>
      <div className="ve-wave">
        {(asset.peaks ? asset.peaks.map((p) => Math.max(0.1, p / 100)) : WAVE).map((h, i) => (
          <i key={i} style={{ height: `${h * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

export const PlayheadHead = () => (
  <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true">
    <path
      d="M1.8.5h7.4a1.3 1.3 0 0 1 1.3 1.3v4.6L5.5 11.5.5 6.4V1.8A1.3 1.3 0 0 1 1.8.5z"
      fill="#fff"
    />
  </svg>
);
