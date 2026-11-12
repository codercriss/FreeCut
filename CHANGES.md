# CHANGES — v1.4.2 → v1.4.3 (dark / light / auto appearance)

New: **Me → Appearance** — a three-way choice of **Auto / Dark / Light**, also on the desktop sidebar. One palette file
re-themes the whole app; the pick is remembered on the device. This set is **cumulative**: if you have not uploaded
v1.4.2 yet (the iOS scrub-then-Play fix), the files below include it — upload all **21** and you are current either way.
Totals: **4 new files · 17 changed files · 0 files to delete** (21 files to upload, including this one).

## How to update

1. Upload the files below into their folders (new files go in `src/app/`, `src/home/`, `src/store/`, `src/styles/`; the rest replace existing ones). Nothing to delete.
2. Commit. Check the **Actions** job is green — it was run here in full: typecheck · lint · format · **467 tests in 43 files** · build, all green.
3. If your phone is set to a light system theme, the app will now come up **light the first time** (Auto follows the system). Pick **Dark** once in Me → Appearance and it stays.

## New files (4)

- `src/app/theme.ts` — keeps `<html data-theme>` and the browser chrome (`color-scheme`, `theme-color`) in step with the saved pick, live
- `src/styles/theme.css` — the whole design palette: dark values (unchanged from today) by default, a light palette for `data-theme="light"`, and Auto adopting light when the system prefers it
- `src/home/ThemePicker.test.tsx` — the picker, its live switch, persistence, and its place in the Me tab and the sidebar (4 tests)
- `src/store/prefsStore.test.ts` — the appearance pref: defaults, saving, corrupt/old storage (4 tests)

## Changed files (17)

- `CHANGES.md` *(this note)*
- `Handover.md` *(header: version, what was verified this time)*
- `Knowledge_Contribution.md` *(L-059: theming chrome vs content)*
- `how_it_works.md` *(boot step, Home §10, Styling §11)*
- `index.html` *(reads the saved choice before first paint — no flash of the wrong theme; the page's split background follows it; a third inline script)*
- `package.json` / `package-lock.json` *(version 1.4.3)*
- `src/app/App.tsx` *(starts `initTheme()`, loads the palette)*
- `src/editor/timeline/Timeline.test.tsx` *(one line: the prefs store grew a `theme` field)*
- `src/home/Home.tsx` *(the ThemePicker; the "Appearance" row in Me; the sidebar control)*
- `src/store/prefsStore.ts` *(the `theme` preference, default Auto — saved like the timeline toggles)*
- `src/styles/app.css`, `editor.css`, `home.css`, `transitions.css` *(colours became tokens; the old per-screen copies of the palette are gone — one switch re-themes everything)*

## What you get, in plain words

- **Auto / Dark / Light** in Me → Appearance (and on desktop under the sidebar). The choice is saved on the device, applied before the app paints, and Auto even follows the system theme flipping while the app is open.
- **The whole app switches**: Home, the editor, dialogs, toasts, sliders, the status-bar tint (`theme-color`), and the browser's own controls (select dropdown, scrollbars) via `color-scheme`.
- **Your footage is not re-themed.** The video letterbox, the demo footage scenes, the Home hero and the timeline's teal/blue clip colours stay as they are in both themes — content keeps its look, like a video player. Only the chrome (panels, text, controls) switches.
- **Dark mode is today's look, exactly** — the dark palette is the same values, byte for byte, wherever they map onto tokens (a few near-duplicate greys were consolidated; indistinguishable).

## Verified here

- Full suite: typecheck · lint · format · **467 tests in 43 files** · production build — all green.
- Both themes exercised in a real (headless) Chromium, phone **and** desktop layouts: Home, Me tab, the picker switching live, the editor, persistence across reload, and a computed-style contrast sweep over ~30 representative elements in each theme — no unreadable text/background pairs, and the screenshots split cleanly dark (avg ≈ 50/255) vs light (≈ 206/255).
- Still not tested on a real iPhone (as ever) — but theming has no platform-specific code paths beyond `matchMedia`, which all iOS versions have.

## Files to DELETE from the repo (0)

_none_
