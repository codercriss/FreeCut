# CHANGES — v1.2.0 → v1.2.1 (iPhone thumbnail patch)

Use this to update your GitHub repository **without re-uploading everything**.
Totals: **3 new files · 22 changed files · 0 files to delete · 132 unchanged** (25 files to upload, including this one).

## How to update (phone-friendly)

1. **Extract `freecut-phase-1a-1-changes.zip`** (GitHub can't read zips) and upload its contents — it holds exactly the *new* and *changed* files below, in their folders, and it is under GitHub's 100-files-per-upload limit, so a single upload works. Files with the same path are *replaced*.
2. **Delete** the files in the last section, if any (GitHub never deletes by itself): open each file → **⋯ → Delete file** → commit.
3. **Hidden files** (`.github/…`, `.gitignore`, `.prettier*`) are *not* uploaded by drag-and-drop — create them with **Add file → Create new file** and the full path (contents are in the chat message where I sent them). None of them changed in this patch.
4. Commit. Vercel redeploys; check that the build is green and the **Me** tab shows **v1.2.1**.

> If a build fails with “Cannot find module …”, a file is missing from the repo — compare the repo's folders against the lists below.

## New files (3)
- `src/editor/ThumbnailAction.test.tsx`
- `src/media/poster.test.ts`
- `src/media/poster.ts`

## Changed files (22) — replace these
- `CHANGES.md`
- `Handover.md`
- `Knowledge_Contribution.md`
- `README.md`
- `Roadmap.md`
- `e2e/media.spec.ts`
- `how_it_works.md`
- `package-lock.json`
- `package.json`
- `src/editor/ImportToast.test.tsx`
- `src/editor/ImportToast.tsx`
- `src/editor/MediaPanel.tsx`
- `src/editor/PlayerPanel.tsx`
- `src/media/importStore.ts`
- `src/media/importer.test.ts`
- `src/media/importer.ts`
- `src/media/ingest.test.ts`
- `src/media/ingest.ts`
- `src/media/thumbnail.ts`
- `src/media/useMediaUrl.test.tsx`
- `src/media/useMediaUrl.ts`
- `src/styles/editor.css`

## Files to DELETE from the repo (0)
_none_
