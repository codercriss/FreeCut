# How FreeCut works

> **Scope:** the mechanics of the app **as built at v1.4.1 (Phase 1a + iPhone thumbnail fix + real filmstrips + full-quality player + the 1b.0 Playback check + 1b.1 real playback with sound)**. Verified by reading the source, by 315 unit/component tests (v1.2.3; the 56 added in 1b.0 were run in a stand-in runner — see `Handover.md §2f`), by Chromium end-to-end runs with real video/audio/photo files, and (for the Phase 0 base) by hand on iPhone Safari.
> This file is **rewritten as the architecture changes** — every phase updates the relevant sections, so it always describes what is actually in the zip, not what we hope for.
> Companions: `Handover.md` (status, issues, review script), `Roadmap.md` (plan), `Knowledge_Contribution.md` (how to contribute, learnings).

---

## 1. The big picture

```
index.html ─► src/main.tsx ─► <ErrorBoundary><App/></ErrorBoundary>
                                   │
        boot() ── load or create the project, start autosave ──┐   (renders a blank #0f0f10 until ready)
                                   │                           │
             ┌─────────────────────┴───────────┐               ▼
             ▼                                 ▼        ┌─────────────────────────────┐
        <Home/>                        <EditorHost/>    │  Project store (singleton)  │
   hero art · project card             PlaybackProvider │  project + undo/redo history│
                                       └ <Editor/> (lazy chunk)      ▲ commands   │ subscribe
                                          ├ DesktopApp ─┐            │            ▼
                                          └ MobileApp ──┴─ panels ───┘     ┌──────────────┐
                                  TitleBar · MediaPanel · PlayerPanel ·    │ Autosave     │──► IndexedDB
                                  Timeline/MobileTimeline · Properties     │ (debounced)  │    (projects, meta)
                                                                           └──────────────┘
```

- **Stack:** React 18 + TypeScript (strict), Vite 6, `lucide-react`, `vite-plugin-pwa` (Workbox). No router, no state library, no CSS framework.
- **The project is data.** Everything visible in the editor (library, clips, track mute state, property values, title, durations) is read from one JSON-serialisable project; edits go through **commands**; undo/redo and persistence hang off the same store.
- **One component tree, two layouts.** Panels are shared; the shell around them differs for desktop vs phone.
- **Local-first, no backend.** No network calls at runtime. Storage is IndexedDB: the project **and** imported media files (as Blobs). OPFS stays an unused skeleton (see §5).

### Source map (v1.4.1)

| Folder | What lives there |
|---|---|
| `src/app/` | Root `App`, boot + bootstrap, screen router, error boundary, nav context, brand constants, platform flags, `useIsMobile` |
| `src/model/` | **Project model v1**: `types`, `time`, `defaults`, `selectors`, `sample` project, `schema` validator, `migrations` runner, frozen `fixtures/` |
| `src/store/` | `createStore` + `useStore`, **`projectStore`** (history), `commands`, `editorStore` (selection), `prefsStore`, React context hooks |
| `src/storage/` | `idb` wrapper (DB v2), `projectRepo`, `autosave`, `opfs` skeleton |
| `src/media/` | **Phase 1a import pipeline:** `classify`, `probe`, `poster` (video → picture logic), `thumbnail` (posters + waveform), `filmstrip` + `filmstripQueue` + `useFilmstrip` (timeline filmstrips), `ingest`, `importer`, `importStore`, `mediaStore` (+ orphan sweep), `useMediaUrl` |
| `src/engine/` | Playback: `playback` (the provider; React), `transport` (where the playhead is — pure state machine, incl. a read-only `peek`), `audioEngine` (decode, cache, schedule, meter — takes injected Web Audio), `audioEngineEnv` (the real wiring), `audioPlan` (pure: which sounds play when), `videoSync` (hand-off between picture and clock), `drift` (pure: keep the playing picture in step — dead zone + hysteresis), `busy` (pure: “is the person playing/scrubbing/zooming?” so background work waits), `clock` (older pure `advance`, now unused by the app) |
| `src/editor/` | Editor shell + panels; `timeline/` (geometry, ruler, clips, desktop + phone timelines); `footage/` (generated SVG scenes) |
| `src/home/` | Home screen, hero scenes, hero-pick logic, and the lazily loaded **`PlaybackCheckPanel`** (Me tab) |
| `src/diagnostics/` | **Phase 1b.0 Playback check:** `playbackCheck` (pure: types, grading, the runner — all browser access goes through an injected `PlaybackEnv`), `playbackCheckEnv` (the real browser calls), `toneWav` (test-tone generator) |
| `src/ui/` | Shared controls (`Slider`, `NumberBox`, …), custom icons, `BrandMark` |
| `src/styles/` | Real CSS files: `editor`, `home`, `scenes`, `transitions`, `app` |
| `src/test/` | Test setup + `harness` (store + providers for component tests) |
| `e2e/` | Playwright specs |

---

## 2. Boot sequence

1. **`index.html`** runs three inline scripts before React:
   - *Theme:* reads `localStorage["freecut.prefs"]` and sets `<html data-theme="auto|dark|light">` **before first paint** so the app never flashes the wrong theme. The page's own split background uses two inline variables that mirror the palette (`theme.css` owns the real one).
   - *iOS flag:* detects iPhone/iPod/iPad (incl. iPadOS posing as Mac) → `class="ios"` on `<html>`, plus `standalone` when launched from the Home Screen. `--safe-top/--safe-bottom` get `env(safe-area-inset-*)` **only** when `ios` is set.
   - *Standalone nudge:* an iOS home-screen app can start one status-bar short until the first scroll, so the script scrolls 1 px and back after `load` (60 ms, 400 ms) and on each return to visible. The body is deliberately taller than the screen.
   Global CSS: box-sizing reset, hidden scrollbars, no overscroll bounce, and a **split background** that follows the theme (`--bg` / `--panel`) so any strip iOS doesn't paint blends with the nearest bar.
2. **`main.tsx`** → `StrictMode` → root `ErrorBoundary` → `App`. (StrictMode double-runs effects in dev; `boot()` is memoised so it only runs once.)
3. **`App`** renders `<div class="fc-boot">` (theme background) until `boot()` resolves — typically a few ms — and calls `initTheme()` (`app/theme.ts`), which keeps the palette (`data-theme`) and the browser chrome (`color-scheme`, `theme-color`) in step with the saved preference, including the system theme flipping while "auto" is chosen.
4. **`boot()`** (`app/boot.ts`) = `bootstrapProject()` → `startAutosave()` → set default selection → **sweep orphaned media** (best effort, in the background).
5. **Idle warm-up:** once Home is showing, `requestIdleCallback` (or a 1.2 s timeout) fetches the editor chunk so opening the editor is instant.
6. **PWA:** `vite-plugin-pwa` (production build only) emits `sw.js`/`manifest`; the service worker precaches everything *including the lazy editor chunk and CSS* (`globPatterns`), with `navigateFallback: index.html` and `registerType: "autoUpdate"`.

### `bootstrapProject()` — which project do we open?

```
getLastProjectId() ─► loadRawProject(id)
   │ no record ───────────► create sample ► save ► status "saved"                 → source "created"
   │ record ► migrateProject ─ ok ───────► adopt it, status "saved at <its updatedAt>"   → "loaded"
   │                         └ ProjectLoadError ► quarantineRaw(raw) ► save fresh sample → "recovered" (+warning)
   └ StorageUnavailable / any storage error ► keep in-memory sample, status "unavailable"  → "unavailable" (+warning)
```
- **Nothing is ever deleted on failure:** an unreadable project is copied to `meta` under `quarantine:<id>:<timestamp>` *before* it is overwritten (a test asserts the order).
- Loading **does not rewrite** the project, and **clears undo history** (history is not persisted).
- `App` shows `warning` as a dismissible amber bar.

---

## 3. The project model (`src/model`)

```ts
Project { schemaVersion: 2, id, name, createdAt, updatedAt,
          settings{ fps, width, height, ratio },
          assets[], tracks[], clips[], markers[] }
Asset   { id, kind: video|audio|image, name, durationFrames, width?, height?, mime?, bytes?, peaks?,
          source: generated{scene,thumb} | stored{mediaId} | opfs{path} (reserved) }
Track   { id, kind: main|overlay|audio, name, muted, locked, hidden }       // array order = top→bottom
Clip    { id, trackId, assetId, start, duration, sourceIn, speed,           // all FRAMES, integers
          transform{ zoom,x,y,rotation }, opacity, blend, filter|null, effects[], sections{…} }
```

- **Time is integer frames** at `settings.fps` — never float seconds. `time.ts` converts at the UI edge (`timecode`, `mmss`, `hhmmss`).
- `Clip.duration` is timeline length; `sourceIn` + `duration × speed` must stay inside the asset (a test checks the sample).
- `selectors.ts`: `projectDuration` (end of the last clip), `activeVisualClip(frame)` (topmost main/overlay clip; end exclusive), `clipsOnTrack`, `defaultSelection`, lookups.
- **`sample.ts`** builds the demo project: the v1.0.0 picture as data — 1 overlay track (empty), 1 main track with `Moraine Lake.mov` (27 s 58 f), 1 audio track with `Audio.aac` (starts 314 f, 602 f long, speed 2×), plus four library assets.
- **`schema.ts` → `validateProject`** returns human-readable problems: types, integer frames, unique ids, dangling track/asset references, **no overlapping clips on a track**, value ranges.
- **`migrations.ts` → `migrateProject(raw)`**: reads `schemaVersion`, refuses *newer* schemas (`too-new`) instead of mangling them, applies `MIGRATIONS[v]` step by step (never mutating the input), then validates. Throws `ProjectLoadError` with a code (`not-object | no-version | too-new | missing-migration | invalid`). `fixtures/project.v1.json` is a **frozen** v1 file that must load forever.
- **Schema v2 (Phase 1a):** assets gained the `stored` source (an imported file in the media store; the poster is `${mediaId}:poster`) and optional `mime`, `bytes`, `peaks` (a ≤120-number waveform summary kept inline in the project). The **v1 → v2 migration is a pure re-stamp** (every v1 project is already a valid v2 project) — the first real use of the migration runner, covered by the frozen v1 *and* v2 fixtures and by a real-browser test that upgrades a genuine Phase 0 database. Derived media is keyed as `mediaId`, `mediaId:poster`, `mediaId:strip` — **every such key must be listed in `mediaKeysOfAsset` / `rawMediaKeys`**, or the orphan sweep would delete it.
- *Known debt:* `transform.zoom` is the prototype's 0–100 "Zoom" slider semantics and isn't applied to pixels; Phase 3 replaces it with a real `scale` via a v2 migration.

---

## 4. State: stores, commands, undo/redo

### Stores (`src/store`)
| Store | Holds | Persisted? |
|---|---|---|
| **projectStore** (singleton, via `ProjectContext`) | the project + `past`/`future` history + `revision` | project → IndexedDB (autosave). History: no |
| `editorStore` | `selectedClipIds` | no |
| `prefsStore` | magnet / snap / link / axis toggles | `localStorage["freecut.prefs"]` |
| `saveStatusStore` (in `storage/autosave`) | `idle | saving | saved | error | unavailable` + `savedAt` | no |
| Playback (React context, not a store) | frame, playing | no |

`createStore` is a ~20-line vanilla store (immutable state, sync notifications). `useStore(store, selector, isEqual?)` is a `useSyncExternalStore` wrapper that **only re-renders when the selected slice changes**. Components read the project with `useProject(p => …)`.

### Commands
A command is `{ type, label, coalesceKey?, apply(project) → project }`. **`apply` must be pure and return the *same object* if nothing changed** — the store then records nothing.

Implemented (`store/commands.ts`): **Phase 1a —** `addAssets` (a whole import batch = one undo step), `renameAsset`, `removeAsset` (removes the asset *and* every clip using it, in one step), `addClipFromAsset` (appends to the end of the main track, or the audio track for audio; the clip id is passed in so the command stays pure). **Phase 0 —** `renameProject`, `setTrackMuted`, `setClipOpacity`, `setFilterStrength`, `setClipZoom` (these three coalesce), `setClipBlend`, `setClipSectionEnabled`, `removeClipEffect`, `resetClipSection`. Values are clamped and rounded inside the command, so no caller can produce an invalid project (a test validates after every command).

### History (`createProjectStore`)
- **Snapshot-based with structural sharing:** each entry stores `before` and `after` projects; commands only create new objects along the changed path, so a snapshot is a handful of small objects (tests assert `clips`/`assets` arrays are shared between snapshots). Swap to patches later without changing the Command API.
- **Coalescing:** consecutive commands with the same `coalesceKey` within 600 ms merge into **one** undo step — so dragging a slider is one Undo.
- **Barrier:** after undo/redo/transaction/replace, the next edit always starts a fresh entry (otherwise a quick edit after an undo could merge into an older, unrelated entry — there's a regression test and it was verified to fail when the barrier is removed).
- **`transaction(label, fn)`** groups several commands into one step (future drags), nests, refuses undo while open, and **rolls back if `fn` throws**.
- Limit 200 entries; `updatedAt` is stamped on every edit/undo/redo (clock injectable for tests); `replaceProject` clears history.
- Undo/redo: toolbar buttons (desktop timeline, phone player; disabled when empty) and **Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z**, **Ctrl+Y** (ignored while typing in a field).

### Selection
`editorStore.selectedClipIds`. `App` resets it to the main clip **every time the editor is entered** (including via browser Forward). Clicking a clip selects it; clicking the selected clip clears it. The Properties panel edits the first selected clip, or asks you to select one.

---

## 5. Persistence (`src/storage`)

- **`idb.ts`:** a promise wrapper over IndexedDB. DB `freecut` **v2** with stores `projects` (key `id`), `meta` (key `key`: `lastProjectId`, `quarantine:*`) and **`media`** (key `id`: imported files + posters as Blobs). The v1 → v2 upgrade only *adds* the `media` store and never touches existing data (tested against a genuine v1 database). Writes resolve on **transaction completion** (durable), a failed open isn't cached (recovers when storage works again), `onversionchange`/`onclose` drop the handle. Missing/blocked/throwing IndexedDB (Firefox private mode) → `StorageUnavailableError`.
- **`projectRepo.ts`:** `saveProject`, `loadProject` (migrate + validate), `loadRawProject`, `listProjects`, `deleteProject`, `get/setLastProjectId`, `quarantineRaw`.
- **`autosave.ts`:** `startAutosave({ store, save })`
  - waits **500 ms of quiet** after a change, then saves the **latest** project;
  - **never overlaps two writes**, and a change made *during* a write triggers another save afterwards;
  - transient errors → status `error` + retry with exponential backoff (2 s → 30 s);
  - `StorageUnavailableError` → status `unavailable`, stops retrying;
  - flushes on `visibilitychange → hidden` and `pagehide`;
  - the title-bar / phone subtitle text comes from `saveLabel(status)`: *"Saved locally at 16:30:29"*, *"Saving…"*, *"Couldn't save — retrying"*, *"Not saved (storage unavailable)"* — the dot colour follows `data-state` (green / amber / red).
- **`media/mediaStore.ts`** keeps imported bytes (`putMedia / getMedia / deleteMedia`, `isQuotaError`, `requestPersistentStorage`). **Why IndexedDB Blobs and not OPFS:** research R-002 — OPFS exists in Safari since 15.2, but the easy main-thread write API (`createWritable`) reportedly only arrived in Safari 26, older iPhones would need a Worker path, and IndexedDB Blobs already work everywhere we target (verified on your iPhone in Phase 0). Callers only see `MediaRecord`, so swapping the backend later is local.
- **Orphan sweep** (`sweepOrphanMedia`): at startup (undo history empty) and after *Reset demo project*, delete media no project references. It keeps anything referenced by **any** project, **including corrupt/unknown-schema and quarantined ones** (it reads raw records tolerantly), and never touches records younger than 10 minutes (an import stores bytes *before* the project references them).
- **`opfs.ts`:** typed skeleton for Phase 1 media files: `createMediaStore()` → `write/read/remove/list` under an OPFS `media/` directory, ids restricted to `[A-Za-z0-9._-]` (can't escape the folder), `OpfsUnsupportedError` when `createWritable()` is missing (older Safari — research note R-002). Tested against an in-memory fake; **not yet exercised in a real browser**.

---

## 5b. Media import (Phase 1a — `src/media`)

```
file picker / drop ─► importMedia(files, store)            (queued: one import at a time)
                         └► ingestFiles(files, deps)         (one FILE at a time — phones have little memory)
                              per file:  classify ► size checks ► probe ► put(file) ► poster ∥ peaks ► put(poster) ► Asset
                         └► store.execute(addAssets([...]))  ONE undo step for the whole batch
                         └► importStore (progress/summary) ─► <ImportToast/>
```
- **`classify`** — kind from MIME type, else file extension (iOS often omits the type: `.MOV`, `.HEIC`, `.m4a`…). Limit 2 GiB per file.
- **`probe`** — the browser's own decoders read the truth: `<video>`/`<audio>` metadata (duration; the `Infinity` WebM quirk is handled), `Image.decode()` for photos. A "video" with no picture becomes audio. Muted + `playsinline` + timeouts (12 s) because iOS is strict. Errors are `ProbeError`s with messages meant for people.
- **`poster` + `thumbnail`** — a small JPEG still (≤512 px, quality 0.82) for photos and videos, plus a **trail of notes** about what happened. Photos: `Image.decode()` → canvas, falling back to `createImageBitmap`. **Videos (reworked in 1.2.1 for iOS):** `posterFromVideo` attaches an invisible 2 px muted `<video>` to the page (iOS may not decode detached/hidden ones), briefly **plays** it (iOS ignores `preload="auto"` and may not decode a frame until play is requested), pauses, seeks to 10 % (≤1 s), waits for a presented frame (`requestVideoFrameCallback` where available), and draws. If that route fails it retries with a plain seek-only element. A **blank (all-black) result is distrusted** and retried; it's only accepted if the browser really had a decoded frame (a video can start black) — an empty canvas is never mistaken for a picture. Overall budget 9 s. Every step appends to the notes (`play: metadata 1920×1080, play() ok, frame ready via canplay, seeked, picture ok`). `computePeaks` (`OfflineAudioContext.decodeAudioData` → 120 peaks; skipped above 60 MB; Safari callback form handled). **All best-effort: failure never blocks an import.** The browser is injected (`PosterEnv`), so the iOS-style quirks (frames only after `play()`, refused `play()`, never-loading decoder, blank frames) are unit-tested; *whether the model matches real iOS is confirmed only on a phone*.
- **`ingest`** — pure orchestration with **injected dependencies** (so every failure path is unit-tested without a browser): durations become integer frames at the project fps (photos default to 5 s); a bad file never stops the others; if anything fails after bytes were stored (e.g. storage full), what was stored for *that file* is deleted; storage-full gets its own message.
- **Filmstrip (1.2.2)** — `filmstrip.ts`: for an imported video, ONE sprite image of ~`min(24, ceil(seconds))` frames sampled at the middle of equal slices of the clip (grid ≤2048 px wide, cells ~128 px tall, aspect kept), JPEG, stored as `${mediaId}:strip` with its layout (`count, cols, rows, cellW, cellH, durationSec`) as the record's `meta`. Built with the same iOS-proofed approach as posters (attached muted video, `play()` then pause, then seek to each time and draw). `filmstripQueue.ts` builds **lazily, once per video per page load, one video at a time**, skips if the record already exists, never throws, remembers failures and logs the reason; `useFilmstrip(asset)` triggers it the first time a clip is drawn and re-reads when it lands (`refreshMedia`). **Timeline cells:** each cell computes the source time at its centre (`sourceIn + (i+½)/n × duration × speed`), picks the frame with `frameIndexAt`, and `cellStyle` produces the CSS `background-size/position` that shows that frame covering the 40 px-tall cell, centred, with no neighbour bleeding in (pure functions, unit-tested). No sprite yet (or it failed) → the repeated poster. *The player still shows a single still image; moving preview is Phase 1b.*
- **`importStore` / `ImportToast`** — progress ("Importing 2 of 3 — IMG_0042.MOV"), then a result: clean successes fade after 4 s; **failures** (with each file's reason) and **warnings** stay until dismissed. A *warning* means "imported fine, but no preview picture could be made (reason…) — open ⋯ → Create thumbnail to try again".
- **`useMediaUrl`** — turns stored Blobs into ref-counted object URLs (shared between tiles, player and timeline; revoked 5 s after last use). `refreshMedia(id)` makes every component re-read a record written later (a retried thumbnail) and keeps the old picture on screen until the new one is ready (no flash).
- **UI:** `MediaPanel` lists *all* project assets (demo + imported; filter All/Video/Photo/Audio), real posters, durations, waveform placeholders for audio, **+** (add to timeline, selects the new clip), **⋯** (dialog: add / rename / delete-with-its-clips; undoable), desktop drag-and-drop. **The player (`editor/Stage.tsx`, 1.2.3):** demo footage → its generated scene; an imported **photo** → the **original file** (the small poster underneath until it loads, and if the browser can't decode it); an imported **video** → a paused native `<video>` of the original file that **chases the playhead** (`stageTime` = source time for the timeline frame, honouring clip start, trim and speed; **one seek in flight at a time**, then it jumps to the newest target) and is **revealed only after a non-blank frame is verified** (`verifyFrame` samples a 32×18 canvas; a genuinely black frame is accepted after 3 tries; with no poster to protect it shows immediately). It is silent and not yet real playback — **sound and proper playing are Phase 1b**. Timeline clips use the filmstrip. **If a video has no poster** the tile (and the player) layer the browser's own `<video src="…#t=0.1">` first frame over the icon, and ⋯ → **Create thumbnail** retries on demand — inside a tap, which iOS likes — and shows the step-by-step notes if it still fails. On iPhone Safari outside the Home Screen app, a one-time tip explains that Safari may clear a website's saved data after about a week unused.
- **Performance lesson (L-024):** the import used to take 5–8 s in a software-rendered browser because the editor *opened playing* and its 60 fps re-render starved the main thread (the poster's `toBlob` took 3.8 s instead of 0.15 s). The editor now **opens paused at 00:00:00:00** (K2 fixed); the e2e suite got ~2× faster.

---

## 6. Screens, navigation and transitions (`app/useScreenRouter.ts`)

State: `screen` (`home|editor`), `leaving` (the screen animating out), `launch` (options Home passed, e.g. `{ sheet: "media" }`).

- **One entry point `go(next)`:** sets `leaving`, `screen`, and clears `leaving` after `TRANSITION_MS (480) + 30` ms. During that window **both layers are mounted**; the outgoing one gets `aria-hidden`. `go('editor')` also fires `onEnterEditor` (resets selection).
- **Layers:** `<div class="fc-layer fc-home|fc-editor [fc-m] [fc-in|fc-out]">`, `position: fixed`; the editor is above Home.
- **Animations (`transitions.css`):** desktop = zoom + fade; phone (`fc-m`) = push/pop (editor slides over, Home eases 22 % left and dims); `prefers-reduced-motion` = 0.18 s fade.
- **History:** opening the editor `pushState({ freecut: "editor" })`. A `popstate` listener calls `go(screenForPopState(event.state))` — **so Back → Home and Forward → editor** (v1.0.0 always went Home, breaking Forward; fixed, with unit, jsdom-app and real-browser tests). `goHome()` calls `history.back()` if on the editor entry (tidy history), else `go("home")`.
- **Reload on an editor entry:** the browser restores `history.state`, but the app starts on Home — on mount the router `replaceState(null)` so Back/Forward stay in sync.
- **Error handling:** the editor layer has its own `ErrorBoundary` + `CrashScreen` (try again / back to home / reload); the root has another. The project is autosaved, so a crash doesn't lose work.
- **Lifetime:** `PlaybackProvider` wraps the editor only, so **playback state resets each time the editor opens**. Project state does *not* (it lives in the store above the layers).

### Layout switching (`useIsMobile`)
`MOBILE_QUERY = "(max-width: 819px), (pointer: coarse) and (max-height: 520px)"` (phones, narrow windows, phones in landscape). `layout="mobile"|"desktop"` forces it. `Editor` picks `MobileApp` (in `.ve-mob-frame`) or `DesktopApp`; desktop `.ve-app` has `min-width: 820px`. Root classes `ios` / `pwa` come from `app/platform.ts` (`IS_IPHONE`, `IS_STANDALONE`, computed once).

---

## 7. Playback (`src/engine`) — real picture and sound (Phase 1b.1)

Two React contexts, deliberately split: **`FrameCtx`** (the frame; changes up to 60×/s) and **`ControlCtx`** (`playing, fps, totalFrames, toggle, pause, seek, levels`; changes only when play/pause flips) — so buttons don't re-render per frame. `usePlaying()` is a never-throwing way to ask "is it playing?" (used by the Stage).

**The idea:** sound comes from **Web Audio** (decoded once, played from memory), and the **audio clock is the master timeline**; the picture is the same on-screen `<video>` the Stage already had, now really playing (muted) and kept in step with the playhead. This follows what the owner's iPhone showed (Playback check, R-005): audio unlocks from the tap, the silent-switch fix works, decoding is fast, and a muted video plays at 1.0× whether visible or hidden.

- **`transport.ts`** — a small, deterministic state machine (time is passed in; unit-tested without clocks). Phases: **perf** (the plain time clock), **audio** (the playhead = start + audio time × fps), **holding** (only when playback starts on a video: wait ≤ 1.5 s for it to be really moving). **The playhead never waits for sound:** it starts on the time clock at once, and the sound *joins* — re-anchored to where the playhead is — the moment it is decoded and the context is running. If audio can't run (no Web Audio, suspended, interrupted, decode failed) it simply stays on the time clock; if the audio clock vanishes or freezes mid-play it drops back to the time clock **without a jump**. A restart (seek while playing) cancels any decode still pending from the earlier run.
- **`audioPlan.ts`** (pure) — from the project and a start frame: which clips make sound (video clips use their own sound; audio clips; **photos and the built-in demo footage are silent; a muted track is skipped**), when each starts, where in the file, for how long, at what speed. A clip already under the playhead starts part-way in (honouring trim and speed). `catchUp` trims a sound whose start time has already passed.
- **`audioEngine.ts`** — decodes each file once (`decodeAudioData`), caches it (≤ 200 MB, oldest dropped first), schedules the plan on the audio clock, and reads a real **level meter** from two analysers (−60…0 dB, with a gentle fall-back). Files over **60 MB are left silent** (decoding reads the whole file into memory; proxies come in 1c — N36). Everything browser-specific comes in through `EngineEnv`/`ContextLike`, so it is tested with a fake audio context; `audioEngineEnv.ts` is the real wiring (and returns nothing where there is no Web Audio, e.g. jsdom).
- **`playback.tsx`** — owns one engine and one transport. **`toggle()` wakes the audio context synchronously inside the tap** (iOS only lets sound start from inside the gesture itself — D-032), then flips `playing`; while playing, an animation-frame loop asks the transport for the frame (using `performance.now()`, the same clock the transport started with) and **refreshes the on-screen frame number only ~30 times a second** (always at once at the end, and with the true last frame when it stops) — the picture and sound follow the clock directly, so halving the screen's re-rendering and timeline scrolling costs nothing visible. It also holds the busy gate while playing. A seek while playing restarts sound and clock from the new place. It stops at the end, rewinds on play-at-end, clamps if the project shrinks, and handles an empty project. **The editor opens paused at 00:00:00:00.**
- **The picture (`editor/Stage.tsx`).** Paused, `StageVideo` chases the playhead by seeking, one seek in flight. **While the playhead is moving fast** (a scrub) and the picture is more than 0.5 s behind, it uses Safari's **`fastSeek`** (nearest keyframe — much quicker on long-GOP video, e.g. iPhone clips) for a live preview; **when the playhead has been still for 160 ms an exact seek lands the right frame**. Browsers without `fastSeek` (Chrome, Firefox) always seek exactly. Playing, it plays muted and **`engine/drift.ts` keeps it in step with the *live clock*** (read through `liveFrame()` — not the 30 Hz React value), driven by the video's own frame callback: **inside ±80 ms nothing is touched**; beyond that **one** correction (speed ±6 %) held until within 20 ms and not started more than every 400 ms; beyond ±450 ms a jump (at most every 800 ms). (The first version changed the speed on every frame — 177 times in 5 s — which can stutter a phone's video; L-055.) When the video is really moving it **reports the timeline frame to `videoSync`** — that is how the clock starts sound and playhead together with the picture — and reveals itself (a clip starting at source time 0 never triggers a seek, so it would otherwise stay hidden).
- **Background work yields (`engine/busy.ts`).** Building a clip's filmstrip runs a *second hidden video* (seeking and decoding 24 frames, then one large image encode). While you **play**, the provider holds the busy gate; a phone-timeline **scroll, touch, zoom or pinch** pulses it for ~0.7–0.9 s; the filmstrip queue and builder check it before starting, before every frame and before the encode, and the builder's 45 s deadline does not count the time spent waiting. If a wait lasts more than 400 ms the builder **lets go of its hidden video** (its decoder and memory) and reopens it afterwards. Measured on the delivered 1.4.0: the strip finished *during* playback with two videos alive; now it waits and finishes ~5 s after you pause (L-054).
- **Phone timeline cost.** `ScrollSync` (keeps the playhead centred) used to *read* `scrollLeft` — forcing a layout — and write it on every frame; while playing it now trusts what it last wrote (touching the timeline pauses playback, so no one else scrolls). Pinch zoom applies the latest asked-for zoom at most every ~90 ms instead of re-laying-out the whole timeline per finger event. A drawn **demo scene** costs ~500 SVG shapes *per cell* (zooming in created dozens of cells: 13,600 → 22,000 nodes), so demo clips use at most **10** wider cells; photo/video cells are cheap bitmaps and keep the dense strip. Measured per zoom step: 60–140 ms → ~24 ms; style recalculation 20–47 ms → 1 ms (L-056).
- **Known limits (first cut):** a cut to a *different* video file shows the still poster while the next video warms up (pre-warming = 1b.2); clip speed also shifts the pitch; there is no per-clip volume (the model has none — mute is per track); overlapping sounds are simply added; edits made *while* playing aren't heard until the next Play (the plan is made at the start); Bluetooth output delay isn't compensated.
- **Still open (K3):** the playhead is still a React state updated every frame; an imperative playhead remains future work.

---

## 8. Timelines (`src/editor/timeline`)

### One geometry module — `geometry.ts` (pure, unit-tested)
`createTimeScale(fps, pps, origin)` → `frameToX`, `xToFrame`, `framesToWidth`. **The ruler, clips and playhead all use it**, which fixes v1.0.0's inconsistent desktop timeline (Handover K1b: the clips were drawn at 22.3 px/s but the ruler and playhead used 4.17 px/s from an arbitrary origin). A regression test asserts that the playhead and the ruler tick for the same time are at the same x, at every zoom.

| | Desktop | Phone |
|---|---|---|
| px per second @ zoom 1 | `DESKTOP_BASE_PPS = 22.3` | `MOBILE_BASE_PPS = 28` |
| zoom | slider 0–100 → factor `0.4 + zoom/100 × 1.2` | factor 0.4–3.5 via ± buttons and pinch |
| origin | `0` | `0`, canvas padded 50 % each side |
| extent | `max(60 s, duration + 30 s)` | exactly the duration (+160 px) |
| ruler labels | first step of `[1,2,5,10,15,30,60,120,300]` s with ≥ 40 px gap | same, ≥ 46 px |

`layoutTracks(tracks, metrics)` stacks rows under the ruler with per-kind heights/insets (`DESKTOP_METRICS`: ruler 16, overlay 55, main 63, audio 40; `MOBILE_METRICS`: ruler 22 + 8 pad). Tests assert the prototype's exact row positions (main 71, audio 134; phone 30 / 93). The phone hides overlay tracks that have no clips.

### Shared pieces
`TrackClips` positions every model clip (`VideoClip`: filmstrip of `round(width/41.6)` cells, 1–90 (each cell is the demo scene, **a real per-moment frame from the filmstrip sprite**, or — until that exists — the poster), chips from the asset name + duration, plus *Effects / Filters / Adjust* chips **only when the clip actually has an effect / filter**; `AudioClip`: the asset's real `peaks` (or a placeholder waveform), "Speed 2.0x" chip when speed ≠ 1). `TrackHeads` renders per-track controls (cover + mute on main, mute on audio) and dispatches `setTrackMuted`. `ToggleButtons` = the four toggles (stored in `prefsStore`; behaviour is Phase 2).

### Phone timeline — centre playhead, scrolling content
The playhead never moves; the content scrolls under it. `scrollLeft = (frame / fps) × pps`.
- **Frame → scroll:** `ScrollSync` (layout effect) sets `scrollLeft` when it differs by > 0.6 px and stores it in `lastProg`.
- **Scroll → frame:** `onScroll` ignores events within 1.5 px of `lastProg` (our own moves) and otherwise `seek()`s. Without this every tick would feed back into a seek.
- Touching/wheel **pauses**; two-finger pinch scales zoom; `touch-action: pan-x`.

---

## 9. The editor panels

| Panel | Reads from the model | Writes via command |
|---|---|---|
| **TitleBar** (desktop) | project name, save status | — (menu buttons still inert) |
| **MediaPanel** | every asset → grid/list, posters, durations, filter | `addAssets` (via import), `addClipFromAsset`, `renameAsset`, `removeAsset` |
| **PlayerPanel / Stage** | the visual clip under the playhead → its generated scene, the original photo, or a real video frame at the playhead time | — |
| **PropertiesPanel** | selected clip: filter strength, effects list, zoom, X/Y/rotate (read-only), blend mode, opacity, section on/off | `setFilterStrength`, `removeClipEffect`, `setClipZoom`, `setClipOpacity`, `setClipSectionEnabled`, `resetClipSection` |
| **Timeline / MobileTimeline** | tracks, clips, assets, fps, duration, selection, prefs | `setTrackMuted`; selection; prefs |

Shared controls (`ui/controls.tsx`): **`Slider` is now keyboard-operable** (`tabIndex=0`, `role="slider"`, `aria-label/valuenow/valuetext`, ←→↑↓ ±1, Shift ±10, PageUp/Down ±10, Home/End) with a visible focus ring. `NumberBox` has labelled ▲▼ buttons (typed entry arrives in Phase 3). Still placeholders: keyframe buttons, Position X/Y and Rotate entry, the blend-mode dropdown, all other Properties tabs.

**Demo footage** is still generated SVG (`editor/footage/scenes.tsx`): `SceneDefs` renders `<symbol>`s once per shell; `<Scene id>` uses `<use href>`; geometry from a seeded `lcg`. An asset's `source.scene` / `source.thumb` select which symbol shows.

---

## 10. Home (`src/home`)

`Home({ mobile, onOpen })` → `MobileHome` (hero, two big actions, Recent, Tools, bottom tabs Edit / Templates / Projects / Me) or `DesktopHome` (sidebar, hero, Quick start, project grid).

- **The project card is real:** name, length and "Saved on this device" (or "Not saved (storage unavailable)") come from the store; it opens the persisted project. Templates/Tools/"New project" still just open the editor (Phase 9). **Reset demo project** (Me tab on phone; sidebar on desktop; two taps) replaces the saved project with a fresh sample.
- **Appearance (1.4.3, Me tab + desktop sidebar; dropdown since 1.4.4):** `ThemePicker` in `Home.tsx` is a dropdown — a closed button naming the current choice (icon + label + chevron), opening a `listbox` menu of Auto / Dark / Light with a check on the saved one; it closes on an outside tap, a scroll underneath, or Escape (which returns focus). It writes the `theme` pref (`prefsStore`) — the palette itself is CSS (`styles/theme.css`, see §11).
- **A fresh look on every open** (`heroPick.ts`): a module-level pick `{scene, headline}` in `localStorage["freecut.home.pick"]`; `rollIndex` never repeats the last index; re-rolls at load and when the page returns after being hidden ≥ 20 s; `useOpenPick()` (`useSyncExternalStore`) reports `fresh` so the swap fades in.
- **Hero scenes** (`HeroScenes.tsx`): six SVG scenes on a 400×300 canvas, ids from `useId`; ambient motion only inside `.hm-live`, transform/opacity only, off under reduced motion. Project thumbnails always use `dusk` (it matches the demo clip).
- `BrandMark` (one component, unique mask id per instance) is used by both Home and the editor.
- **Playback check (1b.0, Me tab → “Playback check”)** — a lazily loaded panel (`PlaybackCheckPanel`; its chunk is only fetched when the row is tapped) that reports what *this* phone's browser can do before the playback engine is built. Its buttons call straight into `diagnostics/playbackCheck.ts` from the tap handler, because **iOS only unlocks audio from inside the tap**: `runPlaybackCheck` starts the `AudioContext` and sets `navigator.audioSession.type = "playback"` synchronously before any `await`. The runner is pure and takes a `PlaybackEnv` (D-023 again); `playbackCheckEnv.ts` is the real browser. It reports: Web Audio unlock, the silent-switch fix, whether element volume works, which video/audio codecs `<video>` and WebCodecs accept (incl. HEVC), whether `requestVideoFrameCallback` exists, and — on the **largest video you imported** — audio decode time; **four muted playback runs** — a hidden video, the same video as a small visible corner thumbnail, hidden again, and visible while every frame is painted to a canvas — each reporting the video clock's speed over the whole run *and over its second half* (a slow start and a slow crawl are different problems), start-up delay, skipped frames, the browser's own `waiting`/`stalled` events and the decoder's dropped-frame count; the cost of **one copy to a canvas forced to finish**, measured *separately* because forcing it during playback stalls the page and would blame the phone for the measurement (L-048); seek latency; and `texImage2D(video)` cost. The point of the A/B/A order (hidden → visible → hidden) is that the three results name the cause by themselves: slow/fast/slow = iOS throttles hidden video; slow/fast/fast = a first-play warm-up; slow/slow/slow = the phone cannot play it in real time. Every browser call has a time limit and each section is isolated, so a hang or crash becomes a red row, never a frozen or empty report. Rows can be copied as text or screenshotted; two buttons play a test tone through Web Audio and through an `<audio>` tag to hear with the silent switch on.

---

## 11. Styling & bundles

- Styles are **real CSS files** (moved out of JS template strings; verified equivalent to the originals after minification). Prefixes: `ve-` editor, `hm-` Home, `fc-` layers/app shell, `sc-` scene animation. `editor.css` is imported by `Editor` and therefore ships **inside the lazy editor chunk**.
- **Theming (1.4.3, completed 1.4.4):** all design tokens live on `<html>` in `styles/theme.css` — dark values by default, a light palette under `data-theme="light"`, and the same light palette under `data-theme="auto"` inside `prefers-color-scheme: light`. The old per-scope copies on `.hm` / `.ve-app` / `.ve-toast` are gone, so one attribute switch re-themes the whole app. What is deliberately **not** themed: the video letterbox, the demo footage scenes, the hero artwork, the timeline clip colours (teal video / blue audio), and overlays painted *on* media (duration badges, the add/⋯ dots) — content keeps its look in both themes, like a video player. `color-scheme` flips with the palette (native controls, select dropdown, scrollbars) and `theme-color` follows the resolved theme (auto resolves via `matchMedia`). The 1.4.4 "chrome extras" token group finished the pass: the phone tab bar (`--bar`), active accent tints (`--accent-soft`/`--accent-soft-2`), the slider halo (`--glow`), the dialog backdrop (`--scrim`), the storage tip (`--tip-*`), the storage banner (`--warn-bg/ink/line`), the "New video" gradient (`--cta-a/b`), plus the play/playhead/scrub-mark colours and the logo (`currentColor`) — dark values byte-identical to the hard-coded ones they replaced.
- Phase 0 CSS additions: slider focus ring, disabled toolbar buttons, audio-clip selection outline, amber/red autosave dot, Reset-demo link, boot/warning/crash styles.
- **Build output (v1.2.0):** initial JS 202.8 kB (64.2 kB gzip) + CSS 17.6 kB; editor chunk 69.3 kB (20.2 kB gzip) + CSS 29.5 kB, fetched on idle. (v1.0.0 shipped one 273.5 kB / 77.9 kB gzip bundle.) PWA precache: 18 entries, 344 KiB.

---

## 12. Testing architecture

| Layer | Tool | What it proves |
|---|---|---|
| Pure logic | Vitest (node) | **iOS-style poster simulations**, time maths, schema, migrations (frozen v1 **and** v2 fixtures), commands, history/coalescing/transactions, clock, geometry, hero pick, file classification, waveform maths, **import orchestration (every failure path)** |
| Persistence | Vitest + **fake-indexeddb** (real IndexedDB semantics) | save/load/list/delete, durability, quarantine, unavailable storage + recovery, autosave (fake timers), OPFS contract, **media blobs, a real DB v1→v2 upgrade, orphan-sweep safety rules** |
| Components | Vitest + jsdom + Testing Library via `test/harness` | timeline from the model, mute→undo, keyboard shortcuts, Properties↔model, slider a11y, phone timeline, **library (filter, import, drop, add, rename, delete+undo), dialog focus handling, import toast, iPhone storage tip, clip chips/waveform** |
| App | jsdom | boot → Home → lazy editor → edit → undo → Back → Forward |
| Real browsers | **Playwright** (`e2e/`) — projects `chromium-desktop`, `chromium-phone`, `webkit-desktop`, `webkit-phone` | reload persistence (real IndexedDB), Back/Forward, K1b geometry, keyboard sliders, phone scroll-sync, quarantine, offline PWA, **importing a real WebM video, WAV and PNG (+ a corrupt file and a text file), posters/durations/waveform, add to timeline, persistence of imported media across reload, rename/delete/undo, upgrading a genuine Phase 0 database**, zero console errors |

`npm run verify` = typecheck → lint → unit/component tests → build. `tsc` also type-checks tests (Vitest does not). Mutation spot-checks (deliberately breaking 7 behaviours) confirm the tests fail when the code is wrong — see Handover §6.

---

## 13. What changes next

| Today | Becomes | Phase |
|---|---|---|
| One filmstrip image per clip; cuts between *different* video files show the poster while the next video warms up; long files (> 60 MB) are silent | Per-moment filmstrips; pre-warmed next clip (1b.2); proxies and sound for long files (1c) | 1b.2 / 1c |
| Playhead is a React state updated every frame (now follows the audio clock) | Imperative playhead | later (K3) |
| Whole-file blobs in IndexedDB | Proxies for heavy files; (maybe) OPFS where it's reliable | 1c |
| Selection/props for one clip | Multi-select, move/trim/split/ripple, snapping | 2 |
| `transform.zoom` (UI semantic) | Real transform/keyframes (schema v2 migration) | 3 |
| Nothing | Render graph shared by preview and export | 4 / E1 / 7 |
