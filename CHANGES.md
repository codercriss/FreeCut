# CHANGES — Phase 0 (v1.1.0) → Phase 1a (v1.2.0)

Use this to update your GitHub repository **without re-uploading everything**.
Totals: **35 new files · 26 changed files · 0 files to delete · 93 unchanged** (61 files to upload, including this one).

## How to update (phone-friendly)

1. **Extract `freecut-phase-1a-changes.zip`** (GitHub can't read zips) and upload its contents — it holds exactly the *new* and *changed* files below, in their folders, and it is under GitHub's 100-files-per-upload limit, so a single upload works. Files with the same path are *replaced*.
2. **Delete** the files in the last section, if any (GitHub never deletes by itself): open each file → **⋯ → Delete file** → commit.
3. **Hidden files** (`.github/…`, `.gitignore`, `.prettier*`) are *not* uploaded by drag-and-drop — create them with **Add file → Create new file** and the full path (contents are in the chat message where I sent them). None of them changed this phase.
4. Commit. Vercel redeploys; check that the build is green and the **Me** tab shows **v1.2.0**.

> If a build fails with “Cannot find module …”, a file is missing from the repo — compare the repo's folders against the lists below.

## New files (35)
- `CHANGES.md`
- `docs/phase-1a/screenshots/desktop-library-and-timeline.png`
- `docs/phase-1a/screenshots/phone-1-library-after-import.png`
- `docs/phase-1a/screenshots/phone-2-library-imported-tiles.png`
- `docs/phase-1a/screenshots/phone-3-item-menu.png`
- `docs/phase-1a/screenshots/phone-4-timeline-with-imported-clips.png`
- `e2e/fixtures/README.md`
- `e2e/fixtures/broken.mp4`
- `e2e/fixtures/clip.webm`
- `e2e/fixtures/notes.txt`
- `e2e/fixtures/photo.png`
- `e2e/fixtures/tone.wav`
- `e2e/helpers.ts`
- `e2e/media.spec.ts`
- `src/editor/ImportToast.test.tsx`
- `src/editor/ImportToast.tsx`
- `src/editor/MediaPanel.test.tsx`
- `src/editor/StorageTip.test.tsx`
- `src/editor/timeline/Clips.test.tsx`
- `src/media/classify.test.ts`
- `src/media/classify.ts`
- `src/media/importStore.ts`
- `src/media/importer.test.ts`
- `src/media/importer.ts`
- `src/media/ingest.test.ts`
- `src/media/ingest.ts`
- `src/media/mediaStore.test.ts`
- `src/media/mediaStore.ts`
- `src/media/probe.ts`
- `src/media/thumbnail.test.ts`
- `src/media/thumbnail.ts`
- `src/media/useMediaUrl.test.tsx`
- `src/media/useMediaUrl.ts`
- `src/model/fixtures/project.v2.json`
- `src/ui/Dialog.tsx`

## Changed files (26) — replace these
- `Handover.md`
- `Knowledge_Contribution.md`
- `README.md`
- `Roadmap.md`
- `e2e/editor.spec.ts`
- `how_it_works.md`
- `package-lock.json`
- `package.json`
- `playwright.config.ts`
- `src/app/App.test.tsx`
- `src/app/App.tsx`
- `src/app/actions.ts`
- `src/app/boot.ts`
- `src/editor/Editor.tsx`
- `src/editor/MediaPanel.tsx`
- `src/editor/PlayerPanel.tsx`
- `src/editor/timeline/Clips.tsx`
- `src/engine/playback.tsx`
- `src/model/migrations.test.ts`
- `src/model/migrations.ts`
- `src/model/schema.ts`
- `src/model/types.ts`
- `src/storage/idb.ts`
- `src/store/commands.test.ts`
- `src/store/commands.ts`
- `src/styles/editor.css`

## Files to DELETE from the repo (0)
_none_
