/**
 * Keeping the playing picture in step with the playhead. Pure and unit-tested: given how far the video is from where
 * it should be, decide whether to leave it alone, gently change its speed, or jump it.
 *
 * Why it is shaped like this (Handover L-054): the first version nudged `playbackRate` on every frame and, in a real
 * browser, changed it 177 times in 5 seconds, hunting between 1.00× and 1.09×. Each change can make a phone's video
 * pipeline stutter. So now:
 *  - a DEAD ZONE: within ±80 ms (under three frames at 30 fps) nothing is touched — a steady small offset is invisible;
 *  - beyond it, ONE correction (speed ±6 %) that is held until the video is within 20 ms (hysteresis), not re-decided
 *    every frame, and not started more often than every 400 ms;
 *  - beyond ±450 ms the video is jumped (a seek), at most once per 800 ms.
 */
export const DRIFT = {
  /** Leave the video alone while it is this close (seconds). */
  dead: 0.08,
  /** Once correcting, stop when this close (seconds). */
  back: 0.02,
  /** Beyond this, jump with a seek (seconds). */
  hard: 0.45,
  /** How much to speed up or slow down while correcting (a fraction of the normal speed). */
  trim: 0.06,
  /** The shortest gap between starting two corrections (milliseconds). */
  minGapMs: 400,
  /** The shortest gap between two jumps (milliseconds). */
  seekGapMs: 800,
} as const;

export interface DriftState {
  correcting: boolean;
  lastChangeAt: number;
  lastSeekAt: number;
}

export type DriftAction = { kind: "none" } | { kind: "rate"; rate: number } | { kind: "seek" };

export const newDriftState = (): DriftState => ({
  correcting: false,
  lastChangeAt: -Infinity,
  lastSeekAt: -Infinity,
});

const NONE: DriftAction = { kind: "none" };

/**
 * `drift` = where the video is minus where it should be, in seconds (positive: the picture is ahead).
 * `base` = the clip's normal playback rate. Updates `state`. Call it as often as you like (e.g. every video frame):
 * a "rate" action repeats while correcting, so apply it only when the value differs from the video's current rate.
 */
export function decideDrift(
  state: DriftState,
  drift: number,
  base: number,
  now: number,
): DriftAction {
  const abs = Math.abs(drift);
  if (abs > DRIFT.hard) {
    if (now - state.lastSeekAt < DRIFT.seekGapMs) return NONE;
    state.lastSeekAt = now;
    state.lastChangeAt = now;
    state.correcting = false;
    return { kind: "seek" };
  }
  const correction = base * (drift > 0 ? 1 - DRIFT.trim : 1 + DRIFT.trim);
  if (state.correcting) {
    if (abs >= DRIFT.back) return { kind: "rate", rate: correction };
    state.correcting = false;
    state.lastChangeAt = now;
    return { kind: "rate", rate: base };
  }
  if (abs > DRIFT.dead && now - state.lastChangeAt >= DRIFT.minGapMs) {
    state.correcting = true;
    state.lastChangeAt = now;
    return { kind: "rate", rate: correction };
  }
  return NONE;
}
