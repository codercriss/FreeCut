import type {
  Clip,
  ClipEffect,
  ClipFilter,
  ClipSection,
  ClipSections,
  ClipTransform,
} from "./types";

export const DEFAULT_SECTIONS: ClipSections = {
  filters: true,
  effects: true,
  transform: true,
  blend: true,
};

export const DEFAULT_TRANSFORM: ClipTransform = { zoom: 50, x: 0, y: 0, rotation: 0 };
export const DEFAULT_FILTER: ClipFilter = { name: "90s", strength: 50 };
export const DEFAULT_EFFECTS: ClipEffect[] = [
  { id: "fx-motion-blur", type: "motion-blur", name: "Motion Blur" },
];

/** What each Properties section resets to ("↺" button). */
export function sectionDefaults(section: ClipSection): Partial<Clip> {
  switch (section) {
    case "filters":
      return { filter: { ...DEFAULT_FILTER } };
    case "effects":
      return { effects: DEFAULT_EFFECTS.map((e) => ({ ...e })) };
    case "transform":
      return { transform: { ...DEFAULT_TRANSFORM } };
    case "blend":
      return { blend: "normal", opacity: 100 };
  }
}
