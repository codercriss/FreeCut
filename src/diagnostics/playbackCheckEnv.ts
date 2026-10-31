import { getMedia } from "../media/mediaStore";
import { waitForEvent, type VideoLike } from "../media/poster";
import { makeMediaElement } from "../media/probe";
import { fitSize } from "../media/thumbnail";
import type { Asset } from "../model/types";
import {
  findSampleAsset,
  LIMITS,
  type AudioContextLike,
  type AudioDecodeResult,
  type OpenedVideo,
  type PlaybackEnv,
  type PlayFramesResult,
  type PlayRunOptions,
  type PlaySample,
  type SampleTools,
  type ToneKind,
} from "./playbackCheck";
import { toneWav } from "./toneWav";

/**
 * The real browser behind the playback check. Every call here is deliberately defensive: this runs on phones
 * whose behaviour we are trying to learn, so each browser API is feature-detected and each result is plain data.
 * Not unit-tested (it IS the browser); the decisions it feeds live in `playbackCheck.ts`.
 */

type AudioCtor = new () => AudioContext;

function audioCtor(): AudioCtor | null {
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function audioSession(): { type: string } | null {
  const nav = navigator as unknown as { audioSession?: { type: string } };
  return nav.audioSession ?? null;
}

interface DecoderStatic {
  isConfigSupported(config: Record<string, unknown>): Promise<{ supported?: boolean }>;
}

function decoderClass(name: "VideoDecoder" | "AudioDecoder"): DecoderStatic | null {
  const g = globalThis as unknown as Record<string, DecoderStatic | undefined>;
  return g[name] ?? null;
}

const has = (name: string): boolean => name in globalThis;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const asVideoLike = (v: HTMLVideoElement) => v as unknown as VideoLike;

function errName(e: unknown): string {
  const named = e as { name?: unknown; message?: unknown } | null;
  const name = typeof named?.name === "string" ? named.name : "";
  const message = typeof named?.message === "string" ? named.message : "";
  return name || message || String(e);
}

/** iOS: Web Audio obeys the silent switch unless the page declares it is "playback". Best effort. */
function setSessionPlayback(): void {
  const session = audioSession();
  if (!session) return;
  try {
    session.type = "playback";
  } catch {
    // The check's own rows already report whether this was refused.
  }
}

function playTone(kind: ToneKind): Promise<void> {
  // Everything up to the first `.play()` / `.resume()` call is synchronous on purpose (iOS gesture rule).
  setSessionPlayback();
  if (kind === "webaudio") {
    const Ctor = audioCtor();
    if (!Ctor) return Promise.reject(new Error("This browser has no AudioContext."));
    const ctx = new Ctor();
    const resumed = ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    osc.frequency.value = 440;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const finished = new Promise<void>((resolve) => {
      osc.onended = () => resolve();
    });
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    setTimeout(() => void ctx.close().catch(() => undefined), 3000);
    return resumed.then(() => finished);
  }
  const url = URL.createObjectURL(new Blob([toneWav()], { type: "audio/wav" }));
  const el = new Audio(url);
  const finished = new Promise<void>((resolve) => {
    el.onended = () => resolve();
  });
  const started = el.play();
  const release = () => URL.revokeObjectURL(url);
  return Promise.resolve(started).then(
    () => finished.finally(release),
    (e) => {
      release();
      throw e;
    },
  );
}

function webgl(): { version: 1 | 2; maxTextureSize: number } | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return null;
  const version = has("WebGL2RenderingContext") && gl instanceof WebGL2RenderingContext ? 2 : 1;
  const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return { version, maxTextureSize };
}

/* ───────────── your imported video, opened for measuring ───────────── */

/** Preview-sized canvas: roughly what a phone's player draws (see how_it_works: Stage). */
const DRAW_MAX_SIDE = 1280;

/**
 * The measuring element's look. "Hidden" is what the poster code uses (tiny and nearly transparent; not
 * display:none, which iOS may not decode). "Visible" is a small opaque corner thumbnail — the A/B that tells us
 * whether iOS throttles video it considers invisible.
 */
function setVisible(v: HTMLVideoElement, visible: boolean): void {
  Object.assign(v.style, {
    position: "fixed",
    left: visible ? "8px" : "0",
    top: visible ? "8px" : "0",
    width: visible ? "160px" : "2px",
    height: visible ? "auto" : "2px",
    opacity: visible ? "1" : "0.01",
    zIndex: visible ? "2147483000" : "auto",
    borderRadius: visible ? "8px" : "0",
    pointerEvents: "none",
  });
}

/** The decoder's own frame counts, where the browser offers them (Safari does). */
function qualityOf(v: HTMLVideoElement): { total: number; dropped: number } | null {
  if (typeof v.getVideoPlaybackQuality !== "function") return null;
  const q = v.getVideoPlaybackQuality();
  return { total: q.totalVideoFrames, dropped: q.droppedVideoFrames };
}

/**
 * Call `onFrame` for every new picture the video presents, with the video's own time at that frame. Uses the
 * video's frame callback where it exists (exact), otherwise animation frames that saw the video time change.
 * Returns the way of stopping and which clock is in use.
 */
function onEachFrame(
  v: HTMLVideoElement,
  onFrame: (mediaTime: number) => void,
): { stop: () => void; via: "rvfc" | "raf" } {
  const viaCallback = typeof v.requestVideoFrameCallback === "function";
  let stopped = false;
  let lastSeen = -1;
  const tick = (_now?: number, meta?: { mediaTime?: number }) => {
    if (stopped) return;
    const mediaTime = meta?.mediaTime ?? v.currentTime;
    if (viaCallback || mediaTime !== lastSeen) {
      lastSeen = mediaTime;
      onFrame(mediaTime);
    }
    schedule();
  };
  const schedule = () => {
    if (viaCallback) v.requestVideoFrameCallback(tick);
    else requestAnimationFrame(tick);
  };
  schedule();
  return { stop: () => (stopped = true), via: viaCallback ? "rvfc" : "raf" };
}

function previewCanvas(v: HTMLVideoElement) {
  const { w, h } = fitSize(v.videoWidth, v.videoHeight, DRAW_MAX_SIDE);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No 2D canvas.");
  return { ctx, w, h };
}

function makeSampleTools(name: string, blob: Blob): SampleTools {
  let url: string | null = null;
  let video: HTMLVideoElement | null = null;

  const need = (): HTMLVideoElement => {
    if (!video) throw new Error("The video is not open.");
    return video;
  };

  const playQuietly = async (v: HTMLVideoElement): Promise<void> => {
    try {
      await Promise.race([v.play(), sleep(3000)]);
    } catch {
      // Refused: the measurements below will say so (0 frames).
    }
  };

  return {
    info: { name, bytes: blob.size, mime: blob.type },

    async decodeAudio(): Promise<AudioDecodeResult> {
      if (blob.size > LIMITS.decodeMaxBytes) {
        return { kind: "too-big", limitBytes: LIMITS.decodeMaxBytes };
      }
      const Ctor = audioCtor();
      if (!Ctor) return { kind: "none", reason: "no AudioContext" };
      const ctx = new Ctor();
      try {
        const data = await blob.arrayBuffer();
        const started = performance.now();
        const audio = await ctx.decodeAudioData(data);
        return {
          kind: "ok",
          seconds: audio.duration,
          channels: audio.numberOfChannels,
          sampleRate: audio.sampleRate,
          ms: performance.now() - started,
        };
      } catch (e) {
        return { kind: "none", reason: errName(e) };
      } finally {
        void ctx.close().catch(() => undefined);
      }
    },

    async open(): Promise<OpenedVideo> {
      url = URL.createObjectURL(blob);
      const v = makeMediaElement("video") as HTMLVideoElement;
      v.preload = "auto";
      setVisible(v, false);
      v.setAttribute("aria-hidden", "true");
      document.body.appendChild(v);
      video = v;
      v.src = url;
      if (v.readyState < 1) await waitForEvent(asVideoLike(v), ["loadedmetadata"], 6000);
      if (!v.videoWidth || !v.videoHeight) throw new Error("No picture (audio-only file?)");
      // iOS only decodes frames once asked to play (see poster.ts).
      await playQuietly(v);
      if (v.readyState < 2) {
        const frame = ["loadeddata", "canplay", "playing", "timeupdate"];
        await waitForEvent(asVideoLike(v), frame, 6000);
      }
      v.pause();
      return { width: v.videoWidth, height: v.videoHeight, durationS: v.duration };
    },

    async playFrames(opts: PlayRunOptions): Promise<PlayFramesResult> {
      const v = need();
      // Drawing, when asked for, is the ordinary thing a player does: a queued copy per frame, no read-back.
      const target = opts.draw ? previewCanvas(v) : null;
      v.pause();
      if (v.duration - v.currentTime < opts.ms / 1000 + 0.5) {
        v.currentTime = 0;
        await waitForEvent(asVideoLike(v), ["seeked"], 6000);
      }

      setVisible(v, opts.visible);
      const samples: PlaySample[] = [];
      let waiting = 0;
      let stalled = 0;
      const onWaiting = () => (waiting += 1);
      const onStalled = () => (stalled += 1);
      v.addEventListener("waiting", onWaiting);
      v.addEventListener("stalled", onStalled);
      const before = qualityOf(v);
      const started = performance.now();
      const loop = onEachFrame(v, (mediaS) => {
        samples.push({ atMs: performance.now() - started, mediaS });
        if (target) target.ctx.drawImage(v, 0, 0, target.w, target.h);
      });

      try {
        await playQuietly(v);
        await sleep(Math.max(0, opts.ms - (performance.now() - started)));
      } finally {
        loop.stop();
        v.pause();
        v.removeEventListener("waiting", onWaiting);
        v.removeEventListener("stalled", onStalled);
        setVisible(v, false);
      }
      const after = qualityOf(v);
      let quality: { total: number; dropped: number } | null = null;
      if (before && after) {
        quality = { total: after.total - before.total, dropped: after.dropped - before.dropped };
      }
      return { via: loop.via, samples, waiting, stalled, quality };
    },

    async copyMs(n: number): Promise<number[]> {
      const v = need();
      const target = previewCanvas(v);
      v.pause();
      setVisible(v, true);
      const out: number[] = [];
      let lastAt = -Infinity;
      let finish: () => void = () => undefined;
      const full = new Promise<void>((resolve) => (finish = resolve));
      // One forced-finish copy about every 250 ms of NEW frames. Forcing completion (reading a pixel back)
      // stalls the page, so it is kept sparse and kept out of the playback runs above.
      const loop = onEachFrame(v, () => {
        const at = performance.now();
        if (at - lastAt < 250) {
          target.ctx.drawImage(v, 0, 0, target.w, target.h);
          return;
        }
        lastAt = at;
        target.ctx.drawImage(v, 0, 0, target.w, target.h);
        target.ctx.getImageData(0, 0, 1, 1);
        out.push(performance.now() - at);
        if (out.length >= n) finish();
      });
      try {
        await playQuietly(v);
        await Promise.race([full, sleep(n * 400 + 2000)]);
      } finally {
        loop.stop();
        v.pause();
        setVisible(v, false);
      }
      return out;
    },

    async seekMs(n: number): Promise<number[]> {
      const v = need();
      v.pause();
      const out: number[] = [];
      for (let i = 0; i < n; i += 1) {
        // Spread-out targets (never the same place twice), so no seek can be answered from the previous frame.
        const fraction = (0.11 + i * 0.37) % 0.9;
        const target = Math.max(0, Math.min(v.duration - 0.05, v.duration * fraction));
        const started = performance.now();
        v.currentTime = target;
        await waitForEvent(asVideoLike(v), ["seeked"], 6000);
        out.push(performance.now() - started);
      }
      return out;
    },

    async textureMs(n: number): Promise<number[] | null> {
      const v = need();
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) return null;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try {
        // Upload while the video is playing: that is the case the iOS bug reports are about.
        await playQuietly(v);
        await sleep(300);
        const out: number[] = [];
        for (let i = 0; i < n; i += 1) {
          const started = performance.now();
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
          gl.finish();
          out.push(performance.now() - started);
          await sleep(16);
        }
        return out;
      } finally {
        v.pause();
        gl.deleteTexture(texture);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    },

    close(): void {
      const v = video;
      video = null;
      if (v) {
        try {
          v.pause();
          v.removeAttribute("src");
          v.load();
        } finally {
          v.remove();
        }
      }
      if (url) URL.revokeObjectURL(url);
      url = null;
    },
  };
}

/* ───────────── the environment ───────────── */

/** `assets` is read when the check runs, so it sees what the person has imported by then. */
export function createPlaybackEnv(assets: () => readonly Asset[]): PlaybackEnv {
  const videoEl = document.createElement("video");
  const audioEl = document.createElement("audio");
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    standalone:
      (navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches,
    devicePixelRatio: window.devicePixelRatio,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    cores: navigator.hardwareConcurrency || null,

    createAudioContext(): AudioContextLike | null {
      const Ctor = audioCtor();
      return Ctor ? new Ctor() : null;
    },
    audioSession,
    elementVolumeWritable() {
      try {
        const probe = new Audio();
        probe.volume = 0.5;
        return probe.volume === 0.5;
      } catch {
        return null;
      }
    },
    canPlayType: (mime) => (mime.startsWith("audio/") ? audioEl : videoEl).canPlayType(mime),
    hasRequestVideoFrameCallback: () => "requestVideoFrameCallback" in HTMLVideoElement.prototype,
    webgl,
    webCodecs: () => ({
      videoDecoder: has("VideoDecoder"),
      audioDecoder: has("AudioDecoder"),
      videoEncoder: has("VideoEncoder"),
      audioEncoder: has("AudioEncoder"),
    }),
    async videoDecoderSupported(t) {
      const decoder = decoderClass("VideoDecoder");
      if (!decoder) return false;
      const config = { codec: t.codec, codedWidth: t.width, codedHeight: t.height };
      return (await decoder.isConfigSupported(config)).supported === true;
    },
    async audioDecoderSupported(t) {
      const decoder = decoderClass("AudioDecoder");
      if (!decoder) return false;
      const config = { codec: t.codec, sampleRate: t.sampleRate, numberOfChannels: t.channels };
      return (await decoder.isConfigSupported(config)).supported === true;
    },
    async loadSample() {
      const asset = findSampleAsset(assets());
      if (!asset || asset.source.type !== "stored") return null;
      const blob = await getMedia(asset.source.mediaId);
      if (!blob) throw new Error(`The stored file for “${asset.name}” could not be read.`);
      return makeSampleTools(asset.name, blob);
    },
    playTone,
  };
}
