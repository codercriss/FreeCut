# FreeCut — Handover

> Read this first if you are picking the project up cold (a new contributor, a new chat session, or future-you). It tells you **what exists, what doesn't, how to run it, what's risky, and what to do next.** Companion docs: `Roadmap.md` (plan), `how_it_works.md` (mechanics), `Knowledge_Contribution.md` (how to contribute / learnings).

| | |
|---|---|
| **Project** | FreeCut — browser-based video editor (PWA), aiming to be a free CapCut alternative |
| **Version** | **v1.2.0** — end of **Phase 1a (real media import & library)** |
| **Delivered** | 2026-10-20 · `freecut-phase-1a.zip` (full) and `freecut-phase-1a-changes.zip` (only the files that changed — see `CHANGES.md`) |
| **Status** | Phase 0 **reviewed on iPhone Safari: all 10 steps passed**. Phase 1a complete, **awaiting your phone review** (§10) |
| **Next** | Phase 1b — real preview & audio playback (research on iPhone Safari first), then 1c (projects, proxies), then Phase 2 and the thin export milestone (`Roadmap.md §3`) |

---

## 1. One-paragraph summary

FreeCut is now an editor you can put **your own media** into. You can import videos, photos and audio from your device (file picker; drag-and-drop on desktop); each gets a real thumbnail, duration and (for audio) waveform; the library lets you filter, rename, delete (undoable) and **add to the timeline**; and everything survives closing the app. Imported clips show their poster image in the player — **actual playback of video and audio is Phase 1b**. Underneath: project schema **v2** (with the first real migration, proven against a genuine Phase 0 database), media stored as IndexedDB Blobs, an import pipeline that survives bad files / full storage / slow decoders, and **246 unit/component tests plus 21 real-browser specs**. Still mock: audio and the level meter, the demo footage (generated art), effects, text, stickers, transitions, export, split/delete/record. The editor now **opens paused** (it used to autoplay) — this turned out to matter: the 60 fps re-render was starving the page and slowing imports.

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
| `npm test` · `npm run test:watch` | Vitest — 246 tests, 29 files |
| `npm run build`                                              | typecheck + `vite build` (+ PWA service worker)                                                   |
| `npm run e2e` | Playwright: Chromium + WebKit, desktop + phone (21 specs × 4 projects). First: `npx playwright install chromium webkit` |

**Deploy:** Vercel (`vercel.json` unchanged). CI: `.github/workflows/ci.yml` (verify job + e2e on Chromium and WebKit).

### Verification record (2026-10-16, clean `npm ci`)

| Check | Result |
| --- | --- |
| `npm run typecheck` · `npm run lint` · `npm run format:check` | ✔ clean |
| `npm test` | ✔ **246 passed** (29 files) — up from 156 |
| `npm run build` | ✔ initial JS **202.8 kB / 64.2 kB gzip** + CSS 17.6 kB; lazy editor chunk 69.3 kB / 20.2 kB gzip + CSS 29.5 kB; PWA precache 18 entries / 344 KiB |
| Playwright, **Chromium** desktop + phone | ✔ see the final run recorded in §2b below |
| Playwright, **WebKit (Safari)** | ⚠ **configured, NOT run by me** (no WebKit here). GitHub Actions runs it once the CI file is in your repo — please check the Actions tab |
| **iPhone Safari (your device)** | ✔ **Phase 0: all review steps passed** (incl. persistence after full close, Home-Screen install, offline, Back gesture). **Phase 1a: pending your review (§10)** — in particular *video poster generation and HEIC photos on iOS, which I cannot test* |
| DB upgrade v1 → v2 with real data | ✔ Vitest (hand-built v1 DB) **and** Chromium (recreated Phase 0 phone state → app → edit → DB version 2, schema 2, name and mute preserved) |
| **Mutation spot-check** (Phase 0) | 7 of 7 deliberately-broken behaviours caught. *Not repeated for the new Phase 1a code* — see N20 |
| Visual check | `docs/phase-1a/screenshots` shows the new screens. Screenshots were *looked at*, which caught a serif-font toast, an unstyled button and mislabelled clip chips (L-029, L-030) |

### 2b. Final browser run (from the extracted zip)

Run on 2026-10-20 against a clean extraction of `freecut-phase-1a.zip` (`npm ci` → `npm run verify` → Playwright):

| Project | Result |
|---|---|
| `chromium-desktop` + `chromium-phone` (Pixel 7 emulation) | ✔ **37 passed, 5 skipped, 0 failed** — 3.8 min. (The 5 skips are intentional desktop-only / phone-only tests.) |
| What those 21 specs cover | opening paused, play/pause, reload persistence, undo/redo, shortcuts, Back/Forward, keyboard sliders, desktop timeline geometry, phone scroll-sync, offline PWA, corrupt-project quarantine, **import of a real WebM video + WAV + PNG, a corrupt video and a text file; thumbnails/durations/waveform; add to timeline; media surviving reload; rename/delete/undo; upgrading a genuine Phase 0 database** |
| `webkit-desktop` + `webkit-phone` | ⚠ not run here — CI only |

Along the way the suite found and I fixed: a slow-import cause (editor autoplay starving the main thread, L-024), a hang risk (`toBlob` without a timeout), two selector ambiguities in my own tests, and a race in the K1b test.

> **How the browser tests were run here:** a headless Chromium 153 obtained from the `@sparticuz/chromium` npm package, via `FREECUT_CHROMIUM=/tmp/chromium` (see `playwright.config.ts`) — not a stock Chrome install. On your machine/CI the standard `npx playwright install` is used.

---

## 3. Repository map

```
freecut/
├─ index.html · vite.config.ts · tsconfig.json · tsconfig.node.json · vercel.json
├─ eslint.config.js · .prettierrc.json · .prettierignore · .gitignore        (hidden files: make sure they reach GitHub)
├─ playwright.config.ts · e2e/{helpers,editor.spec,media.spec}.ts · e2e/fixtures/ (tiny real WebM/WAV/PNG + a corrupt file + a .txt)
├─ package.json · package-lock.json · .github/workflows/ci.yml
├─ public/                 favicon + PWA icons
├─ docs/phase-0/screenshots/{before,after}/ · docs/phase-1a/screenshots/
├─ Roadmap.md · Handover.md · how_it_works.md · Knowledge_Contribution.md · CHANGES.md · README.md
└─ src/
   ├─ main.tsx · vite-env.d.ts
   ├─ app/       App · boot · bootstrap · useScreenRouter · ErrorBoundary · NavContext · actions · brand · platform · useIsMobile
   ├─ model/     types · time · defaults · selectors · sample · schema · migrations · fixtures/project.v1.json + project.v2.json   (frozen)
   ├─ store/     createStore · projectStore (history) · commands · editorStore · prefsStore · singleton · ProjectContext
   ├─ storage/   idb (DB v2) · projectRepo · autosave · opfs (skeleton)
   ├─ media/     classify · probe · thumbnail · ingest · importer · importStore · mediaStore · useMediaUrl          ← new in 1a
   ├─ engine/    clock · playback
   ├─ editor/    Editor · DesktopApp · MobileApp · TitleBar · MediaPanel · PlayerPanel · PropertiesPanel · ImportToast · shortcuts · saveLabel
   │  ├─ timeline/  geometry · Clips · TrackParts · ToggleButtons · Timeline · MobileTimeline
   │  └─ footage/   scenes (generated SVG demo art)
   ├─ home/      Home · HeroScenes · heroPick
   ├─ ui/        controls · Dialog · icons · BrandMark
   ├─ styles/    editor.css · home.css · scenes.css · transitions.css · app.css
   ├─ test/      setup · harness
   └─ util/      random
```

(`*.test.ts(x)` files sit next to the code they test.) See `how_it_works.md §1` for what each folder does and `CHANGES.md` for exactly what changed since Phase 0.

---

## 4. Feature status

✔ real · ◐ UI only · ✖ absent · **M** = driven by the project model · **new** = Phase 1a

**Media (new in 1a)**

| Feature | Status |
|---|---|
| Import video / photo / audio from the device (picker; desktop drag-and-drop) | ✔ **new** |
| Real thumbnails (posters), durations, audio waveform | ✔ **new** — *video posters on iPhone Safari unverified (N10)* |
| Clear per-file errors; one bad file never blocks the rest; storage-full message | ✔ **new** |
| Media survives closing the app (IndexedDB Blobs) | ✔ **new** |
| Library: filter by type, rename, delete (+ its clips), undo | ✔ **new** |
| Library: search, sort, duplicate detection, relink | ✖ (1c) |
| Add to timeline (+ button or ⋯ menu); photos default to 5 s | ✔ **new** |
| Imported clips on the timeline with poster filmstrip; poster shown in the player | ✔ **new** |
| **Playing** imported video / audio (picture + sound) | ✖ **Phase 1b** |
| Waveform for audio *files* (not for audio inside videos) | ✔ / ✖ |
| iPhone "add to Home Screen" tip | ✔ **new** |
| Orphan cleanup of unused media | ✔ **new** (startup + reset) |

**Shell & project (from Phase 0, unchanged unless noted)**

| Feature | Status |
|---|---|
| Home ⇄ Editor navigation, transitions, Back **and** Forward | ✔ (iPhone-verified, Phase 0) |
| Versioned project model + migrations (v1 → v2 done) | ✔ **M** |
| Autosave, truthful save indicator, quarantine of unreadable projects | ✔ |
| Undo / redo (buttons + Ctrl/Cmd+Z), coalescing, transactions | ✔ |
| **Editor opens paused at 00:00:00:00** | ✔ **new** (was autoplay) |
| PWA install / offline; iOS home-screen fixes | ✔ (iPhone-verified, Phase 0) |
| Lazy-loaded editor; error boundary | ✔ |

**Editor**

| Feature | Status |
|---|---|
| Play / pause / seek / scrub / timecode (clock only; moves the playhead) | ✔ |
| Timeline zoom, ruler, playhead, clips, phone scroll-sync + pinch | ✔ **M** |
| Track mute | ✔ **M** (nothing audible yet) |
| Clip selection → Properties; filter/zoom/opacity/sections/reset/delete-effect | ✔ **M** (values not applied to pixels) |
| Clip header chips reflect what the clip really has | ✔ **new** |
| Keyboard-operable sliders | ✔ |
| Split · Delete · Record · Menu · Layout · Shortcut · Export · Fit · Fullscreen · Original | ◐ buttons only |
| Position X/Y, Rotate entry; blend dropdown; keyframes; other Properties tabs | ◐ |
| Level meter | ◐ sine-wave fake |
| Effects, text, stickers, transitions, export | ✖ |

**Home**

| Feature | Status |
|---|---|
| Hero, tabs, actions, project card (real name/length/save state), Reset demo project | ✔ |
| "Import media" → editor with the media sheet open | ✔ (one more tap to open the picker) |
| Templates, Tools tiles, "New project" | ◐ open the editor (Phase 9) |

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

### Resolved
| ID | Was | Now |
|---|---|---|
| K2 | Editor opened **playing** | Opens **paused at 0** (Phase 1a) — and it was *the cause* of slow imports (L-024) |
| S2 | iOS standalone viewport behaviour never verified on a device | ✔ **Verified by you on iPhone Safari** (installed app, safe areas, offline) |
| N2 | OPFS write path unverified | **Decision made:** IndexedDB Blobs for Phase 1 (R-002, `Knowledge_Contribution.md B2b`); OPFS deferred |
| K1/K1b, K5–K8, K10–K12, S1 | (Phase 0 list) | Fixed in Phase 0 — see git history / earlier handover |

### Still open
| ID | Issue | Planned |
|---|---|---|
| K3 | `rAF` frame counter re-renders ~60×/s while *playing*; no audio sync | 1b |
| K4 | Clips use one poster repeated as the filmstrip (demo clip still 90 SVG cells) | 1b |
| K9 | Tablet / portrait-tablet gets the phone layout | Phase 10 |
| N1 | **WebKit (Safari) e2e unrun by me**; CI runs it | check the Actions tab |
| N3 | `transform.zoom` is a UI value, not a real scale (schema v3 later); X/Y/Rotate display-only | Phase 3 |
| N4 | Undo history is session-only | by design |
| N5 | ESLint enables only 2 react-hooks rules; the newer compiler-rule family is off | next dependency pass |
| N6 | No automated visual-regression tests | consider in 1b |
| N7 | `requestIdleCallback` may be missing in Safari — feature-detected | — |

### New in Phase 1a (things you should know)
| ID | Note |
|---|---|
| **N10** | **Video posters / HEIC photos on iOS are unverified.** Chromium e2e uses WebM (VP9/Opus) because the sandbox browser lacks H.264/HEVC. Safari plays `.mov`/HEVC natively, but iOS can be fussy about painting video frames to a canvas. If a poster can't be made the tile shows an icon and the import still succeeds. **Your review step 4–6 is the real test.** |
| N11 | Files are copied **whole** into IndexedDB (limit 2 GiB each). Big 4K clips use a lot of storage and memory — proxies and a storage screen come in 1c. |
| N12 | **Safari may clear a website's saved data after ~7 days unused; installed Home-Screen apps are exempt** (reported, not tested by us). A one-time tip shows in the Safari tab after the first import. `navigator.storage.persist()` is requested but Safari often declines. |
| N13 | Tile action buttons (+, ⋯) are 22 px on phones — usable but small; revisit with real feedback. |
| N14 | Audio waveform decoding loads the whole file into memory (skipped above 60 MB → generic placeholder). |
| N15 | No duplicate detection: importing the same file twice stores it twice. |
| N16 | Orphan sweep runs at startup and after *Reset demo project*; anything younger than 10 minutes is kept until the next start. |
| N17 | Home **Import media** can't open the file picker itself (browsers require the tap to happen on the picker's own page) — it opens the media sheet. |
| N18 | Library shows demo + imported assets together; *Reset demo project* is the way back to the clean sample. |
| N19 | Photos from iPhone Live Photos / HEIC conversion rely on Safari's picker; no in-app HEIC fallback. |
| **N20** | The mutation spot-check was done in Phase 0 only; the new import/sweep code is covered by many failure-path tests but wasn't mutation-tested. Worth a pass before 1c. |

### Strategic risks (see `Roadmap.md`)
Browser API support (WebCodecs, Web Audio start rules, texture upload) varies, **especially on iOS Safari** — Phase 1b starts with research on your iPhone; phone memory limits make proxies mandatory; on-device AI means large downloads; scope is large, so phases get split.

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
| D-015 | 2026-10-20 | Phase 0 accepted after iPhone Safari review (all steps passed) | Done |
| D-016 | 2026-10-20 | **Media stored as IndexedDB Blobs** (not OPFS) for Phase 1; revisit with a Worker write path if big files need it | Done (R-002) |
| D-017 | 2026-10-20 | **Schema v2**: `stored` asset source + `mime/bytes/peaks`; v1→v2 is a pure re-stamp migration | Done |
| D-018 | 2026-10-20 | **Editor opens paused at 00:00:00:00** (K2) | Done |
| D-019 | 2026-10-20 | Import is **one file at a time**, batch = **one undo step**; thumbnails/waveforms are best-effort | Done |
| D-020 | 2026-10-20 | Phone-first review: phase reviews are written for iPhone Safari; each delivery also ships `CHANGES.md` + a changes-only zip | Agreed (owner is phone-only) |

---

## 8. Phase log

| Phase               | Delivered      | Zip                            | Verification | Known gaps carried forward |
| ------------------- | -------------- | ------------------------------ | ------------ | -------------------------- |
| Baseline v1.0.0     | 2026-10-16     | `freecut-baseline-docs.zip`    | build ✔      | —                          |
| **0 — Foundations** | **2026-10-16** | **`freecut-phase-0.zip`**      | §2 table     | K2 K3 K4 K9 S2 · N1–N8     |
| **1a — Media import & library** | **2026-10-20** | **`freecut-phase-1a.zip`** + `freecut-phase-1a-changes.zip` | §2 / §2b | K3 K4 K9 · N1 N3–N7 · N10–N20 |

---

## 9. Phase delivery & review protocol

Unchanged: each phase ships the full zip (source only), updated docs, a **verification record**, a **review script**, and a **not-done list**. After review, send pass/fail per step, change requests labelled _blocking_ / _later_, answers to **[DECISION]** items, and real-device findings.
**Zip hygiene:** no `node_modules/`, `dist/`, `dev-dist/`, `test-results/`, `playwright-report/`, `.vercel/`, `.env*.local`.

---

## 10. Phase 1a review script — **iPhone Safari first** (≈ 20 min)

You need: the site open on your phone, a few **photos and videos in your Photos app** (a short 10–30 s clip is ideal, plus one longer clip if you have it), and an audio file in the **Files** app (a Voice Memo saved to Files, or any .m4a/.mp3).

| # | Do | Expect |
|---|---|---|
| 1 | Open the site → **Me** tab | Shows **v1.2.0**. If it still says v1.1.0: fully close the tab/app and reopen it twice (installed app: swipe it away, reopen twice) — the new version installs in the background |
| 2 | Tap **New video** (Edit tab) | Your Phase 0 edits are still there (title, any mute/opacity you changed — nothing lost in the upgrade). The timecode now reads **00:00:00:00 and is paused** (it used to autoplay) |
| 3 | Bottom bar → **Media** → **Import** → **Photo Library** → pick **one photo** | A box appears: *"Importing 1 of 1 — IMG_xxxx.HEIC"*, then *"Added 1 file to the library."* The photo appears as a tile with a **real thumbnail** and no duration badge |
| 4 | Import **one short video** | Tile shows the video's **first-frame thumbnail** and its **duration** (e.g. 00:14). *If you get a grey film-icon tile instead of a picture, tell me — that's the iOS poster issue (N10); the import should still have succeeded* |
| 5 | **Import** → **Browse** (Files) → pick your **audio file** | Tile with **waveform bars** and the duration |
| 6 | Import **3 files at once** (select several in the picker) | Progress *"Importing 2 of 3 — name"*; the app stays responsive; all three appear |
| 7 | Tap **+** on the video tile | The clip is added **after the demo clip**; total time grows. Close the sheet (✓), swipe the timeline to the new clip: the player shows the video's **still image**. (Pressing play moves the playhead but there's **no moving picture or sound yet — that's Phase 1b**) |
| 8 | Tap **⋯** on a tile → **Rename…** → type a name → Save | The tile and the timeline chip show the new name |
| 9 | **⋯** → **Delete…** on the video | Warns *"…and the 1 clip on the timeline that uses it. You can undo this."* → Delete → tile and clip vanish. Tap the **undo arrow ↶** in the player area | Both come back, thumbnail included |
| 10 | Use the **All ▾** filter (Video / Photo / Audio) | The list narrows to that type |
| 11 | **Fully close** the app/tab, reopen, **New video**, open **Media** | All your imports, thumbnails, names and timeline clips are still there |
| 12 | *(Safari tab only, not the installed app)* After the first import | A tip appears: *"add FreeCut to your Home Screen…"* with **Got it**; it never shows in the installed app |
| 13 | **Big file test:** import a **1–2 minute** video (the biggest you have; 4K is fine). Note the size (Photos → ⓘ) and time it from *Importing* to *Added* | Works without crashing; app doesn't freeze for long. **Please tell me the size, how long it took, and anything odd** — this decides how soon I need proxies |
| 14 | **Airplane mode** → open the installed app → Media | Imported media is still listed and the timeline works |
| 15 | GitHub → your repo → **Actions** tab | A CI run for the latest commit: *verify* ✔, *e2e chromium* ✔, *e2e webkit* ✔ — **webkit is the one I couldn't run**; if anything is red, send me a screenshot |
| 16 | *(Optional, desktop)* drag a video file onto the library | It imports |

**What to send back:** your iPhone model and iOS version; ✔/✘ per step; for step 13 the file size and time; screenshots of anything odd (especially a missing thumbnail or an error box).

---

## 11. Behaviour changes vs v1.1.0 (everything you'll notice)

1. **The editor opens paused at 00:00:00:00** (was: playing from 00:00:02:45).
2. **Import works.** The Import buttons (toolbar, sidebar, the phone sheet) open your file picker; desktop also accepts drag-and-drop.
3. **The library shows every asset** — now including the demo's *Audio.aac* (6 demo tiles) plus whatever you import. Filter = a native dropdown (All / Video / Photo / Audio).
4. **Tiles have two buttons:** **+** (add to timeline) and **⋯** (add / rename / delete). Always visible on touch; on hover on desktop.
5. **Imported clips** show their real **poster** in the player and as their timeline filmstrip; audio clips draw their real waveform.
6. **Clip header chips** (*Effects – Edit / Filters / Adjust*) appear only on clips that have those (the demo clip unchanged; imported clips none).
7. **New:** import progress/result box, rename/delete dialog (bottom sheet on phones), iPhone Home-Screen tip, storage-full and unreadable-file messages.
8. **Invisible but important:** database v2, project schema v2 (your saved project is upgraded in place on its first edit), orphan cleanup of unused media at startup.

Unchanged: Home, hero art, transitions, undo/redo, autosave, offline, Back/Forward, timelines, Properties.

Screenshots: `docs/phase-1a/screenshots/`.

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
- **Frozen fixtures:** never edit or regenerate `model/fixtures/project.v1.json` or `project.v2.json`; they exist to prove old projects keep loading. A new schema version gets a new frozen fixture.
- **Hero pick re-rolls at module load** — tests that touch Home should stub `Math.random`.
- **Hidden files don't upload by drag-and-drop** (`.github/`, `.gitignore`, `.prettierrc.json`, `.prettierignore`) — add them by hand on GitHub (**Add file → Create new file**, type the path). Without `.github/workflows/ci.yml` GitHub runs no tests.
- **GitHub's web uploader takes ≤ 100 files at a time and never deletes** — use `CHANGES.md` (adds/replacements/deletions) and the changes-only zip.
- **Bumping `DB_VERSION` or `SCHEMA_VERSION`:** follow the recipes in `Knowledge_Contribution.md`, freeze a new fixture, and test with a *real* old database (L-027). Never delete data in an upgrade.
- **Anything rendered outside `.ve-app`** (toasts, portals) must define its own `--text/--accent` tokens and font (L-029).
- **The media file input is `data-testid="media-file-input"`** — tests use `setInputFiles` on it (it is `hidden`).
- **Imports queue:** `importMedia` calls run one at a time; `importStore` drives the toast.
- **e2e is slow in software browsers** — timeouts are generous (60 s test / 20 s expect) on purpose; run the suite in the background when scripting (300 s tool limit).
- **Never reference media by anything but `source.mediaId`** — the orphan sweep deletes whatever no project references.


---

## 13. Cold-start checklist

- [ ] Read this file, then `Roadmap.md §0–§4` for the phase you're on.
- [ ] `npm ci && npm run verify` — confirm green.
- [ ] `npm run dev` → New project; resize below 820 px for the phone layout.
- [ ] Skim `how_it_works.md §3–§6` before touching the model, store or storage.
- [ ] Check §6 for anything that touches your area.
- [ ] Update §4, §6, §8 (and the other docs per `Knowledge_Contribution.md A5`) when you finish.
