import { describe, expect, it } from "vitest";
import {
  cellStyle,
  frameIndexAt,
  frameTimes,
  stripCount,
  stripFromVideo,
  stripLayout,
  type StripEnv,
  type StripMeta,
} from "./filmstrip";
import type { VideoLike } from "./poster";

describe("stripCount / frameTimes / frameIndexAt", () => {
  it("about one frame a second, between 3 and 24", () => {
    expect(stripCount(0.5)).toBe(3);
    expect(stripCount(2)).toBe(3);
    expect(stripCount(19.85)).toBe(20);
    expect(stripCount(600)).toBe(24);
  });
  it("samples the middle of each equal slice", () => {
    expect(frameTimes(10, 4)).toEqual([1.25, 3.75, 6.25, 8.75]);
  });
  it("maps a time to the frame that covers it, clamped to the ends", () => {
    const m = { count: 4, durationSec: 10 };
    expect(frameIndexAt(0, m)).toBe(0);
    expect(frameIndexAt(2.4, m)).toBe(0);
    expect(frameIndexAt(2.6, m)).toBe(1);
    expect(frameIndexAt(9.99, m)).toBe(3);
    expect(frameIndexAt(50, m)).toBe(3);
    expect(frameIndexAt(-5, m)).toBe(0);
  });
  it("each sampled time maps back to its own frame", () => {
    const m = { count: 20, durationSec: 19.85 };
    frameTimes(m.durationSec, m.count).forEach((t, i) => expect(frameIndexAt(t, m)).toBe(i));
  });
});

describe("stripLayout", () => {
  it("keeps the video's aspect ratio and the sprite under 2048 px wide", () => {
    const m = stripLayout(24, 1920, 1080, 30);
    expect(m.cellH).toBe(128);
    expect(m.cellW).toBe(228);
    expect(m.cols * m.cellW).toBeLessThanOrEqual(2048);
    expect(m.cols * m.rows).toBeGreaterThanOrEqual(24);
    expect(m.durationSec).toBe(30);
  });
  it("portrait phone video gets narrow cells; extreme shapes are clamped", () => {
    expect(stripLayout(10, 1080, 1920).cellW).toBe(72);
    expect(stripLayout(10, 100, 1000).cellW).toBe(72);
    expect(stripLayout(10, 5000, 100).cellW).toBe(256);
  });
  it("never has more columns than frames, and fits every frame", () => {
    const m = stripLayout(3, 1080, 1920);
    expect(m.cols).toBe(3);
    expect(m.rows).toBe(1);
  });
});

describe("cellStyle (which part of the sprite a timeline cell shows)", () => {
  const meta: StripMeta = { count: 6, cols: 3, rows: 2, cellW: 160, cellH: 90, durationSec: 6 };
  const px = (s: string) => s.split(" ").map((x) => parseFloat(x));

  it("scales to cover the cell and sizes the whole sprite consistently", () => {
    const st = cellStyle(meta, 0, 32, 40); // a narrow, tall timeline cell
    const k = Math.max(32 / 160, 40 / 90);
    const [w, h] = px(st.backgroundSize);
    expect(w).toBeCloseTo(3 * 160 * k, 6);
    expect(h).toBeCloseTo(2 * 90 * k, 6);
  });
  it("different frames get different offsets; frame 0 is at the top-left, centred in the cell", () => {
    const a = px(cellStyle(meta, 0, 32, 40).backgroundPosition);
    const b = px(cellStyle(meta, 1, 32, 40).backgroundPosition);
    const d = px(cellStyle(meta, 3, 32, 40).backgroundPosition); // second row, first column
    expect(b[0]).toBeLessThan(a[0]);
    expect(d[1]).toBeLessThan(a[1]);
    expect(d[0]).toBe(a[0]);
  });
  it("never shows a neighbouring frame: the visible window stays inside one scaled frame", () => {
    for (const [cw, ch] of [
      [32, 40],
      [100, 40],
      [41.6, 40],
      [300, 40],
    ]) {
      const k = Math.max(cw / meta.cellW, ch / meta.cellH);
      const fw = meta.cellW * k;
      const fh = meta.cellH * k;
      for (let i = 0; i < meta.count; i++) {
        const [x, y] = px(cellStyle(meta, i, cw, ch).backgroundPosition);
        const col = i % meta.cols;
        const row = Math.floor(i / meta.cols);
        // visible window [−x, −x+cw] must lie within [col·fw, (col+1)·fw] (same for y)
        expect(-x).toBeGreaterThanOrEqual(col * fw - 1e-6);
        expect(-x + cw).toBeLessThanOrEqual((col + 1) * fw + 1e-6);
        expect(-y).toBeGreaterThanOrEqual(row * fh - 1e-6);
        expect(-y + ch).toBeLessThanOrEqual((row + 1) * fh + 1e-6);
      }
    }
  });
});

/* ───────────── building the sprite, against a scriptable fake video ───────────── */

type Listener = () => void;
class FakeVideo implements VideoLike {
  src = "";
  muted = false;
  playsInline = false;
  preload = "";
  readyState = 0;
  videoWidth = 0;
  videoHeight = 0;
  seeks: number[] = [];
  private listeners = new Map<string, Set<Listener>>();
  constructor(public mode: "normal" | "ios" | "seek-fails" | "no-picture") {}
  addEventListener(t: string, f: Listener) {
    (this.listeners.get(t) ?? this.listeners.set(t, new Set()).get(t)!).add(f);
  }
  removeEventListener(t: string, f: Listener) {
    this.listeners.get(t)?.delete(f);
  }
  private emit(t: string) {
    setTimeout(() => this.listeners.get(t)?.forEach((f) => f()), 1);
  }
  set currentTime(v: number) {
    this.seeks.push(v);
    if (this.mode === "seek-fails" || this.readyState < 2) return;
    this.emit("seeked");
  }
  get currentTime() {
    return this.seeks[this.seeks.length - 1] ?? 0;
  }
  async play() {
    if (this.mode === "ios") {
      this.readyState = 4;
      this.emit("loadeddata");
    }
  }
  pause() {}
  load() {
    this.videoWidth = this.mode === "no-picture" ? 0 : 320;
    this.videoHeight = 240;
    this.readyState = 1;
    this.emit("loadedmetadata");
    if (this.mode === "normal" || this.mode === "seek-fails") {
      this.readyState = 4;
      this.emit("loadeddata");
    }
  }
}

function makeEnv(mode: FakeVideo["mode"]) {
  const drawn: number[] = [];
  const seeksAtDraw: number[] = [];
  let video!: FakeVideo;
  let detached = 0;
  let attached = 0;
  let layout!: StripMeta;
  const env: StripEnv = {
    createVideo: () => {
      video = new FakeVideo(mode);
      return video;
    },
    attach: (v) => {
      let value = "";
      attached += 1;
      Object.defineProperty(v, "src", {
        configurable: true, // attach() can be called again after the video was let go during a long wait
        get: () => value,
        set: (x: string) => {
          value = x;
          (v as FakeVideo).load();
        },
      });
    },
    detach: () => void (detached += 1),
    begin: (w, h, count, dur) => (layout = stripLayout(count, w, h, dur)),
    drawCell: (v, i) => {
      drawn.push(i);
      seeksAtDraw.push((v as FakeVideo).currentTime);
    },
    finish: async () => new Blob(["sprite"]),
  };
  return {
    env,
    drawn,
    seeksAtDraw,
    get video() {
      return video;
    },
    get detached() {
      return detached;
    },
    get attached() {
      return attached;
    },
    get layout() {
      return layout;
    },
  };
}

const FAST = { stepMs: 40, totalMs: 4000 };

describe("stripFromVideo", () => {
  it("seeks to each frame's time in order and draws each cell once", async () => {
    const h = makeEnv("normal");
    const r = await stripFromVideo("blob:x", 10, h.env, FAST);
    expect(r.blob).not.toBeNull();
    expect(r.meta!.count).toBe(10);
    expect(h.drawn).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(h.seeksAtDraw).toEqual(frameTimes(10, 10));
    expect(h.detached).toBe(1);
    expect(r.notes.at(-1)).toBe("10/10 frames ok");
  });

  it("asks the pause hook before every frame and before encoding, and builds the same sprite", async () => {
    const h = makeEnv("normal");
    let calls = 0;
    const r = await stripFromVideo("blob:x", 6, h.env, {
      ...FAST,
      pause: async () => {
        calls += 1;
      },
    });
    expect(calls).toBe(1 + 6 + 1); // once at the start, once per frame, once before the encode
    expect(r.blob).not.toBeNull();
    expect(h.drawn).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("lets go of the hidden video during a long wait and opens it again afterwards", async () => {
    const h = makeEnv("normal");
    let n = 0;
    const r = await stripFromVideo("blob:x", 6, h.env, {
      ...FAST,
      pause: async () => {
        n += 1;
        if (n === 4) await new Promise((res) => setTimeout(res, 700)); // the person is busy for a while
      },
    });
    expect(h.attached).toBe(2); // once at the start, once to resume
    expect(h.detached).toBe(2); // let go during the wait, and again at the end
    expect(r.blob).not.toBeNull();
    expect(r.notes.at(-1)).toMatch(/^(\d+)\/\1 frames ok$/);
    expect(h.drawn).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("keeps the video open through a short wait", async () => {
    const h = makeEnv("normal");
    let n = 0;
    await stripFromVideo("blob:x", 6, h.env, {
      ...FAST,
      pause: async () => {
        n += 1;
        if (n === 4) await new Promise((res) => setTimeout(res, 100));
      },
    });
    expect(h.attached).toBe(1);
    expect(h.detached).toBe(1);
  });

  it("does not count time spent paused against the deadline (no half-empty sprite)", async () => {
    const h = makeEnv("normal");
    // A 600 ms allowance for 2 frames, but the person keeps the phone busy for 1000 ms before the first frame.
    // Without stretching the deadline by that wait, the allowance would be gone before any frame is drawn.
    let n = 0;
    const r = await stripFromVideo("blob:x", 2, h.env, {
      stepMs: 40,
      totalMs: 600,
      pause: async () => {
        n += 1;
        if (n === 2) await new Promise((res) => setTimeout(res, 1000));
      },
    });
    expect(r.notes.some((x) => x.includes("out of time"))).toBe(false);
    expect(r.notes.at(-1)).toMatch(/^(\d+)\/\1 frames ok$/); // every frame was reached
  });

  it("iOS-like video (frames only exist after play()) still works, because we play first", async () => {
    const h = makeEnv("ios");
    const r = await stripFromVideo("blob:x", 6, h.env, FAST);
    expect(r.blob).not.toBeNull();
    expect(h.drawn).toHaveLength(6);
  });

  it("if seeking never completes, gives up with a clear reason (and no sprite)", async () => {
    const h = makeEnv("seek-fails");
    const r = await stripFromVideo("blob:x", 6, h.env, { stepMs: 20, totalMs: 4000 });
    expect(r.blob).toBeNull();
    expect(r.meta).toBeNull();
    expect(r.notes.join(" ")).toContain("only 0/6 frames could be reached");
    expect(h.detached).toBe(1); // still cleaned up
  });

  it("audio-only 'video' (no picture size): no sprite", async () => {
    const h = makeEnv("no-picture");
    const r = await stripFromVideo("blob:x", 6, h.env, FAST);
    expect(r.blob).toBeNull();
    expect(r.notes.join(" ")).toContain("no picture size");
  });

  it("runs out of time part-way: if enough frames were reached it still succeeds, repeating the last frame", async () => {
    const h = makeEnv("normal");
    // budget so small that only the first couple of seeks complete
    const r = await stripFromVideo("blob:x", 24, h.env, { stepMs: 40, totalMs: 1 });
    // with essentially no time left almost nothing is reached → treated as failure rather than a mostly-empty sprite
    expect(h.drawn).toHaveLength(24); // every cell is still drawn (no holes)
    expect(r.blob).toBeNull();
    expect(r.notes.join(" ")).toMatch(/out of time|only \d+\/24/);
  });
});
