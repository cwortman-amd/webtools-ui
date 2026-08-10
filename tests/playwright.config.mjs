/**
 * webtools-ui/tests/playwright.config.mjs
 *
 * Generic Playwright config for cross-consumer shell regression.
 * Run from a consumer repo root (needs @playwright/test installed):
 *
 *   WEBTOOLS_UI_CONSUMER_ROOT=$PWD npx playwright test \
 *     shared/tests/playwright/cross-consumer-shell.spec.mjs \
 *     --config shared/tests/playwright.config.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const consumerRoot = process.env.WEBTOOLS_UI_CONSUMER_ROOT
  ?? path.resolve(HERE, "../..");
const port = Number(process.env.WEBTOOLS_UI_TEST_PORT || 3198);

/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default {
  testDir: path.join(HERE, "playwright"),
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `python3 -m http.server ${port} --bind 127.0.0.1`,
    cwd: consumerRoot,
    port,
    reuseExistingServer: true,
    timeout: 10_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
};
