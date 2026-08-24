---
type: Test Plan
title: Adversarial Documentation-Driven Test Program
description: '**Status:** 2026-08-23. Program index for doc→impl→test traceability and adversary loops.'
---
# Adversarial Documentation-Driven Test Program

**Status:** 2026-08-23

This program applies the skill at `.cursor/skills/adversarial-documentation-driven-testing/SKILL.md` across the AMD Instinct webtools suite (platform + six consumers).

## Entry points

| Entry | Purpose |
| --- | --- |
| `/test` (Cursor command) | Project overlay `<repo>/.cursor/commands/test.md`; generic fallback `~/.cursor/commands/test.md` |
| Skill | **One master.** Global: `~/.cursor/skills/adversarial-documentation-driven-testing` (symlink). Suite: `.cursor/skills/…` → `shared/` |
| Refresh links | `webtools-ui/scripts/install_adversarial_workflow.sh` (symlinks; does not copy the skill body) |
| `make adversarial-preflight` | From **this repo root** (consumers include `shared/makefiles/adversarial-testing.mk`) |
| `make coverage-snapshot` | Line / branch / condition table by core module |
| `make ci` | Platform gates **including** adversarial-preflight |

## Artifacts

| Artifact | Path |
| --- | --- |
| Linkage inventory | [`tests/contracts/linkage-inventory.json`](../tests/contracts/linkage-inventory.json) |
| Exclusions / risk register | [`tests/contracts/linkage-exclusions.json`](../tests/contracts/linkage-exclusions.json) |
| Coverage exceptions | [`TEST_COVERAGE_EXCEPTIONS.md`](TEST_COVERAGE_EXCEPTIONS.md) |
| Human FE→BE matrix | [`FE_BE_TRACEABILITY_MATRIX.md`](FE_BE_TRACEABILITY_MATRIX.md) |
| Adversary findings log | [`ADVERSARY_FINDINGS.md`](ADVERSARY_FINDINGS.md) |
| Documentation drift report | [`DOCUMENTATION_DRIFT_REPORT.md`](DOCUMENTATION_DRIFT_REPORT.md) |
| Preflight script | [`../scripts/adversarial_test_preflight.py`](../scripts/adversarial_test_preflight.py) |

## Current scope (phase 1)

Phase 1 closes **critical FE→BE controls** registered in `linkage-inventory.json` (36 controls across 7 repos). Consumer PRD matrices in each repo's `docs/TEST.md` remain the backlog for phase 2 expansion and are tracked as **EXC-PRD-MATRIX** in [`TEST_COVERAGE_EXCEPTIONS.md`](TEST_COVERAGE_EXCEPTIONS.md) (due 2026-09-30).

## Completion rule

Do not declare the program complete until every supported documentation claim has executable test evidence or a formal exception in `linkage-exclusions.json` with owner and remediation date.
