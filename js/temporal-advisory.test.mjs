import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const SCRIPT = path.join(ROOT, "temporal-advisory.js");

function loadTemporalAdvisory() {
  const code = fs.readFileSync(SCRIPT, "utf8");
  const context = { globalThis: {}, window: {} };
  context.globalThis = context.window;
  vm.runInNewContext(code, context);
  return context.globalThis.TemporalAdvisory;
}

const REF = new Date("2026-08-31T12:00:00");

test("advisory 45-day offset matches backend anchor", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("What is 45 days from now?", REF);
  assert.ok(out);
  assert.equal(out.result, "2026-10-15");
});

test("advisory countdown until October 15", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("How many days until October 15?", REF);
  assert.ok(out);
  assert.equal(out.days_remaining, 45);
  assert.equal(out.result, "2026-10-15");
});

test("advisory next business day (Labor Day weekend)", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("next business day", REF);
  assert.ok(out);
  assert.equal(out.result, "2026-09-01");
});

test("advisory previous business day", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("previous business day", REF);
  assert.ok(out);
  assert.equal(out.result, "2026-08-28");
});

test("advisory in 5 business days", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("in 5 business days", REF);
  assert.ok(out);
  assert.equal(out.result, "2026-09-08");
});

test("advisory FY27 Q1 with fiscal start October", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("FY27 Q1", REF, { fiscal_year_start_month: 10 });
  assert.ok(out);
  assert.equal(out.start, "2026-10-01");
  assert.equal(out.end, "2026-12-31");
});

test("advisory this fiscal quarter at anchor August 31", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("this fiscal quarter", REF, { fiscal_year_start_month: 10 });
  assert.ok(out);
  assert.equal(out.start, "2026-07-01");
  assert.equal(out.end, "2026-09-30");
});

test("advisory next Friday at 5pm", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("next Friday at 5pm", REF, { timezone: "UTC" });
  assert.ok(out);
  assert.equal(out.kind, "named_weekday_time");
});

test("advisory time at 5pm", () => {
  const TA = loadTemporalAdvisory();
  const out = TA.resolve("meeting at 5pm", REF);
  assert.ok(out);
  assert.equal(out.kind, "time_at");
});

test("reconcile flags mismatch against backend receipt", () => {
  const TA = loadTemporalAdvisory();
  const advisory = { result: "2026-10-15" };
  const ok = TA.reconcile(advisory, { result: "2026-10-15" });
  const bad = TA.reconcile(advisory, { result: "2026-01-01" });
  assert.equal(ok.ok, true);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "result_mismatch");
});
