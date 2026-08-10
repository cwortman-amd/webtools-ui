#!/usr/bin/env node
/**
 * webtools-ui/tests/cross-consumer-shell.mjs
 *
 * Generic Playwright regression for shared shell UI/UX across dashboard
 * consumers: sidebar loads, first tab paints, tab switch recovery, button
 * visual contract, coarse-pointer block on iPhone profiles.
 *
 *   node tests/cross-consumer-shell.mjs
 *   node tests/cross-consumer-shell.mjs --repo dc-planner
 *   node tests/cross-consumer-shell.mjs --json
 *   node tests/cross-consumer-shell.mjs --iphone   # include coarse-pointer probe
 *
 * Exit: 0 pass · 1 failure · 2 could not run
 */
import path from "node:path";
import { loadPlaywright, loadStaticServerHelper } from "./lib/playwright-resolve.mjs";
import { loadConsumerMatrix, resolveReachableConsumers } from "./lib/consumer-matrix.mjs";
import { gotoShellEntry, listSidebarTabIds } from "./lib/playwright-fixtures.mjs";
import {
  assertNoBlankMainArea,
  clickSidebarTab,
  dispatchShellTabChanged,
  forceAllTabPanelsHidden,
} from "./lib/shell-tab-contract.mjs";
import {
  assertButtonVisualContract,
  DEFAULT_SHELL_BUTTON_TIERS,
} from "./lib/shell-visual-contract.mjs";
import { assertCoarsePointerBlockIsLive, validateDeviceCases } from "./lib/iphone-helpers.mjs";

const results = [];
let currentScope = "";

function record(status, name, detail) {
  results.push({ scope: currentScope, status, name, detail });
}
const pass = (name, detail) => record("PASS", name, detail);
const fail = (name, detail) => record("FAIL", name, detail);
const skip = (name, detail) => record("SKIP", name, detail);

/** Minimal expect shim for standalone runners when Playwright expect is unavailable. */
function makeExpect() {
  const chain = (actual, msg) => ({
    toBe(expected) {
      if (actual !== expected) throw new Error(msg ?? `expected ${expected}, got ${actual}`);
    },
    toBeTruthy() {
      if (!actual) throw new Error(msg ?? `expected truthy, got ${actual}`);
    },
    toBeGreaterThan(n) {
      if (!(actual > n)) throw new Error(msg ?? `expected ${actual} > ${n}`);
    },
    toEqual(expected) {
      const a = JSON.stringify(actual);
      const e = JSON.stringify(expected);
      if (a !== e) throw new Error(msg ?? `expected ${e}, got ${a}`);
    },
    toBeVisible: async function () {
      if (actual && typeof actual.isVisible === "function") {
        const vis = await actual.isVisible();
        if (!vis) throw new Error(msg ?? "expected locator to be visible");
        return;
      }
      throw new Error(msg ?? "toBeVisible requires a Playwright locator");
    },
    toBeEnabled: async function () {
      if (actual && typeof actual.isEnabled === "function") {
        const en = await actual.isEnabled();
        if (!en) throw new Error(msg ?? "expected locator to be enabled");
        return;
      }
      throw new Error(msg ?? "toBeEnabled requires a Playwright locator");
    },
  });
  const expectFn = (actual, msg) => chain(actual, msg);
  expectFn.soft = expectFn;
  return expectFn;
}

async function runShellChecks(page, def, expect) {
  const navSelector = def.shellNavSelector ?? ".sidebar-nav .nav-btn";
  const collectOpts = {
    panelSelector: def.panelSelector ?? ".tab-panel",
    portalViewAttr: def.portalViewAttr ?? "data-portal-view",
    profileKey: def.profileKey ?? null,
  };
  const requirePortalView = def.requirePortalView === true;

  const navCount = await page.locator(navSelector).count();
  if (navCount === 0) {
    fail("sidebar nav present", "no nav buttons");
    return;
  }
  pass("sidebar nav present", `${navCount} buttons`);

  try {
    await assertNoBlankMainArea(page, "initial load", expect, {
      collectOpts,
      requirePortalView,
    });
    pass("initial tab panel visible");
  } catch (err) {
    fail("initial tab panel visible", String(err.message || err).slice(0, 200));
  }

  if (def.buttonVisualContract !== false) {
    try {
      await assertButtonVisualContract(page, DEFAULT_SHELL_BUTTON_TIERS, expect);
      pass("button visual contract");
    } catch (err) {
      fail("button visual contract", String(err.message || err).slice(0, 240));
    }
  } else {
    skip("button visual contract", "disabled for this consumer in consumer-matrix.json");
  }

  const tabIds = await listSidebarTabIds(page, navSelector);
  if (tabIds.length >= 2) {
    const second = tabIds[1];
    try {
      await clickSidebarTab(page, second, expect, { navSelector });
      await assertNoBlankMainArea(page, `tab switch → ${second}`, expect, {
        collectOpts,
        requirePortalView,
      });
      pass("tab switch paints panel", second);
    } catch (err) {
      fail("tab switch paints panel", `${second}: ${String(err.message || err).slice(0, 160)}`);
    }

    if (def.shellTabChangedRecovery) {
      try {
        await forceAllTabPanelsHidden(page, collectOpts.panelSelector);
        await dispatchShellTabChanged(page, tabIds[0]);
        await page.waitForTimeout(300);
        await assertNoBlankMainArea(page, "shell:tabChanged recovery", expect, {
          collectOpts,
          requirePortalView: false,
        });
        pass("shell:tabChanged recovery");
      } catch (err) {
        fail("shell:tabChanged recovery", String(err.message || err).slice(0, 200));
      }
    } else {
      skip("shell:tabChanged recovery", "not enabled for this consumer");
    }
  } else {
    skip("tab switch paints panel", "fewer than 2 tabs");
    skip("shell:tabChanged recovery", "fewer than 2 tabs");
  }
}

async function runIphoneProbe(browser, devices, deviceCase, url, label) {
  const descriptor = devices[deviceCase.descriptor];
  if (!descriptor) {
    skip("coarse-pointer block live", `unknown device ${deviceCase.descriptor}`);
    return;
  }
  const context = await browser.newContext({ ...descriptor });
  const page = await context.newPage();
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: deviceCase.insets });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(1200);
    await assertCoarsePointerBlockIsLive(page, label);
    pass("coarse-pointer block live", deviceCase.name);
  } catch (err) {
    fail("coarse-pointer block live", `${deviceCase.name}: ${String(err.message || err).slice(0, 160)}`);
  } finally {
    await context.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
  };
  const asJson = argv.includes("--json");
  const withIphone = argv.includes("--iphone");
  const repoArg = arg("--repo");

  const pw = loadPlaywright();
  if (!pw) {
    console.error("cross-consumer-shell: @playwright/test not resolvable from sibling consumers.");
    process.exit(2);
  }

  const { startStaticServer } = await loadStaticServerHelper();
  const { iphoneDevices } = loadConsumerMatrix();
  validateDeviceCases(pw.devices, iphoneDevices);

  const consumers = resolveReachableConsumers({ repoFilter: repoArg });
  if (!consumers.length) {
    console.error("cross-consumer-shell: no reachable consumer entry pages.");
    process.exit(2);
  }

  const expect = pw.expect ?? makeExpect();
  const browser = await pw.chromium.launch();

  for (const def of consumers) {
    currentScope = def.id;
    const { server, port } = await startStaticServer(def.repoPath);
    const baseURL = `http://127.0.0.1:${port}`;
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    try {
      await gotoShellEntry(page, def.entryPath, {
        baseURL,
        demoBannerKeys: def.demoBannerKeys ?? [],
        navSelector: def.shellNavSelector,
      });
      await runShellChecks(page, def, expect);
    } catch (err) {
      fail("page loaded", String(err.message || err).slice(0, 200));
    } finally {
      await context.close();
      server.close();
    }

    if (withIphone) {
      const seCase = iphoneDevices.find((d) => d.descriptor === "iPhone SE") ?? iphoneDevices[0];
      currentScope = `${def.id} · ${seCase.name}`;
      await runIphoneProbe(
        browser,
        pw.devices,
        seCase,
        `${baseURL}${def.entryPath}`,
        `${def.id}/${seCase.name}`
      );
    }
  }

  await browser.close();

  const failed = results.filter((r) => r.status === "FAIL");
  const passed = results.filter((r) => r.status === "PASS");
  const skipped = results.filter((r) => r.status === "SKIP");

  if (asJson) {
    console.log(JSON.stringify({
      total: results.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      results,
    }, null, 2));
  } else {
    let scope = null;
    for (const r of results) {
      if (r.scope !== scope) {
        scope = r.scope;
        console.log(`\n  ── ${scope} ──`);
      }
      const mark = r.status === "PASS" ? "\x1b[92mPASS\x1b[0m"
        : r.status === "FAIL" ? "\x1b[91mFAIL\x1b[0m"
          : "\x1b[2mSKIP\x1b[0m";
      console.log(`    ${mark}  ${r.name}${r.detail ? `  \x1b[2m${r.detail}\x1b[0m` : ""}`);
    }
    console.log(`\n  ${passed.length} passed · ${failed.length} failed · ${skipped.length} skipped`);
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("cross-consumer-shell: unexpected error:", err);
  process.exit(2);
});
