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
| R-001 | WebCodecs (decode + encode) | Phase 1 / 7 | Which codecs/profiles per browser incl. iOS Safari? Hardware-accelerated? Audio encode support? |
| R-002 | OPFS + IndexedDB limits | **Researched in Phase 1a** (see B2b) | Result: IndexedDB Blobs chosen for Phase 1; OPFS later. Still open: real quota numbers on target iPhones, large-file (1 GB+) behaviour, `persist()` behaviour |
| R-003 | Demux/mux libraries | Phase 1 / 7 | Which MP4/WebM/MOV demuxers & muxers are small, maintained, permissively licensed? Fragmented MP4 for streaming export? |
| R-004 | WebGL2 compositing at 4K | Phase 1 / 4 | Texture upload cost from `VideoFrame`; multi-layer budget on phones; context-loss handling |
| R-005 | Web Audio as master clock | Phase 1 | Drift handling; `AudioContext` start restrictions on iOS; latency compensation |
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
