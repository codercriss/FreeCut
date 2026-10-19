// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { clip, makeHarness } from "../test/harness";
import { editorStore, setSelection } from "../store/editorStore";
import { PropertiesPanel } from "./PropertiesPanel";

beforeEach(() => setSelection(["clip-main"]));
const slider = (name: string) => screen.getByRole("slider", { name });

describe("PropertiesPanel — bound to the selected clip", () => {
  it("shows the clip's real values", () => {
    const { store, wrap } = makeHarness();
    store.execute({
      type: "t",
      label: "t",
      apply: (p) => ({
        ...p,
        clips: p.clips.map((c) => (c.id === "clip-main" ? { ...c, opacity: 64 } : c)),
      }),
    });
    render(wrap(<PropertiesPanel />));
    expect(slider("Opacity").getAttribute("aria-valuenow")).toBe("64");
    expect(screen.getByText("64%")).toBeTruthy();
  });

  it("keyboard on a slider edits the model; a burst is ONE undo step", () => {
    const { store, wrap } = makeHarness();
    render(wrap(<PropertiesPanel />));
    const el = slider("Opacity");
    fireEvent.keyDown(el, { key: "ArrowLeft" });
    fireEvent.keyDown(el, { key: "ArrowLeft" });
    fireEvent.keyDown(el, { key: "ArrowLeft", shiftKey: true });
    expect(clip(store).opacity).toBe(88);
    expect(store.getState().past).toHaveLength(1);
    store.undo();
    expect(clip(store).opacity).toBe(100);
  });

  it("the ▲▼ steppers edit the model", () => {
    const { store, wrap } = makeHarness();
    render(wrap(<PropertiesPanel />));
    fireEvent.click(screen.getByRole("button", { name: "Decrease zoom" }));
    expect(clip(store).transform.zoom).toBe(49);
    fireEvent.click(screen.getByRole("button", { name: "Increase filter strength" }));
    expect(clip(store).filter!.strength).toBe(51);
  });

  it("section checkboxes switch a section off/on (and dim it)", () => {
    const { store, wrap } = makeHarness();
    const { container } = render(wrap(<PropertiesPanel />));
    fireEvent.click(screen.getByRole("button", { name: "Effects enabled" }));
    expect(clip(store).sections.effects).toBe(false);
    expect(container.querySelectorAll(".ve-sec.off")).toHaveLength(1);
    act(() => void store.undo());
    expect(clip(store).sections.effects).toBe(true);
    expect(container.querySelectorAll(".ve-sec.off")).toHaveLength(0);
  });

  it("removes an effect, and the section's reset button restores it", () => {
    const { store, wrap } = makeHarness();
    render(wrap(<PropertiesPanel />));
    fireEvent.click(screen.getByRole("button", { name: "Remove Motion Blur" }));
    expect(clip(store).effects).toEqual([]);
    expect(screen.queryByText("Motion Blur")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset Effects" }));
    expect(clip(store).effects.map((e) => e.name)).toEqual(["Motion Blur"]);
  });

  it("reset restores a section's defaults", () => {
    const { store, wrap } = makeHarness();
    render(wrap(<PropertiesPanel />));
    fireEvent.keyDown(slider("Opacity"), { key: "End" });
    fireEvent.keyDown(slider("Opacity"), { key: "Home" });
    expect(clip(store).opacity).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Reset Blend" }));
    expect(clip(store).opacity).toBe(100);
  });

  it("asks for a selection when nothing is selected, and follows the selection", () => {
    const { store, wrap } = makeHarness();
    render(wrap(<PropertiesPanel />));
    act(() => setSelection([]));
    expect(screen.getByText("Select a clip to edit its properties")).toBeTruthy();
    expect(editorStore.getState().selectedClipIds).toEqual([]);
    act(() => setSelection(["clip-audio"]));
    expect(screen.getByText("None")).toBeTruthy(); // now showing the audio clip (no filter)
    expect(clip(store, "clip-audio").filter).toBeNull();
  });

  it("an audio clip (no filter) shows 'None' and ignores filter edits", () => {
    const { store, wrap } = makeHarness();
    setSelection(["clip-audio"]);
    render(wrap(<PropertiesPanel />));
    expect(screen.getByText("None")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Increase filter strength" }));
    expect(clip(store, "clip-audio").filter).toBeNull();
    expect(store.getState().past).toHaveLength(0);
  });

  it("other tabs show a placeholder", () => {
    const { wrap } = makeHarness();
    render(wrap(<PropertiesPanel />));
    fireEvent.click(screen.getByRole("button", { name: "Speed" }));
    expect(screen.getByText("Nothing to adjust in Speed yet")).toBeTruthy();
  });
});
