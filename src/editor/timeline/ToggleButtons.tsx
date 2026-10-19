import { Link2, Magnet } from "lucide-react";
import { useStore } from "../../store/createStore";
import { prefsStore, togglePref } from "../../store/prefsStore";
import { IconAxis, IconTrackMagnet } from "../../ui/icons";

/** The four timeline toggles (magnet / snap / link / axis). Remembered per device; behaviour arrives in Phase 2. */
export function ToggleButtons({ mobile = false }: { mobile?: boolean }) {
  const prefs = useStore(prefsStore, (p) => p);
  const sz = mobile ? { a: 17, b: 16, c: 17, d: 17 } : { a: 14, b: 13, c: 14, d: 14 };
  const attr = (title: string) => (mobile ? { "aria-label": title } : { title });
  return (
    <>
      <button
        className={`ve-tl-btn${prefs.magnet ? " active" : ""}`}
        onClick={() => togglePref("magnet")}
        aria-pressed={prefs.magnet}
        {...attr("Main track magnet")}
      >
        <IconTrackMagnet size={sz.a} strokeWidth={1.7} />
      </button>
      <button
        className={`ve-tl-btn${prefs.snap ? " active" : ""}`}
        onClick={() => togglePref("snap")}
        aria-pressed={prefs.snap}
        {...attr("Auto snapping")}
      >
        <Magnet size={sz.b} strokeWidth={1.9} />
      </button>
      <button
        className={`ve-tl-btn${prefs.link ? " active" : ""}`}
        onClick={() => togglePref("link")}
        aria-pressed={prefs.link}
        {...attr("Linkage")}
      >
        <Link2 size={sz.c} strokeWidth={1.9} />
      </button>
      <button
        className={`ve-tl-btn${prefs.axis ? " active" : ""}`}
        onClick={() => togglePref("axis")}
        aria-pressed={prefs.axis}
        {...attr("Preview axis")}
      >
        <IconAxis size={sz.d} strokeWidth={1.7} />
      </button>
    </>
  );
}
