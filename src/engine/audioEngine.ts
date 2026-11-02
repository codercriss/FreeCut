import { catchUp, type AudioPlan } from "./audioPlan";
import type { AudioOut } from "./transport";

/**
 * The sound side of playback (Phase 1b.1). Decodes each clip's audio once, keeps it in memory, and plays it through
 * Web Audio; the audio clock (`AudioContext.currentTime`) is what the playhead follows (see `transport.ts`).
 * Why Web Audio and not the video's own sound: it gives one precise clock, per-clip control and a real level meter
 * (Knowledge_Contribution R-005; confirmed on the owner's iPhone by the Playback check).
 *
 * Everything it touches in the browser comes in through `EngineEnv` and the `ContextLike` shapes below, so the
 * scheduling, caching and meter maths are unit-tested with a fake. The real wiring is `audioEngineEnv.ts`.
 */

export interface NodeLike {
  connect(to: NodeLike, output?: number): unknown;
  disconnect(): void;
}
export interface GainLike extends NodeLike {
  gain: { value: number };
}
export interface AnalyserLike extends NodeLike {
  fftSize: number;
  getFloatTimeDomainData(into: Float32Array): void;
}
export interface BufferLike {
  duration: number;
  numberOfChannels: number;
  length: number;
}
export interface SourceLike extends NodeLike {
  buffer: BufferLike | null;
  playbackRate: { value: number };
  onended: ((ev: Event) => unknown) | null;
  start(when?: number, offset?: number, duration?: number): void;
  stop(when?: number): void;
}
export interface ContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: NodeLike;
  resume(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<BufferLike>;
  createBufferSource(): SourceLike;
  createGain(): GainLike;
  createAnalyser(): AnalyserLike;
  createChannelSplitter(outputs: number): NodeLike;
}

export interface EngineEnv {
  createContext(): ContextLike | null;
  readBlob(mediaId: string): Promise<Blob | undefined>;
  /** iOS: declare the page a "playback" one so the silent switch does not mute Web Audio (iOS 16.4+). */
  prepareSession(): void;
}

export interface EngineLimits {
  /** Largest file read whole into memory to be decoded. Longer ones are silent until 1c brings proxies. */
  decodeBytes: number;
  /** Most decoded sound kept in memory at once. */
  cacheBytes: number;
}

export const DEFAULT_LIMITS: EngineLimits = {
  decodeBytes: 60 * 1024 * 1024,
  cacheBytes: 200 * 1024 * 1024,
};

/** A sample peak (0–1) as a meter level 0–100, on a −60…0 dB scale. */
export function peakToLevel(peak: number): number {
  if (!(peak > 0)) return 0;
  const db = 20 * Math.log10(Math.min(1, peak));
  return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
}

export class AudioEngine implements AudioOut {
  /** Files whose sound was left out on purpose because they are too big to decode. */
  readonly skipped = new Set<string>();
  private readonly env: EngineEnv;
  private readonly limits: EngineLimits;
  private ctx: ContextLike | null = null;
  private master: GainLike | null = null;
  private analysers: AnalyserLike[] = [];
  private sources: SourceLike[] = [];
  private readonly pending = new Map<string, Promise<BufferLike | null>>();
  private readonly ready = new Map<string, BufferLike | null>();
  private readonly held = [0, 0];
  private readonly scratch = new Float32Array(1024);

  constructor(env: EngineEnv, limits: EngineLimits = DEFAULT_LIMITS) {
    this.env = env;
    this.limits = limits;
  }

  /**
   * Create (once) and wake the audio context. MUST be called synchronously inside the tap that starts playback:
   * iOS only lets sound start from inside the gesture itself (Handover D-032).
   */
  unlock(): void {
    this.env.prepareSession();
    if (!this.ctx) this.build();
    void this.ctx?.resume().catch(() => undefined);
  }

  /** The audio clock in seconds while sound can really play; null otherwise (not unlocked, suspended, interrupted). */
  clock(): number | null {
    const ctx = this.ctx;
    return ctx && ctx.state === "running" ? ctx.currentTime : null;
  }

  async prepare(plan: AudioPlan): Promise<void> {
    if (!this.ctx) return;
    await Promise.all(plan.mediaIds.map((id) => this.buffer(id)));
  }

  /** Schedule `plan` so that its start is at audio time `at`. Replaces whatever was playing. */
  start(plan: AudioPlan, at: number): void {
    this.stop();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    for (const item of plan.items) {
      const buffer = this.ready.get(item.mediaId);
      if (!buffer) continue;
      const slice = catchUp(item, at + item.whenSec, now);
      if (!slice || slice.offsetSec >= buffer.duration) continue;
      const length = Math.min(slice.lengthSec, buffer.duration - slice.offsetSec);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = item.rate;
      source.connect(master);
      source.onended = () => {
        source.disconnect();
        this.sources = this.sources.filter((s) => s !== source);
      };
      try {
        source.start(slice.at, slice.offsetSec, length);
        this.sources.push(source);
      } catch {
        source.disconnect();
      }
    }
  }

  stop(): void {
    for (const source of this.sources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already stopped or never started.
      }
      source.disconnect();
    }
    this.sources = [];
  }

  /** Left and right meter levels, 0–100, with a gentle fall-back so the bars are readable. */
  levels(): [number, number] {
    const out: [number, number] = [0, 0];
    for (let i = 0; i < 2; i += 1) {
      const analyser = this.analysers[i];
      if (!analyser) continue;
      analyser.getFloatTimeDomainData(this.scratch);
      let peak = 0;
      for (const sample of this.scratch) peak = Math.max(peak, Math.abs(sample));
      this.held[i] = Math.max(peakToLevel(peak), this.held[i] * 0.88);
      out[i] = Math.round(this.held[i]);
    }
    return out;
  }

  private build(): void {
    let ctx: ContextLike | null = null;
    try {
      ctx = this.env.createContext();
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    const master = ctx.createGain();
    master.connect(ctx.destination);
    const splitter = ctx.createChannelSplitter(2);
    master.connect(splitter);
    // Analysers are given a silent route to the output so every browser keeps them running.
    const silent = ctx.createGain();
    silent.gain.value = 0;
    silent.connect(ctx.destination);
    this.analysers = [0, 1].map((channel) => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = this.scratch.length;
      splitter.connect(analyser, channel);
      analyser.connect(silent);
      return analyser;
    });
    this.master = master;
    this.ctx = ctx;
  }

  private buffer(id: string): Promise<BufferLike | null> {
    const known = this.pending.get(id);
    if (known) return known;
    const work = this.decode(id).then((buffer) => {
      this.ready.set(id, buffer);
      this.trim();
      return buffer;
    });
    this.pending.set(id, work);
    return work;
  }

  /** Never rejects: a file that cannot be decoded simply has no sound. */
  private async decode(id: string): Promise<BufferLike | null> {
    const ctx = this.ctx;
    if (!ctx) return null;
    try {
      const blob = await this.env.readBlob(id);
      if (!blob) return null;
      if (blob.size > this.limits.decodeBytes) {
        this.skipped.add(id);
        return null;
      }
      return await ctx.decodeAudioData(await blob.arrayBuffer());
    } catch {
      return null;
    }
  }

  /** Forget the oldest decoded sounds once more than `cacheBytes` are held. */
  private trim(): void {
    let total = 0;
    for (const buffer of this.ready.values()) {
      if (buffer) total += buffer.length * buffer.numberOfChannels * 4;
    }
    for (const id of this.ready.keys()) {
      if (total <= this.limits.cacheBytes) break;
      const buffer = this.ready.get(id);
      if (buffer) total -= buffer.length * buffer.numberOfChannels * 4;
      this.ready.delete(id);
      this.pending.delete(id);
    }
  }
}
