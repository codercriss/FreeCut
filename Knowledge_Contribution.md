# Knowledge & Contribution Guide

> **How to read this file.** The filename was open to interpretation, so it does two jobs:
> **Part A — Contributing:** how to change the code, add content, document, and hand work over.
> **Part B — Knowledge base:** a living record of decisions, learnings, glossary and research notes so nothing we figure out has to be rediscovered.
> If you only have 5 minutes: read **A1 (rules of the road)**, **A6 (PR checklist)** and skim **B3 (learnings)**.

---

# Part A — Contributing

## A1. Rules of the road

1. **Read first:** `Handover.md` → `how_it_works.md` → the relevant `Roadmap.md` phase.
2. **One phase, one theme.** Don't mix a feature with an unrelated refactor.
3. **The project is data.** UI, preview and export read the same project model; UI components never own project state *(enforced since Phase 0 — see `how_it_works.md §3–4`)*.
4. **Every edit is a command** (undoable). If it changes the project and can't be undone, it's a bug.
5. **Keep it offline-safe.** No runtime network calls, no remote fonts/images/scripts. Anything that needs the network must be opt-in and documented.
6. **Original assets only** (see A8). When in doubt, leave it out.
7. **Desktop *and* phone.** A feature isn't done until both layouts work (see `Roadmap.md §1` Definition of Done).
8. **Accessible by default.** Keyboard-reachable, labelled, `prefers-reduced-motion` respected.
9. **Document as you go.** Code without the matching doc update is unfinished (A5).
10. **Say what you didn't do.** Deferred work goes in the phase's *not-done* list, never silently dropped.

---

## A2. Setup & commands

```bash
npm install
npm run dev        # dev server (no service worker)
npm run build      # production build + PWA
npm run preview    # test the built app + offline behaviour
```
```bash
npm run typecheck      # tsc: browser code (strict) + config/e2e. NOTE: Vitest does NOT type-check
npm run lint           # ESLint 9 (flat config)
npm run format         # Prettier (index.html and *.md are ignored on purpose)
npm test               # Vitest — pure logic, persistence (fake-indexeddb), components (jsdom)
npm run verify         # typecheck → lint → test → build   ← run this before every delivery
npm run e2e            # Playwright (Chromium + WebKit, desktop + phone); first: npx playwright install chromium webkit
```
**Minimum before handing over a phase:** `npm run verify` green, `npm run e2e` green on Chromium **and** WebKit (CI does both), and the review script written and walked through.

Node ≥ 18.18.

---

## A3. Code standards

**Today (baseline conventions — keep until Phase 0 changes them):**
- Function components + hooks. Constants that are meant to be tuned sit at the top of the file with a comment.
- Class names are prefixed by area: `ve-` editor, `hm-` Home, `fc-` screen layers, `sc-` hero-scene animation.
- Comments explain *why*, not *what* (see the iOS notes in `index.html`).
- Seeded randomness (`lcg`/`rng`) for generated art so renders are identical.
- Animation: `transform`/`opacity` only; wrap in `prefers-reduced-motion`.

**In force since Phase 0:**
- TypeScript, `strict` for new code. Prefer `type` aliases for data, `interface` for contracts.
- **Time is integer frames (or ticks), never floating seconds**, inside the model. Convert only at the UI/IO boundary.
- Pure logic (time maths, snapping, trimming, keyframe evaluation, schema migration) lives in plain modules with **no React/DOM imports** so it is trivially unit-testable.
- Heavy work (decode, thumbnails, waveform, export, AI) runs in Workers; no long tasks (> 50 ms) on the main thread.
- No `any` without a `// why` comment. No silent `catch {}` — log or surface.
- Files over ~400 lines are a smell; split by responsibility.
- UI primitives (Slider, NumberBox, etc.) are keyboard-operable and have ARIA roles/labels.
- Formatting: Prettier defaults + ESLint (config lands in Phase 0). Don't hand-format.

**Naming:** components `PascalCase`; hooks `useThing`; commands `verbNoun` (`splitClip`, `trimClipStart`); model fields `camelCase`; CSS classes `prefix-kebab`.

---

## A4. Branches, commits, versions

- Branch: `phase-N/short-topic` (e.g. `phase-2/ripple-delete`).
- **Commit messages:** the owner commits updates himself and asked for **one plain-language message per update, written by the assistant in the chat (not in a file)** — a short summary line anyone can read, e.g. "Show sharp originals in the player and fix blurry previews". For developers working in git, the style is `area: imperative summary` with a body that explains *why*.
- Version: `package.json` bumps **minor** per phase (`1.1.0` after Phase 0, …) and **patch** for fixes within a phase. The zip is named `freecut-phase-N.zip`.
- Project-file schema has its own `schemaVersion`; any change needs a **migration + a test with an old fixture** (Phase 0 onward).

---

## A5. Documentation duties (what to update, when)

| You changed… | Update |
|---|---|
| Anything user-visible or architectural | `how_it_works.md` (the relevant section — rewrite, don't append) |
| The project model (`model/types.ts`) | **schema version bump + migration + a frozen fixture + test** (recipe below), `how_it_works.md §3` |
| Status of a feature / new bug / new gotcha | `Handover.md` §4 (status), §6 (issues), §11 (gotchas) |
| Finished a phase | `Handover.md` §8 (phase log), `Roadmap.md` §8 (tracker) |
| Made a decision with trade-offs | `Handover.md` §7 + an ADR (A9) if non-trivial |
| Learned something non-obvious | Part B3 below (learning entry) |
| Added/removed a bundled asset | `public/assets/LICENSES.json` (A8) |
| Changed how to contribute | This file |

---

## A6. Pull-request / delivery checklist

- [ ] Scope matches one roadmap item; deferred items listed
- [ ] Works on **desktop layout** and **phone layout** (resize < 820 px; test touch if possible)
- [ ] Undo/redo works for every project-changing action
- [ ] State survives reload where it should (persistence)
- [ ] Keyboard path exists (desktop); touch targets ≥ 44 px (phone)
- [ ] `prefers-reduced-motion` respected for any new animation
- [ ] No console errors/warnings in a normal session
- [ ] Unit tests for new pure logic; component tests for new UI; e2e smoke still green on Chromium **and** WebKit
- [ ] **Mutation check:** break the new behaviour on purpose and confirm a test fails (see L-016)
- [ ] `npm run build` green; PWA still installs and works offline (`build` + `preview`)
- [ ] Home ⇄ Editor transitions and iOS behaviour not regressed
- [ ] No new network calls; no un-manifested assets
- [ ] Docs updated per A5
- [ ] Review script written (numbered, ~10 min, expected results)
- [ ] Verification record included (commands + outputs)

---

## A7. How to add things (recipes)

### Add a Home headline
Append a two-line array to `HEADLINES` in `src/Home.jsx`. It joins the random rotation automatically.

### Add a Home hero scene
1. Write a component in `src/HeroScenes.jsx` drawn on a **400×300** canvas, keeping the **lower half dark** so the headline stays readable.
2. Use ids derived from the `u` prop (via `useId`) for gradients/clip-paths so scenes can coexist.
3. Register it in `SCENE_ART` and append its id to `SCENES`.
4. Give moving parts classes (`sc-…`) and keyframes in `SCENE_CSS`. Rules: transform/opacity only; nothing wider than the canvas moves sideways; everything off under `prefers-reduced-motion`.
5. Check it as a thumbnail (non-`live`) and as the hero (`live`).

### Rename the product
`BRAND_NAME` / `BRAND_ACCENT` in **both** `src/VideoEditor.jsx` and `src/Home.jsx`; `<title>`, `apple-mobile-web-app-title`, `description` in `index.html`; `name`/`short_name`/`description` in `vite.config.js`; `freecut.home.pick` key if desired; icons in `public/`. *(Phase 0 collapses this to one `brand` module.)*

### Change the accent colour
`--accent` in both CSS blocks (`.ve-app`, `.hm`), `BRAND_ACCENT` in both files, `theme_color` in `index.html`/`vite.config.js`, and the favicon/icons.

### Add a command (any project edit) — *the most common change*
1. Add a factory to `src/store/commands.ts`: `export const doThing = (id, value): Command => ({ type, label, coalesceKey?, apply })`.
2. `apply(project)` is **pure** and **clamps/rounds** its input; return the **same `project` object** when nothing changes (unknown id, same value) — the store then records no history.
3. Give drag-style commands a `coalesceKey` (`"clip.opacity:<clipId>"`) so a drag is one undo step; discrete commands get none.
4. Test in `commands.test.ts`: effect, no-op returns the same object, clamping, and `validateProject(result)` is still empty.
5. Call it from the UI with `useProjectStore().execute(cmd)`. Never mutate the project in a component.
6. Several commands that must undo together → `store.transaction("Label", () => { … })`.

### Add or change a field on the project (schema change)
1. Edit `model/types.ts`; bump `SCHEMA_VERSION`.
2. Add `MIGRATIONS[oldVersion]` in `model/migrations.ts`: a **pure** function from the old shape to the new (must not mutate its input).
3. **Freeze the old shape:** copy the previous `fixtures/project.vN.json` as-is (never edit or regenerate old fixtures) and add a test that `migrateProject(oldFixture)` produces a valid current project with the expected new defaults.
4. Update `validateProject`, `createSampleProject`, `createEmptyProject`, `defaults.ts`.
5. Update `how_it_works.md §3` and `Handover.md §6/§7`.
6. Remember: a project saved by a *newer* app is refused (`too-new`) and quarantined — never silently downgraded.

### Add support for a new media type or source
1. `media/classify.ts`: extension/MIME; 2. `media/probe.ts`: how to read its duration/size and the user-facing error text; 3. `thumbnail.ts` if it needs a poster/waveform (best-effort, with a timeout); 4. extend `AssetKind`/`AssetSource` in `model/types.ts` → **schema change recipe above**; 5. tests: `ingest.test.ts` (fake deps) + an e2e with a real tiny file generated by ffmpeg (see `e2e/fixtures/`).

### Write a component test
Use `src/test/harness.tsx`: `const { store, wrap } = makeHarness(); render(wrap(<Thing />))`. Put `// @vitest-environment jsdom` at the top of the file. Wrap store changes made outside React events in `act(() => void store.undo())`. Query by role/name (what a user and a screen reader see), not by class.

### Add an e2e test
`e2e/editor.spec.ts`. The `errors` fixture is automatic — your test fails on any console error. Use `exact: true` for button names that are substrings of others. Use `isMobile` to branch/skip. Keep it deterministic: pause playback first, wait for `[role=status][data-state=saved]` before reloading.

### *(Planned recipes — written when the phase lands)*
- **Add an effect** (shader pass + parameter schema + UI + export parity test) — Phase 4
- **Add a transition** — Phase 4
- **Add a LUT / filter preset** — Phase 4
- **Add a text template / font** — Phase 5
- **Add a sticker / animated sticker** — Phase 5
- **Add a project template** — Phase 9
- **Add a keyboard shortcut / bind a command to a key** — Phase 2 (undo/redo shortcuts live in `editor/shortcuts.ts`)
- **Add a locale** — Phase 10

---

## A8. Assets & licensing

**Accepted:** CC0 / public domain; MIT, Apache-2.0, BSD, OFL (fonts) and similar permissive licences; assets created for this project.
**Not accepted:** anything of unclear provenance ("free download" sites with no licence), anything ripped from another product, **any CapCut/ByteDance assets** (effects, templates, stickers, fonts, music, icons, copy) or their trade dress/logo; GPL/AGPL code unless we explicitly decide to adopt that licence project-wide.

**Manifest (`public/assets/LICENSES.json`, created in Phase 1):** every bundled asset gets an entry:
```json
{
  "file": "audio/music/sunrise.mp3",
  "title": "Sunrise",
  "author": "Name",
  "source": "https://…",
  "license": "CC0-1.0",
  "licenseUrl": "https://…",
  "attributionRequired": false,
  "added": "2026-10-16"
}
```
Attribution-required assets are surfaced in **Settings → About → Licences** (Phase 9).

**Dependencies:** before adding an npm package, record its licence, size (gzip), maintenance state, and why a smaller/own implementation won't do. Prefer lazy-loaded imports for heavy ones. For WASM encoders/decoders and AI models, a **licence + patent review** is required first.

*(Engineering hygiene, not legal advice.)*

---

## A9. Decision records (ADR template)

Create `docs/adr/NNNN-title.md` (folder introduced when the first ADR is written) and add a one-line row to `Handover.md §7`.

```md
# ADR NNNN — <title>
- Status: proposed | accepted | superseded by NNNN
- Date: YYYY-MM-DD
- Deciders: <names>

## Context
What problem, what constraints, what we know (with evidence).

## Options considered
1. … (pros / cons)
2. …

## Decision
What we chose and why.

## Consequences
Good, bad, follow-ups, how we'll know if it was wrong.
```

---

## A10. Bug reports & review feedback

**Bug:** title · environment (device, OS, browser + version, installed PWA or tab) · steps · expected · actual · screenshot/recording · frequency · project file attached if relevant.
**Review feedback to me** after each phase: pass/fail per review-script step; changes labelled **blocking** or **later**; answers to open **[DECISION]** items; real-device notes (iOS/Android) — I can't test physical devices from here.

---

# Part B — Knowledge base

## B1. How to add a knowledge entry

Add to the right section below. Keep entries short, dated, and evidence-based. **Mark confidence** — `verified` (I ran it / read the code), `reported` (someone observed it), `assumed` (reasoned, untested). Never present an assumption as fact.

**Learning entry template**
```md
### L-NNN — <title>        (date · area · confidence)
**Context:** when does this matter?
**Finding:** what is true / what to do.
**Evidence:** code ref, test, doc, device.
**Impact:** what it changes / what to avoid.
```

**Research note template** (before starting a phase that depends on a platform API)
```md
### R-NNN — <API / library / model>        (date)
- Question we need answered:
- Browser/OS support found (with source + date checked):
- Limits (size, memory, codecs, quotas):
- Licence / patents:
- Prototype result:
- Recommendation:
```

---

## B2. Research backlog (to complete **at the start of the dependent phase**)

| ID | Topic | Needed by | Question |
|---|---|---|---|
| R-001 | WebCodecs (decode + encode) | **Researched in 1b.0** (see B2b) | Result: video decode exists on iOS 16.4+, HEVC unproven there, audio codecs only in newer Safari → not the base for 1b; revisit for export. **Device-confirmed 2026-10-31** (HEVC ✘, no AudioDecoder). Done unless a feature needs WebCodecs later (export) |
| R-002 | OPFS + IndexedDB limits | **Researched in Phase 1a** (see B2b) | Result: IndexedDB Blobs chosen for Phase 1; OPFS later. Still open: real quota numbers on target iPhones, large-file (1 GB+) behaviour, `persist()` behaviour |
| R-003 | Demux/mux libraries | Phase 1 / 7 | Which MP4/WebM/MOV demuxers & muxers are small, maintained, permissively licensed? Fragmented MP4 for streaming export? |
| R-004 | WebGL2 compositing at 4K | **Partly researched in 1b.0** (see B2b) | Result: video → texture uploads on iOS have a history of slow paths → 2D canvas first. **Device-confirmed 2026-10-31 (small clips):** uploads 1.0 ms, seeks 55–74 ms, muted playback 1.0× hidden or visible, 30 fps while painting every frame to a canvas. Still open: a **heavy** (1080p/4K) clip, multi-layer budget, context-loss handling |
| R-005 | Web Audio as master clock | **Partly researched in 1b.0** (see B2b) | Result: gesture-start rule, silent-switch fix, element volume ignored on iOS. Device-confirmed: unlock ✔, audioSession ✔, decode ✔. **Built in 1b.1** (audio clock master, join/late-join, drift controller); Bluetooth output latency not compensated; phone confirmation pending |
| R-006 | File System Access / Web Share | Phase 7 | Support matrix; fallbacks for save/share |
| R-007 | MediaRecorder codecs | Phase 6 / 9 | Per-browser mime types for audio/video capture; variable-bitrate quirks |
| R-008 | On-device speech-to-text | Phase 5 | Model options, size, languages, WebGPU vs WASM speed, licence |
| R-009 | On-device segmentation / matting | Phase 8 | Model options, quality vs speed on phones, licence |
| R-010 | Font loading | Phase 5 | Local Font Access availability; embedding user fonts in project files; shaping for complex scripts |
| R-011 | Wake Lock & background throttling | Phase 7 | Can a long export survive a locked screen / background tab on mobile? |
| R-012 | Beat detection approaches | Phase 6 | Lightweight algorithms vs models; accuracy on music vs speech |
| R-013 | Lottie/animated sticker runtimes | Phase 5 | Licence, size, deterministic frame stepping for export parity |
| R-014 | Accessibility patterns for timelines | Phase 10 | ARIA for drag-and-drop timelines; keyboard models in pro editors |

### B2b. Research notes (completed)

#### R-002 — OPFS vs IndexedDB for imported media   (2026-10-16 · web search; **not verified on a device**)
- **Question:** where do imported video/photo/audio bytes live so they survive closing the app, on iPhone Safari and Chrome?
- **OPFS (`navigator.storage.getDirectory()`):** reported available in Safari since 15.2. The simple main-thread write API, `FileSystemFileHandle.createWritable()`, is **reported to have arrived only in Safari 26** (a quoted release note in a WebKit bug-tracker thread); older iOS versions need `createSyncAccessHandle()` inside a Web Worker. One third-party source also mentions a Safari 26.4 bug where writing a typed-array *view* ignores its `byteOffset` and writes the whole buffer — a reason not to build on it blind.
- **Eviction (reported):** Safari's tracking-prevention policy can delete a site's script-writable storage after about 7 days without user interaction; **Home Screen web apps are exempt**. Chrome evicts only under storage pressure and `navigator.storage.persist()` helps.
- **Licence/patents:** n/a. **Prototype:** IndexedDB Blob writes measured at 1–15 ms for a 65 KB file in Chromium; IndexedDB already proven on the owner's iPhone for the project record (Phase 0 review).
- **Decision:** Phase 1 stores media as **IndexedDB Blobs** behind `media/mediaStore.ts` (works on every target browser today). OPFS (with a Worker write path) is a later optimisation if big files demand it (Phase 1c proxies). A visible iPhone tip recommends installing to the Home Screen.
- **Confidence:** the Safari-26 / 7-day claims are *reported*, not tested by us. Re-verify on caniuse/MDN before relying on either.

#### R-001 — WebCodecs on iPhone Safari   (2026-10-30 · web search; **not verified on a device** — the Playback check does that)
- **Question:** can we decode imported iPhone video (HEVC) and its audio with WebCodecs, on iOS 16 (the owner's iPhone X cannot go higher)?
- **Video decode:** reported in Safari since **16.4** (MDN compatibility data; a news item on Apple's WebCodecs support). So `VideoDecoder` should exist on the owner's phone if it runs 16.4+.
- **HEVC:** an Apple Developer Forums thread (`developer.apple.com/forums/thread/729464`, "HEVC On Web Codecs") reports an HEVC decoder configuration being **rejected on 16.4**; the thread did not give a resolution we could rely on. iPhones record HEVC by default, so this is the case that matters.
- **Audio:** MDN's "Codec selection" page says AAC encoding is supported only on Safari versions that have `AudioEncoder`, **Safari 26+**. We assume `AudioDecoder` arrived in the same release; *not confirmed*.
- **Licence/patents:** HEVC is patent-encumbered; decoding goes through the OS/browser, we ship no codec.
- **Device result (2026-10-31 · owner's iPhone, iOS 16.7, Home Screen app) — confirmed:** `VideoDecoder` ✔ and `VideoEncoder` ✔ exist; `AudioDecoder` ✘ and `AudioEncoder` ✘ do not. `isConfigSupported`: H.264 1080p ✔, VP9 ✔, **HEVC 1080p ✘ and HEVC 4K ✘ (both rejected with “Config is not valid”)**, AV1 ✘. The browser's `canPlayType` says HEVC ✔ and H.264 ✔, so iPhone clips play through `<video>`. (We tried no `description`/hvcC; a config that supplies one is untried — irrelevant while `<video>` plays HEVC.)
- **Prototype result (design):** `diagnostics/playbackCheck` prints `VideoDecoder.isConfigSupported` for H.264/HEVC/VP9/AV1 and `AudioDecoder` for AAC/Opus, including any rejection message.
- **Recommendation:** do **not** build 1b on WebCodecs. Use native `<video>` (the browser's own HEVC/H.264 path) for pictures and Web Audio buffers for sound; keep WebCodecs behind feature detection for export (E1).
- **Confidence:** medium (forum thread + compatibility tables). Settled only by the owner's Playback-check screenshot.

#### R-004 — Video → canvas / WebGL texture cost on iOS   (2026-10-30 · web search; **not verified on a device**)
- **Question:** how expensive is putting a decoded video frame into a canvas/texture each frame on an A11-class phone?
- **Reported:** WebKit bug 216250 (iOS 14 beta) describes video-to-texture uploads **falling off the GPU path into slow software conversion**; bug 226830 reports `texImage2D` from a video being slow, with a figure of **about 7 ms per upload on an iPhone 12 Pro** (an iPhone X is slower); bug 235845 shows `requestVideoFrameCallback` support landing in early 2022 (exact Safari version not confirmed by us).
- **Limits:** a 30 fps frame budget is 33 ms for decode, copy, compositing and UI.
- **Device result (2026-10-31 · small 576×640 clip — *not* a stress test):** `texImage2D(video)` median **1.0 ms** (slowest ~2 ms); seek-to-`seeked` median **74 ms** (slowest 116) — both good; `requestVideoFrameCallback` ✔; WebGL 2 ✔, largest texture 16384. The `drawImage` number (0.0 ms) is **meaningless**: 2D canvas calls are queued, so timing the call times the queueing (fixed in 1.3.1 — L-048). **Unexplained: a muted hidden `<video>` ran at 0.42× real time (13 fps, 0 skipped) — see Handover N34.** Heavy-clip numbers still missing.
- **Prototype result (design):** The Playback check measures `drawImage(video)` while playing, `texImage2D(video)` while playing, seek-to-`seeked` latency and **skipped frames**, on the owner's own largest imported video. (In headless Chromium with software decoding: copies ≈ 0.6 ms, uploads ≈ 0.4 ms — meaningless for iOS, but proves the measurement works.)
- **Recommendation:** composite on a **2D canvas** in 1b; defer WebGL until effects need it (Phase 4) and re-measure then. Use `requestVideoFrameCallback` where present.
- **Confidence:** medium-low (old bug reports; numbers from a different phone).

#### R-005 — Web Audio as the master clock on iOS   (2026-10-30 · web search; **not verified on a device**)
- **Question:** what must we do so sound starts, obeys our mixer and is not muted by the side switch?
- **Start rule:** reported that iOS only lets an `AudioContext` start from inside a direct user gesture, so it must be created/resumed **synchronously** in the Play tap.
- **Silent switch:** reported that the ringer switch **mutes Web Audio but not a `<video>` with sound**. Setting `navigator.audioSession.type = "playback"` is the documented fix; caniuse/MDN data say it exists from **iOS 16.4**. Before that, the known workaround is looping a silent `<audio>` element.
- **Element volume:** Apple's documentation says iOS does **not let JavaScript set media-element volume**, and a Stack Overflow answer plus WebKit bug 151589 (open since 2015) report that routing a media element through a `GainNode` has been broken/distorted since iOS 13. So per-clip volume and track mute cannot ride on the `<video>`.
- **Device result (2026-10-31 · owner's iPhone, iOS 16.7) — mostly confirmed, one claim contradicted:** `AudioContext` **runs right after the tap** (48000 Hz) ✔; `navigator.audioSession` **present and reads back “playback”** ✔ (so no silent-`<audio>` hack is needed on this phone); `decodeAudioData` of the owner's mp4 (24.3 s stereo) took **66 ms** ✔; both test tones were audible (silent-switch position during the test not stated). **Contradicted:** setting an element's volume to 0.5 **reads back 0.5** on iOS 16.7, against the old documentation that said it is not settable — whether it changes loudness is untested. The Web Audio design stands anyway (it is chosen for the clock, the meter and mixing several clips, not only for volume).
- **Prototype result (design):** The Playback check tests unlock-after-tap, `audioSession` presence and read-back, element-volume write-back, `decodeAudioData` of the owner's own video, and two test tones (Web Audio vs `<audio>`) to hear with the silent switch on.
- **Recommendation:** decode each clip's sound to an `AudioBuffer` and play it through Web Audio (reliable per-clip gain, mute, `AnalyserNode` meter); make `AudioContext.currentTime` the master clock; draw the muted `<video>` against it. Cap decoding by file size (as the waveform code does) and handle long files with proxies (1c).
- **Open:** drift correction and latency compensation — measure in 1b.1.
- **Confidence:** medium (several independent sources agree on the gesture and silent-switch rules; the volume/GainNode claim rests on old reports).

---

## B3. Learnings (seeded from the v1.0.0 baseline — all `verified` by reading the code)

### L-001 — iOS home-screen apps can start one status-bar too short   (2026-10-16 · iOS/PWA · verified)
**Context:** installed PWA on iPhone. **Finding:** the visible area can be mis-measured until the first scroll. The baseline fixes it by (a) keeping the page taller than the screen (`body` min-height uses `calc(100dvh + safe-top + 4px)` in standalone) and (b) scrolling 1 px and back after `load` and on every return to visible. **Evidence:** comments + scripts in `index.html`. **Impact:** don't make the page non-scrollable; keep the editor layer `position: fixed`. After editing `apple-mobile-web-app-*` meta tags, remove and re-add the Home Screen icon.

### L-002 — Distinguishing programmatic scroll from user scroll   (2026-10-16 · phone timeline · verified)
**Context:** scroll position drives the playhead *and* playback drives scroll position. **Finding:** `ScrollSync` records the `scrollLeft` it just set in `lastProg`; `onScroll` ignores events within 1.5 px of it, so only real user scrolls call `seek()`. **Evidence:** `ScrollSync`, `MobileTimeline.onScroll`. **Impact:** any future code that sets `scrollLeft` (zoom anchoring, auto-follow) must go through the same mechanism or it will create seek feedback loops.

### L-003 — Split "time" from "controls" in React context   (2026-10-16 · performance · verified)
**Context:** the frame number changes ~60×/s. **Finding:** two contexts — `FrameCtx` (frame) and `ControlCtx` (stable callbacks) — mean buttons don't re-render per frame. **Evidence:** `PlaybackProvider`. **Impact:** keep this separation; in Phase 1 go further and update the playhead imperatively (ref + `transform`) so the tree doesn't re-render at all while playing.

### L-004 — Frame advance must be time-based, not tick-based   (2026-10-16 · playback · verified)
**Finding:** the clock accumulates `elapsed × FPS` and advances by the integer part, carrying the remainder, so playback speed is correct on 30/60/120/144 Hz displays. **Impact:** don't replace with "+1 frame per rAF".

### L-005 — SVG `<use>` needs document-unique ids   (2026-10-16 · SVG · verified)
**Finding:** editor footage uses `<symbol>`s referenced by id, so `SceneDefs` must be rendered once per shell; Home's hero scenes avoid collisions by building ids from `useId`. `BrandMark`'s fixed mask id used to collide-prone — **fixed in Phase 0** (unique id per instance via `useId`). **Impact:** always derive ids from `useId` for reusable SVG.

### L-006 — Both screens are mounted during a transition   (2026-10-16 · navigation · verified)
**Finding:** for ~480 ms both layers exist; `TRANSITION_MS` must exceed the longest animation (0.46 s). The editor's `PlaybackProvider` is inside the editor layer, so **leaving the editor discards playback state**. **Impact:** project state must live *above* the editor layer — **done in Phase 0** (the store is a module singleton above the layers); playback state still resets on every editor open.

### L-007 — Safe-area insets are gated to iOS on purpose   (2026-10-16 · layout · verified)
**Finding:** `--safe-top/--safe-bottom` are only non-zero when `html.ios` is set; Android/desktop always get 0. **Impact:** use the variables, not raw `env()`, in new layout code.

### L-008 — Reduced-motion is a first-class path   (2026-10-16 · accessibility · verified)
**Finding:** transitions degrade to a quick fade; hero animations are off; Home's swap animations are wrapped in `prefers-reduced-motion: no-preference`. **Impact:** every new animation needs the same treatment.

### L-009 — Desktop timeline geometry was mock-derived — **FIXED in Phase 0**   (2026-10-16 · timeline · confirmed by arithmetic, then in a screenshot)
**Finding:** playhead origin (452 px), clip width (624 px) and audio offsets are constants chosen to match a reference picture; ruler time at the playhead ≠ timecode. The phone timeline is correct (50 % padded canvas, `scrollLeft = t × pps`). **Resolution:** Phase 0 introduced one time↔pixel function (`TimeScale`); the clips were already drawn at 22.3 px/s, so that became the single scale. Regression tests at unit and browser level. **Impact:** never hard-code a pixel position; go through `geometry.ts`.

### L-010 — PWA exists only in production builds   (2026-10-16 · tooling · verified)
**Finding:** `vite-plugin-pwa` emits the service worker during `build`; `dev` has none. Test offline with `npm run build && npm run preview`. **Verified build output:** 15 precache entries / 299 KiB.

### L-011 — Snapshot undo is cheap because of structural sharing   (2026-10-16 · state · verified)
**Finding:** commands rebuild only the changed path (`{...p, tracks: …}`), so before/after snapshots share `clips`/`assets` (a test asserts identity). **Impact:** keep commands shaped that way — a command that deep-clones the whole project would make history expensive.

### L-012 — Undo coalescing needs a barrier   (2026-10-16 · state · verified)
**Finding:** merging "same key within 600 ms" is wrong right after an undo/redo: the *older* entry now on top can look recent and swallow the next edit. The store sets a barrier after undo/redo/transaction/replace. **Evidence:** regression test in `projectStore.test.ts`; verified to fail without the barrier. **Impact:** any new history operation must set the barrier too.

### L-013 — Vitest does not type-check   (2026-10-16 · tooling · verified)
**Finding:** `tsc` found type errors in tests that Vitest happily ran. `npm run build` runs `tsc` first, which is why it caught them. **Impact:** run `npm run typecheck` (or `verify`), not just `npm test`.

### L-014 — React Testing Library: store changes outside events need `act()`   (2026-10-16 · testing · verified)
**Finding:** `store.undo()` called directly updates the store synchronously but React hasn't re-rendered; the assertion sees the old DOM. Wrap in `act(() => void store.undo())`. Events fired through `fireEvent` are already wrapped.

### L-015 — A fixture that builds new state per call makes tests pass vacuously   (2026-10-16 · testing · verified)
**Finding:** my first OPFS test used `async () => fakeRoot()` — a *new empty filesystem every call* — so "missing file → null" passed for the wrong reason. Real OPFS is one persistent root. **Impact:** when a "not found" test passes immediately, first prove the "found" case works in the same test.

### L-016 — Mutation spot-checks find weak tests   (2026-10-16 · testing · verified)
**Finding:** breaking 7 behaviours on purpose caught 6; the 7th (history barrier) exposed a test that never created the situation it claimed to cover. **Impact:** before calling a risky area "tested", change the code to be wrong and watch a test fail. The script is trivial: patch one line, run the test file, restore.

### L-017 — Prove a refactor is visually neutral with numbers, not eyes   (2026-10-16 · process · verified)
**Finding:** (a) CSS moved out of JS strings was verified by minifying old and new with esbuild and comparing (after ignoring whitespace in `calc()`/custom properties) — all four files equivalent; (b) before/after screenshots from the same headless Chromium with fixed `Math.random`, no `rAF`, reduced motion, then `pixelmatch`. A 20 % diff was immediately explained by a visible, intentional change. **Impact:** repeat this for every phase that claims "looks the same".

### L-018 — `pgrep -f` / `pkill -f` can match your own shell command   (2026-10-16 · tooling · verified)
**Finding:** `pkill -f "vite preview"` inside a command that contains that text kills the command itself. Find servers by port or by scanning `/proc` excluding your own PID. **Related:** a stale preview server on port 4173 would make Playwright (`reuseExistingServer`) test the wrong build.

### L-019 — The sandboxed Chromium needs `--no-sandbox` and must NOT use `--single-process`   (2026-10-16 · tooling · verified)
**Finding:** the Chromium from `@sparticuz/chromium` crashes when a second browser context is created if launched with its default `--single-process`; removing that flag makes Playwright work. **Impact:** only relevant to sandboxed runs (`FREECUT_CHROMIUM`); normal machines use `npx playwright install`.

### L-020 — Don't let Prettier touch `index.html`   (2026-10-16 · tooling · verified)
**Finding:** it would re-flow inline scripts whose comments and exact order matter for the iOS standalone fix. It is in `.prettierignore`. Markdown is ignored too (tables).

### L-021 — IndexedDB: resolve on transaction `complete`, not request `success`   (2026-10-16 · storage · verified)
**Finding:** a request can succeed and its transaction still abort (quota). `idb.ts` resolves on `oncomplete`, so "saved" means durable. Also: don't cache a *failed* `open()` promise, or the app can never recover when storage comes back; and `indexedDB.open` can throw synchronously (Firefox private mode).

### L-022 — Quarantine before overwrite   (2026-10-16 · storage · verified)
**Finding:** when a stored project can't be read, copy the raw record to `meta` (`quarantine:<id>:<ts>`) *before* writing the replacement, so a bug in our loader can never destroy someone's work. A test asserts the call order.

### L-023 — `requestIdleCallback` is not universal   (2026-10-16 · compatibility · assumed from general browser-support knowledge; NOT verified on a Safari device)
**Finding:** I believe Safari doesn't ship `requestIdleCallback` (re-check on caniuse/MDN). Either way the editor warm-up feature-detects it and falls back to a 1.2 s timeout. **Impact:** never call it unguarded; D-007 makes Safari a target.

### L-024 — A busy main thread silently slows everything async   (2026-10-16 · performance · verified by tracing)
**Context:** importing a 65 KB video took 5–8 s in a software-rendered browser. **Finding:** not the poster code (isolated: ~0.5 s), not IndexedDB (1–15 ms). A trace of every media-element event showed `canvas.toBlob` returning ~3.8 s late and `canplay` ~2.4 s late: the editor *opened playing*, re-rendering the timeline 60×/s, so callbacks queued behind React. Opening paused took the e2e suite from 7.1 to 3.7 minutes. **Method:** patch `document.createElement` to log `loadedmetadata/loadeddata/seeked/canplay/error` with timestamps, run the real import, read the log. **Impact:** never run heavy work while the 60 fps render loop is on; measure before optimising the wrong thing.

### L-025 — Guard every promise that depends on a browser callback   (2026-10-16 · robustness · verified)
**Finding:** `canvas.toBlob`, `video` events and `decodeAudioData` can arrive late or never (iOS is strict). Each has a timeout (`withTimeout`) and a *fallback* (no poster / no waveform / a clear message) so an import can never hang or fail because a nice-to-have failed.

### L-026 — Inject the browser, test the logic   (2026-10-16 · testing · verified)
**Finding:** `ingest.ts` takes `probe/poster/peaks/put/remove/newId/fps` as dependencies, so quota errors, half-stored files, bad files and ordering are unit-tested in milliseconds; the real decoders are exercised only by the e2e tests with real files. **Impact:** keep the DOM-touching code thin and the orchestration pure.

### L-027 — Test database upgrades with a REAL old database   (2026-10-16 · storage · verified)
**Finding:** the v1→v2 upgrade is tested twice: in Vitest (build a genuine v1 IndexedDB by hand, then open it with new code) and in Chromium (recreate a Phase 0 phone's stored state, load the app, edit, and inspect what was written: DB version 2, schema 2, name intact). **Impact:** any future `DB_VERSION` or `SCHEMA_VERSION` bump needs both.

### L-028 — The orphan sweep must be paranoid   (2026-10-16 · storage · verified)
**Finding:** deleting "unreferenced" media is the one place a bug destroys user data. The sweep (a) reads *every* project record tolerantly, including corrupt and unknown-schema ones, (b) also honours quarantined copies, (c) never deletes anything under 10 minutes old (an import stores bytes before the project references them), (d) only runs at startup when undo history is empty. Each rule has a test. **Impact:** don't loosen any of them; extend the tests when adding new places that reference media (clips with their own files, proxies…).

### L-029 — Elements outside `.ve-app` don't get its CSS variables or font   (2026-10-16 · styling · verified in a screenshot)
**Finding:** the import toast rendered in a serif font with a grey default button and a white "accent" link because it sits outside `.ve-app`, where `--text`, `--accent` and `font-family` are defined. **Impact:** anything rendered outside `.ve-app` (toasts, portals) must declare its own tokens/font. **Method:** *look at a screenshot* — no test would have caught this.

### L-030 — Don't advertise features a clip doesn't have   (2026-10-16 · UI honesty · verified)
**Finding:** the demo clip's "Effects – Edit / Filters / Adjust" chips were hard-coded; on real imported clips they implied effects that didn't exist. They now reflect the clip's data (test included). **Impact:** UI chrome must derive from the model, not from the prototype's mock.

### L-031 — Phone-only reviewing works when the app ships its own evidence   (2026-10-16 · process)
**Finding:** with only an iPhone available, the loop that works is: CI runs Playwright (Chromium + WebKit) on GitHub; the owner runs a short phone script; screenshots in `docs/phase-N/` show what to expect. **Impact:** every phase ships a phone-first review script, screenshots, and a `CHANGES.md` listing files to add/replace/delete (GitHub's web uploader accepts ≤100 files per upload and never deletes old files).

### L-032 — Playwright/ESM and the 300-second command limit   (2026-10-16 · tooling · verified)
**Finding:** the project is an ES module, so e2e specs use `fileURLToPath(import.meta.url)` instead of `__dirname`. Long suites must run in the background (`setsid nohup … &`) and be polled, because a single tool call is capped at 300 s. e2e now sets `timeout: 60 s` / `expect.timeout: 20 s` — software video decoding is slow, and tests should fail on bugs, not speed.

### L-033 — Prettier reflows code, so scripted edits must not assume line shapes   (2026-10-16 · tooling · verified three times)
**Finding:** multi-line JSX and long conditions defeat regex/single-line string replacement after a format pass (twice this phase an edit applied halfway and produced a syntax error that `tsc` caught). **Impact:** edit with anchored multi-line replacements and run `tsc` immediately after any scripted change.

### L-034 — iOS Safari and video thumbnails: what we know and what we don't   (2026-10-20 · iOS · evidence: owner's iPhone X, iOS 16; cause = hypothesis)
**UPDATE (1.2.1, verified by the owner on a real iPhone and on Android): the fix works — thumbnails now appear.** **Observed (verified):** on iPhone X / iOS 16 the 1.2.0 poster maker returned nothing for an `.mp4`, while the metadata (duration) read fine and the import succeeded. The same code worked in Chromium. **Hypothesis (not proven):** iOS ignores `preload="auto"` for a video nobody asked to play, may not paint frames for a detached element, and a seek needs decoded data. **Remedy built (1.2.1):** attach an invisible muted `playsinline` element, `play()` briefly, pause, seek, wait for a presented frame, draw; distrust blank pictures; fall back to seek-only; browser-native first-frame fallback; user-triggered retry with notes. **Impact:** the unit tests encode the *hypothesis* (an iOS-like fake that only loads frames after `play()`); only the phone can confirm it. Keep the notes — they are the instrument.

### L-035 — When you can't test a platform, make the product its own test rig   (2026-10-20 · process)
**Finding:** with an owner who has one iPhone and an assistant with none, the fastest loop is: failure → *visible reason in the UI* → owner screenshots it → targeted fix. So import warnings carry the step trail and ⋯ → Create thumbnail shows it on failure. **Impact:** any feature that depends on a browser quirk should ship with a user-visible "why it failed" path, not just a console log (an iPhone has no console).

### L-036 — A blank canvas is not a picture   (2026-10-20 · robustness · verified in tests)
**Finding:** when a browser draws no frame, `drawImage` silently leaves the canvas empty; encoding it yields a valid black JPEG that would *hide* every fallback and the retry button. `isBlankPixels` samples the result, and a blank picture is accepted only if the video really reported a decoded frame (`readyState ≥ 2`). **Impact:** validate the *output* of anything that can silently produce nothing.

### L-037 — Simulate the quirk, don't just mock the success   (2026-10-20 · testing)
**Finding:** a scriptable `FakeVideo` (events fire only after `play()`; `play()` refused; never loads; no picture size) found two real design flaws before they shipped — the black-canvas problem above and wrong error descriptions. A test that documents the *old* behaviour ("the old approach would have failed on the iOS-like video") keeps the reason for the design visible.

### L-038 — One sprite beats many images for a filmstrip   (2026-10-20 · performance/design · verified)
**Finding:** a timeline clip can have dozens of cells; giving each its own image/object URL would mean dozens of decodes and blobs. One sprite (≤24 frames, ≤2048 px wide for iOS canvas limits) is a single decode and a single URL; each cell is just CSS `background-size`/`background-position`. The maths (`cellStyle`) is pure and has a test that no cell can show a neighbouring frame. Sample the **middle** of equal slices so a cell's frame is the one at its centre.

### L-039 — Every derived blob needs a sweep rule   (2026-10-20 · storage · verified)
**Finding:** adding `${mediaId}:strip` meant adding it to `mediaKeysOfAsset` and `rawMediaKeys`; otherwise the orphan sweep (which deletes anything unreferenced after 10 minutes) would have silently deleted every filmstrip. Tests assert the strip is kept for referenced videos and removed for orphans. **Rule:** any new derived media key ⇒ update both functions and the sweep tests *in the same change*.

### L-040 — Build expensive derived media lazily, serially, once, and fail soft   (2026-10-20 · robustness)
**Finding:** filmstrips are built the first time a clip is shown (so old imports get them too), one video at a time (phones decode one comfortably), never repeated in a page load, and a failure leaves the older, simpler picture in place and logs why. **Impact:** use `requestFilmstrip`'s shape for future derived data (proxies, waveforms for video, scene cuts).

### L-041 — A one-off flaky test is a note, not a shrug   (2026-10-20 · testing)
**Finding:** the App smoke test failed once under load and then passed 9 times in a row. It's recorded as N24 so a second occurrence is recognised as a pattern; changing the test to be more tolerant without understanding it would have hidden a possible real race.

### L-042 — Never stretch a thumbnail as the main view   (2026-10-20 · quality · owner report, verified)
**Finding:** the owner said imported media looked "reduced in quality". Originals were intact; the player was showing the 320 px poster scaled up. **Rule:** thumbnails are for lists; the main view uses the original (photo) or a real decoded frame (video). Keep the small picture *underneath* as a safety net and reveal the real one only when it has loaded / been verified — then a quirky decoder degrades to "slightly soft", never to "black".

### L-043 — Chasing a moving target with one seek in flight   (2026-10-20 · performance · verified in tests)
**Finding:** seeking a native video on every playhead change piles up work on phones. `StageVideo` allows one seek at a time; when it lands it jumps straight to the *latest* requested time (skipping the ones in between). A test drives rapid target changes and asserts exactly this. **Impact:** reuse the pattern for any "follow a changing value with something slow" problem.

### L-044 — Owner's preference: one plain commit message per update   (2026-10-20 · process)
**Rule:** end every delivery with a single plain-language commit message in the chat — a short summary line a non-developer can paste, never inside a file. (See `A4`.)

### L-045 — On iOS, audio must start synchronously inside the tap   (2026-10-30 · audio/iOS · reported; unit-tested ordering)
Create/`resume()` the `AudioContext` and set `navigator.audioSession.type = "playback"` in the **first statements of the tap handler, before any `await`** — one `await` earlier and iOS may leave the context suspended (a silent first press). The Playback check does this and a unit test asserts the call order (and was mutation-checked: inserting an `await` fails it). Desktop Chrome forgives late starts, so a green desktop test proves nothing here.

### L-046 — Measure what a steady clock hides   (2026-10-30 · testing/measurement · verified)
A video clock can keep perfect real time while the picture stutters, because the browser drops frames to keep up. "Clock ran at 1.00×" alone graded a 24-fps-for-30-fps run as fine. Count **skipped frames from the frame timestamps** too (`skippedFrames`); in headless Chromium it read 0% on a light 360p clip and 19% on a heavy 720p one, so it tracks real load.

### L-047 — Reading the tool's own output beats trusting that it ran   (2026-10-30 · process · verified)
When the real toolchain isn't installable (no network), say exactly what was and wasn't run, and replace what you can with something real: a stand-in test runner, a strict `tsc` against the project's real modules, and a headless-browser end-to-end of the real code. A test harness bug (the first browser run said "no video" because the harness never re-rendered) looks exactly like an app bug until you read the output carefully.

### L-048 — A measurement that disturbs what it measures is worthless   (2026-10-31 · testing/measurement · verified)
Two traps in the first playback check. (1) Timing `drawImage(video)` printed **0.0 ms** on the iPhone: 2D canvas calls are *queued*, so the call time is the queueing time, not the copy. (2) The obvious fix — read a pixel back after every copy to force it to finish — stalled the page so much that the video itself dropped frames (22 of 90 in headless Chromium; even every 8th frame still skipped 20 of 47), so the "playing" row would have blamed the phone for the test. The honest design: judge **playback health** with the ordinary queued draws (clock, skipped frames, decoder drops) and measure **one forced-finish copy separately**, sparsely, from new frames.

### L-049 — Design the experiment so the data names the cause   (2026-10-31 · testing · verified in Chromium; awaiting the phone)
A single number (“0.42× real time”) could mean throttled-when-hidden, a slow start, or a phone that can't keep up. Rather than guess, the 1.3.1 check plays the same video **hidden → visible → hidden → visible+drawing**. slow/fast/slow = hidden video is throttled; slow/fast/fast = first-play warm-up; slow/slow/slow = can't play in real time. It also keeps the *timeline* (overall vs second-half speed, start-up delay, `waiting`/`stalled` events, decoder drops), not just an average.

### L-050 — Browser documentation goes stale; ask the device   (2026-10-31 · research · verified)
Of the iOS claims researched in 1b.0, the gesture-start rule, the `audioSession` fix and the WebCodecs/HEVC gap were all confirmed on the owner's iPhone — but “iOS ignores media-element volume” was **contradicted** (a set volume reads back). Treat old forum/doc claims as hypotheses until the Playback check has seen them, and keep designs from resting on a single stale claim.

### L-051 — Never make the picture wait on sound   (2026-11-01 · playback · verified)
The first transport design held the playhead until the audio context was running and the sound decoded — several animation frames. On a healthy machine that is invisible; on a starved runner (frames 300 ms apart) the playhead had not moved after 700 ms and the existing "> 20 frames in 0.7 s" e2e threshold would fail. The fix is structural: **start on the time clock at once and let sound join** when ready, re-anchored to the playhead. Only a *video* start waits (≤ 1.5 s), because that is where exact alignment matters.

### L-052 — Control every suspicious number against the old code   (2026-11-01 · testing · verified)
In the real-app run the desktop layout showed "frame 175 in 0.7 s" and "31 frames in 1.5 s". Running the **same script against the previous version's build** showed the same oddities (111 and 60), and a timeline of timecode updates showed 59–60 fps whenever the playhead moved in both: the single-core, software-rendered sandbox starves the page, so Playwright's wall-clock waits mean little. Without the control I would have either "fixed" a non-bug or missed that the phone layout (normal numbers) was the reliable signal. Also: run flaky-looking checks several times (4 of 4 passed after the redesign; the first two runs had failed differently each time — the signature of timing sensitivity, which here *was* a real design weakness, L-051).

### L-053 — Four small playback bugs found only by running it for real   (2026-11-01 · playback · verified)
(1) the animation-frame timestamp is not `performance.now()`, so the first frame could compute a negative offset (now one clock throughout); (2) the stall watchdog caught a clock that *never* started but not one that started and froze (now: any audio time that stops changing); (3) a clip starting at source time 0 never triggers a seek, so its video never revealed itself while playing (now: reveal when really moving); (4) a different video mounting mid-play could flash a wrong frame because its initial seek looked like movement (now: not while seeking). None of these shows in a type check or a unit test of the parts.

### L-054 — Background work must yield to playback: one phone decoder, one main thread   (2026-11-09 · playback · verified before/after in Chromium; iPhone retest pending)
First phone test of 1.4.0: sound smooth, **picture not smooth or in step, for every video**. Sound runs on its own thread; everything visual shares the main thread and the decoder. Cause found by measuring: the app builds a clip's **filmstrip** the moment the clip is first drawn in the timeline — with a *second hidden video* (24 seeks + decodes, then one large `toBlob`) — which is exactly when you press Play. On the delivered 1.4.0 the strip **finished during 11 s of playback with two videos alive**. Fix: a tiny shared "busy" gate (`engine/busy.ts`): playback *holds* it, scrolls/zooms *pulse* it; the queue and the builder wait before each step (the builder's wall-clock deadline is extended by the time waited, or a pause would leave half-empty strips), and after a long wait it lets go of its hidden video. After: the strip waits, and finishes ~5 s after pausing. Rule: **anything heavy and optional must check "is the person busy?" first.**

### L-055 — A feedback controller must not act on every sample   (2026-11-09 · playback · verified)
My picture-sync controller compared the video to the playhead every frame and set `playbackRate` each time: **177 speed changes in 5 s**, hunting between 1.00× and 1.09× (and chasing a *stale* React value). Phones can stutter on each rate change. Replaced by `engine/drift.ts`: a **dead zone** (±80 ms: touch nothing — a steady small offset is invisible), **one** held correction (±6 %) with **hysteresis** (stop within 20 ms), a minimum gap between changes, a jump only for big drift, and comparison against the **live clock** (`transport.peek`) rather than the 30 Hz screen state. Measured: **0 rate changes**, picture within **0.018 s** of the clock (was 0.057 s measured against the lagging screen value). The unit tests include a wobbling-drift case that must produce fewer than 12 decisions in 5 s of 30 fps samples.

### L-056 — Attribute the cost before optimising: zoom was style recalculation of SVG shadow trees   (2026-11-09 · performance · verified)
"Zoom is choppy" had several plausible causes (React, layout, images). The browser's own counters (`Performance.getMetrics`: Script / Layout / RecalcStyle / Task, and the `Nodes` count) settled it: per zoom step **script ≈ 5 ms, layout ≈ 2 ms, style recalculation 20–47 ms**, and `Nodes` grew **13,600 → 22,000** on a page with only ~1,300 real elements — each demo-scene filmstrip cell is `<svg><use/></svg>` and every `<use>` instantiates a whole copy of a ~500-shape drawing; zooming in creates more cells. Capping demo cells at 10 per clip: **8,200 nodes, style 1 ms, ~24 ms per step** (was 60–140). Imported video/photo cells are cheap bitmaps and were never the problem. Lesson: a *demo* feature can dominate real performance, and "the framework re-renders too much" is often the wrong first guess — measure first (my first theory, per-frame React renders, was wrong: the main thread was only 17 % busy).

### L-057 — A test that sets state and reads it back at once is a race — measure the latency to find out who is at fault   (2026-11-09 · testing · verified)
The e2e "add to timeline" test sets `scrollLeft` and *immediately* reads the timecode. On the starved sandbox it failed sometimes on **both** the delivered and the new build (2/3 vs 0/3 passes looked like a regression). Timing the real thing — `scrollLeft` set → timecode updated — gave **median 11–13 ms on both builds**, with the same slow first scroll (570–980 ms) while the page was still finishing its first render; with a settled page the first scroll cost 21 ms. So: no regression, a racy test. Before blaming a change, measure the quantity the test depends on on both builds.

### L-058 — State that must look simultaneous has to change in ONE update   (2026-11-09 · React/playback · verified)
When I throttled the on-screen frame number to ~30×/s, I made Pause show the true last frame by committing it from the playing effect's *cleanup*. React runs cleanup after the render that flipped the Pause button, so for a moment the button said "Play" while the timecode still showed the older frame, then jumped 1–2 frames — and the existing e2e check ("stays put after Pause") failed 3 runs of 3. Fix: set the frame in the **same handler, in the same batched update** as `playing = false`. Rule: if two pieces of UI must never disagree, change them together in the event handler, not in a follow-up effect. Found only because the *existing* real test was rerun against the final code, once more, after "everything" was already green.

#### R-004/R-005 follow-up — the A/B/A re-run on the owner's iPhone   (2026-10-31 · device-verified, small clip)
iPhone, iOS 16.7, Home Screen app, a 2.8 MB 576×576 clip. Hidden / visible / hidden-again / visible-with-canvas playback: clock **0.93× / 1.01× / 1.01× / 1.01×** overall (1.00× in the second half every time), picture moving after **328 / 190 / 205 / 167 ms**, skipped frames **0–1 %**, `waiting`/`stalled` **0**, decoder drops **0–1**. So the earlier 0.42× was a **first-play warm-up** (the very first play is the slowest; later ones start in ~0.2 s), **not** hidden-video throttling and **not** a slow phone. The canvas-painting run kept 30 fps. A forced-to-finish copy cost a median of 30 ms — most likely dominated by the read-back used to force it rather than the copy itself (my inference; the painting run shows copies keep up at 30 fps). Decoding that clip's sound took 119 ms; scrubbing 55 ms median; WebGL upload 1.0 ms. *Heavy clips still untested.* **Consequence for the design:** the picture can stay a normal on-screen `<video>`; starting needs a short wait for it to be really moving, then sound and playhead start together (1b.1).

#### First phone test of 1.4.0 — the owner's feedback   (2026-11-09 · device-reported; causes measured in Chromium)
Reported on the iPhone: sound smooth (also with the silent switch on), a video with imported music: music smooth; **video picture not smooth and not staying in step, for all sizes and frame rates, same with silent mode on; scrubbing the timeline and zooming very choppy.** Interpretation: audio is on its own thread and was fine; everything visual competes for the main thread and decoder. Measured on the real app (phone layout, real imported video) — **before (1.4.0):** a filmstrip builder running a second video during playback; 177 playback-speed changes per 5 s; a forced layout per frame in `ScrollSync`; 13,600–22,000 DOM nodes per zoom step. **After (1.4.1), same machine and tests:** main thread busy 17 % → 6 % while playing; speed changes 177 → 0; decoder drops 0 of 151; picture within 0.018 s of the clock; no long tasks while scrubbing (was a 467 ms `toBlob` freeze); zoom busy time 788 → 180 ms with 5 → 0 long tasks. *Not measured:* an iPhone, and heavy (1080p/4K, 60 fps) clips — the next Playback check with a big clip imported would supply those.

---

## B4. Glossary

| Term | Meaning in FreeCut |
|---|---|
| **Asset** | An imported media file (video/audio/image) plus its probed metadata. Lives in the library; clips reference it. |
| **Clip** | A placed segment on a track: which asset, where it starts on the timeline, which part of the source it uses, and its settings. |
| **Track** | A horizontal lane of clips (main video, overlay, audio, text…). |
| **Main track** | The primary video track; with the "magnet" on, gaps close automatically. |
| **Frame** | One image in time; the unit of the timeline (integer). |
| **Timecode** | `HH:MM:SS:FF` display of a frame position. |
| **FPS** | Frames per second; baseline is 60 (hard-coded); per-project later. |
| **pps** | Pixels per second on the timeline at the current zoom. |
| **Playhead** | The current-time marker; on phones it stays centred while content scrolls. |
| **Scrub** | Dragging to move through time. |
| **Ripple** | An edit that shifts later clips to close/open the gap. |
| **Trim (in/out)** | Changing which part of the source a clip uses by dragging its edges. |
| **Slip / slide** | Trim modes that move the source window within a clip / move a clip between neighbours. |
| **Snapping** | Edges/playhead/markers attracting dragged clips within a few pixels. |
| **Linkage** | Video and its detached-from audio moving/trimming together. |
| **Keyframe** | A stored value of a property at a time; values in between are interpolated. |
| **Easing** | The curve used between keyframes (linear, ease-in-out, bezier…). |
| **Blend mode** | How a layer combines with the layers below (multiply, screen, overlay…). |
| **Mask** | A shape that limits where a layer is visible. |
| **Chroma key** | Making a chosen colour (e.g. green) transparent. |
| **LUT** | Look-up table (`.cube`) that remaps colours for grading. |
| **Adjustment layer** | A layer whose effects apply to everything beneath it. |
| **Render graph** | The per-frame description of what to draw (layers, effects, transforms) shared by preview and export. |
| **Compositor** | The component that draws the render graph to a canvas (WebGL2). |
| **Demux / mux** | Splitting a media container into streams / combining streams into a container. |
| **Decode / encode** | Turning compressed video/audio into raw frames/samples / the reverse. |
| **WebCodecs** | Browser API for hardware-accelerated decode/encode (support varies — see R-001). |
| **OPFS** | Origin Private File System — fast per-site file storage in the browser. |
| **Proxy** | A low-resolution copy of a heavy file used for smooth editing; export uses the original. |
| **Master clock** | The timing source everything chases during playback (audio, from Phase 1). |
| **Command** | A pure, named project edit (`apply(project) → project`) executed through the store so it can be undone. |
| **Coalescing** | Merging rapid same-key edits (a slider drag) into one undo step. |
| **Transaction** | Several commands grouped into one undo step; rolls back if it throws. |
| **Schema version / migration** | The project file's format number, and the pure function that upgrades an older file to the next format. |
| **Quarantine** | Setting aside an unreadable saved project (never deleting it) before replacing it. |
| **TimeScale** | The single object that converts frames ⇄ pixels for the ruler, clips and playhead. |
| **Poster** | A small JPEG still of a photo/video, stored beside the file and used for tiles, the player and the timeline filmstrip. |
| **Filmstrip / sprite** | One image holding ~20 frames of a video; each timeline cell shows the frame for its own moment by offsetting into it. |
| **Peaks** | A ≤120-number summary of an audio file's loudness over time, used to draw its waveform. |
| **Stored asset** | An imported file kept in the app's media store (`source.type === "stored"`). |
| **Orphan** | A stored file that no project (including quarantined ones) references any more. |
| **Golden frame** | A reference image used by tests to prove rendering didn't change. |
| **PWA** | Progressive Web App — installable, works offline via a service worker. |
| **Rail / Sheet / Layer / Scene** | UI terms from `how_it_works.md §11`. |

---

## B5. Open questions log

Mirror of `Roadmap.md §5`.

| # | Question | Raised | Answer |
|---|---|---|---|
| Q1 | Pull a thin export forward for an early end-to-end milestone? | 2026-10-16 | **Yes** → Phase E1 |
| Q2 | Priority device/browser? | 2026-10-16 | **Safari and Chrome** (D-007) |
| Q3 | Migrate to TypeScript in Phase 0? | 2026-10-16 | **Yes** — done |
| Q4 | On-device-only AI acceptable? | 2026-10-16 | _Question was unclear; re-explained in `Roadmap.md §5`. On-device applied provisionally (D-011); confirm before Phase 5._ |
| Q5 | Keep name FreeCut + original mark? | 2026-10-16 | **Yes** |
| Q6 | English-only first, or multilingual? | 2026-10-16 | **English only** first |
