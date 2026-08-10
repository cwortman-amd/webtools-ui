#!/usr/bin/env node
/**
 * Unit tests for consumer-matrix.mjs (no Playwright required).
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  loadConsumerMatrix,
  resolveReachableConsumers,
  matrixPath,
} from "./consumer-matrix.mjs";

test("consumer matrix file exists and parses", () => {
  assert.ok(fs.existsSync(matrixPath()));
  const { consumers, iphoneDevices } = loadConsumerMatrix();
  assert.ok(consumers.length >= 4);
  assert.ok(iphoneDevices.length >= 4);
});

test("each consumer has required shell fields", () => {
  const { consumers } = loadConsumerMatrix();
  for (const c of consumers) {
    assert.ok(c.id);
    assert.ok(c.entryPath.startsWith("/"));
    assert.ok(c.shellNavSelector);
  }
});

test("WEBTOOLS_UI_CONSUMERS filters matrix", () => {
  const prev = process.env.WEBTOOLS_UI_CONSUMERS;
  process.env.WEBTOOLS_UI_CONSUMERS = "dc-planner,cluster-manager";
  try {
    const { consumers } = loadConsumerMatrix();
    assert.equal(consumers.length, 2);
    assert.deepEqual(consumers.map((c) => c.id).sort(), ["cluster-manager", "dc-planner"]);
  } finally {
    if (prev === undefined) delete process.env.WEBTOOLS_UI_CONSUMERS;
    else process.env.WEBTOOLS_UI_CONSUMERS = prev;
  }
});

test("resolveReachableConsumers returns only existing repos", () => {
  const reachable = resolveReachableConsumers();
  assert.ok(reachable.length >= 1);
  for (const r of reachable) {
    assert.ok(fs.existsSync(r.entryFile), `${r.entryFile} missing`);
  }
});
