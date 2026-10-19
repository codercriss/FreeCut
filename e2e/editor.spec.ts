import { expect, test as base, type Page } from "@playwright/test";

/** Every test fails on an uncaught page error or console error. */
const test = base.extend<{ errors: string[] }>({
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

const openEditor = async (page: Page, isMobile: boolean) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: isMobile ? "New video" : "New project" })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Back to home" })).toBeVisible();
};
const homeVisible = (page: Page, isMobile: boolean) =>
  expect(
    page.getByRole("button", { name: isMobile ? "New video" : "New project" }).first(),
  ).toBeVisible();

const pause = async (page: Page) => {
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
};

/** Wait out the autosave debounce (500 ms) and confirm the write landed. */
const saved = async (page: Page) => {
  await page.waitForTimeout(900);
  await expect(page.locator('[role="status"][data-state]').first()).toHaveAttribute(
    "data-state",
    "saved",
  );
};

const nowTimecode = async (page: Page) =>
  (await page.locator(".ve-time.now, .ve-mob-time .now").first().innerText()).trim();
const toFrame = (tc: string) => {
  const [h, m, s, f] = tc.split(":").map(Number);
  return ((h * 60 + m) * 60 + s) * 60 + f;
};

test("opens the editor from Home with the sample project", async ({ page, isMobile }) => {
  await openEditor(page, !!isMobile);
  await expect(page.getByText("This is a title").first()).toBeVisible();
  await expect(page.getByText("00:00:27:58").first()).toBeVisible();
  await expect(page.locator('[data-clip-id="clip-main"]')).toBeVisible();
  await expect(page.locator('[data-clip-id="clip-audio"]')).toBeVisible();
});

test("play / pause moves the playhead, and the timecode is real", async ({ page, isMobile }) => {
  await openEditor(page, !!isMobile);
  const start = toFrame(await nowTimecode(page));
  await page.waitForTimeout(700);
  await pause(page);
  const end = toFrame(await nowTimecode(page));
  expect(end - start).toBeGreaterThan(20); // ~0.7 s at 60 fps
  await page.waitForTimeout(300);
  expect(toFrame(await nowTimecode(page))).toBe(end); // really paused
});

test("an edit survives a reload (autosave → IndexedDB) and can still be undone", async ({
  page,
  isMobile,
}) => {
  await openEditor(page, !!isMobile);
  const mute = page.getByRole("button", { name: "Mute clip" });
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await saved(page);

  await page.reload();
  await page
    .getByRole("button", { name: isMobile ? "New video" : "New project" })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Mute clip" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // history is intentionally not persisted: nothing to undo right after a reload
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("undo / redo buttons", async ({ page, isMobile }) => {
  await openEditor(page, !!isMobile);
  await page.getByRole("button", { name: "Mute audio track" }).click();
  await expect(page.getByRole("button", { name: "Mute audio track" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: "Mute audio track" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.getByRole("button", { name: "Mute audio track" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "keyboard shortcut");
  await openEditor(page, false);
  const mute = page.getByRole("button", { name: "Mute clip" });
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(mute).toHaveAttribute("aria-pressed", "true");
});

test("browser Back returns Home and Forward returns to the editor (Handover S1)", async ({
  page,
  isMobile,
}) => {
  await openEditor(page, !!isMobile);
  await page.goBack();
  await homeVisible(page, !!isMobile);
  await expect(page.getByRole("button", { name: "Back to home" })).toHaveCount(0);
  await page.goForward();
  await expect(page.getByRole("button", { name: "Back to home" })).toBeVisible();
});

test("the Home button returns Home and leaves history tidy", async ({ page, isMobile }) => {
  await openEditor(page, !!isMobile);
  await page.getByRole("button", { name: "Back to home" }).click();
  await homeVisible(page, !!isMobile);
  await page.goForward();
  await expect(page.getByRole("button", { name: "Back to home" })).toBeVisible();
});

test("Properties sliders are keyboard-operable and undoable (Handover K5)", async ({
  page,
  isMobile,
}) => {
  await openEditor(page, !!isMobile);
  if (isMobile) await page.locator(".ve-mob-tool", { hasText: "Edit" }).click();
  const opacity = page.getByRole("slider", { name: "Opacity" });
  await opacity.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(opacity).toHaveAttribute("aria-valuenow", "98");
  await page.keyboard.press("Home");
  await expect(opacity).toHaveAttribute("aria-valuenow", "0");
  await page.getByRole("button", { name: "Reset Blend" }).click();
  await expect(opacity).toHaveAttribute("aria-valuenow", "100");
});

test("desktop timeline: the playhead sits where the timecode says (Handover K1b)", async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, "desktop timeline");
  await openEditor(page, false);
  await pause(page);
  const frame = toFrame(await nowTimecode(page));
  const left = await page
    .locator(".ve-playhead")
    .evaluate((el) => parseFloat((el as HTMLElement).style.left));
  expect(left).toBeCloseTo((frame / 60) * 22.3, 1);
  // …and the ruler tick for the nearest labelled second is at the same scale
  const tick = await page.locator(".ve-ruler text", { hasText: "00:02" }).first().getAttribute("x");
  expect(parseFloat(tick!) - 3.5).toBeCloseTo(2 * 22.3, 1);
  // the main clip ends exactly at the end of the project
  const w = await page
    .locator('[data-clip-id="clip-main"]')
    .evaluate((el) => parseFloat((el as HTMLElement).style.width));
  expect(w).toBeCloseTo((1678 / 60) * 22.3, 1);
});

test("phone timeline: scrolling seeks, and pinch-free zoom buttons work", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone timeline");
  await openEditor(page, true);
  await pause(page);
  await page.locator(".ve-mob-scroll").evaluate((el) => {
    el.scrollLeft = 28 * 10; // 10 s at 28 px/s
  });
  await expect.poll(async () => toFrame(await nowTimecode(page))).toBeGreaterThanOrEqual(598);
  expect(toFrame(await nowTimecode(page))).toBeLessThanOrEqual(602);
  const before = await page
    .locator('[data-clip-id="clip-main"]')
    .evaluate((el) => parseFloat((el as HTMLElement).style.width));
  await page.getByRole("button", { name: "Zoom in" }).click();
  const after = await page
    .locator('[data-clip-id="clip-main"]')
    .evaluate((el) => parseFloat((el as HTMLElement).style.width));
  expect(after).toBeGreaterThan(before);
});

test("Reset demo project restores the sample", async ({ page, isMobile }) => {
  await openEditor(page, !!isMobile);
  await page.getByRole("button", { name: "Mute clip" }).click();
  await saved(page);
  await page.getByRole("button", { name: "Back to home" }).click();
  await homeVisible(page, !!isMobile);
  if (isMobile) await page.getByRole("button", { name: "Me", exact: true }).last().click();
  const reset = page.getByRole("button", { name: "Reset demo project" });
  await reset.click();
  await page.getByRole("button", { name: "Tap again to confirm reset" }).click();
  if (isMobile) await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: isMobile ? "New video" : "New project" })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Mute clip" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("a corrupt saved project is set aside, not deleted, and the app still opens", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: isMobile ? "New video" : "New project" }).first(),
  ).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("freecut");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("projects", "readwrite");
          tx.objectStore("projects").put({
            id: "sample-project",
            schemaVersion: 1,
            clips: "garbage",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("could not be opened");
  const kept = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("freecut");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction("meta").objectStore("meta").getAllKeys();
          req.onsuccess = () =>
            resolve(req.result.filter((k) => String(k).startsWith("quarantine:")).length);
        };
      }),
  );
  expect(kept).toBe(1);
  await page
    .getByRole("button", { name: isMobile ? "New video" : "New project" })
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Mute clip" })).toBeVisible();
});

test("works offline once loaded (PWA)", async ({ page, context, isMobile }) => {
  test.skip(!!isMobile, "same service worker, desktop only to keep the suite fast");
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "New project" }).first()).toBeVisible();
  await page.getByRole("button", { name: "New project" }).first().click();
  await expect(page.getByRole("button", { name: "Back to home" })).toBeVisible(); // lazy editor chunk served from cache
});
