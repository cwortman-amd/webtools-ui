/**
 * Shared helpers for frontend→backend linkage tests (Playwright + node --test).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const INVENTORY_PATH = path.resolve(HERE, "../contracts/linkage-inventory.json");

export function loadLinkageInventory(opts = {}) {
  const raw = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
  let consumers = raw.consumers || [];
  if (opts.consumerId) {
    consumers = consumers.filter((c) => c.id === opts.consumerId);
  }
  return { ...raw, consumers };
}

/** Collect all controls for a consumer, optionally filtered by tab/view. */
export function controlsFor(consumerId, opts = {}) {
  const { consumers } = loadLinkageInventory({ consumerId });
  const consumer = consumers[0];
  if (!consumer) return [];
  let controls = consumer.controls || [];
  if (opts.tab) controls = controls.filter((c) => c.view === opts.tab);
  if (opts.criticalOnly) controls = controls.filter((c) => c.critical === true);
  if (opts.withBackend) controls = controls.filter((c) => c.backend && c.backend.path);
  return controls;
}

/** Minimal expect shim when Playwright expect is unavailable. */
export function makeExpect() {
  return {
    toBe(actual, expected, msg) {
      if (actual !== expected) throw new Error(msg || `expected ${expected}, got ${actual}`);
    },
    toBeTruthy(actual, msg) {
      if (!actual) throw new Error(msg || "expected truthy");
    },
    toMatch(actual, re, msg) {
      if (!re.test(String(actual))) throw new Error(msg || `expected ${actual} to match ${re}`);
    },
  };
}

/**
 * Open a shell tab by data-tab id; returns frame locator for iframe panels.
 */
export async function openShellTab(page, tabId, opts = {}) {
  const nav = opts.navSelector || ".sidebar-nav .nav-btn";
  const panelSelector = opts.panelSelector || ".tab-panel";
  await page.locator(`${nav}[data-tab="${tabId}"]`).click();
  const panel = page.locator(`#panel-${tabId}, ${panelSelector}[data-tab-panel="${tabId}"]`).first();
  await panel.waitFor({ state: "visible", timeout: opts.timeout || 15_000 });
  const frame = panel.locator("iframe").first();
  if ((await frame.count()) === 0) return page;
  return page.frameLocator(`#panel-${tabId} iframe, ${panelSelector}[data-tab-panel="${tabId}"] iframe`).first();
}

/**
 * Assert clicking a control triggers an HTTP request matching method + path pattern.
 */
export async function expectRequestOnAction(page, actionFn, { method, pathPattern, timeout = 10_000 }) {
  const pattern = pathPattern instanceof RegExp ? pathPattern : new RegExp(pathPattern);
  const reqPromise = page.waitForRequest(
    (r) => pattern.test(r.url()) && r.method() === method,
    { timeout }
  );
  await actionFn();
  const req = await reqPromise;
  return req;
}

/**
 * Track API calls during an async action.
 */
export async function collectRequests(page, actionFn, filterFn) {
  const hits = [];
  const handler = (r) => {
    if (!filterFn || filterFn(r)) hits.push({ url: r.url(), method: r.method() });
  };
  page.on("request", handler);
  try {
    await actionFn();
    await page.waitForTimeout(500);
  } finally {
    page.off("request", handler);
  }
  return hits;
}
