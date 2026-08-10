# Cross-Consumer Testing Blueprint

**Status:** 2026-08-10. Canonical layout for shared test infrastructure in `webtools-ui`,
consumed by sibling repos through `shared/` symlinks.

Companion docs:

- [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) — tier vocabulary and anti-false-positive protocol
- [`../tests/lib/shell-tab-contract.mjs`](../tests/lib/shell-tab-contract.mjs) — first extracted Playwright helper module

---

## 1. Inventory (concise)

| Repo | Test count (approx.) | Frameworks | Shared / duplicated | Unique (keep local) |
| --- | --- | --- | --- | --- |
| **webtools-ui** | cross-consumer scripts + lib + static gates | node + Playwright (resolved from siblings), Python | **Hub:** `cross-consumer-shell.mjs`, `iphone-ui.mjs`, `mobile-api-contract.mjs`, `tests/lib/*`, plugin/shell-module gates, `html_consistency_audit.py`, `enhanced_validation.sh`, nightly smoke workflow | Platform JS/CSS only — no product domain |
| **knowledge-exchange** | ~852 pytest + 18 Playwright specs + 2 node tests | pytest, Playwright, `node --test`, boundary AST | `shared/` gates in `make ci`; **`portal-helpers.js`** wraps `shell-tab-contract.mjs`; `ci-iphone` in GitHub CI | FAQ/wiki/deck assets, Studio pipeline, poster grade, orb streaming, MCP |
| **cluster-manager** | ~827 pytest + 19 e2e specs + 18 vm JS tests | unittest, pytest, Playwright, vm dom-stub | `iphone-ui.mjs`, `mobile-api-contract.mjs`; **`e2e/helpers/fixtures.js`** imports shared `playwright-fixtures.mjs` + local API mocks | Cluster report, install/IB/RCCL, agent workshop, live API perf |
| **llm-benchmark** | ~511 pytest + offline shell (~413 checks) | pytest, Playwright via `check_mobile_ios.mjs` | Static iOS CSS contract pattern; shared mobile scripts | GPU scheduler, sweep strategies, dashboard page paths (`/dashboard` not `/pages/index.html`) |
| **dc-planner** | 18 e2e specs + 10 node domain tests + golden JSON | Playwright (desktop + 4 iPhone projects), `node --test` | **`tests/e2e/fixtures.js`** (`planPage`, `switchTab`); IOS-01..18 iPhone spec | TCO/workload/rack/BOM math, agent traces, hardware-source audit |
| **demo-portal** | 15 pytest + `test.sh` levels | unittest, bash regression | Plugin gate only | Demo manifest, deploy scripts, launch regression |

### Duplication map

```text
Already shared (symlinked as shared/tests/):
  cross-consumer-shell.mjs   ← generic shell tab/panel + button visual regression (4 consumers)
  iphone-ui.mjs              ← 4 dashboard consumers (llm-benchmark, dc-planner, cluster-manager, knowledge-exchange)
  mobile-api-contract.mjs    ← MobileDrawer + ChatOrb API shape (node, ~1s)
  lib/shell-tab-contract.mjs, lib/shell-visual-contract.mjs, lib/playwright-fixtures.mjs, lib/iphone-helpers.mjs
  contracts/consumer-matrix.json
  playwright/cross-consumer-shell.spec.js + playwright.config.mjs

Forked in parallel (same intent, different depth):
  KE  tests/ui/helpers.js (local iPhone page open; shared iphone-helpers available)
  DC  tests/e2e/17-iphone-ui.spec.js (drawer scroll-lock, IOS-*)
  CM  e2e/tests/iphone-layout.spec.js (multi-page overflow)
  LB  scripts/check_mobile_ios.mjs + test_mobile_ios_contract.py

Static gates (webtools-ui/scripts/):
  check_shell_modules.py, check_plugin_manifests.py, html_consistency_audit.py
  enhanced_validation.sh (L0–L3 cross-repo orchestration)
```

**Current state (2026-08-10):** `knowledge-exchange` is already in `iphone-ui.mjs` CONSUMERS and
`mobile-api-contract.mjs` already runs in KE `make ci`. Prior audits that listed KE as missing are stale.

---

## 2. Proposed `webtools-ui/tests/` package structure

```text
webtools-ui/
  tests/
    lib/                              # importable helpers (no Playwright dep in webtools-ui itself)
      shell-tab-contract.mjs          # ✅ blank-panel guard, tab deep links, shell:tabChanged recovery
      shell-tab-contract.test.mjs     # ✅ node --test unit coverage
      iphone-helpers.mjs              # ✅ CDP safe-area, coarse-pointer probe, settle
      iphone-helpers.test.mjs         # ✅ node --test unit coverage
      playwright-fixtures.mjs         # ✅ gotoWithMode, demo-banner suppression
      playwright-fixtures.test.mjs    # ✅ node --test unit coverage
      consumer-matrix.mjs             # ✅ loads tests/contracts/consumer-matrix.json
      consumer-matrix.test.mjs        # ✅ node --test unit coverage
    iphone-ui.mjs                     # ✅ cross-consumer live mobile matrix (uses iphone-helpers + matrix)
    mobile-api-contract.mjs           # exists — MobileDrawer + ChatOrb contract
    cross-consumer-shell.mjs          # ✅ tab blank-panel regression across consumers
    combinatorial/
      matrix-runner.mjs               # CSV/JSON matrix → Playwright parametrize (Phase 2)
    contracts/
      consumer-matrix.json            # ✅ cross-consumer entry paths, iPhone device insets
      perf-budgets.schema.json        # per-consumer LCP/TBT/CLS budgets (Phase 2)
  schemas/                            # exists — plugin.manifest, shell-module
  scripts/
    run_cross_consumer_smoke.sh       # ✅ L0 node + L2 Playwright smoke (mobile-api + shell + iphone-ui)
    enhanced_validation.sh            # exists — extend with L2 mobile smoke (Phase 3)
  docs/
    CROSS_CONSUMER_TESTING.md         # this file
```

### Module API surfaces and adoption

| Module | Exported API | Consumers | Migration |
| --- | --- | --- | --- |
| **`shell-tab-contract.mjs`** | `tabDeepLinkUrl`, `collectMainAreaMetrics`, `assertNoBlankMainArea`, `assertProfileReconciled`, `clickSidebarTab`, `dispatchShellTabChanged`, `forceAllTabPanelsHidden` | KE, CM, DC, LB (dashboard shells) | KE: thin wrapper re-exports generic fns + local `TAB_EXPECTATIONS`; delete duplicated metrics fns from `portal-helpers.js` |
| **`iphone-helpers.mjs`** ✅ | `openPortalPage`, `applyInsets`, `assertCoarsePointerBlockIsLive`, `settle` | All dashboard consumers + shared `iphone-ui.mjs` | Wired into `iphone-ui.mjs` CDP path; KE can thin-wrap for local specs |
| **`mobile-api-contract.mjs`** (exists) | vm contract on `MobileDrawer.install`, ChatOrb source/css patterns | All 5 consumers via `make ci` | Wire into webtools-ui `make ci` + demo-portal `test.sh` (LB/CM/DC already indirect) |
| **`playwright-fixtures.mjs`** ✅ | `gotoWithMode`, `setupApiMocks`, `suppressDemoBanner` | CM, KE, DC | Used by `cross-consumer-shell.mjs`; consumers adopt incrementally |
| **`consumer-matrix.mjs`** ✅ | `loadConsumerMatrix`, `resolveReachableConsumers` | `iphone-ui.mjs`, `cross-consumer-shell.mjs` | Single JSON contract at `tests/contracts/consumer-matrix.json` |
| **`combinatorial/matrix-runner.mjs`** (planned) | `loadMatrix(path)`, `shardCases(cases, n)` | KE first, then CM tab×mode loops | KE `tests/combinatorial/generate_matrix.py` output → shared runner |
| **`contracts/perf-budgets.schema.json`** (planned) | JSON Schema for `{ lcp, cls, tbt, weight }` per route | KE, CM, DC | KE `perf.spec.js` reads local budgets file validated against schema |
| **`run_cross_consumer_smoke.sh`** ✅ | L0 node tests + mobile-api + shell + iphone-ui | `make cross-consumer-smoke` | `--skip-playwright`; `WEBTOOLS_UI_CONSUMERS` env override |

---

## 3. Tiered test pyramid (all consumers)

These tiers map to **webtools-ui orchestration layers** and the canonical framework in
[`TESTING_STRATEGY.md`](TESTING_STRATEGY.md). They are intentionally coarser than Tier 0–6 —
optimized for CI wiring, not documentation completeness.

| Tier | What | Where runs | Consumers |
| --- | --- | --- | --- |
| **L0 — Static / node** | `node --check`, plugin manifest strict, shell-module schema, `mobile-api-contract.mjs`, `shell-tab-contract.test.mjs`, ruff/compileall (local) | webtools-ui `make ci`; each consumer `make ci` / `shared-check` | All 5 + hub |
| **L1 — Plugin / shell-modules** | `check_shared_mount.py`, `check_shell_modules.py`, `check_index_skeleton.py`, vendor manifest | webtools-ui CI; consumer `make ci` when sibling present | All 5 |
| **L2 — Mobile API + iPhone matrix** | `mobile-api-contract.mjs`, `cross-consumer-shell.mjs`, `iphone-ui.mjs` (matrix from `consumer-matrix.json`), `html_consistency_audit.py` | webtools-ui `enhanced-validation` (L2c **required** when not `--skip-slow`); nightly `cross-consumer-smoke` | CM, DC, LB, KE (dashboard); demo-portal N/A |
| **L3 — Consumer Playwright deep suite** | Product workflows: KE 18 specs, CM 19 e2e shards, DC 18 e2e, LB `check_mobile_ios.mjs` | Each repo's CI / self-check | Per consumer — **not** in monorepo gate |
| **L4 — Live API** | CM `api-perf-selfcheck`, KE Studio streaming/orb specs, demo-portal `test.sh --level launch` | Separate jobs with `--require-live` flags | CM, KE, demo-portal |

**Gate cadence recommendation:**

| Trigger | Tiers |
| --- | --- |
| Pre-commit | L0 (node contract tests + syntax) |
| PR — consumer | L0 + L1 + consumer pytest/unittest |
| PR — `shared/` or `portal/` change | L0 + L1 + L2 (`enhanced-validation-quick` minimum) |
| Merge / nightly | L0–L2 full matrix; L3 sharded in owning repo |
| Release | L3 + L4 + artifact/determinism (consumer-local) |

---

## 4. Implementation roadmap

### Phase 1 — Add to webtools-ui now (1–2 days)

| # | Task | Effort | Value |
| --- | --- | --- | --- |
| 1 | **`shell-tab-contract.mjs`** + node unit test | ✅ Done | Generic blank-panel guard for all dashboard shells |
| 2 | **`docs/CROSS_CONSUMER_TESTING.md`** (this file) | ✅ Done | Single blueprint for sibling repos |
| 3 | Add `node --test tests/lib/*.test.mjs` to webtools-ui `make ci` | ✅ Done | `make test-shared` in `make ci` |
| 4 | Add `mobile-api-contract.mjs` to webtools-ui `make ci` | ✅ Done | Part of `make test-shared` |
| 5 | **`tests/lib/iphone-helpers.mjs`** — upstream CDP insets + coarse-pointer probe from KE | ✅ Done | Wired into `iphone-ui.mjs`; unit tests in `iphone-helpers.test.mjs` |
| 6 | **`scripts/run_cross_consumer_smoke.sh`** — mobile-api + shell + `iphone-ui.mjs --json` | ✅ Done | `make cross-consumer-smoke`; `--skip-playwright` for L0-only |

### Phase 2 — Consumer migrations

| # | Task | Repo | Notes |
| --- | --- | --- | --- |
| 1 | Refactor `portal-helpers.js` to wrap `shared/tests/lib/shell-tab-contract.mjs` | KE | ✅ Done — local `TAB_EXPECTATIONS` + Studio asserts kept |
| 2 | Wire combinatorial matrix → Playwright spec | KE | Gap 15 in `docs/TESTING_STRATEGY.md` |
| 3 | Add `make ci-iphone` to KE GitHub CI | KE | ✅ Done — `iphone` job in `.github/workflows/ci.yml` |
| 4 | Adopt shared fixtures for mode/API mocking | CM → shared, KE imports | ✅ Done (CM) — `suppressDemoBanner` / `gotoShellEntry` from shared; API mocks stay local |
| 5 | Merge DC IOS-09..12 drawer scroll-lock into shared or KE spec | DC, KE | Avoid four parallel drawer implementations |
| 6 | Subprocess boundary AST template | KE → CM, LB | `tests/boundary/test_subprocess_contract.py` pattern |
| 7 | `mobile-api-contract.mjs` in demo-portal `test.sh` unit block | demo-portal | Catches hub plugin regressions |

### Phase 3 — CI wiring in enhanced-validation

| # | Task | Notes |
| --- | --- | --- |
| 1 | Add L2b: `node tests/mobile-api-contract.mjs` in `enhanced_validation.sh` | ✅ Done |
| 2 | Add L2c: `cross-consumer-shell.mjs` + `iphone-ui.mjs --json` (**required** when not `--skip-slow`) | ✅ Done — PR CI installs Playwright via dc-planner |
| 3 | Extend `html_consistency_audit.py` CONSUMER_REPOS to include `knowledge-exchange` | ✅ Done — catalog profile skips dashboard-only checks |
| 4 | Nightly workflow running `make cross-consumer-smoke` | ✅ Done — `.github/workflows/nightly-cross-consumer.yml` (06:00 UTC) |
| 5 | Env override: `WEBTOOLS_UI_CONSUMERS=...` for matrix runners | ✅ Done — via `consumer-matrix.mjs` |

---

## 5. What stays consumer-specific (honest limits)

Do **not** attempt to generalize these — they encode product domain, not platform contracts:

| Repo | Keep local |
| --- | --- |
| **knowledge-exchange** | FAQ merit/density, wiki golden, deck asset integrity, poster grade, module SVG pilots, Studio orchestrator, Create tab lifecycle, orb streaming/handoff |
| **cluster-manager** | Cluster report batteries, install compliance, IB/RCCL playbooks, agent workshop traces, iframe tab domains (install/network/monitor/debug) |
| **dc-planner** | TCO/workload/rack/BOM domain math, golden JSON snapshots, hardware-source audit |
| **llm-benchmark** | GPU scheduler, sweep strategies, MCP stdio bridge, `/dashboard` page topology (different entry path from `/pages/index.html`) |
| **demo-portal** | Per-demo deploy script contents, AIM blueprint wiring, launch regression against live agent |

**Shell contract vs product panel:** Shared tests assert *a tab switch paints a visible panel* and *mobile chrome behaves*. They do not assert *what* is inside `#cards` or iframe health grids — that remains in consumer `TAB_EXPECTATIONS` maps.

---

## 6. Quick commands

```bash
# Shared node contract (all consumers, ~1s)
node shared/tests/mobile-api-contract.mjs

# Shared shell helper unit tests
node --test shared/tests/lib/shell-tab-contract.test.mjs

# Cross-consumer shell regression (needs Playwright from a sibling)
node shared/tests/cross-consumer-shell.mjs
node shared/tests/cross-consumer-shell.mjs --repo dc-planner --json

# Cross-consumer iPhone matrix (CDP safe-area + coarse-pointer probes)
node shared/tests/iphone-ui.mjs
node shared/tests/iphone-ui.mjs --repo knowledge-exchange --device "iPhone SE"

# One-command smoke (L0 + L2)
make cross-consumer-smoke
make cross-consumer-smoke -- --skip-playwright   # L0 only

# Per-consumer Playwright spec (from consumer repo root)
WEBTOOLS_UI_CONSUMER_ROOT=$PWD npx playwright test \
  shared/tests/playwright/cross-consumer-shell.spec.js \
  --config shared/tests/playwright.config.mjs

# Full ecosystem validation (webtools-ui checkout)
cd webtools-ui && make enhanced-validation-quick   # L0–L1 + syntax; skips L2c Playwright
cd webtools-ui && make enhanced-validation           # L2c Playwright required
```

---

## 7. Decision checklist

| Question | Answer |
| --- | --- |
| Where do shared portal shell tests live? | **`webtools-ui/tests/lib/`** for importable helpers; **`webtools-ui/tests/`** for runnable cross-consumer scripts |
| Which iPhone harness is canonical? | **`iphone-ui.mjs`** with `iphone-helpers.mjs` (CDP insets + coarse-pointer probe); consumer specs for product chrome |
| Should KE full Playwright run in GitHub CI? | **`ci-iphone` only** — landed in KE workflow; not full `ci-ui` (LLM/streaming deps) |
| Biggest current blind spot? | Combinatorial matrix unwired; llm-benchmark vendor manifest drift in `test_offline.sh` |
| Combinatorial strategy? | KE generator exists — **wire to spec** before copying to other repos |
