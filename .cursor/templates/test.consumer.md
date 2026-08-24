# /test — adversarial preflight, then this repo's tests

This command is **local to this project**. Cursor loads it from
`.cursor/commands/test.md` when this repo is the workspace root.

**Required first step:** Read and apply the skill (project path is a symlink to
`shared/` / the master; `~/.cursor/skills/adversarial-documentation-driven-testing`
is the same files for every other workspace):

`.cursor/skills/adversarial-documentation-driven-testing/SKILL.md`

Do not run this repo's product test commands until Phase 1 completes.

## Phase 1 — Preflight (mandatory, from this repo)

```bash
make adversarial-preflight
# agent-agnostic equivalent from any checkout:
#   bash shared/scripts/run_test_workflow.sh
```

That target is provided by `shared/makefiles/adversarial-testing.mk` (included
from this repo's Makefile) and runs the platform checker against **this
consumer's** controls in `shared/tests/contracts/linkage-inventory.json`.

For every critical control with a missing test file, missing `#anchor`, missing
backend-path mention, weak linkage proof, or `status: gap`:

1. Implement the smallest test that proves
   **UI action → exact request contract → backend effect → visible confirmation**.
2. Register the test path (and `#anchor`) in the inventory.
3. Confirm the test would fail if the API path or backend response were broken.

Re-run `make adversarial-preflight` until it exits 0 (or record an owned, dated
exception in `shared/tests/contracts/linkage-exclusions.json` /
`shared/docs/TEST_COVERAGE_EXCEPTIONS.md`).

## Phase 2 — `/coverage` and expansion loop (mandatory)

Follow **`/coverage`** (`.cursor/commands/coverage.md`, else
`~/.cursor/commands/coverage.md`). Print **statement**, **branch**, and
**condition** coverage. Do not skip this phase.

```bash
make coverage-snapshot
```

1. Paste the module + Overall table in chat.
2. While any **measured** statement, branch, or condition score is **< 80%**:
   add the next documentation-traceable test (prefer FE→BE linkage /
   `coverage_intelligence.py`), re-run `/coverage`, repeat.
3. `/test` is not finished after one suite run if scores are still below 80%.
4. Platform CI floors stay ratcheted. Stretch remains 100% in
   `shared/tests/contracts/coverage-targets.json`.
5. When all three metrics are **≥ 80%** (or remaining gaps are excepted),
   use `artifacts/coverage-report.md` as the **final** report in Phase 4.
   Below 80%, label tables **interim**.

## Phase 3 — Execute this repo

__CONSUMER_TEST_CMD__

## Phase 4 — Report

Preflight gaps closed, tests added, interim `/coverage` tables, and — at ≥ 80%
statement/branch/condition — `artifacts/coverage-report.md`. Pass/fail counts,
residual exceptions (owner / risk / due date). Do not claim full
documented-feature coverage without executable evidence or a formal exception.
