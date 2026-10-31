# CHANGES — v1.3.0 → v1.3.1 (Phase 1b.0 patch 1: the A/B/A playback re-probe)

Use this to update your GitHub repository **without re-uploading everything**.
Totals: **0 new files · 12 changed files · 0 files to delete · 162 unchanged** (12 files to upload, including this one).

## How to update (phone-friendly)

1. **Extract `freecut-phase-1b-0-1-changes.zip`** (GitHub can't read zips) and upload its contents — it holds exactly the *changed* files below, in their folders.
2. **Delete** nothing — this update removes no files.
3. **Hidden files** (`.github/…`, `.gitignore`, `.prettier*`) are *not* uploaded by drag-and-drop — and none of them changed.
4. Commit. Vercel redeploys; check that the build is green and **Me** shows **v1.3.1**.

> If a build fails with “Cannot find module …”, a file is missing from the repo — compare the repo's folders against the list below.
>
> ⚠ **This delivery again could not run the full test suite** (no network in the build sandbox — `Handover.md §2g`, N30). After you commit, open GitHub → **Actions**: if only the *format* step is red it is cosmetic; if anything else is red, screenshot it and send it to me.

## Changed files (12) — replace these
- `CHANGES.md`
- `Handover.md`
- `Knowledge_Contribution.md`
- `README.md`
- `Roadmap.md`
- `how_it_works.md`
- `package-lock.json` *(only the project's own version, 2 lines)*
- `package.json` *(version 1.3.0 → 1.3.1)*
- `src/diagnostics/playbackCheck.test.ts`
- `src/diagnostics/playbackCheck.ts`
- `src/diagnostics/playbackCheckEnv.ts`
- `src/home/PlaybackCheckPanel.tsx`

## Files to DELETE from the repo (0)
_none_

## What changed, in plain words
- **Your first report is recorded** (`Handover.md §10` “First device run”): audio is solid on your iPhone; WebCodecs can't decode HEVC (so iPhone clips keep playing through the browser's own video); one result — a hidden video playing at **0.42× real time** — is unexplained.
- **The Playback check is now an A/B/A test** to explain it: the same video plays *hidden*, then *visible* (a small thumbnail **flashes in the top-left corner**), then *hidden again*, then *visible with every frame painted to a canvas*. Each run records a timeline (slow start vs slow crawl), start-up delay, stalls and the decoder's own dropped-frame count. The three-way pattern names the cause by itself.
- **Two weak measurements fixed:** the single 2-second average, and the “copy to canvas 0.0 ms” (which only timed queueing). The copy cost is now measured separately, because forcing it during playback made the video itself drop frames.
- **Nothing about editing, importing or playing changed**, and there is still no sound. Real playback (1b.1) waits for the re-run.
