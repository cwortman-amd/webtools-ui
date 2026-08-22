/**
 * webtools-ui/tests/lib/playwright-fixtures.mjs
 *
 * Generic Playwright navigation fixtures for dashboard shells — demo banner
 * suppression, shell entry navigation, sidebar readiness. Consumer-specific
 * API mocks stay in each repo's e2e/helpers/fixtures.js.
 */

/** Minimum wait after domcontentloaded for deferred shell scripts. */
export const SHELL_BOOT_MS = 1200;

/**
 * Inject localStorage keys that suppress auto demo welcome banners.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string[]} keys
 */
export async function suppressDemoBanner(page, keys = []) {
  if (!keys.length) return;
  await page.addInitScript((bannerKeys) => {
    try {
      for (const k of bannerKeys) localStorage.setItem(k, "1");
    } catch {
      /* storage blocked */
    }
  }, keys);
}

/**
 * Navigate to a consumer shell entry and wait for sidebar nav.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} entryPath e.g. "/pages/index.html"
 * @param {{ demoBannerKeys?: string[], navSelector?: string, bootMs?: number, waitUntil?: "load"|"domcontentloaded" }} [opts]
 */
export async function gotoShellEntry(page, entryPath, opts = {}) {
  const navSelector = opts.navSelector ?? ".sidebar-nav .nav-btn";
  const target = opts.baseURL
    ? new URL(entryPath, opts.baseURL).href
    : entryPath;
  await suppressDemoBanner(page, opts.demoBannerKeys ?? []);
  await page.goto(target, {
    waitUntil: opts.waitUntil ?? "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForSelector(navSelector, { timeout: 15_000 });
  await page.waitForTimeout(opts.bootMs ?? SHELL_BOOT_MS);
}

/**
 * Set user mode before reload — generic pattern shared by CM/DC/KE.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} modeKey localStorage key
 * @param {string} mode value
 * @param {{ entryPath?: string, navSelector?: string, demoBannerKeys?: string[] }} [opts]
 */
export async function gotoWithMode(page, modeKey, mode, opts = {}) {
  const entryPath = opts.entryPath ?? "/pages/index.html";
  await suppressDemoBanner(page, opts.demoBannerKeys ?? []);
  await page.goto(entryPath, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, val }) => {
      try {
        localStorage.setItem(key, val);
      } catch {
        /* blocked */
      }
    },
    { key: modeKey, val: mode }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(opts.navSelector ?? ".sidebar-nav .nav-btn", { timeout: 15_000 });
  await page.waitForTimeout(SHELL_BOOT_MS);
}

/**
 * Return tab ids from visible sidebar nav buttons.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [navSelector]
 */
export async function listSidebarTabIds(page, navSelector = ".sidebar-nav .nav-btn") {
  return page.$$eval(`${navSelector}[data-tab]`, (btns) =>
    btns
      .filter((b) => {
        if (b.hidden) return false;
        const style = window.getComputedStyle(b);
        return style.display !== "none" && style.visibility !== "hidden";
      })
      .map((b) => b.getAttribute("data-tab"))
      .filter(Boolean)
  );
}

/**
 * Click the nth sidebar tab (0-based) and wait for paint.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} index
 * @param {string} [navSelector]
 */
export async function clickSidebarTabByIndex(page, index, navSelector = ".sidebar-nav .nav-btn") {
  const btn = page.locator(navSelector).nth(index);
  await btn.click();
  await page.waitForTimeout(400);
}
