import { useId } from "react";
import { BRAND_ACCENT } from "../app/brand";

/** Original mark: an "F" sliced by a diagonal cut line. Unique mask id per instance (safe to render many times). */
export function BrandMark({ size = 15 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const mask = `ve-mark-cut-${id}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="#fff" />
          <path d="M2.5 22 22 2.5" stroke="#000" strokeWidth="2.6" />
        </mask>
      </defs>
      <g mask={`url(#${mask})`} fill="#fff">
        <rect x="4.5" y="3.5" width="4" height="17" rx="1.3" />
        <rect x="4.5" y="3.5" width="15" height="4" rx="1.3" />
        <rect x="4.5" y="10" width="10" height="3.6" rx="1.3" />
      </g>
      <path d="M3.5 21 21 3.5" stroke={BRAND_ACCENT} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
