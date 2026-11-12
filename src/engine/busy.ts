/**
 * "Is the person busy with the picture right now?" While they play, scrub or zoom, a phone needs all of its video
 * decoder and main thread, so heavy background work (building filmstrips: a second hidden video decoding, plus a big
 * image encode) waits for a quiet moment instead of competing with them. (Handover L-054.)
 *
 * Two ways to be busy:
 *  - a HOLD, kept for as long as something lasts (playback): `holdBusy()` returns the way to let go;
 *  - a PULSE, for a short while after each event (a scroll, a zoom step): `pulseBusy(ms)`.
 */
let holds = 0;
let pulseUntil = 0;

const nowMs = (): number => Date.now();

/** Be busy until the returned function is called (safe to call more than once). */
export function holdBusy(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds = Math.max(0, holds - 1);
  };
}

/** Be busy for `ms` more milliseconds (extends an earlier pulse, never shortens it). */
export function pulseBusy(ms: number, now: number = nowMs()): void {
  pulseUntil = Math.max(pulseUntil, now + ms);
}

export function isBusy(now: number = nowMs()): boolean {
  return holds > 0 || now < pulseUntil;
}

export interface QuietOptions {
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Resolves as soon as nothing is holding or pulsing; checks every `pollMs` (150 ms). */
export async function whenQuiet(opts: QuietOptions = {}): Promise<void> {
  const poll = opts.pollMs ?? 150;
  const now = opts.now ?? nowMs;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  while (isBusy(now())) await sleep(poll);
}

/** For tests: forget every hold and pulse. */
export function resetBusy(): void {
  holds = 0;
  pulseUntil = 0;
}
