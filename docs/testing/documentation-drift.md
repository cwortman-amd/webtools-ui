# Documentation drift

Meaningful docs diffs (feature claim, default, workflow, endpoint, setting,
role, error) are **test triggers**, not prose-only changes.

| Date | Document | Claim change | Implementation | Tests | Classification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-08-23 | `ADVERSARIAL_TEST_PROGRAM.md` | Phase 1 control count 30 → 36 | `linkage-inventory.json` | `make adversarial-preflight` | clarify |
| 2026-08-23 | `IMPLEMENTATION.md` 3-T1 / 3-T2 | Bootstrap vs `platform.js` activation | `js/plugin-bootstrap.js`, `js/platform.js` | `tests/lib/plugin-bootstrap.test.mjs`, `tests/lib/measured-core-coverage.test.mjs` | clarify |
| 2026-08-23 | `IMPLEMENTATION.md` L1 | `agent-bridge.js` is consumer-owned | No platform `js/agent-bridge.js` | n/a (slot only) | clarify |
| 2026-08-23 | `IMPLEMENTATION.md` AG-1 | `retrieve()` / `ChatOrb.mount({ agentGateway })` | `js/agent-gateway.js`, `js/chat-orb.js` | `tests/lib/agent-gateway-retrieve.test.mjs` | new-capability |
