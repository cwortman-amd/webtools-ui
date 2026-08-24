---
type: Test Plan
title: Frontend → Backend Traceability Matrix
description: '**Status:** 2026-08-23. Canonical FE→BE linkage inventory, CI gates, and per-consumer control coverage.'
---
# Frontend → Backend Traceability Matrix

**Status:** 2026-08-23. This document is the human-readable companion to the machine-readable
linkage contracts under `tests/contracts/`. Every critical UI control that mutates state, reads
server data, or invokes an agent/MCP bridge should appear in the inventory with a registered test
reference.

Companion artifacts:

| Artifact | Path | Role |
| --- | --- | --- |
| Linkage inventory | [`tests/contracts/linkage-inventory.json`](../tests/contracts/linkage-inventory.json) | Canonical list of consumers, tabs, controls, backend paths, and test refs |
| Linkage exclusions | [`tests/contracts/linkage-exclusions.json`](../tests/contracts/linkage-exclusions.json) | Intentionally unlinked or client-only controls with owner + remediation |
| Inventory checker | [`scripts/check_linkage_inventory.py`](../scripts/check_linkage_inventory.py) | CI gate: critical controls must have tests; `gap` status fails |
| Adversarial preflight | [`scripts/adversarial_test_preflight.py`](../scripts/adversarial_test_preflight.py) | Verifies registered test files exist on disk; run via `make adversarial-preflight` or Cursor `/test` |
| Node helpers | [`tests/lib/fe-be-linkage.mjs`](../tests/lib/fe-be-linkage.mjs) | `loadLinkageInventory`, `controlsFor`, Playwright request helpers |
| Node unit tests | [`tests/lib/linkage-inventory.test.mjs`](../tests/lib/linkage-inventory.test.mjs) | Validates inventory shape and filter helpers |

Related docs:

- [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) — tier vocabulary (unit / integration / e2e)
- [`CROSS_CONSUMER_TESTING.md`](CROSS_CONSUMER_TESTING.md) — shared Playwright harness layout

---

## 1. Purpose and scope

The AMD Instinct webtools suite ships seven browser dashboards (platform hub + six consumers).
Each dashboard exposes dozens of buttons, tabs, and agent surfaces that ultimately call HTTP APIs,
Web Workers, MCP stdio bridges, or static assets. Regressions often appear when:

1. A frontend selector or tab id changes but the backend route stays the same (or vice versa).
2. A control is added without an e2e or unit test that proves the request fires.
3. A “client-only” feature is mistaken for a backend gap and blocks release.

The traceability matrix solves this by treating **controls as first-class contract objects**. Each
control records its DOM selector, expected HTTP/MCP/worker backend, UI confirmation selector, test
references, and linkage status (`linked`, `fixed`, `excluded`, or `gap`).

---

## 2. Inventory schema (linkage-inventory.json)

Each consumer block contains:

```text
consumer
  id              — repo slug (e.g. cluster-manager)
  entryPath       — shell entry HTML path
  tabs[]          — tab id, label, optional iframe/mode
  controls[]
    id            — dotted id (view.action)
    view          — tab id or special: shell, module, mcp, suite
    selector      — Playwright/CSS selector
    action        — load | click | change | submit | mcp | agent
    backend       — { type, method, path }
    persistence   — localStorage keys or null
    uiConfirmation — selector proving success
    critical      — bool; critical controls must have tests
    status        — linked | fixed | excluded | gap
    tests         — { unit?, integration?, e2e? }
```

The `$schema` field is `linkage-inventory-v1`. Update the `updated` stamp when adding controls.

Exclusions (`linkage-exclusions.json`) document controls that are **deliberately** without backend
linkage. The checker skips `(consumer, controlId)` pairs listed there or marked `status: excluded`.

---

## 3. Resolved linkage defects (2026-08)

Three defects were tracked as `gap` or untested critical paths and are now closed:

### 3.1 Cluster Manager — report battery defaults

| Field | Value |
| --- | --- |
| Control | `cluster-manager.report.defaults` |
| Tab | Report |
| Backend | `GET /api/report/cluster/defaults` |
| Symptom | Report tab loaded without fetching customer/operator battery defaults; form fields empty on first paint |
| Fix | Wired boot fetch + localStorage hydration (`cm-cluster-report-metadata`) |
| Status | `fixed` |
| Test | `e2e/tests/tab-linkage.spec.js#report-defaults` |

### 3.2 LLM Benchmark — Deploy (queue) tab

| Field | Value |
| --- | --- |
| Controls | `llm-benchmark.queue.refresh`, `llm-benchmark.queue.serverCheck` |
| Tab | Deploy (`queue` view id — iframe `deploy.html`) |
| Backends | `GET /api/jobs`, `POST /api/server/check` |
| Symptom | Deploy board tab missing from linkage inventory; refresh and server-check untested in cross-tab e2e |
| Fix | Added tab + controls to inventory; tab-linkage spec covers kanban refresh and inference check |
| Status | `linked` |
| Tests | `tests/e2e/tab-linkage.spec.js#queue-refresh`, `#queue-server-check` |

### 3.3 Demo Portal — MCP list_demos

| Field | Value |
| --- | --- |
| Control | `demo-portal.mcp.listDemos` |
| View | `mcp` (stdio bridge, not DOM) |
| Backend | MCP stdio `tools/call list_demos` |
| Symptom | MCP tool registered in manifest but no unit boundary proving stdio bridge returns demo array |
| Fix | Added inventory row + Python unit test on stdio bridge |
| Status | `fixed` |
| Test | `tests/test_mcp_stdio_bridge.py#list_demos` |

---

## 4. CI gates

The webtools-ui `make ci` target runs linkage validation alongside existing platform gates:

```text
make ci
  ├─ test-shared          node --test tests/lib/*.test.mjs + mobile-api-contract
  ├─ coverage             pytest-cov (python + scripts, branch tracking enabled)
  ├─ html-audit           html_consistency_audit.py
  ├─ check-extensions     check_extensions.py
  ├─ check-mcp            check_mcp_registration.py --strict
  ├─ check-agent          check_agent_gateway.py
  ├─ check-linkage        check_linkage_inventory.py
  ├─ adversarial-preflight  on-disk test files + #anchors + backend path tokens
  └─ ci_plugin_gate.sh    plugin manifest strict gate
```

### check-linkage rules

`scripts/check_linkage_inventory.py` fails when:

- Any control has `status: gap` (unresolved defect).
- A **critical** control lacks `tests.unit`, `tests.integration`, or `tests.e2e` (unless `status: fixed` or excluded).
- A critical control with a non-navigation backend is missing `backend.path`.

Warnings (non-fatal): control `view` not listed in consumer `tabs` (allowed special views: `shell`, `module`, `mcp`, `report-action`, `suite`).

Run locally:

```bash
make check-linkage
make adversarial-preflight
# or
python3 scripts/check_linkage_inventory.py
python3 scripts/adversarial_test_preflight.py
```

`/test` in Cursor always runs adversarial-preflight (skill + missing-test fill) before suite execution.

---

## 5. Coverage and branch policy

Two coverage surfaces apply to the platform repo:

| Surface | Tool | Threshold | Branch |
| --- | --- | --- | --- |
| Python boundary | `pytest-cov` / `coverage.py` | `fail_under = 15` (lines, combined when branch enabled) | `[tool.coverage.run] branch = true` in `pyproject.toml` |
| Node shared JS | `c8` via `npm run test:coverage` | `--lines 25 --branches 20` | Enforced in `package.json` |

`coverage.py` does not support a separate `fail_under` for branches only; enabling `branch = true`
includes branch hits in the overall report percentage. Node unit tests use `c8 --check-coverage`
with explicit branch and line floors.

Makefile targets:

- `make coverage` — Python tests with term-missing report
- `make coverage-node` — delegates to `npm run test:coverage`

New vm-based unit tests cover platform JS seams:

| Module | Test file | Exercises |
| --- | --- | --- |
| `js/plugin-bootstrap.js` | `tests/lib/plugin-bootstrap.test.mjs` | `resolveExtensionsSource`, deferred script skip, ExtensionHost boot |
| `js/mcp-suite.js` | `tests/lib/mcp-suite-http.test.mjs` | HTTP JSON-RPC success + error paths |
| `js/voice-local.js` | `tests/lib/voice-local.test.mjs` | Capabilities probe, TTS 503 degradation |

---

## 6. Per-consumer summary

### webtools-ui (platform hub)

| Tab | Critical controls | Backend types | Notes |
| --- | --- | --- | --- |
| suite | 1 | HTTP GET `/plugins.registry.json` | Tools Hub boot |
| suite | 0 (excluded) | none | Install modal — curl copy only |

### llm-benchmark

| Tab | Critical controls | Key backends | E2E anchor |
| --- | --- | --- | --- |
| plan | 2 | `/api/presets`, `/api/validate/sweep` | tab-linkage |
| queue (Deploy) | 2 | `/api/jobs`, `/api/server/check` | queue-refresh, queue-server-check |
| profile | 1 | `/api/jobs` | profile-jobs |
| report | 1 | `/api/reports` | report-load |
| view | 1 (excluded) | static CSV | indirect via deploy |

### dc-planner

| Tab | Critical controls | Backend types | Notes |
| --- | --- | --- | --- |
| workload | 2 | worker + MCP bridge | agent validate |
| tco | 1 | worker | TCO recalc |
| report-action | 1 | navigation | Generate Report → report.html |

### cluster-manager

| Tab | Critical controls | Key backends | Status |
| --- | --- | --- | --- |
| install | 1 | `/api/install/versions` | linked |
| report | 1 | `/api/report/cluster/defaults` | **fixed** (defaults) |
| docs | 1 | `/api/docs/list` | linked |
| network | 1 | `/api/fabric/discover` | linked |

### demo-portal

| Tab / view | Critical controls | Backend | Status |
| --- | --- | --- | --- |
| catalog | 1 | `/data/manifest.json` | linked |
| catalog | 1 (excluded) | none — client filter | excluded |
| tools | 1 | `/data/plugins.registry.json` | linked |
| module | 1 | POST run agent | linked |
| mcp | 1 | stdio list_demos | **fixed** |

### knowledge-exchange

| Tab | Critical controls | Key backends |
| --- | --- | --- |
| catalog | 1 | `/portal/manifest.json` |
| resources | 1 | `/view` FAQ preview |
| shell | 1 | `/api/ask` orb |
| create | 1 | `/api/dev/generate` |

### slide-presenter

| Tab | Critical controls | Key backends |
| --- | --- | --- |
| search | 1 | `/api/search/analyze` |
| build | 1 | `/api/decks` |
| present | 2 | `/api/slides/`, `/api/sessions` |

**Totals (inventory v2026-08-23):** 7 consumers, 36 controls, 8 exclusions, 0 open gaps.

---

## 7. Adding or updating controls

1. Implement the UI control and backend route in the consumer repo.
2. Add or update the control object in `linkage-inventory.json`.
3. Register at least one test reference (`unit`, `integration`, or `e2e`) for critical controls.
4. If intentionally client-only, set `status: excluded` **and** add a row to `linkage-exclusions.json` with owner, risk, and remediation date.
5. Run `make check-linkage` and `make adversarial-preflight` before opening a PR.
6. Update this doc’s per-consumer table if the control changes platform-wide behavior.

Playwright helpers (`openShellTab`, `expectRequestOnAction`, `collectRequests`) in
`fe-be-linkage.mjs` should be preferred over ad-hoc request listeners in consumer specs.

---

## 8. Status vocabulary

| Status | Meaning |
| --- | --- |
| `linked` | Control maps to backend; tests registered; CI green |
| `fixed` | Was a gap; code + tests landed; kept for audit trail |
| `excluded` | Documented client-only or deferred; listed in exclusions JSON |
| `gap` | **Fails CI** — unresolved FE/BE mismatch |

---

## 9. Future work

- Parametrize Playwright tab-linkage specs from `linkage-inventory.json` (matrix runner).
- Nightly tier for exclusions marked `testTier: nightly-net` (e.g. dc-planner cloud refresh).
- Harmonize consumer e2e spec paths (`tests/e2e/` vs `e2e/tests/`) into inventory-relative refs only.

---

*Canonical machine source: [`tests/contracts/linkage-inventory.json`](../tests/contracts/linkage-inventory.json).
Human doc last updated: 2026-08-23.*
