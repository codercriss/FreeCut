import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { activeVisualClip, assetById } from "../model/selectors";
import type { Frame } from "../model/types";
import { useProjectStore } from "../store/ProjectContext";
import { planAudio } from "./audioPlan";
import { createAudioEngine } from "./audioEngineEnv";
import type { AudioEngine } from "./audioEngine";
import { Transport } from "./transport";
import { videoSync } from "./videoSync";

/**
 * Playback state. Frame (changes up to fps×/s) and controls (stable) live in separate contexts so
 * components that only need play/pause/seek don't re-render every frame. While playing, the playhead follows the
 * audio clock when sound can run, and the plain time clock when it can't (`transport.ts`). The playhead is still a
 * React state advanced every animation frame; making it imperative is Roadmap K3. The editor opens paused at 00:00:00:00.
 */

export interface Controls {
  playing: boolean;
  fps: number;
  totalFrames: Frame;
  toggle: () => void;
  pause: () => void;
  seek: (frame: Frame) => void;
  /** Left/right meter levels, 0–100; [0, 0] when there is no sound. Cheap enough to read every frame. */
  levels: () => [number, number];
}

const FrameCtx = createContext<Frame>(0);
const ControlCtx = createContext<Controls | null>(null);

export const useFrame = (): Frame => useContext(FrameCtx);

/** Is playback running? Unlike `useControls`, safe to call with no provider (it then says no). */
export const usePlaying = (): boolean => useContext(ControlCtx)?.playing ?? false;

export function useControls(): Controls {
  const ctl = useContext(ControlCtx);
  if (!ctl) throw new Error("useControls must be used inside <PlaybackProvider>");
  return ctl;
}

export const usePlayback = (): Controls & { frame: Frame } => ({
  frame: useFrame(),
  ...useControls(),
});

interface Props {
  fps: number;
  totalFrames: Frame;
  startFrame?: Frame;
  autoPlay?: boolean;
  /** Tests can pass their own sound engine, or null for none; by default the real one is used where it exists. */
  audio?: AudioEngine | null;
  children: ReactNode;
}

export function PlaybackProvider({
  fps,
  totalFrames,
  startFrame = 0,
  autoPlay = true,
  audio,
  children,
}: Props) {
  const [frame, setFrame] = useState<Frame>(() => Math.min(startFrame, totalFrames));
  const [playing, setPlaying] = useState(autoPlay && totalFrames > 0);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const store = useProjectStore();
  const [engine] = useState<AudioEngine | null>(() =>
    audio === undefined ? createAudioEngine() : audio,
  );
  const timing = useRef({ fps, totalFrames });
  timing.current = { fps, totalFrames };

  const transport = useMemo(
    () =>
      new Transport({
        fps: () => timing.current.fps,
        total: () => timing.current.totalFrames,
        audio: engine,
        plan: (frame) => planAudio(store.getProject(), frame),
        expectsVideo: (frame) => {
          const project = store.getProject();
          const clip = activeVisualClip(project, frame);
          const asset = clip ? assetById(project, clip.assetId) : undefined;
          return !!asset && asset.kind === "video" && asset.source.type === "stored";
        },
        videoMoving: () => videoSync.moving(),
        resetVideo: () => videoSync.reset(),
      }),
    [engine, store],
  );

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    transport.begin(frameRef.current, performance.now(), true);
    const tick = () => {
      const next = transport.tick(performance.now());
      setFrame((f) => (f === next ? f : next));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      transport.stop();
    };
  }, [playing, transport]);

  // Stop at the end; and if the project got shorter (undo, delete…) keep the playhead inside it.
  useEffect(() => {
    if (playing && frame >= totalFrames) setPlaying(false);
    if (frame > totalFrames) setFrame(totalFrames);
  }, [frame, playing, totalFrames]);

  const controls = useMemo<Controls>(
    () => ({
      playing,
      fps,
      totalFrames,
      toggle: () => {
        // iOS only lets sound start from inside the tap itself, so wake the audio context right here, synchronously.
        if (!playing && totalFrames > 0) engine?.unlock();
        if (!playing && totalFrames > 0 && frameRef.current >= totalFrames) setFrame(0);
        setPlaying((p) => (totalFrames > 0 ? !p : false));
      },
      pause: () => setPlaying(false),
      seek: (f) => {
        const next = Math.max(0, Math.min(totalFrames, Math.round(f)));
        setFrame(next);
        // Jumping while playing: the sound and clock restart from the new place (the picture follows by itself).
        // A "seek" within a couple of frames of the playhead is just rounding (e.g. a scroll position), not a jump.
        const jumped = Math.abs(next - frameRef.current) > 2;
        if (playingRef.current && jumped) transport.begin(next, performance.now(), false);
      },
      levels: () => engine?.levels() ?? [0, 0],
    }),
    [playing, fps, totalFrames, engine, transport],
  );

  return (
    <ControlCtx.Provider value={controls}>
      <FrameCtx.Provider value={frame}>{children}</FrameCtx.Provider>
    </ControlCtx.Provider>
  );
}
