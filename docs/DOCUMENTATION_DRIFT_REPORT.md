# Documentation Drift Report

**Updated:** 2026-08-23

| Doc source | Claim | Implementation | Drift type | Action |
| --- | --- | --- | --- | --- |
| `FE_BE_TRACEABILITY_MATRIX.md` §6 | 30 controls | Inventory has 36 controls | doc stale | Updated totals to 36 (2026-08-23) |
| `ADVERSARIAL_TEST_PROGRAM.md` | 30 controls | Inventory has 36 controls | doc stale | Updated to 36 (2026-08-23) |
| IMPLEMENTATION.md 2-T3 / AG-1 | `register_from_manifest`, `retrieve()`, `ChatOrb.mount({ agentGateway })` | Exports were missing | doc ahead of code | Landed APIs + tests (ADV-008) |
| IMPLEMENTATION.md 3-T1 | Bootstrap loads shell modules + demo/voice/MCP adapters | `plugin-bootstrap.js` loads ExtensionHost, MCP, Agent Gateway, deferred slash/voice scripts | doc overclaim | Clarified 3-T1 / 3-T2 vs `platform.js` (2026-08-23) |
| IMPLEMENTATION.md L1 / PLAN.md | Platform ships `js/agent-bridge.js` | Browser bridge is **consumer-owned**; platform documents the slot only | doc overclaim | L1 row now says consumer-owned (2026-08-23) |
| `linkage-inventory.json` | demo-portal `module.run` unit ref | File absent | inventory ahead of repo | Added `test_run_agent_boundary.py` |
| `linkage-inventory.json` | KE `browse.manifest` e2e ref | File absent | inventory ahead of repo | Added `tab-linkage.spec.js` |

## Watch list

- Consumer `docs/TEST.md` PRD rows not yet mapped into `linkage-inventory.json` (phase 2; **EXC-PRD-MATRIX**, due 2026-09-30).
- CM standalone `fabric.html` remains excluded (`fabric.standalone`); in-tab pipeline is covered by `tab-linkage.spec.js#fabric-run`.
- `js/shell.js` and `js/chat-orb.js` remain `NO_DATA` in `coverage-snapshot` until a DOM-complete harness attributes V8 coverage without tanking the 80% measured-module floor.
- Multi-role RBAC and a central feature-flag service are **not** product claims (**EXC-RBAC**, **EXC-FLAGS**).
