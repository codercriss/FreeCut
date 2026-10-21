# FreeCut — Roadmap

> **Goal:** turn FreeCut from a UI shell into a genuinely functional, deep, browser-based video editor that is a credible alternative to CapCut — free, offline-capable, installable (PWA), phone *and* desktop.
>
> **Status of this document:** v2 — updated 2026-10-16 at the end of **Phase 0** (code is now `v1.1.0`; see `Handover.md`). Phase scopes are proposals; the product owner approves each phase before work starts. Anything marked **[DECISION]** needs an answer before the phase that depends on it. Decisions already made are recorded in §2 and `Handover.md §7`.

---

## 0. Where we are today (honest status — end of Phase 1a, v1.2.0)

FreeCut still looks like the prototype, but **you can now bring your own media**. What is real vs mock:

| Area | Today |
|---|---|
| **Real** | **Import videos, photos and audio from your device** (file picker; drag-and-drop on desktop) with real thumbnails, durations and waveforms · library with filter, rename, delete (undoable) · **add to timeline** · imported media **survives closing the app** (stored in the browser) · clear messages for files that can't be read · iPhone Home-Screen tip · plus everything from Phase 0: project model v2 with migrations, **undo/redo**, **autosave**, corrupt-project quarantine, Home ⇄ Editor navigation incl. Back/Forward, consistent desktop/phone timelines, keyboard sliders, offline PWA, error boundary. **Verified by hand on iPhone Safari (Phase 0 review).** |
| **Shown but not played yet** | Imported clips appear on the timeline and the player shows their **poster image** — real video/audio **playback arrives in Phase 1b**. Properties values are stored on the clip but not applied to pixels (Phase 3). |
| **Still mock** | Audio playback and level meter, the demo footage (generated art), effects, text, stickers, transitions, export, split/delete/record, keyframes, masks |
| **Engineering** | TypeScript strict · **246 unit/component tests** · 21 Playwright specs × 4 projects (Chromium run incl. real video/audio/photo files; **WebKit configured, run by CI**) · ESLint · Prettier · CI · lockfile |

---|---|
| **Real** | Project model (versioned, integer-frame time) · command bus with **undo/redo** (buttons + Ctrl/Cmd+Z; slider drags = one step) · **autosave to IndexedDB** and reopen on reload · corrupt/newer-project quarantine · schema-migration runner · truthful save indicator · Home ⇄ Editor navigation incl. browser Back **and Forward** · desktop timeline whose ruler, clips and playhead agree · phone timeline scroll-sync · keyboard-operable sliders · lazy-loaded editor · offline PWA · error boundary |
| **Model-driven but not yet applied to pixels** | Properties values (filter strength, zoom, opacity, section on/off, effects list), track mute (there is no audio to silence yet) |
| **Still mock** | All media (one generated SVG scene; 5 demo "assets"), audio, import, waveform, level meter, effects, text, stickers, transitions, export, split/delete/record, keyframes, masks |
| **Engineering** | TypeScript strict · 156 unit/component tests · 13 Playwright tests (Chromium run; WebKit configured, not yet run) · ESLint · Prettier · CI workflow · lockfile |

**Phase 0 achieved its purpose:** the next phases can now build real features on a structure that can carry them. Details and caveats: `Handover.md`.

---|---|
| Layouts | Desktop studio layout + phone layout, both polished. Home screen (phone + desktop) with animated hero scenes. |
| Real behaviour | Home⇄Editor navigation/transitions; a real 60 fps playback clock (play/pause/seek/scrub); timeline zoom; phone timeline with fixed playhead + scroll-sync + pinch zoom; PWA offline shell. |
| Fake / presentational | **All media** is one hard-coded SVG "clip" of fixed length (27 s 58 f @ 60 fps). No import, decode, audio, export, project data, or persistence. Properties sliders/toggles hold local state but affect nothing. Undo/redo, split, delete, effects, text, stickers, transitions, filters, export: buttons exist, do nothing. |
| Engineering | 3 source files (~3,000 lines), plain JS, CSS-in-template-strings, no state store, no tests, no TypeScript. |

**Implication:** the biggest risk is not any single feature — it is that the current structure (hard-coded constants, component-local state, one 2,000-line file) cannot carry a real editor. **Phase 0 exists to fix that before we build on it.**

---

## 1. Working agreement (how we run phases)

1. **One phase at a time.** I build it, ship `freecut-phase-N.zip`, you review, we adjust, then we move on.
2. **Phases may be split.** A phase marked large (L/XL) will be delivered as sub-phases (e.g. `1a`, `1b`) if it cannot be built and reviewed well in one pass. Depth beats breadth: a half-working feature is worse than a deferred one.
3. **Every delivery contains:**
   - the full project zip (source only — no `node_modules`/`dist`);
   - updated `Handover.md` (phase log, known issues, decisions), `how_it_works.md` (architecture as built), `Roadmap.md` (status ticks), `Knowledge_Contribution.md` (new learnings);
   - a **verification record**: what was run (`npm run build`, tests) and the result;
   - a **review script**: numbered click-through steps so you can check the phase in ~10 minutes;
   - an explicit list of **what is not done / known gaps** — never silently skipped.
4. **Definition of done (every phase):** feature works on desktop *and* phone layout; survives reload (where it holds data); has unit tests for pure logic; is undoable (where it edits the project); respects `prefers-reduced-motion`; keyboard-reachable on desktop; no console errors; build passes; docs updated.
5. **No regressions in the shell.** Home, transitions, PWA offline, iOS home-screen behaviour must keep working (they are easy to break and hard to notice).

---

## 2. Target architecture (what we are building toward)

Not built yet — this is the destination so every phase pulls in the same direction. Details evolve in `how_it_works.md`.

```
┌────────────────────────────── UI (React) ──────────────────────────────┐
│ Home · Panels · Timeline view · Inspector · Dialogs · Shortcuts        │
└───────────────▲───────────────────────────────────────┬────────────────┘
                │ selectors (subscribe)                 │ commands
┌───────────────┴───────────────────────────────────────▼────────────────┐
│ Project store  — versioned JSON model: assets, tracks, clips, keyframes,│
│ effects, text, settings.  Command bus → undo/redo (patches).            │
└───────▲──────────────────────────┬─────────────────────────┬───────────┘
        │ persist / load           │ evaluate(t)             │ export(range)
┌───────┴────────┐        ┌────────▼─────────┐      ┌────────▼───────────┐
│ Storage        │        │ Render graph     │      │ Exporter           │
│ IndexedDB +    │        │ (per-frame scene │      │ same graph, offline│
│ OPFS (media)   │        │ description)     │      │ in a Worker        │
└────────────────┘        └───┬──────────┬───┘      └───┬────────────────┘
                              │          │              │
                    ┌─────────▼───┐ ┌────▼────────┐ ┌───▼───────────────┐
                    │ Video       │ │ Audio engine│ │ Encoders          │
                    │ compositor  │ │ (Web Audio, │ │ (WebCodecs →      │
                    │ WebGL2      │ │  master     │ │  MP4/WebM mux)    │
                    │ (WebGPU later)│ │  clock)    │ │                   │
                    └─────▲───────┘ └─────▲───────┘ └───────────────────┘
                          │               │
                    ┌─────┴───────────────┴─────┐
                    │ Media pipeline (Workers)  │
                    │ probe · demux · decode ·  │
                    │ thumbnails · waveforms ·  │
                    │ proxies                   │
                    └───────────────────────────┘
```

Principles:
- **The project is data.** UI, preview and export all read the same model; none of them own state.
- **One renderer, two outputs.** Preview and export use the same render graph so what you see is what you export.
- **Audio is the master clock** during playback (video chases audio), replacing today's `requestAnimationFrame` clock.
- **Local-first, no backend** until a later phase explicitly adds one.
- **Heavy work off the main thread** (Workers/OffscreenCanvas) so the UI never stutters.

### Technology choices — status after the product owner's answers

| # | Question | Recommendation | Why / trade-off |
|---|---|---|---|
| D1 | TypeScript? | ✔ **Decided: yes** — done in Phase 0 | An editor's data model is large; types prevent whole classes of bugs. Cost: one-time migration. |
| D2 | Platform | ✔ **PWA first** (as now). Native wrappers (Tauri/Capacitor) only later if needed | Matches the current "free, installable, offline" promise; fastest to iterate. |
| D3 | Backend / accounts | ✔ **None** until Phase 11; local-first | Keeps it free to host and private. Cloud sync becomes a later, optional layer. |
| D4 | AI features | ◐ **Provisional: on-device** models by default (WASM/WebGPU) — _to be confirmed before Phase 5; see §5 for the plain-language explanation_ | Fits "works offline / free". Cost: model download sizes, slower on weak phones. Server AI could be an optional add-on later. |
| D5 | Export | **WebCodecs** as primary encoder; optional ffmpeg.wasm fallback | WebCodecs is fast and hardware-accelerated where supported; ffmpeg.wasm is heavy (bundle size) and has licensing considerations. |
| D6 | Rendering | **WebGL2** now, **WebGPU** later | WebGL2 has the broadest support today (notably iOS Safari). |
| D7 | State management | ✔ **Built in Phase 0:** a small custom store + command pattern, snapshot history with structural sharing | Must support undo/redo and fine-grained subscriptions for 60 fps playhead. |
| D8 | Min browser matrix | ✔ **Decided: Safari and Chrome are the targets** (desktop + phone: Safari macOS/iOS 17+, Chrome desktop/Android). Edge/Firefox best-effort. **Verify capability at Phase 1 start** | WebCodecs/WebGPU/OPFS support differs by browser and changes quickly; iOS is the riskiest and the app already targets iPhone home-screen use. |
| D9 | Asset policy | Only CC0/MIT/own-created/permissively licensed assets, with a provenance manifest | See §6. |

> Browser API availability changes frequently. Before each phase that depends on one (WebCodecs, OPFS, File System Access, WebGPU, MediaRecorder codecs), I will re-check current support and write the result into `Handover.md` rather than assume.

---

## 3. Phase overview

Sizes: **S** ≈ one focused pass · **M** · **L** (likely split) · **XL** (will be split).

| Phase | Name | Size | Depends on | Headline outcome |
|---|---|---|---|---|
| **0** | Foundations | M | — | ✔ **Delivered (v1.1.0)** — same look, real architecture: model, store, undo/redo, autosave, tests, TypeScript |
| **1** | Real media pipeline | XL | 0 | **1a ✔ delivered (v1.2.0)** import + library + thumbnails + persistence · **1b** real preview & audio playback · **1c** multiple projects, proxies, storage manager |
| **2** | Timeline editing core | XL | 1 | Multi-track editing: move, trim, split, ripple, snap, copy/paste, shortcuts |
| **E1** | **Thin end-to-end export** *(pulled forward — your decision)* | M | 1, 2 | Import → trim/arrange → **export a playable MP4**, cuts only |
| **3** | Properties & animation | L | 2 | Transform, crop, blend, speed (incl. curves), keyframes + easing, canvas, mask, chroma key |
| **4** | Effects engine | XL | 3 | GPU shader pipeline: filters/LUTs, adjustments, effects, transitions |
| **5** | Text, captions & graphics | XL | 3 | Rich text + animation, subtitles import/export, auto captions, stickers/shapes |
| **6** | Audio | L | 2 | Mixer, fades/envelopes, voiceover, noise reduction, effects, beat markers, TTS |
| **7** | Export & sharing (full) | L | E1, 4 | Real MP4/WebM/GIF/audio export in a Worker; presets; project file import/export |
| **8** | AI & smart tools | XL | 5, 6, 7 | Remove background, auto enhance, silence cut, scene detect, auto reframe, text-based editing |
| **9** | Home, templates & capture | L | 1, 7 | Real project manager, template system, camera/screen capture, settings |
| **10** | Performance, a11y & hardening | L | all | Proxies, memory budgets, accessibility, i18n, crash recovery, QA matrix |
| **11** | Stretch | — | — | Cloud sync, collaboration, plugin API, multicam, colour scopes, native wrappers |

Phases 4, 5 and 6 are largely independent after Phase 3 and can be reordered by priority. The thin export milestone **E1** runs right after Phase 2 (decided), so there is an end-to-end "make a video and download it" result early; the full Phase 7 export (effects, text, audio processing, GIF, presets…) builds on it.

---

## 4. Phase details

Each phase lists **scope**, **new capabilities beyond what the UI currently suggests**, and **acceptance criteria**.

### Phase 0 — Foundations ✔ DELIVERED (v1.1.0, 2026-10-16)
*Make the prototype carry real weight.*

**Done** (all items in the original scope): modules split · TypeScript strict · project model v1 · store + command bus (undo/redo, coalescing, transactions) · demo clip is now a sample project · hard-coded timeline constants replaced by one `TimeScale` · IndexedDB persistence + schema-migration runner + frozen v1 fixture + OPFS skeleton · ESLint · Prettier · Vitest · Playwright · GitHub Actions · error boundary · lockfile.

**Pulled in from later phases because they were cheap and natural here:** truthful autosave status (was K6 / Phase 1) · keyboard-operable sliders (K5) · Properties bound to the model with working reset / delete-effect / section toggles · lazy-loaded editor · Back/Forward fix (S1) · corrupt-project quarantine · Ctrl/Cmd+Z shortcuts.

**Not done / carried forward** (see `Handover.md §6`): editor still opens playing (K2) · `rAF` clock (K3) · SVG filmstrip (K4) · tablet layout (K9) · WebKit and real-device verification (N1, S2) · OPFS write path unverified in browsers (N2) · no visual-regression tests (N6).

**Acceptance (met):** looks and behaves like v1.0.0 except the itemised, intentional deltas (`Handover.md §11`); `build`, `test`, `lint`, `e2e` (Chromium) pass; undo/redo works end-to-end for real commands with tests; reload preserves edits (proved in a real browser).

### Phase 1 — Real media pipeline
*Make footage real.* Delivered in three parts: **1a import & library ✔**, **1b preview & audio**, **1c projects & heavy files**.

#### 1a — Import & library ✔ DELIVERED (v1.2.0)
**Patch 1.2.1 (after your iPhone X / iOS 16 test):** import, storage and timeline worked; the video thumbnail did not → thumbnail maker rewritten for iOS, browser-native first-frame fallback, ⋯ → Create thumbnail with diagnostics, import warnings that say why. Needs your retest.

**Done:** file picker + desktop drag-and-drop · classification by MIME/extension (incl. iPhone `.MOV`/`.HEIC`) · probing with the browser's decoders (duration, size; audio-only "video" detected) · posters for photos/videos · waveform summary for audio · media stored as IndexedDB Blobs with a quota-aware, cleanup-on-failure ingest · one-undo-step batches · library with real thumbnails, durations, type filter, rename, delete-with-its-clips (undoable) · **+** add to timeline (photos default to 5 s) · import progress/result toast with per-file reasons · iPhone "add to Home Screen" tip · orphan sweep · **schema v2 + a real v1→v2 migration** · research **R-002** (IndexedDB chosen over OPFS) · **editor opens paused** (K2) which also made imports ~2× faster in tests.

**Not done in 1a** (deliberately): real playback of video/audio (1b); per-frame filmstrip thumbnails (1b); search/sort and duplicate detection (1c); relink missing files (1c); proxies for heavy files and a storage-usage screen (1c); Home "Import media" opens the sheet but can't open the file picker itself (needs a tap — platform rule); folder import; paste import; HEIC fallback conversion where the browser can't decode it; waveform for video files.

**Acceptance (met in Chromium; iPhone verification = your 1a review):** import a video, a photo and an audio file → correct tiles, durations, waveform; bad/unsupported files explained without blocking the rest; add to timeline; close and reopen → everything is still there; upgrading a real Phase 0 database loses nothing.

#### 1b — Preview & audio *(next)*
- **Preview:** audio-driven master clock (K3), real frame display (WebCodecs with `HTMLVideoElement` fallback) composited on a WebGL2 canvas, frame-accurate seek/scrub, per-frame thumbnails (K4), "Original" toggle, fit/fill, fullscreen.
- **Audio playback** via Web Audio with the audio clock as master; live level meter from a real `AnalyserNode`; honour track mute.
- **Research R-001/R-004/R-005 first**, on iPhone Safari specifically (WebCodecs availability, texture upload cost, `AudioContext` start rules).
- **Acceptance:** play an imported video with sound in sync (≤ 1 frame drift over 60 s), scrub smoothly, on **iPhone Safari and Chrome**.

#### 1c — Projects & heavy files
- Create / open / rename / duplicate / delete projects (multiple), project list on Home from real data; storage usage screen; duplicate detection; library search/sort; relink missing media.
- **Proxies** for 4K/long files; revisit OPFS (with a Worker write path) if big files need it.
- **Acceptance:** several projects, a 1–2 min 4K phone video edits smoothly via its proxy, and storage use is visible.

### Phase 2 — Timeline editing core
**Scope**
- **Tracks:** unlimited video/overlay tracks, audio tracks, text/effect tracks; add/remove/reorder/lock/hide/mute/solo; track height presets.
- **Selection:** click, shift/ctrl multi-select, marquee, select-all, select-forward.
- **Editing:** move (with cross-track drag), trim in/out (with source-limit enforcement), **split at playhead**, delete, **ripple delete**, duplicate, copy/paste, replace clip, reorder on main track, gaps.
- **Smart behaviours (the existing toggles become real):** *Main-track magnet* (auto-close gaps), *Auto snapping* (clip edges, playhead, markers, beats), *Linkage* (video+its audio move together), *Preview axis* (the existing toggle — defined and implemented, or removed if it proves redundant).
- **Markers & ranges**, in/out points, loop playback.
- **Zoom:** fit-to-project, zoom-to-selection, cursor-anchored wheel/pinch zoom.
- **Tools:** select, razor, hand, slip/slide (trim modes), **Select tool dropdown** actually switches.
- **Undo/redo** — the infrastructure and shortcuts exist (Phase 0); every new timeline operation must be a command; history panel (stretch).
- **Keyboard shortcuts** (undo/redo already shipped; now the real "Shortcut" panel, rebindable) and **context menus**; phone gestures (long-press, drag handles).
- **Cover** selection (the existing "Set cover" icon), freeze frame, extract audio, detach audio.

**Acceptance:** build a 3-minute multi-track edit with only the timeline tools; every operation undoable; snapping verified by tests; performance: 60 fps playhead with 200 clips on a mid-range laptop.

### Phase E1 — Thin end-to-end export *(decided: pulled forward, right after Phase 2)*
*Prove the hardest technical path early: pixels from the timeline → a file you can play.*

**Scope** — export the timeline as **cuts only** (no effects/text yet): one resolution (project size), project fps; **MP4 (H.264 + AAC)** where the browser's encoders support it, with the best available fallback and a clear message where not (research R-001 on Safari first); runs off the main thread; progress, ETA, **cancel**; save via download / File System Access / Web Share where available; preflight checks (missing media, unsupported codec, too long for the device) in plain language.
**Why now:** WebCodecs/muxing/Safari behaviour is the biggest unknown in the whole product — find out in a small phase, not in Phase 7.
**Acceptance:** import → trim/arrange in the timeline → export; the result plays with correct audio sync in QuickTime/Safari, Chrome and VLC; cancel works; a 60 s 1080p30 export completes on a mid-range laptop and on a recent iPhone (or a documented, user-visible limit).

### Phase 3 — Properties & animation
**Scope**
- **Basic:** position X/Y (numeric + on-canvas handles), scale (uniform/non-uniform), rotation, flip, crop, anchor point, opacity, **blend modes** (real list: multiply, screen, overlay, etc.), numeric entry on every field (NumberBox gets real input + drag-scrub).
- **Speed:** constant (0.1×–100×), **speed curves** with presets, reverse, freeze frame, optical-flow/frame-blend smoothing (quality tiers), pitch-preserve toggle.
- **Animate:** in/out/loop preset animations with duration + easing.
- **Keyframes:** the diamond buttons become real — add/remove/navigate (the ◀ ◆ ▶ control), per-property lanes, bezier easing editor, graph editor (stretch), copy/paste keyframes.
- **Canvas:** aspect-ratio presets (9:16, 16:9, 1:1, 4:5, 21:9, custom), fit/fill, **background** (colour, gradient, blurred copy, image).
- **Mask:** line, mirror, circle, rectangle, heart/star/custom path, feather, invert, expansion, keyframable.
- **Cutout:** chroma key (colour pick, tolerance, spill), luma key; (AI cut-out arrives in Phase 8).
- **Stabilise** (quality tiers), **crop & rotate tools**.
- **Adjust:** brightness, contrast, saturation, exposure, temperature, tint, highlights, shadows, vibrance, sharpen, vignette, grain, fade — with per-clip reset and "apply to all".
- Section checkboxes/reset buttons in the current UI become real (`reset` restores defaults; checkbox bypasses the section).

**Acceptance:** animate a clip's scale/position with eased keyframes; mask a clip with a feathered circle; chroma-key a green-screen sample; all reflected identically in preview and (later) export.

### Phase 4 — Effects engine
**Scope**
- **Shader pipeline:** composable effect passes on GPU; effect stack per clip/track/adjustment layer; reorder, enable/disable, strength, per-parameter keyframes; "NO 1 / NO 2" stack UI in the Effects section becomes real.
- **Filters:** curated look presets; **`.cube` LUT import**; strength slider (the existing Filters section).
- **Effects library:** blurs (gaussian, motion, radial, zoom), glitch/RGB-split, chromatic aberration, VHS/CRT, glow/bloom, pixelate/mosaic, shake, flash, film grain/dust, light leaks, mirror/kaleidoscope, edge/outline, duotone, etc. (all original implementations).
- **Motion Blur** (shown in the UI today) implemented properly via temporal sampling.
- **Transitions:** dissolve, fade through black/white, wipes, slides, zooms, spins, glitch, blur; duration, easing, direction, **apply to all**; handles/overlap rules enforced by the model.
- **Adjustment layers** (effects spanning many clips).
- Preview-quality governor (auto-drops resolution to hold frame rate).

**Acceptance:** stack 5 effects on a clip at 1080p preview ≥ 30 fps on a mid-range device (or governor reduces quality visibly and recovers); transitions render identically in preview and export.

### Phase 5 — Text, captions & graphics
**Scope**
- **Text engine:** font picker with **local font loading** (Local Font Access where available + user upload), size, weight, italic, tracking, leading, alignment, colour/gradient, stroke, shadow, glow, background box, curved text, per-character/word/line animation (in/out/loop), text presets/templates, multi-line editing on canvas, RTL + complex scripts (verify shaping).
- **Captions:** import/export **SRT/VTT** (ASS as stretch), caption track, per-line timing editor, styles applied to all, word-level highlight (karaoke) styles.
- **Auto captions:** on-device speech-to-text (model choice and licence verified at phase start; multilingual; progress UI; editable result).
- **Stickers & graphics:** emoji, shapes, arrows, lines, icons, animated stickers (Lottie/APNG/GIF-class), drawing/brush tool, image overlays; all from permissive sources.
- **Text-to-speech** hook (ties into Phase 6).
- Text/Stickers tabs (currently "library is empty") become real libraries with search + favourites.

**Acceptance:** auto-caption a 2-minute speech sample with editable output; export captions as SRT; animated text in/out; custom font survives reload.

### Phase 6 — Audio
**Scope**
- **Mixer:** per-clip and per-track volume, pan, mute/solo, master limiter; live meters.
- **Envelope & fades:** volume keyframes, fade in/out handles on clips, crossfades.
- **Voiceover recording:** the Mic buttons become real (MediaRecorder / `getUserMedia`, input device selection, count-in, level check, takes).
- **Extract / detach** audio from video; **audio library** (bundled CC0/own music + SFX, search, preview, favourite, import).
- **Processing:** noise reduction, normalise, EQ presets (3–5 band), compressor, reverb/echo, **voice changer** presets, de-ess/de-click (stretch).
- **Beat & marker tools:** beat detection → markers; snap-to-beat; auto-cut-to-beat helper.
- **Ducking** (auto-lower music under speech).
- **Text-to-speech** (system voices via Web Speech where available; on-device voices as stretch).

**Acceptance:** record voiceover over a clip, apply noise reduction and fade, duck music under it, hear identical mix in export.

### Phase 7 — Export & sharing
**Scope**
- Export dialog (the "Export" button): resolution (up to project/hardware limit), fps, **bitrate/quality**, codec (H.264/AAC MP4 default; WebM VP9/AV1/Opus where supported), **GIF**, still frame (PNG/JPG), **audio-only** (AAC/WAV/MP3-class), image sequence (stretch), range export (in/out), cover export.
- **Offline render in a Worker** using the same render graph; progress, ETA, **cancel**, background-tab resilience (Wake Lock + resumable chunks where feasible); memory guardrails.
- Delivery: **File System Access** save where supported, else download; **Web Share** on phones.
- **Project file** import/export (`.fcproj` = zip: JSON + referenced media optional) for backup and moving between devices.
- Export presets for common platforms (vertical short-form, landscape, square, etc.), watermark-free.
- Preflight checks (missing media, unsupported codec, too long for device) with plain-language fixes.

**Acceptance:** a 60 s 1080p30 multi-track project exports to MP4 that plays in VLC, QuickTime and the browser with audio in sync; export of identical project is deterministic frame-for-frame in tests (golden frames).

### Phase 8 — AI & smart tools
*(Every item = on-device first; each ships with a "model download" explainer and offline behaviour. Model licences/sizes verified at phase start.)*
- **Remove background / AI cut-out** (people segmentation; video matting quality tiers).
- **Auto enhance** (exposure/colour/denoise), **low-light**, **upscale** (small factor) — candidates, scoped by feasibility.
- **Quick cut / silence removal**, filler-word detection from transcript.
- **Text-based editing** (edit the transcript → clips cut accordingly).
- **Scene detection** and **auto-split**.
- **Auto reframe** (subject tracking → crop for new aspect ratios).
- **Object/face tracking** to attach text/stickers; **motion tracking** basics.
- **Smart music sync** (builds on beat markers); **AI stylise** tab (currently "Nothing to adjust") — limited to what can legitimately run on-device.
- Optional **server-AI connector** design (bring-your-own-key) — design only, no hosting.

### Phase 9 — Home, templates & capture
- **Real Home:** actual project list with thumbnails/duration/modified date, rename, duplicate, delete, sort/search, trash with restore, storage usage; "Recent" and "Projects" tabs real.
- **Templates:** JSON template format with media **slots** (drop your clips in), text placeholders, music, aspect ratio; template gallery; "use template" flow; user-saved templates. Ships with original templates only.
- **Shoot & record:** camera (front/back, resolution, flip, timer, grid), screen capture (desktop), straight into the library/timeline.
- **Tools tiles** on Home (Auto captions, Voiceover, Quick cut, Remove background, Auto enhance) become real shortcuts into the right editor state.
- **Settings:** default fps/resolution/ratio, theme (dark now; light optional), shortcuts, storage, language, clear caches, about/licences.
- First-run onboarding + sample project.

### Phase 10 — Performance, accessibility & hardening
- **Performance:** proxy workflow, decode cache + LRU, texture pooling, memory budgets per device class, frame-drop telemetry (local only), virtualised timeline rendering for 1000+ clips.
- **Accessibility:** full keyboard operation (sliders gain key handlers — currently pointer-only), focus management, ARIA for timeline/clips, screen-reader announcements, contrast audit, reduced-motion audit, touch-target audit.
- **i18n:** string extraction, locale files, RTL layout pass, number/time formatting.
- **Resilience:** crash recovery from autosave, migration tests for every schema version, corrupted-project repair, storage-eviction handling (`navigator.storage.persist`).
- **QA:** supported-browser matrix, device test list, golden-frame render tests, load tests; security headers/CSP review; privacy statement (no network calls by default).
- **Docs:** user guide, keyboard cheat-sheet, contributor docs final pass.

### Phase 11 — Stretch / future
Cloud sync (optional accounts), real-time collaboration, shareable review links, plugin/extension API (custom effects, transitions, exporters), multicam, advanced colour grading (curves, wheels, scopes, HDR handling), advanced audio (multi-band, spectral editing), 3D/AR stickers, desktop (Tauri) and mobile (Capacitor) wrappers, batch export, command palette.

---

## 5. Decisions & open questions

**Answered (2026-10-16)**

| # | Question | Answer |
|---|---|---|
| Q1 | Pull a thin export forward? | **Yes** → Phase E1 |
| Q2 | Priority devices? | **Safari and Chrome** (D-007) |
| Q3 | TypeScript in Phase 0? | **Yes** → done |
| Q5 | Keep name FreeCut + original mark? | **Yes** |
| Q6 | Language | **English only** first |

**Still open — Q4 (AI), in plain language.** *You don't need to decide now; nothing before Phase 5 depends on it.*
Some features — auto captions (speech → text), removing a background, auto-enhance — need an "AI model". There are two ways to run one:
- **A. Inside the user's browser/phone ("on-device").** ✔ free to run, ✔ private (videos never leave the device), ✔ works offline. ✘ the first use downloads a model (tens to a few hundred MB), ✘ slower on old phones, ✘ quality is good but not always the best available.
- **B. On a server we pay for.** ✔ faster and often higher quality, ✔ nothing big to download. ✘ costs money for every use, ✘ needs internet, ✘ videos/audio are uploaded (privacy + a privacy policy), ✘ we'd need to build and run a backend.

**My recommendation: A** — it fits "free, private, works offline". It is applied **provisionally** (D-011); I'll ask again, with concrete numbers (model sizes, speed on your phone), when Phase 5 starts. A later optional "bring your own key" server mode remains possible.

---

## 6. Guardrails (apply to every phase)

- **Original work only.** FreeCut's UI layout follows familiar editor conventions, but we do **not** copy CapCut's (ByteDance's) proprietary assets, templates, fonts, music, sticker packs, effect names/preset recipes, icons, or marketing copy, and we don't use the CapCut name/logo in the product. Feature parity ≠ asset parity. *(This is engineering hygiene, not legal advice; consult a lawyer before commercial release.)*
- **Licensing manifest.** Every bundled asset (font, sound, LUT, sticker, template) is recorded with source + licence in a manifest (`public/assets/LICENSES.json`, created in Phase 1). Accepted: CC0, public domain, MIT/Apache/OFL-style, or created for this project. No "free to download" assets of unclear terms.
- **Codec/patent awareness.** We rely on codecs provided by the user's browser/OS where possible; bundling encoders (e.g. via WASM) needs a licence review first.
- **Privacy.** No analytics, no uploads, no network calls on user media by default. Any future network feature is opt-in and documented.
- **Accessibility is not a final-phase task.** New controls ship keyboard-operable from Phase 0 onward; Phase 10 audits and fills gaps.
- **Performance budgets.** Initial JS stays lazy-split (Home loads without the editor engine); the editor engine and AI models load on demand.

---

## 7. Capability gap analysis (what a CapCut-class editor has that FreeCut doesn't, yet)

*Based on publicly known CapCut capabilities; CapCut changes often — re-verify when scoping each phase.* ✔ = real today, ◐ = UI exists but non-functional, ✖ = absent.

| Capability | Now | Phase |
|---|---|---|
| Import local media | ✔ (1a; picker + drop; no folder/paste import) | 1a ✔ |
| Media library (filter ✔ · rename ✔ · delete ✔ · search/sort ☐) | ◐ | 1a ✔ / 1c |
| Frame-accurate preview + audio | ◐ (posters only; clock only) | **1b** |
| Autosave / reopen the last project | ✔ (Phase 0) — multi-project list in Phase 1/9 | 1 / 9 |
| Multi-track timeline | ◐ (1 video + 1 audio, static) | 2 |
| Trim / split / delete / ripple | ◐ | 2 |
| Snapping / magnet / linkage | ◐ (toggles only) | 2 |
| Undo / redo (+ Ctrl/Cmd+Z) | ✔ infrastructure (Phase 0); each new operation adds commands | 2 |
| Keyboard shortcuts / context menus | ◐ undo/redo only | 2 |
| Transform, crop, blend, opacity | ◐ | 3 |
| Speed (constant, curve, reverse, freeze) | ◐ | 3 |
| Keyframes + easing / graph editor | ◐ | 3 |
| Masks | ◐ (tab only) | 3 |
| Chroma key | ◐ (tab only) | 3 |
| Canvas / aspect ratio / background | ◐ (tab only) | 3 |
| Stabilise | ✖ | 3 |
| Animations (in/out/loop) | ◐ (tab only) | 3 |
| Filters + LUTs | ◐ | 4 |
| Colour adjustments | ◐ (tab only) | 3 / 4 |
| Effects library + stack | ◐ | 4 |
| Transitions | ◐ (tab only) | 4 |
| Adjustment layers | ✖ | 4 |
| Text + animated text + templates | ◐ (tab only) | 5 |
| Subtitles import/export | ✖ | 5 |
| Auto captions | ◐ (Home tile) | 5 |
| Stickers / shapes / drawing | ◐ (tab only) | 5 |
| Audio mixer, fades, ducking | ✖ | 6 |
| Voiceover recording | ◐ (mic buttons) | 6 |
| Noise reduction / voice changer | ✖ | 6 |
| Beat detection | ✖ | 6 |
| Text-to-speech | ✖ | 6 |
| Audio library | ◐ (tab only) | 6 |
| Export MP4 (cuts only) | ◐ (button only) | **E1** |
| Export GIF/audio/presets/with effects | ◐ | 7 |
| Project file import/export | ✖ | 7 |
| Remove background / AI cut-out | ◐ (Home tile) | 8 |
| Auto enhance, quick cut | ◐ (Home tiles) | 8 |
| Auto reframe, scene detect, tracking | ✖ | 8 |
| Text-based editing | ✖ | 8 |
| Templates | ◐ (placeholders) | 9 |
| Camera / screen capture | ◐ (Home tile) | 9 |
| Settings / onboarding | ✖ | 9 |
| Accessibility, i18n | partial (sliders ✔) / ✖ | 10 |
| Cloud sync, collaboration, plugins | ✖ | 11 |
| Home ⇄ Editor nav, PWA offline, phone + desktop layouts | ✔ | maintain |

---

## 8. Status tracker

Updated at the end of each phase delivery.

| Phase | Status | Delivered | Notes |
|---|---|---|---|
| Baseline v1.0.0 | ✔ received & analysed | 2026-10-16 | Docs added (`freecut-baseline-docs.zip`). No code changed. |
| **0** | ✔ **delivered & reviewed on iPhone Safari — all steps passed** | 2026-10-16 | `freecut-phase-0.zip`, v1.1.0 |
| **1a** | ✔ **delivered — awaiting your review** | 2026-10-20 | `freecut-phase-1a.zip` (+ `freecut-phase-1a-changes.zip`), v1.2.0. Phone review script: `Handover.md §10` |
| **1a.1** | ✔ **delivered — needs your iPhone retest** | 2026-10-20 | v1.2.1: iPhone video-thumbnail fix + fallbacks + diagnostics (`Handover.md §10`, R1–R7) |
| 1b | ☐ next (after the retest) | — | preview & audio |
| 1c | ☐ | — | projects & heavy files |
| 2 | ☐ | — | |
| E1 | ☐ | — | thin export (after 2) |
| 3 | ☐ | — | |
| 4 | ☐ | — | |
| 5 | ☐ | — | |
| 6 | ☐ | — | |
| 7 | ☐ | — | |
| 8 | ☐ | — | |
| 9 | ☐ | — | |
| 10 | ☐ | — | |
| 11 | ☐ | — | |
