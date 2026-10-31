# CHANGES — v1.2.3 → v1.3.0 (Phase 1b.0: research + Playback check)

Use this to update your GitHub repository **without re-uploading everything**.
Totals: **6 new files · 10 changed files · 0 files to delete · 158 unchanged** (16 files to upload, including this one).

## How to update (phone-friendly)

1. **Extract `freecut-phase-1b-0-changes.zip`** (GitHub can't read zips) and upload its contents — it holds exactly the *new* and *changed* files below, in their folders, and it is under GitHub's 100-files-at-a-time limit.
2. **Delete** the files in the last section, if any (GitHub never deletes by itself). This update deletes nothing.
3. **Hidden files** (`.github/…`, `.gitignore`, `.prettier*`) are *not* uploaded by drag-and-drop — and none of them changed in this update.
4. Commit. Vercel redeploys; check that the build is green and the **Me** tab shows **v1.3.0** and a new **Playback check** row.

> If a build fails with “Cannot find module …”, a file is missing from the repo — compare the repo's folders against the lists below.
>
> ⚠ **This delivery could not run the full test suite** (no network in the build sandbox — `Handover.md §2f`, N30). After you commit, open GitHub → **Actions**: if only the *format* step is red it is cosmetic; if anything else is red, screenshot it and send it to me.

## New files (6)
- `src/diagnostics/playbackCheck.test.ts`
- `src/diagnostics/playbackCheck.ts`
- `src/diagnostics/playbackCheckEnv.ts`
- `src/diagnostics/toneWav.test.ts`
- `src/diagnostics/toneWav.ts`
- `src/home/PlaybackCheckPanel.tsx`

## Changed files (10) — replace these
- `CHANGES.md`
- `Handover.md`
- `Knowledge_Contribution.md`
- `README.md`
- `Roadmap.md`
- `how_it_works.md`
- `package-lock.json` *(only the project's own version, 2 lines)*
- `package.json` *(version 1.2.3 → 1.3.0)*
- `src/home/Home.tsx` *(one new row in the Me list + the lazily loaded panel)*
- `src/styles/home.css` *(styles for the panel, appended at the end)*

## Files to DELETE from the repo (0)
_none_

## What changed, in plain words
- **Me → Playback check** (new): a report of what *your phone's browser* can do for playback — audio unlock, the silent-switch fix, which video/audio formats it accepts (including iPhone HEVC), and, using your own largest imported video, how fast it can decode sound, play smoothly (including skipped frames), copy frames to a canvas, scrub and upload to WebGL. Two buttons play a test tone to hear with the silent switch on. Copy the report or screenshot it.
- **Research** (R-001, R-004, R-005) and a **proposed playback design** (D-030) are in `Knowledge_Contribution.md` and `Handover.md`.
- **Nothing about editing, importing or playing changed.** There is still no sound; real playback is the next step (1b.1), built on what this check shows.
