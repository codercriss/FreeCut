import { describe, expect, it } from "vitest";
import type { AudioPlan } from "./audioPlan";
import {
  AUDIO_LEAD_S,
  AUDIO_STALL_MS,
  Transport,
  WAIT,
  type AudioOut,
  type TransportDeps,
} from "./transport";
import type { VideoMoving } from "./videoSync";

const FPS = 60;
const flush = async () => {
  for (let i = 0; i < 4; i += 1) await Promise.resolve();
};

class FakeAudio implements AudioOut {
  time: number | null = 100;
  manual = false;
  stops = 0;
  prepared: AudioPlan[] = [];
  started: { plan: AudioPlan; at: number }[] = [];
  private pending: { resolve: () => void; reject: () => void }[] = [];

  clock(): number | null {
    return this.time;
  }

  prepare(plan: AudioPlan): Promise<void> {
    this.prepared.push(plan);
    if (!this.manual) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this.pending.push({ resolve, reject: () => reject(new Error("decode failed")) });
    });
  }

  start(plan: AudioPlan, at: number): void {
    this.started.push({ plan, at });
  }

  stop(): void {
    this.stops += 1;
  }

  /** Finish the n-th decode that is still waiting (manual mode). */
  finish(n = 0, ok = true): void {
    const p = this.pending[n];
    if (ok) p.resolve();
    else p.reject();
  }
}

interface Rig {
  t: Transport;
  audio: FakeAudio;
  video: { moving: VideoMoving | null; expects: boolean };
  frames: number[];
}

function rig(opts: { audio?: boolean; total?: number } = {}): Rig {
  const audio = new FakeAudio();
  const video = { moving: null as VideoMoving | null, expects: false };
  const frames: number[] = [];
  const deps: TransportDeps = {
    fps: () => FPS,
    total: () => opts.total ?? 600,
    audio: opts.audio === false ? null : audio,
    plan: (frame) => {
      frames.push(frame);
      return { items: [], mediaIds: [`at-${frame}`] };
    },
    expectsVideo: () => video.expects,
    videoMoving: () => video.moving,
    resetVideo: () => {
      video.moving = null;
    },
  };
  return { t: new Transport(deps), audio, video, frames };
}

describe("Transport — time clock only", () => {
  it("runs on the time clock straight away when there is no sound side and no video", () => {
    const { t } = rig({ audio: false });
    t.begin(0, 1000, true);
    expect(t.phase).toBe("perf");
    expect(t.tick(1500)).toBe(30);
    expect(t.tick(2000)).toBe(60);
  });

  it("never goes past the end", () => {
    const { t } = rig({ audio: false, total: 100 });
    t.begin(95, 0, true);
    expect(t.tick(60000)).toBe(100);
  });

  it("goes back to idle on stop", () => {
    const { t, audio } = rig();
    t.begin(0, 0, false);
    t.stop();
    expect(t.phase).toBe("idle");
    expect(audio.stops).toBeGreaterThan(0);
  });
});

describe("Transport — audio is the master clock", () => {
  it("starts at once; the sound then joins in step and drives the clock", async () => {
    const { t, audio, frames } = rig();
    t.begin(30, 0, false);
    expect(t.phase).toBe("perf"); // the playhead never waits for sound
    expect(t.tick(0)).toBe(30);
    await flush();
    expect(t.tick(16)).toBe(30);
    expect(t.phase).toBe("audio");
    expect(audio.started).toHaveLength(1);
    expect(audio.started[0].at).toBeCloseTo(100 + AUDIO_LEAD_S, 6);
    expect(frames).toEqual([30, 30]); // planned for decoding, then for starting, both from frame 30
    audio.time = 100 + AUDIO_LEAD_S + 0.5;
    expect(t.tick(600)).toBe(60); // 0.5 s later at 60 fps
  });

  it("follows the audio clock, not the time clock, when they disagree", async () => {
    const { t, audio } = rig();
    t.begin(0, 0, false);
    await flush();
    t.tick(16);
    audio.time = 100 + AUDIO_LEAD_S + 0.5; // only half a second of audio has played
    expect(t.tick(2000)).toBe(30); // even though 2 s of real time went by
  });

  it("does not run backwards or before the sound's own start", async () => {
    const { t, audio } = rig();
    t.begin(10, 0, false);
    await flush();
    t.tick(16);
    audio.time = 100; // before the scheduled start
    expect(t.tick(30)).toBe(10);
  });
});

describe("Transport — waiting for the picture", () => {
  it("holds until the video is moving, then lines up with it", async () => {
    const r = rig();
    r.video.expects = true;
    r.t.begin(0, 0, true);
    r.audio.time = 50;
    await flush();
    expect(r.t.tick(100)).toBe(0);
    expect(r.t.phase).toBe("holding");
    r.video.moving = { frame: 6, perf: 150 };
    // 6 frames, plus 50 ms (3 frames) since it moved, plus the 30 ms (1.8 frames) head start of the sound
    expect(r.t.tick(200)).toBe(11);
    expect(r.t.phase).toBe("audio");
    expect(r.frames[r.frames.length - 1]).toBe(11);
  });

  it("gives up on a video that never starts", async () => {
    const r = rig();
    r.video.expects = true;
    r.t.begin(0, 0, true);
    await flush();
    r.t.tick(WAIT.video - 1);
    expect(r.t.phase).toBe("holding");
    r.t.tick(WAIT.video);
    expect(r.t.phase).toBe("audio");
  });

  it("does not wait for the video after a seek during playback", async () => {
    const r = rig();
    r.video.expects = true;
    r.t.begin(40, 0, false);
    await flush();
    r.t.tick(16);
    expect(r.t.phase).toBe("audio");
  });

  it("waits for the video even with no sound side, then runs on the time clock", () => {
    const r = rig({ audio: false });
    r.video.expects = true;
    r.t.begin(0, 0, true);
    expect(r.t.phase).toBe("holding");
    expect(r.t.tick(100)).toBe(0);
    r.video.moving = { frame: 5, perf: 90 };
    expect(r.t.tick(120)).toBe(7); // frame 5 + 30 ms (1.8 frames) = 6.8, no sound head start
    expect(r.t.phase).toBe("perf");
  });
});

describe("Transport — when sound cannot run", () => {
  it("uses the time clock while the context is not running, and joins if it wakes", async () => {
    const r = rig();
    r.audio.time = null;
    r.t.begin(0, 0, false);
    await flush();
    expect(r.t.tick(100)).toBe(6);
    expect(r.t.phase).toBe("perf");
    expect(r.t.tick(500)).toBe(30);
    expect(r.audio.started).toHaveLength(0);
    r.audio.time = 100; // the context wakes up
    r.t.tick(516);
    expect(r.t.phase).toBe("audio");
    expect(r.frames[r.frames.length - 1]).toBe(30);
  });

  it("carries on without sound if decoding fails", async () => {
    const r = rig();
    r.audio.manual = true;
    r.t.begin(0, 0, false);
    r.audio.finish(0, false);
    await flush();
    r.t.tick(16);
    expect(r.t.phase).toBe("perf");
    expect(r.audio.started).toHaveLength(0);
    r.t.tick(5000);
    expect(r.t.phase).toBe("perf"); // and never tries to join again
  });

  it("plays on the time clock while decoding is slow, then joins the sound in step", async () => {
    const r = rig();
    r.audio.manual = true;
    r.t.begin(0, 0, false);
    expect(r.t.phase).toBe("perf");
    expect(r.t.tick(500)).toBe(30);
    r.audio.finish(0);
    await flush();
    r.t.tick(516);
    expect(r.t.phase).toBe("audio");
    expect(r.frames[r.frames.length - 1]).toBe(30); // joins where the playhead is, not at the start
  });

  it("drops to the time clock, without a jump, if the audio clock stops advancing", async () => {
    const r = rig();
    r.t.begin(0, 0, false);
    await flush();
    r.t.tick(16);
    r.audio.time = 100 + AUDIO_LEAD_S + 0.2; // runs for a moment…
    const before = r.t.tick(300);
    r.audio.time = 100 + AUDIO_LEAD_S + 0.2; // …then freezes
    r.t.tick(300 + AUDIO_STALL_MS - 1);
    expect(r.t.phase).toBe("audio");
    const at = r.t.tick(300 + AUDIO_STALL_MS + 50);
    expect(r.t.phase).toBe("perf");
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at - before).toBeLessThan(3);
  });

  it("drops to the time clock if the audio clock never moves at all", async () => {
    const r = rig();
    r.t.begin(0, 0, false);
    await flush();
    r.t.tick(16);
    expect(r.t.phase).toBe("audio");
    r.t.tick(16 + AUDIO_STALL_MS + 10);
    expect(r.t.phase).toBe("perf");
  });

  it("drops to the time clock if the audio clock disappears mid-play", async () => {
    const r = rig();
    r.t.begin(0, 0, false);
    await flush();
    r.t.tick(16);
    r.audio.time = null;
    r.t.tick(100);
    expect(r.t.phase).toBe("perf");
    expect(r.audio.stops).toBeGreaterThan(1);
  });
});

describe("Transport — restarting", () => {
  it("ignores a decode from an earlier run that finishes late", async () => {
    const r = rig();
    r.audio.manual = true;
    r.t.begin(0, 0, false);
    r.t.begin(40, 10, false);
    r.audio.finish(0); // the first run's decode finishes…
    await flush();
    r.t.tick(20);
    expect(r.t.phase).toBe("perf"); // …but the second run is still waiting for its own
    expect(r.audio.started).toHaveLength(0);
    r.audio.finish(1);
    await flush();
    r.t.tick(40);
    expect(r.t.phase).toBe("audio");
    expect(r.audio.started).toHaveLength(1);
    expect(r.frames[r.frames.length - 1]).toBe(41); // from frame 40, plus 30 ms of the second run
  });

  it("silences the old sound when it restarts", () => {
    const r = rig();
    r.t.begin(0, 0, false);
    const stops = r.audio.stops;
    r.t.begin(20, 5, false);
    expect(r.audio.stops).toBe(stops + 1);
  });
});
