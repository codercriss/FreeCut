/**
 * Time-based frame advance (not "+1 per rAF"), so playback speed is right on 30/60/120/144 Hz displays.
 * `acc` carries the fractional frame between ticks. Pure → unit-tested.
 */
export function advance(
  acc: number,
  elapsedMs: number,
  fps: number,
): { frames: number; acc: number } {
  const total = acc + (elapsedMs * fps) / 1000;
  const frames = Math.floor(total);
  return { frames, acc: total - frames };
}
