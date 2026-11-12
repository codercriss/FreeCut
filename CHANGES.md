# CHANGES — v1.4.0 → v1.4.1 (smoother picture, scrubbing and zoom)

Use this to update your GitHub repository **without re-uploading everything**.
Totals: **4 new files · 18 changed files · 0 files to delete · 164 unchanged** (22 files to upload, including this one).

## How to update (phone-friendly)

1. **Extract `freecut-phase-1b-1-1-changes.zip`** (GitHub can't read zips) and upload its contents — it holds exactly the *new* and *changed* files below, in their folders (new files go in `src/engine/`; the others replace existing ones). It is under GitHub's 100-files-at-a-time limit.
2. **Delete** nothing — this update removes no files.
3. **Hidden files** (`.github/…`, `.gitignore`, `.prettier*`) are *not* uploaded by drag-and-drop — and none of them changed.
4. Commit. Vercel redeploys; check that the build is green and **Me** shows **v1.4.1**.

> If a build fails with “Cannot find module …”, a file is missing from the repo — compare the repo's folders against the lists below (the 4 new files in `src/engine/` are the usual suspects).
>
> After you commit, open GitHub → **Actions**. The first job (typecheck · lint · format · unit tests · build) should be ✔ — it was on 1.4.0. **For each red “End-to-end” job**, open it, find the red step and screenshot the last ~30 lines of the log (see `Handover.md` N40): those jobs have been red since before this work and I need their messages.

## New files (4) — in `src/engine/`
- `src/engine/busy.test.ts`
- `src/engine/busy.ts`
- `src/engine/drift.test.ts`
- `src/engine/drift.ts`

## Changed files (18) — replace these
- `CHANGES.md`
- `Handover.md`
- `Knowledge_Contribution.md`
- `README.md`
- `Roadmap.md`
- `how_it_works.md`
- `package-lock.json` *(only the project's own version, 2 lines)*
- `package.json` *(version 1.4.0 → 1.4.1)*
- `src/editor/Stage.tsx` *(the playing picture follows the live clock with a dead zone; Safari fast-seek scrubbing)*
- `src/editor/timeline/Clips.tsx` *(demo clips draw at most 10 tiles)*
- `src/editor/timeline/MobileTimeline.tsx` *(no layout read per frame while playing; throttled pinch; busy pulses)*
- `src/engine/playback.tsx` *(live-clock reader, ~30×/s on-screen refresh, busy hold, exact stop frame)*
- `src/engine/transport.test.ts`
- `src/engine/transport.ts` *(read-only `peek`)*
- `src/media/filmstrip.test.ts`
- `src/media/filmstrip.ts` *(waits while you are busy; lets go of its hidden video after a long wait)*
- `src/media/filmstripQueue.test.ts`
- `src/media/filmstripQueue.ts` *(waits for a quiet moment before starting)*

## Files to DELETE from the repo (0)
_none_

## What changed, in plain words
Your first phone test of 1.4.0: sound smooth; picture not smooth or in step; scrubbing and zoom very choppy. I profiled the real app and found, and fixed:
- **Two videos at once.** Each new clip's thumbnail strip is built in the background with a *second hidden video* — right when you press Play. It now **waits while you play, scrub or zoom**, and lets go of its hidden video if it has to wait long.
- **A hyperactive sync controller.** My picture-sync code changed the video's speed **177 times in 5 seconds**, which can stutter a phone. Now it leaves the video alone inside a small dead zone and follows the live clock: **0 speed changes**, picture within 0.02 s.
- **Per-frame timeline work.** No more forced layout on every frame while playing; the on-screen number refreshes ~30×/s (picture and sound still run at full rate).
- **Zoom and scrub cost.** Demo scenes (~500 shapes per tile) made zooming create 22,000 nodes — demo clips now use ≤ 10 tiles (**zoom step 60–140 ms → ~24 ms**); pinch applies the latest zoom ~every 90 ms; scrubbing uses Safari's fast keyframe seek while your finger moves and lands the exact frame when it stops.
- **Also fixed before delivery:** pressing Pause used to let the timecode creep forward 1–2 frames (it would have failed your own Play test) — fixed.

**Still unproven:** all of this is measured in Chromium on a slow, CPU-starved machine, not on an iPhone. Your retest (`Handover.md §10`) decides.
