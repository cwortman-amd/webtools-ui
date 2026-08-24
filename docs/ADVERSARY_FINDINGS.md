# Adversary Findings Log

**Updated:** 2026-08-23

| ID | Hypothesis | Test / evidence | Outcome | Remediation | Status |
| --- | --- | --- | --- | --- | --- |
| ADV-001 | Linkage inventory passes without verifying test files exist | `scripts/adversarial_test_preflight.py` | Confirmed gap | Added preflight script + `/test` command Phase 1 | fixed |
| ADV-002 | KE `browse.manifest` registered e2e ref but no spec file | `tests/ui/tab-linkage.spec.js#browse-manifest` | Confirmed gap | Added tab-linkage spec | fixed |
| ADV-003 | Demo Portal `module.run` unit ref missing on disk | `tests/test_run_agent_boundary.py` | Confirmed gap | Added run-agent boundary tests | fixed |
| ADV-004 | LLM Benchmark plan-validate / queue-server-check untested | `tests/e2e/tab-linkage.spec.js` | Confirmed gap | Added POST contract tests | fixed |
| ADV-005 | CM `network.fabricRun` POST not covered in tab-linkage | `e2e/tests/tab-linkage.spec.js#fabric-run` | Confirmed gap | Added fabric pipeline POST test | fixed |
| ADV-006 | Inventory `#anchor` refs not validated against test titles | `scripts/adversarial_test_preflight.py` + `tests/python/test_adversarial_preflight.py` | Confirmed gap | Preflight now requires anchors and backend path tokens in registered tests | fixed |
| ADV-008 | IMPLEMENTATION claimed `register_from_manifest` / `retrieve()` / `ChatOrb.mount({ agentGateway })` without matching exports | `python/webtools_mcp/host.py`, `js/agent-gateway.js`, `js/chat-orb.js` | Confirmed gap | Landed documented exports + unit tests | fixed |

## Open hypotheses

| ID | Hypothesis | Owner | Due |
| --- | --- | --- | --- |
| ADV-007 | Consumer `docs/TEST.md` P0 rows still outside `linkage-inventory.json` | webtools-ui | 2026-09-30 |
