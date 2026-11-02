import { describe, expect, it } from "vitest";
import type { AudioPlan, PlanItem } from "./audioPlan";
import {
  AudioEngine,
  peakToLevel,
  type AnalyserLike,
  type BufferLike,
  type ContextLike,
  type EngineEnv,
  type EngineLimits,
  type GainLike,
  type NodeLike,
  type SourceLike,
} from "./audioEngine";

/* ───────────── a fake Web Audio ───────────── */

class FakeNode implements NodeLike {
  connected: NodeLike[] = [];
  disconnects = 0;
  connect(to: NodeLike): unknown {
    this.connected.push(to);
    return to;
  }
  disconnect(): void {
    this.disconnects += 1;
  }
}

class FakeSource extends FakeNode implements SourceLike {
  buffer: BufferLike | null = null;
  playbackRate = { value: 1 };
  onended: ((ev: Event) => unknown) | null = null;
  startArgs: (number | undefined)[] | null = null;
  stops = 0;
  start(when?: number, offset?: number, duration?: number): void {
    this.startArgs = [when, offset, duration];
  }
  stop(): void {
    this.stops += 1;
  }
}

class FakeGain extends FakeNode implements GainLike {
  gain = { value: 1 };
}

class FakeAnalyser extends FakeNode implements AnalyserLike {
  fftSize = 0;
  peak = 0;
  getFloatTimeDomainData(into: Float32Array): void {
    into.fill(0);
    into[3] = -this.peak;
  }
}

class FakeCtx implements ContextLike {
  currentTime = 0;
  state = "suspended";
  destination = new FakeNode();
  resumes = 0;
  sources: FakeSource[] = [];
  analysers: FakeAnalyser[] = [];
  decoded: number[] = [];
  resume(): Promise<void> {
    this.resumes += 1;
    this.state = "running";
    return Promise.resolve();
  }
  async decodeAudioData(data: ArrayBuffer): Promise<BufferLike> {
    const seconds = new Uint8Array(data)[0];
    if (seconds === 0) throw new Error("EncodingError");
    this.decoded.push(seconds);
    return { duration: seconds, numberOfChannels: 2, length: seconds * 100 };
  }
  createBufferSource(): SourceLike {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createGain(): GainLike {
    return new FakeGain();
  }
  createAnalyser(): AnalyserLike {
    const a = new FakeAnalyser();
    this.analysers.push(a);
    return a;
  }
  createChannelSplitter(): NodeLike {
    return new FakeNode();
  }
}

/** A "file" whose first byte is its length in seconds (0 = cannot be decoded). */
const file = (seconds: number): Blob => new Blob([new Uint8Array([seconds, 1, 2, 3])]);

interface Rig {
  engine: AudioEngine;
  ctx: FakeCtx;
  env: EngineEnv;
  reads: string[];
  sessions: number;
}

function rig(files: Record<string, Blob | undefined>, limits?: EngineLimits): Rig {
  const ctx = new FakeCtx();
  const reads: string[] = [];
  const state = { sessions: 0 };
  const env: EngineEnv = {
    createContext: () => ctx,
    readBlob: async (id) => {
      reads.push(id);
      return files[id];
    },
    prepareSession: () => {
      state.sessions += 1;
    },
  };
  const engine = new AudioEngine(env, limits);
  return {
    engine,
    ctx,
    env,
    reads,
    get sessions() {
      return state.sessions;
    },
  };
}

const item = (over: Partial<PlanItem> = {}): PlanItem => ({
  clipId: "c",
  mediaId: "m1",
  whenSec: 0,
  offsetSec: 0,
  lengthSec: 5,
  rate: 1,
  ...over,
});
const planOf = (...items: PlanItem[]): AudioPlan => ({
  items,
  mediaIds: [...new Set(items.map((i) => i.mediaId))],
});

/* ───────────── tests ───────────── */

describe("peakToLevel", () => {
  it("maps silence to 0, full scale to 100 and −6 dB to 90", () => {
    expect(peakToLevel(0)).toBe(0);
    expect(peakToLevel(1)).toBe(100);
    expect(Math.round(peakToLevel(0.5))).toBe(90);
    expect(peakToLevel(0.0001)).toBe(0); // below −60 dB
    expect(peakToLevel(5)).toBe(100); // never above the top
    expect(peakToLevel(Number.NaN)).toBe(0);
  });
});

describe("AudioEngine — unlock and clock", () => {
  it("creates the context once, wakes it inside the call, and re-wakes it on every tap", () => {
    const r = rig({});
    expect(r.engine.clock()).toBeNull(); // not unlocked yet
    r.engine.unlock();
    expect(r.ctx.resumes).toBe(1); // resume() was called synchronously, not after an await
    expect(r.sessions).toBe(1);
    r.engine.unlock();
    expect(r.ctx.resumes).toBe(2);
    expect(r.ctx.analysers).toHaveLength(2); // the graph was built only once
  });

  it("reports the audio time only while the context is really running", () => {
    const r = rig({});
    r.engine.unlock();
    r.ctx.currentTime = 12.5;
    expect(r.engine.clock()).toBe(12.5);
    r.ctx.state = "interrupted";
    expect(r.engine.clock()).toBeNull();
  });

  it("copes with a browser that cannot make a context", () => {
    const env: EngineEnv = {
      createContext: () => {
        throw new Error("no audio");
      },
      readBlob: async () => undefined,
      prepareSession: () => undefined,
    };
    const engine = new AudioEngine(env);
    engine.unlock();
    expect(engine.clock()).toBeNull();
    engine.start(planOf(item()), 1); // does nothing, does not throw
  });
});

describe("AudioEngine — decoding", () => {
  it("decodes each file once, even when asked many times at the same moment", async () => {
    const r = rig({ m1: file(10), m2: file(20) });
    r.engine.unlock();
    const plan = planOf(item({ mediaId: "m1" }), item({ mediaId: "m2" }));
    await Promise.all([r.engine.prepare(plan), r.engine.prepare(plan)]);
    await r.engine.prepare(plan);
    expect(r.reads.sort()).toEqual(["m1", "m2"]);
    expect(r.ctx.decoded.sort()).toEqual([10, 20]);
  });

  it("prepares nothing before the context exists", async () => {
    const r = rig({ m1: file(10) });
    await r.engine.prepare(planOf(item()));
    expect(r.reads).toEqual([]);
  });

  it("leaves a file that cannot be decoded silent, without failing the rest", async () => {
    const r = rig({ bad: file(0), good: file(8), gone: undefined });
    r.engine.unlock();
    const plan = planOf(
      item({ mediaId: "bad" }),
      item({ mediaId: "good" }),
      item({ mediaId: "gone" }),
    );
    await r.engine.prepare(plan);
    r.engine.start(plan, 1);
    expect(r.ctx.sources).toHaveLength(1);
    expect(r.ctx.sources[0].buffer?.duration).toBe(8);
  });

  it("skips files that are too big to decode and remembers which", async () => {
    const r = rig({ big: file(10) }, { decodeBytes: 2, cacheBytes: 1e9 });
    r.engine.unlock();
    await r.engine.prepare(planOf(item({ mediaId: "big" })));
    expect(r.engine.skipped.has("big")).toBe(true);
    expect(r.ctx.decoded).toEqual([]);
  });

  it("forgets the oldest decoded sound once the memory limit is passed", async () => {
    // each 10 s file is 10×100 samples × 2 channels × 4 bytes = 8000 bytes; the limit holds one
    const r = rig({ a: file(10), b: file(10) }, { decodeBytes: 1e9, cacheBytes: 9000 });
    r.engine.unlock();
    await r.engine.prepare(planOf(item({ mediaId: "a" })));
    await r.engine.prepare(planOf(item({ mediaId: "b" })));
    r.engine.start(planOf(item({ mediaId: "a" })), 1);
    expect(r.ctx.sources).toHaveLength(0); // "a" was evicted
    await r.engine.prepare(planOf(item({ mediaId: "a" })));
    expect(r.reads.filter((id) => id === "a")).toHaveLength(2); // and is read again when needed
  });
});

describe("AudioEngine — scheduling", () => {
  it("starts each sound at the right audio time, offset, length and speed", async () => {
    const r = rig({ m1: file(30), m2: file(30) });
    r.engine.unlock();
    const plan = planOf(
      item({ mediaId: "m1", whenSec: 0, offsetSec: 3, lengthSec: 5 }),
      item({ mediaId: "m2", whenSec: 2, offsetSec: 0, lengthSec: 4, rate: 2 }),
    );
    await r.engine.prepare(plan);
    r.ctx.currentTime = 9;
    r.engine.start(plan, 10);
    expect(r.ctx.sources.map((s) => s.startArgs)).toEqual([
      [10, 3, 5],
      [12, 0, 4],
    ]);
    expect(r.ctx.sources.map((s) => s.playbackRate.value)).toEqual([1, 2]);
    expect(r.ctx.sources[0].connected).toHaveLength(1); // wired to the master
  });

  it("begins a sound that is already late further in, so it stays in step", async () => {
    const r = rig({ m1: file(30) });
    r.engine.unlock();
    const plan = planOf(item({ offsetSec: 3, lengthSec: 5 }));
    await r.engine.prepare(plan);
    r.ctx.currentTime = 10.5; // the planned start (10) has already passed
    r.engine.start(plan, 10);
    expect(r.ctx.sources[0].startArgs).toEqual([10.5, 3.5, 4.5]);
  });

  it("skips a start past the end of the file and trims one that runs over", async () => {
    const r = rig({ short: file(4) });
    r.engine.unlock();
    const plan = planOf(
      item({ mediaId: "short", offsetSec: 6 }),
      item({ mediaId: "short", offsetSec: 1, lengthSec: 100 }),
    );
    await r.engine.prepare(plan);
    r.engine.start(plan, 1);
    expect(r.ctx.sources).toHaveLength(1);
    expect(r.ctx.sources[0].startArgs).toEqual([1, 1, 3]); // only the 3 s left in the file
  });

  it("silences everything on stop, and replaces the old sounds on a new start", async () => {
    const r = rig({ m1: file(30) });
    r.engine.unlock();
    const plan = planOf(item());
    await r.engine.prepare(plan);
    r.engine.start(plan, 1);
    const first = r.ctx.sources[0];
    r.engine.start(plan, 2);
    expect(first.stops).toBe(1);
    expect(first.disconnects).toBe(1);
    expect(r.ctx.sources).toHaveLength(2);
    r.engine.stop();
    expect(r.ctx.sources[1].stops).toBe(1);
    r.engine.stop(); // safe to call again
    expect(r.ctx.sources[1].stops).toBe(1);
  });

  it("cleans a sound up when it ends by itself", async () => {
    const r = rig({ m1: file(30) });
    r.engine.unlock();
    await r.engine.prepare(planOf(item()));
    r.engine.start(planOf(item()), 1);
    const source = r.ctx.sources[0];
    source.onended?.(new Event("ended"));
    expect(source.disconnects).toBe(1);
    r.engine.stop();
    expect(source.stops).toBe(0); // already gone, nothing left to stop
  });
});

describe("AudioEngine — meter", () => {
  it("shows silence as 0, a loud sound near the top, and falls back gently", () => {
    const r = rig({});
    r.engine.unlock();
    expect(r.engine.levels()).toEqual([0, 0]);
    r.ctx.analysers[0].peak = 1;
    r.ctx.analysers[1].peak = 0.5;
    expect(r.engine.levels()).toEqual([100, 90]);
    r.ctx.analysers[0].peak = 0;
    r.ctx.analysers[1].peak = 0;
    expect(r.engine.levels()).toEqual([88, 79]); // 100×0.88 and 90×0.88, rounded
    for (let i = 0; i < 60; i += 1) r.engine.levels();
    expect(r.engine.levels()).toEqual([0, 0]);
  });

  it("reads zero before the context exists", () => {
    expect(rig({}).engine.levels()).toEqual([0, 0]);
  });
});
