/**
 * webtools-ui/tests/playwright/cross-consumer-shell.spec.js
 *
 * Generic @playwright/test spec (CommonJS for consumer node_modules resolution).
 *
 *   WEBTOOLS_UI_CONSUMER_ROOT=$PWD npx playwright test \
 *     shared/tests/playwright/cross-consumer-shell.spec.js \
 *     --config shared/tests/playwright.config.mjs
 */
const path = require("path");
const { createRequire } = require("module");

const consumerRoot = process.env.WEBTOOLS_UI_CONSUMER_ROOT
  ?? path.resolve(__dirname, "../../..");
const consumerRequire = createRequire(path.join(consumerRoot, "package.json"));
const { test, expect } = consumerRequire("@playwright/test");

// ESM helpers — load via dynamic import (Node 18+).
let helpersPromise;

function loadHelpers() {
  if (!helpersPromise) {
    helpersPromise = Promise.all([
      import("../lib/consumer-matrix.mjs"),
      import("../lib/playwright-fixtures.mjs"),
      import("../lib/shell-tab-contract.mjs"),
      import("../lib/shell-visual-contract.mjs"),
    ]).then(([matrix, fixtures, tab, visual]) => ({
      loadConsumerMatrix: matrix.loadConsumerMatrix,
      gotoShellEntry: fixtures.gotoShellEntry,
      assertNoBlankMainArea: tab.assertNoBlankMainArea,
      clickSidebarTab: tab.clickSidebarTab,
      assertButtonVisualContract: visual.assertButtonVisualContract,
      DEFAULT_SHELL_BUTTON_TIERS: visual.DEFAULT_SHELL_BUTTON_TIERS,
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

test.describe("shared shell contract", () => {
  test("initial load paints a visible tab panel", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    await h.gotoShellEntry(page, def.entryPath, {
      demoBannerKeys: def.demoBannerKeys ?? [],
      navSelector: def.shellNavSelector,
    });
    await h.assertNoBlankMainArea(page, "initial load", expect, {
      collectOpts: {
        panelSelector: def.panelSelector ?? ".tab-panel",
        portalViewAttr: def.portalViewAttr ?? "data-portal-view",
        profileKey: def.profileKey ?? null,
      },
      requirePortalView: def.requirePortalView === true,
    });
  });

  test("accent controls meet button visual contract", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    test.skip(def.buttonVisualContract === false, "disabled in consumer-matrix");
    await h.gotoShellEntry(page, def.entryPath, {
      demoBannerKeys: def.demoBannerKeys ?? [],
      navSelector: def.shellNavSelector,
    });
    await h.assertButtonVisualContract(page, h.DEFAULT_SHELL_BUTTON_TIERS, expect);
  });

  test("sidebar tab switch paints a panel", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    const navSelector = def.shellNavSelector ?? ".sidebar-nav .nav-btn";
    await h.gotoShellEntry(page, def.entryPath, {
      demoBannerKeys: def.demoBannerKeys ?? [],
      navSelector,
    });
    const tabId = await page.locator(`${navSelector}[data-tab]`).nth(1).getAttribute("data-tab");
    test.skip(!tabId, "fewer than 2 tabs");
    await h.clickSidebarTab(page, tabId, expect, { navSelector });
    await h.assertNoBlankMainArea(page, `tab → ${tabId}`, expect, {
      collectOpts: {
        panelSelector: def.panelSelector ?? ".tab-panel",
        portalViewAttr: def.portalViewAttr ?? "data-portal-view",
      },
      requirePortalView: def.requirePortalView === true,
    });
  });
});
