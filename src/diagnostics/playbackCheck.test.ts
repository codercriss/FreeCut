import { describe, expect, it } from "vitest";
import type { Asset } from "../model/types";
import {
  analyzePlayback,
  browserName,
  findSampleAsset,
  fmtBytes,
  fmtMs,
  formatReport,
  gradeHigh,
  gradeLow,
  guard,
  iosAtLeast,
  median,
  parseIos,
  percentile,
  runPlaybackCheck,
  runToneTest,
  skippedFrames,
  statusSymbol,
  worse,
  type AudioContextLike,
  type CheckRow,
  type PlaybackEnv,
  type PlayFramesResult,
  type PlayRunOptions,
  type PlaySample,
  type SampleTools,
} from "./playbackCheck";

const IPHONE_X_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/153.0.0.0 Safari/537.36";

/* ───────────── fakes ───────────── */

interface Rig {
  env: PlaybackEnv;
  calls: string[];
  session: { type: string };
  ctx: AudioContextLike & { state: string };
}

const even = (count: number, step: number): number[] =>
  Array.from({ length: count }, (_, i) => Math.round(i * step * 1000) / 1000);

/** `count` presented frames, `gapMs` apart in real time, each advancing the video by `step` seconds. */
function series(count: number, gapMs: number, step: number, startMs = 80): PlaySample[] {
  return Array.from({ length: count }, (_, i) => ({
    atMs: Math.round(startMs + i * gapMs),
    mediaS: Math.round(i * step * 1000) / 1000,
  }));
}

function makePlay(over: Partial<PlayFramesResult> = {}): PlayFramesResult {
  return {
    via: "rvfc",
    samples: series(90, 33.3, 1 / 30),
    waiting: 0,
    stalled: 0,
    quality: { total: 90, dropped: 0 },
    ...over,
  };
}

function makeSample(over: Partial<SampleTools> = {}): SampleTools & { closed: number } {
  const sample = {
    closed: 0,
    info: { name: "IMG_0042.MOV", bytes: 48 * 1024 * 1024, mime: "video/quicktime" },
    decodeAudio: async () => ({
      kind: "ok" as const,
      seconds: 13.4,
      channels: 2,
      sampleRate: 48000,
      ms: 310,
    }),
    open: async () => ({ width: 1920, height: 1080, durationS: 13.4 }),
    playFrames: async () => makePlay(),
    copyMs: async () => [3, 4, 5, 4, 6],
    seekMs: async () => [80, 90, 100, 120, 95, 110],
    textureMs: async () => [2, 3, 2, 3] as number[] | null,
    close() {
      sample.closed += 1;
    },
  };
  return Object.assign(sample, over);
}

function makeEnv(over: Partial<PlaybackEnv> = {}): Rig {
  const calls: string[] = [];
  const session = { type: "auto" };
  const ctx = {
    state: "suspended",
    sampleRate: 48000,
    resume() {
      calls.push("resume");
      ctx.state = "running";
      return Promise.resolve();
    },
    close() {
      calls.push("close");
      return Promise.resolve();
    },
  };
  const env: PlaybackEnv = {
    userAgent: IPHONE_X_UA,
    platform: "iPhone",
    standalone: false,
    devicePixelRatio: 3,
    screenWidth: 375,
    screenHeight: 812,
    cores: 6,
    createAudioContext: () => {
      calls.push("createAudioContext");
      return ctx;
    },
    audioSession: () => {
      calls.push("audioSession");
      return session;
    },
    elementVolumeWritable: () => false,
    canPlayType: () => "probably",
    hasRequestVideoFrameCallback: () => true,
    webgl: () => ({ version: 2, maxTextureSize: 8192 }),
    webCodecs: () => ({
      videoDecoder: true,
      audioDecoder: false,
      videoEncoder: true,
      audioEncoder: false,
    }),
    videoDecoderSupported: async (t) => t.codec.startsWith("avc1"),
    audioDecoderSupported: async () => true,
    loadSample: async () => makeSample(),
    playTone: async () => undefined,
    ...over,
  };
  return { env, calls, session, ctx };
}

async function run(rig: Rig, timeoutMs = 500): Promise<CheckRow[]> {
  return runPlaybackCheck(rig.env, () => undefined, { timeoutMs, playMs: 10 });
}

function row(rows: CheckRow[], id: string): CheckRow {
  const found = rows.find((r) => r.id === id);
  if (!found) throw new Error(`no row ${id}; have ${rows.map((r) => r.id).join(", ")}`);
  return found;
}

/* ───────────── pure helpers ───────────── */

describe("parseIos / iosAtLeast", () => {
  it("reads an iPhone X on iOS 16.7", () => {
    expect(parseIos(IPHONE_X_UA)).toEqual({ isIos: true, major: 16, minor: 7 });
  });

  it("is not iOS on desktop Chrome", () => {
    expect(parseIos(DESKTOP_CHROME_UA)).toEqual({ isIos: false, major: 0, minor: 0 });
  });

  it("is iOS with an unknown version when the UA has no OS number", () => {
    expect(parseIos("Mozilla/5.0 (iPhone) Safari")).toEqual({ isIos: true, major: 0, minor: 0 });
  });

  it("compares versions, and never 'at least' for unknown or non-iOS", () => {
    const v = parseIos(IPHONE_X_UA);
    expect(iosAtLeast(v, 16, 4)).toBe(true);
    expect(iosAtLeast(v, 16, 7)).toBe(true);
    expect(iosAtLeast(v, 16, 8)).toBe(false);
    expect(iosAtLeast(v, 17, 0)).toBe(false);
    expect(iosAtLeast(parseIos("Mozilla/5.0 (iPhone) Safari"), 16, 4)).toBe(false);
    expect(iosAtLeast(parseIos(DESKTOP_CHROME_UA), 16, 4)).toBe(false);
  });
});

describe("browserName", () => {
  it("tells the common browsers apart", () => {
    expect(browserName(IPHONE_X_UA)).toBe("Safari 16.6");
    expect(browserName(DESKTOP_CHROME_UA)).toBe("Chrome");
    expect(browserName("Mozilla/5.0 (iPhone) CriOS/120 Mobile Safari/604.1")).toBe("Chrome (iOS)");
  });
});

describe("numbers", () => {
  it("median handles odd, even and empty", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
  });

  it("percentile is nearest-rank and clamps", () => {
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(xs, 95)).toBe(10);
    expect(percentile(xs, 50)).toBe(5);
    expect(percentile(xs, 0)).toBe(1);
    expect(Number.isNaN(percentile([], 95))).toBe(true);
  });

  it("formats milliseconds and bytes for people", () => {
    expect(fmtMs(3.14159)).toBe("3.1 ms");
    expect(fmtMs(42.4)).toBe("42 ms");
    expect(fmtMs(Number.NaN)).toBe("–");
    expect(fmtBytes(48 * 1024 * 1024)).toBe("48.0 MB");
    expect(fmtBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
    expect(fmtBytes(10)).toBe("1 KB");
  });

  it("grades lower-is-better and higher-is-better, and leaves NaN as info", () => {
    expect(gradeLow(5, 8, 20)).toBe("ok");
    expect(gradeLow(8, 8, 20)).toBe("ok");
    expect(gradeLow(15, 8, 20)).toBe("warn");
    expect(gradeLow(21, 8, 20)).toBe("fail");
    expect(gradeLow(Number.NaN, 8, 20)).toBe("info");
    expect(gradeHigh(1, 0.95, 0.8)).toBe("ok");
    expect(gradeHigh(0.9, 0.95, 0.8)).toBe("warn");
    expect(gradeHigh(0.5, 0.95, 0.8)).toBe("fail");
  });
});

describe("skippedFrames", () => {
  it("finds nothing skipped when frames arrive evenly", () => {
    expect(skippedFrames(even(31, 1 / 30))).toEqual({ skipped: 0, expected: 30 });
  });

  it("counts the frames missing from a gap", () => {
    // 0, 1, 2, then a gap of three steps (two frames never shown), then 6, 7.
    const times = [0, 1, 2, 5, 6, 7].map((n) => n / 30);
    expect(skippedFrames(times)).toEqual({ skipped: 2, expected: 7 });
  });

  it("is not fooled by repeated timestamps, and copes with too little data", () => {
    expect(skippedFrames([0, 0, 1 / 30, 2 / 30, 3 / 30]).skipped).toBe(0);
    expect(skippedFrames([])).toEqual({ skipped: 0, expected: 0 });
    expect(skippedFrames([0.5])).toEqual({ skipped: 0, expected: 0 });
    expect(skippedFrames([0, 1 / 30])).toEqual({ skipped: 0, expected: 1 });
  });
});

describe("analyzePlayback", () => {
  it("reads a healthy run as real time with a quick start", () => {
    const stats = analyzePlayback(series(61, 33.3, 1 / 30));
    expect(stats.frames).toBe(60);
    expect(Math.abs(stats.realtime - 1) < 0.01).toBe(true);
    expect(Math.abs(stats.steadyRealtime - 1) < 0.01).toBe(true);
    expect(stats.firstFrameMs).toBe(80);
    expect(stats.movingMs < 250).toBe(true);
    expect(stats.skipped).toBe(0);
  });

  it("separates a slow start from a slow crawl", () => {
    // 15 frames crawling at ~0.33×, then 45 frames at full speed.
    const crawl = series(15, 100, 1 / 30);
    const last = crawl[crawl.length - 1];
    const normal = Array.from({ length: 45 }, (_, i) => ({
      atMs: Math.round(last.atMs + (i + 1) * 33.3),
      mediaS: last.mediaS + (i + 1) / 30,
    }));
    const stats = analyzePlayback([...crawl, ...normal]);
    expect(stats.realtime < 0.75).toBe(true);
    expect(Math.abs(stats.steadyRealtime - 1) < 0.02).toBe(true);
  });

  it("reports a steady crawl as slow in both views", () => {
    const stats = analyzePlayback(series(26, 80, 1 / 30));
    expect(Math.abs(stats.realtime - 0.417) < 0.02).toBe(true);
    expect(Math.abs(stats.steadyRealtime - 0.417) < 0.02).toBe(true);
  });

  it("knows when the picture never really moved", () => {
    const stats = analyzePlayback(series(10, 33, 0.001));
    expect(Number.isNaN(stats.movingMs)).toBe(true);
  });

  it("copes with no frames and with one frame", () => {
    const none = analyzePlayback([]);
    expect(none.frames).toBe(0);
    expect(Number.isNaN(none.firstFrameMs)).toBe(true);
    expect(Number.isNaN(none.realtime)).toBe(true);
    const one = analyzePlayback([{ atMs: 250, mediaS: 1 }]);
    expect(one.frames).toBe(0);
    expect(one.firstFrameMs).toBe(250);
  });
});

describe("worse", () => {
  it("keeps the more serious grade", () => {
    expect(worse("ok", "warn")).toBe("warn");
    expect(worse("fail", "warn")).toBe("fail");
    expect(worse("ok", "info")).toBe("ok");
    expect(worse("warn", "ok")).toBe("warn");
  });
});

describe("findSampleAsset", () => {
  const asset = (over: Partial<Asset>): Asset => ({
    id: "a",
    kind: "video",
    name: "clip",
    durationFrames: 300,
    source: { type: "stored", mediaId: "m1" },
    bytes: 10,
    ...over,
  });

  it("picks the largest stored video", () => {
    const small = asset({ id: "s", bytes: 10 });
    const big = asset({ id: "b", bytes: 5000, source: { type: "stored", mediaId: "m2" } });
    expect(findSampleAsset([small, big])?.id).toBe("b");
  });

  it("ignores demo footage, audio and photos", () => {
    const demo = asset({ id: "d", source: { type: "generated", scene: "s", thumb: "t" } });
    const song = asset({ id: "s", kind: "audio" });
    const photo = asset({ id: "p", kind: "image" });
    expect(findSampleAsset([demo, song, photo])).toBeNull();
    expect(findSampleAsset([])).toBeNull();
  });
});

describe("guard", () => {
  it("returns the value", async () => {
    expect(await guard(() => 7, 100, "x")).toEqual({ ok: true, value: 7 });
    expect(await guard(async () => "a", 100, "x")).toEqual({ ok: true, value: "a" });
  });

  it("turns a throw or a rejection into an error result", async () => {
    const thrown = await guard(
      () => {
        throw new Error("boom");
      },
      100,
      "x",
    );
    expect(thrown).toEqual({ ok: false, error: "boom" });
    const rejected = await guard(() => Promise.reject(new Error("nope")), 100, "x");
    expect(rejected).toEqual({ ok: false, error: "nope" });
  });

  it("gives up on a call that never answers", async () => {
    const result = await guard(() => new Promise<number>(() => undefined), 20, "Seeking");
    expect(result).toEqual({ ok: false, error: "Seeking timed out after 20 ms" });
  });
});

/* ───────────── the runner ───────────── */

describe("runPlaybackCheck — iOS gesture rule", () => {
  it("starts audio before anything is awaited", async () => {
    const rig = makeEnv();
    const done = runPlaybackCheck(rig.env, () => undefined, { timeoutMs: 500, playMs: 10 });
    // No await has happened yet, so all of this ran inside the tap's own call stack.
    expect(rig.calls).toEqual(["audioSession", "createAudioContext", "resume"]);
    expect(rig.session.type).toBe("playback");
    await done;
  });

  it("emits rows as they are produced, then returns them all", async () => {
    const rig = makeEnv();
    const seen: string[] = [];
    const rows = await runPlaybackCheck(rig.env, (r) => seen.push(r.id), {
      timeoutMs: 500,
      playMs: 10,
    });
    expect(seen).toEqual(rows.map((r) => r.id));
    expect(seen[0]).toBe("device.platform");
  });

  it("gives the AudioContext back at the end", async () => {
    const rig = makeEnv();
    await run(rig);
    expect(rig.calls[rig.calls.length - 1]).toBe("close");
  });
});

describe("runPlaybackCheck — audio rows", () => {
  it("reports a working unlock and the silent-switch fix", async () => {
    const rows = await run(makeEnv());
    expect(row(rows, "audio.context").status).toBe("ok");
    expect(row(rows, "audio.session").status).toBe("ok");
    expect(row(rows, "audio.session").detail).toContain("playback");
  });

  it("warns when the context is still suspended after the tap", async () => {
    const rig = makeEnv();
    rig.ctx.resume = () => Promise.resolve();
    const rows = await run(rig);
    expect(row(rows, "audio.context").status).toBe("warn");
    expect(row(rows, "audio.context").detail).toContain("suspended");
  });

  it("fails the unlock but still runs everything else when no context can be made", async () => {
    const rows = await run(makeEnv({ createAudioContext: () => null }));
    expect(row(rows, "audio.context").status).toBe("fail");
    expect(row(rows, "codec.video").status).toBe("info");
    expect(row(rows, "sample.pick").status).toBe("info");
  });

  it("survives AudioContext construction throwing", async () => {
    const rows = await run(
      makeEnv({
        createAudioContext: () => {
          throw new Error("not allowed");
        },
      }),
    );
    expect(row(rows, "audio.context").detail).toContain("not allowed");
  });

  it("explains a missing audioSession by iOS version", async () => {
    const old = IPHONE_X_UA.replace("16_7", "16_2");
    const on16_2 = await run(makeEnv({ userAgent: old, audioSession: () => null }));
    expect(row(on16_2, "audio.session").status).toBe("warn");
    expect(row(on16_2, "audio.session").detail).toContain("before iOS 16.4");
    const on16_7 = await run(makeEnv({ audioSession: () => null }));
    expect(row(on16_7, "audio.session").detail).toContain("should have it");
    const desktop = await run(makeEnv({ userAgent: DESKTOP_CHROME_UA, audioSession: () => null }));
    expect(row(desktop, "audio.session").status).toBe("info");
  });

  it("flags an ignored element volume", async () => {
    const ignored = await run(makeEnv({ elementVolumeWritable: () => false }));
    expect(row(ignored, "audio.volume").status).toBe("warn");
    const works = await run(makeEnv({ elementVolumeWritable: () => true }));
    expect(row(works, "audio.volume").status).toBe("ok");
    const untried = await run(makeEnv({ elementVolumeWritable: () => null }));
    expect(row(untried, "audio.volume").status).toBe("skip");
  });
});

describe("runPlaybackCheck — codec rows", () => {
  it("fails HEVC when the browser says it cannot play it", async () => {
    const canPlay = (mime: string) => (mime.includes("hvc1") ? "" : "probably");
    const rows = await run(makeEnv({ canPlayType: canPlay }));
    expect(row(rows, "codec.hevc").status).toBe("fail");
    expect(row(rows, "codec.video").detail).toContain("HEVC ✘");
    expect(row(rows, "codec.video").detail).toContain("H.264 ✔");
  });

  it("prints WebCodecs answers, including a rejected config with its reason", async () => {
    const rows = await run(
      makeEnv({
        videoDecoderSupported: async (t) => {
          if (t.codec.startsWith("hvc1")) throw new Error("Config is not valid");
          return t.codec.startsWith("avc1");
        },
      }),
    );
    const detail = row(rows, "codec.webcodecs.video").detail;
    expect(detail).toContain("H.264 1080p ✔");
    expect(detail).toContain("HEVC 1080p ✘ (Config is not valid)");
    expect(detail).toContain("AV1 ✘");
  });

  it("skips the WebCodecs probes when the classes are missing, and warns", async () => {
    const none = {
      videoDecoder: false,
      audioDecoder: false,
      videoEncoder: false,
      audioEncoder: false,
    };
    const rows = await run(makeEnv({ webCodecs: () => none }));
    expect(row(rows, "codec.webcodecs").status).toBe("warn");
    expect(rows.some((r) => r.id === "codec.webcodecs.video")).toBe(false);
    expect(rows.some((r) => r.id === "codec.webcodecs.audio")).toBe(false);
  });

  it("does not hang on a WebCodecs call that never answers", async () => {
    const hang = () => new Promise<boolean>(() => undefined);
    const rows = await run(makeEnv({ videoDecoderSupported: hang }), 30);
    expect(row(rows, "codec.webcodecs.video").detail).toContain("timed out after 30 ms");
  });

  it("reports the frame callback", async () => {
    const yes = await run(makeEnv({ hasRequestVideoFrameCallback: () => true }));
    expect(row(yes, "video.rvfc").status).toBe("ok");
    const no = await run(makeEnv({ hasRequestVideoFrameCallback: () => false }));
    expect(row(no, "video.rvfc").status).toBe("warn");
  });
});

describe("runPlaybackCheck — your video", () => {
  it("grades a healthy phone as all ok", async () => {
    const rows = await run(makeEnv());
    const ids = ["sample.audio", "sample.open", "speed.play.hidden", "speed.play.visible"];
    for (const id of [...ids, "speed.play.again", "speed.play.draw", "speed.copy"]) {
      expect(row(rows, id).status).toBe("ok");
    }
    expect(row(rows, "speed.seek").status).toBe("ok");
    expect(row(rows, "speed.texture").status).toBe("ok");
    expect(row(rows, "sample.open").detail).toBe("1920×1080 · 13.4 s");
    expect(row(rows, "speed.play.hidden").detail).toContain("0 of 89 frames skipped (0%)");
    expect(row(rows, "sample.pick").detail).toContain("IMG_0042.MOV");
    expect(row(rows, "sample.pick").detail).toContain("48.0 MB");
  });

  it("says what to do when there is no imported video", async () => {
    const rows = await run(makeEnv({ loadSample: async () => null }));
    expect(row(rows, "sample.pick").status).toBe("skip");
    expect(row(rows, "sample.pick").detail).toContain("Import one");
    expect(rows.some((r) => r.id === "speed.copy")).toBe(false);
  });

  it("plays hidden, visible, hidden again, then visible with drawing", async () => {
    const seen: PlayRunOptions[] = [];
    const sample = makeSample({
      playFrames: async (opts) => {
        seen.push(opts);
        return makePlay();
      },
    });
    await run(makeEnv({ loadSample: async () => sample }));
    expect(seen).toEqual([
      { ms: 10, visible: false, draw: false },
      { ms: 10, visible: true, draw: false },
      { ms: 10, visible: false, draw: false },
      { ms: 10, visible: true, draw: true },
    ]);
  });

  it("shows a throttled hidden video: slow hidden, fine visible, slow hidden again", async () => {
    const crawl = series(40, 80, 1 / 30);
    const fast = series(90, 33.3, 1 / 30);
    const sample = makeSample({
      playFrames: async (opts) => makePlay({ samples: opts.visible ? fast : crawl }),
    });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").status).toBe("fail");
    expect(row(rows, "speed.play.hidden").detail).toContain("0.42×");
    expect(row(rows, "speed.play.visible").status).toBe("ok");
    expect(row(rows, "speed.play.again").status).toBe("fail");
    expect(row(rows, "speed.play.draw").status).toBe("ok");
  });

  it("shows a first-play warm-up: only the first run is slow", async () => {
    let calls = 0;
    const slow = series(40, 80, 1 / 30);
    const fast = series(90, 33.3, 1 / 30);
    const sample = makeSample({
      playFrames: async () => {
        calls += 1;
        return makePlay({ samples: calls === 1 ? slow : fast });
      },
    });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").status).toBe("fail");
    expect(row(rows, "speed.play.visible").status).toBe("ok");
    expect(row(rows, "speed.play.again").status).toBe("ok");
  });

  it("grades a slow start by the second half, and prints both speeds", async () => {
    const crawl = series(15, 100, 1 / 30);
    const last = crawl[crawl.length - 1];
    const normal = Array.from({ length: 45 }, (_, i) => ({
      atMs: Math.round(last.atMs + (i + 1) * 33.3),
      mediaS: last.mediaS + (i + 1) / 30,
    }));
    const samples = [...crawl, ...normal];
    const sample = makeSample({ playFrames: async () => makePlay({ samples }) });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    const detail = row(rows, "speed.play.hidden").detail;
    expect(row(rows, "speed.play.hidden").status).toBe("ok");
    expect(detail).toContain("overall, 1.0");
  });

  it("warns when the picture takes a while to start moving", async () => {
    const late = series(90, 33.3, 1 / 30, 700);
    const sample = makeSample({ playFrames: async () => makePlay({ samples: late }) });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").status).toBe("warn");
    expect(row(rows, "speed.play.hidden").detail).toContain("first frame after 700 ms");
  });

  it("grades slow numbers as warnings and failures, and prints them", async () => {
    const sample = makeSample({
      playFrames: async () => makePlay({ samples: series(31, 66.7, 1 / 30) }),
      copyMs: async () => [30, 32, 35, 31, 40],
      seekMs: async () => [300, 350, 320, 310, 330, 340],
      textureMs: async () => [10, 12, 11, 9],
    });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").status).toBe("fail");
    expect(row(rows, "speed.play.hidden").detail).toContain("0.50×");
    expect(row(rows, "speed.copy").status).toBe("fail");
    expect(row(rows, "speed.copy").detail).toContain("median 32 ms");
    expect(row(rows, "speed.seek").status).toBe("warn");
    expect(row(rows, "speed.texture").status).toBe("warn");
  });

  it("catches a stutter that a steady clock would hide", async () => {
    // Real time keeps going, but every 4th frame was never shown.
    const shown = series(61, 33.3, 1 / 30).filter((_, i) => i % 4 !== 3);
    const sample = makeSample({ playFrames: async () => makePlay({ samples: shown }) });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").status).toBe("fail");
    expect(row(rows, "speed.play.hidden").detail).toContain("clock 1.00×");
    expect(row(rows, "speed.play.hidden").detail).toContain("frames skipped (25%)");
  });

  it("only warns when a few frames were skipped", async () => {
    const times = series(61, 33.3, 1 / 30);
    times.splice(20, 3); // three frames missing out of ~60 → about 5%
    const sample = makeSample({ playFrames: async () => makePlay({ samples: times }) });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").status).toBe("warn");
  });

  it("prints the browser's own stall and dropped-frame counts when it has them", async () => {
    const stalled = makePlay({ waiting: 3, stalled: 1, quality: { total: 90, dropped: 5 } });
    const sample = makeSample({ playFrames: async () => stalled });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    const detail = row(rows, "speed.play.hidden").detail;
    expect(detail).toContain("waiting 3× · stalled 1×");
    expect(detail).toContain("decoder dropped 5 of 90");
  });

  it("leaves out the decoder count when the browser has none", async () => {
    const sample = makeSample({ playFrames: async () => makePlay({ quality: null }) });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").detail.includes("decoder dropped")).toBe(false);
  });

  it("fails a run that was refused but still does the others", async () => {
    const sample = makeSample({
      playFrames: async (opts) => {
        if (!opts.visible) throw new Error("play() was refused");
        return makePlay();
      },
    });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").status).toBe("fail");
    expect(row(rows, "speed.play.hidden").detail).toBe("play() was refused");
    expect(row(rows, "speed.play.visible").status).toBe("ok");
  });

  it("fails the drawing run on its own when drawing is what breaks", async () => {
    const sample = makeSample({
      playFrames: async (opts) => {
        if (opts.draw) throw new Error("no canvas");
        return makePlay();
      },
    });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.draw").status).toBe("fail");
    expect(row(rows, "speed.play.draw").detail).toBe("no canvas");
    expect(row(rows, "speed.play.visible").status).toBe("ok");
    expect(row(rows, "speed.copy").status).toBe("ok");
  });

  it("reports a failed copy measurement and carries on", async () => {
    const copyMs = async (): Promise<number[]> => {
      throw new Error("canvas lost");
    };
    const rows = await run(makeEnv({ loadSample: async () => makeSample({ copyMs }) }));
    expect(row(rows, "speed.copy").status).toBe("fail");
    expect(row(rows, "speed.copy").detail).toBe("canvas lost");
    expect(row(rows, "speed.seek").status).toBe("ok");
  });

  it("says so when no copies could be measured", async () => {
    const sample = makeSample({ copyMs: async () => [] });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.copy").status).toBe("info");
    expect(row(rows, "speed.copy").detail).toBe("No copies were measured.");
  });

  it("fails playback that delivered no frames at all", async () => {
    const sample = makeSample({ playFrames: async () => makePlay({ samples: [], quality: null }) });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "speed.play.hidden").status).toBe("fail");
    expect(row(rows, "speed.play.draw").status).toBe("fail");
  });

  it("skips the speed rows when the video will not open, and still closes it", async () => {
    const sample = makeSample({
      open: async () => {
        throw new Error("decode error");
      },
    });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "sample.open").status).toBe("fail");
    const blocked = ["speed.play.hidden", "speed.play.visible", "speed.play.again"];
    for (const id of [...blocked, "speed.play.draw", "speed.copy", "speed.seek", "speed.texture"]) {
      expect(row(rows, id).status).toBe("skip");
    }
    expect(sample.closed).toBe(1);
  });

  it("closes the video after a normal run too", async () => {
    const sample = makeSample();
    await run(makeEnv({ loadSample: async () => sample }));
    expect(sample.closed).toBe(1);
  });

  it("reports a skipped audio decode for a huge file", async () => {
    const sample = makeSample({
      decodeAudio: async () => ({ kind: "too-big" as const, limitBytes: 120 * 1024 * 1024 }),
    });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "sample.audio").status).toBe("skip");
    expect(row(rows, "sample.audio").detail).toContain("120.0 MB");
  });

  it("warns when no sound could be decoded", async () => {
    const sample = makeSample({
      decodeAudio: async () => ({ kind: "none" as const, reason: "EncodingError" }),
    });
    const rows = await run(makeEnv({ loadSample: async () => sample }));
    expect(row(rows, "sample.audio").status).toBe("warn");
    expect(row(rows, "sample.audio").detail).toContain("EncodingError");
  });

  it("turns a hung seek into a failed row instead of freezing, and carries on", async () => {
    const sample = makeSample({ seekMs: () => new Promise<number[]>(() => undefined) });
    const rows = await run(makeEnv({ loadSample: async () => sample }), 30);
    expect(row(rows, "speed.seek").status).toBe("fail");
    expect(row(rows, "speed.seek").detail).toContain("timed out");
    expect(row(rows, "speed.texture").status).toBe("ok");
    expect(sample.closed).toBe(1);
  });

  it("skips the texture test without WebGL", async () => {
    const sample = makeSample({ textureMs: async () => null });
    const rows = await run(makeEnv({ loadSample: async () => sample, webgl: () => null }));
    expect(row(rows, "speed.texture").status).toBe("skip");
    expect(row(rows, "device.webgl").status).toBe("warn");
  });

  it("reports a failure to read the stored video", async () => {
    const loadSample = async (): Promise<SampleTools | null> => {
      throw new Error("IndexedDB is unavailable");
    };
    const rows = await run(makeEnv({ loadSample }));
    expect(row(rows, "sample.pick").status).toBe("fail");
    expect(row(rows, "sample.pick").detail).toContain("IndexedDB");
  });
});

describe("runPlaybackCheck — a crashing section", () => {
  it("becomes a failed row and the other sections still run", async () => {
    const webgl = (): never => {
      throw new Error("getContext exploded");
    };
    const rows = await run(makeEnv({ webgl }));
    expect(row(rows, "device.crash").status).toBe("fail");
    expect(row(rows, "device.crash").detail).toContain("getContext exploded");
    expect(row(rows, "audio.context").status).toBe("ok");
    expect(row(rows, "codec.video").status).toBe("info");
    expect(row(rows, "speed.seek").status).toBe("ok");
  });

  it("still gives the AudioContext back", async () => {
    const rig = makeEnv({
      webCodecs: () => {
        throw new Error("nope");
      },
    });
    const rows = await run(rig);
    expect(row(rows, "codecs.crash").status).toBe("fail");
    expect(rig.calls[rig.calls.length - 1]).toBe("close");
  });
});

describe("runPlaybackCheck — device rows", () => {
  it("describes an iPhone in a browser tab and in the Home Screen app", async () => {
    const tab = await run(makeEnv());
    const expected = "iOS 16.7 · Safari 16.6 · browser tab · 375×812 @3× · 6 cores";
    expect(row(tab, "device.platform").detail).toBe(expected);
    const app = await run(makeEnv({ standalone: true, cores: null }));
    expect(row(app, "device.platform").detail).toContain("Home Screen app");
    expect(row(app, "device.platform").detail).not.toContain("cores");
  });
});

/* ───────────── tone test + report ───────────── */

describe("runToneTest", () => {
  it("starts the tone inside the tap, before anything is awaited", async () => {
    const started: string[] = [];
    const rig = makeEnv({
      playTone: async (kind) => {
        started.push(kind);
      },
    });
    const done = runToneTest(rig.env, "webaudio");
    expect(started).toEqual(["webaudio"]);
    const r = await done;
    expect(r.id).toBe("tone.webaudio");
    expect(r.status).toBe("info");
  });

  it("reports a refused tone as a failure with the reason", async () => {
    const rig = makeEnv({
      playTone: async () => {
        throw new Error("NotAllowedError");
      },
    });
    const r = await runToneTest(rig.env, "element");
    expect(r.id).toBe("tone.element");
    expect(r.status).toBe("fail");
    expect(r.detail).toBe("NotAllowedError");
  });

  it("gives up on a tone that never starts", async () => {
    const rig = makeEnv({ playTone: () => new Promise<void>(() => undefined) });
    const r = await runToneTest(rig.env, "webaudio", 20);
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("timed out");
  });
});

describe("formatReport", () => {
  it("writes a header, the user agent and one line per row", () => {
    const rows: CheckRow[] = [
      { id: "a", group: "audio", label: "Web Audio unlock", status: "ok", detail: "Running" },
      { id: "b", group: "speed", label: "Scrubbing", status: "fail", detail: "slow" },
    ];
    const text = formatReport(rows, { version: "1.3.0", when: "2026-10-30", userAgent: "UA" });
    const lines = text.split("\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("FreeCut playback check · v1.3.0 · 2026-10-30");
    expect(lines[1]).toBe("UA");
    expect(lines[2]).toBe("");
    expect(lines[3]).toBe("✔ Web Audio unlock: Running");
    expect(lines[4]).toBe("✘ Scrubbing: slow");
  });

  it("has a distinct symbol for every status", () => {
    const symbols = (["ok", "warn", "fail", "info", "skip"] as const).map(statusSymbol);
    expect(new Set(symbols).size).toBe(5);
  });
});
