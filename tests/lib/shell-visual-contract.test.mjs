#!/usr/bin/env node
/**
 * Unit tests for shell-visual-contract.mjs (no Playwright required).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  contrastRatio,
  parseCssRgb,
  DEFAULT_SHELL_BUTTON_TIERS,
} from "./shell-visual-contract.mjs";

test("contrastRatio: white on Apple blue meets large-text AA (3:1)", () => {
  const white = [255, 255, 255];
  const blue = [10, 132, 255]; // matte-dark --ui-accent
  assert.ok(contrastRatio(white, blue) >= 3);
});

test("contrastRatio: black vs white on accent differ (token regression guard)", () => {
  const blue = [10, 132, 255];
  const whiteRatio = contrastRatio([255, 255, 255], blue);
  const blackRatio = contrastRatio([0, 0, 0], blue);
  assert.notEqual(whiteRatio, blackRatio);
});

test("parseCssRgb handles rgb and rgba", () => {
  assert.deepEqual(parseCssRgb("rgb(10, 132, 255)"), [10, 132, 255]);
  assert.deepEqual(parseCssRgb("rgba(0, 0, 0, 0.8)"), [0, 0, 0]);
  assert.equal(parseCssRgb("transparent"), null);
});

test("DEFAULT_SHELL_BUTTON_TIERS exports primary + nav tiers", () => {
  assert.ok(DEFAULT_SHELL_BUTTON_TIERS.some((t) => t.role === "primary-accent"));
  assert.ok(DEFAULT_SHELL_BUTTON_TIERS.some((t) => t.role === "nav-active"));
});
