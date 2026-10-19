import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw } from "lucide-react";
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { clamp } from "../model/time";
import { CaretUp, IconKeyframe } from "./icons";

/* ───────────── small shared controls ───────────── */

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name — required so every slider is announced meaningfully. */
  label: string;
  min?: number;
  max?: number;
  className?: string;
}

/** Pointer- AND keyboard-operable slider (←/→/↑/↓ ±1, PageUp/PageDown ±10, Home/End = min/max). */
export function Slider({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  className = "",
}: SliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const apply = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = clamp((e.clientX - r.left) / r.width, 0, 1);
    onChange(Math.round(min + t * (max - min)));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = value + step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = value - step;
        break;
      case "PageUp":
        next = value + 10;
        break;
      case "PageDown":
        next = value - 10;
        break;
      case "Home":
        next = min;
        break;
      case "End":
        next = max;
        break;
    }
    if (next === null) return;
    e.preventDefault();
    onChange(clamp(next, min, max));
  };

  return (
    <div
      ref={ref}
      className={`ve-slider ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={`${value}%`}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) apply(e);
      }}
    >
      <div className="ve-slider-track">
        <div className="ve-slider-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ve-slider-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}

interface NumberBoxProps {
  text: string;
  onUp?: () => void;
  onDown?: () => void;
  label?: string;
}

/** Read-out with ▲▼ steppers. (Typed numeric entry + drag-scrub arrive in Phase 3.) */
export function NumberBox({ text, onUp, onDown, label = "value" }: NumberBoxProps) {
  return (
    <div className="ve-num">
      <span className="ve-num-val">{text}</span>
      <span className="ve-num-arrows">
        <button onClick={onUp} aria-label={`Increase ${label}`}>
          <ChevronUp size={8} strokeWidth={2.6} />
        </button>
        <button onClick={onDown} aria-label={`Decrease ${label}`}>
          <ChevronDown size={8} strokeWidth={2.6} />
        </button>
      </span>
    </div>
  );
}

export const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="ve-row">
    <span className="ve-row-label">{label}</span>
    {children}
  </div>
);

/** Placeholder until keyframes land in Phase 3. */
export const KeyframeButton = () => (
  <button className="ve-kf" aria-label="Add keyframe">
    <IconKeyframe />
  </button>
);

interface SectionHeadProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
  onReset?: () => void;
  caret?: boolean;
  open?: boolean;
  onCaret?: () => void;
}

export function SectionHead({
  label,
  checked,
  onToggle,
  onReset,
  caret,
  open,
  onCaret,
}: SectionHeadProps) {
  return (
    <div className="ve-sec-head">
      <button
        className={`ve-check${checked ? " on" : ""}`}
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={`${label} enabled`}
      >
        {checked && <Check size={8} strokeWidth={3.6} />}
      </button>
      <span className="ve-sec-title">{label}</span>
      {caret && (
        <button
          className={`ve-sec-caret${open ? "" : " shut"}`}
          onClick={onCaret}
          aria-label={`Collapse ${label}`}
        >
          <CaretUp />
        </button>
      )}
      <span className="ve-sec-tools">
        <button className="ve-ghost" aria-label={`Reset ${label}`} onClick={onReset}>
          <RotateCcw size={10} strokeWidth={1.8} />
        </button>
        <span className="ve-kf-nav">
          <ChevronLeft size={9} strokeWidth={2} className="dim" />
          <IconKeyframe />
          <ChevronRight size={9} strokeWidth={2} className="dim" />
        </span>
      </span>
    </div>
  );
}
