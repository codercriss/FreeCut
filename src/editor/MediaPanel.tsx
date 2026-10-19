import { Filter, LayoutGrid, List, Plus, Sparkles, Type } from "lucide-react";
import { useMemo, useState } from "react";
import { mmss } from "../model/time";
import type { Asset, Id } from "../model/types";
import { useProject } from "../store/ProjectContext";
import {
  CaretDown,
  CaretRight,
  IconAudio,
  IconCirclePlus,
  IconFilters,
  IconMedia,
  IconSticker,
  IconTransition,
} from "../ui/icons";
import { Scene } from "./footage/scenes";

/* ───────────── media panel ───────────── */
export const MEDIA_TABS = [
  { id: "media", label: "Media", Icon: IconMedia },
  { id: "audio", label: "Audio", Icon: IconAudio },
  { id: "text", label: "Text", Icon: Type },
  { id: "stickers", label: "Stickers", Icon: IconSticker },
  { id: "effects", label: "Effects", Icon: Sparkles },
  { id: "transition", label: "Transition", Icon: IconTransition },
  { id: "filters", label: "Filters", Icon: IconFilters },
] as const;

export type MediaTabId = (typeof MEDIA_TABS)[number]["id"];

const thumbScene = (a: Asset): string | null =>
  a.source.type === "generated" ? a.source.thumb || a.source.scene || null : null;

interface Props {
  tab?: MediaTabId;
  onTab?: (id: MediaTabId) => void;
  rail?: boolean;
}

export function MediaPanel({ tab: tabProp, onTab, rail = false }: Props) {
  const [ownTab, setOwnTab] = useState<MediaTabId>("media");
  const tab = tabProp ?? ownTab;
  const setTab = onTab ?? setOwnTab;
  const [collapsed, setCollapsed] = useState(false);
  const shut = rail && collapsed;
  const pickTab = (id: MediaTabId) => {
    if (rail && id === tab) {
      setCollapsed((c) => !c); // click the active icon again to fold the library away
      return;
    }
    setTab(id);
    setCollapsed(false);
  };
  const [source, setSource] = useState<"local" | "library">("local");
  const [expanded, setExpanded] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [picked, setPicked] = useState<Id | null>(null);
  const tabLabel = MEDIA_TABS.find((t) => t.id === tab)?.label;

  const assets = useProject((p) => p.assets);
  const fps = useProject((p) => p.settings.fps);
  // The Media tab shows picture assets; audio assets appear in the Audio tab (Phase 6).
  const items = useMemo(() => assets.filter((a) => a.kind !== "audio"), [assets]);
  const dur = (a: Asset) => mmss(Math.floor(a.durationFrames / fps));

  return (
    <section
      className={"ve-panel ve-media" + (rail ? " rail" : "") + (shut ? " collapsed" : "")}
      aria-label="Media"
    >
      <nav className="ve-tabs ve-hide-sb">
        {MEDIA_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`ve-tab${tab === id && !shut ? " on" : ""}`}
            title={label}
            onClick={() => pickTab(id)}
          >
            <Icon size={15} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {shut ? null : tab !== "media" ? (
        <div className="ve-empty">{tabLabel} library is empty</div>
      ) : (
        <div className="ve-media-body">
          <aside className="ve-side">
            <button
              className={`ve-side-item${source === "local" ? " on" : ""}`}
              onClick={() => {
                if (source === "local") setExpanded((e) => !e);
                else {
                  setSource("local");
                  setExpanded(true);
                }
              }}
            >
              {source === "local" && expanded ? <CaretDown /> : <CaretRight />}
              <span>Local</span>
            </button>
            {source === "local" && expanded && <button className="ve-side-sub">Import</button>}
            <button
              className={`ve-side-item${source === "library" ? " on" : ""}`}
              onClick={() => setSource("library")}
            >
              <CaretRight />
              <span>Library</span>
            </button>
          </aside>

          {source === "library" ? (
            <div className="ve-empty">No library assets yet</div>
          ) : (
            <div className="ve-media-content">
              <div className="ve-m-toolbar">
                <button className="ve-import">
                  <IconCirclePlus size={12} strokeWidth={2} />
                  <span>Import</span>
                </button>
                <div className="ve-m-right">
                  <button className="ve-all">
                    <span>All</span>
                    <Filter size={11} strokeWidth={1.8} />
                  </button>
                  <div className="ve-seg">
                    <button
                      className={view === "list" ? "on" : ""}
                      onClick={() => setView("list")}
                      aria-label="List view"
                    >
                      <List size={12} strokeWidth={1.9} />
                    </button>
                    <button
                      className={view === "grid" ? "on" : ""}
                      onClick={() => setView("grid")}
                      aria-label="Grid view"
                    >
                      <LayoutGrid size={12} strokeWidth={1.9} />
                    </button>
                  </div>
                </div>
              </div>

              {view === "grid" ? (
                <div className="ve-grid ve-hide-sb">
                  {items.map((m) => {
                    const scene = thumbScene(m);
                    return (
                      <div
                        key={m.id}
                        className={`ve-item${picked === m.id ? " picked" : ""}`}
                        onClick={() => setPicked(m.id)}
                      >
                        <div className="ve-thumb">
                          {scene && <Scene id={scene} />}
                          <span className="ve-dur">{dur(m)}</span>
                          <button className="ve-add" aria-label="Add to timeline">
                            <Plus size={10} strokeWidth={2.6} />
                          </button>
                        </div>
                        <div className="ve-label">{m.name}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="ve-list ve-hide-sb">
                  {items.map((m) => {
                    const scene = thumbScene(m);
                    return (
                      <div
                        key={m.id}
                        className={`ve-lrow${picked === m.id ? " picked" : ""}`}
                        onClick={() => setPicked(m.id)}
                      >
                        <div className="ve-lthumb">{scene && <Scene id={scene} />}</div>
                        <div className="ve-lmeta">
                          <span className="ve-lname">{m.name}</span>
                          <span className="ve-ldur">{dur(m)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
