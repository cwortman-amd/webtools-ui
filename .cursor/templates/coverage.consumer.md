# /coverage — statement, branch, and condition coverage

This command is **local to this project**. `/test` Phase 2 **must** run it
and re-run it after every expansion iteration.

Show **statement**, **branch**, and **condition** percentages (not a single
combined score).

## Metrics

| Metric | Instrument | Honest limit |
| :--- | :--- | :--- |
| **Statements** | coverage.py / c8 statements | Executable statements |
| **Branches** | coverage.py `--cov-branch` / c8 branches | Taken vs not-taken |
| **Conditions** | Partial-branch data from the same run | Not true MC/DC without extra tooling |

`/test` is **satisfied** at **80%** on all three, on **measured** modules.
Stretch remains 100% on `shared/tests/contracts/coverage-targets.json`.
`NO_DATA` is a tooling gap, not a pass.

## Snapshot

```bash
make coverage-snapshot
# agent-agnostic:
# python3 shared/scripts/coverage_snapshot.py
```

Print the module table **and** the Overall row in chat. Then:

```bash
python3 shared/scripts/coverage_intelligence.py
```

Pick the next **behavioral** test from the backlog (prefer FE→BE linkage),
implement it, re-run this command. Repeat until statement, branch, and
condition are all ≥ 80% or an owned dated exception exists.

When the floor is met, give the user `artifacts/coverage-report.md` as the
**final** coverage report. Below 80%, label any paste **interim**.
