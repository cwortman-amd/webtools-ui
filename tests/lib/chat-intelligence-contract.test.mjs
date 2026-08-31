import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const PRD = path.join(ROOT, "docs/CHAT_INTELLIGENCE.md");
const TEST_PLAN = path.join(ROOT, "docs/TEST_CHAT_INTELLIGENCE.md");
const KE_ROOT = path.resolve(ROOT, "../knowledge-exchange");

const REQUIRED_KE_MODULES = [
  "ke/studio/tutor/temporal_engine.py",
  "ke/studio/tutor/freshness_pipeline.py",
  "ke/studio/tutor/knowledge_graph.py",
  "ke/studio/tutor/policy_engine.py",
  "ke/studio/tutor/wikiqa.py",
  "ke/studio/http/temporal.py",
];

const REQUIRED_KE_TESTS = [
  "tests/test_temporal_engine.py",
  "tests/test_freshness_pipeline.py",
  "tests/test_temporal_api.py",
  "tests/test_business_days_and_fiscal_calendar.py",
  "tests/test_knowledge_graph.py",
  "tests/test_policy_engine.py",
];

test("CHAT_INTELLIGENCE PRD and test plan exist", () => {
  assert.ok(fs.existsSync(PRD), "docs/CHAT_INTELLIGENCE.md");
  assert.ok(fs.existsSync(TEST_PLAN), "docs/TEST_CHAT_INTELLIGENCE.md");
  const prd = fs.readFileSync(PRD, "utf8");
  assert.match(prd, /temporal-engine\/1\.0\.0/);
  assert.match(prd, /freshness_pipeline\.py/);
  assert.match(prd, /stale_source_contamination/);
  assert.match(prd, /POST \/api\/v1\/temporal\/resolve/);
  assert.match(prd, /UniversalTemporalEngine/);
  assert.match(prd, /fiscal_year_start_month.*10/);
});

test("reference implementation modules exist in knowledge-exchange", () => {
  for (const rel of REQUIRED_KE_MODULES) {
    const abs = path.join(KE_ROOT, rel);
    assert.ok(fs.existsSync(abs), rel);
  }
});

test("INT-* pytest suites exist in knowledge-exchange", () => {
  for (const rel of REQUIRED_KE_TESTS) {
    const abs = path.join(KE_ROOT, rel);
    assert.ok(fs.existsSync(abs), rel);
  }
});

test("shared mount exposes CHAT_INTELLIGENCE to consumers", () => {
  const keShared = path.join(KE_ROOT, "shared/docs/CHAT_INTELLIGENCE.md");
  assert.ok(fs.existsSync(keShared), "knowledge-exchange/shared/docs/CHAT_INTELLIGENCE.md");
});
