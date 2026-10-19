# How FreeCut works

> **Scope:** the mechanics of the app **as built at v1.1.0 (end of Phase 0)**. Verified by reading the source, by 156 unit/component tests, and by 22 passing real-browser (Chromium) end-to-end runs.
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
- **Local-first, no backend.** No network calls at runtime. Storage is IndexedDB (project) and, from Phase 1, OPFS (media files).

### Source map (v1.1.0)

| Folder | What lives there |
|---|---|
| `src/app/` | Root `App`, boot + bootstrap, screen router, error boundary, nav context, brand constants, platform flags, `useIsMobile` |
| `src/model/` | **Project model v1**: `types`, `time`, `defaults`, `selectors`, `sample` project, `schema` validator, `migrations` runner, frozen `fixtures/` |
| `src/store/` | `createStore` + `useStore`, **`projectStore`** (history), `commands`, `editorStore` (selection), `prefsStore`, React context hooks |
| `src/storage/` | `idb` wrapper, `projectRepo`, `autosave`, `opfs` skeleton |
| `src/engine/` | Playback clock (`clock`, `playback`) — becomes the real engine from Phase 1 |
| `src/editor/` | Editor shell + panels; `timeline/` (geometry, ruler, clips, desktop + phone timelines); `footage/` (generated SVG scenes) |
| `src/home/` | Home screen, hero scenes, hero-pick logic |
| `src/ui/` | Shared controls (`Slider`, `NumberBox`, …), custom icons, `BrandMark` |
| `src/styles/` | Real CSS files: `editor`, `home`, `scenes`, `transitions`, `app` |
| `src/test/` | Test setup + `harness` (store + providers for component tests) |
| `e2e/` | Playwright specs |

---

## 2. Boot sequence

1. **`index.html`** (unchanged from v1.0.0) runs two inline scripts before React:
   - *iOS flag:* detects iPhone/iPod/iPad (incl. iPadOS posing as Mac) → `class="ios"` on `<html>`, plus `standalone` when launched from the Home Screen. `--safe-top/--safe-bottom` get `env(safe-area-inset-*)` **only** when `ios` is set.
   - *Standalone nudge:* an iOS home-screen app can start one status-bar short until the first scroll, so the script scrolls 1 px and back after `load` (60 ms, 400 ms) and on each return to visible. The body is deliberately taller than the screen.
   Global CSS: box-sizing reset, hidden scrollbars, no overscroll bounce, and a **split background** (`#0f0f10` / `#1a1a1c`) so any strip iOS doesn't paint blends with the nearest bar.
2. **`main.tsx`** → `StrictMode` → root `ErrorBoundary` → `App`. (StrictMode double-runs effects in dev; `boot()` is memoised so it only runs once.)
3. **`App`** renders `<div class="fc-boot">` (plain dark) until `boot()` resolves — typically a few ms.
4. **`boot()`** (`app/boot.ts`) = `bootstrapProject()` → `startAutosave()` → set default selection.
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
Project { schemaVersion: 1, id, name, createdAt, updatedAt,
          settings{ fps, width, height, ratio },
          assets[], tracks[], clips[], markers[] }
Asset   { id, kind: video|audio|image, name, durationFrames, source: generated{scene,thumb} | opfs{path} }
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

Implemented in Phase 0 (`store/commands.ts`): `renameProject`, `setTrackMuted`, `setClipOpacity`, `setFilterStrength`, `setClipZoom` (these three coalesce), `setClipBlend`, `setClipSectionEnabled`, `removeClipEffect`, `resetClipSection`. Values are clamped and rounded inside the command, so no caller can produce an invalid project (a test validates after every command).

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

- **`idb.ts`:** a promise wrapper over IndexedDB. DB `freecut` v1 with stores `projects` (key `id`) and `meta` (key `key`: `lastProjectId`, `quarantine:*`). Writes resolve on **transaction completion** (durable), a failed open isn't cached (recovers when storage works again), `onversionchange`/`onclose` drop the handle. Missing/blocked/throwing IndexedDB (Firefox private mode) → `StorageUnavailableError`.
- **`projectRepo.ts`:** `saveProject`, `loadProject` (migrate + validate), `loadRawProject`, `listProjects`, `deleteProject`, `get/setLastProjectId`, `quarantineRaw`.
- **`autosave.ts`:** `startAutosave({ store, save })`
  - waits **500 ms of quiet** after a change, then saves the **latest** project;
  - **never overlaps two writes**, and a change made *during* a write triggers another save afterwards;
  - transient errors → status `error` + retry with exponential backoff (2 s → 30 s);
  - `StorageUnavailableError` → status `unavailable`, stops retrying;
  - flushes on `visibilitychange → hidden` and `pagehide`;
  - the title-bar / phone subtitle text comes from `saveLabel(status)`: *"Saved locally at 16:30:29"*, *"Saving…"*, *"Couldn't save — retrying"*, *"Not saved (storage unavailable)"* — the dot colour follows `data-state` (green / amber / red).
- **`opfs.ts`:** typed skeleton for Phase 1 media files: `createMediaStore()` → `write/read/remove/list` under an OPFS `media/` directory, ids restricted to `[A-Za-z0-9._-]` (can't escape the folder), `OpfsUnsupportedError` when `createWritable()` is missing (older Safari — research note R-002). Tested against an in-memory fake; **not yet exercised in a real browser**.

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

## 7. The playback clock (`src/engine`)

Two React contexts, deliberately split: **`FrameCtx`** (the frame; changes up to 60×/s) and **`ControlCtx`** (`playing, fps, totalFrames, toggle, pause, seek`; changes only when play/pause flips) — so buttons don't re-render per frame.

- **Ticking:** `advance(acc, elapsedMs, fps)` (pure, in `clock.ts`) turns elapsed time into whole frames and carries the remainder, so speed is correct at 30/60/120/144 Hz (tests simulate all of them) and long stalls skip frames instead of slowing down.
- `PlaybackProvider({ fps, totalFrames, startFrame, autoPlay })` takes fps and length **from the project**. It stops at the end, rewinds on play-at-end, clamps the playhead if the project shrinks (undo/delete), and handles an empty project.
- **Prototype parity (Handover K2):** the editor still opens **playing, 2 s 45 f in** (`EDITOR_START_SECONDS = 2.75`). Phase 1 changes this together with the real audio clock.
- The level meter in the player is still a sine-wave fake until Phase 1.

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
`TrackClips` positions every model clip (`VideoClip`: filmstrip of `round(width/41.6)` cells, 1–90, chips from the asset name + duration; `AudioClip`: placeholder waveform, "Speed 2.0x" chip when speed ≠ 1). `TrackHeads` renders per-track controls (cover + mute on main, mute on audio) and dispatches `setTrackMuted`. `ToggleButtons` = the four toggles (stored in `prefsStore`; behaviour is Phase 2).

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
| **MediaPanel** | non-audio assets → grid/list, durations (`mmss`) | — (Import / add still inert) |
| **PlayerPanel / Stage** | the visual clip under the playhead → its scene | — |
| **PropertiesPanel** | selected clip: filter strength, effects list, zoom, X/Y/rotate (read-only), blend mode, opacity, section on/off | `setFilterStrength`, `removeClipEffect`, `setClipZoom`, `setClipOpacity`, `setClipSectionEnabled`, `resetClipSection` |
| **Timeline / MobileTimeline** | tracks, clips, assets, fps, duration, selection, prefs | `setTrackMuted`; selection; prefs |

Shared controls (`ui/controls.tsx`): **`Slider` is now keyboard-operable** (`tabIndex=0`, `role="slider"`, `aria-label/valuenow/valuetext`, ←→↑↓ ±1, Shift ±10, PageUp/Down ±10, Home/End) with a visible focus ring. `NumberBox` has labelled ▲▼ buttons (typed entry arrives in Phase 3). Still placeholders: keyframe buttons, Position X/Y and Rotate entry, the blend-mode dropdown, all other Properties tabs.

**Footage** is still generated SVG (`editor/footage/scenes.tsx`): `SceneDefs` renders `<symbol>`s once per shell; `<Scene id>` uses `<use href>`; geometry from a seeded `lcg`. An asset's `source.scene` / `source.thumb` select which symbol shows.

---

## 10. Home (`src/home`)

`Home({ mobile, onOpen })` → `MobileHome` (hero, two big actions, Recent, Tools, bottom tabs Edit / Templates / Projects / Me) or `DesktopHome` (sidebar, hero, Quick start, project grid).

- **The project card is real:** name, length and "Saved on this device" (or "Not saved (storage unavailable)") come from the store; it opens the persisted project. Templates/Tools/"New project" still just open the editor (Phase 9). **Reset demo project** (Me tab on phone; sidebar on desktop; two taps) replaces the saved project with a fresh sample.
- **A fresh look on every open** (`heroPick.ts`): a module-level pick `{scene, headline}` in `localStorage["freecut.home.pick"]`; `rollIndex` never repeats the last index; re-rolls at load and when the page returns after being hidden ≥ 20 s; `useOpenPick()` (`useSyncExternalStore`) reports `fresh` so the swap fades in.
- **Hero scenes** (`HeroScenes.tsx`): six SVG scenes on a 400×300 canvas, ids from `useId`; ambient motion only inside `.hm-live`, transform/opacity only, off under reduced motion. Project thumbnails always use `dusk` (it matches the demo clip).
- `BrandMark` (one component, unique mask id per instance) is used by both Home and the editor.

---

## 11. Styling & bundles

- Styles are **real CSS files** (moved out of JS template strings; verified equivalent to the originals after minification). Prefixes: `ve-` editor, `hm-` Home, `fc-` layers/app shell, `sc-` scene animation. Tokens are CSS variables on `.ve-app` / `.hm`. `editor.css` is imported by `Editor` and therefore ships **inside the lazy editor chunk**.
- Phase 0 CSS additions: slider focus ring, disabled toolbar buttons, audio-clip selection outline, amber/red autosave dot, Reset-demo link, boot/warning/crash styles.
- **Build output:** initial JS 201 kB (63.6 kB gzip) + CSS 17.6 kB; editor chunk 52.7 kB (14.4 kB gzip) + CSS 25.1 kB, fetched on idle. (v1.0.0 shipped one 273.5 kB / 77.9 kB gzip bundle.) PWA precache: 18 entries, 321 KiB.

---

## 12. Testing architecture

| Layer | Tool | What it proves |
|---|---|---|
| Pure logic | Vitest (node) | time maths, schema, migrations (incl. frozen fixture), commands, history/coalescing/transactions, clock, geometry, hero pick |
| Persistence | Vitest + **fake-indexeddb** (real IndexedDB semantics) | save/load/list/delete, durability across reconnect, quarantine, unavailable storage + recovery, autosave debounce/serialisation/retry (fake timers), OPFS contract |
| Components | Vitest + jsdom + Testing Library via `test/harness` | timeline from the model, mute→undo, keyboard shortcuts, Properties↔model, slider a11y, phone timeline |
| App | jsdom | boot → Home → lazy editor → edit → undo → Back → Forward |
| Real browsers | **Playwright** (`e2e/`) — projects `chromium-desktop`, `chromium-phone`, `webkit-desktop`, `webkit-phone` | reload persistence (real IndexedDB), Back/Forward, K1b geometry, keyboard sliders, phone scroll-sync, quarantine, **offline PWA**, zero console errors |

`npm run verify` = typecheck → lint → unit/component tests → build. `tsc` also type-checks tests (Vitest does not). Mutation spot-checks (deliberately breaking 7 behaviours) confirm the tests fail when the code is wrong — see Handover §6.

---

## 13. What changes next

| Today | Becomes | Phase |
|---|---|---|
| Generated SVG scenes; static waveform; fake meter | Decoded frames on a WebGL2 canvas; real thumbnails/waveforms/levels | 1 |
| `rAF` frame counter, opens playing | Audio-driven master clock, imperative playhead, opens paused | 1 |
| 5 demo assets | Real import → OPFS + library | 1 |
| Selection/props for one clip | Multi-select, move/trim/split/ripple, snapping | 2 |
| `transform.zoom` (UI semantic) | Real transform/keyframes (schema v2 migration) | 3 |
| Nothing | Render graph shared by preview and export | 4 / E1 / 7 |
