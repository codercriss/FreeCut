// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSampleProject } from "../model/sample";
import { ProjectStoreProvider } from "../store/ProjectContext";
import { createProjectStore } from "../store/projectStore";
import App from "./App";
import type { BootResult } from "./bootstrap";
import { CrashScreen, ErrorBoundary } from "./ErrorBoundary";

function mount(boot?: Partial<BootResult>) {
  const store = createProjectStore(createSampleProject(1));
  const bootFn = async (): Promise<BootResult> => ({
    source: "created",
    project: store.getProject(),
    ...boot,
  });
  const utils = render(
    <ProjectStoreProvider store={store}>
      <App layout="desktop" bootFn={bootFn} />
    </ProjectStoreProvider>,
  );
  return { store, ...utils };
}

beforeEach(() => window.history.replaceState(null, ""));
afterEach(() => vi.restoreAllMocks());

describe("App smoke test (jsdom)", () => {
  it("boots to Home, opens the editor, edits, undoes, and returns Home", async () => {
    const { store } = mount();

    // Home
    fireEvent.click((await screen.findAllByRole("button", { name: "New project" }))[0]);

    // Editor (lazy chunk) with the project's real title and a truthful save indicator
    const back = await screen.findByRole("button", { name: "Back to home" }, { timeout: 5000 });
    expect(back).toBeTruthy();
    expect(screen.getByText("This is a title", { selector: ".ve-doc-title" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", true);

    // The default selection is the main clip → Properties show its values
    expect(screen.getByRole("slider", { name: "Opacity" }).getAttribute("aria-valuenow")).toBe(
      "100",
    );

    // Edit → undo
    fireEvent.click(screen.getByRole("button", { name: "Mute clip" }));
    expect(store.getProject().tracks.find((t) => t.id === "track-main")!.muted).toBe(true);
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(store.getProject().tracks.find((t) => t.id === "track-main")!.muted).toBe(false);

    // The editor opens paused at the start; Play / Pause toggle
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getAllByText("00:00:00:00").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();

    // Back to Home through the History API
    act(() => void window.dispatchEvent(new PopStateEvent("popstate", { state: null })));
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "New project" }).length).toBeGreaterThan(0),
    );

    // Forward returns to the editor (Handover S1 regression, end-to-end)
    act(
      () =>
        void window.dispatchEvent(new PopStateEvent("popstate", { state: { freecut: "editor" } })),
    );
    expect(
      await screen.findByRole("button", { name: "Back to home" }, { timeout: 5000 }),
    ).toBeTruthy();
  });

  it("each time the editor opens, the main clip is selected again", async () => {
    mount();
    fireEvent.click((await screen.findAllByRole("button", { name: "New project" }))[0]);
    await screen.findByRole("button", { name: "Back to home" }, { timeout: 5000 });
    expect(
      document.querySelector('[data-clip-id="clip-main"]')!.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("shows a dismissible warning when the project could not be loaded or saved", async () => {
    mount({
      source: "unavailable",
      warning: "Storage is unavailable (private mode?). Changes will not be saved.",
    });
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("will not be saved"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders a blank boot screen until the project is ready", () => {
    const store = createProjectStore(createSampleProject(1));
    const { container } = render(
      <ProjectStoreProvider store={store}>
        <App layout="desktop" bootFn={() => new Promise(() => {})} />
      </ProjectStoreProvider>,
    );
    expect(container.querySelector(".fc-boot")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  });
});

describe("ErrorBoundary", () => {
  function Bomb({ explode }: { explode: boolean }) {
    if (explode) throw new Error("kaboom");
    return <p>fine</p>;
  }
  it("shows the crash screen instead of a blank page, and can recover", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let explode = true;
    const { rerender } = render(
      <ErrorBoundary fallback={(e, reset) => <CrashScreen error={e} onReset={reset} />}>
        <Bomb explode={explode} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("Something went wrong");
    expect(screen.getByText("kaboom")).toBeTruthy();
    expect(screen.getByText(/saved automatically/)).toBeTruthy();

    explode = false;
    rerender(
      <ErrorBoundary fallback={(e, reset) => <CrashScreen error={e} onReset={reset} />}>
        <Bomb explode={explode} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("fine")).toBeTruthy();
  });
});
