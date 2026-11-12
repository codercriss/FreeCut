# FreeCut — Handover

> Read this first if you are picking the project up cold (a new contributor, a new chat session, or future-you). It tells you **what exists, what doesn't, how to run it, what's risky, and what to do next.** Companion docs: `Roadmap.md` (plan), `how_it_works.md` (mechanics), `Knowledge_Contribution.md` (how to contribute / learnings).

| | |
|---|---|
| **Project** | FreeCut — browser-based video editor (PWA), aiming to be a free CapCut alternative |
| **Version** | **v1.4.5** — **removed** the appearance switcher (the dark / light / auto feature of 1.4.3–1.4.4); FreeCut is dark-only again, exactly the 1.4.2 look · 1.4.2 = iOS scrub-then-Play fix (sound without picture) · 1.4.1 = smoother picture, scrubbing and zoom · 1.4.0 = real playback with sound · 1.3.x = research + Playback check · 1.2.3 = full-quality player · 1.2.2 = real filmstrips · 1.2.1 = iPhone thumbnail fix · 1.2.0 = media import & library |
| **Delivered** | 2026-11-12 · 1.4.5 as a cumulative change set (17 files to replace, 4 to delete — see `CHANGES.md`; rolls back 1.4.3 + 1.4.4 entirely) · 2026-11-12 · 1.4.2 + 1.4.3 as one cumulative change set · 2026-11-09 · `freecut-phase-1b-1-1.zip` (full) and changes zip since 1.4.0 |
| **Status** | 1.4.5 built and **fully run here**: typecheck · lint · format · **459 tests in 41 files** · build, all green — the code is the 1.4.2 state plus the version/docs bump, so 1.4.2's caveat stands: the iOS scrub-then-Play fix is reasoned from the code and WebKit reports, **not yet retested on an iPhone** — your scrub-then-Play retest decides. Earlier: 1.4.1's four fixes for your first phone test still stand |
| **Next** | Your retest + the e2e log → 1b.2 (what still hurts: likely cuts, heavy clips, the filmstrip image encode) → 1c (projects, proxies, sound for long files) → Phase 2 |

---

## 1. One-paragraph summary

FreeCut is now an editor you can put **your own media** into. You can import videos, photos and audio from your device (file picker; drag-and-drop on desktop); each gets a real thumbnail, duration and (for audio) waveform; the library lets you filter, rename, delete (undoable) and **add to the timeline**; and everything survives closing the app. Imported clips show their poster image in the player — **actual playback of video and audio is Phase 1b**. Underneath: project schema **v2** (with the first real migration, proven against a genuine Phase 0 database), media stored as IndexedDB Blobs, an import pipeline that survives bad files / full storage / slow decoders, and **246 unit/component tests plus 21 real-browser specs**. Still mock: audio and the level meter, the demo footage (generated art), effects, text, stickers, transitions, export, split/delete/record. The editor now **opens paused** (it used to autoplay) — this turned out to matter: the 60 fps re-render was starving the page and slowing imports.

**What your iPhone X (iOS 16) showed, and what 1.2.1 does about it.** The video imported, was stored and landed on the timeline — but its thumbnail was a grey film icon and the player stayed black, and the duration read 00:17 where you expected about 0:13 (see N21). I couldn't reproduce the thumbnail problem here (my test browser behaves differently from iOS Safari), so 1.2.1 attacks it three ways: **(1)** a rewritten thumbnail maker built around how iOS is known to behave (attach an invisible muted video to the page, briefly *play* it so a frame is really decoded, then pause, seek and draw; distrust blank pictures; fall back to plain seeking) — tested against simulated iOS-style behaviour, but **unproven on a real iPhone**; **(2)** fallbacks when no picture can be made — the browser's own first frame is shown in the tile and the player; **(3)** diagnostics — the import box now says *why* a picture failed, and **⋯ → Create thumbnail** retries on demand and shows the step-by-step reason (screenshot it for me). Whichever way it goes, your phone will tell us exactly what iOS 16 does.

**Update (1.2.2) — your latest screenshot.** The thumbnail fix worked on your iPhone (and Android): the player now shows the real picture. You then spotted the next gap: every cell of the timeline clip repeated that *same* picture. 1.2.2 fixes it properly: the first time an imported video appears on the timeline, FreeCut builds a **filmstrip sprite** — one small image holding about 20 frames spread across the clip, built one video at a time with the same iOS-proofed approach as the thumbnail — and each timeline cell then shows the frame for *its own moment* (respecting trim and speed). It's stored beside the video, survives reloads, and if it can't be built the timeline simply keeps the single picture. The **player is still a single still image** — real moving preview and sound are Phase 1b.

**Update (1.2.3) — "the quality of an imported video or image is reduced".** Your original files were never touched (they are stored byte for byte, and the future export will use them). The softness was the **player**, which showed the small preview picture (a 320 px thumbnail) stretched to fill the screen. Now: **photos** show the original file; **videos** show a real, full-resolution frame from the original video that **follows the playhead** (silent for now); the small preview stays underneath as a safety net and is only covered once the real picture is verified. Library thumbnails (320 → 512 px, better JPEG quality) and filmstrip cells (96 → 128 px) are sharper too — for *new* imports; existing ones keep their old size (N29).

**Update (1.3.0) — find out before building.** You confirmed the 1.2.3 quality fix. Playing video *with sound, in sync* is the hardest thing so far, and iPhone Safari has quirks that are documented only in old bug reports. So this step does the research first (`Knowledge_Contribution.md` R-001/R-004/R-005) and adds a **Playback check** under **Me → Playback check** that measures the open questions on **your phone, with your own video**. What the research says: (1) the fancy WebCodecs route is not a safe base on iOS 16 (HEVC in particular is unproven, and its audio parts only arrived in Safari 26); (2) sound only starts if it is started *inside the tap*, the silent switch can mute it unless a setting is applied (iOS 16.4+), and iOS ignores a video's own volume — so per-clip volume must go through Web Audio; (3) copying video into WebGL has a history of slow paths on iOS, so start with a plain 2D canvas. The proposed design is **D-030**. **Nothing you edit or play changed** — there is still no sound; the only visible change is the new Me-tab row.

**Honest caveat for this delivery:** the sandbox this was built in had **no network**, so I could not install the project's tools. The new code was checked with a strict TypeScript compile, 56 new tests run in a stand-in runner, and — more convincingly — the **real panel and the real Home screen were exercised in a real (headless) Chromium with real videos**. What was *not* run is listed in §2f. Please check the GitHub **Actions** tab after you upload; if only the *format* step is red, it is cosmetic (N30).

**Update (1.3.1) — your report, and a sharper test.** Your first Playback-check run came back (kept in §10): the **audio side is solid** on your iPhone — sound starts from the tap, the silent-switch fix exists on your iOS, decoding your video's sound took 66 ms, and both test tones played. The research was also right that **WebCodecs can't decode HEVC** on your phone (and has no audio decoder), so playing iPhone clips stays with the browser's own `<video>`. **One result is a real problem:** a muted, hidden `<video>` played at only **0.42× real time** — and the design I proposed (D-030) draws exactly such a video to a canvas. I did not want to build the engine on a guess, and I found my own measurements were too weak to explain it (an average over 2 seconds can't tell a slow start from a slow crawl; the “copy to canvas 0.0 ms” only timed queueing; and your test clip was tiny, 1.1 MB). So **1.3.1 makes the check an A/B/A test** — the same video hidden, then visible as a small corner thumbnail, then hidden again, then visible with every frame painted to a canvas — and records a timeline, start-up delay, stalls and the decoder's own dropped-frame count, so the result itself names the cause. **Nothing you edit or play changed**; the video now briefly flashes in the top-left corner while the check runs.

**Update (1.4.0) — it plays, with sound.** Your re-run explained the mystery. Playing the same video **hidden, visible, hidden again, and visible while painting every frame to a canvas** all ran at **1.0× real time** (0–1 % skipped frames, no stalls) — so the earlier 0.42× was a **warm-up on the very first play** (the picture takes ~0.2–0.3 s to start moving, longer the first time), not throttling and not a slow phone. The picture can therefore stay an ordinary on-screen video. **What I built (Phase 1b.1):** sound is decoded once and played through Web Audio, and the **audio clock now drives the playhead**; the on-screen video really plays (muted) and is nudged to stay in step; when you press Play on a video, a short hold waits for the picture to be genuinely moving and then sound and playhead start together; the **level meter is real**; muted tracks are silent; jumping while playing, running to the end, and replaying all work. **Safety nets:** if sound can't run (no Web Audio, a suspended phone audio session, a failed decode) the playhead just keeps going on the time clock — *the picture never waits for sound* — and sound joins the moment it can. **First-cut limits** (N36): a cut to a *different* video file shows the still poster for a moment; files over 60 MB are silent until 1c; speed changes also change pitch; no per-clip volume yet. It was exercised in a real (headless) Chromium with real video and sound — 41 checks, including a video that is slow to start, one that refuses to play, and Play/Pause mashing — and the real app's Play test, but **not on an iPhone**: that is your test (§10).

**Update (1.4.1) — your first phone test, and what I found.** You told me: sound smooth (also on silent), a video with imported music smooth; **the picture is not smooth and doesn't stay in step, for every video size and frame rate; scrubbing and zooming the timeline are very choppy.** Sound running fine while everything visual is rough points at the phone's *main thread and video decoder*, not at audio. So I profiled the **real app** (phone layout, a real imported video) and measured instead of guessing — my first guess (the screen re-rendering every frame) was wrong. Four real causes: **(1) Two videos at once.** The app builds a strip of thumbnails for each new clip *in the background with a second hidden video* the moment the clip appears on the timeline — exactly when you press Play. On the delivered build that ran *during* playback (measured: two videos alive, the strip finished mid-play). It now **waits while you play, scrub or zoom**, and lets go of its hidden video if the wait is long. **(2) My picture-sync controller was hyperactive:** it changed the video's speed **177 times in 5 seconds**, and each change can make a phone's video stutter. Now: a dead zone and one gentle correction, measured against the live clock — **0 speed changes**, picture within **0.018 s** of the clock. **(3) The timeline scrolled itself with a forced layout on every frame**, and the on-screen counter re-rendered up to 60×/s: now no forced layout while playing, and the on-screen number refreshes ~30×/s (picture and sound still run at full rate). **(4) Zoom and scrub cost:** the demo footage's drawn scenes are ~500 SVG shapes *per filmstrip cell* and zooming in created dozens of cells (13,600 → 22,000 nodes); demo clips now use at most 10 cells — a zoom step went from 60–140 ms to ~24 ms — pinch re-layouts halved, and scrubbing uses Safari's fast keyframe seek while your finger moves and lands the exact frame when it stops. **What I can't promise:** all of this is measured in Chromium on a CPU-starved sandbox (a decent stand-in for a slow phone, but not an iPhone), and `fastSeek` can only be simulated there. **Your retest decides** (§10) — and a big-clip Playback check would give me real heavy-footage numbers.

**Working agreement added:** every update ends with **one plain commit message in the chat** (never in a file), written for you to paste.

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
| `npm test` · `npm run test:watch` | Vitest — 315 tests, 34 files |
| `npm run build`                                              | typecheck + `vite build` (+ PWA service worker)                                                   |
| `npm run e2e` | Playwright: Chromium + WebKit, desktop + phone (25 specs × 4 projects). First: `npx playwright install chromium webkit` |

**Deploy:** Vercel (`vercel.json` unchanged). CI: `.github/workflows/ci.yml` (verify job + e2e on Chromium and WebKit).

### Verification record (2026-10-16, clean `npm ci`)

| Check | Result |
| --- | --- |
| `npm run typecheck` · `npm run lint` · `npm run format:check` | ✔ clean |
| `npm test` | ✔ **315 passed** (34 files) — 156 at Phase 0, 246 at 1.2.0, 272 at 1.2.1, 299 at 1.2.2 |
| `npm run build` | ✔ initial JS **202.8 kB / 64.2 kB gzip** + CSS 17.6 kB; lazy editor chunk 69.3 kB / 20.2 kB gzip + CSS 29.5 kB; PWA precache 18 entries / 344 KiB |
| Playwright, **Chromium** desktop + phone | ✔ see the final run recorded in §2b below |
| Playwright, **WebKit (Safari)** | ⚠ **configured, NOT run by me** (no WebKit here). GitHub Actions runs it once the CI file is in your repo — please check the Actions tab |
| **iPhone Safari (your device)** | ✔ **Phase 0: all review steps passed.** **1.2.0 on iPhone X / iOS 16: import, storage and timeline ✔, thumbnail ✘ → fixed in 1.2.1, retest pending.** Earlier: ✔ Phase 0 — all review steps passed (incl. persistence after full close, Home-Screen install, offline, Back gesture).  |
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

#### 2c. Patch 1.2.1 run (from the extracted zip)

Run on 2026-10-20 against a clean extraction of `freecut-phase-1a-1.zip` (`npm ci` → `npm run verify` → Playwright):

| Project | Result |
|---|---|
| `chromium-desktop` + `chromium-phone` | ✔ **39 passed, 5 skipped, 0 failed** (22 specs; the skips are intentional desktop-only / phone-only tests) |
| New in this patch | *no thumbnail → browser first-frame fallback appears → Create thumbnail restores the picture* (real browser, desktop + phone) |
| `webkit-*` | ⚠ not run here — CI only |

The simulations of iOS behaviour are **unit tests against a fake video** (`poster.test.ts`) — they prove the *logic* handles a video that only loads frames after `play()`, a refused `play()`, a decoder that never loads, and blank frames. They cannot prove real iOS 16 behaves that way: **R2–R4 on your phone do.**

#### 2d. Patch 1.2.2 run (from the extracted zip)

Run on 2026-10-20 against a clean extraction of `freecut-phase-1a-2.zip` (`npm ci` → `npm run verify` → Playwright):

| Project | Result |
|---|---|
| `npm run verify` | ✔ typecheck, lint, format, **299 tests**, build (initial JS 202.9 kB / 64.2 kB gzip; lazy editor chunk 79.5 kB / 23.8 kB gzip) |
| `chromium-desktop` + `chromium-phone` | ✔ **41 passed, 5 skipped, 0 failed** (23 specs; the skips are intentional desktop-only / phone-only tests) |
| New in this patch | *the timeline filmstrip shows different frames, built from the real video* — checks distinct, time-ordered cells **and** compares real pixels of the first and last frame in the stored sprite; survives a reload (desktop + phone) |
| `webkit-*` | ⚠ not run here — CI only |

Not proven by any of this: how long the filmstrip takes on **your phones** for a long video (F2, F5) and that iOS builds it correctly — it uses the same approach that fixed the thumbnail, but only your retest can confirm.

#### 2e. Patch 1.2.3 run (from the extracted zip)

Run on 2026-10-20 against a clean extraction of `freecut-phase-1a-3.zip` (`npm ci` → `npm run verify` → Playwright):

| Project | Result |
|---|---|
| `npm run verify` | ✔ typecheck, lint, format, **315 tests**, build (initial JS 203.1 kB / 64.3 kB gzip; lazy editor chunk 81.0 kB / 24.3 kB gzip) |
| `chromium-desktop` + `chromium-phone` | ✔ **45 passed, 5 skipped, 0 failed** (25 specs; the skips are intentional desktop-only / phone-only tests) |
| New in this patch | *the player shows the ORIGINAL photo (a 1600 px image reports `naturalWidth` 1600 on top of the ≤512 px poster)* and *a real full-resolution video frame that follows the playhead* — checks `currentTime` tracks the playhead, the video is revealed, and compares pixels at 1 s vs 6 s (desktop + phone) |
| `webkit-*` | ⚠ not run here — CI only |

Not proven by any of this: how sharp and how smooth it is **on your phones**. The test video is only 320×240, so full-resolution decoding of *your* 1080p/4K clips is exactly what Q3–Q5 check.

> **How the browser tests were run here:** a headless Chromium 153 obtained from the `@sparticuz/chromium` npm package, via `FREECUT_CHROMIUM=/tmp/chromium` (see `playwright.config.ts`) — not a stock Chrome install. On your machine/CI the standard `npx playwright install` is used.

#### 2f. Delivery 1.3.0 — what was and was **not** run  ⚠ reduced verification

Run on 2026-10-30 in a sandbox **without network access**: `npm ci` could not download anything, so the project's own toolchain (vitest, ESLint, Prettier, Vite, Playwright specs) was **not available**. Instead:

| Check | Result |
|---|---|
| `npm ci` → `npm run verify` (typecheck, lint, format, **all** tests, build) and the existing Playwright specs | ✖ **not run** — first CI run is the real verification (N30) |
| TypeScript, **strict**, the project's compiler flags (global TS 6.0.3 — the project pins 5.9 — so tiny differences are possible), on the new files **plus the real project modules they import** (`mediaStore`, `poster`, `probe`, `thumbnail`, model types) and the panel against the real `useProject` signature | ✔ clean (React/lucide were type *stubs*, so JSX props aren't deeply type-checked) |
| **New unit tests: 56** (53 in `playbackCheck.test.ts`, 3 in `toneWav.test.ts`) | ✔ 56/56 — but run through a **stand-in for vitest** written for this session (covers only the matchers those two files use), **not real vitest** |
| Mutation check on the key rule (*audio starts before any `await`*) | ✔ inserting an `await` made the gesture test fail; restored → passes |
| **Real-browser end-to-end of the real `PlaybackCheckPanel` + `playbackCheckEnv`** — Playwright 1.56 / Chromium 1194, headless, software GL, **real IndexedDB**, real VP9/Opus WebM videos (with audio / silent) | ✔ all rows fill in live; *Run again* replaces rows (no duplicates); no-video and silent-video paths; Copy report puts the report on the clipboard; both test tones start; **no browser errors**. The audio unlocks from the tap *without* Chromium's autoplay-override flag. Skipped-frame measurement tracked load: 0 % on a light 360p clip, 19 % on a heavy 720p clip |
| **Real `Home`** mounted in a phone-sized (375×812, touch) Chromium with code-splitting (only the icon library stubbed) | ✔ Me tab has the new row; the panel's code is **not fetched until the row is tapped**; expand → run → collapse works; *Reset demo project* untouched; no errors |
| ESLint | ✖ not run — code written to the repo's rules and read through |
| Prettier (`format:check`) | ✖ not run — formatted by hand to `.prettierrc.json` and checked with a script (line width, groups Prettier would collapse). **If CI's format step is red it is cosmetic; send me the screenshot and I'll send corrected files** (N30) |
| Existing 315 tests, existing e2e specs, `vite build`, PWA precache | ✖ not run. Changes to existing files are tiny (`Home.tsx` +1 row/+lazy panel, `home.css` appended, version strings) and were exercised via the real-Home run above |
| `webkit-*` and **anything on iPhone Safari** | ✖ not run — that is the whole point of the Playback check |

Not proven by any of this: how your iPhone behaves. This Chromium cannot play H.264/AAC/HEVC, so test videos were WebM; the numbers it printed (copy ≈ 0.6 ms, texture upload ≈ 0.4 ms) say nothing about an A11 phone — they only prove the measurements work.

#### 2g. Delivery 1.3.1 — what was and was **not** run  ⚠ reduced verification (again)

2026-10-31, again in a sandbox **without network access** (`npm ci` impossible), so the same gap as §2f applies; N30 stays open.

| Check | Result |
|---|---|
| `npm ci` → `npm run verify`, ESLint, Prettier `format:check`, `vite build`, the existing 315 tests and Playwright specs | ✖ **not run** (N30) |
| TypeScript, **strict**, the project's flags (global TS 6.0.3), on the new files **plus the real project modules they import** | ✔ clean |
| New unit tests: now **72** (69 in `playbackCheck.test.ts`, 3 in `toneWav.test.ts`) — run through the **stand-in runner**, not real vitest | ✔ 72/72. New cases cover the A/B/A options, “throttled hidden” vs “first-play warm-up” patterns, slow-start vs steady speed, startup delay, stalls/decoder-drop printing, refused/failed runs, and the separate copy measurement |
| Real headless **Chromium** (Playwright 1.56 / Chromium 1194), the real panel and env, real IndexedDB and WebM video | ✔ the measuring `<video>` alternates 2 px/transparent ↔ 160 px/opaque and is **removed afterwards**; hidden/visible/hidden-again runs read 1.00× with 0 skipped; total ≈ 20 s; no browser errors |
| Real `Home` in a phone-sized Chromium viewport | ✔ re-run: lazy chunk fetched only on tap; expand/run/collapse; Reset row intact |
| **A measurement bug found by this run and fixed before delivery** | My first draft forced the canvas copy to finish on every frame; that stalled the page so the *video itself* dropped frames (22 of 90). Even every 8th frame skipped 20 of 47. The delivered design measures playback with ordinary queued draws and the forced-finish copy **separately** (L-048) |
| Not proven | Anything about iPhone Safari. The sandbox's software canvas is pathologically slow at pixel read-back (one forced copy took 3.7 s), so its copy/draw numbers say nothing about a phone — they only prove the tests respond to load and that the copy test is bounded (≤ 10 samples, time-limited) so it cannot hang a phone |

---

#### 2h. Delivery 1.4.0 — what was and was **not** run  ⚠ reduced verification (third time)

2026-11-01, again **without network access** (`npm ci` impossible), so N30 stays open. Unlike 1.3.x, this delivery changes the heart of the player, so more was done by other means:

| Check | Result |
|---|---|
| `npm ci` → `npm run verify`, ESLint, Prettier `format:check`, `vite build`, the existing 315 tests and Playwright specs (incl. **`webkit-*`**) | ✖ **not run** (N30). The existing `App`/`Stage` unit tests were not run; the new code is additive in `StageVideo` (all new props default off) and falls back to the old behaviour where there is no Web Audio (jsdom) |
| TypeScript, **strict**, the project's flags (global TS 6.0.3) on all new engine/diagnostics files **plus the real project modules they import**; `playback.tsx` and `Stage.tsx` against React/store type *stubs* with the real engine, model and DOM types; the real browser `AudioContext` checked structurally against the engine's `ContextLike` | ✔ clean. (Evidence the project's real TS 5.9 accepts the browser typings used: v1.3.1 — which uses them — built and deployed on Vercel, whose build runs `npm run typecheck`) |
| New unit tests: **116** = engine **44** (`audioPlan` 10, `transport` 18, `audioEngine` 16) + diagnostics **72** — run in the **stand-in runner**, not real vitest | ✔ 116/116 |
| **Real-browser engine suite** (Chromium 1194, headless): the **real** `PlaybackProvider` + `Transport` + `AudioEngine` + `Stage` + project store, a real VP9/Opus video with a 440 Hz tone and a separate 880 Hz audio clip, real IndexedDB | ✔ **41/41** — playhead starts moving **113 ms** after the tap; real speed (30 fps); picture within **0.057 s** of the playhead (mean +0.038 s); the video element is really playing (211/211 samples); sound present and starts **16 ms** from the playhead's first move; the second audio clip raises the level when it joins; Pause stops playhead *and* video; seek-while-playing lands on the new frame and the picture follows; stops by itself at the end; Play-at-end restarts; a 2× clip follows at 2.00×; muted tracks are silent but the playhead runs; **a video that is slow to start (600 ms) → the playhead waits for it and sound starts within 33 ms of it; a video that refuses to play → the clock gives up after ~1.5 s, sound still plays, no errors; rapid Play/Pause mashing ends consistent; Play from the middle**; **fallbacks:** no Web Audio at all, and an audio context that never runs — playhead and picture still run on the time clock; no browser errors anywhere |
| **Real app** (`main.tsx` bundled with the real lazy editor, desktop 1280×800 and Pixel 7 phone layouts): the existing e2e Play scenario (paused at 00:00:00:00 → Play 0.7 s → Pause → > 20 frames → stays put → second Play continues), meter drawn | ✔ 4 consecutive runs pass; phone layout **43–45 frames in ~0.7 s** (the correct rate at 60 fps) every time |
| **Control:** the same script against the *previous* version's build | Showed the same odd desktop numbers in this single-core software-rendered sandbox (L-052) — they are the sandbox, not the change; both versions advance at 59–60 fps whenever the playhead moves |
| **Bugs found by this verification and fixed before delivery** | (1) the first transport design held the playhead for sound — fragile under load → redesigned (L-051); (2) frame-timestamp vs `performance.now()` mismatch (negative first offset); (3) stall watchdog missed a clock that starts then freezes; (4) a clip at source time 0 never revealed its video while playing; (5) a different video mounting mid-play could flash a wrong frame (L-053) |
| Not proven | **Anything on an iPhone** (your test, §10); `webkit-*`; clips over 60 MB / long clips; 60 s drift; Bluetooth output; CI. No component/e2e test for the *playing* path is committed — the real-browser suite above was a throwaway harness (N39) |

#### 2i. Delivery 1.4.1 — what was and was **not** run  ⚠ reduced verification (fourth time), plus what your CI screenshots tell us

2026-11-09, no network in the build sandbox (N30). **From your Actions screenshots:** on CI #12 (v1.4.0) the first job — `npm ci`, **typecheck, lint, `format:check`, unit tests, build** — is ✔ (also ✔ on #11). So your *real* tools have now confirmed 1.4.0: ESLint, Prettier, TypeScript 5.9, the existing 315 tests **plus my 116 new ones under real vitest**, and the production build. Both **End-to-end** jobs were ✘ on #12 and in every earlier run shown (#7…#11, back to the upload commits) — see N40.

| Check | Result |
|---|---|
| `npm ci` → `npm run verify`, ESLint, Prettier, `vite build` for **1.4.1**; existing Playwright specs in CI; `webkit-*` | ✖ **not run** here (N30). The edits to `MobileTimeline.tsx` and `Clips.tsx` were read line by line and syntax-checked but **not type-checked** (their imports need the full app); `Stage.tsx` and `playback.tsx` were type-checked against React/store stubs with the real engine, model and DOM types |
| New unit tests: **24** (`busy` 8 · `drift` 8 · `transport` +2 · `filmstrip` +4 · `filmstripQueue` +2) — run in the stand-in runner together with the **existing** filmstrip/queue tests (first time those have run here) | ✔ **45/45** (filmstrip 19, queue 10, busy 8, drift 8). Mutation check: removing the deadline stretch makes the new deadline test fail |
| **Real-browser engine suite** (real Provider/Transport/AudioEngine/Stage/store, real VP9/Opus video + WAV) | ✔ **49/49** — the earlier 41 plus: picture within **0.018 s** of the *live* clock, speed never hunted (one rate seen), and **scrubbing with a simulated Safari `fastSeek`** (fast seeks used during a hard swipe, 4 for 12 jumps, no runaway loop; exact seek lands the frame after it stops) and without `fastSeek` |
| **Real app, phone layout, real imported 960×540 video** — CPU profile while playing 5 s, scrubbing 3 s, zooming ×4 in/×4 out | **Before (1.4.0) → after:** main thread busy while playing **17 % → 6 %**; playback-speed changes **177 → 0**; decoder drops 0 of 151; long tasks while scrubbing a **467 ms `toBlob` freeze → none**; zoom busy **788 ms / 5 long tasks → 180 ms / 0** |
| **Per-zoom-step attribution** (browser counters): script / layout / style / nodes | **Before:** script ≈ 5, layout ≈ 2, **style 20–47 ms**, nodes 13.6k → 22k, ~60–140 ms per step. **After:** style **1 ms**, nodes ≈ 8.2k, **~24 ms per step** |
| **Before/after on the delivered 1.4.0 build** (built from the delivered zip): filmstrip vs playback; pinch with synthetic two-finger touches | Filmstrip: **during 11 s of playing the strip finished early with 2 videos alive → now it waits** and appears ~5 s after pausing (a paused builder's hidden video is let go after 400 ms). Pinch: **30 finger events → 30 full timeline re-layouts → now 16** (the latest zoom, about every 90 ms) |
| **Your real Playwright specs** against the bundled 1.4.1 app (Chromium) | **Phone layout: 21 passed, 3 skipped (desktop-only), 1 failed. Desktop: 21 passed, 2 skipped, 2 failed.** The failures: *PWA offline* needs a service worker my bundle server lacks (artifact); *add to timeline* (phone) and *playhead sits where the timecode says* (desktop) **set a position and read the timecode with no waiting** (a race on this starved single core): in isolation the desktop one passed 3/3 on **both** builds; the phone one passed 2/3 on the delivered 1.4.0 and 0/3 on the new build, so I **measured the thing it depends on** — scroll → timecode update latency — and it is **identical on both builds (median 11–13 ms)**; the first scroll is slow only while the page is still finishing its first render. Conclusion: a racy test, not a regression (L-057) |
| **A regression in this patch, caught by your existing Play test and fixed before delivery** | To stop on the true last frame I committed it in the effect *cleanup* — which runs a moment *after* the Pause button flips — so the timecode crept forward 1–2 frames right after Pause (139 → 141, 43 → 45), and your e2e “stays put after Pause” would have failed in CI. Fixed: the final frame is committed **in the same update as `playing = false`** (`toggle`/`pause`). After the fix: the real-app Play scenario passed **5 of 5** runs (desktop + phone), engine suite 49/49, and your real **`editor.spec.ts`: phone 10 passed / 0 failed (3 skipped); desktop 11 passed / 1 failed (1 skipped)** — the one failure is *PWA offline*, which needs a service worker my bundle server lacks (L-058) |
| Not proven | **Anything on an iPhone**; heavy (1080p/4K, 60 fps) clips; real Safari `fastSeek`; `webkit-*`; whether the iPhone's first-touch scrub hitch is gone; CI for this patch |

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
   ├─ engine/    playback (provider) · transport · audioEngine · audioEngineEnv · audioPlan · videoSync · drift · busy · clock   ← 1b.1 / 1.4.1
   ├─ editor/    Editor · DesktopApp · MobileApp · TitleBar · MediaPanel · PlayerPanel · PropertiesPanel · ImportToast · shortcuts · saveLabel
   │  ├─ timeline/  geometry · Clips · TrackParts · ToggleButtons · Timeline · MobileTimeline
   │  └─ footage/   scenes (generated SVG demo art)
   ├─ home/      Home · HeroScenes · heroPick · PlaybackCheckPanel (lazy; Me tab)          ← new in 1b.0
   ├─ diagnostics/ playbackCheck (pure) · playbackCheckEnv (real browser) · toneWav                ← new in 1b.0
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
| **Playback check** (Me tab): measures audio unlock, silent-switch fix, codecs (incl. HEVC), frame timing, copy/seek/texture cost on *your* video; copyable report; two test tones | ✔ **new in 1b.0** |
| Import video / photo / audio from the device (picker; desktop drag-and-drop) | ✔ **new** |
| Real thumbnails (posters), durations, audio waveform | ✔ **new** — *video posters on iPhone Safari unverified (N10)* |
| Clear per-file errors; one bad file never blocks the rest; storage-full message | ✔ **new** |
| Media survives closing the app (IndexedDB Blobs) | ✔ **new** |
| Library: filter by type, rename, delete (+ its clips), undo | ✔ **new** |
| Library: search, sort, duplicate detection, relink | ✖ (1c) |
| Add to timeline (+ button or ⋯ menu); photos default to 5 s | ✔ **new** |
| Imported clips on the timeline with poster filmstrip; poster shown in the player | ✔ **new** |
| **Playing** imported video / audio (picture + sound) | ✔ **new in 1.4.0 (first cut)** — sound via Web Audio (audio clock = master), picture = the on-screen `<video>` kept in step; *iPhone unverified — see N36* |
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
| Play / pause / seek / scrub / timecode (drives sound and picture; falls back to a time clock if sound can't run) | ✔ |
| Timeline zoom, ruler, playhead, clips, phone scroll-sync + pinch | ✔ **M** |
| Track mute | ✔ **M** (nothing audible yet) |
| Clip selection → Properties; filter/zoom/opacity/sections/reset/delete-effect | ✔ **M** (values not applied to pixels) |
| Clip header chips reflect what the clip really has | ✔ **new** |
| Keyboard-operable sliders | ✔ |
| Split · Delete · Record · Menu · Layout · Shortcut · Export · Fit · Fullscreen · Original | ◐ buttons only |
| Position X/Y, Rotate entry; blend dropdown; keyframes; other Properties tabs | ◐ |
| Level meter | ✔ **real** (from the sound engine; flat when there is no sound — the demo project has none) |
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
| K3 | The playhead is still a React state updated every frame (it now follows the **audio clock** — 1b.1); an imperative playhead remains | later |
| K4 | **Mostly resolved (1.2.2):** imported videos get a real per-moment filmstrip. The *demo* clip still uses 90 SVG cells (it's demo art), and the **player still shows one still image** | player: 1b |
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
| N10 | **RESOLVED (1.2.1) — confirmed on your real iPhone and on Android:** video thumbnails now appear. The iOS theory (frames only decoded after `play()`) held. Kept as a note because the diagnostics (⋯ → Create thumbnail) stay in the product. |
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
| **N21** | **Duration check:** your phone showed **00:17** (17 s 57 f) for a clip you described as about 0:13. Either the clip really is ~18 s, or iOS reports a longer duration than the picture (e.g. a longer audio track) — please tell me the real length (Photos → the video). If they differ I'll investigate how the duration is read. |
| N24 | **A flaky test seen once:** the App smoke test failed once under full-suite load right after a code change, then passed in 9 consecutive runs (alone and full). Not reproduced; if it appears again, capture the assertion and send it to me. |
| N25 | **Filmstrip limits:** ~1 frame per second (max 24 per video), so zooming far in repeats frames; built lazily on first display, **one video at a time**, taking a few seconds on a phone; a long video may take longer. If it can't be built (reason is logged in the console) the timeline keeps the single poster. The sprite is small (tens of KB) and protected from the orphan sweep. |
| N27 | **Quality of the preview depends on the browser's decoder:** the video frame is drawn by the browser's own `<video>`; if it can't be verified as a real (non-blank) picture it stays hidden and the small poster remains visible. Very large photos (e.g. 48 MP) are decoded in full — heavy on older iPhones; if one fails to load you'll see the poster instead. |
| N28 | ~~While Play is on, the frame is re-seeked…like a slideshow~~ **Resolved in 1.4.0:** while playing, the video really plays (muted) and follows the playhead; seeking is only used when paused or for large drift. |
| N29 | **Existing imports keep their old thumbnail/filmstrip size** (thumbnails 320 px, filmstrip cells 96 px). New imports are sharper. To refresh an old one: delete it from the library and re-import (undo-able until you reload). |
| N26 | ~~There is still no sound and no real playing~~ **Resolved in 1.4.0** (first cut — N36 lists what is still missing). |
| N22 | Thumbnail creation now *plays the video muted for a split second* (inside an invisible 2 px element). It's silent and should be invisible; it exists because iOS may need it to decode a frame. |
| N23 | When no poster exists, the player/tile use the browser's own `<video>` first frame (reads the file's blob; fine for short clips, to be reviewed for big files in 1c). |

### New in 1b.0 (things you should know)
| ID | Note |
|---|---|
| **N30** | **Reduced verification for 1.3.0 – 1.4.1** (§2f–§2i): the project's own toolchain was not run here (no network in the build sandbox). **Update 2026-11-09:** your CI screenshots show typecheck, lint, format, the unit tests and the build **passing on 1.4.0**, which closes the gap for 1.3.x/1.4.0 except the e2e jobs (N40). For **1.4.1** the open items are: type-checking `MobileTimeline.tsx`/`Clips.tsx` (read and syntax-checked only), Prettier on the new files, and the e2e jobs. Next CI run closes them; if the first job is red, send a screenshot. |
| **N31** | **What the Playback check cannot tell:** whether a tone was *audible with the silent switch on* (code can't hear — you tell me); desktop/headless numbers are not iPhone numbers; the green/amber/red limits (`LIMITS` in `playbackCheck.ts`) are my judgement — the raw numbers are always printed and are what matter. |
| **N32** | **It measures your *largest imported video*** and plays it **muted four times (~3 s each)** plus a few seeks and uploads; during two of the runs the video **flashes in the top-left corner** (that is the A/B test, not a glitch). Audio decoding is skipped above 120 MB (it reads the whole file into memory). With no video imported the speed rows say so. **Import a heavy clip (1080p/4K, ideally HEVC from the Camera Roll) first** — your first run used a 1.1 MB, 576×640 clip, which proves little about real footage. |
| **N33** | **No in-repo component/e2e test covers the new panel** (the real-browser run in §2f was a throwaway harness, not committed). Add a Playwright spec for *Me → Playback check* when real CI is available again. |
| **N34** | ✔ **Resolved (1.3.1 re-run, 2026-10-31).** The muted video's 0.42× was a **first-play warm-up** (picture moving after ~330 ms the first time, ~170–210 ms later); hidden and visible both ran at 1.0×, even while painting every frame to a canvas. See §10 “Second device run”. |
| **N35** | **The 1.3.0 check had two weak measurements** (fixed in 1.3.1): it printed one 2-second average (can't separate slow start from slow crawl) and timed `drawImage` as 0.0 ms (queueing only). Treat those two 1.3.0 numbers as unproven. |
| **N36** | **1b.1 first-cut limits:** (a) a cut to a *different* video file shows the still poster for a moment while the next video warms up (pre-warming = 1b.2); (b) files over **60 MB play silent** (decoding reads the whole file into memory) — the picture still plays; proxies/extracted audio come in 1c; (c) clip **speed also shifts the pitch**; (d) there is **no per-clip volume** (the model has none; mute is per track); (e) overlapping sounds are simply added (can clip); (f) **edits made while playing aren't heard until the next Play** (the sound plan is made at the start); (g) Bluetooth output delay isn't compensated; (h) the first Play of a session starts a little later (the video's warm-up, ≤ ~0.5 s, then sound and playhead start together). |
| **N37** | **The meter is real now** — and **flat in the demo project**, which has no real audio (its “Audio” clip is generated, silent). Import an audio file or a video with sound to see it move. |
| **N38** | **Playback was measured in headless Chromium, not on your phone.** There, drift ≤ 0.057 s, sound within 16 ms of the playhead. iPhone numbers are what your test (§10) provides — especially a **heavy** clip, the **start-up time**, and **cuts**. |
| **N39** | **No committed test covers the *playing* path** of the Provider/Stage (the 41-check real-browser suite was a throwaway harness; the new pure parts have 44 unit tests). Add a Playwright spec that imports a short video with sound and plays it once real CI is available. |
| **N40** | **CI end-to-end jobs have been red since before this work** (every run in your screenshot, back to “Add files via upload”): the first job passes, the **End-to-end (chromium)** job fails after ~3 min and **(webkit)** after ~17 min (looks like tests timing out). I could not reproduce it here: your real specs run against my bundle of the app pass on the phone layout apart from racy/needs-service-worker tests (§2i). So it is something specific to GitHub's runners or the production build. **I need the log:** open the failed run → **End-to-end (chromium)** → the red step → screenshot the last ~30 lines (the failing test names and messages). The job also uploads a `playwright-report-…` artifact if you can open it. |
| **N41** | **First phone test of 1.4.0 (2026-11-09):** sound and music smooth; picture not smooth / not in step (every size and frame rate, also on silent); scrubbing and zoom very choppy. Causes and fixes: §1; evidence: §2i and L-054…L-057. |
| **N42** | **What 1.4.1 does *not* prove or promise:** the numbers are Chromium on a starved sandbox, not an iPhone. If the picture is *still* rough after your retest, the remaining suspects are (a) the timeline's 30×/s `scrollLeft` writes (could become a CSS transform), (b) **heavy clips** (4K/60 fps decode cost — the Playback check with a big clip tells us), (c) the filmstrip's one large image encode (`toBlob`) on the main thread, (d) the still poster at cuts (pre-warming, 1b.2). |
| **N43** | **Demo clips now draw at most 10 filmstrip tiles** (was up to 90) — fewer, wider scene tiles in the demo project; imported video/photo clips are unchanged. |
| **N44** | **Pinch zoom applies the latest zoom about every 90 ms** (~11×/s): it looks steppier than a live scale but events can no longer pile up behind slow re-layouts; the timeline does not scale continuously *during* the pinch. |
| **N45** | **While playing, the on-screen timecode and timeline scroll refresh ~30×/s** (picture and sound run at full rate; the final frame is always exact). |
| **N46** | **`fastSeek` scrubbing is untestable in Chromium** — verified only with a simulated `fastSeek` (§2i). On Safari expect: while your finger moves fast the picture shows the *nearest keyframe* (it may be slightly off), and **the exact frame lands ~0.2 s after you stop**. Browsers without `fastSeek` always seek exactly. |
| **N47** | **Filmstrip thumbnails now appear later when you are busy:** a new clip's strip waits until you stop playing/scrubbing/zooming (then takes ~5–10 s). Until then the clip shows its poster. |

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
| D-021 | 2026-10-20 | Thumbnails are made by an **attached, muted, briefly-played** `<video>` (play → pause → seek → draw), with a seek-only fallback; **blank frames are distrusted** unless a frame was really decoded | Done (hypothesis, awaiting iPhone confirmation) |
| D-022 | 2026-10-20 | When no thumbnail can be made: show the browser's own first frame, warn in the import box with the reason, and offer **⋯ → Create thumbnail** with screenshot-able diagnostics | Done |
| D-023 | 2026-10-20 | Browser quirks are modelled behind an injectable environment (`PosterEnv`) so they can be unit-tested; real behaviour is confirmed only on the owner's phone | Done |
| D-024 | 2026-10-20 | Timeline filmstrip = **one sprite per video** (≤24 frames, ≤2048 px wide, ~96 px tall cells) + layout meta, stored as `${mediaId}:strip`; cells pick the frame for their own source time (trim/speed aware) | Done |
| D-025 | 2026-10-20 | Filmstrips are built **lazily, one video at a time**, on first display; failure falls back to the poster and is logged | Done |
| D-026 | 2026-10-20 | **Every derived media key must be listed in `mediaKeysOfAsset`/`rawMediaKeys`**, or the orphan sweep deletes it | Done (rule) |
| D-027 | 2026-10-20 | The player shows the **original photo** and a **real full-resolution video frame** (native `<video>`, one seek in flight, follows the playhead); the small poster stays underneath and the video is revealed only after a non-blank frame is verified | Done |
| D-028 | 2026-10-20 | Posters 512 px / JPEG 0.82; filmstrip cells 128 px tall (new imports) | Done |
| D-029 | 2026-10-20 | **Every update ends with one plain-language commit message in the chat — never in a file** (owner's request) | Standing rule |
| D-030 | 2026-10-30 | **1b architecture:** sound = each clip decoded to an `AudioBuffer` and played through Web Audio, with `AudioContext.currentTime` as the **master clock**; picture = the video kept in step; **WebGL (R-004) and WebCodecs (R-001) deferred** | ✔ **Confirmed on the device (2026-10-31) and built in 1.4.0** — one change: the picture is an ordinary visible `<video>`, not a hidden one painted to a canvas (no need: hidden = visible = 1.0×) |
| D-031 | 2026-10-30 | **Probe before engine:** ship an in-app Playback check and measure on the owner's phone, with their own video, before building 1b.1 | Done (owner chose “Probe first”) |
| D-032 | 2026-10-30 | **Audio starts synchronously inside the tap** (iOS gesture rule): nothing may be `await`ed before the `AudioContext` is created/resumed or `audioSession` is set; unit-tested (L-045) | Standing rule |
| D-033 | 2026-10-31 | ~~Do not start 1b.1 until the A/B/A re-probe explains the muted-video speed (N34).~~ | ✔ **Resolved** — the re-run showed a first-play warm-up, not throttling; 1b.1 started |
| D-034 | 2026-10-31 | **Measure without disturbing:** playback health is judged with ordinary queued canvas draws; the forced-finish copy cost is measured separately and sparsely (L-048) | Done in 1.3.1 |
| D-035 | 2026-11-01 | **Playback as built (1b.1):** sound = decoded `AudioBuffer`s through Web Audio; the **audio clock is the master timeline** with a time-clock fallback; the on-screen `<video>` plays muted and is kept in step (±0.04 s: nothing; up to 0.5 s: speed nudge ≤ ±25 %; beyond: seek); when playback starts on a video the clock waits ≤ 1.5 s for it to be really moving, then starts sound and playhead together. **WebGL/WebCodecs deferred** | Done — iPhone-unverified |
| D-036 | 2026-11-01 | **The playhead never waits for sound** (only briefly for a video's start): it starts on the time clock at once and sound *joins* when ready (L-051) | Standing rule |
| D-037 | 2026-11-09 | **Heavy optional background work yields to the person:** a shared busy gate (`engine/busy.ts`) — playback holds it, scroll/zoom/touch pulse it; the filmstrip queue and builder wait, and the builder lets go of its hidden video after a long wait (L-054) | Done in 1.4.1 — iPhone retest pending |
| D-038 | 2026-11-09 | **The picture follows the *live clock* with a dead zone, never on every sample:** `engine/drift.ts` — ±80 ms untouched, one held ±6 % correction, jumps only beyond 450 ms; driven by the video's own frame callback (L-055) | Done in 1.4.1 |
| D-039 | 2026-11-09 | **The screen's frame number refreshes at most ~30×/s while playing** (final frame always exact); picture and sound follow the clock directly | Done in 1.4.1 |
| D-040 | 2026-11-09 | **Cheaper scrub and zoom:** demo scenes use ≤ 10 tiles; pinch applies the latest zoom ≈ every 90 ms; `ScrollSync` makes no layout read while playing; Safari `fastSeek` for fast scrubs with an exact seek once the playhead is still for 160 ms (L-056) | Done in 1.4.1 — iPhone retest pending |

---

## 8. Phase log

| Phase               | Delivered      | Zip                            | Verification | Known gaps carried forward |
| ------------------- | -------------- | ------------------------------ | ------------ | -------------------------- |
| Baseline v1.0.0     | 2026-10-16     | `freecut-baseline-docs.zip`    | build ✔      | —                          |
| **0 — Foundations** | **2026-10-16** | **`freecut-phase-0.zip`**      | §2 table     | K2 K3 K4 K9 S2 · N1–N8     |
| **1a — Media import & library** | **2026-10-20** | **`freecut-phase-1a.zip`** + `freecut-phase-1a-changes.zip` | §2 / §2b | K3 K4 K9 · N1 N3–N7 · N10–N20 |
| **1a.1 — iPhone thumbnail patch** | **2026-10-20** | **`freecut-phase-1a-1.zip`** + `freecut-phase-1a-1-changes.zip` | §2c | N21 (✔ N10 resolved) |
| **1a.2 — real filmstrips** | **2026-10-20** | **`freecut-phase-1a-2.zip`** + `freecut-phase-1a-2-changes.zip` | §2d | N21 N24–N26 |
| **1a.3 — full-quality player** | **2026-10-20** | **`freecut-phase-1a-3.zip`** + `freecut-phase-1a-3-changes.zip` | §2e | N27–N29 (retest ✔ 2026-10-30) |
| **1b.0 — research + Playback check** | **2026-10-30** | **`freecut-phase-1b-0.zip`** + `freecut-phase-1b-0-changes.zip` | **§2f (reduced)** | **N30–N33** · N26 N28 (no sound/real playing yet) |
| **1b.0.1 — A/B/A re-probe** | **2026-10-31** | **`freecut-phase-1b-0-1.zip`** + `freecut-phase-1b-0-1-changes.zip` | **§2g (reduced)** | **N34 N35** · N30 |
| **1b.1 — real playback with sound** | **2026-11-01** | **`freecut-phase-1b-1.zip`** + `freecut-phase-1b-1-changes.zip` | **§2h (reduced)** | **N36–N39** · N30 · (N26 N28 N34 resolved) |
| **1b.1 patch — smoother picture, scrub & zoom** | **2026-11-09** | **`freecut-phase-1b-1-1.zip`** + `freecut-phase-1b-1-1-changes.zip` | **§2i (reduced)** | **N40–N47** · N30 |

---

## 9. Phase delivery & review protocol

Unchanged: each phase ships the full zip (source only), updated docs, a **verification record**, a **review script**, and a **not-done list**. After review, send pass/fail per step, change requests labelled _blocking_ / _later_, answers to **[DECISION]** items, and real-device findings.
**Commit message:** every delivery ends with **one plain-language commit message in the chat** (never in a file) — owner's request.
**Zip hygiene:** no `node_modules/`, `dist/`, `dev-dist/`, `test-results/`, `playwright-report/`, `.vercel/`, `.env*.local`.

---

## 10. Review script — **iPhone Safari first**

### Now (1.4.1, ≈ 12 min): retest on your iPhone

**Before you start:** Low Power Mode **off**; volume up. Have **2–3 different videos** ready to import — different sizes and frame rates if you can (ideally one **4K** or **60 fps** clip).

| # | Do | Expect / tell me |
|---|---|---|
| P1 | **Me** tab | Shows **v1.4.1** (if not: fully close and reopen the tab/app twice) |
| P2 | **The bad case from before:** import a *new* video, add it to the timeline and press **Play straight away** (don't wait). Let it run 20+ seconds | The picture should now look like **smooth video** and stay **in step with the sound**. *Tell me:* better, same or worse than before? any stutter, jumps, drifting? |
| P3 | Same again with the **silent switch ON** | Same behaviour as P2 |
| P4 | Try your **other videos** (other sizes / frame rates / the 4K or 60 fps one) | *Tell me which, if any, still stutter:* its size, frame rate, and how it looks |
| P5 | **Pause**, then **scrub**: drag the timeline slowly, then fast, then stop | While moving the picture should keep up (it may show a nearby frame during a fast swipe); **about 0.2 s after you stop it should show the exact frame**. *Tell me if it still feels choppy* |
| P6 | **Zoom** with the +/− buttons, and with a **two-finger pinch** | Smoother than before? (Pinch now updates about 10 times a second rather than on every touch event) |
| P7 | After adding a new video, **leave the timeline alone for ~10 s** | The clip's **filmstrip thumbnails appear** (they now wait until you stop playing/scrubbing — N47) |
| P8 | *(if you can)* import your **biggest clip** (1080p/4K) and run **Me → Playback check**; **Copy report** or screenshot it | Gives me real **heavy-footage** numbers (decode, smooth-playing, copy, scrubbing) — the thing I could not measure |
| P9 | **GitHub → Actions**: the first job (typecheck…build) should be ✔. For each red **End-to-end** job: open it → the red step → **screenshot the last ~30 lines** | N40 — I need the failing test names/messages |
| P10 | If anything is still wrong, tell me **which video (size/fps), which action, and what you see**; a **screen recording** helps | |

### First phone test of 1.4.0 (2026-11-09) — results, for the record
Sound smooth (also on silent); a video with imported music: music smooth; **video picture not smooth / not staying in step — for all sizes and frame rates, also on silent; scrubbing the timeline and zooming very choppy.** → fixed as described in §1 (N41).

### First device run (1.3.0 report, 2026-10-31) — for the record
iPhone, **iOS 16.7**, Safari 16.6 UA, opened as a **Home Screen app**, 375×812 @3×. Test clip: a 1.1 MB, 576×640, 24 s `.mp4` (the largest video in the project).

| Row | Result |
|---|---|
| WebGL | ✔ WebGL 2, largest texture 16384 px |
| Web Audio unlock | ✔ running right after the tap, 48000 Hz |
| Silent-switch fix | ✔ `navigator.audioSession` present, reads back “playback” |
| Element volume | ✔ a set volume reads back 0.5 (loudness not tested; contradicts the old docs) |
| Plays video / audio (`canPlayType`) | H.264 ✔ HEVC ✔ MOV ~ VP9 ✘ AV1 ✘ · AAC ✔ MP3 ~ WAV ~ Opus ✘ FLAC ~ |
| WebCodecs | VideoDecoder ✔ VideoEncoder ✔ · AudioDecoder ✘ AudioEncoder ✘ |
| WebCodecs video decode | H.264 1080p ✔ · **HEVC 1080p ✘ · HEVC 4K ✘ (“Config is not valid”)** · VP9 ✔ · AV1 ✘ |
| Frame callback | ✔ `requestVideoFrameCallback` exists |
| Decode its sound | ✔ 24.3 s, 2 ch, **66 ms** |
| Open the video | ✔ 576×640, 24.4 s |
| **Playing smoothly** | **✘ 25 frames in 2.0 s (≈ 13 fps), video clock ran at 0.42× real time, 0 of 25 skipped** ← N34 |
| Copy to canvas | “0.0 ms” — **meaningless** (queueing only; N35) |
| Scrubbing | ✔ median 74 ms, slowest 116 ms |
| Upload to WebGL | ✔ median 1.0 ms |
| Test tones | both made a sound (silent-switch position not stated) |

### Second device run (1.3.1 report, 2026-10-31) — for the record
Same iPhone (iOS 16.7, Home Screen app). Test clip: a 2.8 MB, 576×576, 36.5 s `.mp4` — **again small** (the largest video in the project). The tones were audible with the silent switch both **ON and OFF**. Environment rows unchanged from the first run.

| Row | Result |
|---|---|
| Decode its sound | ✔ 36.4 s, 2 ch, 119 ms |
| Open the video | ✔ 576×576, 36.5 s |
| Playing (hidden video) | ✔ 83 frames / 3.0 s (≈ 28 fps) · clock **0.93×** overall, **1.00×** second half · first frame 28 ms, **moving after 328 ms** · 0 of 83 skipped · waiting 0, stalled 0 · decoder dropped 0 of 63 |
| Playing (visible video) | ✔ ≈ 30 fps · **1.01×** / 1.01× · moving after **190 ms** · 1 of 87 skipped · decoder dropped 1 of 87 |
| Playing (hidden again) | ✔ ≈ 30 fps · **1.01×** / 1.00× · moving after **205 ms** · 1 of 87 skipped |
| Playing + copy to canvas | ✔ ≈ 30 fps · **1.01×** / 1.00× · moving after **167 ms** · 1 of 87 skipped · decoder dropped 0 of 90 |
| Copy to canvas (forced to finish) | ✘ median 30 ms, slowest 50 ms (10 samples) — *a worst-case figure that includes the read-back used to force it; the row above shows per-frame copying keeps up (N35/L-048)* |
| Scrubbing | ✔ median 55 ms, slowest 158 ms |
| Upload to WebGL | ✔ median 1.0 ms |

**Reading:** hidden = visible = 1.0× → no throttling; the first-ever play is slowest (328 ms vs ~170–205 ms) → a **warm-up**, which explains the earlier 0.42×. This is what 1.4.0's “wait for the picture to be moving, then start together” is built on.

### Retest for 1.2.3 — ✔ passed (you, 2026-10-30); kept for the record

| # | Do | Expect / tell me |
|---|---|---|
| Q1 | **Me** tab | Shows **v1.2.3** (if not: fully close and reopen the tab/app twice) |
| Q2 | Add an imported **photo** to the timeline, put the playhead on it | The player shows it **sharp** (the original), not blurry. Compare with the photo in the Photos app. Tell me ✔/✘ and the photo's size (e.g. 12 MP) |
| Q3 | Put the playhead inside your imported **video** | The picture is **sharp** (full resolution of your video). Tell me ✔/✘ |
| Q4 | **Drag the timeline** back and forth over the video | The picture **changes to match the moment** (silently). **Tell me how smooth it feels** (instant / a short lag / very laggy) and your phone |
| Q5 | Press **Play** | The playhead runs and the picture follows, like a slideshow (**no sound yet** — that is Phase 1b). Does anything crash, freeze or go black? |
| Q6 | **New import:** import one more photo/video and look at its **library tile** and **timeline filmstrip** | Noticeably sharper than the older ones |
| Q7 | A **very large photo** (≥ 24 MP) if you have one | Shows, or falls back to the small picture — **tell me which and how long it took** |
| Q8 | If a video's picture ever stays **black or never appears** in the player | Tell me which video (size, length, where from). The small picture should still show underneath |



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

**Since 1.4.1:** the picture should be smoother and steadier while playing; scrubbing and zooming should be lighter; the timecode refreshes ~30×/s while playing; a new clip's filmstrip thumbnails now appear only once you stop playing/scrubbing/zooming (N43–N47). **Since 1.4.0:** **Play now really plays** — imported videos and audio play with sound, the picture is real moving video (no more slideshow), the level meter moves with the actual sound (and is flat when there is none, e.g. the demo project), muted tracks are silent, and jumping while playing re-syncs. Pressing Play on a video starts after a brief moment while the picture gets going. Files over 60 MB play picture-only; a cut to a different video file shows a still for a moment (N36). **Me → Playback check** (1.3.x) is unchanged.

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
- **iOS audio rule (D-032 / L-045):** create/`resume()` the `AudioContext` and set `audioSession.type = "playback"` in the *first statements of the tap handler, before any `await`*. Desktop Chrome forgives late starts, so a desktop test passing proves nothing about this.
- **Don't trust "the clock ran at 1.0×" as proof of smooth video** — count skipped frames too (L-046).
- **The playhead must never wait for sound** (D-036 / L-051): start on the time clock and let sound join. Anything that makes the first frame depend on audio readiness breaks under load.
- **Heavy optional work must ask "is the person busy?" first** (`engine/busy.ts`, D-037): a second hidden video decoding next to the playing one is what made 1.4.0 stutter. Any new background job (waveforms, proxies, export prep) must check the gate before starting and between steps.
- **Never act on a feedback signal every sample** (D-038 / L-055): dead zone, hysteresis, a minimum gap, and compare against the *live clock*, not a throttled React value.
- **A drawn demo scene is expensive per cell** (~500 SVG shapes each, instantiated by `<use>`): never render many; cap them (D-040).
- **One clock for the transport:** feed it `performance.now()`, never the animation-frame timestamp (they differ; L-053).
- **A desktop-layout browser test in a starved sandbox lies about wall-clock waits** — trust the phone layout / in-page timestamps, and control against the previous build (L-052).


---

## 13. Cold-start checklist

- [ ] Read this file, then `Roadmap.md §0–§4` for the phase you're on.
- [ ] `npm ci && npm run verify` — confirm green.
- [ ] `npm run dev` → New project; resize below 820 px for the phone layout.
- [ ] Skim `how_it_works.md §3–§6` before touching the model, store or storage.
- [ ] Check §6 for anything that touches your area.
- [ ] Update §4, §6, §8 (and the other docs per `Knowledge_Contribution.md A5`) when you finish.
