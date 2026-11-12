# CHANGES — v1.4.6 → v1.4.7 (P8 is in — the heavy-clip Playback check arrived, and it re-scoped 1b.2)

**No code changed.** This release exists to record three things that arrived in the same message from your phone, and to turn 1b.2 from a list of candidates into a list of real bugs:

- **P8 is no longer open.** Your heavy-clip Playback-check report came back (v1.4.5, same iPhone X · iOS 16.7 · Home Screen app · 375×812 @3× · 4 cores; test clip 576×576 · 68.7 s · 8.7 MB HEVC). The full environment and playback tables are now in `Handover.md §10` ("1.4.5 heavy-clip Playback check"). The headline numbers: hidden-video playback is **perfect** (86 frames, 0 skipped, clock 0.97×); the **visible / canvas-painting path drops 5–9 % of frames** (6/88, 8/86, 4/87 across the three runs); scrubbing worst case **452 ms**; canvas per-frame median **16 ms**; WebGL upload median **1 ms**; HEVC audio decode **59 ms**. WebCodecs HEVC decode is still ✘ ("Config is not valid" at 1080p and 4K) — same as 1.3.x, so `<video>` stays the picture path. Recorded as `Knowledge_Contribution.md` L-059.
- **Two new bugs**, reported alongside the numbers, that **become 1b.2's actual scope** (no more "candidates"):
  1. **High-fps A/V desync** — on high-frame-rate clips the audio-clock master keeps the sound right but the picture over-runs, so **audio runs ahead of video**. The drift controller (`engine/drift.ts`, L-055) was tuned against ~30 fps clips; its ±80 ms dead zone and ±6 % held correction are too coarse at 60 fps. Plan: re-measure at 60 fps in the same Chromium harness that produced the L-055 numbers, then re-tune. Recorded as L-060(a).
  2. **Heavy / high-quality clips not handled** — the 5–9 % visible-path frame drops above are not just a measurement, they are the editing experience on heavy footage. Fix shape: a low-res preview **proxy** generated on import for clips above a resolution/bitrate threshold (export still uses the original). This **pulls the proxy investigation forward from Phase 1c** into 1b.2. Recorded as L-060(b).
- **1b.2 is now scoped from real device data.** The supporting items from before (pre-warming the next clip at a cut; moving the filmstrip image encode off the main thread — the 1.4.1 measurement of a 467 ms `toBlob` freeze plus the new 452 ms scrubbing outlier are the case) stay in. `Roadmap.md §4` 1b.2 and `§8` status tracker are updated.

**What did *not* change:** the app itself — bit for bit the 1.4.5/1.4.6 (= 1.4.2) build. The full suite was still re-run green here (typecheck · lint · format · **459 tests in 41 files** · build) so this set's claims stay honest.

If 1.4.6 is already in the repo, upload the **6 files in this set**. If it is not, upload the 1.4.6 set first — or just import `freecut_v1.4.7_backup.json`, which contains everything.

## How to update

1. Upload the files below into their folders (all replace existing ones). Nothing new, nothing to delete.
2. Commit. Check the **Actions** job — green here: typecheck · lint · format · tests · build.
3. Nothing to see on the phone — the change is in the records, not the app.

## Changed files (6)

- `CHANGES.md` *(this note)*
- `Handover.md` *(header: version/delivered/status/next; §10: the heavy-clip Playback-check report as a new dated device-run record; P8 row struck through and marked done; P4/P5 cross-referenced to the new bugs; the 1.4.2 retest record's "not covered" line updated — P8 is no longer open)*
- `Knowledge_Contribution.md` *(L-059 heavy-clip Playback check, device-verified; L-060 high-fps A/V desync + heavy-clip handling, device-reported; R-004 and R-005 status rows updated with the new device numbers and the new open drift-controller work)*
- `Roadmap.md` *(§4 1b.2 re-scoped from real device data — three concrete items; §4 1c notes the proxy preview path now starts in 1b.2; §8 status tracker gets a 1b.2 row with the new scope and a 1b.1 row that records the 1.4.2 phone-verified result and the 1.4.5 rollback)*
- `package.json` / `package-lock.json` *(version 1.4.7)*

## Still open on your side (narrower now)

- **P9 — the e2e log:** the red **End-to-end** jobs in GitHub → Actions; a screenshot of the last ~30 lines of the failing step (N40). This is the only device-side item still owed.
- **(Optional) another heavy-clip report:** if you import an even bigger or differently-encoded clip and want to send another Playback check, the panel is still there — it would help pick the proxy threshold for 1b.2. Not required.
