import type { ReactNode, SVGProps } from "react";

/** Custom icons for places where lucide-react has no equivalent. All decorative (aria-hidden). */
export type SvgProps = { size?: number; strokeWidth?: number; children?: ReactNode } & Omit<
  SVGProps<SVGSVGElement>,
  "children"
>;

export const Svg = ({ size = 14, strokeWidth = 1.7, children, ...rest }: SvgProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const IconMedia = (p: SvgProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="3.2" />
    <path d="M10.2 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconAudio = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10.6 15.6V8.9l4.4-1.2v6.4" />
    <circle cx="9.3" cy="15.7" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="13.7" cy="14.2" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconSticker = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M20 12A8 8 0 1 0 12 20" />
    <path d="M20 12c-4.6.3-7.6 3.2-8 8" />
  </Svg>
);
export const IconTransition = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M3.5 6 11 12l-7.5 6z" />
    <path d="M20.5 6 13 12l7.5 6z" />
  </Svg>
);
export const IconFilters = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="9" cy="9" r="5.2" />
    <circle cx="15" cy="9" r="5.2" />
    <circle cx="12" cy="15" r="5.2" />
  </Svg>
);
export const IconLayout = (p: SvgProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.2" />
    <path d="M9.5 5v14M14.5 5v14" />
  </Svg>
);
export const IconFit = (p: SvgProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <circle cx="12" cy="12" r="3.3" />
  </Svg>
);
export const IconSplit = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M12 3.5v17" />
    <path d="M9 6H5.5v12H9" />
    <path d="M15 6h3.5v12H15" />
  </Svg>
);
export const IconTrackMagnet = (p: SvgProps) => (
  <Svg {...p}>
    <rect x="2.8" y="7" width="5" height="10" rx="1.3" />
    <rect x="16.2" y="7" width="5" height="10" rx="1.3" />
    <path d="M7.8 12h8.4" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconAxis = (p: SvgProps) => (
  <Svg {...p}>
    <path d="M4 5v14M20 5v14" />
    <path d="M8 12h8" />
    <path d="M10.4 9.6 8 12l2.4 2.4M13.6 9.6 16 12l-2.4 2.4" />
  </Svg>
);
export const IconCirclePlus = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);
export const IconCircleMinus = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </Svg>
);
export const IconCover = (p: SvgProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.6" />
    <path d="M10.2 9.6v4.8l4-2.4z" fill="currentColor" stroke="none" />
  </Svg>
);
export const IconAudioTrack = (p: SvgProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.6 10.4v3.2h2.2l2.8 2.2V8.2l-2.8 2.2z" fill="currentColor" stroke="none" />
    <path d="M16 9.8a3.4 3.4 0 0 1 0 4.4" />
  </Svg>
);
export const IconKeyframe = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M6 1.2 10.8 6 6 10.8 1.2 6z"
      stroke="currentColor"
      strokeWidth="1.15"
      strokeLinejoin="round"
    />
  </svg>
);
export const CaretDown = () => (
  <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
    <path d="M.8 2.1h6.4L4 6.2z" fill="currentColor" />
  </svg>
);
export const CaretRight = () => (
  <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
    <path d="M2.1.8v6.4L6.2 4z" fill="currentColor" />
  </svg>
);
export const CaretUp = () => (
  <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
    <path d="M.8 5.9h6.4L4 1.8z" fill="currentColor" />
  </svg>
);
