/**
 * A tiny hand-off between the picture and the clock. When playback starts, the on-screen video needs a moment before
 * it is really moving (0.2–0.3 s on an iPhone, longer on the very first play — see the Playback check). The Stage
 * tells the clock the moment its video moves, with the timeline frame that corresponds to, and the clock starts
 * the sound and the playhead from there, so picture and sound begin together.
 */
export interface VideoMoving {
  /** The timeline frame the video was showing when it began moving. */
  frame: number;
  /** `performance.now()` at that moment. */
  perf: number;
}

let current: VideoMoving | null = null;

export const videoSync = {
  /** Forget the last report (called whenever a new run of playback begins). */
  reset(): void {
    current = null;
  },
  reportMoving(frame: number, perf: number): void {
    current = { frame, perf };
  },
  moving(): VideoMoving | null {
    return current;
  },
};
