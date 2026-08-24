# Testing intelligence artifacts

Canonical machine inventory remains `tests/contracts/linkage-inventory.json`.
This directory holds the **behavioral** ledgers the closed-loop testing skill
updates. Generated rank dumps go to `artifacts/coverage-intelligence/` (gitignored).

| Artifact | Purpose |
| :--- | :--- |
| [feature-traceability.md](feature-traceability.md) | Docs ↔ UI ↔ API ↔ tests |
| [coverage-gap-backlog.md](coverage-gap-backlog.md) | Ranked *behavior* gaps (not line ranges) |
| [adversary-findings.md](adversary-findings.md) | Hypotheses, outcomes, promotions |
| [mutation-survivors.md](mutation-survivors.md) | Surviving mutants in critical logic |
| [documentation-drift.md](documentation-drift.md) | Claim vs implementation vs tests |
| [test-exceptions-and-risk-register.md](test-exceptions-and-risk-register.md) | Owned, dated deferrals |
| [behavioral-coverage-ledger.md](behavioral-coverage-ledger.md) | Verified obligations / applicable obligations |
| [test-candidate.example.yaml](test-candidate.example.yaml) | Schema instance for generated tests |

Test tiers on disk:

| Directory | Tier |
| :--- | :--- |
| `tests/generated-candidates/` | Speculative YAML + notes; not CI |
| existing `tests/` | Verified regression (PR CI) |
| `tests/adversarial/` | Extended resilience / fault models |
| `tests/contracts/` | Schemas and inventories |

Commands: `make coverage-intelligence`, `make coverage-snapshot`, `make adversarial-preflight`.

Core-module coverage is gated at an **80% loop floor** on **measured** modules (`tests/contracts/coverage-targets.json`). `NO_DATA` (for example `js/shell.js` / `js/chat-orb.js` until a filename-attributed harness exists) is excluded from that floor and is **not** a pass. Stretch remains 100%; do not raise CI `fail-under` to 100 in the same change as new tests.

