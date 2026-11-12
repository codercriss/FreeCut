# CHANGES — v1.4.4 → v1.4.5 (the appearance switcher is gone)

One thing, and it is a removal: **the dark / light / auto theme feature introduced in v1.4.3 and
completed in v1.4.4 has been taken out completely.** FreeCut is dark-only again — pixel for pixel
the v1.4.2 look, which was always the intended one.

What went:

- **Me → Appearance** (and the desktop sidebar row) — gone. The dropdown, its three options, its
  tests: deleted. The Me list is back to exactly what it was before 1.4.3.
- **The palette machinery** — gone. `src/styles/theme.css`, the ~35 design tokens, the
  `data-theme` switch, the pre-paint boot script in `index.html`, and `src/app/theme.ts`
  (which kept `<html data-theme>` and the `color-scheme` / `theme-color` meta tags in step).
  Every colour is hard-coded again, exactly the numbers from before 1.4.3.
- **The `theme` preference** — gone. `prefsStore` is back to the four timeline toggles
  (magnet / snap / link / axis). A saved `freecut.prefs` entry that still contains a `theme`
  field is simply ignored — nothing breaks for anyone who picked one.
- **The knock-on touch-ups** 1.4.3/1.4.4 had made so the second palette would work — also back
  out: the logo's "F" and the playhead handle are white again (they no longer need
  `currentColor`), and the split boot background in `index.html` is the fixed dark pair again.

Nothing else moved: the 1.4.2 iOS scrub-then-Play fix, playback, imports, the library — all
exactly as they were in v1.4.2. If v1.4.4 (or 1.4.3) is in the repo, upload the **17 files in this
set** and delete the **4 files** listed at the bottom. If you are still on 1.4.2, only the
docs + version files differ — the eleven source files will replace themselves with identical
content to what you have, minus the 1.4.3+ changes you never took.

## How to update

1. Upload the files below into their folders (all replace existing ones).
2. **Delete the 4 files listed at the bottom** — they are the feature itself.
3. Commit. Check the **Actions** job is green — it was run here in full: typecheck · lint · format · tests · build, all green.
4. To see it: open **Me** — no Appearance row. The app is dark, and there is no way (or need) to change that.

## Changed files (17)

- `CHANGES.md` *(this note)*
- `Handover.md` *(header: version, what was verified this time)*
- `how_it_works.md` *(reverted to the pre-1.4.3 text: boot sequence, Home, styling sections no longer describe themes)*
- `Knowledge_Contribution.md` *(L-059 / L-060 — the two theming lessons — removed with the feature they describe)*
- `package.json` / `package-lock.json` *(version 1.4.5)*
- `index.html` *(the pre-paint theme script and the themed boot colours are gone; the fixed dark split background is back)*
- `src/app/App.tsx` *(no `initTheme()` and no theme.css import — back to the plain boot sequence)*
- `src/store/prefsStore.ts` *(no `Theme` type, no `theme` field, no `setTheme` — the four timeline toggles only)*
- `src/home/Home.tsx` *(no `ThemePicker` — the Me tab and the desktop sidebar are back to their pre-1.4.3 rows)*
- `src/styles/app.css` · `src/styles/editor.css` · `src/styles/home.css` · `src/styles/transitions.css`
  *(every `var(--…)` from the theme tokens is back to the hard-coded dark value it was before 1.4.3; dark mode was byte-identical all along, so these are effectively the 1.4.2 stylesheets)*
- `src/ui/BrandMark.tsx` *(the "F" is `#fff` again — it only needed `currentColor` for light panels)*
- `src/editor/timeline/Clips.tsx` *(the playhead handle is `#fff` again — same reason)*
- `src/editor/timeline/Timeline.test.tsx` *(back to the plain `setState` — no `theme` field to preserve)*

## Files to DELETE from the repo (4)

- `src/app/theme.ts` *(the live theme applier)*
- `src/styles/theme.css` *(the token palette — dark and light)*
- `src/home/ThemePicker.test.tsx` *(its 6 dropdown tests)*
- `src/store/prefsStore.test.ts` *(the theme-persistence tests)*

## Verified here

- Full suite: typecheck · lint · format · **459 tests in 41 files** · production build — all green
  (the 10 theme tests went with the feature; 459 is exactly the v1.4.2 count).
- The eleven reverted source files are **bit-for-bit the v1.4.2 versions** (reverted against the
  exact pre-feature commit, then re-checked), so the app's look and behaviour carry 1.4.2's
  verification with them. The only new code is nothing — this release is a removal.
- Still not tested on a real iPhone — nothing here is platform-specific.
