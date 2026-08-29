/**
 * webtools-ui/tests/playwright/cross-consumer-shell.spec.js
 *
 * Generic @playwright/test spec with consumer node_modules resolution.
 *
 *   WEBTOOLS_UI_CONSUMER_ROOT=$PWD npx playwright test \
 *     shared/tests/playwright/cross-consumer-shell.spec.js \
 *     --config shared/tests/playwright.config.mjs
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
      gotoWithMode: fixtures.gotoWithMode,
      assertNoBlankMainArea: tab.assertNoBlankMainArea,
      assertAllSidebarTabsOperational: tab.assertAllSidebarTabsOperational,
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

test.describe("shared shell contract", () => {
  test("initial load paints a visible tab panel", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    test.skip(def.panelChecks === false, "panel checks disabled in consumer-matrix");
    await gotoConsumerShell(page, h, def);
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
    await gotoConsumerShell(page, h, def);
    await h.assertButtonVisualContract(page, h.DEFAULT_SHELL_BUTTON_TIERS, expect);
  });

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

  test("sidebar tab switch paints a panel", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    test.skip(def.panelChecks === false, "panel checks disabled in consumer-matrix");
    const navSelector = def.shellNavSelector ?? ".sidebar-nav .nav-btn";
    await gotoConsumerShell(page, h, def);
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

  test("shared Settings replaces legacy sidebar expanders", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    await gotoConsumerShell(page, h, def);

    await expect(page.locator("#themeToggleSide, #skinToggleSide, #modeToggleSide")).toHaveCount(0);
    const trigger = page.locator("[data-open-settings]:visible, #settingsToggleSide:visible").first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.locator("#settingsModal")).toBeVisible();
    await expect(page.locator("#pane-appearance")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#settingsModal")).toBeHidden();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+," : "Control+,");
    await expect(page.locator("#settingsModal")).toBeVisible();
  });

  test("Agent settings preserve the saved key on untouched fields", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    await gotoConsumerShell(page, h, def);

    const mounted = await page.evaluate(() => Boolean(window.ChatOrb?.getLLMForm && window.Shell?.openSettings));
    test.skip(!mounted, "ChatOrb settings API is not mounted for this consumer");
    await page.evaluate(() => {
      window.ChatOrb.setLLM({ host: "settings-test", key: "keep-me" });
      window.ChatOrb.setOrbVisible(false);
      window.Shell.openSettings({ pane: "agent" });
    });
    await expect(page.locator("#pane-agent")).toBeVisible();
    await expect(page.locator("#chatOrb")).toBeHidden();
    await expect(page.locator("#settingsAgentOrbVisible")).not.toBeChecked();
    await page.locator("#settingsAgentOrbVisible").check();
    await expect(page.locator("#chatOrb")).toBeVisible();
    await expect(page.locator("#settingsAgentKey")).toHaveValue("");
    await expect(page.locator("#settingsAgentKey")).toHaveAttribute("type", "password");
    await page.locator("#settingsAgentHost").fill("settings-test-2");
    await page.locator("#settingsAgentHost").blur();
    const form = await page.evaluate(() => ({
      form: window.ChatOrb.getLLMForm(),
      raw: window.ChatOrb.getLLM(),
    }));
    expect(form.form.host).toBe("settings-test-2");
    expect(form.form.keyConfigured).toBe(true);
    expect(form.form.key).toBeUndefined();
    expect(form.raw.key).toBe("keep-me");
    expect(await page.evaluate(() => {
      const prefix = window.ChatOrb.getStoragePrefix();
      const key = prefix ? `${prefix}:chat-orb:launcher:v1` : "shared-ui:chat-orb:launcher:v1";
      return JSON.parse(localStorage.getItem(key)).visible;
    })).toBe(true);
  });

  test("Settings becomes a full-screen mobile surface", async ({ page }) => {
    const h = await loadHelpers();
    const def = consumerDef(h.loadConsumerMatrix);
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoConsumerShell(page, h, def);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+," : "Control+,");
    await page.waitForTimeout(200);
    const box = await page.locator(".settings-modal").boundingBox();
    expect(box.width / 390).toBeGreaterThanOrEqual(0.98);
    expect(box.height / 844).toBeGreaterThanOrEqual(0.99);
    await expect(page.locator(".settings-modal")).toHaveCSS("border-radius", "0px");
  });
});
