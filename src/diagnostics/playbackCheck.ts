import type { Asset } from "../model/types";

/**
 * "Playback check" (Phase 1b.0): a short, screenshot-able report of what THIS phone's browser can do, gathered
 * before the playback engine is built on assumptions. The 1b research (Knowledge_Contribution R-001/R-004/R-005)
 * found several iOS behaviours that are documented only by old bug reports and forum threads — whether HEVC
 * decodes in WebCodecs, whether the silent switch mutes Web Audio, whether media-element volume works, and how
 * slow video → canvas/texture copies are on an A11-class phone. This measures them on the real device, using the
 * person's own imported video where it matters.
 *
 * Shape (D-023): pure decisions live here; every browser touch goes through `PlaybackEnv`, so the grading, the
 * time-outs and the iOS gesture ordering are unit-tested in Node. `playbackCheckEnv.ts` holds the real calls.
 * No React / DOM imports in this file.
 */

export type CheckStatus = "ok" | "warn" | "fail" | "info" | "skip";
export type CheckGroup = "device" | "audio" | "codecs" | "video" | "speed";

export interface CheckRow {
  id: string;
  group: CheckGroup;
  label: string;
  status: CheckStatus;
  detail: string;
}

/** The slice of AudioContext the check needs. */
export interface AudioContextLike {
  readonly state: string;
  readonly sampleRate: number;
  resume(): Promise<void>;
  close?(): Promise<void>;
}

export type AudioDecodeResult =
  | { kind: "ok"; seconds: number; channels: number; sampleRate: number; ms: number }
  /** The file decoded to nothing (no audio track, or a format Web Audio can't read). */
  | { kind: "none"; reason: string }
  /** Skipped on purpose: decoding needs the whole file in memory. */
  | { kind: "too-big"; limitBytes: number };

/** One presented video frame during a playback run. */
export interface PlaySample {
  /** Milliseconds since `play()` was requested. */
  atMs: number;
  /** The video's own time at that frame, in seconds. */
  mediaS: number;
}

export interface PlayRunOptions {
  /** How long the run lasts, in milliseconds. */
  ms: number;
  /** Show the video as a small corner thumbnail instead of leaving it effectively invisible. */
  visible: boolean;
  /** Also copy every frame to a 2D canvas (queued, as a real player would), to see if playback still keeps up. */
  draw: boolean;
}

export interface PlayFramesResult {
  /** Which clock delivered the frames: the video's own callback, or a plain animation frame. */
  via: "rvfc" | "raf";
  /** Every frame that was presented, in order. */
  samples: PlaySample[];
  /** `waiting` / `stalled` events during the run: the browser saying it ran out of data. */
  waiting: number;
  stalled: number;
  /** The decoder's own frame counts for the run (`getVideoPlaybackQuality`); null when unavailable. */
  quality: { total: number; dropped: number } | null;
}

export interface OpenedVideo {
  width: number;
  height: number;
  durationS: number;
}

/** One imported video, opened for measuring. Created by `PlaybackEnv.loadSample`. */
export interface SampleTools {
  info: { name: string; bytes: number; mime: string };
  decodeAudio(): Promise<AudioDecodeResult>;
  /** Attach the video (muted, inline), get a real frame decoded, report its size. */
  open(): Promise<OpenedVideo>;
  playFrames(opts: PlayRunOptions): Promise<PlayFramesResult>;
  /** Milliseconds for a video → 2D canvas copy forced to finish, sampled sparsely from new frames of a playing video. */
  copyMs(n: number): Promise<number[]>;
  /** Milliseconds from setting `currentTime` until `seeked`, for `n` spread-out targets. */
  seekMs(n: number): Promise<number[]>;
  /** Milliseconds per `texImage2D(video)` upload; null when WebGL is unavailable. */
  textureMs(n: number): Promise<number[] | null>;
  /** Release the element and its object URL. */
  close(): void;
}

export interface VideoDecoderTest {
  label: string;
  codec: string;
  width: number;
  height: number;
}

export interface AudioDecoderTest {
  label: string;
  codec: string;
  sampleRate: number;
  channels: number;
}

export interface WebCodecsSupport {
  videoDecoder: boolean;
  audioDecoder: boolean;
  videoEncoder: boolean;
  audioEncoder: boolean;
}

export type ToneKind = "webaudio" | "element";

/** Everything the check reads from the browser. Real implementation: `playbackCheckEnv.ts`. */
export interface PlaybackEnv {
  userAgent: string;
  platform: string;
  standalone: boolean;
  devicePixelRatio: number;
  screenWidth: number;
  screenHeight: number;
  cores: number | null;
  /** Make an AudioContext. Called synchronously inside the tap (see the GESTURE note in the runner). */
  createAudioContext(): AudioContextLike | null;
  /** `navigator.audioSession`, if the browser has it. */
  audioSession(): { type: string } | null;
  /** Set `new Audio().volume = 0.5` and read it back; null if it can't be tried. */
  elementVolumeWritable(): boolean | null;
  canPlayType(mime: string): string;
  hasRequestVideoFrameCallback(): boolean;
  webgl(): { version: 1 | 2; maxTextureSize: number } | null;
  webCodecs(): WebCodecsSupport;
  /** `VideoDecoder.isConfigSupported(...).supported`; may reject (e.g. "Config is not valid"). */
  videoDecoderSupported(t: VideoDecoderTest): Promise<boolean>;
  audioDecoderSupported(t: AudioDecoderTest): Promise<boolean>;
  /** Open the person's largest imported video; null when the project has none. */
  loadSample(): Promise<SampleTools | null>;
  /** Play a half-second 440 Hz tone. Must start the sound synchronously (iOS gesture rule). */
  playTone(kind: ToneKind): Promise<void>;
}

/* ───────────── small pure helpers ───────────── */

export function median(xs: readonly number[]): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Nearest-rank percentile (p in 0–100). */
export function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

export function fmtMs(n: number): string {
  if (!Number.isFinite(n)) return "–";
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ms`;
}

export function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function errText(e: unknown): string {
  const m = e instanceof Error ? e.message || e.name : String(e);
  return m.length > 120 ? `${m.slice(0, 117)}…` : m;
}

function dur(ms: number): string {
  return ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`;
}

export type Guarded<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Run `work` with a time limit and never throw: a hung browser call (a decoder that never answers, a `seeked` that
 * never fires — L-024's lesson) becomes a "timed out" row instead of a frozen check. `work` is started
 * synchronously, which the gesture-critical callers rely on.
 */
export async function guard<T>(
  work: () => Promise<T> | T,
  ms: number,
  what: string,
): Promise<Guarded<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${what} timed out after ${dur(ms)}`)), ms);
    });
    const value = await Promise.race([(async () => work())(), limit]);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: errText(e) };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export interface IosInfo {
  isIos: boolean;
  /** 0 when unknown. As the browser reports it; Safari may freeze this number on newer iOS. */
  major: number;
  minor: number;
}

export function parseIos(ua: string): IosInfo {
  const isIos = /\b(iPhone|iPad|iPod)\b/.test(ua);
  const m = /OS (\d+)[_.](\d+)/.exec(ua);
  const known = isIos && m !== null;
  return { isIos, major: known ? Number(m[1]) : 0, minor: known ? Number(m[2]) : 0 };
}

export function iosAtLeast(i: IosInfo, major: number, minor: number): boolean {
  if (!i.isIos || i.major === 0) return false;
  return i.major > major || (i.major === major && i.minor >= minor);
}

export function browserName(ua: string): string {
  if (/CriOS\//.test(ua)) return "Chrome (iOS)";
  if (/FxiOS\//.test(ua)) return "Firefox (iOS)";
  if (/EdgiOS\/|Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  const v = /Version\/(\d+(?:\.\d+)?)/.exec(ua);
  if (/Safari\//.test(ua)) return v ? `Safari ${v[1]}` : "Safari";
  return "browser";
}

/**
 * Pass/fail limits for the measured numbers. Why these: a 30 fps picture has 33 ms per frame for decoding, copying,
 * compositing and the UI, so a copy should cost well under a quarter of that; scrubbing feels instant under
 * ~150 ms and sluggish past ~400 ms; a one-off texture upload is fine under ~6 ms but kills a frame past ~16 ms.
 * They only colour the report — the raw numbers are always printed.
 */
export const LIMITS = {
  drawOkMs: 8,
  drawWarnMs: 20,
  seekOkMs: 150,
  seekWarnMs: 400,
  textureOkMs: 6,
  textureWarnMs: 16,
  /** Media seconds advanced per real second; 1.0 = the decoder keeps up. */
  realtimeOk: 0.95,
  realtimeWarn: 0.8,
  /** Share of frames the browser skipped while playing. */
  skippedOk: 0.02,
  skippedWarn: 0.1,
  /** From pressing play until the picture is really moving (a Play button should feel immediate). */
  startupOkMs: 400,
  startupWarnMs: 1000,
  /** Biggest file we will read whole into memory for the audio-decode test. */
  decodeMaxBytes: 120 * 1024 * 1024,
} as const;

/** Lower is better. NaN → "info" (nothing measured). */
export function gradeLow(value: number, ok: number, warn: number): CheckStatus {
  if (!Number.isFinite(value)) return "info";
  if (value <= ok) return "ok";
  return value <= warn ? "warn" : "fail";
}

/** Higher is better. */
export function gradeHigh(value: number, ok: number, warn: number): CheckStatus {
  if (!Number.isFinite(value)) return "info";
  if (value >= ok) return "ok";
  return value >= warn ? "warn" : "fail";
}

/**
 * Frames the browser skipped, from the video's own time at each drawn frame: a gap well over the usual gap means
 * frames were decoded but never shown. A clock that keeps real time can hide this — the picture just stutters.
 */
export function skippedFrames(times: readonly number[]): { skipped: number; expected: number } {
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > 0) gaps.push(gap);
  }
  const usual = median(gaps);
  if (!(usual > 0)) return { skipped: 0, expected: Math.max(0, times.length - 1) };
  let skipped = 0;
  for (const gap of gaps) {
    if (gap > usual * 1.5) skipped += Math.round(gap / usual) - 1;
  }
  return { skipped, expected: gaps.length + skipped };
}

const RANK: Record<CheckStatus, number> = { ok: 0, info: 0, skip: 0, warn: 1, fail: 2 };

/** The more serious of two grades. */
export const worse = (a: CheckStatus, b: CheckStatus): CheckStatus => (RANK[b] > RANK[a] ? b : a);

export interface PlaybackStats {
  /** Gaps between presented frames (one fewer than frames shown). */
  frames: number;
  elapsedMs: number;
  mediaAdvanceS: number;
  /** Seconds of video per real second over the whole run; NaN when it can't be known. */
  realtime: number;
  /** The same over the second half of the run, ignoring any slow start. */
  steadyRealtime: number;
  fps: number;
  /** Milliseconds from asking to play until the first frame appeared; NaN when none did. */
  firstFrameMs: number;
  /** Milliseconds until the video had really moved 0.1 s; NaN when it never did. */
  movingMs: number;
  skipped: number;
  expected: number;
}

/** Turn a run's frame timeline into numbers. A slow start and a slow crawl need different fixes, so both show. */
export function analyzePlayback(samples: readonly PlaySample[]): PlaybackStats {
  const n = samples.length;
  const empty: PlaybackStats = {
    frames: 0,
    elapsedMs: 0,
    mediaAdvanceS: 0,
    realtime: Number.NaN,
    steadyRealtime: Number.NaN,
    fps: 0,
    firstFrameMs: n > 0 ? samples[0].atMs : Number.NaN,
    movingMs: Number.NaN,
    skipped: 0,
    expected: 0,
  };
  if (n < 2) return empty;
  const first = samples[0];
  const last = samples[n - 1];
  const mid = samples[n >> 1];
  const elapsedMs = last.atMs - first.atMs;
  const mediaAdvanceS = last.mediaS - first.mediaS;
  const steadyMs = last.atMs - mid.atMs;
  const moved = samples.find((x) => x.mediaS - first.mediaS >= 0.1);
  const { skipped, expected } = skippedFrames(samples.map((x) => x.mediaS));
  return {
    frames: n - 1,
    elapsedMs,
    mediaAdvanceS,
    realtime: elapsedMs > 0 ? mediaAdvanceS / (elapsedMs / 1000) : Number.NaN,
    steadyRealtime: steadyMs > 0 ? (last.mediaS - mid.mediaS) / (steadyMs / 1000) : Number.NaN,
    fps: elapsedMs > 0 ? (n - 1) / (elapsedMs / 1000) : 0,
    firstFrameMs: first.atMs,
    movingMs: moved ? moved.atMs : Number.NaN,
    skipped,
    expected,
  };
}

/** The imported video to measure with: the largest stored one (the hardest case). Pure. */
export function findSampleAsset(assets: readonly Asset[]): Asset | null {
  let best: Asset | null = null;
  for (const a of assets) {
    if (a.kind !== "video" || a.source.type !== "stored") continue;
    if (!best || (a.bytes ?? 0) > (best.bytes ?? 0)) best = a;
  }
  return best;
}

/* ───────────── what we ask the browser ───────────── */

type TypeList = ReadonlyArray<readonly [string, string]>;

const VIDEO_TYPES: TypeList = [
  ["H.264", 'video/mp4; codecs="avc1.640028"'],
  ["HEVC", 'video/mp4; codecs="hvc1.1.6.L120.B0"'],
  ["MOV", "video/quicktime"],
  ["VP9", 'video/webm; codecs="vp9"'],
  ["AV1", 'video/mp4; codecs="av01.0.05M.08"'],
];

const AUDIO_TYPES: TypeList = [
  ["AAC", 'audio/mp4; codecs="mp4a.40.2"'],
  ["MP3", "audio/mpeg"],
  ["WAV", "audio/wav"],
  ["Opus", 'audio/webm; codecs="opus"'],
  ["FLAC", "audio/flac"],
];

export const VIDEO_DECODER_TESTS: readonly VideoDecoderTest[] = [
  { label: "H.264 1080p", codec: "avc1.640028", width: 1920, height: 1080 },
  { label: "HEVC 1080p", codec: "hvc1.1.6.L120.B0", width: 1920, height: 1080 },
  { label: "HEVC 4K", codec: "hvc1.1.6.L150.B0", width: 3840, height: 2160 },
  { label: "VP9", codec: "vp09.00.10.08", width: 1280, height: 720 },
  { label: "AV1", codec: "av01.0.05M.08", width: 1280, height: 720 },
];

export const AUDIO_DECODER_TESTS: readonly AudioDecoderTest[] = [
  { label: "AAC", codec: "mp4a.40.2", sampleRate: 48000, channels: 2 },
  { label: "Opus", codec: "opus", sampleRate: 48000, channels: 2 },
];

/** ✔ plays · ~ maybe · ✘ no (canPlayType answers "probably" / "maybe" / ""). */
function playMark(answer: string): string {
  if (answer === "probably") return "✔";
  return answer === "maybe" ? "~" : "✘";
}

function typeMarks(env: PlaybackEnv, list: TypeList): string {
  const parts = list.map(([name, mime]) => `${name} ${playMark(env.canPlayType(mime))}`);
  return parts.join(" · ");
}

const yesNo = (b: boolean): string => (b ? "✔" : "✘");

/* ───────────── the runner ───────────── */

export interface RunOptions {
  /** Limit for each browser call. Default 8 s. */
  timeoutMs?: number;
  /** How long each muted playback run lasts. Default 3000 ms. */
  playMs?: number;
}

interface Run {
  env: PlaybackEnv;
  timeoutMs: number;
  playMs: number;
  add: (row: CheckRow) => void;
}

/** What the tap's synchronous block produced. */
interface Gesture {
  ios: IosInfo;
  hasSession: boolean;
  sessionType: string;
  sessionError: string;
  ctx: AudioContextLike | null;
  ctxError: string;
  resuming: Promise<void> | null;
}

/**
 * Everything that must happen inside the tap itself. iOS Safari only lets an AudioContext (and
 * `navigator.audioSession`) start from the call stack of the gesture; one `await` earlier and the context is born
 * suspended, which would show up here as a false "audio failed". Synchronous on purpose.
 */
function startAudioInGesture(env: PlaybackEnv): Gesture {
  const g: Gesture = {
    ios: parseIos(env.userAgent),
    hasSession: false,
    sessionType: "",
    sessionError: "",
    ctx: null,
    ctxError: "",
    resuming: null,
  };
  const session = env.audioSession();
  if (session) {
    g.hasSession = true;
    try {
      // Without "playback", iOS treats Web Audio as a ringer sound and the side switch mutes it.
      session.type = "playback";
      g.sessionType = String(session.type);
    } catch (e) {
      g.sessionError = errText(e);
    }
  }
  try {
    g.ctx = env.createAudioContext();
    if (g.ctx) g.resuming = Promise.resolve(g.ctx.resume());
  } catch (e) {
    g.ctxError = errText(e);
  }
  return g;
}

/**
 * Run every check and `emit` each row as soon as it exists, so the screen fills in live. Returns all rows.
 *
 * Call this DIRECTLY from the tap handler: its first statement starts the audio context synchronously
 * (see `startAudioInGesture`), and the unit tests assert that ordering.
 */
export async function runPlaybackCheck(
  env: PlaybackEnv,
  emit: (row: CheckRow) => void,
  opts: RunOptions = {},
): Promise<CheckRow[]> {
  const g = startAudioInGesture(env);
  const rows: CheckRow[] = [];
  const run: Run = {
    env,
    timeoutMs: opts.timeoutMs ?? 8000,
    playMs: opts.playMs ?? 3000,
    add: (row) => {
      rows.push(row);
      emit(row);
    },
  };
  try {
    await safely(run, "device", () => deviceRows(run, g));
    await safely(run, "audio", () => audioRows(run, g));
    await safely(run, "codecs", () => codecRows(run));
    await safely(run, "speed", () => sampleRows(run));
  } finally {
    // Safari allows only a handful of AudioContexts per page; give ours back.
    const close = g.ctx?.close;
    if (close) void Promise.resolve(close.call(g.ctx)).catch(() => undefined);
  }
  return rows;
}

/**
 * One section throwing (an odd browser, a missing API we assumed) must not lose the whole report: it becomes a
 * "check stopped" row and the next section still runs.
 */
type Work = () => void | Promise<void>;

async function safely(run: Run, group: CheckGroup, work: Work): Promise<void> {
  try {
    await work();
  } catch (e) {
    run.add({
      id: `${group}.crash`,
      group,
      label: "Check stopped",
      status: "fail",
      detail: `This part of the check crashed: ${errText(e)}`,
    });
  }
}

function describeOs(ios: IosInfo, platform: string): string {
  if (!ios.isIos) return platform || "unknown platform";
  return ios.major ? `iOS ${ios.major}.${ios.minor}` : "iOS";
}

function deviceRows(run: Run, g: Gesture): void {
  const { env, add } = run;
  const mode = env.standalone ? "Home Screen app" : "browser tab";
  const screen = `${env.screenWidth}×${env.screenHeight} @${env.devicePixelRatio}×`;
  const cores = env.cores ? ` · ${env.cores} cores` : "";
  const os = describeOs(g.ios, env.platform);
  add({
    id: "device.platform",
    group: "device",
    label: "Device",
    status: "info",
    detail: `${os} · ${browserName(env.userAgent)} · ${mode} · ${screen}${cores}`,
  });
  const gl = env.webgl();
  let detail = `Not available — effects would have to use the 2D canvas only.`;
  if (gl) detail = `WebGL ${gl.version} · largest texture ${gl.maxTextureSize} px`;
  add({
    id: "device.webgl",
    group: "device",
    label: "WebGL",
    status: gl ? "ok" : "warn",
    detail,
  });
}

async function audioRows(run: Run, g: Gesture): Promise<void> {
  const { env, add, timeoutMs } = run;

  /* unlock */
  const unlock: CheckRow = {
    id: "audio.context",
    group: "audio",
    label: "Web Audio unlock",
    status: "fail",
    detail: g.ctxError ? `Could not create an AudioContext: ${g.ctxError}` : `No AudioContext.`,
  };
  if (g.ctx) {
    const done = await guard(() => g.resuming, timeoutMs, "AudioContext.resume()");
    const state = g.ctx.state;
    if (!done.ok) {
      unlock.detail = `${done.error} (state: ${state})`;
    } else if (state === "running") {
      unlock.status = "ok";
      unlock.detail = `Running right after the tap · ${g.ctx.sampleRate} Hz`;
    } else {
      unlock.status = "warn";
      unlock.detail = `State is “${state}” after the tap — the first Play press would be silent.`;
    }
  }
  add(unlock);

  /* the silent-switch fix */
  const session: CheckRow = {
    id: "audio.session",
    group: "audio",
    label: "Silent-switch fix",
    status: "warn",
    detail: "",
  };
  if (g.hasSession && g.sessionError) {
    session.detail = `audioSession exists but refused: ${g.sessionError}`;
  } else if (g.hasSession) {
    session.status = g.sessionType === "playback" ? "ok" : "warn";
    session.detail = `navigator.audioSession is present; type reads back “${g.sessionType}”.`;
  } else if (iosAtLeast(g.ios, 16, 4)) {
    session.detail = `Missing even though this iOS should have it (16.4+).`;
  } else if (g.ios.isIos) {
    session.detail = "Not there before iOS 16.4 — the silent switch would mute Web Audio.";
  } else {
    session.status = "info";
    session.detail = "Not available here (only needed on iOS).";
  }
  add(session);

  /* element volume */
  const volume = env.elementVolumeWritable();
  const vol: CheckRow = {
    id: "audio.volume",
    group: "audio",
    label: "Element volume",
    status: "skip",
    detail: "Could not be tried.",
  };
  if (volume === true) {
    vol.status = "ok";
    vol.detail = "A set volume sticks (reads back 0.5); whether it changes loudness isn't tested.";
  } else if (volume === false) {
    vol.status = "warn";
    vol.detail = "Ignored here (reads back 1) — per-clip volume must use Web Audio, not <video>.";
  }
  add(vol);
}

async function codecRows(run: Run): Promise<void> {
  const { env, add, timeoutMs } = run;
  add({
    id: "codec.video",
    group: "codecs",
    label: "Plays video",
    status: "info",
    detail: typeMarks(env, VIDEO_TYPES),
  });
  add({
    id: "codec.audio",
    group: "codecs",
    label: "Plays audio",
    status: "info",
    detail: typeMarks(env, AUDIO_TYPES),
  });
  const hevc = env.canPlayType('video/mp4; codecs="hvc1.1.6.L120.B0"');
  add({
    id: "codec.hevc",
    group: "codecs",
    label: "iPhone video (HEVC)",
    status: hevc ? "ok" : "fail",
    detail: hevc
      ? `The browser can play HEVC, so iPhone clips work through <video>.`
      : `The browser says it cannot play HEVC — iPhone recordings may not play.`,
  });

  const wc = env.webCodecs();
  const present = [
    `VideoDecoder ${yesNo(wc.videoDecoder)}`,
    `AudioDecoder ${yesNo(wc.audioDecoder)}`,
    `VideoEncoder ${yesNo(wc.videoEncoder)}`,
    `AudioEncoder ${yesNo(wc.audioEncoder)}`,
  ];
  add({
    id: "codec.webcodecs",
    group: "codecs",
    label: "WebCodecs",
    status: wc.videoDecoder ? "info" : "warn",
    detail: present.join(" · "),
  });
  if (wc.videoDecoder) {
    const parts = await Promise.all(
      VIDEO_DECODER_TESTS.map(async (t) => {
        const r = await guard(() => env.videoDecoderSupported(t), timeoutMs, t.label);
        return `${t.label} ${r.ok ? yesNo(r.value) : `✘ (${r.error})`}`;
      }),
    );
    add({
      id: "codec.webcodecs.video",
      group: "codecs",
      label: "WebCodecs video decode",
      status: "info",
      detail: parts.join(" · "),
    });
  }
  if (wc.audioDecoder) {
    const parts = await Promise.all(
      AUDIO_DECODER_TESTS.map(async (t) => {
        const r = await guard(() => env.audioDecoderSupported(t), timeoutMs, t.label);
        return `${t.label} ${r.ok ? yesNo(r.value) : `✘ (${r.error})`}`;
      }),
    );
    add({
      id: "codec.webcodecs.audio",
      group: "codecs",
      label: "WebCodecs audio decode",
      status: "info",
      detail: parts.join(" · "),
    });
  }

  const rvfc = env.hasRequestVideoFrameCallback();
  add({
    id: "video.rvfc",
    group: "video",
    label: "Frame callback",
    status: rvfc ? "ok" : "warn",
    detail: rvfc
      ? `requestVideoFrameCallback exists — we can draw exactly when a new frame is ready.`
      : `requestVideoFrameCallback is missing — frame timing must fall back to animation frames.`,
  });
}

function speedRow(id: string, label: string, status: CheckStatus, detail: string): CheckRow {
  return { id, group: "speed", label, status, detail };
}

async function sampleRows(run: Run): Promise<void> {
  const { env, add, timeoutMs } = run;
  const loaded = await guard(() => env.loadSample(), timeoutMs, "Reading your imported video");
  if (!loaded.ok) {
    add(speedRow("sample.pick", "Your video", "fail", loaded.error));
    return;
  }
  const sample = loaded.value;
  if (!sample) {
    const hint = "No imported video yet. Import one (Media → Import) and run this again.";
    add(speedRow("sample.pick", "Your video", "skip", hint));
    return;
  }
  try {
    const { name, bytes, mime } = sample.info;
    const what = `${name} · ${fmtBytes(bytes)} · ${mime || "unknown type"}`;
    add(speedRow("sample.pick", "Your video", "info", what));
    await decodeRow(run, sample);
    const opened = await guard(() => sample.open(), timeoutMs * 2, "Opening the video");
    if (!opened.ok) {
      add(speedRow("sample.open", "Open the video", "fail", opened.error));
      const blocked = "Needs the video to open first.";
      for (const spec of PLAY_RUNS) add(speedRow(spec.id, spec.label, "skip", blocked));
      add(speedRow("speed.copy", "Copy to canvas", "skip", blocked));
      add(speedRow("speed.seek", "Scrubbing", "skip", blocked));
      add(speedRow("speed.texture", "Upload to WebGL", "skip", blocked));
      return;
    }
    const o = opened.value;
    const size = `${o.width}×${o.height} · ${o.durationS.toFixed(1)} s`;
    add(speedRow("sample.open", "Open the video", "ok", size));
    await playRows(run, sample);
    await copyRows(run, sample);
    await seekRow(run, sample);
    await textureRow(run, sample);
  } finally {
    sample.close();
  }
}

async function decodeRow(run: Run, sample: SampleTools): Promise<void> {
  const label = "Decode its sound";
  const dec = await guard(() => sample.decodeAudio(), run.timeoutMs * 2.5, "Decoding the sound");
  if (!dec.ok) {
    run.add(speedRow("sample.audio", label, "fail", dec.error));
    return;
  }
  const v = dec.value;
  if (v.kind === "ok") {
    const what = `${v.seconds.toFixed(1)} s · ${v.channels} ch`;
    run.add(speedRow("sample.audio", label, "ok", `${what} — decoded in ${fmtMs(v.ms)}`));
  } else if (v.kind === "too-big") {
    const limit = fmtBytes(v.limitBytes);
    const why = `Skipped: the file is over ${limit} and decoding reads it all into memory.`;
    run.add(speedRow("sample.audio", label, "skip", why));
  } else {
    run.add(speedRow("sample.audio", label, "warn", `No sound decoded: ${v.reason}`));
  }
}

interface PlayRunSpec {
  id: string;
  label: string;
  visible: boolean;
  draw: boolean;
}

/**
 * Hidden → visible → hidden again → visible with drawing. The first three tell a throttled hidden video (slow,
 * fast, slow) from a first-play warm-up (slow, fast, fast) from a phone that simply cannot keep up (slow, slow,
 * slow). The last is the realistic design: the picture element on screen, painted to a canvas.
 */
const PLAY_RUNS: readonly PlayRunSpec[] = [
  { id: "speed.play.hidden", label: "Playing (hidden video)", visible: false, draw: false },
  { id: "speed.play.visible", label: "Playing (visible video)", visible: true, draw: false },
  { id: "speed.play.again", label: "Playing (hidden again)", visible: false, draw: false },
  { id: "speed.play.draw", label: "Playing + copy to canvas", visible: true, draw: true },
];

function playStatus(s: PlaybackStats): CheckStatus {
  if (s.frames === 0) return "fail";
  const share = s.expected > 0 ? s.skipped / s.expected : 0;
  const speed = gradeHigh(s.steadyRealtime, LIMITS.realtimeOk, LIMITS.realtimeWarn);
  const skipped = gradeLow(share, LIMITS.skippedOk, LIMITS.skippedWarn);
  const start = gradeLow(s.movingMs, LIMITS.startupOkMs, LIMITS.startupWarnMs);
  return worse(worse(speed, skipped), start);
}

function playDetail(r: PlayFramesResult, s: PlaybackStats): string {
  const times = (x: number) => (Number.isFinite(x) ? `${x.toFixed(2)}×` : "–");
  const after = (x: number) => (Number.isFinite(x) ? `${Math.round(x)} ms` : "never");
  const via = r.via === "rvfc" ? "frame callback" : "animation frames";
  const share = s.expected > 0 ? Math.round((s.skipped / s.expected) * 100) : 0;
  const secs = (s.elapsedMs / 1000).toFixed(1);
  const parts = [
    `${s.frames} frames in ${secs} s (≈ ${s.fps.toFixed(0)} fps via ${via})`,
    `clock ${times(s.realtime)} overall, ${times(s.steadyRealtime)} in the second half`,
    `first frame after ${after(s.firstFrameMs)}, moving after ${after(s.movingMs)}`,
    `${s.skipped} of ${s.expected} frames skipped (${share}%)`,
    `waiting ${r.waiting}× · stalled ${r.stalled}×`,
  ];
  if (r.quality) parts.push(`decoder dropped ${r.quality.dropped} of ${r.quality.total}`);
  return parts.join(" · ");
}

function copyRow(times: readonly number[]): CheckRow {
  const label = "Copy to canvas";
  if (times.length === 0) return speedRow("speed.copy", label, "info", "No copies were measured.");
  const med = median(times);
  const stats = `median ${fmtMs(med)}, slowest ${fmtMs(Math.max(...times))}`;
  const detail = `One frame to the canvas, forced to finish: ${stats} (${times.length} samples)`;
  return speedRow("speed.copy", label, gradeLow(med, LIMITS.drawOkMs, LIMITS.drawWarnMs), detail);
}

async function copyRows(run: Run, sample: SampleTools): Promise<void> {
  const limit = run.timeoutMs * 2;
  const copied = await guard(() => sample.copyMs(10), limit, "Copying to the canvas");
  if (!copied.ok) run.add(speedRow("speed.copy", "Copy to canvas", "fail", copied.error));
  else run.add(copyRow(copied.value));
}

async function playRows(run: Run, sample: SampleTools): Promise<void> {
  const limit = run.playMs + run.timeoutMs;
  for (const spec of PLAY_RUNS) {
    const opts = { ms: run.playMs, visible: spec.visible, draw: spec.draw };
    const played = await guard(() => sample.playFrames(opts), limit, spec.label);
    if (!played.ok) {
      run.add(speedRow(spec.id, spec.label, "fail", played.error));
      continue;
    }
    const stats = analyzePlayback(played.value.samples);
    run.add(speedRow(spec.id, spec.label, playStatus(stats), playDetail(played.value, stats)));
  }
}

async function seekRow(run: Run, sample: SampleTools): Promise<void> {
  const seeks = await guard(() => sample.seekMs(6), run.timeoutMs * 3, "Seeking");
  if (!seeks.ok) {
    run.add(speedRow("speed.seek", "Scrubbing", "fail", seeks.error));
    return;
  }
  const times = seeks.value;
  const med = median(times);
  const worst = fmtMs(Math.max(...times));
  const stats = `median ${fmtMs(med)}, slowest ${worst}`;
  const detail = `Jump to a new moment: ${stats} (${times.length} jumps)`;
  const status = gradeLow(med, LIMITS.seekOkMs, LIMITS.seekWarnMs);
  run.add(speedRow("speed.seek", "Scrubbing", status, detail));
}

async function textureRow(run: Run, sample: SampleTools): Promise<void> {
  const label = "Upload to WebGL";
  const tex = await guard(() => sample.textureMs(20), run.timeoutMs * 2, "Uploading");
  if (!tex.ok) {
    run.add(speedRow("speed.texture", label, "fail", tex.error));
    return;
  }
  const times = tex.value;
  if (times === null) {
    run.add(speedRow("speed.texture", label, "skip", "WebGL is not available."));
    return;
  }
  const med = median(times);
  const slow = fmtMs(percentile(times, 95));
  const stats = `median ${fmtMs(med)}, slowest 1 in 20 ${slow}`;
  const detail = `texImage2D(video): ${stats} (${times.length} uploads)`;
  const status = gradeLow(med, LIMITS.textureOkMs, LIMITS.textureWarnMs);
  run.add(speedRow("speed.texture", label, status, detail));
}

/** One test tone. Call it straight from the tap handler: `env.playTone` is started synchronously. */
export async function runToneTest(
  env: PlaybackEnv,
  kind: ToneKind,
  timeoutMs = 4000,
): Promise<CheckRow> {
  const id = kind === "webaudio" ? "tone.webaudio" : "tone.element";
  const label = kind === "webaudio" ? "Test tone (Web Audio)" : "Test tone (<audio> element)";
  const r = await guard(() => env.playTone(kind), timeoutMs, label);
  if (!r.ok) return { id, group: "audio", label, status: "fail", detail: r.error };
  const detail = "Started. Did you hear it? Try again with the silent switch on.";
  return { id, group: "audio", label, status: "info", detail };
}

/* ───────────── the copyable report ───────────── */

const SYMBOL: Record<CheckStatus, string> = { ok: "✔", warn: "⚠", fail: "✘", info: "•", skip: "–" };

export const statusSymbol = (s: CheckStatus): string => SYMBOL[s];

export interface ReportMeta {
  version: string;
  when: string;
  userAgent: string;
}

export function formatReport(rows: readonly CheckRow[], meta: ReportMeta): string {
  const head = `FreeCut playback check · v${meta.version} · ${meta.when}`;
  const body = rows.map((r) => `${SYMBOL[r.status]} ${r.label}: ${r.detail}`);
  return [head, meta.userAgent, "", ...body].join("\n");
}
