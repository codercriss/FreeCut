import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Frame } from "../model/types";
import { advance } from "./clock";

/**
 * Playback state. Frame (changes up to fps×/s) and controls (stable) live in separate contexts so
 * components that only need play/pause/seek don't re-render every frame. (Phase 1b replaces the rAF clock
 * with an audio-driven master clock and an imperative playhead — Roadmap K3.) The editor opens paused at 00:00:00:00.
 */

export interface Controls {
  playing: boolean;
  fps: number;
  totalFrames: Frame;
  toggle: () => void;
  pause: () => void;
  seek: (frame: Frame) => void;
}

const FrameCtx = createContext<Frame>(0);
const ControlCtx = createContext<Controls | null>(null);

export const useFrame = (): Frame => useContext(FrameCtx);

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
  children: ReactNode;
}

export function PlaybackProvider({
  fps,
  totalFrames,
  startFrame = 0,
  autoPlay = true,
  children,
}: Props) {
  const [frame, setFrame] = useState<Frame>(() => Math.min(startFrame, totalFrames));
  const [playing, setPlaying] = useState(autoPlay && totalFrames > 0);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const step = advance(acc, now - last, fps);
      acc = step.acc;
      last = now;
      if (step.frames > 0) setFrame((f) => Math.min(totalFrames, f + step.frames));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, fps, totalFrames]);

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
        if (!playing && totalFrames > 0 && frameRef.current >= totalFrames) setFrame(0);
        setPlaying((p) => (totalFrames > 0 ? !p : false));
      },
      pause: () => setPlaying(false),
      seek: (f) => setFrame(Math.max(0, Math.min(totalFrames, Math.round(f)))),
    }),
    [playing, fps, totalFrames],
  );

  return (
    <ControlCtx.Provider value={controls}>
      <FrameCtx.Provider value={frame}>{children}</FrameCtx.Provider>
    </ControlCtx.Provider>
  );
}
