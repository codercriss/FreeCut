import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { clipById } from "../model/selectors";
import type { Clip, ClipSection } from "../model/types";
import { editorStore } from "../store/editorStore";
import {
  removeClipEffect,
  resetClipSection,
  setClipOpacity,
  setClipSectionEnabled,
  setClipZoom,
  setFilterStrength,
} from "../store/commands";
import { useStore } from "../store/createStore";
import { useProject, useProjectStore } from "../store/ProjectContext";
import { KeyframeButton, NumberBox, Row, SectionHead, Slider } from "../ui/controls";

/* ───────────── properties ───────────── */
const PROP_TABS = ["Video", "Audio", "Speed", "Animate", "Adjust", "AI stylize"] as const;
const SUB_TABS = ["Basic", "Cutout", "Mask", "Canvas"] as const;

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The first selected clip, or undefined. */
function useSelectedClip(): Clip | undefined {
  const id = useStore(editorStore, (s) => s.selectedClipIds[0]);
  return useProject((p) => (id ? clipById(p, id) : undefined));
}

export function PropertiesPanel() {
  const store = useProjectStore();
  const clip = useSelectedClip();
  const [tab, setTab] = useState<(typeof PROP_TABS)[number]>("Video");
  const [sub, setSub] = useState<(typeof SUB_TABS)[number]>("Basic");
  const [shut, setShut] = useState(false);

  const showBasic = tab === "Video" && sub === "Basic";

  return (
    <section className="ve-panel ve-props" aria-label="Properties">
      <nav className="ve-rtabs ve-hide-sb">
        {PROP_TABS.map((t) => (
          <button key={t} className={`ve-rtab${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {tab === "Video" && (
        <div className="ve-subtabs">
          {SUB_TABS.map((t) => (
            <button
              key={t}
              className={`ve-subtab${sub === t ? " on" : ""}`}
              onClick={() => setSub(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {!showBasic ? (
        <div className="ve-empty">Nothing to adjust in {tab === "Video" ? sub : tab} yet</div>
      ) : !clip ? (
        <div className="ve-empty">Select a clip to edit its properties</div>
      ) : (
        <ClipBasic
          clip={clip}
          shut={shut}
          onShut={() => setShut((s) => !s)}
          run={(c) => store.execute(c)}
        />
      )}
    </section>
  );
}

interface BasicProps {
  clip: Clip;
  shut: boolean;
  onShut: () => void;
  run: (cmd: ReturnType<typeof setClipOpacity>) => void;
}

function ClipBasic({ clip, shut, onShut, run }: BasicProps) {
  const id = clip.id;
  const on = clip.sections;
  const flip = (s: ClipSection) => run(setClipSectionEnabled(id, s, !on[s]));
  const reset = (s: ClipSection) => run(resetClipSection(id, s));
  const strength = clip.filter?.strength ?? 0;
  const zoom = clip.transform.zoom;
  const opacity = clip.opacity;

  return (
    <div className="ve-rbody ve-hide-sb">
      {/* Filters */}
      <div className={`ve-sec${on.filters ? "" : " off"}`}>
        <SectionHead
          label="Filters"
          checked={on.filters}
          onToggle={() => flip("filters")}
          onReset={() => reset("filters")}
        />
        <div className="ve-sec-body">
          <Row label="Name">
            <span className="ve-val">{clip.filter?.name ?? "None"}</span>
          </Row>
          <Row label="Strength">
            <Slider
              label="Filter strength"
              value={strength}
              onChange={(v) => run(setFilterStrength(id, v))}
            />
            <NumberBox
              label="filter strength"
              text={`${strength}%`}
              onUp={() => run(setFilterStrength(id, strength + 1))}
              onDown={() => run(setFilterStrength(id, strength - 1))}
            />
            <KeyframeButton />
          </Row>
        </div>
      </div>

      {/* Effects */}
      <div className={`ve-sec${on.effects ? "" : " off"}`}>
        <SectionHead
          label="Effects"
          checked={on.effects}
          onToggle={() => flip("effects")}
          onReset={() => reset("effects")}
        />
        <div className="ve-sec-body">
          {clip.effects.map((fx, i) => (
            <Row key={fx.id} label={`NO ${i + 1}`}>
              <span className="ve-val strong">{fx.name}</span>
              <button className="ve-mini" aria-label={`Edit ${fx.name}`}>
                <Pencil size={10} strokeWidth={1.9} />
              </button>
              <button
                className="ve-mini"
                aria-label={`Remove ${fx.name}`}
                onClick={() => run(removeClipEffect(id, fx.id))}
              >
                <Trash2 size={10} strokeWidth={1.9} />
              </button>
            </Row>
          ))}
        </div>
      </div>

      {/* Position & Size */}
      <div className={`ve-sec${on.transform ? "" : " off"}`}>
        <SectionHead
          label="Position & Size"
          checked={on.transform}
          onToggle={() => flip("transform")}
          onReset={() => reset("transform")}
          caret
          open={!shut}
          onCaret={onShut}
        />
        {!shut && (
          <div className="ve-sec-body">
            <Row label="Zoom">
              <Slider label="Zoom" value={zoom} onChange={(v) => run(setClipZoom(id, v))} />
              <NumberBox
                label="zoom"
                text={`${zoom}%`}
                onUp={() => run(setClipZoom(id, zoom + 1))}
                onDown={() => run(setClipZoom(id, zoom - 1))}
              />
              <KeyframeButton />
            </Row>
            <Row label="Position">
              <div className="ve-xy">
                <b>X</b>
                <span>{clip.transform.x}</span>
              </div>
              <div className="ve-xy">
                <b>Y</b>
                <span>{clip.transform.y}</span>
              </div>
              <KeyframeButton />
            </Row>
            <Row label="Rotate">
              <div className="ve-xy wide">
                <span>{clip.transform.rotation}°</span>
              </div>
              <KeyframeButton />
            </Row>
          </div>
        )}
      </div>

      {/* Blend */}
      <div className={`ve-sec${on.blend ? "" : " off"}`}>
        <SectionHead
          label="Blend"
          checked={on.blend}
          onToggle={() => flip("blend")}
          onReset={() => reset("blend")}
        />
        <div className="ve-sec-body">
          <Row label="Mode">
            <button className="ve-select-field">
              <span>{titleCase(clip.blend)}</span>
              <ChevronDown size={10} strokeWidth={2} />
            </button>
          </Row>
          <Row label="Opacity">
            <Slider label="Opacity" value={opacity} onChange={(v) => run(setClipOpacity(id, v))} />
            <NumberBox
              label="opacity"
              text={`${opacity}%`}
              onUp={() => run(setClipOpacity(id, opacity + 1))}
              onDown={() => run(setClipOpacity(id, opacity - 1))}
            />
            <KeyframeButton />
          </Row>
        </div>
      </div>
    </div>
  );
}
