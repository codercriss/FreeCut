import { ChevronDown, Mic, MousePointer2, Redo2, Trash2, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { usePlayback } from "../../engine/playback";
import { editorStore, setSelection } from "../../store/editorStore";
import { useStore } from "../../store/createStore";
import { useProject, useUndoRedo } from "../../store/ProjectContext";
import { Slider } from "../../ui/controls";
import { IconCircleMinus, IconCirclePlus, IconSplit } from "../../ui/icons";
import { PlayheadHead, Ruler } from "./Clips";
import {
  createTimeScale,
  DESKTOP_BASE_PPS,
  DESKTOP_METRICS,
  DESKTOP_ORIGIN,
  layoutTracks,
  timelineSeconds,
  zoomToScale,
} from "./geometry";
import { ToggleButtons } from "./ToggleButtons";
import { TrackClips, TrackHeads } from "./TrackParts";

/* ───────────── timeline: desktop ───────────── */
export function Timeline() {
  const [zoom, setZoom] = useState(50);
  const selectedIds = useStore(editorStore, (s) => s.selectedClipIds);
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const { frame, fps, totalFrames } = usePlayback();

  const tracks = useProject((p) => p.tracks);
  const clips = useProject((p) => p.clips);
  const assets = useProject((p) => p.assets);

  const S = zoomToScale(zoom); // 50 → 1.0
  const pps = DESKTOP_BASE_PPS * S;
  const scale = useMemo(() => createTimeScale(fps, pps, DESKTOP_ORIGIN), [fps, pps]);
  const seconds = timelineSeconds(totalFrames, fps);
  const canvasW = scale.frameToX(seconds * fps);
  const { rows } = useMemo(() => layoutTracks(tracks, DESKTOP_METRICS), [tracks]);

  const toggleSelect = (id: string) => setSelection(selectedIds.includes(id) ? [] : [id]);

  return (
    <section className="ve-panel ve-timeline" aria-label="Timeline">
      {/* toolbar */}
      <div className="ve-tl-toolbar">
        <button className="ve-select" aria-label="Select tool">
          <MousePointer2 size={11} fill="currentColor" strokeWidth={1.4} />
          <ChevronDown size={8} strokeWidth={2.8} />
        </button>
        <div className="ve-tl-group tight">
          <button
            className="ve-tl-btn"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 size={13} strokeWidth={1.8} />
          </button>
          <button
            className="ve-tl-btn"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 size={13} strokeWidth={1.8} />
          </button>
          <button className="ve-tl-btn" aria-label="Split">
            <IconSplit size={13} strokeWidth={1.8} />
          </button>
          <button className="ve-tl-btn" aria-label="Delete">
            <Trash2 size={13} strokeWidth={1.8} />
          </button>
        </div>

        <div className="ve-tl-right">
          <button className="ve-tl-btn" aria-label="Record audio">
            <Mic size={13} strokeWidth={1.8} />
          </button>
          <ToggleButtons />

          <div className="ve-zoom">
            <button
              className="ve-ghost bright"
              onClick={() => setZoom((z) => Math.max(0, z - 10))}
              aria-label="Zoom out"
            >
              <IconCircleMinus size={14} strokeWidth={1.7} />
            </button>
            <Slider className="zoom" label="Timeline zoom" value={zoom} onChange={setZoom} />
            <button
              className="ve-ghost bright"
              onClick={() => setZoom((z) => Math.min(100, z + 10))}
              aria-label="Zoom in"
            >
              <IconCirclePlus size={14} strokeWidth={1.7} />
            </button>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="ve-tl-body">
        <div className="ve-tl-heads">
          <TrackHeads rows={rows} rowClass="ve-head-row" />
        </div>

        <div className="ve-tl-scroll ve-hide-sb">
          <div className="ve-tl-canvas" style={{ width: canvasW }}>
            <Ruler
              pps={pps}
              origin={scale.origin}
              maxT={seconds}
              width={canvasW}
              height={DESKTOP_METRICS.rulerHeight}
            />
            <TrackClips
              rows={rows}
              clips={clips}
              assets={assets}
              scale={scale}
              selectedIds={selectedIds}
              onToggle={toggleSelect}
            />
            <div className="ve-playhead" style={{ left: scale.frameToX(frame) }}>
              <PlayheadHead />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
