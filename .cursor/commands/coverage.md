# /coverage — statement, branch, and condition coverage

This command is **local to the open project**. `/test` **must** invoke it in
Phase 2 and after every expansion iteration.

Show **statement**, **branch**, and **condition** percentages. Do not substitute
a pass/fail count or a single “coverage %” for those three numbers.

## What the numbers mean

| Metric | Instrument | Honest limit |
| :--- | :--- | :--- |
| **Statements** | coverage.py `num_statements` / c8 statement map | Executable statements, not comments |
| **Branches** | coverage.py `--cov-branch` / c8 `b` | Taken vs not-taken |
| **Conditions** | Same branch data (partial-branch) | **Not** true MC/DC unless a dedicated instrumenter exists — say so |

Core modules: `tests/contracts/coverage-targets.json`. Stretch target there is
**100%**. The `/test` loop is **satisfied** at **80%** statement **and** branch
**and** condition on **measured** modules (plus overall totals when present).

`NO_DATA` is not 0% and not a pass. Record it (tooling gap) and keep looping on
modules that *do* have numbers. Dated exceptions: `docs/TEST_COVERAGE_EXCEPTIONS.md`.

## Phase C1 — Snapshot (mandatory)

From this repo root:

```bash
make coverage-snapshot
```

Agent-agnostic:

```bash
python3 scripts/coverage_snapshot.py
# consumer checkout:
# python3 shared/scripts/coverage_snapshot.py
```

Reuse JSON only when the user asked not to re-run tests:

```bash
python3 scripts/coverage_snapshot.py --no-run
```

Print the table **in the chat** every time: module rows + **Overall** row with
statement / branch / condition. Then run:

```bash
python3 scripts/coverage_intelligence.py
```

Use the intelligence backlog to pick the **next behavioral test**, not the
longest red line range.

## Phase C2 — `/test` expansion loop (until 80%+)

`/test` owns the loop. After each new test (or tight batch):

1. Re-run this command (`make coverage-snapshot`).
2. Compare statement, branch, and condition to the **80%** floor.
3. If any measured metric is **< 80%**, add the next documentation-traceable
   test (prefer FE→BE linkage gaps), then repeat this command.
4. Do not raise CI `fail_under` to 100 in the same change as the new tests.
5. Stop the loop when:
   - statement **and** branch **and** condition are all **≥ 80%** on measured
     core modules and overall totals, **or**
   - remaining gaps are in `docs/TEST_COVERAGE_EXCEPTIONS.md` (owner, risk, due),
     **or**
   - the user stops the loop.

Stretch 100% on `coverage-targets.json` remains the long-term aim after the
floor. Do not claim the adversarial program is complete at 80%.

## Phase C3 — Final report (only at or above the floor)

When the 80% floor is met, `coverage_snapshot.py` writes
`artifacts/coverage-report.md`. **Paste or summarize that file for the user**
as the final coverage report. It must include:

- Statement, branch, and condition % per core module
- Overall statement, branch, and condition %
- Iteration / timestamp
- What is still `NO_DATA` (e.g. JS if c8 is unavailable)
- Residual exceptions (owner / risk / due)

Do not emit a “final” report while measured scores are below 80% unless the
user explicitly asks for a snapshot anyway — then label it **interim**, not
final.

## Shell cheatsheet

| Goal | Command |
| :--- | :--- |
| Table + JSON | `make coverage-snapshot` |
| Iteration n | `python3 scripts/coverage_snapshot.py --iteration N` |
| Fail CI-style under 80 | `python3 scripts/coverage_snapshot.py --fail-under 80` |
| Behavioral gap rank | `python3 scripts/coverage_intelligence.py` |
