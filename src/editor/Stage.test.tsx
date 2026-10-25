// @vitest-environment jsdom
import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "../model/types";
import { addAssets, addClipFromAsset } from "../store/commands";
import { makeHarness } from "../test/harness";
import { Stage, StageVideo, stageTime } from "./Stage";

const urls = vi.hoisted(() => new Map<string, string | null>());
vi.mock("../media/useMediaUrl", () => ({
  useMediaUrl: (id: string | null) => (id ? (urls.get(id) ?? null) : null),
  usePosterUrl: (a?: Asset) =>
    a && a.source.type === "stored" ? (urls.get(`${a.source.mediaId}:poster`) ?? null) : null,
  refreshMedia: vi.fn(),
  useMediaVersion: () => 0,
}));

beforeEach(() => {
  urls.clear();
  // jsdom doesn't implement media loading
  HTMLMediaElement.prototype.load = vi.fn();
  HTMLMediaElement.prototype.pause = vi.fn();
});

/** Make a <video> report a ready state and record every `currentTime` assignment. */
function instrument(v: HTMLVideoElement, readyState = 1) {
  const writes: number[] = [];
  let t = 0;
  let rs = readyState;
  Object.defineProperty(v, "currentTime", {
    get: () => t,
    set: (x: number) => {
      t = x;
      writes.push(x);
    },
    configurable: true,
  });
  Object.defineProperty(v, "readyState", { get: () => rs, configurable: true });
  return {
    writes,
    setReady: (x: number) => void (rs = x),
    /** the browser finished the seek it was asked for */
    land: () => act(() => void fireEvent.seeked(v)),
  };
}

describe("stageTime", () => {
  it("maps a timeline frame to source seconds, honouring start, trim and speed", () => {
    expect(stageTime({ start: 1000, sourceIn: 0, speed: 1 }, 1060, 60)).toBe(1);
    expect(stageTime({ start: 1000, sourceIn: 120, speed: 1 }, 1000, 60)).toBe(2); // trimmed: starts 2 s into the source
    expect(stageTime({ start: 1000, sourceIn: 120, speed: 2 }, 1060, 60)).toBe(4); // 2 s trim + 1 s at 2×
    expect(stageTime({ start: 1000, sourceIn: 0, speed: 1 }, 900, 60)).toBe(0); // never negative
  });
});

describe("StageVideo", () => {
  const setup = (props: Partial<React.ComponentProps<typeof StageVideo>> = {}, ready = 1) => {
    const verify = vi.fn(() => "ok" as "ok" | "blank" | "error");
    const ui = (p: Partial<React.ComponentProps<typeof StageVideo>> = {}) => (
      <StageVideo url="blob:v" timeSec={3} verify={verify} {...props} {...p} />
    );
    const r = render(ui());
    const v = r.container.querySelector("video")!;
    const ctl = instrument(v, ready);
    return {
      v,
      ctl,
      verify,
      rerender: (p: Partial<React.ComponentProps<typeof StageVideo>>) => r.rerender(ui(p)),
      unmount: r.unmount,
    };
  };
  const opacity = (v: HTMLVideoElement) => v.style.opacity;

  it("is a muted, inline, hidden-until-verified video of the original file", () => {
    const { v } = setup();
    expect(v.getAttribute("src")).toBe("blob:v");
    expect(v.muted).toBe(true);
    expect(v.hasAttribute("playsinline")).toBe(true);
    expect(opacity(v)).toBe("0");
  });

  it("once metadata is known it seeks to the target time, and shows itself after a verified frame", () => {
    const { v, ctl, verify } = setup();
    act(() => void fireEvent.loadedMetadata(v));
    expect(ctl.writes).toEqual([3]);
    ctl.land();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(opacity(v)).toBe("1");
  });

  it("does not seek again if it is already at the target", () => {
    const { v, ctl } = setup({ timeSec: 0 });
    act(() => void fireEvent.loadedMetadata(v));
    expect(ctl.writes).toEqual([]);
  });

  it("only ONE seek is in flight; the latest target is chased after it lands", () => {
    const { v, ctl, rerender } = setup();
    act(() => void fireEvent.loadedMetadata(v));
    expect(ctl.writes).toEqual([3]);
    rerender({ timeSec: 4 });
    rerender({ timeSec: 5 });
    rerender({ timeSec: 6 });
    expect(ctl.writes).toEqual([3]); // still waiting for the first seek — no pile-up
    ctl.land(); // first seek lands at 3, but the playhead is at 6 now
    expect(ctl.writes).toEqual([3, 6]); // jumps straight to the newest time, skipping 4 and 5
  });

  it("follows the playhead when idle", () => {
    const { v, ctl, rerender } = setup();
    act(() => void fireEvent.loadedMetadata(v));
    ctl.land();
    rerender({ timeSec: 8 });
    expect(ctl.writes).toEqual([3, 8]);
  });

  it("doesn't try to seek before the video knows its duration", () => {
    const { ctl, rerender } = setup({}, 0);
    rerender({ timeSec: 9 });
    expect(ctl.writes).toEqual([]);
  });

  it("stays HIDDEN when the frame can't be verified, so a bad decoder never covers the poster with black", () => {
    const { v, ctl, verify } = setup();
    verify.mockReturnValue("error");
    act(() => void fireEvent.loadedMetadata(v));
    ctl.land();
    expect(opacity(v)).toBe("0");
  });

  it("a blank frame is distrusted — until the third try, when it is accepted as a genuinely black frame", () => {
    const { v, ctl, rerender, verify } = setup({}, 4);
    verify.mockReturnValue("blank");
    act(() => void fireEvent.loadedMetadata(v));
    ctl.land();
    expect(opacity(v)).toBe("0");
    rerender({ timeSec: 4 });
    ctl.land();
    expect(opacity(v)).toBe("0");
    rerender({ timeSec: 5 });
    ctl.land();
    expect(opacity(v)).toBe("1");
    expect(verify).toHaveBeenCalledTimes(3);
  });

  it("with no poster to protect (alwaysShow) it shows without verifying", () => {
    const { v, ctl, verify } = setup({ alwaysShow: true });
    act(() => void fireEvent.loadedMetadata(v));
    ctl.land();
    expect(opacity(v)).toBe("1");
    expect(verify).not.toHaveBeenCalled();
  });

  it("releases the decoder when it goes away", () => {
    const { v, unmount } = setup();
    const remove = vi.spyOn(v, "removeAttribute");
    unmount();
    expect(remove).toHaveBeenCalledWith("src");
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  });
});

describe("Stage", () => {
  const stored = (id: string, kind: Asset["kind"], frames = 600): Asset => ({
    id,
    kind,
    name: `${id}`,
    durationFrames: frames,
    source: { type: "stored", mediaId: `m-${id}` },
  });

  function render2(assets: Asset[], frame: number, addIds: string[] = assets.map((a) => a.id)) {
    const h = makeHarness();
    h.store.execute(addAssets(assets));
    addIds.forEach((id) => h.store.execute(addClipFromAsset(id, `c-${id}`))); // appended after the 1678-frame demo clip
    return render(h.wrap(<Stage frame={frame} />));
  }

  it("demo footage: its generated scene, nothing else", () => {
    const { container } = render2([], 100);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("img, video")).toBeNull();
  });

  it("an imported PHOTO: the original file over the small poster; the original only appears once loaded", () => {
    urls.set("m-p:poster", "blob:poster");
    urls.set("m-p", "blob:original");
    const { container } = render2([stored("p", "image", 300)], 1700);
    const imgs = container.querySelectorAll<HTMLImageElement>("img.ve-stage-img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute("src")).toBe("blob:poster"); // placeholder underneath
    expect(imgs[1].getAttribute("src")).toBe("blob:original");
    expect(imgs[1].style.opacity).toBe("0");
    fireEvent.load(imgs[1]);
    expect(imgs[1].style.opacity).toBe("1");
    fireEvent.error(imgs[1]); // e.g. a HEIC this browser can't draw → back to the poster
    expect(imgs[1].style.opacity).toBe("0");
  });

  it("an imported VIDEO: the original file seeks to the right source time for this timeline frame", () => {
    urls.set("m-v:poster", "blob:poster");
    urls.set("m-v", "blob:original");
    // the video clip starts at frame 1678; the playhead is 90 frames in → 1.5 s
    const { container } = render2([stored("v", "video", 600)], 1678 + 90);
    const v = container.querySelector("video")!;
    const ctl = instrument(v);
    expect(v.getAttribute("src")).toBe("blob:original");
    act(() => void fireEvent.loadedMetadata(v));
    expect(ctl.writes).toEqual([1.5]);
    expect(container.querySelector("img.ve-stage-img")!.getAttribute("src")).toBe("blob:poster"); // still underneath
  });

  it("a video with no poster at all is shown as soon as it has a frame", () => {
    urls.set("m-v", "blob:original");
    const { container } = render2([stored("v", "video", 600)], 1700);
    const v = container.querySelector("video")!;
    const ctl = instrument(v);
    act(() => void fireEvent.loadedMetadata(v));
    ctl.land();
    expect(v.style.opacity).toBe("1");
  });

  it("nothing from imports shows in a gap or for audio", () => {
    urls.set("m-a", "blob:audio");
    const audio = render2([stored("a", "audio", 300)], 1700);
    expect(audio.container.querySelector("img, video")).toBeNull();
    const gap = render2([], 5000);
    expect(gap.container.querySelector("img, video, svg")).toBeNull();
  });
});
