# CHANGES — v1.4.3 → v1.4.4 (light mode everywhere + the Appearance dropdown)

Two things, both born from your screenshots of 1.4.3:

1. **Light mode now really covers everything** — the first theme pass (1.4.3) left a handful of small
   pieces hard-coded dark, and some of them actively broke in light mode: the **bottom tab bar** (dark
   bar + dark labels), the **play / playhead** buttons (white icons on light panels), the white
   **FreeCut logo** on the light sidebar and avatar, the desktop **scrub marker**, the **"New video"
   card** (white text on bright teal), the editor's **storage tip**, the **storage-unavailable banner**,
   the media-rail / timeline-tool **active tints**, the **slider hover halo**, and the **dialog backdrop**.
   All of these are now theme tokens (`theme.css`); dark mode is byte-for-byte today's look, and the
   content you edit (video letterbox, footage scenes, hero artwork, the timeline's teal/blue clips)
   still keeps its own colours in both themes, like a video player.
2. **Appearance is a dropdown now** (Me → Appearance, and the desktop sidebar) instead of three
   side-by-side buttons. The closed button shows the current choice with its icon; tapping it opens a
   small menu with **Auto / Dark / Light** and a check mark on the saved one. It closes on a tap outside,
   a scroll, or Escape (which hands focus back), and it announces itself properly to screen readers
   (`aria-expanded` / `listbox`). The Me list card no longer clips it open.

This set is **cumulative**: if you have not uploaded v1.4.3 yet, the files below include it — upload
all **23** and you are current either way (from v1.4.2). If v1.4.3 is already in the repo, upload the
**14 files in this set**.
Totals (this set): **0 new files · 14 changed files · 0 files to delete**.

## How to update

1. Upload the files below into their folders (all replace existing ones). Nothing to delete, nothing new.
2. Commit. Check the **Actions** job is green — it was run here in full: typecheck · lint · format · **469 tests in 43 files** · build, all green.
3. To see it: pick **Light** in Me → Appearance. Flip between Light and Dark and watch the small stuff too — the tab bar, the editor's play button, the logo, the storage tip.

## Changed files (14)

- `CHANGES.md` *(this note)*
- `Handover.md` *(header: version, what was verified this time)*
- `Knowledge_Contribution.md` *(L-060: dropdowns inside clipped cards; completing a theme pass)*
- `how_it_works.md` *(Appearance §10: dropdown; theming §11: the new token group)*
- `package.json` / `package-lock.json` *(version 1.4.4)*
- `src/styles/theme.css` *(new "chrome extras" tokens — bar, accent tints, glow, scrim, tip, warning banner, CTA gradient — dark values identical to today's hard-coded ones; light values freshly tuned)*
- `src/styles/editor.css` *(play/scrub-mark/playhead colours, slider halo, active tints, storage tip, dialog backdrop — all tokens now)*
- `src/styles/home.css` *(tab bar token; "New video" gradient tokens; the dropdown's styles; the Me list no longer clips menus)*
- `src/styles/app.css` *(storage-unavailable banner → tokens)*
- `src/ui/BrandMark.tsx` *(the "F" is `currentColor` — it was white-only and vanished on light panels)*
- `src/editor/timeline/Clips.tsx` *(the playhead handle follows the playhead colour via `currentColor`)*
- `src/home/Home.tsx` *(ThemePicker rewritten as a dropdown: closed state, menu, outside-tap / scroll / Escape close, focus return, aria)*
- `src/home/ThemePicker.test.tsx` *(rewritten for the dropdown: 6 tests — open/close, the three options, live switch + persistence, outside tap, scroll, Escape + focus)*

## What you get, in plain words

- **Light mode is finished, down to the tiny things.** The phone's bottom bar is now frosted white in light (it was near-black with dark-grey labels — unreadable); the editor's play button, scrub marker and both playheads are ink-coloured where they used to be white-on-white; the logo, the storage tip and the warning banner get light-mode equivalents; active tints follow the (darker) light-mode accent; the "New video" card gets a deeper teal gradient so its white text still passes.
- **Dark mode did not move.** Every token's dark value is the same number that was hard-coded before — verified by eye and by the diff.
- **The appearance control is one neat dropdown** showing the current choice (icon + name + chevron), with the three options in a menu that checks the saved one and closes politely.

## Verified here

- Full suite: typecheck · lint · format · **469 tests in 43 files** · production build — all green (the two net-new tests cover the dropdown's open/close behaviour).
- Both themes exercised on the same screens as 1.4.3's sweep, plus the new dropdown: opened from the Me row and the sidebar, selection, closure. The old light-mode failures listed above (tab-bar labels, play button, scrub marker, logo) were re-checked in a real (headless) Chromium in light mode.
- Still not tested on a real iPhone — nothing in this set is platform-specific (CSS tokens + one small React component).

## Files to DELETE from the repo (0)

_none_
