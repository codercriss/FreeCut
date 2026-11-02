# CHANGES — v1.3.1 → v1.4.0 (Phase 1b.1: real playback with sound)

Use this to update your GitHub repository **without re-uploading everything**.
Totals: **8 new files · 11 changed files · 0 files to delete · 163 unchanged** (19 files to upload, including this one).

## How to update (phone-friendly)

1. **Extract `freecut-phase-1b-1-changes.zip`** (GitHub can't read zips) and upload its contents — it holds exactly the *new* and *changed* files below, in their folders (the new files go in `src/engine/`). It is under GitHub's 100-files-at-a-time limit.
2. **Delete** nothing — this update removes no files.
3. **Hidden files** (`.github/…`, `.gitignore`, `.prettier*`) are *not* uploaded by drag-and-drop — and none of them changed.
4. Commit. Vercel redeploys; check that the build is green and **Me** shows **v1.4.0**.

> If a build fails with “Cannot find module …”, a file is missing from the repo — compare the repo's folders against the lists below (the 8 new files are the usual suspects).
>
> ⚠ **This delivery again could not run the full test suite** (no network in the build sandbox — `Handover.md §2h`, N30). After you commit, open GitHub → **Actions**. This is the first time your real tests (including the existing Play test) run against the new playback code: if only the *format* step is red it is cosmetic; if anything else is red, screenshot it and send it to me.

## New files (8) — all in `src/engine/`
- `src/engine/audioEngine.test.ts`
- `src/engine/audioEngine.ts`
- `src/engine/audioEngineEnv.ts`
- `src/engine/audioPlan.test.ts`
- `src/engine/audioPlan.ts`
- `src/engine/transport.test.ts`
- `src/engine/transport.ts`
- `src/engine/videoSync.ts`

## Changed files (11) — replace these
- `CHANGES.md`
- `Handover.md`
- `Knowledge_Contribution.md`
- `README.md`
- `Roadmap.md`
- `how_it_works.md`
- `package-lock.json` *(only the project's own version, 2 lines)*
- `package.json` *(version 1.3.1 → 1.4.0)*
- `src/editor/PlayerPanel.tsx` *(the level meter now reads real levels)*
- `src/editor/Stage.tsx` *(the video really plays while playing and follows the playhead)*
- `src/engine/playback.tsx` *(the playhead follows the audio clock; sound engine wired in)*

## Files to DELETE from the repo (0)
_none_

## What changed, in plain words
- **Play now really plays.** Imported videos and audio play with sound, picture and sound together and kept in step. The picture is real moving video (no more slideshow while Play is on). The **level meter is real** (flat when there is no sound, e.g. the demo project). Muted tracks are silent. Jumping while playing, running to the end and replaying all work.
- **How it starts:** pressing Play on a video waits a brief moment (usually well under half a second) for the picture to be genuinely moving, then sound and playhead start together. Everything else starts at once; **the picture never waits for sound**. If sound can't run for any reason, playback simply continues without it.
- **Why it's built this way:** your Playback-check reruns showed a muted video plays at full speed on your iPhone (the earlier slow reading was a first-play warm-up) and that sound unlocks from the tap — so the video stays an ordinary on-screen video and sound comes from Web Audio.
- **First-cut limits** (listed in `Handover.md` N36): a cut to a *different* video file shows a still picture for a moment; files over **60 MB play picture-only** until the long-file work in 1c; clip speed also changes pitch; no per-clip volume yet; edits made while playing are heard from the next Play.
- **Nothing was removed.** The Me-tab **Playback check** is unchanged. Test it on your iPhone with the script at the top of `Handover.md §10`.
