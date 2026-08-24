# /test — any project (user-global command)

Cursor loads this from `~/.cursor/commands/test.md` in **every** workspace.

**Required first step:** Read and apply the **user** skill (symlink to the master):

`~/.cursor/skills/adversarial-documentation-driven-testing/SKILL.md`

If the open repo has its own `.cursor/commands/test.md`, **follow that file instead**
(it is the product overlay). This user command is the fallback for other projects.

Do not run the product suite until the workflow below has inventoried claims and
closed or explicitly deferred missing behavioral tests.

## Phase 1 — Inventory and linkage

1. Collect docs, UI surfaces, APIs/contracts, and existing tests.
2. Prefer a repo inventory if present (`tests/contracts/`, `docs/*trace*`, OpenAPI).
3. For every runtime-affecting control or documented workflow, require proof of
   **user action → exact request/event contract → backend effect → visible result**.
4. Add the smallest test that would fail if that contract were broken.
5. Record owned, dated exceptions for anything deferred.

If `make adversarial-preflight` exists, run it (or `bash scripts/run_test_workflow.sh`) and fix failures before Phase 2.

## Phase 2 — `/coverage` expansion loop

Follow **`/coverage`** (`~/.cursor/commands/coverage.md`, or the project overlay
if present). Print **statement**, **branch**, and **condition** coverage.

If `make coverage-snapshot` exists, run it. Treat tables as clues; rank work by
unverified **feature behavior**. While any measured metric is **< 80%**, add a
test and re-run `/coverage`. When all three are ≥ 80%, emit a **final**
coverage report; below that, label output **interim**.

## Phase 3 — Execute this repo’s tests

Use the first that exists: `make ci`, `make test`, `npm test`, `pytest`,
`./test.sh`. Do not invent a harness. Do not run destructive/GPU/cluster
health jobs unless the user asked.

## Phase 4 — Report

Gaps closed, tests added, coverage tables (final only at ≥ 80%
statement/branch/condition), remaining exceptions (owner / risk / due date).
Do not claim full documented-feature coverage without executable evidence.
