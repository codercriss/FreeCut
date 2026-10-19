import { Mic, Plus, Trash2 } from "lucide-react";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
  type TouchEvent,
  type UIEvent,
} from "react";
import { useControls, useFrame } from "../../engine/playback";
import { clamp } from "../../model/time";
import { useStore } from "../../store/createStore";
import { editorStore, setSelection } from "../../store/editorStore";
import { useProject } from "../../store/ProjectContext";
import { IconCircleMinus, IconCirclePlus, IconSplit } from "../../ui/icons";
import { PlayheadHead, Ruler } from "./Clips";
import {
  createTimeScale,
  layoutTracks,
  MOBILE_BASE_PPS,
  MOBILE_METRICS,
  MOBILE_SCALE_MAX,
  MOBILE_SCALE_MIN,
} from "./geometry";
import { ToggleButtons } from "./ToggleButtons";
import { TrackClips, TrackHeads } from "./TrackParts";

/* ───────────── timeline: mobile ─────────────
   Playhead stays fixed in the centre; the timeline scrolls underneath it
   (scroll position ⇄ current frame). Pinch to zoom. */

/** Keeps the scroll offset in step with the current frame. */
function ScrollSync({
  scrollRef,
  lastProg,
  pps,
  fps,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  lastProg: MutableRefObject<number>;
  pps: number;
  fps: number;
}) {
  const frame = useFrame();
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = (frame / fps) * pps;
    if (Math.abs(el.scrollLeft - target) > 0.6) {
      lastProg.current = target; // remember so onScroll can tell our own moves apart from the user's
      el.scrollLeft = target;
    }
  }, [frame, pps, fps, scrollRef, lastProg]);
  return null;
}

export function MobileTimeline({ onAdd }: { onAdd: () => void }) {
  const { seek, pause, playing, fps, totalFrames } = useControls();
  const [S, setS] = useState(1);
  const selectedIds = useStore(editorStore, (s) => s.selectedClipIds);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastProg = useRef(-999);
  const pinch = useRef<{ d: number; z: number } | null>(null);

  const allTracks = useProject((p) => p.tracks);
  const clips = useProject((p) => p.clips);
  const assets = useProject((p) => p.assets);

  // The phone layout hides overlay tracks until they hold something.
  const tracks = useMemo(
    () => allTracks.filter((t) => t.kind !== "overlay" || clips.some((c) => c.trackId === t.id)),
    [allTracks, clips],
  );
  const { rows } = useMemo(() => layoutTracks(tracks, MOBILE_METRICS), [tracks]);
  const mainRow = rows.find((r) => r.track.kind === "main");

  const duration = totalFrames / fps; // seconds
  const pps = MOBILE_BASE_PPS * S;
  const scale = useMemo(() => createTimeScale(fps, pps, 0), [fps, pps]);
  const contentW = duration * pps;

  const zoomBy = (k: number) => setS((z) => clamp(z * k, MOBILE_SCALE_MIN, MOBILE_SCALE_MAX));
  const dist = (t: TouchEvent["touches"]) =>
    Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (Math.abs(el.scrollLeft - lastProg.current) < 1.5) return; // our own programmatic scroll
    seek((el.scrollLeft / pps) * fps);
  };
  const halt = () => {
    if (playing) pause(); // touching the timeline pauses, like the real app
  };
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z: S };
  };
  const onTouchMove = (e: TouchEvent) => {
    if (pinch.current && e.touches.length === 2) {
      setS(
        clamp(
          pinch.current.z * (dist(e.touches) / pinch.current.d),
          MOBILE_SCALE_MIN,
          MOBILE_SCALE_MAX,
        ),
      );
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null;
  };
  const toggleSelect = (id: string) => setSelection(selectedIds.includes(id) ? [] : [id]);

  return (
    <section className="ve-mob-tl" aria-label="Timeline">
      <div className="ve-mob-tlbar ve-hide-sb">
        <button className="ve-tl-btn" aria-label="Split">
          <IconSplit size={16} strokeWidth={1.8} />
        </button>
        <button className="ve-tl-btn" aria-label="Delete">
          <Trash2 size={16} strokeWidth={1.8} />
        </button>
        <span className="vr" />
        <button className="ve-tl-btn" aria-label="Record audio">
          <Mic size={16} strokeWidth={1.8} />
        </button>
        <ToggleButtons mobile />
        <span className="sp" />
        <button className="ve-tl-btn" onClick={() => zoomBy(0.8)} aria-label="Zoom out">
          <IconCircleMinus size={17} strokeWidth={1.7} />
        </button>
        <button className="ve-tl-btn" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
          <IconCirclePlus size={17} strokeWidth={1.7} />
        </button>
      </div>

      <div className="ve-mob-tlbody">
        <div className="ve-mob-heads">
          <TrackHeads rows={rows} rowClass="ve-mob-head" mobile />
        </div>

        <div className="ve-mob-view">
          <div
            className="ve-mob-scroll ve-hide-sb"
            ref={scrollRef}
            onScroll={onScroll}
            onPointerDown={halt}
            onWheel={halt}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
          >
            <div className="ve-mob-canvas" style={{ width: contentW }}>
              <div className="ve-mob-origin">
                <Ruler
                  pps={pps}
                  origin={0}
                  maxT={duration + 160 / pps}
                  width={contentW + 160}
                  height={MOBILE_METRICS.rulerHeight}
                  minGap={46}
                />
                <TrackClips
                  rows={rows}
                  clips={clips}
                  assets={assets}
                  scale={scale}
                  selectedIds={selectedIds}
                  onToggle={toggleSelect}
                />
                {mainRow && (
                  <button
                    className="ve-mob-add"
                    style={{ left: contentW + 10, top: mainRow.clipTop + 12 }}
                    onClick={onAdd}
                    aria-label="Add clip"
                  >
                    <Plus size={17} strokeWidth={2.4} />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="ve-mob-playhead">
            <PlayheadHead />
          </div>
          <ScrollSync scrollRef={scrollRef} lastProg={lastProg} pps={pps} fps={fps} />
        </div>
      </div>
    </section>
  );
}
