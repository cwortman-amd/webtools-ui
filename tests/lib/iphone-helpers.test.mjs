#!/usr/bin/env node
/**
 * Unit tests for iphone-helpers.mjs (no Playwright required).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  NO_INSETS,
  validateDeviceCases,
  applyInsets,
  settle,
  assertCoarsePointerBlockIsLive,
  describeEl,
  standaloneExpect,
} from "./iphone-helpers.mjs";
import { loadConsumerMatrix } from "./consumer-matrix.mjs";

test("NO_INSETS is all zeros", () => {
  assert.deepEqual(NO_INSETS, { top: 0, right: 0, bottom: 0, left: 0 });
});

test("validateDeviceCases accepts known Playwright descriptors", () => {
  const devices = {
    "iPhone SE": { viewport: { width: 375, height: 667 } },
    "iPhone 13": { viewport: { width: 390, height: 844 } },
  };
  assert.doesNotThrow(() =>
    validateDeviceCases(devices, [
      { name: "iPhone SE", descriptor: "iPhone SE", insets: NO_INSETS },
      { name: "iPhone 13", descriptor: "iPhone 13", insets: { top: 47, bottom: 34 } },
    ])
  );
});

test("validateDeviceCases throws on unknown descriptor", () => {
  const devices = { "iPhone SE": {} };
  assert.throws(
    () => validateDeviceCases(devices, [{ descriptor: "iPhone 99" }]),
    /Playwright has no device descriptor "iPhone 99"/
  );
});

test("consumer-matrix iphoneDevices pass validateDeviceCases shape", () => {
  const { iphoneDevices } = loadConsumerMatrix();
  for (const c of iphoneDevices) {
    assert.ok(c.name);
    assert.ok(c.descriptor);
    assert.ok(c.insets && typeof c.insets === "object");
  }
  assert.ok(iphoneDevices.some((d) => d.name === "iPhone SE"));
  assert.deepEqual(
    iphoneDevices.find((d) => d.name === "iPhone SE")?.insets,
    NO_INSETS
  );
});

test("applyInsets sends CDP safe-area override", async () => {
  const calls = [];
  const cdp = {
    send: async (cmd, args) => {
      calls.push({ cmd, args });
    },
  };
  const insets = { top: 47, right: 0, bottom: 34, left: 0 };
  await applyInsets(cdp, insets);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].cmd, "Emulation.setSafeAreaInsetsOverride");
  assert.deepEqual(calls[0].args.insets, insets);
});

test("settle waits for animation frames and timeout", async () => {
  let frameCount = 0;
  const page = {
    evaluate: async (fn, n) => {
      for (let i = 0; i < n; i++) frameCount++;
    },
    waitForTimeout: async (ms) => {
      assert.equal(ms, 450);
    },
  };
  await settle(page, 3, 450);
  assert.equal(frameCount, 3);
});

test("assertCoarsePointerBlockIsLive passes when probe matches", async () => {
  const page = {
    evaluate: async () => ({
      coarseAndNoHover: true,
      probeFontSize: "16px",
    }),
  };
  const probe = await assertCoarsePointerBlockIsLive(page, "unit");
  assert.equal(probe.probeFontSize, "16px");
});

test("assertCoarsePointerBlockIsLive throws when coarse media does not match", async () => {
  const page = {
    evaluate: async () => ({
      coarseAndNoHover: false,
      probeFontSize: "16px",
    }),
  };
  await assert.rejects(
    () => assertCoarsePointerBlockIsLive(page, "unit"),
    /touch block not exercised/
  );
});

test("assertCoarsePointerBlockIsLive throws when font-size probe fails", async () => {
  const page = {
    evaluate: async () => ({
      coarseAndNoHover: true,
      probeFontSize: "9px",
    }),
  };
  await assert.rejects(
    () => assertCoarsePointerBlockIsLive(page, "unit"),
    /touch block not live/
  );
});

test("describeEl formats element descriptors", () => {
  assert.equal(describeEl({ tag: "div", id: "main", className: "foo bar" }), "div#main.foo.bar");
  assert.equal(describeEl({ tag: "button", className: "" }), "button");
  assert.equal(describeEl({ tag: "a", id: "x" }), "a#x");
});

test("standaloneExpect toBe matcher works", () => {
  const matcher = standaloneExpect.toBe(16);
  assert.equal(matcher.pass(16), true);
  assert.equal(matcher.pass(9), false);
});
