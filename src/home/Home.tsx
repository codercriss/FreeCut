import {
  Activity,
  Camera,
  Eraser,
  Film,
  Folder,
  Home as HomeIcon,
  LayoutTemplate,
  Mic,
  Plus,
  Play,
  RotateCcw,
  Scissors,
  Type,
  Upload,
  User,
  Wand2,
  WifiOff,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { BRAND_NAME } from "../app/brand";
import type { LaunchOptions } from "../app/NavContext";
import { projectDuration } from "../model/selectors";
import { mmss } from "../model/time";
import { saveStatusStore } from "../storage/autosave";
import { useStore } from "../store/createStore";
import { useProject } from "../store/ProjectContext";
import { BrandMark } from "../ui/BrandMark";
import { resetDemoProject } from "../app/actions";
import "../styles/home.css";
import { Scene } from "./HeroScenes";
import { useOpenPick } from "./heroPick";

// The Phase 1b.0 device check is only fetched when someone opens it from the Me tab.
const PlaybackCheckPanel = lazy(() => import("./PlaybackCheckPanel"));

/* ════════════════════════════════════════════════════════════════════
   Startup / home screen. Two layouts:
   · mobile  — full-bleed hero, two big actions, recent row, tool grid, bottom tab bar
   · desktop — sidebar hub (nav, "start creating" banner, quick start, project grid)
   <Home mobile onOpen> — onOpen({ sheet: "media" }?) opens the editor.
   The hero scene + headline rotation lives in heroPick.ts; the scenes in HeroScenes.tsx.
   ════════════════════════════════════════════════════════════════════ */

type OpenFn = (opts?: LaunchOptions) => void;

/** The card on Home reflects the real project (name, length, whether it's safely saved). */
function useProjectSummary() {
  const title = useProject((p) => p.name);
  const seconds = useProject((p) => Math.floor(projectDuration(p) / p.settings.fps));
  const state = useStore(saveStatusStore, (s) => s.state);
  const meta = state === "unavailable" ? "Not saved (storage unavailable)" : "Saved on this device";
  return { title, dur: mmss(seconds), meta };
}

/** Two-tap "Reset demo project" (replaces the saved project with a fresh sample). */
function ResetDemoButton({ className }: { className?: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      className={className}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        resetDemoProject();
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? "Tap again to confirm reset" : "Reset demo project"}
    </button>
  );
}

const TOOLS = [
  { id: "captions", label: "Auto captions", Icon: Type },
  { id: "voice", label: "Voiceover", Icon: Mic },
  { id: "cut", label: "Quick cut", Icon: Scissors },
  { id: "bg", label: "Remove background", Icon: Eraser },
  { id: "enhance", label: "Auto enhance", Icon: Wand2 },
  { id: "record", label: "Shoot and record", Icon: Camera },
];

const TEMPLATES = [
  { name: "Dusk reel", a: "#1b2a6b", b: "#f0a867", fg: "#fff" },
  { name: "Neon night", a: "#3b0a5e", b: "#12c6d8", fg: "#fff" },
  { name: "Soft film", a: "#4a3b32", b: "#d9b99b", fg: "#fff" },
  { name: "Bold title", a: "#16161a", b: "#ff5d5d", fg: "#fff" },
  { name: "Fresh cut", a: "#0b5d3b", b: "#9be15d", fg: "#fff" },
  { name: "Paper", a: "#e9e4d8", b: "#9aa7b5", fg: "#1c2430" },
];

/* ───────────── shared pieces ───────────── */
function ProjectCard({ onOpen }: { onOpen: OpenFn }) {
  const proj = useProjectSummary();
  return (
    <button className="hm-proj" onClick={() => onOpen()} aria-label={`Open ${proj.title}`}>
      <span className="hm-thumb">
        <Scene />
        <span className="hm-dur">{proj.dur}</span>
        <span className="hm-hover">
          <span className="hm-playc">
            <Play size={18} fill="currentColor" strokeWidth={0} />
          </span>
        </span>
      </span>
      <span className="hm-pt">{proj.title}</span>
      <span className="hm-pm">{proj.meta}</span>
    </button>
  );
}

function NewSlot({ onOpen, label = "New video" }: { onOpen: OpenFn; label?: string }) {
  return (
    <button className="hm-proj hm-newslot" onClick={() => onOpen()} aria-label={label}>
      <span className="hm-slot">
        <Plus size={20} strokeWidth={2} />
      </span>
      <span className="hm-pt">{label}</span>
      <span className="hm-pm">Start from scratch</span>
    </button>
  );
}

function TemplateGrid({ onOpen }: { onOpen: OpenFn }) {
  return (
    <>
      <p className="hm-note">Templates are on the way. Tap a style to start a blank project.</p>
      <div className="hm-tgrid">
        {TEMPLATES.map((t) => (
          <button
            key={t.name}
            className="hm-tpl"
            style={{ background: `linear-gradient(160deg, ${t.a}, ${t.b})`, color: t.fg }}
            onClick={() => onOpen()}
          >
            <Film size={16} strokeWidth={1.9} />
            <span>{t.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function ToolTiles({
  onOpen,
  className,
  tile,
}: {
  onOpen: OpenFn;
  className: string;
  tile: string;
}) {
  return (
    <div className={className}>
      {TOOLS.map(({ id, label, Icon }) => (
        <button key={id} className={tile} onClick={() => onOpen()}>
          <i>
            <Icon size={tile === "hm-tool" ? 23 : 17} strokeWidth={1.8} />
          </i>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ───────────── mobile ───────────── */
const TABS = [
  { id: "edit", label: "Edit", Icon: Scissors },
  { id: "templates", label: "Templates", Icon: LayoutTemplate },
  { id: "projects", label: "Projects", Icon: Folder },
  { id: "me", label: "Me", Icon: User },
];

function MobileHome({ onOpen }: { onOpen: OpenFn }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("edit");
  const [checkOpen, setCheckOpen] = useState(false);
  const [pick, fresh] = useOpenPick();
  return (
    <div className="hm hm-m">
      <div className="hm-scroll" key={tab}>
        <div className="hm-frame">
          {tab === "edit" && (
            <>
              <section className="hm-hero">
                <Scene
                  key={pick.scene}
                  variant={pick.scene}
                  live
                  className={fresh ? "hm-swap" : ""}
                />
                <div className="hm-hero-top hm-pad">
                  <span className="hm-pill">
                    <WifiOff size={13} strokeWidth={2.2} />
                    Works offline
                  </span>
                  <button className="hm-round" onClick={() => setTab("me")} aria-label="Me">
                    <User size={18} strokeWidth={2} />
                  </button>
                </div>
                <div className="hm-hero-text hm-pad">
                  <h1 className={"hm-h1" + (fresh ? " hm-swap" : "")} key={pick.h}>
                    {pick.headline.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h1>
                  <p className="hm-sub">Free, and it works without a connection.</p>
                </div>
              </section>

              <div className="hm-pad">
                <div className="hm-actions">
                  <button className="hm-card hm-card-main" onClick={() => onOpen()}>
                    <i>
                      <Plus size={22} strokeWidth={2.4} />
                    </i>
                    <span>New video</span>
                  </button>
                  <button className="hm-card" onClick={() => onOpen({ sheet: "media" })}>
                    <i>
                      <Upload size={19} strokeWidth={2.1} />
                    </i>
                    <span>Import media</span>
                  </button>
                </div>

                <div className="hm-sec">
                  <h2>Recent</h2>
                  <button onClick={() => setTab("projects")}>See all</button>
                </div>
                <div className="hm-row hm-bleed">
                  <ProjectCard onOpen={onOpen} />
                  <NewSlot onOpen={onOpen} />
                </div>

                <div className="hm-sec">
                  <h2>Tools</h2>
                </div>
                <ToolTiles onOpen={onOpen} className="hm-tools" tile="hm-tool" />
                <div className="hm-end" />
              </div>
            </>
          )}

          {tab === "templates" && (
            <div className="hm-pad hm-page">
              <h1 className="hm-ph1">Templates</h1>
              <TemplateGrid onOpen={onOpen} />
              <div className="hm-end" />
            </div>
          )}

          {tab === "projects" && (
            <div className="hm-pad hm-page">
              <h1 className="hm-ph1">Projects</h1>
              <div className="hm-pgrid">
                <ProjectCard onOpen={onOpen} />
                <NewSlot onOpen={onOpen} />
              </div>
              <div className="hm-end" />
            </div>
          )}

          {tab === "me" && (
            <div className="hm-pad hm-page">
              <h1 className="hm-ph1">Me</h1>
              <div className="hm-who">
                <span className="hm-avatar">
                  <BrandMark size={24} />
                </span>
                <div>
                  <strong>Guest</strong>
                  <span>Projects stay on this device</span>
                </div>
              </div>
              <ul className="hm-list">
                <li>
                  <WifiOff size={18} strokeWidth={1.9} />
                  <span>Works offline</span>
                  <em>On</em>
                </li>
                <li>
                  <Folder size={18} strokeWidth={1.9} />
                  <span>Storage</span>
                  <em>This device</em>
                </li>
                <li>
                  <Film size={18} strokeWidth={1.9} />
                  <span>About {BRAND_NAME}</span>
                  <em>v{__APP_VERSION__}</em>
                </li>
                <li className="hm-li-action">
                  <Activity size={18} strokeWidth={1.9} />
                  <button
                    className="hm-reset"
                    onClick={() => setCheckOpen((open) => !open)}
                    aria-expanded={checkOpen}
                  >
                    Playback check
                  </button>
                </li>
                <li className="hm-li-action">
                  <RotateCcw size={18} strokeWidth={1.9} />
                  <ResetDemoButton className="hm-reset" />
                </li>
              </ul>
              {checkOpen && (
                <Suspense fallback={null}>
                  <PlaybackCheckPanel />
                </Suspense>
              )}
              <div className="hm-end" />
            </div>
          )}
        </div>
      </div>

      <nav className="hm-tabs" aria-label="Main">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`hm-tab${tab === id ? " on" : ""}`}
            onClick={() => setTab(id)}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ───────────── desktop ───────────── */
const SIDE = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "templates", label: "Templates", Icon: LayoutTemplate },
  { id: "projects", label: "Projects", Icon: Folder },
];

function DesktopHome({ onOpen }: { onOpen: OpenFn }) {
  const [view, setView] = useState<(typeof SIDE)[number]["id"]>("home");
  const [pick, fresh] = useOpenPick();
  return (
    <div className="hm hm-d">
      <aside className="hm-side">
        <div className="hm-brand">
          <BrandMark size={20} />
          <span>{BRAND_NAME}</span>
        </div>
        <nav className="hm-nav" aria-label="Main">
          {SIDE.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={view === id ? "on" : ""}
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={17} strokeWidth={1.9} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="hm-sidefoot">
          <WifiOff size={14} strokeWidth={2} />
          <span>Works offline</span>
        </div>
        <ResetDemoButton className="hm-reset hm-reset-side" />
      </aside>

      <main className="hm-main" key={view}>
        <div className="hm-inner">
          {view === "home" && (
            <>
              <section className="hm-dhero">
                <Scene
                  key={pick.scene}
                  variant={pick.scene}
                  live
                  className={fresh ? "hm-swap" : ""}
                />
                <div className="hm-dhero-text">
                  <h1 className={fresh ? "hm-swap" : ""} key={pick.h}>
                    {pick.headline.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </h1>
                  <p>Free, and it works without a connection.</p>
                  <div className="hm-btns">
                    <button className="hm-btn hm-btn-main" onClick={() => onOpen()}>
                      <Plus size={17} strokeWidth={2.4} />
                      New project
                    </button>
                    <button className="hm-btn" onClick={() => onOpen({ sheet: "media" })}>
                      <Upload size={16} strokeWidth={2.1} />
                      Import media
                    </button>
                  </div>
                </div>
              </section>

              <div className="hm-dsec">
                <h2>Quick start</h2>
              </div>
              <ToolTiles onOpen={onOpen} className="hm-quick" tile="hm-qt" />

              <div className="hm-dsec">
                <h2>Recent projects</h2>
              </div>
              <div className="hm-grid">
                <NewSlot onOpen={onOpen} label="New project" />
                <ProjectCard onOpen={onOpen} />
              </div>
            </>
          )}

          {view === "templates" && (
            <>
              <div className="hm-dsec hm-first">
                <h2>Templates</h2>
              </div>
              <TemplateGrid onOpen={onOpen} />
            </>
          )}

          {view === "projects" && (
            <>
              <div className="hm-dsec hm-first">
                <h2>Projects</h2>
              </div>
              <div className="hm-grid">
                <NewSlot onOpen={onOpen} label="New project" />
                <ProjectCard onOpen={onOpen} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home({ mobile, onOpen }: { mobile: boolean; onOpen: OpenFn }) {
  return mobile ? <MobileHome onOpen={onOpen} /> : <DesktopHome onOpen={onOpen} />;
}
