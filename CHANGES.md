# CHANGES — v1.2.1 → v1.2.2 (real timeline filmstrips)

Use this to update your GitHub repository **without re-uploading everything**.
Totals: **7 new files · 17 changed files · 0 files to delete · 140 unchanged** (24 files to upload, including this one).

## How to update (phone-friendly)

1. **Extract `freecut-phase-1a-2-changes.zip`** (GitHub can't read zips) and upload its contents — it holds exactly the *new* and *changed* files below, in their folders, and it is under GitHub's 100-files-per-upload limit, so a single upload works. Files with the same path are *replaced*.
2. **Delete** the files in the last section, if any (GitHub never deletes by itself): open each file → **⋯ → Delete file** → commit.
3. **Hidden files** (`.github/…`, `.gitignore`, `.prettier*`) are *not* uploaded by drag-and-drop — create them with **Add file → Create new file** and the full path (contents are in the chat message where I sent them). None of them changed in this patch.
4. Commit. Vercel redeploys; check that the build is green and the **Me** tab shows **v1.2.2**.

> If a build fails with “Cannot find module …”, a file is missing from the repo — compare the repo's folders against the lists below.

## New files (7)
- `docs/phase-1a/screenshots/phone-5-real-filmstrip.png`
- `e2e/fixtures/clip8.webm`
- `src/media/filmstrip.test.ts`
- `src/media/filmstrip.ts`
- `src/media/filmstripQueue.test.ts`
- `src/media/filmstripQueue.ts`
- `src/media/useFilmstrip.ts`

## Changed files (17) — replace these
- `CHANGES.md`
- `Handover.md`
- `Knowledge_Contribution.md`
- `README.md`
- `Roadmap.md`
- `e2e/fixtures/README.md`
- `e2e/media.spec.ts`
- `how_it_works.md`
- `package-lock.json`
- `package.json`
- `src/editor/timeline/Clips.test.tsx`
- `src/editor/timeline/Clips.tsx`
- `src/media/mediaStore.test.ts`
- `src/media/mediaStore.ts`
- `src/media/poster.ts`
- `src/media/useMediaUrl.ts`
- `src/styles/editor.css`

## Files to DELETE from the repo (0)
_none_
