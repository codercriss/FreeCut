import { useEffect, useState } from "react";

export type LayoutMode = "auto" | "mobile" | "desktop";

/** Phones, narrow windows, and phones in landscape (coarse pointer + short height). */
export const MOBILE_QUERY = "(max-width: 819px), (pointer: coarse) and (max-height: 520px)";

export function useIsMobile(layout: LayoutMode = "auto"): boolean {
  const [match, setMatch] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE_QUERY);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  if (layout === "mobile") return true;
  if (layout === "desktop") return false;
  return match;
}
