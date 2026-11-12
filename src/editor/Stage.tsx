import { useEffect, useRef, useState } from "react";
import { decideDrift, newDriftState, type DriftState } from "../engine/drift";
import { useLiveFrame, usePlaying } from "../engine/playback";
import { videoSync } from "../engine/videoSync";
import { isBlankPixels } from "../media/poster";
import { useMediaUrl, usePosterUrl } from "../media/useMediaUrl";
import { activeVisualClip, assetById } from "../model/selectors";
import type { Asset, Clip } from "../model/types";
import { shallowEqual } from "../store/createStore";
import { useProject } from "../store/ProjectContext";
import { Scene } from "./footage/scenes";

/**
 * The picture area shared by the desktop and phone players.
 *  - demo footage: its generated scene;
 *  - imported photos: the ORIGINAL file (the small poster is only a placeholder underneath);
 *  - imported videos: a real, full-resolution frame from the original file. Paused, it chases the playhead by
 *    seeking (so scrubbing is exact); playing, the same muted <video> really plays and is kept in step with the
 *    playhead — the sound comes from Web Audio (`engine/audioEngine.ts`), never from this element.
 * The poster stays underneath at all times, so if a browser can't show the real thing the preview never goes blank.
 */

/** Source time (seconds) shown for timeline `frame`, honouring where the clip starts, its trim and its speed. */
export function stageTime(
  clip: Pick<Clip, "start" | "sourceIn" | "speed">,
  frame: number,
  fps: number,
): number {
  return Math.max(0, (clip.sourceIn + (frame - clip.start) * clip.speed) / fps);
}

/** The visual clip (and its asset) under the playhead, or nothing for a gap / empty project. */
export function useStageClip(frame: number): { clip?: Clip; asset?: Asset } {
  return useProject((p) => {
    const clip = activeVisualClip(p, Math.max(0, frame));
    return { clip, asset: clip ? assetById(p, clip.assetId) : undefined };
  }, shallowEqual);
}

/** Is the picture currently held by the video a real one? `blank` = all black (could be genuine), `error` = couldn't tell. */
export function verifyFrame(v: HTMLVideoElement): "ok" | "blank" | "error" {
  try {
    const c = document.createElement("canvas");
    c.width = 32;
    c.height = 18;
    const ctx = c.getContext("2d");
    if (!ctx) return "error";
    ctx.drawImage(v, 0, 0, 32, 18);
    return isBlankPixels(ctx.getImageData(0, 0, 32, 18).data) ? "blank" : "ok";
  } catch {
    return "error";
  }
}

interface StageVideoProps {
  url: string;
  timeSec: number;
  /** No poster underneath to protect → show the video as soon as it has a frame. */
  alwaysShow?: boolean;
  verify?: (v: HTMLVideoElement) => "ok" | "blank" | "error";
  /** Playback is running: play for real (muted) and stay in step with `timeSec`, instead of seeking every frame. */
  playing?: boolean;
  /** The clip's speed, used as the playback rate while playing. */
  speed?: number;
  /** Called once per start, when the video is really moving, with its time in seconds (see `videoSync`). */
  onMoving?: (videoTimeSec: number) => void;
  /** Where the video should be right now, read from the live clock (so following does not wait for a re-render). */
  liveTime?: () => number;
}

/** A scrub is "in progress" until the playhead has been still for this long (milliseconds). */
const SCRUB_SETTLE_MS = 160;

/** While starting to play, nothing presented for this long (milliseconds) means the start is stuck. */
const START_STALL_MS = 750;
/** How often a starting playback is checked for being stuck (milliseconds). */
const START_CHECK_MS = 250;

/**
 * A native <video> showing `timeSec`. Paused: it chases `timeSec`; one seek is in flight at a time (so scrubbing
 * never piles up work on a phone) and when it lands we chase the latest target. While the playhead is moving fast,
 * Safari's `fastSeek` (nearest keyframe, much quicker on long-GOP video) gives a live preview; when the playhead has
 * been still for a moment an exact seek lands the right frame. Playing: it plays muted and a small controller
 * (`engine/drift.ts`) keeps it in step with the LIVE clock — left alone inside a dead zone, one gentle correction
 * beyond it, a jump only for big drift — driven by the video's own frame callback, not by React re-renders. It stays
 * invisible until a real, non-blank frame has been verified (a genuinely black first frame is accepted after a few
 * tries) or, when playing, until it is moving.
 *
 * The start of playback is careful on purpose (the iOS bug: scrub, tap Play → sound but no picture):
 *  - never `play()` into a seek that is still in flight. Tapping Play right after a scrub races the exact seek that
 *    lands the playhead, and on iOS `play()` during that seek can leave the element "playing" (`paused` false) with
 *    no frame ever presented — `requestVideoFrameCallback` then never fires, so the video never reports itself
 *    moving, never shows, and the sound (Web Audio) runs alone after the clock's wait. So a start waits for any
 *    pending seek to land (`seeked`) first — including its own, below;
 *  - playback starts exactly where the playhead is: Play cancels the scrub's settle seek (this very effect clears
 *    its timer), which can leave the video on a keyframe near — but not at — the playhead. So a start re-seeks to
 *    the playhead and waits for that seek to land, instead of playing from a keyframe seconds away;
 *  - "really moving" is measured from where playback ACTUALLY starts (where the seek landed), not from
 *    `currentTime` at Play time: iOS reports a pending seek target at once, while the decoder is still behind it —
 *    measured from too far ahead, "moving" can never come true and the clock gives up waiting;
 *  - if nothing has been presented for a moment after all that, the position is re-asserted and playback started
 *    again (twice at most) — recovering a stalled start instead of freezing the picture while the sound runs.
 */
export function StageVideo({
  url,
  timeSec,
  alwaysShow = false,
  verify = verifyFrame,
  playing = false,
  speed = 1,
  onMoving,
  liveTime,
}: StageVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [shown, setShown] = useState(false);
  const target = useRef(timeSec);
  target.current = timeSec;
  const seeking = useRef(false);
  const tries = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const movingRef = useRef(onMoving);
  movingRef.current = onMoving;
  const liveRef = useRef(liveTime);
  liveRef.current = liveTime;
  const lastMove = useRef(-Infinity); // when the playhead last moved while paused (for scrubbing)
  const prevTime = useRef(timeSec);
  const lastFast = useRef(Number.NaN); // the target of the last fast seek, so it is not repeated

  const seekToTarget = (v: HTMLVideoElement) => {
    const gap = Math.abs(v.currentTime - target.current);
    if (seeking.current || gap < 0.03) return;
    const scrubbing = performance.now() - lastMove.current < SCRUB_SETTLE_MS;
    if (scrubbing && gap > 0.5 && typeof v.fastSeek === "function") {
      if (lastFast.current === target.current) return; // already there as near as a keyframe gets: wait for the settle
      lastFast.current = target.current;
      seeking.current = true;
      v.fastSeek(target.current);
      return;
    }
    lastFast.current = Number.NaN;
    seeking.current = true;
    v.currentTime = target.current;
  };

  /** Playing: keep the picture in step with the live clock. */
  const follow = (v: HTMLVideoElement, state: DriftState) => {
    const want = liveRef.current ? liveRef.current() : target.current;
    const action = decideDrift(state, v.currentTime - want, speedRef.current, performance.now());
    if (action.kind === "seek") {
      seeking.current = true;
      v.currentTime = want;
    } else if (action.kind === "rate") {
      if (Math.abs(v.playbackRate - action.rate) > 0.001) v.playbackRate = action.rate;
    } else if (!state.correcting && Math.abs(v.playbackRate - speedRef.current) > 0.001) {
      v.playbackRate = speedRef.current; // e.g. the clip's speed changed at a cut
    }
  };

  // Paused: chase the playhead exactly (quickly, by keyframe, while it is still moving; exactly once it settles).
  useEffect(() => {
    const v = ref.current;
    if (playing) return undefined;
    if (prevTime.current !== timeSec) {
      prevTime.current = timeSec; // the playhead really moved (not just a first load): a scrub is in progress
      lastMove.current = performance.now();
    }
    if (!v || v.readyState < 1) return undefined;
    seekToTarget(v);
    const settle = setTimeout(() => seekToTarget(v), SCRUB_SETTLE_MS + 10);
    return () => clearTimeout(settle);
  }, [timeSec, playing]);

  // Start / stop real playback. The video is muted: all sound comes from Web Audio.
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    if (!playing) {
      v.pause();
      v.playbackRate = 1;
      return undefined;
    }
    const drift = newDriftState();
    v.playbackRate = speedRef.current;
    // Where the video really starts playing from — NOT simply `currentTime` at Play time (see the class comment).
    // Re-anchored whenever a seek lands while the picture is not moving yet, and by every (re)start below.
    let from = v.currentTime;
    let reported = false;
    let stopped = false;
    let handle = 0;
    let recoveries = 0;
    let launchPending = false;
    let lastPresent = performance.now();
    let watchdogTimer = 0;

    const step = (_now?: number, meta?: { mediaTime?: number }) => {
      if (stopped) return;
      lastPresent = performance.now();
      const t = meta?.mediaTime ?? v.currentTime;
      if (!reported) {
        // Not while a seek is landing: its jump would look like movement and show a wrong frame.
        if (!v.seeking && t - from >= 0.04) {
          reported = true;
          setShown(true); // it is really moving: show it
          movingRef.current?.(t);
        }
      } else if (!seeking.current && !v.seeking) {
        follow(v, drift); // only once the clock has started from this picture
      }
      handle = schedule();
    };
    const hasCallback = typeof v.requestVideoFrameCallback === "function";
    const schedule = (): number => {
      if (hasCallback) return v.requestVideoFrameCallback(step);
      return requestAnimationFrame(step);
    };
    const cancel = () => {
      if (typeof v.cancelVideoFrameCallback === "function") v.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
    };

    // A seek that lands while the picture is not moving yet re-anchors "where it started from"; if a start was
    // waiting for it (below), it goes ahead now. (A `seeked` that never arrives is covered by the watchdog.)
    const onSeekedStart = () => {
      if (reported || stopped) return;
      from = v.currentTime;
      if (launchPending) {
        launchPending = false;
        launch();
      }
    };
    v.addEventListener("seeked", onSeekedStart);

    /** Anchor to where the video really is and start it. Never `play()` into a seek that is still in flight (see
     * the class comment); only the last-resort restart forces its way through. Starts exactly at the playhead: a
     * start re-seeks first when the video is not already there (Play cancels the scrub's settle seek, which can
     * leave it on a keyframe near the playhead) and waits for that seek to land. */
    const launch = (force = false) => {
      if (stopped || reported) return;
      if (v.seeking && !force) {
        launchPending = true; // `onSeekedStart` launches as soon as the seek lands
        return;
      }
      const want = liveRef.current ? liveRef.current() : target.current;
      if (!force && v.readyState >= 1 && Math.abs(v.currentTime - want) >= 0.05) {
        seeking.current = true;
        v.currentTime = want; // lands → onSeekedStart → launch: never play() into this one either
        launchPending = true;
        return;
      }
      launchPending = false;
      from = v.currentTime;
      lastPresent = performance.now();
      cancel();
      handle = schedule();
      v.playbackRate = speedRef.current;
      // If play() is refused or interrupted, the watchdog restarts it; if that fails too, the clock simply times
      // out waiting and carries on without the picture.
      const started = v.play();
      if (started) started.catch(() => undefined);
    };
    launch();

    /** Stall insurance: a start that has presented nothing for this long (no frame callback has run — on iOS that
     * means no frame was composited) is stuck. Re-assert where the picture should be and start again: the first
     * restart politely waits for its seek to land; the last one forces through a `seeked` that may never come.
     * After two tries it gives up — the poster stays and the sound carries playback. */
    const watchdog = () => {
      if (stopped || reported) return;
      if (performance.now() - lastPresent < START_STALL_MS) {
        watchdogTimer = window.setTimeout(watchdog, START_CHECK_MS);
        return;
      }
      if (recoveries >= 2) return; // gave up: the poster stays, the sound carries playback
      recoveries += 1;
      v.pause();
      const want = liveRef.current ? liveRef.current() : target.current;
      if (Math.abs(v.currentTime - want) >= 0.05) {
        seeking.current = true;
        v.currentTime = want; // lands → onSeekedStart → launch
      }
      launch(recoveries >= 2); // the last resort does not wait for a `seeked` that may never come
      watchdogTimer = window.setTimeout(watchdog, START_CHECK_MS);
    };
    watchdogTimer = window.setTimeout(watchdog, START_CHECK_MS);

    return () => {
      stopped = true;
      v.removeEventListener("seeked", onSeekedStart);
      window.clearTimeout(watchdogTimer);
      cancel();
      v.pause();
    };
  }, [playing]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (!el) return;
      el.removeAttribute("src"); // release the decoder
      el.load?.();
    };
  }, []);

  const onSeeked = () => {
    const v = ref.current;
    if (!v) return;
    seeking.current = false;
    // Paused and the playhead moved meanwhile: chase it. (While playing, the drift controller does the following.)
    const behind = Math.abs(v.currentTime - target.current) >= 0.05;
    if (!playingRef.current && behind) return seekToTarget(v);
    if (shown) return;
    if (alwaysShow) return setShown(true);
    tries.current += 1;
    const r = verify(v);
    if (r === "ok" || (r === "blank" && tries.current >= 3 && v.readyState >= 2)) setShown(true);
  };

  return (
    <video
      ref={ref}
      className="ve-stage-img ve-stage-vid"
      src={url}
      muted
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      style={{ opacity: shown ? 1 : 0 }}
      onLoadedMetadata={() => ref.current && seekToTarget(ref.current)}
      onSeeked={onSeeked}
    />
  );
}

/** The original photo, shown once it has loaded (the poster is underneath until then, and if it can't be decoded). */
export function StageImage({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <img
      className="ve-stage-img"
      src={url}
      alt=""
      draggable={false}
      style={{ opacity: ok ? 1 : 0 }}
      onLoad={() => setOk(true)}
      onError={() => setOk(false)}
    />
  );
}

export function Stage({ frame }: { frame: number }) {
  const fps = useProject((p) => p.settings.fps);
  const { clip, asset } = useStageClip(frame);
  const poster = usePosterUrl(asset);
  const scene = asset && asset.source.type === "generated" ? asset.source.scene : null;
  const mediaId =
    asset && asset.source.type === "stored" && asset.kind !== "audio" ? asset.source.mediaId : null;
  const fullUrl = useMediaUrl(mediaId);
  const playing = usePlaying();
  const live = useLiveFrame();
  const reportMoving = (videoSec: number) => {
    if (!clip) return;
    const at = clip.start + (videoSec * fps - clip.sourceIn) / clip.speed;
    videoSync.reportMoving(at, performance.now());
  };
  return (
    <div className="ve-video">
      {scene && <Scene id={scene} />}
      {poster && <img className="ve-stage-img" src={poster} alt="" draggable={false} />}
      {fullUrl && asset?.kind === "image" && <StageImage key={fullUrl} url={fullUrl} />}
      {fullUrl && asset?.kind === "video" && clip && (
        <StageVideo
          key={fullUrl}
          url={fullUrl}
          timeSec={stageTime(clip, frame, fps)}
          alwaysShow={!poster}
          playing={playing}
          speed={clip.speed}
          onMoving={reportMoving}
          liveTime={live && clip ? () => stageTime(clip, live(), fps) : undefined}
        />
      )}
    </div>
  );
}
