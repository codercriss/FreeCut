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
