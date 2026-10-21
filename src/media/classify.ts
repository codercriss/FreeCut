export type MediaKind = "video" | "audio" | "image";

const BY_EXT: Record<string, MediaKind> = {
  // video (iPhone records .mov / .mp4; Android .mp4 / .3gp)
  mp4: "video",
  m4v: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  "3gp": "video",
  ogv: "video",
  mts: "video",
  // audio
  mp3: "audio",
  m4a: "audio",
  aac: "audio",
  wav: "audio",
  ogg: "audio",
  oga: "audio",
  opus: "audio",
  flac: "audio",
  aif: "audio",
  aiff: "audio",
  caf: "audio",
  // image (iPhone photos are often .heic)
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  heic: "image",
  heif: "image",
  avif: "image",
  bmp: "image",
};

/** What kind of media a file claims to be: MIME type first, file extension as the fallback (iOS often omits the type). */
export function classifyFile(file: { name: string; type: string }): MediaKind | null {
  const t = file.type.toLowerCase();
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("image/")) return "image";
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  return BY_EXT[ext] ?? null;
}

export const ACCEPT = "video/*,audio/*,image/*";
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const IMAGE_SECONDS = 5;

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

/** Short random id with a readable prefix. */
export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${rnd}`;
}
