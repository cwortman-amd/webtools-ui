/**
 * webtools-ui/tests/lib/shell-tab-contract.mjs
 *
 * Generic Playwright helpers for dashboard shell tab/panel contracts.
 * Extracted from knowledge-exchange tests/ui/portal-helpers.js — the
 * consumer-specific tab map, profile keys, and Studio assertions stay local.
 *
 * Usage (CommonJS consumer):
 *   const shell = require("../../shared/tests/lib/shell-tab-contract.mjs");
 *   // or via createRequire after symlink mount
 *
 * Usage (ESM):
 *   import * as shell from "../../shared/tests/lib/shell-tab-contract.mjs";
 */

/** Default shell panel selector — override when a consumer names panels differently. */
export const DEFAULT_PANEL_SELECTOR = ".tab-panel";

/** Minimum layout height (px) for a visible tab panel to count as painted. */
export const MIN_PANEL_HEIGHT_PX = 20;

/** Minimum icon bbox (px) — Material Symbols ligature must paint. */
export const MIN_ICON_SIZE_PX = 8;

/**
 * Build a tab deep-link URL for pages/index.html-style shells.
 *
 * @param {string} entryPath e.g. "/pages/index.html"
 * @param {string} tabId module id from shell-modules.json
 * @param {{ canonicalHomeTab?: string|null, hash?: string }} [opts]
 */
export function tabDeepLinkUrl(entryPath, tabId, opts = {}) {
  const canonical = opts.canonicalHomeTab ?? "paths";
  const omitParam = tabId === canonical || tabId == null || tabId === "";
  const base = omitParam ? entryPath : `${entryPath}?tab=${encodeURIComponent(tabId)}`;
  return opts.hash ? `${base}${opts.hash}` : base;
}

/**
 * Snapshot main-area layout: tab panels, optional portal-view attribute.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ panelSelector?: string, portalViewAttr?: string, profileKey?: string|null }} [opts]
 */
export async function collectMainAreaMetrics(page, opts = {}) {
  const panelSelector = opts.panelSelector ?? DEFAULT_PANEL_SELECTOR;
  const portalViewAttr = opts.portalViewAttr ?? "data-portal-view";
  const profileKey = opts.profileKey ?? null;

  return page.evaluate(
    ({ panelSelector, portalViewAttr, profileKey }) => {
      const panels = Array.from(document.querySelectorAll(panelSelector));
      const panelMetrics = panels.map((p) => {
        const r = p.getBoundingClientRect();
        const cs = getComputedStyle(p);
        return {
          id: p.id,
          hidden: p.classList.contains("hidden"),
          display: cs.display,
          height: Math.round(r.height),
          width: Math.round(r.width),
        };
      });
      const visiblePanels = panelMetrics.filter(
        (p) => !p.hidden && p.display !== "none" && p.height > 0
      );
      let lsProfile = null;
      if (profileKey) {
        try {
          lsProfile = localStorage.getItem(profileKey);
        } catch {
          /* storage disabled */
        }
      }
      const body = document.body;
      return {
        portalView: body && body.getAttribute(portalViewAttr),
        tabParam: new URL(window.location.href).searchParams.get("tab"),
        allPanelsHidden:
          panels.length > 0 &&
          panels.every(
            (p) => p.classList.contains("hidden") || getComputedStyle(p).display === "none"
          ),
        visiblePanelCount: visiblePanels.length,
        maxPanelHeight: visiblePanels.reduce((max, p) => Math.max(max, p.height), 0),
        panelMetrics,
        bodyProfile: body && body.getAttribute("data-portal-profile"),
        lsProfile,
      };
    },
    { panelSelector, portalViewAttr, profileKey }
  );
}

/**
 * Regression guard: correct URL/tab state must not leave every tab panel hidden.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} context human label for failure messages
 * @param {typeof import('@playwright/test').expect} expect
 * @param {{ minPanelHeight?: number, requirePortalView?: boolean, collectOpts?: object }} [opts]
 */
export async function assertNoBlankMainArea(page, context, expect, opts = {}) {
  const minHeight = opts.minPanelHeight ?? MIN_PANEL_HEIGHT_PX;
  const requirePortalView = opts.requirePortalView !== false;
  const metrics = await collectMainAreaMetrics(page, opts.collectOpts);

  expect(
    metrics.allPanelsHidden,
    `blank main area after ${context} — all panels hidden (${JSON.stringify(metrics)})`
  ).toBe(false);
  expect(
    metrics.visiblePanelCount,
    `no visible tab panel after ${context} (${JSON.stringify(metrics)})`
  ).toBeGreaterThan(0);
  expect(
    metrics.maxPanelHeight,
    `visible tab panel has zero layout height after ${context} (${JSON.stringify(metrics)})`
  ).toBeGreaterThan(minHeight);

  if (requirePortalView) {
    expect(metrics.portalView, `missing portal view attribute after ${context}`).toBeTruthy();
  }

  return metrics;
}

/** DOM profile sources must agree when a profile key is configured. */
export async function assertProfileReconciled(page, expectedProfile, expect, collectOpts = {}) {
  const metrics = await collectMainAreaMetrics(page, collectOpts);
  if (metrics.bodyProfile != null) {
    expect(metrics.bodyProfile, "body data-portal-profile").toBe(expectedProfile);
  }
  if (metrics.lsProfile != null) {
    expect(metrics.lsProfile, "localStorage portal profile").toBe(expectedProfile);
  }
  return metrics;
}

/** Click a sidebar tab by data-tab id. */
export async function clickSidebarTab(page, tabId, expect, opts = {}) {
  const navSelector = opts.navSelector ?? ".sidebar-nav .nav-btn";
  const btn = page.locator(`${navSelector}[data-tab="${tabId}"]`);
  await expect(btn).toBeVisible();
  await expect(btn).toBeEnabled();
  await btn.click();
  if (opts.settleMs !== 0) {
    await page.waitForTimeout(opts.settleMs ?? 400);
  }
}

/**
 * List visible primary sidebar tabs with icon paint metrics.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ navSelector?: string, skipTabIds?: string[] }} [opts]
 */
export async function listOperationalSidebarTabs(page, opts = {}) {
  const navSelector = opts.navSelector ?? ".sidebar-nav .nav-btn";
  const skip = new Set(opts.skipTabIds ?? []);
  return page.$$eval(
    `${navSelector}[data-tab]`,
    (btns, skipIds) => {
      return btns
        .filter((b) => {
          if (b.hidden || skipIds.includes(b.getAttribute("data-tab"))) return false;
          const style = window.getComputedStyle(b);
          if (style.display === "none" || style.visibility === "hidden") return false;
          if (b.disabled || b.getAttribute("aria-disabled") === "true") return false;
          if (b.classList.contains("tab-locked")) return false;
          return true;
        })
        .map((b) => {
          const icon = b.querySelector(".material-symbols-outlined, .material-icons");
          const rect = icon ? icon.getBoundingClientRect() : { width: 0, height: 0 };
          return {
            tabId: b.getAttribute("data-tab"),
            iconText: icon ? String(icon.textContent || "").trim() : "",
            iconHeight: Math.round(rect.height),
            iconWidth: Math.round(rect.width),
          };
        });
    },
    [...skip]
  );
}

/**
 * Resolve the panel element id for a sidebar tab (aria-controls, then panel-{tabId}).
 */
export async function resolvePanelIdForTab(page, tabId, opts = {}) {
  const navSelector = opts.navSelector ?? ".sidebar-nav .nav-btn";
  if (opts.panelId) return opts.panelId;

  return page.evaluate(
    ({ navSelector, tabId }) => {
      const candidates = [];
      const btn = document.querySelector(`${navSelector}[data-tab="${tabId}"]`);
      if (btn) {
        const controls = btn.getAttribute("aria-controls");
        if (controls) candidates.push(controls);
      }
      candidates.push(`panel-${tabId}`);
      candidates.push(`tab${tabId.charAt(0).toUpperCase()}${tabId.slice(1)}`);
      for (const id of candidates) {
        if (document.getElementById(id)) return id;
      }
      return candidates[0] || `panel-${tabId}`;
    },
    { navSelector, tabId }
  );
}

/**
 * Assert the dashboard tab panel for `tabId` is active and painted.
 */
export async function assertTabPanelActive(page, tabId, expect, opts = {}) {
  const minHeight = opts.minPanelHeight ?? MIN_PANEL_HEIGHT_PX;
  const navSelector = opts.navSelector ?? ".sidebar-nav .nav-btn";
  const panelId = await resolvePanelIdForTab(page, tabId, opts);

  const btn = page.locator(`${navSelector}[data-tab="${tabId}"]`);
  await expect(btn).toHaveAttribute("aria-selected", "true");

  const panel = page.locator(`#${panelId}`);
  const visible = await panel.evaluate((el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (el.classList.contains("hidden") || cs.display === "none" || cs.visibility === "hidden") {
      return false;
    }
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.width > 0;
  });
  expect(visible, `panel #${panelId} not visible after activating tab ${tabId}`).toBe(true);

  const box = await panel.boundingBox();
  expect(box, `panel #${panelId} has no layout box`).toBeTruthy();
  expect(box.height, `panel #${panelId} height after tab ${tabId}`).toBeGreaterThan(minHeight);
}

/**
 * Assert KE-style portal view switched to the tab id.
 */
export async function assertPortalViewActive(page, tabId, expect, opts = {}) {
  const attr = opts.portalViewAttr ?? "data-portal-view";
  const view = await page.evaluate((a) => document.body.getAttribute(a), attr);
  expect(view, `portal view after tab ${tabId}`).toBe(tabId);

  const btn = page.locator(
    `${opts.navSelector ?? ".sidebar-nav .nav-btn"}[data-tab="${tabId}"]`
  );
  await expect(btn).toHaveAttribute("aria-selected", "true");
}

/**
 * Click every visible primary sidebar tab and verify icon + activation.
 *
 * @returns {string[]} tab ids exercised
 */
export async function assertAllSidebarTabsOperational(page, expect, opts = {}) {
  const tabs = await listOperationalSidebarTabs(page, opts);
  expect(tabs.length, "no operational sidebar tabs found").toBeGreaterThan(0);

  const mode = opts.activationMode ?? (opts.portalViewAttr ? "portalView" : "panel");
  const exercised = [];

  for (const tab of tabs) {
    expect(
      tab.iconText.length,
      `tab ${tab.tabId} missing Material icon glyph`
    ).toBeGreaterThan(0);
    expect(
      tab.iconHeight,
      `tab ${tab.tabId} icon height (${tab.iconText})`
    ).toBeGreaterThan(MIN_ICON_SIZE_PX);
    expect(
      tab.iconWidth,
      `tab ${tab.tabId} icon width (${tab.iconText})`
    ).toBeGreaterThan(MIN_ICON_SIZE_PX);

    await clickSidebarTab(page, tab.tabId, expect, opts);

    if (mode === "portalView") {
      await assertPortalViewActive(page, tab.tabId, expect, opts);
    } else {
      await assertTabPanelActive(page, tab.tabId, expect, opts);
    }
    exercised.push(tab.tabId);
  }

  return exercised;
}

/** Legacy hash routes must not scroll sidebar tabs off-screen. */
export async function assertSidebarNavOnScreen(page, expect, opts = {}) {
  const navSelector = opts.navSelector ?? ".sidebar-nav .nav-btn";
  const viewport = page.viewportSize();
  const navBtns = page.locator(navSelector);
  const count = await navBtns.count();
  for (let i = 0; i < count; i++) {
    const box = await navBtns.nth(i).boundingBox();
    expect(box, `nav-btn[${i}] has no layout box`).toBeTruthy();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
}

/** Recovery fixture: hide every tab panel (simulates a broken switchTab). */
export async function forceAllTabPanelsHidden(page, panelSelector = DEFAULT_PANEL_SELECTOR) {
  await page.evaluate((sel) => {
    document.querySelectorAll(sel).forEach((p) => p.classList.add("hidden"));
  }, panelSelector);
}

export async function assertAllTabPanelsHidden(page, expect, panelSelector = DEFAULT_PANEL_SELECTOR) {
  const broken = await page.evaluate(
    (sel) =>
      Array.from(document.querySelectorAll(sel)).every((p) => p.classList.contains("hidden")),
    panelSelector
  );
  expect(broken, "expected every tab panel to have .hidden for recovery fixture").toBe(true);
}

/** Dispatch shell:tabChanged — tests recovery when chrome re-syncs panels. */
export async function dispatchShellTabChanged(page, tabId) {
  await page.evaluate((id) => {
    document.dispatchEvent(new CustomEvent("shell:tabChanged", { detail: { tabId: id } }));
  }, tabId);
}

/**
 * Wait for shell bootstrap — consumers pass a predicate for their patch marker.
 *
 * @param {import('@playwright/test').Page} page
 * @param {() => boolean | Promise<boolean>} readyFn runs in page context
 * @param {{ timeout?: number }} [opts]
 */
export async function waitForShellReady(page, readyFn, opts = {}) {
  await page.waitForFunction(readyFn, null, { timeout: opts.timeout ?? 15_000 });
}
