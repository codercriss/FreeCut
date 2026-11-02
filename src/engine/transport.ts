import type { AudioPlan } from "./audioPlan";
import type { VideoMoving } from "./videoSync";

/**
 * Where the playhead is while playing. A small state machine, deterministic: time is passed in, nothing reads a clock.
 *
 *   holding → only when playback starts on a video: wait (briefly) for the picture to be really moving. The playhead
 *             stays put meanwhile.
 *   perf    → the plain time clock. Playback starts here at once for everything else, and stays here when there is
 *             no sound side, audio cannot run (a browser or phone that suspended it) or decoding fails.
 *   audio   → the audio clock is the master: frame = start + (audio time − audio start) × fps. Sound JOINS from the
 *             perf phase as soon as it is ready (decoded and the context running), re-anchored to where the
 *             playhead is, so the picture never waits for sound. If the audio clock later stalls, back to perf.
 *
 * The one wait has a limit, so a video that never starts only ever costs a moment — never the whole playback.
 */

/** What the transport needs from the sound side. The real one is `AudioEngine`. */
export interface AudioOut {
  /** The audio clock, in seconds, while sound can really play; null when it can't (not running / interrupted). */
  clock(): number | null;
  /** Decode whatever the plan needs. */
  prepare(plan: AudioPlan): Promise<void>;
  /** Schedule the plan so that its start is at audio time `at`. */
  start(plan: AudioPlan, at: number): void;
  stop(): void;
}

export interface TransportDeps {
  fps(): number;
  total(): number;
  audio: AudioOut | null;
  plan(frame: number): AudioPlan;
  /** Is a video what the playhead is on, so the clock should wait for it to start moving? */
  expectsVideo(frame: number): boolean;
  videoMoving(): VideoMoving | null;
  resetVideo(): void;
}

export type Phase = "idle" | "holding" | "audio" | "perf";

/** How long the start may wait for a video to begin moving, in milliseconds. */
export const WAIT = { video: 1500 } as const;
/** Sound is scheduled this far ahead of "now" so it can start exactly on time (seconds). */
export const AUDIO_LEAD_S = 0.03;
/** An audio clock whose time has not changed for this long (milliseconds) is treated as dead. */
export const AUDIO_STALL_MS = 500;

export class Transport {
  phase: Phase = "idle";
  private readonly deps: TransportDeps;
  private epoch = 0;
  private startFrame = 0;
  private startedPerf = 0;
  private lastFrame = 0;
  private waitVideo = false;
  private prepared = false;
  private audioOk = false;
  private ctxT0 = 0;
  private lastAudioT: number | null = null;
  private audioChangedPerf = 0;

  constructor(deps: TransportDeps) {
    this.deps = deps;
  }

  /**
   * Start (or restart, after a seek) playback from `frame`. `waitForVideo` is true for a fresh Play, false for a seek
   * while already playing (the video is running already; it will follow).
   */
  begin(frame: number, now: number, waitForVideo: boolean): void {
    const d = this.deps;
    this.epoch += 1;
    const epoch = this.epoch;
    d.audio?.stop();
    this.startFrame = this.clamp(frame);
    this.lastFrame = this.startFrame;
    this.startedPerf = now;
    this.waitVideo = waitForVideo && d.expectsVideo(this.startFrame);
    this.prepared = d.audio === null;
    this.audioOk = d.audio !== null;
    d.resetVideo();
    if (d.audio) {
      const ready = () => {
        if (epoch === this.epoch) this.prepared = true;
      };
      const failed = () => {
        if (epoch !== this.epoch) return;
        this.prepared = true;
        this.audioOk = false;
      };
      d.audio.prepare(d.plan(this.startFrame)).then(ready, failed);
    }
    if (this.waitVideo) this.phase = "holding";
    else this.runOnTimeClock(now);
  }

  /** Called every animation frame while playing. Returns the playhead frame. */
  tick(now: number): number {
    if (this.phase === "holding") this.maybeGo(now);
    else if (this.phase === "perf") this.maybeJoinAudio(now);
    else if (this.phase === "audio") this.watchAudio(now);
    this.lastFrame = this.frameNow(now);
    return this.lastFrame;
  }

  stop(): void {
    this.epoch += 1;
    this.deps.audio?.stop();
    this.phase = "idle";
  }

  private clamp(f: number): number {
    return Math.max(0, Math.min(this.deps.total(), Math.round(f)));
  }

  private frameNow(now: number): number {
    const fps = this.deps.fps();
    let f = this.startFrame;
    if (this.phase === "audio") {
      const t = this.deps.audio?.clock() ?? null;
      if (t !== null) f += Math.floor(Math.max(0, t - this.ctxT0) * fps);
    } else if (this.phase === "perf") {
      f += Math.max(0, Math.floor(((now - this.startedPerf) * fps) / 1000));
    }
    return Math.min(f, this.deps.total());
  }

  private maybeGo(now: number): void {
    const moving = this.deps.videoMoving();
    if (moving === null && now - this.startedPerf < WAIT.video) return;
    this.go(now, moving);
  }

  private go(now: number, moving: VideoMoving | null): void {
    const d = this.deps;
    const audio = d.audio;
    const t = audio && this.audioOk && this.prepared ? audio.clock() : null;
    let frame = this.startFrame;
    if (moving) {
      // Line up with the picture: where it was, plus the time since, plus the head start sound is scheduled with.
      const lead = t !== null ? AUDIO_LEAD_S : 0;
      const aligned = moving.frame + ((now - moving.perf) * d.fps()) / 1000 + lead * d.fps();
      frame = Math.max(frame, Math.round(aligned));
    }
    this.startFrame = this.clamp(frame);
    if (audio && t !== null) this.startAudio(audio, t, now);
    else this.runOnTimeClock(now);
  }

  private startAudio(audio: AudioOut, t: number, now: number): void {
    this.ctxT0 = t + AUDIO_LEAD_S;
    audio.start(this.deps.plan(this.startFrame), this.ctxT0);
    this.lastAudioT = t;
    this.audioChangedPerf = now;
    this.phase = "audio";
  }

  private runOnTimeClock(now: number): void {
    this.startedPerf = now;
    this.phase = "perf";
  }

  /** On the time clock only because sound is not ready yet: join the sound, in step, as soon as it is. */
  private maybeJoinAudio(now: number): void {
    const audio = this.deps.audio;
    if (!audio || !this.audioOk || !this.prepared) return;
    const t = audio.clock();
    if (t === null) return;
    this.startFrame = this.clamp(this.frameNow(now));
    this.startAudio(audio, t, now);
  }

  private watchAudio(now: number): void {
    const audio = this.deps.audio;
    const t = audio ? audio.clock() : null;
    if (t !== null && t !== this.lastAudioT) {
      this.lastAudioT = t;
      this.audioChangedPerf = now;
      return;
    }
    const frozen = t !== null && now - this.audioChangedPerf > AUDIO_STALL_MS;
    if (t !== null && !frozen) return;
    // The audio clock vanished (interruption) or stopped changing: carry on from where the playhead is, on the time clock.
    audio?.stop();
    this.audioOk = false;
    this.startFrame = this.lastFrame;
    this.runOnTimeClock(now);
  }
}
