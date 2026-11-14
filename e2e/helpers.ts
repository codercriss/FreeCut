import { expect, test as base, type Page } from "@playwright/test";

/** Every test fails on an uncaught page error or console error. */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
      });
      await use(errors);
      expect(errors, "no console / page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export const openEditor = async (page: Page, isMobile: boolean) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: isMobile ? "New video" : "New project" })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Back to home" })).toBeVisible();
};
export const homeVisible = (page: Page, isMobile: boolean) =>
  expect(
    page.getByRole("button", { name: isMobile ? "New video" : "New project" }).first(),
  ).toBeVisible();

/** Make sure playback is paused (the editor opens paused, but a test may have pressed Play). */
export const pause = async (page: Page) => {
  const pauseBtn = page.getByRole("button", { name: "Pause", exact: true });
  if (await pauseBtn.isVisible()) await pauseBtn.click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
};

/**
 * Click the player's scrub bar at a relative position (0..1 of its width).
 *
 * Robust against layout shifts: `page.mouse.click(pageX, pageY)` with coordinates from an
 * earlier `boundingBox()` call breaks if `.ve-scrub`'s top-left moves between the measure and
 * the click (the editor layout settles after `openEditor`). `locator.click({ position })` is
 * element-relative — Playwright re-resolves the element's top-left at click time and waits for
 * actionability — so only the *width* needs to be known up front, and the width does not change
 * after open. This was the root cause of the always-red CI e2e jobs (N40): the desktop-timeline
 * test measured the bar too early and clicked where the bar no longer was.
 */
export const clickScrub = async (page: Page, ratio: number) => {
  const position = await page.locator(".ve-scrub").evaluate((el, r) => {
    const rect = el.getBoundingClientRect();
    return { x: Math.round(rect.width * r), y: Math.round(rect.height / 2) };
  }, ratio);
  await page.locator(".ve-scrub").click({ position });
};

/** Wait out the autosave debounce (500 ms) and confirm the write landed. */
export const saved = async (page: Page) => {
  await page.waitForTimeout(900);
  await expect(page.locator('[role="status"][data-state]').first()).toHaveAttribute(
    "data-state",
    "saved",
  );
};

export const nowTimecode = async (page: Page) =>
  (await page.locator(".ve-time.now, .ve-mob-time .now").first().innerText()).trim();
export const toFrame = (tc: string) => {
  const [h, m, s, f] = tc.split(":").map(Number);
  return ((h * 60 + m) * 60 + s) * 60 + f;
};
