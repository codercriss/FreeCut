# CHANGES — v1.4.5 → v1.4.6 (1.4.2 is phone-verified; a record-keeping release)

**No code changed.** This release exists to record one thing and open one gate:

- **Your retest answered the question 1.4.2 was waiting for.** Scrub the timeline, then tap
  Play: **the picture appears — on your iPhone.** The iOS bug (sound with no picture after
  scrubbing) is **fixed and device-verified**. The fix — no `play()` until the in-flight seek has
  completed, playback starting exactly at the playhead, and the stall watchdog as the safety
  net — is unchanged in 1.4.5/1.4.6, so the result carries. This closes the "reasoned from the
  code and WebKit reports" caveat that has stood since 1.4.2 shipped.
- **1b.2 is unblocked.** The roadmap gate was "your retest"; the retest is in. The three
  candidates stand: pre-warming the next clip at a cut, a heavy-clip (1080p/4K, 60 fps) check,
  and moving the filmstrip image encode off the main thread.

**What did *not* change:** the app itself — bit for bit the 1.4.5 (= 1.4.2) build. The full
suite was still re-run green here (typecheck · lint · format · **459 tests in 41 files** ·
build) so this set's claims stay honest.

If 1.4.5 is already in the repo, upload the **6 files in this set**. If it is not (the theme
removal hasn't been uploaded yet), upload the 1.4.5 set first — or just import
`freecut_v1.4.6_backup.json`, which contains everything.

## How to update

1. Upload the files below into their folders (all replace existing ones). Nothing new, nothing to delete.
2. Commit. Check the **Actions** job — green here: typecheck · lint · format · tests · build.
3. Nothing to see on the phone — the change is in the records, not the app.

## Changed files (6)

- `CHANGES.md` *(this note)*
- `Handover.md` *(header: version/delivered/status/next; §10: the 1.4.2 retest result, for the record, and the retest script retitled to what's still open)*
- `Knowledge_Contribution.md` *(a device-verified record: the 1.4.2 fix confirmed on the owner's iPhone, and what it does not cover)*
- `Roadmap.md` *(1b: the retest gate is passed — 1b.2 is next, with its three candidate items and the still-needed e2e log)*
- `package.json` / `package-lock.json` *(version 1.4.6)*

## Still open on your side (unchanged)

- **P8 — heavy clip:** import your biggest (1080p/4K) video and run **Me → Playback check**; copy
  or screenshot the report. Every device number so far is from small clips.
- **P9 — the e2e log:** the red **End-to-end** jobs in GitHub → Actions; a screenshot of the
  last ~30 lines of the failing step (N40). 1b.2's final shape (and CI) waits on this.
