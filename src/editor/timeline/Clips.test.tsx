// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createSampleProject } from "../../model/sample";
import { addAssets, addClipFromAsset } from "../../store/commands";
import { AudioClip, VideoClip } from "./Clips";

const box = { left: 0, width: 300, top: 0, height: 55 };
const base = createSampleProject(1);

describe("VideoClip header chips", () => {
  it("the demo clip (has a filter and an effect) advertises them", () => {
    const clip = base.clips.find((c) => c.id === "clip-main")!;
    const asset = base.assets.find((a) => a.id === clip.assetId)!;
    render(
      <VideoClip
        clip={clip}
        asset={asset}
        fps={60}
        selected={false}
        onToggle={() => {}}
        {...box}
      />,
    );
    expect(screen.getByText("Effects – Edit")).toBeTruthy();
    expect(screen.getByText("Filters")).toBeTruthy();
    expect(screen.getByText("Adjust")).toBeTruthy();
    expect(screen.getByText("Moraine Lake.mov")).toBeTruthy();
    expect(screen.getByText("00:00:27")).toBeTruthy();
  });

  it("a freshly imported clip has none of them — it only shows its name and length", () => {
    let p = addAssets([
      {
        id: "a",
        kind: "video",
        name: "IMG_0001.MOV",
        durationFrames: 600,
        source: { type: "stored", mediaId: "m" },
      },
    ]).apply(base);
    p = addClipFromAsset("a", "c").apply(p);
    const clip = p.clips.find((c) => c.id === "c")!;
    render(
      <VideoClip
        clip={clip}
        asset={p.assets.find((a) => a.id === "a")!}
        fps={60}
        selected={false}
        onToggle={() => {}}
        {...box}
      />,
    );
    expect(screen.queryByText("Effects – Edit")).toBeNull();
    expect(screen.queryByText("Filters")).toBeNull();
    expect(screen.queryByText("Adjust")).toBeNull();
    expect(screen.getByText("IMG_0001.MOV")).toBeTruthy();
    expect(screen.getByText("00:00:10")).toBeTruthy();
  });
});

describe("AudioClip waveform", () => {
  const clip = base.clips.find((c) => c.id === "clip-audio")!;
  const asset = base.assets.find((a) => a.id === "asset-audio")!;
  it("draws the real peaks when the asset has them", () => {
    const { container } = render(
      <AudioClip
        clip={clip}
        asset={{ ...asset, peaks: [0, 50, 100] }}
        fps={60}
        selected={false}
        onToggle={() => {}}
        {...box}
      />,
    );
    const bars = Array.from(container.querySelectorAll<HTMLElement>(".ve-wave i")).map(
      (i) => i.style.height,
    );
    expect(bars).toEqual(["10%", "50%", "100%"]); // silence is drawn as a 10% sliver, not nothing
  });
  it("falls back to the placeholder waveform otherwise", () => {
    const { container } = render(
      <AudioClip
        clip={clip}
        asset={asset}
        fps={60}
        selected={false}
        onToggle={() => {}}
        {...box}
      />,
    );
    expect(container.querySelectorAll(".ve-wave i")).toHaveLength(112);
    expect(screen.getByText("Speed 2.0x")).toBeTruthy();
  });
});
