# /test — adversarial preflight, then this workspace's tests

This command is **local to the open project**. Product overlays live here;
the skill body is the master (also `~/.cursor/skills/adversarial-documentation-driven-testing`).

**Required first step:** Read and apply the skill (master; also
`~/.cursor/skills/adversarial-documentation-driven-testing/SKILL.md` via symlink):

`.cursor/skills/adversarial-documentation-driven-testing/SKILL.md`

Do not run product test commands until Phase 1 completes. Always add missing
documentation-traceable tests **before** executing the suite.

## Detect repo

| Workspace root | Preflight | Then run |
| :--- | :--- | :--- |
| `webtools-ui` | `make adversarial-preflight` | Phase 2 `/coverage` table + expansion loop |
| A consumer (`llm-benchmark`, …) | `make adversarial-preflight` (Makefile include → `shared/`) | That repo's documented test entry from its own `/test` command |

If `make adversarial-preflight` is missing, run
`bash scripts/install_adversarial_workflow.sh --repo .` from webtools-ui (or
`bash shared/scripts/install_adversarial_workflow.sh --repo .` from a consumer).

## Phase 1 — Adversarial preflight (mandatory)

```bash
make adversarial-preflight
```

Reconcile (paths are under webtools-ui / `shared/`):

- `tests/contracts/linkage-inventory.json`
- `tests/contracts/linkage-exclusions.json`
- `docs/FE_BE_TRACEABILITY_MATRIX.md`
- `docs/ADVERSARY_FINDINGS.md`
- `docs/DOCUMENTATION_DRIFT_REPORT.md`
- `docs/TEST_COVERAGE_EXCEPTIONS.md`

For every critical control with a missing test file, missing `#anchor`, missing
backend-path mention, weak linkage proof, or `status: gap`:

1. Implement the smallest test that proves
   **UI action → exact request contract → backend effect → visible confirmation**.
2. Register the test path (and `#anchor`) in `linkage-inventory.json`.
3. Confirm the test would fail if the API path or backend response were broken.

Re-run `make adversarial-preflight` until it exits 0.

**Stop rule:** Do not proceed while preflight reports unresolved critical gaps
(unless listed in `linkage-exclusions.json` or `docs/TEST_COVERAGE_EXCEPTIONS.md`
with owner + remediation date).

## Phase 2 — `/coverage` and expansion loop (mandatory)

Follow **`/coverage`** (`.cursor/commands/coverage.md` in this project, else
`~/.cursor/commands/coverage.md`). That command prints **statement**,
**branch**, and **condition** coverage. Do not skip it.

1. Run the snapshot in `/coverage` and paste the table (module + overall).
2. While any **measured** statement, branch, or condition score is **< 80%**:
   - Add the smallest documentation-traceable test (prefer FE→BE linkage gaps
     from preflight / `coverage_intelligence.py`, not the longest red range).
   - Re-run `/coverage`.
   - Repeat. This is the expansion loop — `/test` is not done after one suite
     run if scores are still below the floor.
3. CI `fail_under` stays ratcheted. Do not jump it to 100 in the same change
   as the new tests. Stretch remains 100% in
   `tests/contracts/coverage-targets.json`.
4. Dated exceptions: `docs/TEST_COVERAGE_EXCEPTIONS.md`.
5. When statement **and** branch **and** condition are all **≥ 80%** on
   measured core modules (or remaining gaps are excepted), `/coverage` writes
   `artifacts/coverage-report.md`. Treat that as the **final** coverage report
   in Phase 4. Below 80%, any table is **interim**.

## Phase 3 — Test execution

| Scope | Command |
| --- | --- |
| Platform CI gate | `make ci` |
| Shared unit tests | `make test-shared` |
| Python + Node coverage | `make coverage && make coverage-node` |
| Playwright cross-consumer | `make test-playwright` |
| Full cross-repo validation | `make enhanced-validation` |
| Consumer repo | `bash scripts/run_test_workflow.sh` from webtools-ui, or `bash shared/scripts/run_test_workflow.sh` / that repo's `/test` Phase 3 (`./test.sh`, `./test_offline.sh`, `make test`, or `make ci` — **not** GPU/cluster health harnesses unless asked) |

## Phase 4 — Report

Preflight gaps closed, tests added, **interim** coverage tables from each
`/coverage` iteration, and — only at ≥ 80% statement/branch/condition on
measured modules — the **final** `artifacts/coverage-report.md`. Include
pass/fail counts and residual exceptions (owner / risk / due date). Do not
claim full documented-feature coverage or 100% line coverage without
executable evidence or a formal exception. Do not treat 80% as program
complete.
