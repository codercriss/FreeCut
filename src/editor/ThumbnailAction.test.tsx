// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "../model/types";
import { addAssets } from "../store/commands";
import { makeHarness } from "../test/harness";
import type * as MediaStoreModule from "../media/mediaStore";
import { MediaPanel } from "./MediaPanel";

const mocks = vi.hoisted(() => ({
  makePosterDetailed: vi.fn(),
  getMedia: vi.fn(),
  putMedia: vi.fn<(id: string, blob: Blob) => Promise<void>>(async () => undefined),
  refreshMedia: vi.fn(),
  urls: new Map<string, string | null>(),
}));

vi.mock("../media/importer", () => ({ importMedia: vi.fn() }));
vi.mock("../media/thumbnail", () => ({ makePosterDetailed: mocks.makePosterDetailed }));
vi.mock("../media/mediaStore", async (orig) => ({
  ...(await orig<typeof MediaStoreModule>()),
  getMedia: mocks.getMedia,
  putMedia: mocks.putMedia,
}));
vi.mock("../media/useMediaUrl", () => ({
  useMediaUrl: (id: string | null) => (id ? (mocks.urls.get(id) ?? null) : null),
  usePosterUrl: (a?: Asset) =>
    a && a.source.type === "stored" ? (mocks.urls.get(`${a.source.mediaId}:poster`) ?? null) : null,
  refreshMedia: mocks.refreshMedia,
}));

const stored = (id: string, kind: Asset["kind"], name: string): Asset => ({
  id,
  kind,
  name,
  durationFrames: 600,
  source: { type: "stored", mediaId: `m-${id}` },
});

function open(name: string, assets: Asset[]) {
  const h = makeHarness();
  h.store.execute(addAssets(assets));
  render(h.wrap(<MediaPanel rail />));
  fireEvent.click(screen.getByRole("button", { name: `More options for ${name}` }));
}

beforeEach(() => {
  mocks.makePosterDetailed.mockReset();
  mocks.getMedia.mockReset();
  mocks.putMedia.mockClear();
  mocks.refreshMedia.mockClear();
  mocks.urls.clear();
});

describe("Create thumbnail (retry from the ⋯ menu)", () => {
  it("is offered for an imported video with no poster, and succeeds: stores the poster and refreshes the UI", async () => {
    mocks.getMedia.mockResolvedValue(new Blob(["video"], { type: "video/mp4" }));
    mocks.makePosterDetailed.mockResolvedValue({
      blob: new Blob(["jpg"], { type: "image/jpeg" }),
      notes: ["ok"],
    });
    open("IMG_1.MOV", [stored("v", "video", "IMG_1.MOV")]);
    fireEvent.click(screen.getByRole("button", { name: "Create thumbnail" }));
    await waitFor(() => expect(mocks.putMedia).toHaveBeenCalledTimes(1));
    expect(mocks.putMedia.mock.calls[0][0]).toBe("m-v:poster");
    expect(mocks.refreshMedia).toHaveBeenCalledWith("m-v:poster");
    // it asked for the right thing: this asset's kind and duration in seconds (600 frames at 60 fps)
    expect(mocks.makePosterDetailed.mock.calls[0][1]).toEqual({ kind: "video", durationSec: 10 });
  });

  it("when it still fails, it shows the reasons so they can be screenshotted", async () => {
    mocks.getMedia.mockResolvedValue(new Blob(["video"]));
    mocks.makePosterDetailed.mockResolvedValue({
      blob: null,
      notes: [
        "play: metadata 1920×1080, play() refused (NotAllowedError)",
        "seek: failed (timed out waiting for loadeddata)",
      ],
    });
    open("IMG_1.MOV", [stored("v", "video", "IMG_1.MOV")]);
    fireEvent.click(screen.getByRole("button", { name: "Create thumbnail" }));
    const diag = await screen.findByText(/Couldn’t make a thumbnail/);
    expect(diag.textContent).toContain("play() refused (NotAllowedError)");
    expect(diag.textContent).toContain("timed out waiting for loadeddata");
    expect(mocks.putMedia).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Create thumbnail" }) as HTMLButtonElement).disabled,
    ).toBe(false); // can try again
  });

  it("reports a missing stored file instead of crashing", async () => {
    mocks.getMedia.mockResolvedValue(undefined);
    open("IMG_1.MOV", [stored("v", "video", "IMG_1.MOV")]);
    fireEvent.click(screen.getByRole("button", { name: "Create thumbnail" }));
    expect((await screen.findByText(/Couldn’t make a thumbnail/)).textContent).toContain(
      "could not be found",
    );
  });

  it("is offered for photos too, but not for audio, nor when a poster already exists", () => {
    open("Beach.heic", [stored("i", "image", "Beach.heic")]);
    expect(screen.getByRole("button", { name: "Create thumbnail" })).toBeTruthy();
  });
  it("not for audio", () => {
    open("Voice.m4a", [stored("a", "audio", "Voice.m4a")]);
    expect(screen.queryByRole("button", { name: "Create thumbnail" })).toBeNull();
  });
  it("not when a poster exists", () => {
    mocks.urls.set("m-v:poster", "blob:poster");
    open("IMG_1.MOV", [stored("v", "video", "IMG_1.MOV")]);
    expect(screen.queryByRole("button", { name: "Create thumbnail" })).toBeNull();
  });
  it("not for the demo clips (generated art)", () => {
    const h = makeHarness();
    render(h.wrap(<MediaPanel rail />));
    fireEvent.click(screen.getAllByRole("button", { name: /More options for CRST001334/ })[0]);
    expect(screen.queryByRole("button", { name: "Create thumbnail" })).toBeNull();
  });
});

describe("first-frame fallback in the library tile", () => {
  it("with no poster but a readable file, the browser's own first frame is layered behind the icon", () => {
    mocks.urls.set("m-v", "blob:the-video");
    const h = makeHarness();
    h.store.execute(addAssets([stored("v", "video", "IMG_1.MOV")]));
    const { container } = render(h.wrap(<MediaPanel rail />));
    const vid = container.querySelector<HTMLVideoElement>("video.ve-art-raw")!;
    expect(vid.getAttribute("src")).toBe("blob:the-video#t=0.1");
    expect(vid.muted).toBe(true);
    expect(vid.hasAttribute("playsinline")).toBe(true);
    expect(container.querySelector(".ve-ph.video")).toBeTruthy(); // the icon is still there underneath
  });
  it("not when a poster exists, and never for photos/audio", () => {
    mocks.urls.set("m-v", "blob:the-video");
    mocks.urls.set("m-v:poster", "blob:poster");
    const h = makeHarness();
    h.store.execute(
      addAssets([stored("v", "video", "IMG_1.MOV"), stored("a", "audio", "Voice.m4a")]),
    );
    const { container } = render(h.wrap(<MediaPanel rail />));
    expect(container.querySelector("video.ve-art-raw")).toBeNull();
  });
});
