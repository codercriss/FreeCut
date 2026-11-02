import { getMedia } from "../media/mediaStore";
import { AudioEngine, type ContextLike } from "./audioEngine";

type ContextCtor = new () => ContextLike;

function contextCtor(): ContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** The real sound engine, or null where there is no Web Audio at all (playback then runs on the time clock alone). */
export function createAudioEngine(): AudioEngine | null {
  const Ctor = contextCtor();
  if (!Ctor) return null;
  return new AudioEngine({
    createContext: () => new Ctor(),
    readBlob: (mediaId) => getMedia(mediaId),
    prepareSession: () => {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      try {
        if (nav.audioSession) nav.audioSession.type = "playback";
      } catch {
        // Not allowed here: sound still plays, only the silent switch may mute it.
      }
    },
  });
}
