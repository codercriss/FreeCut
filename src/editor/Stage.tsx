import { useEffect, useRef, useState } from "react";
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
 *  - imported videos: a real, full-resolution frame from the original file that follows the playhead
 *    (silent and not yet "playing" — real playback with sound is Phase 1b).
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
}

/**
 * A paused native <video> that chases `timeSec`. One seek is in flight at a time (so scrubbing never piles up
 * work on a phone); when it lands we chase the latest target. It stays invisible until a real, non-blank frame
 * has been verified (a genuinely black first frame is accepted after a few tries).
 */
export function StageVideo({
  url,
  timeSec,
  alwaysShow = false,
  verify = verifyFrame,
}: StageVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [shown, setShown] = useState(false);
  const target = useRef(timeSec);
  target.current = timeSec;
  const seeking = useRef(false);
  const tries = useRef(0);

  const seekToTarget = (v: HTMLVideoElement) => {
    if (seeking.current || Math.abs(v.currentTime - target.current) < 0.03) return;
    seeking.current = true;
    v.currentTime = target.current;
  };

  useEffect(() => {
    const v = ref.current;
    if (v && v.readyState >= 1) seekToTarget(v); // follow the playhead
  }, [timeSec]);

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
    if (Math.abs(v.currentTime - target.current) >= 0.05) return seekToTarget(v); // the playhead moved meanwhile: chase it
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
        />
      )}
    </div>
  );
}
