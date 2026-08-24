# /coverage — any project (user-global command)

Cursor loads this from `~/.cursor/commands/coverage.md` in **every** workspace.

If the open repo has `.cursor/commands/coverage.md`, **follow that file
instead**. This user command is the fallback.

`/test` should call `/coverage` in its coverage phase.

## Requirements

Print **statement**, **branch**, and **condition** coverage. Prefer the repo’s
own snapshot command:

```bash
make coverage-snapshot
# or
python3 scripts/coverage_snapshot.py
```

If those do not exist, use the first instrumented entry that does (`pytest
--cov --cov-branch`, `c8`, `go test -cover`, …). Do not invent percentages.

## Loop (when invoked from `/test`)

Until **all three** measured metrics are **≥ 80%** (or an owned dated
exception covers the rest): add the next documentation-traceable test, then
re-run this command. Rank **unverified behavior** above red line ranges.

When the floor is met, write or paste a **final** report with per-module and
overall statement / branch / condition scores. Below 80%, mark output
**interim**.
