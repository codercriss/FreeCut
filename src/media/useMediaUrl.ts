import { useEffect, useState } from "react";
import type { Asset } from "../model/types";
import { getMedia, posterIdOf } from "./mediaStore";

interface Entry {
  url: string | null;
  refs: number;
  ready: Promise<void>;
}
const cache = new Map<string, Entry>();

/** How long an unused object URL is kept (avoids re-reading the blob when a list re-renders or scrolls). */
const KEEP_MS = 5000;

/** An object URL for a stored blob (or null while loading / when missing). Shared + ref-counted; revoked when unused. */
export function useMediaUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (id ? (cache.get(id)?.url ?? null) : null));
  useEffect(() => {
    if (!id) {
      setUrl(null);
      return undefined;
    }
    let live = true;
    let entry = cache.get(id);
    if (!entry) {
      const e: Entry = { url: null, refs: 0, ready: Promise.resolve() };
      e.ready = getMedia(id)
        .then((blob) => {
          if (blob) e.url = URL.createObjectURL(blob);
          else if (cache.get(id) === e) cache.delete(id); // missing now → try again next time
        })
        .catch(() => {
          if (cache.get(id) === e) cache.delete(id);
        });
      cache.set(id, e);
      entry = e;
    }
    const e = entry;
    e.refs += 1;
    setUrl(e.url);
    void e.ready.then(() => live && setUrl(e.url));
    return () => {
      live = false;
      e.refs -= 1;
      if (e.refs <= 0) {
        setTimeout(() => {
          if (e.refs <= 0 && cache.get(id) === e) {
            if (e.url) URL.revokeObjectURL(e.url);
            cache.delete(id);
          }
        }, KEEP_MS);
      }
    };
  }, [id]);
  return url;
}

/** The poster image URL of an imported video/photo, or null. */
export function usePosterUrl(asset: Asset | undefined): string | null {
  return useMediaUrl(
    asset && asset.source.type === "stored" ? posterIdOf(asset.source.mediaId) : null,
  );
}
