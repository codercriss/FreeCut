import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nowTimecode, openEditor, pause, saved, test, toFrame } from "./helpers";

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = (name: string) => path.join(here, "fixtures", name);
const VIDEO = fx("clip.webm"); // 2 s, 320×240, VP9 + Opus
const AUDIO = fx("tone.wav"); // 1 s
const PHOTO = fx("photo.png"); // 200×120

/** Open the editor and make the media library visible (desktop: always; phone: tap the Media tab). */
async function openLibrary(page: Page, isMobile: boolean) {
  await openEditor(page, isMobile);
  if (isMobile) await page.locator(".ve-mob-tool", { hasText: "Media" }).click();
  await expect(page.locator(".ve-import").first()).toBeVisible();
}
const importFiles = (page: Page, files: string[]) =>
  page.getByTestId("media-file-input").setInputFiles(files);
const tile = (page: Page, name: string) => page.locator(".ve-item", { hasText: name });
const toast = (page: Page) => page.locator(".ve-toast");
const loaded = (img: ReturnType<Page["locator"]>) =>
  expect
    .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
    .toBe(true);
const total = async (page: Page) =>
  toFrame((await page.locator(".ve-time.total, .ve-mob-time .total").first().innerText()).trim());

test("imports a video, audio and a photo: real thumbnails, durations and waveform", async ({
  page,
  isMobile,
}) => {
  await openLibrary(page, !!isMobile);
  await importFiles(page, [VIDEO, AUDIO, PHOTO]);
  await expect(toast(page)).toContainText("Added 3 files to the library.");

  for (const n of ["clip.webm", "tone.wav", "photo.png"]) await expect(tile(page, n)).toBeVisible();

  // real poster images, generated from the actual files
  await loaded(tile(page, "clip.webm").locator("img.ve-art"));
  await loaded(tile(page, "photo.png").locator("img.ve-art"));

  // real durations (2 s video, 1 s audio) — photos show none
  await expect(tile(page, "clip.webm").locator(".ve-dur")).toHaveText("00:02");
  await expect(tile(page, "tone.wav").locator(".ve-dur")).toHaveText("00:01");
  await expect(tile(page, "photo.png").locator(".ve-dur")).toHaveCount(0);

  // audio: waveform computed from the real samples
  expect(await tile(page, "tone.wav").locator(".ve-ph-wave i").count()).toBeGreaterThan(10);

  // type filter
  await page.getByRole("combobox", { name: "Filter media" }).selectOption("image");
  await expect(page.locator(".ve-label")).toHaveText(["photo.png"]);
});

test("a bad video and a non-media file are explained, and nothing is added", async ({
  page,
  isMobile,
}) => {
  await openLibrary(page, !!isMobile);
  const before = await page.locator(".ve-item").count();
  await importFiles(page, [fx("broken.mp4"), fx("notes.txt")]);
  await expect(toast(page)).toContainText("Nothing was imported.");
  await expect(toast(page)).toContainText("broken.mp4");
  await expect(toast(page)).toContainText("This browser can’t play this video format.");
  await expect(toast(page)).toContainText("notes.txt");
  await expect(toast(page)).toContainText("Not a video, audio or photo file.");
  expect(await page.locator(".ve-item").count()).toBe(before);
  await toast(page).getByRole("button", { name: "Dismiss" }).click();
  await expect(toast(page)).toHaveCount(0);
});

test("one bad file doesn't stop the good ones", async ({ page, isMobile }) => {
  await openLibrary(page, !!isMobile);
  await importFiles(page, [fx("broken.mp4"), PHOTO]);
  await expect(toast(page)).toContainText("Added 1 file to the library.");
  await expect(toast(page)).toContainText("broken.mp4");
  await expect(tile(page, "photo.png")).toBeVisible();
});

test("add to timeline: the clip lands at the end, the project grows, the player shows the real picture", async ({
  page,
  isMobile,
}) => {
  await openLibrary(page, !!isMobile);
  await importFiles(page, [VIDEO]);
  await expect(toast(page)).toContainText("Added 1 file");
  const before = await total(page);
  expect(before).toBe(1678);

  await page.getByRole("button", { name: "Add clip.webm to timeline" }).click();
  expect(await total(page)).toBeGreaterThanOrEqual(1678 + 118); // + ~2 s at 60 fps
  expect(await total(page)).toBeLessThanOrEqual(1678 + 124);
  await expect(page.locator(".ve-vclip")).toHaveCount(2);

  // the new clip's filmstrip is made of its real poster
  const added = page.locator('.ve-vclip:not([data-clip-id="clip-main"])');
  await expect(added.locator(".ve-frame.poster").first()).toBeVisible();

  // seek into it: the stage shows the imported video's poster
  if (isMobile) {
    await page.getByRole("button", { name: "Done" }).click(); // close the media sheet
  }
  await pause(page);
  if (isMobile) {
    await page.locator(".ve-mob-scroll").evaluate((el) => {
      el.scrollLeft = (1700 / 60) * 28;
    });
  } else {
    const box = (await page.locator(".ve-scrub").boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.99, box.y + box.height / 2);
  }
  expect(toFrame(await nowTimecode(page))).toBeGreaterThanOrEqual(1678);
  await loaded(page.locator("img.ve-stage-img"));
});

test("everything survives closing and reopening: library, thumbnails and the timeline clip", async ({
  page,
  isMobile,
}) => {
  await openLibrary(page, !!isMobile);
  await importFiles(page, [VIDEO, PHOTO]);
  await expect(toast(page)).toContainText("Added 2 files");
  await page.getByRole("button", { name: "Add photo.png to timeline" }).click();
  await saved(page);

  await page.reload();
  await openLibrary(page, !!isMobile);
  await expect(tile(page, "clip.webm")).toBeVisible();
  await expect(tile(page, "photo.png")).toBeVisible();
  await loaded(tile(page, "clip.webm").locator("img.ve-art")); // the poster blob came back from storage
  await loaded(tile(page, "photo.png").locator("img.ve-art"));
  await expect(page.locator(".ve-vclip")).toHaveCount(2);
  expect(await total(page)).toBe(1678 + 300); // a photo defaults to 5 s
});

test("rename, delete (with its clips), then undo brings everything back", async ({
  page,
  isMobile,
}) => {
  await openLibrary(page, !!isMobile);
  await importFiles(page, [PHOTO]);
  await expect(tile(page, "photo.png")).toBeVisible();
  await page.getByRole("button", { name: "Add photo.png to timeline" }).click();

  // rename
  await page.getByRole("button", { name: "More options for photo.png" }).click();
  await page.getByRole("button", { name: "Rename…" }).click();
  await page.getByRole("textbox", { name: "Name" }).fill("Holiday photo");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(tile(page, "Holiday photo")).toBeVisible();

  // delete: warns about the clip on the timeline
  await page.getByRole("button", { name: "More options for Holiday photo" }).click();
  await page.getByRole("button", { name: "Delete…" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete media?" });
  await expect(confirm).toContainText("1 clip on the timeline");
  await confirm.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(tile(page, "Holiday photo")).toHaveCount(0);
  await expect(page.locator(".ve-vclip")).toHaveCount(1);

  // undo restores the asset, its clip and its thumbnail
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(tile(page, "Holiday photo")).toBeVisible();
  await expect(page.locator(".ve-vclip")).toHaveCount(2);
  await loaded(tile(page, "Holiday photo").locator("img.ve-art"));
});

test("phone: Home → Import media opens the media sheet ready to import", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "phone flow");
  await page.goto("/");
  await page.getByRole("button", { name: "Import media" }).first().click();
  await expect(page.getByRole("dialog", { name: "Media" })).toBeVisible();
  await expect(page.locator(".ve-import").first()).toBeVisible();
  await importFiles(page, [PHOTO]);
  await expect(tile(page, "photo.png")).toBeVisible();
});

test("an existing Phase 0 project (database v1, schema v1) upgrades without losing a thing", async ({
  page,
  isMobile,
}) => {
  // Recreate exactly what a Phase-0 phone has stored: IndexedDB version 1, a schema-1 project with the user's edit.
  const v1 = JSON.parse(
    fs.readFileSync(path.join(here, "..", "src", "model", "fixtures", "project.v1.json"), "utf8"),
  );
  v1.id = "sample-project";
  v1.name = "Edited on iPhone";
  v1.tracks.find((t: { kind: string }) => t.kind === "main").muted = true;

  await page.goto("/favicon.svg"); // same origin, no app running yet
  await page.evaluate(
    (project) =>
      new Promise<void>((resolve, reject) => {
        const del = indexedDB.deleteDatabase("freecut");
        del.onerror = () => reject(del.error);
        del.onsuccess = () => {
          const open = indexedDB.open("freecut", 1);
          open.onupgradeneeded = () => {
            open.result.createObjectStore("projects", { keyPath: "id" });
            open.result.createObjectStore("meta", { keyPath: "key" });
          };
          open.onsuccess = () => {
            const tx = open.result.transaction(["projects", "meta"], "readwrite");
            tx.objectStore("projects").put(project);
            tx.objectStore("meta").put({ key: "lastProjectId", value: project.id });
            tx.oncomplete = () => {
              open.result.close();
              resolve();
            };
          };
          open.onerror = () => reject(open.error);
        };
      }),
    v1,
  );

  await openEditor(page, !!isMobile);
  await expect(page.getByText("Edited on iPhone").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mute clip" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // work in the new version on top of the old project, then check what is stored
  if (isMobile) await page.locator(".ve-mob-tool", { hasText: "Media" }).click();
  await importFiles(page, [PHOTO]);
  await expect(tile(page, "photo.png")).toBeVisible();
  await saved(page);

  const stored = await page.evaluate(
    () =>
      new Promise<{ version: number; schema: number; name: string; assets: number }>(
        (resolve, reject) => {
          const open = indexedDB.open("freecut");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const req = db.transaction("projects").objectStore("projects").get("sample-project");
            req.onsuccess = () =>
              resolve({
                version: db.version,
                schema: req.result.schemaVersion,
                name: req.result.name,
                assets: req.result.assets.length,
              });
          };
        },
      ),
  );
  expect(stored.version).toBe(2);
  expect(stored.schema).toBe(2);
  expect(stored.name).toBe("Edited on iPhone");
  expect(stored.assets).toBe(7); // 6 demo + 1 imported
});
