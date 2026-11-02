import { useEffect, useRef, useState } from "react";
import { usePlaying } from "../engine/playback";
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
}

/**
 * A native <video> showing `timeSec`. Paused: it chases `timeSec`; one seek is in flight at a time (so scrubbing
 * never piles up work on a phone) and when it lands we chase the latest target. Playing: it plays muted and a small
 * controller keeps it within a frame or two of `timeSec` — a gentle speed-up or slow-down for small drift, a seek
 * only for big drift (a jump in the clip, a slow start). It stays invisible until a real, non-blank frame has been
 * verified (a genuinely black first frame is accepted after a few tries) or, when playing, until it is moving.
 */
export function StageVideo({
  url,
  timeSec,
  alwaysShow = false,
  verify = verifyFrame,
  playing = false,
  speed = 1,
  onMoving,
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
  const lastResync = useRef(0);

  const seekToTarget = (v: HTMLVideoElement) => {
    if (seeking.current || Math.abs(v.currentTime - target.current) < 0.03) return;
    seeking.current = true;
    v.currentTime = target.current;
  };

  /** Playing: keep the picture in step with the playhead. */
  const follow = (v: HTMLVideoElement) => {
    const drift = v.currentTime - target.current; // positive: the picture is ahead of the playhead
    if (Math.abs(drift) > 0.5) {
      const now = performance.now();
      if (!seeking.current && now - lastResync.current > 700) {
        lastResync.current = now;
        seeking.current = true;
        v.currentTime = target.current;
      }
      return;
    }
    const nudge = Math.abs(drift) > 0.04 ? Math.max(-0.25, Math.min(0.25, drift)) : 0;
    v.playbackRate = speedRef.current * (1 - nudge);
  };

  useEffect(() => {
    const v = ref.current;
    if (!v || v.readyState < 1) return;
    if (playing) follow(v);
    else seekToTarget(v); // paused: chase the playhead exactly
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
    v.playbackRate = speedRef.current;
    const from = v.currentTime;
    let done = false;
    let handle = 0;
    const watch = (_now?: number, meta?: { mediaTime?: number }) => {
      if (done) return;
      const t = meta?.mediaTime ?? v.currentTime;
      // Not while a seek is landing: its jump would look like movement and show a wrong frame.
      if (!v.seeking && t - from >= 0.04) {
        done = true;
        setShown(true); // it is really moving: show it
        movingRef.current?.(t);
        return;
      }
      handle = schedule();
    };
    const hasCallback = typeof v.requestVideoFrameCallback === "function";
    const schedule = (): number => {
      if (hasCallback) return v.requestVideoFrameCallback(watch);
      return requestAnimationFrame(watch);
    };
    handle = schedule();
    // If play() is refused or interrupted, the clock simply times out waiting and carries on.
    const started = v.play();
    if (started) started.catch(() => undefined);
    return () => {
      done = true;
      if (typeof v.cancelVideoFrameCallback === "function") v.cancelVideoFrameCallback(handle);
      else cancelAnimationFrame(handle);
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
        />
      )}
    </div>
  );
}
