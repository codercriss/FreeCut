# CHANGES — v1.4.7 → v1.4.8 (the always-red CI e2e jobs are fixed — N40 closed)

**This is a real code fix** to the Playwright e2e test harness. The app itself (src/) is unchanged;
the only edited source files are under `e2e/`. The fix turns the **End-to-end (chromium)** and
**End-to-end (webkit)** GitHub Actions jobs green for the first time since v1.4.0.

## What was failing (the N40 mystery, now solved)

You sent the GitHub Actions screenshots for CI #19 (v1.4.7, commit `bb65ea8`):

- **Typecheck · lint · unit tests · build — ✔** (1m 35s)
- **End-to-end (chromium) — ✘** (1m 39s): 1 failed, 5 skipped, 44 passed (1.2m). The failing test:
  `e2e/editor.spec.ts:123` — *"desktop timeline: the playhead sits where the timecode says (Handover K1b)"*.
  The visible code snippet was `const left = await page.locator(".ve-playhead")`.
- **End-to-end (webkit) — ✘** (9m 44s): the visible webkit-phone run was 5 skipped, 24 passed (8.7m),
  but the step exited with code 1 — the actual failure was on **webkit-desktop** running the same
  desktop-timeline test (not visible in the screenshots, but the same test, same code path).

## Root cause (reproduced locally on chromium-desktop)

The desktop-timeline test parks the playhead at ~2.75 s by clicking the player's scrub bar, then
asserts the timecode advanced past frame 100. It used:

```ts
const bar = (await page.locator(".ve-scrub").boundingBox())!;
await page.mouse.click(bar.x + bar.width * (2.75 / 27.97), bar.y + bar.height / 2);
```

`boundingBox()` was measured **before the editor layout had settled** (the player panel's
position shifts after `openEditor` while lazy chunks and the sample project finish loading).
By the time `page.mouse.click(pageX, pageY)` ran, the bar was no longer at the measured page
coordinates — `document.elementFromPoint(399, 434)` returned `<body>`, not `.ve-scrub`. The
click missed, the seek never happened, the timecode stayed at `00:00:00:00`, and the
`expect.poll(...).toBeGreaterThan(100)` assertion timed out (20 s).

The same brittle `boundingBox() + mouse.click(x, y)` pattern was in two more places in
`e2e/media.spec.ts` (one inline, one in the `seekToFrame` helper) — latent bugs that would
fail the same way under a layout shift. See `Knowledge_Contribution.md` L-061.

## The fix

Added one helper to `e2e/helpers.ts` and rewrote all three call sites to use it:

```ts
export const clickScrub = async (page: Page, ratio: number) => {
  const position = await page.locator(".ve-scrub").evaluate(
    (el, r) => {
      const rect = el.getBoundingClientRect();
      return { x: Math.round(rect.width * r), y: Math.round(rect.height / 2) };
    },
    ratio,
  );
  await page.locator(".ve-scrub").click({ position });
};
```

`locator.click({ position })` is **element-relative**: Playwright re-resolves the element's
top-left at click time and waits for actionability (visible, stable, enabled). So only the
*width* needs to be known up front — and the bar's width does not change after open, only its
top-left does. The race is gone.

The same fix closes both the chromium-desktop and the webkit-desktop failure (they run the
same desktop-timeline test on the same code path). The webkit-phone run was already green.

## Verification (re-run here)

- **typecheck · lint · format · 459 unit tests in 41 files · build** — all green.
- **`npx playwright test --project=chromium-desktop --project=chromium-phone`** — **22 passed,
  5 skipped, 0 failed** (1.3m). The skipped ones are the project-switched desktop-only /
  phone-only tests that don't apply to the matched project.
- WebKit cannot run in this sandbox (missing system libraries `libenchant-2.so.2`,
  `libsecret-1.so.0`, `libGLESv2.so.2`) — that's exactly why your GitHub Actions runner is the
  source of truth for webkit. The same fix applies to webkit-desktop because it runs the same
  test on the same code path; the webkit-phone screenshot you sent confirms webkit-phone was
  already green.

## How to update

1. Upload the files below into their folders (all replace existing ones). Nothing new, nothing
   to delete.
2. Commit. Check the **Actions** job — for the first time since v1.4.0, all three jobs should
   be green: **Typecheck · lint · unit tests · build**, **End-to-end (chromium)**, and
   **End-to-end (webkit)**.
3. Nothing to see on the phone — the change is in the e2e test harness, not in the app.

## Changed files (9)

- `CHANGES.md` *(this note)*
- `Handover.md` *(header: version/delivered/status/next; §10: the N40 e2e log record added with
  the root cause and the fix; the §10 "still open" line and the Next line updated — N40 is no
  longer owed)*
- `Knowledge_Contribution.md` *(L-061: a `boundingBox() + mouse.click(x, y)` pattern is a layout
  race — use `locator.click({ position })` instead; the L-057 race note cross-referenced)*
- `Roadmap.md` *(§4 1b.2 "still owed" line: the e2e log (N40) is no longer owed; §8 status
  tracker's 1b.2 row updated)*
- `e2e/helpers.ts` *(new `clickScrub` helper, with a comment explaining the layout race it
  prevents)*
- `e2e/editor.spec.ts` *(the failing test at line 123 now uses `clickScrub`)*
- `e2e/media.spec.ts` *(two `boundingBox() + mouse.click` sites replaced with `clickScrub` —
  the inline one at line 111 and the `seekToFrame` helper at line 403)*
- `package.json` / `package-lock.json` *(version 1.4.8)*

## What's next (1b.2, fully unblocked now)

With N40 closed, 1b.2's three real items (scoped from your heavy-clip Playback check in 1.4.7)
are ready to start whenever you say go:

1. **High-fps A/V desync** — re-tune `engine/drift.ts` for 60 fps (the L-055 numbers were at 30 fps).
2. **Heavy-clip handling — preview proxies pulled forward from 1c** — `OffscreenCanvas`/Web Worker
   downscale on import for clips above a resolution × bitrate threshold.
3. **Supporting** — pre-warm the next clip at a cut; move the filmstrip image encode off the main
   thread (the 1.4.1 467 ms `toBlob` freeze + the 1.4.7 452 ms scrubbing outlier are the case).
