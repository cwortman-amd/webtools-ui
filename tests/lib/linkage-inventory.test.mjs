import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  INVENTORY_PATH,
  loadLinkageInventory,
  controlsFor,
} from "./fe-be-linkage.mjs";

test("linkage inventory file exists and parses", () => {
  assert.ok(fs.existsSync(INVENTORY_PATH));
  const inv = loadLinkageInventory();
  assert.ok(Array.isArray(inv.consumers));
  assert.ok(inv.consumers.length >= 6);
});

test("loadLinkageInventory filters by consumerId", () => {
  const inv = loadLinkageInventory({ consumerId: "cluster-manager" });
  assert.equal(inv.consumers.length, 1);
  assert.equal(inv.consumers[0].id, "cluster-manager");
});

test("controlsFor returns controls for a consumer", () => {
  const controls = controlsFor("llm-benchmark");
  assert.ok(controls.length >= 5);
  assert.ok(controls.some((c) => c.id === "queue.refresh"));
  assert.ok(controls.every((c) => c.view));
});

test("controlsFor filters by tab and criticalOnly", () => {
  const queueControls = controlsFor("llm-benchmark", { tab: "queue" });
  assert.ok(queueControls.length >= 2);
  assert.ok(queueControls.every((c) => c.view === "queue"));

  const critical = controlsFor("cluster-manager", { criticalOnly: true });
  assert.ok(critical.length >= 1);
  assert.ok(critical.every((c) => c.critical === true));
});

test("controlsFor withBackend requires backend.path", () => {
  const linked = controlsFor("demo-portal", { withBackend: true });
  assert.ok(linked.length >= 1);
  assert.ok(linked.every((c) => c.backend && c.backend.path));
});

test("controlsFor returns empty for unknown consumer", () => {
  assert.deepEqual(controlsFor("nonexistent-consumer"), []);
});
