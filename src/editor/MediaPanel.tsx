import {
  Film,
  Filter,
  ImageIcon,
  LayoutGrid,
  List,
  MoreHorizontal,
  Music,
  Plus,
  Sparkles,
  Type,
} from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { IS_IPHONE, IS_STANDALONE } from "../app/platform";
import { ACCEPT, formatBytes, newId } from "../media/classify";
import { importMedia } from "../media/importer";
import { getMedia, posterIdOf, putMedia } from "../media/mediaStore";
import { makePosterDetailed } from "../media/thumbnail";
import { refreshMedia, useMediaUrl, usePosterUrl } from "../media/useMediaUrl";
import { mmss } from "../model/time";
import type { Asset, AssetKind, Id } from "../model/types";
import { addClipFromAsset, removeAsset, renameAsset } from "../store/commands";
import { setSelection } from "../store/editorStore";
import { useProject, useProjectStore } from "../store/ProjectContext";
import { Dialog } from "../ui/Dialog";
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

type Filter = "all" | AssetKind;
const TIP_KEY = "freecut.tip.homescreen";

/** The picture for a library tile: demo scene, real poster, or an icon placeholder. */
function AssetArt({ asset }: { asset: Asset }) {
  const poster = usePosterUrl(asset);
  if (asset.source.type === "generated" && (asset.source.thumb || asset.source.scene)) {
    return <Scene id={asset.source.thumb || asset.source.scene} />;
  }
  if (poster) return <img className="ve-art" src={poster} alt="" draggable={false} />;
  const Icon = asset.kind === "audio" ? Music : asset.kind === "image" ? ImageIcon : Film;
  return (
    <div className={`ve-ph ${asset.kind}`} aria-hidden="true">
      {asset.kind === "video" && asset.source.type === "stored" && (
        <FirstFrame mediaId={asset.source.mediaId} />
      )}
      {asset.kind === "audio" && asset.peaks ? (
        <span className="ve-ph-wave">
          {asset.peaks
            .filter((_, i) => i % 3 === 0)
            .map((p, i) => (
              <i key={i} style={{ height: `${Math.max(8, p)}%` }} />
            ))}
        </span>
      ) : (
        <Icon size={18} strokeWidth={1.6} />
      )}
    </div>
  );
}

/** No poster? Let the browser's own player paint the first frame behind the icon (worth a try on iOS). */
function FirstFrame({ mediaId }: { mediaId: string }) {
  const url = useMediaUrl(mediaId);
  if (!url) return null;
  return (
    <video
      className="ve-art ve-art-raw"
      src={`${url}#t=0.1`}
      muted
      playsInline
      preload="metadata"
      tabIndex={-1}
    />
  );
}

type DialogMode = "menu" | "rename" | "delete";
type ThumbState =
  | { state: "idle" }
  | { state: "working" }
  | { state: "done" }
  | { state: "failed"; notes: string[] };

/** Retry making a preview picture from the stored file. Runs inside a tap, which iOS likes. */
function ThumbnailAction({ asset }: { asset: Asset }) {
  const poster = usePosterUrl(asset);
  const fps = useProject((p) => p.settings.fps);
  const [t, setT] = useState<ThumbState>({ state: "idle" });
  if (asset.source.type !== "stored" || asset.kind === "audio" || (poster && t.state !== "working"))
    return null;
  const mediaId = asset.source.mediaId;
  const run = async () => {
    setT({ state: "working" });
    try {
      const blob = await getMedia(mediaId);
      if (!blob) return setT({ state: "failed", notes: ["the stored file could not be found"] });
      const r = await makePosterDetailed(blob, {
        kind: asset.kind,
        durationSec: asset.durationFrames / fps,
      });
      if (r.blob) {
        await putMedia(posterIdOf(mediaId), r.blob);
        refreshMedia(posterIdOf(mediaId));
        setT({ state: "done" });
      } else setT({ state: "failed", notes: r.notes });
    } catch (e) {
      setT({ state: "failed", notes: [e instanceof Error ? e.message : String(e)] });
    }
  };
  return (
    <>
      <button onClick={run} disabled={t.state === "working"}>
        {t.state === "working" ? "Creating thumbnail…" : "Create thumbnail"}
      </button>
      {t.state === "failed" && (
        <div className="ve-dialog-diag" role="status">
          Couldn’t make a thumbnail. Details (you can screenshot this):
          <pre>{t.notes.join("\n")}</pre>
        </div>
      )}
    </>
  );
}

function AssetDialog({
  asset,
  onClose,
  onAdd,
}: {
  asset: Asset;
  onClose: () => void;
  onAdd: () => void;
}) {
  const store = useProjectStore();
  const [mode, setMode] = useState<DialogMode>("menu");
  const [name, setName] = useState(asset.name);
  const uses = useProject((p) => p.clips.filter((c) => c.assetId === asset.id).length);

  if (mode === "rename") {
    const save = () => {
      store.execute(renameAsset(asset.id, name));
      onClose();
    };
    return (
      <Dialog title="Rename" onClose={onClose}>
        <input
          className="ve-dialog-input"
          data-autofocus
          aria-label="Name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && save()}
        />
        <div className="ve-dialog-row">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!name.trim()} onClick={save}>
            Save
          </button>
        </div>
      </Dialog>
    );
  }
  if (mode === "delete") {
    return (
      <Dialog title="Delete media?" onClose={onClose}>
        <p className="ve-dialog-text">
          “{asset.name}” will be removed from this project
          {uses > 0
            ? `, and so will the ${uses} clip${uses === 1 ? "" : "s"} on the timeline that use it`
            : ""}
          . You can undo this.
        </p>
        <div className="ve-dialog-row">
          <button data-autofocus onClick={onClose}>
            Cancel
          </button>
          <button
            className="danger"
            onClick={() => {
              store.execute(removeAsset(asset.id));
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog title={asset.name} onClose={onClose}>
      <div className="ve-dialog-meta">
        {asset.kind === "image" ? "Photo" : asset.kind === "audio" ? "Audio" : "Video"}
        {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
        {asset.bytes ? ` · ${formatBytes(asset.bytes)}` : ""}
        {uses > 0 ? ` · used ${uses}×` : ""}
      </div>
      <div className="ve-dialog-list">
        <button
          data-autofocus
          onClick={() => {
            onAdd();
            onClose();
          }}
        >
          Add to timeline
        </button>
        <ThumbnailAction asset={asset} />
        <button onClick={() => setMode("rename")}>Rename…</button>
        <button className="danger" onClick={() => setMode("delete")}>
          Delete…
        </button>
      </div>
    </Dialog>
  );
}

/** Safari can clear a website's saved data after a week unused — the Home Screen app is exempt. Say so, once. */
export function StorageTip({ hasImports }: { hasImports: boolean }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(TIP_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (!IS_IPHONE || IS_STANDALONE || !hasImports || hidden) return null;
  return (
    <div className="ve-tip" role="note">
      <span>
        Tip: add FreeCut to your Home Screen (Share → Add to Home Screen). Safari may clear a
        website’s saved media if you don’t open it for about a week.
      </span>
      <button
        onClick={() => {
          try {
            localStorage.setItem(TIP_KEY, "1");
          } catch {
            /* ignore */
          }
          setHidden(true);
        }}
      >
        Got it
      </button>
    </div>
  );
}

interface Props {
  tab?: MediaTabId;
  onTab?: (id: MediaTabId) => void;
  rail?: boolean;
}

export function MediaPanel({ tab: tabProp, onTab, rail = false }: Props) {
  const store = useProjectStore();
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
  const [filter, setFilter] = useState<Filter>("all");
  const [dialogFor, setDialogFor] = useState<Id | null>(null);
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabLabel = MEDIA_TABS.find((t) => t.id === tab)?.label;

  const assets = useProject((p) => p.assets);
  const fps = useProject((p) => p.settings.fps);
  const items = useMemo(
    () => assets.filter((a) => filter === "all" || a.kind === filter),
    [assets, filter],
  );
  const dialogAsset = dialogFor ? assets.find((a) => a.id === dialogFor) : undefined;
  const hasImports = useMemo(() => assets.some((a) => a.source.type === "stored"), [assets]);
  const dur = (a: Asset) => mmss(Math.floor(a.durationFrames / fps));

  const openPicker = () => inputRef.current?.click();
  const takeFiles = (list: FileList | File[] | null) => {
    const files = list ? Array.from(list) : []; // copy first: clearing the input empties the live FileList
    if (inputRef.current) inputRef.current.value = "";
    if (files.length) void importMedia(files, store);
  };
  const addToTimeline = (a: Asset) => {
    const clipId = newId("clip");
    if (store.execute(addClipFromAsset(a.id, clipId))) setSelection([clipId]);
  };
  const onDragOver = (e: DragEvent) => {
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      e.preventDefault();
      setDropping(true);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    takeFiles(e.dataTransfer.files);
  };

  const tileActions = (m: Asset) => (
    <>
      <button
        className="ve-add"
        aria-label={`Add ${m.name} to timeline`}
        onClick={(e) => {
          e.stopPropagation();
          addToTimeline(m);
        }}
      >
        <Plus size={10} strokeWidth={2.6} />
      </button>
      <button
        className="ve-more"
        aria-label={`More options for ${m.name}`}
        onClick={(e) => {
          e.stopPropagation();
          setDialogFor(m.id);
        }}
      >
        <MoreHorizontal size={11} strokeWidth={2.4} />
      </button>
    </>
  );

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

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        data-testid="media-file-input"
        aria-label="Choose files to import"
        onChange={(e) => takeFiles(e.target.files)}
      />

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
            {source === "local" && expanded && (
              <button className="ve-side-sub" onClick={openPicker}>
                Import
              </button>
            )}
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
            <div
              className={`ve-media-content${dropping ? " dropping" : ""}`}
              onDragOver={onDragOver}
              onDragLeave={() => setDropping(false)}
              onDrop={onDrop}
            >
              <div className="ve-m-toolbar">
                <button className="ve-import" onClick={openPicker}>
                  <IconCirclePlus size={12} strokeWidth={2} />
                  <span>Import</span>
                </button>
                <div className="ve-m-right">
                  <label className="ve-all">
                    <select
                      aria-label="Filter media"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as Filter)}
                    >
                      <option value="all">All</option>
                      <option value="video">Video</option>
                      <option value="image">Photo</option>
                      <option value="audio">Audio</option>
                    </select>
                    <Filter size={11} strokeWidth={1.8} />
                  </label>
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

              <StorageTip hasImports={hasImports} />

              {items.length === 0 ? (
                <div className="ve-empty">
                  {assets.length === 0
                    ? "Tap Import to add videos, photos or audio from your device."
                    : "Nothing of this type yet."}
                </div>
              ) : view === "grid" ? (
                <div className="ve-grid ve-hide-sb">
                  {items.map((m) => (
                    <div
                      key={m.id}
                      className={`ve-item${picked === m.id ? " picked" : ""}`}
                      onClick={() => setPicked(m.id)}
                    >
                      <div className="ve-thumb">
                        <AssetArt asset={m} />
                        {m.kind !== "image" && <span className="ve-dur">{dur(m)}</span>}
                        {tileActions(m)}
                      </div>
                      <div className="ve-label">{m.name}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ve-list ve-hide-sb">
                  {items.map((m) => (
                    <div
                      key={m.id}
                      className={`ve-lrow${picked === m.id ? " picked" : ""}`}
                      onClick={() => setPicked(m.id)}
                    >
                      <div className="ve-lthumb">
                        <AssetArt asset={m} />
                      </div>
                      <div className="ve-lmeta">
                        <span className="ve-lname">{m.name}</span>
                        <span className="ve-ldur">{m.kind === "image" ? "Photo" : dur(m)}</span>
                      </div>
                      <div className="ve-lacts">{tileActions(m)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {dialogAsset && (
        <AssetDialog
          asset={dialogAsset}
          onClose={() => setDialogFor(null)}
          onAdd={() => addToTimeline(dialogAsset)}
        />
      )}
    </section>
  );
}
