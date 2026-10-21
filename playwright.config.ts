import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser tests. Browsers: Chromium (Chrome/Edge/Android) and WebKit (Safari/iPhone), desktop + phone.
 *
 * Normal use:      npx playwright install chromium webkit && npm run e2e
 * Sandboxed use:   FREECUT_CHROMIUM=/path/to/chromium npm run e2e -- --project=chromium-desktop --project=chromium-phone
 */
const executablePath = process.env.FREECUT_CHROMIUM;
const launchOptions = executablePath
  ? {
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    }
  : {};

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Decoding video in software (CI containers, sandboxes) is slow: be generous so tests fail on bugs, not on speed.
  timeout: 60_000,
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    reducedMotion: "reduce", // fast, deterministic screen transitions
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, launchOptions },
    },
    { name: "chromium-phone", use: { ...devices["Pixel 7"], launchOptions } },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
    },
    { name: "webkit-phone", use: { ...devices["iPhone 14"] } },
  ],
});
