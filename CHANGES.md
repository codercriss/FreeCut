# CHANGES — v1.2.2 → v1.2.3 (full-quality player)

Use this to update your GitHub repository **without re-uploading everything**.
Totals: **4 new files · 15 changed files · 0 files to delete · 149 unchanged** (19 files to upload, including this one).

## How to update (phone-friendly)

1. **Extract `freecut-phase-1a-3-changes.zip`** (GitHub can't read zips) and upload its contents — it holds exactly the *new* and *changed* files below, in their folders, and it is under GitHub's 100-files-per-upload limit, so a single upload works. Files with the same path are *replaced*.
2. **Delete** the files in the last section, if any (GitHub never deletes by itself): open each file → **⋯ → Delete file** → commit.
3. **Hidden files** (`.github/…`, `.gitignore`, `.prettier*`) are *not* uploaded by drag-and-drop — create them with **Add file → Create new file** and the full path (contents are in the chat message where I sent them). None of them changed in this patch.
4. Commit. Vercel redeploys; check that the build is green and the **Me** tab shows **v1.2.3**.

> If a build fails with “Cannot find module …”, a file is missing from the repo — compare the repo's folders against the lists below.

## New files (4)
- `docs/phase-1a/screenshots/phone-6-original-quality-photo.png`
- `e2e/fixtures/big.png`
- `src/editor/Stage.test.tsx`
- `src/editor/Stage.tsx`

## Changed files (15) — replace these
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
- `src/editor/PlayerPanel.tsx`
- `src/media/filmstrip.test.ts`
- `src/media/filmstrip.ts`
- `src/media/thumbnail.ts`
- `src/styles/editor.css`

## Files to DELETE from the repo (0)
_none_
