import { describe, expect, it } from "vitest";
import type { Asset, Clip, Project, Track } from "../model/types";
import { catchUp, planAudio } from "./audioPlan";

const FPS = 30;

const track = (id: string, kind: Track["kind"], muted = false): Track => ({
  id,
  kind,
  name: id,
  muted,
  locked: false,
  hidden: false,
});

const asset = (id: string, kind: Asset["kind"], source: Asset["source"]): Asset => ({
  id,
  kind,
  name: id,
  durationFrames: 3000,
  source,
});

const clip = (id: string, trackId: string, assetId: string, over: Partial<Clip> = {}): Clip => ({
  id,
  trackId,
  assetId,
  start: 0,
  duration: 300,
  sourceIn: 0,
  speed: 1,
  transform: { zoom: 50, x: 0, y: 0, rotation: 0 },
  opacity: 100,
  blend: "normal",
  filter: null,
  effects: [],
  sections: { filters: false, effects: false, transform: false, blend: false },
  ...over,
});

const stored = (mediaId: string): Asset["source"] => ({ type: "stored", mediaId });

function project(clips: Clip[], tracks: Track[] = []): Project {
  return {
    schemaVersion: 2,
    id: "p",
    name: "p",
    createdAt: 0,
    updatedAt: 0,
    settings: { fps: FPS, width: 1920, height: 1080, ratio: "16:9" },
    assets: [
      asset("vid", "video", stored("m-vid")),
      asset("song", "audio", stored("m-song")),
      asset("photo", "image", stored("m-photo")),
      asset("demo", "video", { type: "generated", scene: "s", thumb: "t" }),
    ],
    tracks: [track("main", "main"), track("aud", "audio"), ...tracks],
    clips,
    markers: [],
  };
}

describe("planAudio", () => {
  it("plays a video's own sound and an audio clip's sound", () => {
    const p = project([clip("a", "main", "vid"), clip("b", "aud", "song", { start: 60 })]);
    const plan = planAudio(p, 0);
    expect(plan.items.map((i) => i.clipId)).toEqual(["a", "b"]);
    expect(plan.mediaIds).toEqual(["m-vid", "m-song"]);
    expect(plan.items[0]).toEqual({
      clipId: "a",
      mediaId: "m-vid",
      whenSec: 0,
      offsetSec: 0,
      lengthSec: 10,
      rate: 1,
    });
    expect(plan.items[1].whenSec).toBe(2); // starts when the playhead reaches frame 60 at 30 fps
  });

  it("is silent for photos, built-in demo footage, muted tracks and missing assets", () => {
    const p = project(
      [
        clip("photo", "main", "photo"),
        clip("demo", "main", "demo"),
        clip("muted", "dead", "vid"),
        clip("ghost", "main", "nope"),
        clip("lost", "nowhere", "vid"),
      ],
      [track("dead", "audio", true)],
    );
    expect(planAudio(p, 0)).toEqual({ items: [], mediaIds: [] });
  });

  it("starts a clip already under the playhead part-way in, honouring trim and speed", () => {
    const fast = { start: 30, duration: 120, sourceIn: 60, speed: 2 };
    const p = project([clip("a", "main", "vid", fast)]);
    const [item] = planAudio(p, 60).items; // 30 frames into the clip → 60 source frames in
    expect(item.whenSec).toBe(0);
    expect(item.offsetSec).toBe((60 + 60) / FPS);
    expect(item.lengthSec).toBe((90 * 2) / FPS); // 90 timeline frames left, at double speed
    expect(item.rate).toBe(2);
  });

  it("leaves out clips that have already ended, and a clip ending exactly at the start", () => {
    const p = project([
      clip("old", "main", "vid", { start: 0, duration: 100 }),
      clip("edge", "aud", "song", { start: 0, duration: 200 }),
    ]);
    expect(planAudio(p, 200).items).toHaveLength(0);
    expect(planAudio(p, 100).items.map((i) => i.clipId)).toEqual(["edge"]);
  });

  it("lists each file once even when several clips use it", () => {
    const p = project([
      clip("a", "main", "vid", { start: 0, duration: 100 }),
      clip("b", "main", "vid", { start: 100, duration: 100, sourceIn: 500 }),
    ]);
    const plan = planAudio(p, 0);
    expect(plan.items).toHaveLength(2);
    expect(plan.mediaIds).toEqual(["m-vid"]);
    expect(plan.items[1].offsetSec).toBe(500 / FPS);
  });

  it("ignores a clip whose speed is not positive", () => {
    const frozen = clip("a", "main", "vid", { speed: 0 });
    const backwards = clip("b", "aud", "song", { speed: -1 });
    const p = project([frozen, backwards]);
    expect(planAudio(p, 0).items).toHaveLength(0);
  });
});

describe("catchUp", () => {
  const item = { offsetSec: 4, lengthSec: 10, rate: 1 };

  it("leaves an on-time or future sound alone", () => {
    expect(catchUp(item, 5, 5)).toEqual({ at: 5, offsetSec: 4, lengthSec: 10 });
    expect(catchUp(item, 6, 5)).toEqual({ at: 6, offsetSec: 4, lengthSec: 10 });
  });

  it("begins a late sound now, further in, so it stays in step", () => {
    expect(catchUp(item, 5, 5.5)).toEqual({ at: 5.5, offsetSec: 4.5, lengthSec: 9.5 });
  });

  it("scales the lost sound by the speed", () => {
    const fast = { offsetSec: 4, lengthSec: 10, rate: 2 };
    expect(catchUp(fast, 5, 5.5)).toEqual({ at: 5.5, offsetSec: 5, lengthSec: 9 });
  });

  it("drops a sound that is already over", () => {
    expect(catchUp(item, 5, 16)).toBeNull();
  });
});
