import { useEffect, useRef, useState } from "react";
import type { Asset } from "../model/types";
import { createStore, useStore } from "../store/createStore";
import { getMedia, posterIdOf } from "./mediaStore";

interface Entry {
  url: string | null;
  refs: number;
  ready: Promise<void>;
}
const cache = new Map<string, Entry>();
/** Bumped by `refreshMedia` so every component showing that media re-reads it. */
const versions = createStore<Record<string, number>>({});

/** Changes whenever `refreshMedia(id)` is called — lets other hooks re-read data stored beside the blob. */
export const useMediaVersion = (id: string | null): number =>
  useStore(versions, (v) => (id ? (v[id] ?? 0) : 0));

/** Call after (re)writing a media record (e.g. a thumbnail created later) so the UI picks it up. */
export function refreshMedia(id: string): void {
  const old = cache.get(id);
  cache.delete(id);
  if (old?.url) setTimeout(() => URL.revokeObjectURL(old.url!), KEEP_MS); // still on screen until components re-read
  versions.setState((v) => ({ ...v, [id]: (v[id] ?? 0) + 1 }));
}

/** How long an unused object URL is kept (avoids re-reading the blob when a list re-renders or scrolls). */
const KEEP_MS = 5000;

/** An object URL for a stored blob (or null while loading / when missing). Shared + ref-counted; revoked when unused. */
export function useMediaUrl(id: string | null): string | null {
  const version = useStore(versions, (v) => (id ? (v[id] ?? 0) : 0));
  const [url, setUrl] = useState<string | null>(() => (id ? (cache.get(id)?.url ?? null) : null));
  const shownFor = useRef<string | null>(id);
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
    // Same media being refreshed: keep showing the old picture until the new one is ready (no flash to the placeholder).
    // Different media: clear straight away so a stale picture is never shown under the wrong name.
    if (e.url || shownFor.current !== id) setUrl(e.url);
    shownFor.current = id;
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
  }, [id, version]);
  return url;
}

/** The poster image URL of an imported video/photo, or null. */
export function usePosterUrl(asset: Asset | undefined): string | null {
  return useMediaUrl(
    asset && asset.source.type === "stored" ? posterIdOf(asset.source.mediaId) : null,
  );
}
