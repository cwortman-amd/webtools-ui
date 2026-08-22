/**
 * webtools-ui/tests/playwright/sidebar-icons.spec.js
 *
 * Focused Playwright spec: every visible primary sidebar tab icon is painted
 * and switches to an active panel / portal view.
 *
 *   WEBTOOLS_UI_CONSUMER_ROOT=$PWD npx playwright test \
 *     shared/tests/playwright/sidebar-icons.spec.js \
 *     --config shared/tests/playwright.config.mjs
 */
const path = require("path");
const { createRequire } = require("module");

const consumerRoot = process.env.WEBTOOLS_UI_CONSUMER_ROOT
  ?? path.resolve(__dirname, "../../..");
const consumerRequire = createRequire(path.join(consumerRoot, "package.json"));
const { test, expect } = consumerRequire("@playwright/test");

let helpersPromise;

function loadHelpers() {
  if (!helpersPromise) {
    helpersPromise = Promise.all([
      import("../lib/consumer-matrix.mjs"),
      import("../lib/playwright-fixtures.mjs"),
      import("../lib/shell-tab-contract.mjs"),
    ]).then(([matrix, fixtures, tab]) => ({
      loadConsumerMatrix: matrix.loadConsumerMatrix,
      gotoShellEntry: fixtures.gotoShellEntry,
      gotoWithMode: fixtures.gotoWithMode,
      assertAllSidebarTabsOperational: tab.assertAllSidebarTabsOperational,
    }));
  }
  return helpersPromise;
}

function consumerDef(loadConsumerMatrix) {
  const repoName = path.basename(consumerRoot);
  const { consumers } = loadConsumerMatrix();
  const def = consumers.find((c) => c.id === repoName);
  if (!def) {
    throw new Error(`No consumer-matrix entry for "${repoName}"`);
  }
  return def;
}

async function gotoConsumerShell(page, h, def) {
  if (def.bootstrapUserMode && def.userModeKey) {
    await h.gotoWithMode(page, def.userModeKey, def.bootstrapUserMode, {
      entryPath: def.entryPath,
      demoBannerKeys: def.demoBannerKeys ?? [],
      navSelector: def.shellNavSelector,
      bootMs: def.bootMs,
    });
    return;
  }
  await h.gotoShellEntry(page, def.entryPath, {
    demoBannerKeys: def.demoBannerKeys ?? [],
    navSelector: def.shellNavSelector,
    bootMs: def.bootMs,
  });
}

test.describe("primary sidebar icons", () => {
  test("every primary sidebar tab icon is operational", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    test.skip(def.sidebarTabChecks === false, "disabled in consumer-matrix");

    const navSelector = def.shellNavSelector ?? ".sidebar-nav .nav-btn";
    await gotoConsumerShell(page, h, def);
    await h.assertAllSidebarTabsOperational(page, expect, {
      navSelector,
      skipTabIds: def.sidebarTabSkip ?? [],
      portalViewAttr: def.requirePortalView ? (def.portalViewAttr ?? "data-portal-view") : undefined,
      activationMode:
        def.sidebarTabActivation
        ?? (def.requirePortalView ? "portalView" : "panel"),
      settleMs: def.tabSettleMs ?? 400,
    });
  });
});
