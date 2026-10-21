import { describe, expect, it } from "vitest";
import { isBlankPixels, posterFromVideo, type PosterEnv, type VideoLike } from "./poster";

type Listener = () => void;

/**
 * A scriptable stand-in for <video>. `behaviour` decides which browser quirks to simulate:
 *  - normal: loads frames by itself, seeks work.
 *  - ios:    like iOS Safari for a video nobody asked to play — metadata only until play() is called.
 *  - never:  metadata only, ever (a decoder that won't cooperate).
 */
class FakeVideo implements VideoLike {
  src = "";
  muted = false;
  playsInline = false;
  preload = "";
  readyState = 0;
  videoWidth = 0;
  videoHeight = 0;
  private _t = 0;
  played = false;
  paused = true;
  private listeners = new Map<string, Set<Listener>>();
  constructor(
    public behaviour: "normal" | "ios" | "never" | "play-refused" | "no-picture",
    private log: string[],
  ) {}
  addEventListener(type: string, fn: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Listener) {
    this.listeners.get(type)?.delete(fn);
  }
  private emit(type: string, after = 1) {
    setTimeout(() => this.listeners.get(type)?.forEach((f) => f()), after);
  }
  set currentTime(v: number) {
    this._t = v;
    this.log.push(`seek ${v}`);
    // iOS: a seek needs decoded data to complete
    if (this.behaviour === "never" || (this.behaviour !== "normal" && this.readyState < 2)) return;
    this.emit("seeked");
  }
  get currentTime() {
    return this._t;
  }
  async play() {
    this.log.push("play");
    if (this.behaviour === "play-refused") throw new DOMException("not allowed", "NotAllowedError");
    this.played = true;
    this.paused = false;
    if (this.behaviour === "ios") {
      this.readyState = 4;
      this.emit("loadeddata");
      this.emit("playing");
    }
  }
  pause() {
    this.paused = true;
    this.log.push("pause");
  }
  /** Called by the env when `src` is assigned. */
  start() {
    if (this.behaviour === "no-picture") {
      this.videoWidth = 0;
      this.readyState = 1;
      this.emit("loadedmetadata");
      return;
    }
    this.videoWidth = 320;
    this.videoHeight = 240;
    this.readyState = 1;
    this.emit("loadedmetadata");
    if (this.behaviour === "normal") {
      this.readyState = 4;
      this.emit("loadeddata", 5);
    }
  }
}

function makeEnv(
  behaviours: Array<FakeVideo["behaviour"]>,
  opts: { blankOnAttempt?: number[] } = {},
) {
  const log: string[] = [];
  let n = 0;
  const attached: FakeVideo[] = [];
  const detached: FakeVideo[] = [];
  const env: PosterEnv = {
    createVideo: () => {
      const v = new FakeVideo(behaviours[Math.min(n, behaviours.length - 1)], log);
      n += 1;
      return v;
    },
    attach: (v) => {
      attached.push(v as FakeVideo);
      // the real env sets src after attach; start loading shortly after src is set
      const fv = v as FakeVideo;
      const desc = Object.getOwnPropertyDescriptor(fv, "src");
      void desc;
      let value = "";
      Object.defineProperty(fv, "src", {
        get: () => value,
        set: (x: string) => {
          value = x;
          fv.start();
        },
      });
    },
    detach: (v) => void detached.push(v as FakeVideo),
    snapshot: async (v) => {
      const attempt = attached.length; // 1 for the first strategy, 2 for the second
      // like a real canvas: if the browser never decoded a frame, what we draw is an empty (blank) picture
      const noFrame = (v as FakeVideo).readyState < 2;
      return {
        blob: new Blob([`frame${attempt}`]),
        blank: noFrame || (opts.blankOnAttempt ?? []).includes(attempt),
      };
    },
  };
  return { env, log, attached, detached };
}

const FAST = { stepMs: 40, totalMs: 1500 };
const run = (env: PosterEnv) => posterFromVideo("blob:x", 10, env, 320, FAST);

describe("posterFromVideo", () => {
  it("normal browser: makes a picture on the first try", async () => {
    const { env, log, attached } = makeEnv(["normal"]);
    const r = await run(env);
    expect(r.blob).not.toBeNull();
    expect(attached).toHaveLength(1);
    expect(log).toContain("play");
    expect(log).toContain("seek 1");
    expect(r.notes[0]).toMatch(/^play: metadata 320×240, play\(\) ok.*picture ok$/);
  });

  it("iOS-like (frames only exist after play()): still succeeds, because we play first", async () => {
    const { env, log } = makeEnv(["ios"]);
    const r = await run(env);
    expect(r.blob).not.toBeNull();
    expect(log.indexOf("play")).toBeLessThan(log.indexOf("seek 1")); // play → pause → seek, in that order
    expect(log.indexOf("pause")).toBeLessThan(log.indexOf("seek 1"));
    expect(r.notes.join(" ")).toContain("play() ok");
  });

  it("the OLD approach would have failed on the iOS-like video (documents the bug we fixed)", async () => {
    const { env } = makeEnv(["ios"]);
    // seek-only, never playing: emulate by using only the second strategy's behaviour
    const v = env.createVideo() as FakeVideo;
    let seeked = false;
    v.addEventListener("seeked", () => (seeked = true));
    v.start();
    await new Promise((r) => setTimeout(r, 20));
    v.currentTime = 1; // readyState is 1, so an iOS-like video never completes the seek
    await new Promise((r) => setTimeout(r, 50));
    expect(seeked).toBe(false);
  });

  it("play() refused: falls back to seek-only and reports it", async () => {
    const { env, attached, detached } = makeEnv(["play-refused", "normal"]);
    const r = await run(env);
    expect(r.blob).not.toBeNull();
    expect(attached).toHaveLength(2); // second strategy used a fresh element
    expect(detached).toHaveLength(2); // every element is cleaned up
    expect(r.notes.join("\n")).toContain("play() refused (NotAllowedError)");
  });

  it("a decoder that never produces a frame: gives up within budget, with the reasons", async () => {
    const { env, detached } = makeEnv(["never"]);
    const t0 = Date.now();
    const r = await run(env);
    expect(Date.now() - t0).toBeLessThan(1400);
    // no frame was ever decoded -> the empty canvas must NOT be returned as a "picture" (the UI then offers the fallbacks)
    expect(r.blob).toBeNull();
    expect(detached).toHaveLength(2); // both strategies tried, both cleaned up
    expect(r.notes.join("\n")).toContain("no frame ready");
    expect(r.notes.join("\n")).toContain("frame was blank");
  });

  it("a blank frame is distrusted and retried; a good second try wins", async () => {
    const { env, attached } = makeEnv(["normal", "normal"], { blankOnAttempt: [1] });
    const r = await run(env);
    expect(attached).toHaveLength(2);
    expect(r.blob).not.toBeNull();
    expect(await r.blob!.text()).toBe("frame2");
    expect(r.notes[0]).toContain("frame was blank");
  });

  it("if every try is blank but frames WERE decoded, a black picture is returned (a video can start black)", async () => {
    const { env } = makeEnv(["normal", "normal"], { blankOnAttempt: [1, 2] });
    const r = await run(env);
    expect(r.blob).not.toBeNull();
    expect(await r.blob!.text()).toBe("frame2");
  });

  it("audio-only 'video' (no picture size): no picture, clear note", async () => {
    const { env } = makeEnv(["no-picture"]);
    const r = await run(env);
    expect(r.blob).toBeNull();
    expect(r.notes.join(" ")).toContain("no picture size");
  });

  it("never exceeds the total budget", async () => {
    const { env } = makeEnv(["never"]);
    const t0 = Date.now();
    await posterFromVideo("blob:x", 10, env, 320, { stepMs: 200, totalMs: 300 });
    expect(Date.now() - t0).toBeLessThan(900);
  });
});

describe("isBlankPixels", () => {
  const px = (r: number, g: number, b: number, n = 100) =>
    Uint8ClampedArray.from(Array.from({ length: n }, () => [r, g, b, 255]).flat());
  it("all black is blank; anything bright is not", () => {
    expect(isBlankPixels(px(0, 0, 0))).toBe(true);
    expect(isBlankPixels(px(3, 2, 4))).toBe(true);
    expect(isBlankPixels(px(0, 40, 0))).toBe(false);
    expect(isBlankPixels(px(255, 255, 255))).toBe(false);
  });
  it("one bright pixel among black is not blank", () => {
    const d = px(0, 0, 0, 50);
    d[4 * 25] = 200;
    expect(isBlankPixels(d)).toBe(false);
  });
  it("empty data counts as blank", () =>
    expect(isBlankPixels(new Uint8ClampedArray(0))).toBe(true));
});
