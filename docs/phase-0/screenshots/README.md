# Phase 0 screenshots

`before/` = v1.0.0, `after/` = v1.1.0. Same headless Chromium (153), fixed `Math.random`, `requestAnimationFrame` disabled (so the playhead stays at 00:00:02:45), `prefers-reduced-motion: reduce`. Desktop 1280×800; phone 390×844 @2×.

Pixel difference (pixelmatch, threshold 0.1): phone-home 0.00 % · phone-editor 0.15 % · phone-editor-edit-sheet 0.04 % · desktop-home 0.09 % · desktop-editor 3.83 % · phone-editor-media-sheet 20.15 %.
Every difference is itemised in `Handover.md §11` (e.g. the Media sheet shifts by one tile because the timeline's own clip is now listed in the library).
