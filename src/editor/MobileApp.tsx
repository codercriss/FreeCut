import {
  Check,
  ChevronLeft,
  Maximize,
  Menu,
  Pause,
  Play,
  Redo2,
  SlidersHorizontal,
  Undo2,
  Upload,
} from "lucide-react";
import { useContext, useState } from "react";
import { NavContext } from "../app/NavContext";
import { usePlayback } from "../engine/playback";
import { timecode } from "../model/time";
import { saveStatusStore } from "../storage/autosave";
import { useStore } from "../store/createStore";
import { useProject, useUndoRedo } from "../store/ProjectContext";
import { SceneDefs } from "./footage/scenes";
import { MEDIA_TABS, MediaPanel, type MediaTabId } from "./MediaPanel";
import { Stage } from "./PlayerPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { saveLabel } from "./saveLabel";
import { MobileTimeline } from "./timeline/MobileTimeline";

/* ───────────── mobile shell ───────────── */
type ToolId = "edit" | MediaTabId;
const M_TOOLS = [{ id: "edit" as const, label: "Edit", Icon: SlidersHorizontal }, ...MEDIA_TABS];

function MobileTopBar() {
  const { goHome } = useContext(NavContext);
  const name = useProject((p) => p.name);
  const status = useStore(saveStatusStore, (s) => s);
  return (
    <header className="ve-mob-top">
      <button className="ve-mob-icon" aria-label="Back to home" onClick={goHome}>
        <ChevronLeft size={24} strokeWidth={1.9} />
      </button>
      <div className="ve-mob-title">
        <strong>{name}</strong>
        <span role="status" data-state={status.state}>
          {saveLabel(status, "Auto save local")}
        </span>
      </div>
      <button className="ve-mob-icon" aria-label="Menu">
        <Menu size={20} strokeWidth={1.9} />
      </button>
      <button className="ve-mob-export">
        <Upload size={14} strokeWidth={2.5} />
        <span>Export</span>
      </button>
    </header>
  );
}

function MobilePlayer() {
  const { frame, playing, toggle, fps, totalFrames } = usePlayback();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  return (
    <section className="ve-mob-player" aria-label="Player">
      <div className="ve-mob-stage">
        <div className="ve-mob-video">
          <Stage frame={frame} />
        </div>
      </div>
      <div className="ve-mob-ctrl">
        <div className="ve-mob-time">
          <span className="now">{timecode(frame, fps)}</span>
          <span className="sep">/</span>
          <span className="total">{timecode(totalFrames, fps)}</span>
        </div>
        <button className="ve-mob-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <Pause size={20} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={20} fill="currentColor" strokeWidth={0} />
          )}
        </button>
        <div className="ve-mob-ctrl-right">
          <button aria-label="Undo" disabled={!canUndo} onClick={undo}>
            <Undo2 size={18} strokeWidth={1.8} />
          </button>
          <button aria-label="Redo" disabled={!canRedo} onClick={redo}>
            <Redo2 size={18} strokeWidth={1.8} />
          </button>
          <button aria-label="Fullscreen">
            <Maximize size={17} strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </section>
  );
}

function MobileToolbar({
  active,
  onOpen,
}: {
  active: ToolId | null;
  onOpen: (id: ToolId) => void;
}) {
  return (
    <nav className="ve-mob-toolbar ve-hide-sb" aria-label="Tools">
      {M_TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          className={`ve-mob-tool${active === id ? " on" : ""}`}
          onClick={() => onOpen(id)}
        >
          <Icon size={21} strokeWidth={1.6} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function MobileApp() {
  const { launch } = useContext(NavContext);
  const [sheet, setSheet] = useState<"media" | "edit" | null>(launch?.sheet ?? null);
  const [mediaTab, setMediaTab] = useState<MediaTabId>("media");
  const open = (id: ToolId) => {
    if (id === "edit") setSheet("edit");
    else {
      setMediaTab(id);
      setSheet("media");
    }
  };
  const activeTool: ToolId | null = sheet === "edit" ? "edit" : sheet === "media" ? mediaTab : null;
  const title = sheet === "edit" ? "Edit" : MEDIA_TABS.find((t) => t.id === mediaTab)?.label;

  return (
    <div className="ve-app ve-mobile">
      <SceneDefs />
      <MobileTopBar />
      <MobilePlayer />
      <div className="ve-mob-lower">
        <MobileTimeline onAdd={() => open("media")} />
        <MobileToolbar active={activeTool} onOpen={open} />

        <div
          className={`ve-mob-sheet${sheet ? " open" : ""}`}
          aria-hidden={!sheet}
          role="dialog"
          aria-label={title}
        >
          <div className="ve-mob-sheet-head">
            <span className="ve-mob-sheet-title">{title}</span>
            <button className="ve-mob-done" onClick={() => setSheet(null)} aria-label="Done">
              <Check size={21} strokeWidth={2.4} />
            </button>
          </div>
          <div className="ve-mob-sheet-body">
            <div className="ve-mob-pane" style={{ display: sheet === "edit" ? "flex" : "none" }}>
              <PropertiesPanel />
            </div>
            <div className="ve-mob-pane" style={{ display: sheet === "media" ? "flex" : "none" }}>
              <MediaPanel tab={mediaTab} onTab={setMediaTab} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
