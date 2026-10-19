# FreeCut — Handover

> Read this first if you are picking the project up cold (a new contributor, a new chat session, or future-you). It tells you **what exists, what doesn't, how to run it, what's risky, and what to do next.** Companion docs: `Roadmap.md` (plan), `how_it_works.md` (mechanics), `Knowledge_Contribution.md` (how to contribute / learnings).

| | |
|---|---|
| **Project** | FreeCut — browser-based video editor (PWA), aiming to be a free CapCut alternative |
| **Version** | **v1.1.0** — end of **Phase 0 (Foundations)** |
| **Delivered** | 2026-10-16 · `freecut-phase-0.zip` |
| **Status** | Phase 0 complete, **awaiting your review** (script in §10) |
| **Next** | Phase 1 — Real media pipeline (split 1a import/library · 1b preview/audio · 1c projects), then Phase 2, then the thin end-to-end export milestone (`Roadmap.md §3`) |

---

## 1. One-paragraph summary

FreeCut was a polished UI prototype. Phase 0 kept its look and gave it a real skeleton: the code is split into modules and fully typed (TypeScript strict); everything in the editor is read from a **versioned project model** (integer-frame time); every edit is an **undoable command** (Ctrl/Cmd+Z works; slider drags are one step); the project is **autosaved to IndexedDB** and reopened on reload (the "Saved locally at …" label is now truthful); the desktop timeline's ruler, clips and playhead finally agree; the browser Forward button works; and there is a safety net — **156 unit/component tests, 13 real-browser end-to-end tests, ESLint, Prettier, CI config and an error boundary**. What is _still_ a mock: the footage (generated SVG), audio, import, effects, text, export — those start in Phase 1.

---

## 2. Run it

**Requirements:** Node ≥ 18.18 (developed and verified on Node 22).

```bash
npm ci                 # exact versions from package-lock.json
npm run dev            # dev server (no service worker in dev)
npm run verify         # typecheck → lint → unit/component tests → production build
npm run preview        # serve dist/ — use this to test offline / PWA behaviour
npm run e2e            # Playwright (see below)
```

| Script                                                       | What it does                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                          | `tsc` on `src` (browser) and on config/e2e (Node)                                                 |
| `npm run lint` · `npm run format:check` · `npm run format`   | ESLint 9 (flat config) · Prettier                                                                 |
| `npm test` · `npm run test:watch`                            | Vitest — 156 tests, 19 files                                                                      |
| `npm run build`                                              | typecheck + `vite build` (+ PWA service worker)                                                   |
| `npm run e2e`                                                | Playwright: Chromium + WebKit, desktop + phone. First: `npx playwright install chromium webkit`  |

**Deploy:** Vercel (`vercel.json` unchanged). CI: `.github/workflows/ci.yml` (verify job + e2e on Chromium and WebKit).

### Verification record (2026-10-16, clean `npm ci`)

| Check                                              | Result                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                | ✔ no errors                                                                                                                                                                                                                                                                                                                             |
| `npm run lint`                                     | ✔ 0 errors, 0 warnings                                                                                                                                                                                                                                                                                                                  |
| `npm run format:check`                             | ✔                                                                                                                                                                                                                                                                                                                                       |
| `npm test`                                         | ✔ **156 passed** (19 files)                                                                                                                                                                                                                                                                                                             |
| `npm run build`                                    | ✔ initial JS **201.0 kB / 63.6 kB gzip** + CSS 17.6 kB; lazy editor chunk 52.7 kB / 14.4 kB gzip + CSS 25.1 kB; PWA precache 18 entries / 321 KiB. (v1.0.0: one 273.5 kB / 77.9 kB gzip bundle — initial load is **18 % smaller**.)                                                                                                    |
| Playwright, **Chromium** desktop + phone           | ✔ **22 passed, 4 skipped** (skips are intentional: desktop-only / phone-only tests) · 3.3 min                                                                                                                                                                                                                                           |
| Playwright, **WebKit (Safari)**                    | ⚠ **configured but NOT run** — no WebKit in my environment. CI runs it; please run `npx playwright install webkit && npm run e2e -- --project=webkit-desktop --project=webkit-phone` on a Mac if you can.                                                                                                                               |
| Real iPhone / Android device                       | ⚠ **not tested** — I cannot. See review step 14.                                                                                                                                                                                                                                                                                        |
| CSS equivalence                                    | ✔ the four extracted stylesheets are semantically identical to the v1.0.0 strings (compared after minification; only whitespace inside `calc()` / custom properties differs)                                                                                                                                                            |
| Pixel diff vs v1.0.0 screenshots (headless Chromium) | Home phone **0.00 %** · phone editor **0.15 %** · phone Properties **0.04 %** · desktop Home **0.09 %** · desktop editor **3.8 %** · phone Media sheet **20 %** — every difference is itemised in §11                                                                                                                                  |
| **Mutation spot-check**                            | Deliberately broke 7 behaviours (history barrier, Forward-button bug, wrong timeline scale, overlapping autosaves, accepting newer schemas, unclamped opacity, overwriting a corrupt project without quarantine). **First run caught 6 of 7** — the history-barrier test was too weak; I wrote a proper one. **Now 7 of 7 are caught.** |

> **How the browser tests were run here:** a headless Chromium 153 obtained from the `@sparticuz/chromium` npm package, via `FREECUT_CHROMIUM=/tmp/chromium` (see `playwright.config.ts`) — not a stock Chrome install. On your machine/CI the standard `npx playwright install` is used.

---

## 3. Repository map

```
freecut/
├─ index.html              iOS/PWA viewport guards, global reset (unchanged except the script path)
├─ vite.config.ts          React + PWA + __APP_VERSION__ + Vitest config
├─ tsconfig.json           browser code (src) — strict
├─ tsconfig.node.json      config + e2e (Node types)
├─ eslint.config.js · .prettierrc.json · .prettierignore · .gitignore
├─ playwright.config.ts · e2e/editor.spec.ts
├─ vercel.json · package.json · package-lock.json
├─ .github/workflows/ci.yml
├─ public/                 favicon + PWA icons
├─ docs/phase-0/screenshots/{before,after}/   v1.0.0 vs v1.1.0 (headless Chromium)
├─ Roadmap.md · Handover.md · how_it_works.md · Knowledge_Contribution.md · README.md
└─ src/                    (5,633 lines of source + 1,996 lines of tests)
   ├─ main.tsx · vite-env.d.ts
   ├─ app/       App · boot · bootstrap · useScreenRouter · ErrorBoundary · NavContext · actions · brand · platform · useIsMobile
   ├─ model/     types · time · defaults · selectors · sample · schema · migrations · fixtures/project.v1.json
   ├─ store/     createStore · projectStore (history) · commands · editorStore · prefsStore · singleton · ProjectContext
   ├─ storage/   idb · projectRepo · autosave · opfs
   ├─ engine/    clock · playback
   ├─ editor/    Editor · DesktopApp · MobileApp · TitleBar · MediaPanel · PlayerPanel · PropertiesPanel · shortcuts · saveLabel
   │  ├─ timeline/  geometry · Clips · TrackParts · ToggleButtons · Timeline · MobileTimeline
   │  └─ footage/   scenes (generated SVG)
   ├─ home/      Home · HeroScenes · heroPick
   ├─ ui/        controls · icons · BrandMark
   ├─ styles/    editor.css · home.css · scenes.css · transitions.css · app.css
   ├─ test/      setup · harness
   └─ util/      random
```

(`*.test.ts(x)` files sit next to the code they test.) See `how_it_works.md §1` for what each folder does.

---

## 4. Feature status

✔ real · ◐ UI only (visual state, nothing applied) · ✖ absent · **M** = now driven by the project model

**Shell**

| Feature                                                          | Status                                         |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| Home ⇄ Editor navigation, transitions, browser Back **and Forward** | ✔                                              |
| Random hero + headline per open                                  | ✔                                              |
| Phone vs desktop layout                                          | ✔                                              |
| PWA install / offline (incl. the lazy editor chunk)              | ✔ (verified offline in Chromium)               |
| iOS home-screen viewport fixes                                   | ✔ unchanged — **untested on a device**         |
| Error boundary + crash screen                                    | ✔ new                                          |
| Lazy-loaded editor                                               | ✔ new                                          |

**Project & data**

| Feature                                                             | Status                                                                     |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Versioned project model, integer-frame time                         | ✔ **M** new                                                                |
| Autosave to IndexedDB; reopen on reload; truthful save indicator    | ✔ new                                                                      |
| Corrupt / newer-schema project → quarantined, app still opens       | ✔ new                                                                      |
| Schema migrations runner (+ frozen v1 fixture)                      | ✔ new (no migrations needed yet)                                           |
| Undo / redo (buttons + Ctrl/Cmd shortcuts), coalescing, transactions | ✔ new                                                                      |
| Undo history across reloads                                         | ✖ by design (history is session-only)                                      |
| OPFS media store                                                    | ◐ typed skeleton, unit-tested against a fake; not exercised in a real browser |

**Editor**

| Feature                                                                                     | Status                                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Play / pause / seek / scrub / timecode                                                      | ✔ (clock only; drives generated art)                                |
| Timeline zoom; ruler; playhead; clip positions                                              | ✔ **M** — now consistent (K1b fixed)                                |
| Phone timeline centre-playhead scroll-sync, pinch zoom                                      | ✔ **M**                                                             |
| Track mute (main + audio)                                                                   | ✔ **M**, undoable, persisted (no audio yet to silence)              |
| Clip selection → Properties                                                                 | ✔ **M** (click toggles)                                             |
| Properties: filter strength, zoom, opacity sliders + ▲▼; section checkboxes; ↺ reset; delete effect | ✔ **M**, undoable, persisted — _values not yet applied to pixels_ |
| Sliders keyboard-operable                                                                   | ✔ new                                                               |
| Media library list/grid                                                                     | ✔ **M** (5 demo assets); Import / add-to-timeline ◐                 |
| Timeline toggles (magnet/snap/link/axis)                                                    | ◐ remembered per device; no behaviour yet                           |
| Position X/Y, Rotate entry; blend dropdown; keyframes; other Properties tabs                | ◐ placeholders                                                      |
| Split · Delete · Record · Menu · Layout · Shortcut · Export · Fit · Fullscreen · Original   | ◐ buttons only                                                      |
| Level meter                                                                                 | ◐ sine-wave fake                                                    |
| Real media, audio, effects, text, stickers, transitions, export                             | ✖ (Phase 1+)                                                        |

**Home**

| Feature                                | Status                                       |
| -------------------------------------- | -------------------------------------------- |
| Hero, tabs, actions                    | ✔                                            |
| Project card (name, length, save state) | ✔ **M** real; opens the persisted project    |
| Reset demo project (2-tap)             | ✔ new                                        |
| Templates, Tools tiles, "New project"  | ◐ all open the editor (Phase 9)              |

---

## 5. Conventions (keep, or change deliberately)

- **The project is data; edits are commands.** UI never mutates the project. Add a command (`store/commands.ts`), test it, then call `store.execute(cmd)`. Commands are pure, clamp their inputs, and **return the same object when nothing changes**.
- **Time is integer frames.** Convert to seconds/pixels only at the edge, via `time.ts` and `TimeScale`.
- **One geometry module** for the timeline (`editor/timeline/geometry.ts`); never hard-code pixel positions.
- **Pure logic has no React/DOM imports** so it's testable in Node.
- **CSS:** real files in `src/styles`, prefixed `ve-` / `hm-` / `fc-` / `sc-`; tokens are CSS variables (`--bg #0f0f10`, `--panel #1a1a1c`, `--line #29292c`, `--field #2a2a2d`, `--text #f4f4f5`, `--dim #a6a6ab`, `--faint #6e6e73`, `--accent #12c6d8`; accent also in `app/brand.ts`).
- **No remote assets**; **reduced motion honoured**; **seeded randomness** for generated art; **ids via `useId`** for reusable SVG.
- **Accessibility:** new controls must be keyboard-operable and labelled (sliders; toggles use `aria-pressed`).
- **Comments explain _why_.**
- **Don't run Prettier on `index.html`** (it's in `.prettierignore`) — it holds carefully commented iOS code.

---

## 6. Known issues & risks

### Resolved in Phase 0

| ID           | Was                                                                                                                                                                                              | Now                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| K1 / **K1b** | Desktop timeline: hard-coded constants; ruler, clips and playhead disagreed (confirmed in a screenshot: playhead under "01:15" while the timecode said 00:02:45)                                 | One `TimeScale`; unit-test **and** real-browser regression tests          |
| K5           | `Slider` not keyboard-operable; steppers unlabelled                                                                                                                                              | Fixed (`role=slider`, keys, labels, focus ring)                           |
| K6           | "Saved locally at 16:30:29" was static text                                                                                                                                                      | Real autosave status                                                      |
| K7 / K8      | Brand constants + mark duplicated; fixed SVG mask id                                                                                                                                             | One `brand.ts`; one `BrandMark` with `useId`                              |
| K10          | CSS injected from JS strings                                                                                                                                                                     | Real CSS files                                                            |
| K11          | No error boundary                                                                                                                                                                                | Root + editor-layer boundaries                                            |
| K12          | No tests                                                                                                                                                                                         | 156 unit/component + 13 e2e                                               |
| **S1**       | _Suspected_ Forward-button bug                                                                                                                                                                   | **Confirmed in a real browser, then fixed**; regression tests at 3 levels |

### Still open

| ID  | Issue                                                                                              | Planned                    |
| --- | -------------------------------------------------------------------------------------------------- | -------------------------- |
| K2  | Editor **opens playing** (prototype parity kept on purpose)                                        | Phase 1 (with audio clock) |
| K3  | `rAF` frame counter re-renders consumers ~60×/s; no audio sync                                     | Phase 1                    |
| K4  | Clips render up to 90 SVG `<use>` filmstrip cells                                                  | Phase 1 (real thumbnails)  |
| K9  | Tablet / portrait-tablet gets the phone layout                                                     | Phase 10                   |
| S2  | iOS standalone viewport nudge vs the editor's scroll layer — never verified on a device            | review step 14             |

### New in Phase 0 (things you should know)

| ID  | Note                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1  | **WebKit/Safari tests are configured but unrun here.** Highest-priority verification for you (D-007: Safari + Chrome are the target browsers).                                                                                         |
| N2  | **OPFS write path is unverified in real browsers.** `createWritable()` is missing in some Safari versions; `OpfsUnsupportedError` is thrown cleanly. Research note R-002 is the first task of Phase 1a.                                 |
| N3  | `transform.zoom` is the prototype's UI value, not a real scale; Phase 3 will migrate it (schema v2). Position X/Y/Rotate are display-only.                                                                                            |
| N4  | Undo history is session-only (not persisted).                                                                                                                                                                                          |
| N5  | ESLint enables only `rules-of-hooks` (error) + `exhaustive-deps` (warn); the newer React-Compiler rule family in `eslint-plugin-react-hooks` v7 is deliberately off. Revisit at the next dependency pass.                              |
| N6  | No automated **visual-regression** tests yet — screenshots were compared manually (see `docs/phase-0/screenshots`). Worth adding in Phase 1.                                                                                          |
| N7  | `window.requestIdleCallback` doesn't exist in Safari — the editor warm-up feature-detects it and falls back to a 1.2 s timeout.                                                                                                        |
| N8  | `package-lock.json` is now committed; CI uses `npm ci`.                                                                                                                                                                                 |

### Strategic risks (see `Roadmap.md`)

Browser API support (WebCodecs, OPFS, File System Access, WebGPU, MediaRecorder) varies, **especially on iOS Safari**; on-device AI means large model downloads; phone memory limits make proxies mandatory; the CapCut-class scope is large, so phases get split rather than shipped half-done.

---

## 7. Decisions log

| ID    | Date       | Decision                                                                                                   | Status                                                                                                                                                                    |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | 2026-10-16 | Build in phases; each delivery = full zip + updated docs + verification record + review script             | Agreed                                                                                                                                                                    |
| D-002 | 2026-10-16 | Docs set kept in repo root and updated every phase                                                         | Agreed                                                                                                                                                                    |
| D-003 | 2026-10-16 | Baseline docs delivered with **no code changes**                                                           | Done                                                                                                                                                                      |
| D-004 | 2026-10-16 | `Knowledge_Contribution.md` = contributor guide + living knowledge log                                     | Assumed (no objection)                                                                                                                                                    |
| D-005 | 2026-10-16 | Start with Phase 0, follow my recommendations                                                              | Agreed                                                                                                                                                                    |
| D-006 | 2026-10-16 | **Thin end-to-end export pulled forward** (right after Phase 2)                                            | Agreed (Q1)                                                                                                                                                               |
| D-007 | 2026-10-16 | **Target browsers: Safari and Chrome** (desktop + phone). Firefox/Edge best-effort                         | Agreed (Q2)                                                                                                                                                               |
| D-008 | 2026-10-16 | **TypeScript migration in Phase 0**                                                                        | Agreed, done (Q3)                                                                                                                                                         |
| D-009 | 2026-10-16 | Keep the name **FreeCut** and the original mark                                                            | Agreed (Q5)                                                                                                                                                               |
| D-010 | 2026-10-16 | **English only** first                                                                                     | Agreed (Q6)                                                                                                                                                               |
| D-011 | 2026-10-16 | AI features run **on-device** by default                                                                   | **Provisional** — Q4 was unclear; recommendation applied, to be confirmed before Phase 5 (plain-language explanation in `Roadmap.md §5`)                                  |
| D-012 | 2026-10-16 | Undo = snapshot history with structural sharing (not patches) behind a stable Command API                  | Done                                                                                                                                                                      |
| D-013 | 2026-10-16 | Editor code is a lazy chunk; Home loads without it                                                         | Done                                                                                                                                                                      |
| D-014 | 2026-10-16 | Desktop timeline geometry fixed to the prototype's own clip scale (22.3 px/s), origin 0                    | Done                                                                                                                                                                      |

---

## 8. Phase log

| Phase               | Delivered      | Zip                            | Verification | Known gaps carried forward |
| ------------------- | -------------- | ------------------------------ | ------------ | -------------------------- |
| Baseline v1.0.0     | 2026-10-16     | `freecut-baseline-docs.zip`    | build ✔      | —                          |
| **0 — Foundations** | **2026-10-16** | **`freecut-phase-0.zip`**      | §2 table     | K2 K3 K4 K9 S2 · N1–N8     |

---

## 9. Phase delivery & review protocol

Unchanged: each phase ships the full zip (source only), updated docs, a **verification record**, a **review script**, and a **not-done list**. After review, send pass/fail per step, change requests labelled _blocking_ / _later_, answers to **[DECISION]** items, and real-device findings.
**Zip hygiene:** no `node_modules/`, `dist/`, `dev-dist/`, `test-results/`, `playwright-report/`, `.vercel/`, `.env*.local`.

---

## 10. Phase 0 review script (≈ 15 min)

| #   | Do                                                                                                                                                                                                                                  | Expect                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `npm ci && npm run verify`                                                                                                                                                                                                          | typecheck ✔, lint ✔, **156 tests ✔**, build ✔                                                                                                                |
| 2   | `npm run dev`, open at desktop width → **New project**                                                                                                                                                                              | Looks like v1.0.0: title, 5-item library, player, Properties; timecode starts **00:00:02:45** and counts (it still opens playing — K2)                       |
| 3   | Pause. Look at the timeline                                                                                                                                                                                                         | The playhead sits under the ruler's **00:02** mark and matches the timecode. Drag the **zoom slider**: ruler, clips and playhead scale together              |
| 4   | Click the **speaker icon** on the main track                                                                                                                                                                                        | Icon dims. **Undo** (↶) in the timeline toolbar becomes enabled                                                                                              |
| 5   | Press **Ctrl/Cmd+Z**, then **Ctrl/Cmd+Shift+Z**                                                                                                                                                                                     | Un-mutes, re-mutes                                                                                                                                           |
| 6   | In Properties, **drag the Opacity slider** around, release, click **Undo once**                                                                                                                                                     | The _whole drag_ is undone in one step (back to 100 %)                                                                                                       |
| 7   | **Tab** to a slider, use ←/→, Shift+←/→, Home/End                                                                                                                                                                                   | It moves, announces its value, shows a focus ring                                                                                                            |
| 8   | Untick **Effects**; click **↺** on Filters/Effects/Blend; click the **trash** next to _Motion Blur_, then ↺ on Effects                                                                                                              | Section dims; resets work; the effect disappears and ↺ restores it                                                                                           |
| 9   | Mute something, wait ~1 s, watch the title bar; then **reload (F5)** → New project                                                                                                                                                  | Label shows _Saved locally at hh:mm:ss_; the mute **is still there**; Undo is disabled (history is session-only)                                             |
| 10  | DevTools → Application → IndexedDB → `freecut` → `projects`                                                                                                                                                                         | One `sample-project` record with your edit; `meta` holds `lastProjectId`                                                                                     |
| 11  | Click **Back to home**, then the browser **Back** then **Forward** buttons                                                                                                                                                          | Back → Home, **Forward → editor** (was broken in v1.0.0)                                                                                                     |
| 12  | Resize below 820 px (or DevTools device mode): scroll the timeline sideways; tap **Edit**; try Undo/Redo in the player; mute a track                                                                                                | Timecode follows the scroll; same model, same undo                                                                                                           |
| 13  | Console: `indexedDB.open('freecut').onsuccess=e=>{const t=e.target.result.transaction('projects','readwrite');t.objectStore('projects').put({id:'sample-project',schemaVersion:1,clips:'garbage'})}` → reload                       | Amber bar _"…could not be opened… copy was kept as quarantine:…"_; the app still opens; the bad record is under `meta`                                       |
| 14  | **On real devices:** iPhone Safari, the installed iPhone PWA, Safari on Mac, Android Chrome — repeat steps 2, 9, 11, 12                                                                                                             | Same results; status bar/safe areas look right; **edits survive a reload** in the installed PWA. _This is the step I cannot do._                              |
| 15  | `npm run build && npm run preview`; load once; DevTools → Network → **Offline**; reload; open the editor                                                                                                                            | Works offline (editor chunk comes from the cache)                                                                                                            |
| 16  | Home → **Reset demo project** (tap twice) → New project                                                                                                                                                                             | Fresh sample, your edits gone                                                                                                                                |
| 17  | _(optional)_ `npx playwright install chromium webkit && npm run e2e`                                                                                                                                                                | 13 tests × 4 projects pass (some skipped by design)                                                                                                          |

---

## 11. Behaviour changes vs v1.0.0 (everything you'll notice)

**Intentional, visible**

1. **Desktop timeline is now truthful.** Ruler labels appear every 2 s at default zoom (was every 10 s, unrelated to the clips); the playhead starts at the 00:02 mark (was at an arbitrary x); the scrollable length is `max(60 s, duration + 30 s)` (was a fixed 600 s). **Clips are in exactly their old positions and widths** (video 624 px, audio at 117 px / 224 px).
2. **Library shows 5 items, not 4:** the timeline's own clip (_Moraine Lake.mov_) is now an asset like any other, listed first. This is why the phone Media sheet differs by 20 % of pixels (everything shifts one tile).
3. **Clip chips show real data:** the asset name (_Moraine Lake.mov_, was the placeholder _Name.mov_) and its duration (_00:00:27_, was _00:00:00_).
4. **Save indicator is real** (last save time; _Saving…_ / error states with amber/red dot).
5. **Undo / Redo are real**, disabled when there's nothing to do (they were always-enabled no-ops).
6. **Properties edits are real** (persist, undo); the first selected clip drives the panel; deselect → _"Select a clip to edit its properties"_. Section ↺ and the _effect delete_ now work. Audio clips show an outline when selected.
7. **Timeline toggles are remembered** between sessions.
8. **New:** _Reset demo project_ (Me tab on phone, sidebar on desktop); amber warning bar if storage is unavailable / a project was set aside; crash screen instead of a blank page; Ctrl/Cmd+Z shortcuts; keyboard-operable sliders.
9. **Browser Forward works** (S1).
10. The editor + its CSS load as a **separate chunk** (prefetched on idle).

**Unchanged:** Home layout, hero scenes/headlines, phone layouts (0.00–0.15 % pixel difference — only the save time and the greyed undo/redo), transitions, PWA, iOS handling, Properties/Player/Title bar look.

Screenshots: `docs/phase-0/screenshots/before` (v1.0.0) vs `after` (v1.1.0).

---

## 12. Gotchas

- **PWA only exists in `build`.** `npm run dev` registers no service worker; after a deploy the new worker takes over on next launch/reload.
- **iOS home-screen changes need re-adding the icon** after editing `apple-mobile-web-app-*` meta tags.
- **`lucide-react` is pinned to `0.383.x`** (icon names).
- **`TRANSITION_MS` (480) must exceed the longest animation in `transitions.css`** (0.46 s).
- **Editor layer must stay `position: fixed`** (iOS viewport workaround).
- **Both screens are mounted for ~480 ms during a transition;** project state lives above the layers, playback state does not (it resets every time the editor opens).
- **Component tests:** wrap store changes in `act()` (`act(() => void store.undo())`) or the DOM is stale. Use `test/harness.tsx` for a fresh store + providers.
- **`tsc` type-checks tests; Vitest doesn't** — run `npm run typecheck`, not just `npm test`.
- **Playwright matches names by substring** — use `exact: true` ("Play" also matches "Player menu").
- **Stale preview servers:** if something is already on port 4173, Playwright's `reuseExistingServer` will happily test the _wrong build_. Stop it first.
- **Frozen fixture:** never regenerate `model/fixtures/project.v1.json`; it exists to prove old projects keep loading.
- **Hero pick re-rolls at module load** — tests that touch Home should stub `Math.random`.

---

## 13. Cold-start checklist

- [ ] Read this file, then `Roadmap.md §0–§4` for the phase you're on.
- [ ] `npm ci && npm run verify` — confirm green.
- [ ] `npm run dev` → New project; resize below 820 px for the phone layout.
- [ ] Skim `how_it_works.md §3–§6` before touching the model, store or storage.
- [ ] Check §6 for anything that touches your area.
- [ ] Update §4, §6, §8 (and the other docs per `Knowledge_Contribution.md A5`) when you finish.
