// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importMedia } from "../media/importer";
import type { Asset } from "../model/types";
import { addAssets } from "../store/commands";
import { editorStore, setSelection } from "../store/editorStore";
import { makeHarness } from "../test/harness";
import { MediaPanel } from "./MediaPanel";

vi.mock("../media/importer", () => ({
  importMedia: vi.fn(async () => ({ assets: [], failed: [] })),
}));

const imported = (
  id: string,
  kind: Asset["kind"],
  name: string,
  frames = 120,
  extra: Partial<Asset> = {},
): Asset => ({
  id,
  kind,
  name,
  durationFrames: frames,
  source: { type: "stored", mediaId: `m-${id}` },
  ...extra,
});

function setup() {
  const h = makeHarness();
  h.store.execute(
    addAssets([
      imported("v", "video", "Beach.mov", 600),
      imported("i", "image", "Sunset.heic", 300),
      imported("a", "audio", "Voice.m4a", 900, { peaks: [10, 50, 100, 30, 60, 20] }),
    ]),
  );
  const ui = render(h.wrap(<MediaPanel rail />));
  return { ...h, ...ui };
}

beforeEach(() => {
  vi.mocked(importMedia).mockClear();
  setSelection([]);
  localStorage.clear();
});

const tileNames = () =>
  Array.from(document.querySelectorAll(".ve-label")).map((e) => e.textContent);

describe("MediaPanel — library from the project", () => {
  it("lists every asset (demo + imported, all kinds) with durations, no duration on photos", () => {
    setup();
    expect(tileNames()).toEqual([
      "Moraine Lake.mov",
      "CRST001334.mov",
      "CRST001334.mov",
      "CRST001334.mov",
      "CRST001334.mov",
      "Audio.aac",
      "Beach.mov",
      "Sunset.heic",
      "Voice.m4a",
    ]);
    const beach = screen.getByText("Beach.mov").closest(".ve-item")!;
    expect(within(beach as HTMLElement).getByText("00:10")).toBeTruthy();
    const photo = screen.getByText("Sunset.heic").closest(".ve-item")!;
    expect(photo.querySelector(".ve-dur")).toBeNull();
  });

  it("shows an icon/waveform placeholder when there's no poster", () => {
    setup();
    expect(document.querySelectorAll(".ve-ph").length).toBeGreaterThanOrEqual(3);
    expect(document.querySelector(".ve-ph.audio .ve-ph-wave")).toBeTruthy(); // waveform from peaks
  });

  it("the type filter narrows the list", () => {
    setup();
    const sel = screen.getByRole("combobox", { name: "Filter media" });
    fireEvent.change(sel, { target: { value: "audio" } });
    expect(tileNames()).toEqual(["Audio.aac", "Voice.m4a"]);
    fireEvent.change(sel, { target: { value: "image" } });
    expect(tileNames()).toEqual(["Sunset.heic"]);
    fireEvent.change(sel, { target: { value: "video" } });
    expect(tileNames()).toHaveLength(6);
  });

  it("list view shows the same items with actions", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(document.querySelectorAll(".ve-lrow")).toHaveLength(9);
    expect(document.querySelector(".ve-ldur")?.textContent).toBe("00:27");
    expect(
      Array.from(document.querySelectorAll(".ve-ldur")).some((e) => e.textContent === "Photo"),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "More options for Beach.mov" })).toBeTruthy();
  });

  it("an empty project invites you to import", () => {
    const h = makeHarness();
    h.store.replaceProject({ ...h.store.getProject(), assets: [], clips: [] });
    render(h.wrap(<MediaPanel rail />));
    expect(screen.getByText(/Tap Import to add videos, photos or audio/)).toBeTruthy();
  });
});

describe("MediaPanel — importing", () => {
  it("the Import button opens the file picker; chosen files are imported and the input is reset", () => {
    const { store } = setup();
    const input = screen.getByTestId("media-file-input") as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe("video/*,audio/*,image/*");
    const click = vi.spyOn(input, "click");
    fireEvent.click(document.querySelector<HTMLButtonElement>(".ve-import")!);
    expect(click).toHaveBeenCalledTimes(1);

    const a = new File(["1"], "a.mp4", { type: "video/mp4" });
    const b = new File(["2"], "b.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [a, b] } });
    expect(importMedia).toHaveBeenCalledTimes(1);
    expect(vi.mocked(importMedia).mock.calls[0][0]).toEqual([a, b]);
    expect(vi.mocked(importMedia).mock.calls[0][1]).toBe(store);
  });

  it("the sidebar 'Import' entry also opens the picker", () => {
    setup();
    const click = vi.spyOn(screen.getByTestId("media-file-input"), "click");
    fireEvent.click(
      screen.getAllByText("Import").find((e) => e.classList.contains("ve-side-sub"))!,
    );
    expect(click).toHaveBeenCalled();
  });

  it("dropping files on the library imports them (desktop)", () => {
    setup();
    const zone = document.querySelector(".ve-media-content")!;
    const f = new File(["x"], "dropped.mov", { type: "video/quicktime" });
    fireEvent.dragOver(zone, { dataTransfer: { types: ["Files"], files: [f] } });
    expect(zone.classList.contains("dropping")).toBe(true);
    fireEvent.drop(zone, { dataTransfer: { types: ["Files"], files: [f] } });
    expect(zone.classList.contains("dropping")).toBe(false);
    expect(vi.mocked(importMedia).mock.calls[0][0]).toEqual([f]);
  });

  it("ignores a choose-nothing change event", () => {
    setup();
    fireEvent.change(screen.getByTestId("media-file-input"), { target: { files: [] } });
    expect(importMedia).not.toHaveBeenCalled();
  });
});

describe("MediaPanel — add to timeline", () => {
  it("the + button appends a clip and selects it", () => {
    const { store } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add Beach.mov to timeline" }));
    const clip = store.getProject().clips.find((c) => c.assetId === "v")!;
    expect(clip).toMatchObject({ trackId: "track-main", start: 1678, duration: 600 });
    expect(editorStore.getState().selectedClipIds).toEqual([clip.id]);
    expect(store.getState().past.at(-1)!.label).toBe("Add to timeline");
  });
  it("audio goes to the audio track", () => {
    const { store } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add Voice.m4a to timeline" }));
    expect(store.getProject().clips.find((c) => c.assetId === "a")!.trackId).toBe("track-audio-1");
  });
});

describe("MediaPanel — ⋯ menu: rename and delete", () => {
  const open = (name: string) =>
    fireEvent.click(screen.getByRole("button", { name: `More options for ${name}` }));

  it("opens a dialog describing the file, with add / rename / delete", () => {
    setup();
    open("Beach.mov");
    const d = screen.getByRole("dialog", { name: "Beach.mov" });
    expect(within(d).getByText(/Video/)).toBeTruthy();
    expect(within(d).getByRole("button", { name: "Add to timeline" })).toBeTruthy();
    expect(within(d).getByRole("button", { name: "Rename…" })).toBeTruthy();
    expect(within(d).getByRole("button", { name: "Delete…" })).toBeTruthy();
  });

  it("renames, and Save is disabled for an empty name", () => {
    const { store } = setup();
    open("Beach.mov");
    fireEvent.click(screen.getByRole("button", { name: "Rename…" }));
    const input = screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
    expect(input.value).toBe("Beach.mov");
    fireEvent.change(input, { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "Holiday" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(store.getProject().assets.find((a) => a.id === "v")!.name).toBe("Holiday");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Holiday")).toBeTruthy();
  });

  it("Enter saves a rename; Esc cancels without changes", () => {
    const { store } = setup();
    open("Sunset.heic");
    fireEvent.click(screen.getByRole("button", { name: "Rename…" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Dusk" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Name" }), { key: "Enter" });
    expect(store.getProject().assets.find((a) => a.id === "i")!.name).toBe("Dusk");

    open("Dusk");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("delete warns how many clips go with it, removes asset + clips, and Undo restores both", () => {
    const { store } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add Beach.mov to timeline" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Beach.mov to timeline" }));
    open("Beach.mov");
    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    expect(screen.getByText(/2 clips on the timeline that use it/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(store.getProject().assets.some((a) => a.id === "v")).toBe(false);
    expect(store.getProject().clips.some((c) => c.assetId === "v")).toBe(false);
    expect(screen.queryByText("Beach.mov")).toBeNull();

    act(() => void store.undo());
    expect(store.getProject().assets.some((a) => a.id === "v")).toBe(true);
    expect(store.getProject().clips.filter((c) => c.assetId === "v")).toHaveLength(2);
    expect(screen.getByText("Beach.mov")).toBeTruthy();
  });

  it("deleting an unused asset doesn't mention clips; Cancel keeps it", () => {
    const { store } = setup();
    open("Sunset.heic");
    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    expect(screen.queryByText(/clips? on the timeline/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(store.getProject().assets.some((a) => a.id === "i")).toBe(true);
  });

  it("'Add to timeline' in the dialog works too", () => {
    const { store } = setup();
    open("Sunset.heic");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Add to timeline" }),
    );
    expect(store.getProject().clips.some((c) => c.assetId === "i")).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Dialog focus handling", () => {
  it("moves focus in, traps Tab, and returns focus to the opener on close", () => {
    setup();
    const opener = screen.getByRole("button", { name: "More options for Beach.mov" });
    opener.focus();
    fireEvent.click(opener);
    const d = screen.getByRole("dialog");
    expect(d.contains(document.activeElement)).toBe(true);
    const buttons = within(d).getAllByRole("button");
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(opener);
  });
  it("clicking the backdrop closes it", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "More options for Beach.mov" }));
    fireEvent.pointerDown(document.querySelector(".ve-dialog-back")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
