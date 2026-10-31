/**
 * A short sine tone as a 16-bit mono WAV file, for the "<audio> element" test tone in the playback check.
 * Generated in code so the check needs no audio asset and works offline. Pure.
 */
export interface ToneOptions {
  seconds?: number;
  hz?: number;
  sampleRate?: number;
  /** 0–1 of full scale; kept low so a test tone is never loud. */
  volume?: number;
}

export function toneWav(opts: ToneOptions = {}): Uint8Array<ArrayBuffer> {
  const seconds = opts.seconds ?? 0.6;
  const hz = opts.hz ?? 440;
  const sampleRate = opts.sampleRate ?? 22050;
  const volume = opts.volume ?? 0.3;
  const count = Math.max(1, Math.round(seconds * sampleRate));
  const bytes = new Uint8Array(44 + count * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // size of the fmt block
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, count * 2, true);
  const fade = Math.max(1, Math.round(sampleRate * 0.01)); // 10 ms ramps: no click at either end
  for (let i = 0; i < count; i += 1) {
    const ramp = Math.min(1, i / fade, (count - 1 - i) / fade);
    const sample = Math.sin((2 * Math.PI * hz * i) / sampleRate) * volume * ramp;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }
  return bytes;
}
