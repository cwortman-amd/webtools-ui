# Documentation Drift Report

**Updated:** 2026-08-23

| Doc source | Claim | Implementation | Drift type | Action |
| --- | --- | --- | --- | --- |
| `FE_BE_TRACEABILITY_MATRIX.md` §6 | 30 controls | Inventory has 36 controls | doc stale | Updated totals to 36 (2026-08-23) |
| IMPLEMENTATION.md 2-T3 / AG-1 | `register_from_manifest`, `retrieve()`, `ChatOrb.mount({ agentGateway })` | Exports were missing | doc ahead of code | Landed APIs + tests (ADV-008) |
| `linkage-inventory.json` | demo-portal `module.run` unit ref | File absent | inventory ahead of repo | Added `test_run_agent_boundary.py` |
| `linkage-inventory.json` | KE `browse.manifest` e2e ref | File absent | inventory ahead of repo | Added `tab-linkage.spec.js` |

## Watch list

- Consumer `docs/TEST.md` PRD rows not yet mapped into `linkage-inventory.json` (phase 2; **EXC-PRD-MATRIX**, due 2026-09-30).
- CM standalone `fabric.html` remains excluded (`fabric.standalone`); in-tab pipeline is covered by `tab-linkage.spec.js#fabric-run`.
