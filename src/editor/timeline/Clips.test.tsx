// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createSampleProject } from "../../model/sample";
import { addAssets, addClipFromAsset } from "../../store/commands";
import type { Filmstrip } from "../../media/useFilmstrip";
import { AudioClip, VideoClip } from "./Clips";

const strip = vi.hoisted(() => ({ current: null as Filmstrip | null }));
vi.mock("../../media/useFilmstrip", () => ({ useFilmstrip: () => strip.current }));

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

describe("VideoClip filmstrip", () => {
  const META = { count: 10, cols: 5, rows: 2, cellW: 160, cellH: 90, durationSec: 10 };
  const imported = () => {
    let p = addAssets([
      {
        id: "a",
        kind: "video",
        name: "v.mov",
        durationFrames: 600,
        source: { type: "stored", mediaId: "m" },
      },
    ]).apply(base);
    p = addClipFromAsset("a", "c").apply(p);
    return { clip: p.clips.find((c) => c.id === "c")!, asset: p.assets.find((a) => a.id === "a")! };
  };
  const frames = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>(".ve-frame.strip")).map((e) =>
      Number(e.dataset.frame),
    );

  it("shows a DIFFERENT frame in each cell — the sprite, not one poster repeated", () => {
    strip.current = { url: "blob:sprite", meta: META };
    const { clip, asset } = imported();
    const { container } = render(
      <VideoClip
        clip={clip}
        asset={asset}
        fps={60}
        selected={false}
        onToggle={() => {}}
        left={0}
        width={416}
        top={0}
        height={55}
      />,
    );
    const idx = frames(container);
    expect(idx).toHaveLength(10); // 416 px / 41.6
    expect(idx).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); // a 10 s clip across 10 cells → one frame each, in order
    const pos = new Set(
      Array.from(container.querySelectorAll<HTMLElement>(".ve-frame.strip")).map(
        (e) => e.style.backgroundPosition,
      ),
    );
    expect(pos.size).toBe(10);
    expect(
      container.querySelector<HTMLElement>(".ve-frame.strip")!.style.backgroundImage,
    ).toContain("blob:sprite");
  });

  it("a trimmed, sped-up clip shows the part of the source it actually plays", () => {
    strip.current = { url: "blob:sprite", meta: META };
    const { clip, asset } = imported();
    // plays source seconds 5–10 (sourceIn 300 frames, 150 timeline frames at 2×)
    const trimmed = { ...clip, sourceIn: 300, duration: 150, speed: 2 };
    const { container } = render(
      <VideoClip
        clip={trimmed}
        asset={asset}
        fps={60}
        selected={false}
        onToggle={() => {}}
        left={0}
        width={166.4}
        top={0}
        height={55}
      />,
    );
    const idx = frames(container);
    expect(idx).toHaveLength(4);
    expect(Math.min(...idx)).toBeGreaterThanOrEqual(5);
    expect(idx).toEqual([...idx].sort((a, b) => a - b)); // time moves forward across the clip
  });

  it("falls back to the repeated poster while the filmstrip isn't ready", () => {
    strip.current = null;
    const { clip, asset } = imported();
    const { container } = render(
      <VideoClip
        clip={clip}
        asset={asset}
        fps={60}
        selected={false}
        onToggle={() => {}}
        left={0}
        width={416}
        top={0}
        height={55}
      />,
    );
    expect(container.querySelectorAll(".ve-frame.strip")).toHaveLength(0);
    expect(container.querySelectorAll(".ve-frame")).toHaveLength(10);
  });
});
