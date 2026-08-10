#!/usr/bin/env node
/**
 * Unit tests for playwright-fixtures.mjs (no Playwright required).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SHELL_BOOT_MS } from "./playwright-fixtures.mjs";

test("SHELL_BOOT_MS is a positive delay", () => {
  assert.ok(SHELL_BOOT_MS >= 500);
});
