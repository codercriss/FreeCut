import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { PlaybackProvider } from "../engine/playback";
import Home from "../home/Home";
import { defaultSelection, projectDuration } from "../model/selectors";
import { initTheme } from "./theme";
import "../styles/theme.css";
import "../styles/app.css";
import "../styles/transitions.css";
import { setSelection } from "../store/editorStore";
import { useProject, useProjectStore } from "../store/ProjectContext";
import { boot } from "./boot";
import type { BootResult } from "./bootstrap";
import { CrashScreen, ErrorBoundary } from "./ErrorBoundary";
import { NavContext } from "./NavContext";
import { useIsMobile, type LayoutMode } from "./useIsMobile";
import { useScreenRouter } from "./useScreenRouter";

// The editor (and its CSS) is a separate chunk: Home paints without it, and we fetch it while Home is idle.
const loadEditor = () => import("../editor/Editor");
const Editor = lazy(loadEditor);

function EditorHost({ layout }: { layout: LayoutMode }) {
  const fps = useProject((p) => p.settings.fps);
  const total = useProject(projectDuration);
  return (
    <PlaybackProvider fps={fps} totalFrames={total} autoPlay={false}>
      <Editor layout={layout} />
    </PlaybackProvider>
  );
}

function useBoot(bootFn: () => Promise<BootResult>): BootResult | null {
  const [result, setResult] = useState<BootResult | null>(null);
  useEffect(() => {
    let live = true;
    void bootFn().then((r) => live && setResult(r));
    return () => {
      live = false;
    };
  }, [bootFn]);
  return result;
}

interface AppProps {
  /** "auto" switches to the phone layout below 820 px. */
  layout?: LayoutMode;
  /** Injectable for tests. */
  bootFn?: () => Promise<BootResult>;
}

export default function App({ layout = "auto", bootFn = boot }: AppProps) {
  const mobile = useIsMobile(layout);
  const store = useProjectStore();
  const booted = useBoot(bootFn);
  const [warningDismissed, setWarningDismissed] = useState(false);

  const enterEditor = useCallback(
    () => setSelection(defaultSelection(store.getProject())),
    [store],
  );
  const { screen, leaving, nav, openEditor } = useScreenRouter(enterEditor);

  // Appearance (Me → Appearance): index.html has already set <html data-theme> before the first
  // paint; this keeps it — and the browser chrome (color-scheme / theme-color) — up to date.
  useEffect(() => initTheme(), []);

  // Warm the editor chunk once Home is on screen and the browser is idle.
  useEffect(() => {
    if (!booted) return undefined;
    const ric = window.requestIdleCallback;
    if (ric) {
      const id = ric(() => void loadEditor());
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(() => void loadEditor(), 1200);
    return () => clearTimeout(t);
  }, [booted]);

  if (!booted) return <div className="fc-boot" aria-busy="true" />;

  const moving = leaving !== null;
  const layerProps = (name: "home" | "editor") => ({
    className: `fc-layer fc-${name}${mobile ? " fc-m" : ""}${moving ? (screen === name ? " fc-in" : " fc-out") : ""}`,
    "aria-hidden": moving && screen !== name ? true : undefined,
  });

  return (
    <NavContext.Provider value={nav}>
      {booted.warning && !warningDismissed && (
        <div className="fc-warn" role="alert">
          <span>{booted.warning}</span>
          <button onClick={() => setWarningDismissed(true)}>Dismiss</button>
        </div>
      )}
      {(screen === "home" || leaving === "home") && (
        <div key="home" {...layerProps("home")}>
          <Home mobile={mobile} onOpen={openEditor} />
        </div>
      )}
      {(screen === "editor" || leaving === "editor") && (
        <div key="editor" {...layerProps("editor")}>
          <ErrorBoundary
            fallback={(error, reset) => (
              <CrashScreen error={error} onReset={reset} onHome={nav.goHome} />
            )}
          >
            <Suspense fallback={<div className="fc-boot" aria-busy="true" />}>
              <EditorHost layout={layout} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}
    </NavContext.Provider>
  );
}
