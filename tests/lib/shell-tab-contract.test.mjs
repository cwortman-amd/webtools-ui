#!/usr/bin/env node
/**
 * Unit tests for shell-tab-contract.mjs (no Playwright required).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  tabDeepLinkUrl,
  DEFAULT_PANEL_SELECTOR,
  MIN_PANEL_HEIGHT_PX,
  MIN_ICON_SIZE_PX,
} from "./shell-tab-contract.mjs";

test("tabDeepLinkUrl omits ?tab= for canonical home tab", () => {
  assert.equal(tabDeepLinkUrl("/pages/index.html", "paths"), "/pages/index.html");
  assert.equal(
    tabDeepLinkUrl("/pages/index.html", "paths", { canonicalHomeTab: "home" }),
    "/pages/index.html?tab=paths"
  );
});

test("tabDeepLinkUrl encodes non-home tabs", () => {
  assert.equal(
    tabDeepLinkUrl("/pages/index.html", "create"),
    "/pages/index.html?tab=create"
  );
  assert.equal(
    tabDeepLinkUrl("/pages/index.html", "my tab", { hash: "#section" }),
    "/pages/index.html?tab=my%20tab#section"
  );
});

test("exports stable defaults", () => {
  assert.equal(DEFAULT_PANEL_SELECTOR, ".tab-panel");
  assert.equal(MIN_PANEL_HEIGHT_PX, 20);
  assert.equal(MIN_ICON_SIZE_PX, 8);
});
