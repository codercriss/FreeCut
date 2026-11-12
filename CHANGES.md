# CHANGES — v1.4.1 → v1.4.2 (iOS: scrub, tap Play → sound but no picture)

Fixes the reported iPhone bug: **scrub the timeline to a position, tap Play → the sound plays but the
video doesn't.** Totals: **0 new files · 5 changed files · 0 files to delete** (5 files to upload, including
this one).

## How to update

1. Upload the files below into their folders (they replace existing ones). Nothing to delete.
2. Commit. Check the **Actions** job is green (typecheck · lint · unit tests · build were all run here: **41 files,
   459 tests passed**, build green).
3. Consider bumping nothing else — this is a playback-start fix only; the model, storage and audio are untouched.

## Changed files (5) — replace these

- `CHANGES.md` *(this note)*
- `package.json` *(version 1.4.1 → 1.4.2)*
- `package-lock.json` *(only the project's own version, 2 lines)*
- `src/editor/Stage.tsx` *(how playback of the on-screen `<video>` starts — see below)*
- `src/editor/Stage.test.tsx` *(4 new tests: the iOS-like start, its mutation-check, and all the old ones)*

## What was wrong, in plain words

The bug needed three things to line up, which is why it only showed on the iPhone and only after a scrub:

1. **Scrubbing leaves a seek in flight.** While your finger moves, Safari's fast keyframe seek gives the live
   preview; **~170 ms after the playhead stops**, an exact seek lands the right frame. Tapping Play usually
   arrives while that exact seek is still running (`seeking` is still true).
2. **Play was called straight into that seek.** The old code called `video.play()` no matter what. On
   iOS/WebKit, `play()` racing a pending seek can leave the element "playing" (`paused` is false) while **no
   frame is ever presented** — and `requestVideoFrameCallback` only fires for presented frames, so the video
   never reported itself "really moving" and never showed. (Chromium doesn't have `fastSeek` and doesn't
   behave this way — that's why desktop was fine.)
3. **Even without a full stall, the anchor was wrong.** "Really moving" was measured from `currentTime` at Play
   time — but iOS reports the *pending seek target* immediately, while the decoder is still a keyframe behind it
   (seconds, on long-GOP HEVC iPhone video). Measured from too far ahead, "moving" could never come true.

Meanwhile the sound doesn't depend on any of this: the transport waits `WAIT.video` (1500 ms), gives up on the
picture, and Web Audio starts anyway. Result: exactly what you saw — sound, frozen picture.

## What changed (all in `StageVideo`, `src/editor/Stage.tsx`)

- **A start never plays into a pending seek.** If a seek is in flight when Play is tapped, the start waits for
  `seeked` (the watchdog below covers a `seeked` the browser never sends).
- **A start begins exactly at the playhead.** Play cancels the scrub's settle seek, which can leave the video
  on a keyframe near — but not at — the playhead; so the start re-seeks to the playhead and waits for that seek
  to land before playing.
- **"Really moving" is anchored where playback actually starts** (where the seek landed), re-anchored whenever
  a seek lands during the start, instead of where `currentTime` said it was going.
- **Stall insurance.** If nothing has been presented for 750 ms (no frame callback ran), the position is
  re-asserted and playback started again — politely first, forced second — then it stops trying (the poster
  stays, the sound carries on; the old behaviour, not a crash loop).

**Deliberately unchanged:** `WAIT.video` (1500 ms), the drift controller, the audio engine, the transport —
the hand-off between picture and clock works as before once the video reports moving.

## Tests

Four new tests in `src/editor/Stage.test.tsx` use an **iOS-like fake video** (a seek sets `seeking` until
`seeked` fires; `currentTime` reports the pending target at once; frames appear only through the frame callback
the test triggers — the shape documented in Knowledge_Contribution L-035):

1. Play straight after a scrub waits for the seek to land, re-seeks to the playhead, plays only then, and
   reports "moving" from where playback really started.
2. Play with nothing pending plays at once (guard against over-caution).
3. A stalled start (nothing ever presented) is restarted twice, then gives up — without piling up seeks.
4. A `seeked` that never comes is not waited for forever (the watchdog plays as a last resort).

**Mutation-checked:** against the old `Stage.tsx`, tests 1, 3 and 4 fail; with the fix, all 20 in the file and
**459 in the whole suite** pass, and typecheck · lint · format · build are green.

## Still unproven

Everything above about iOS is *reasoned from the code and the project's own device notes (R-004/R-005,
L-034, L-045)* and corroborating reports of WebKit stalls around rapid/pending seeks — not yet seen on a real
iPhone. **Your retest decides:** on the iPhone, scrub to the middle of a long clip and tap Play right after
lifting your finger — the picture should start within ~0.5 s together with the sound; also try Play while the
scrub is still gliding, and Play twice quickly (pause/play). If it still stalls, the new watchdog should at
least recover it within ~1 s — and if it doesn't, that fact alone narrows the cause and I'd like to know.
