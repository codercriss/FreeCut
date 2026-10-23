import { useEffect, useState } from "react";
import type { Asset } from "../model/types";
import type { StripMeta } from "./filmstrip";
import { requestFilmstrip } from "./filmstripQueue";
import { getMediaRecord, stripIdOf } from "./mediaStore";
import { useMediaUrl, useMediaVersion } from "./useMediaUrl";

export interface Filmstrip {
  url: string;
  meta: StripMeta;
}

/** The filmstrip sprite of an imported video (building it in the background if it doesn't exist yet), or null. */
export function useFilmstrip(asset: Asset | undefined, fps: number): Filmstrip | null {
  const mediaId =
    asset && asset.source.type === "stored" && asset.kind === "video" ? asset.source.mediaId : null;
  const stripId = mediaId ? stripIdOf(mediaId) : null;
  const url = useMediaUrl(stripId);
  const version = useMediaVersion(stripId);
  const [meta, setMeta] = useState<StripMeta | null>(null);
  const durationSec = asset ? asset.durationFrames / fps : 0;

  useEffect(() => {
    if (asset && mediaId) void requestFilmstrip(asset, durationSec);
    // `asset` identity changes only when it is edited (e.g. renamed) — the job itself is de-duplicated per video.
  }, [asset, mediaId, durationSec]);

  useEffect(() => {
    let live = true;
    if (!stripId) {
      setMeta(null);
      return undefined;
    }
    void getMediaRecord(stripId)
      .then((r) => live && setMeta((r?.meta as StripMeta | undefined) ?? null))
      .catch(() => live && setMeta(null));
    return () => {
      live = false;
    };
  }, [stripId, version, url]);

  return url && meta ? { url, meta } : null;
}
