// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clip, makeHarness, track } from "../../test/harness";
import { prefsStore } from "../../store/prefsStore";
import { editorStore, setSelection } from "../../store/editorStore";
import { useUndoRedoShortcuts } from "../shortcuts";
import { MobileTimeline } from "./MobileTimeline";
import { Timeline } from "./Timeline";

beforeEach(() => {
  setSelection(["clip-main"]);
  prefsStore.setState((p) => ({ ...p, magnet: false, snap: true, link: false, axis: false }));
});

describe("desktop Timeline — driven by the project model", () => {
  it("renders one clip per model clip, positioned from the shared time scale", () => {
    const { wrap } = makeHarness();
    const { container } = render(wrap(<Timeline />));
    const main = container.querySelector<HTMLElement>('[data-clip-id="clip-main"]')!;
    const audio = container.querySelector<HTMLElement>('[data-clip-id="clip-audio"]')!;
    expect(Math.round(parseFloat(main.style.width))).toBe(624);
    expect(Math.round(parseFloat(main.style.left))).toBe(0);
    expect(Math.round(parseFloat(audio.style.left))).toBe(117);
    expect(Math.round(parseFloat(audio.style.width))).toBe(224);
  });

  it("puts the playhead where the timecode says (K1b)", () => {
    const { wrap } = makeHarness();
    const { container } = render(wrap(<Timeline />));
    const playhead = container.querySelector<HTMLElement>(".ve-playhead")!;
    expect(parseFloat(playhead.style.left)).toBeCloseTo((165 / 60) * 22.3, 3);
  });

  it("mute toggles the model, and Undo / Redo buttons reverse it", () => {
    const { store, wrap } = makeHarness();
    render(wrap(<Timeline />));
    const undo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    const redo = screen.getByRole("button", { name: "Redo" }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect(redo.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Mute clip" }));
    expect(track(store, "track-main").muted).toBe(true);
    expect(screen.getByRole("button", { name: "Mute clip" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(undo.disabled).toBe(false);

    fireEvent.click(undo);
    expect(track(store, "track-main").muted).toBe(false);
    expect(redo.disabled).toBe(false);
    fireEvent.click(redo);
    expect(track(store, "track-main").muted).toBe(true);
  });

  it("the audio track mutes independently of the main track", () => {
    const { store, wrap } = makeHarness();
    render(wrap(<Timeline />));
    fireEvent.click(screen.getByRole("button", { name: "Mute audio track" }));
    expect(track(store, "track-audio-1").muted).toBe(true);
    expect(track(store, "track-main").muted).toBe(false);
  });

  it("clicking a clip toggles its selection", () => {
    const { wrap } = makeHarness();
    const { container } = render(wrap(<Timeline />));
    const audio = container.querySelector<HTMLElement>('[data-clip-id="clip-audio"]')!;
    fireEvent.click(audio);
    expect(editorStore.getState().selectedClipIds).toEqual(["clip-audio"]);
    fireEvent.click(audio);
    expect(editorStore.getState().selectedClipIds).toEqual([]);
  });

  it("toggle buttons update (and remember) editor preferences", () => {
    const { wrap } = makeHarness();
    render(wrap(<Timeline />));
    const magnet = screen.getByTitle("Main track magnet");
    fireEvent.click(magnet);
    expect(prefsStore.getState().magnet).toBe(true);
    expect(JSON.parse(localStorage.getItem("freecut.prefs")!).magnet).toBe(true);
    expect(magnet.getAttribute("aria-pressed")).toBe("true");
  });

  it("zoom scales clip widths", () => {
    const { wrap } = makeHarness();
    const { container } = render(wrap(<Timeline />));
    const w = () =>
      parseFloat(container.querySelector<HTMLElement>('[data-clip-id="clip-main"]')!.style.width);
    const before = w();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(w()).toBeGreaterThan(before);
  });
});

describe("keyboard undo/redo", () => {
  function Host() {
    useUndoRedoShortcuts();
    return null;
  }
  it("Ctrl+Z undoes, Ctrl+Shift+Z and Ctrl+Y redo, and typing in a field is left alone", () => {
    const { store, wrap } = makeHarness();
    render(
      wrap(
        <>
          <Host />
          <input aria-label="name" />
        </>,
      ),
    );
    store.execute({ type: "t", label: "t", apply: (p) => ({ ...p, name: "Edited" }) });
    act(() => void fireEvent.keyDown(window, { key: "z", ctrlKey: true }));
    expect(store.getProject().name).toBe("This is a title");
    act(() => void fireEvent.keyDown(window, { key: "Z", ctrlKey: true, shiftKey: true }));
    expect(store.getProject().name).toBe("Edited");
    act(() => void fireEvent.keyDown(window, { key: "z", metaKey: true }));
    act(() => void fireEvent.keyDown(window, { key: "y", ctrlKey: true }));
    expect(store.getProject().name).toBe("Edited");
    // in a text field → the browser's own undo must win
    act(() => void fireEvent.keyDown(screen.getByLabelText("name"), { key: "z", ctrlKey: true }));
    expect(store.getProject().name).toBe("Edited");
  });
});

describe("phone MobileTimeline", () => {
  it("hides the empty overlay track, and shows the same clips from the same model", () => {
    const { store, wrap } = makeHarness();
    const { container } = render(wrap(<MobileTimeline onAdd={() => {}} />));
    expect(container.querySelectorAll("[data-clip-id]")).toHaveLength(2);
    expect(container.querySelectorAll(".ve-mob-head")).toHaveLength(2); // main + audio only
    expect(clip(store, "clip-main").trackId).toBe("track-main");
    const main = container.querySelector<HTMLElement>('[data-clip-id="clip-main"]')!;
    expect(parseFloat(main.style.width)).toBeCloseTo((1678 / 60) * 28, 3); // contentW = duration × pps
    expect(parseFloat(main.style.top)).toBe(34); // M_MAIN_TOP + 4
  });
  it("mute works on the phone too, through the same command", () => {
    const { store, wrap } = makeHarness();
    render(wrap(<MobileTimeline onAdd={() => {}} />));
    fireEvent.click(screen.getByRole("button", { name: "Mute clip" }));
    expect(track(store, "track-main").muted).toBe(true);
    act(() => void store.undo());
    expect(track(store, "track-main").muted).toBe(false);
  });
  it("calls onAdd from the + button", () => {
    const { wrap } = makeHarness();
    let n = 0;
    render(wrap(<MobileTimeline onAdd={() => n++} />));
    fireEvent.click(screen.getByRole("button", { name: "Add clip" }));
    expect(n).toBe(1);
  });
});
