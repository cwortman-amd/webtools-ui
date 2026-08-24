# Behavioral coverage ledger

\[
\text{Behavioral coverage} =
\frac{\text{Verified applicable feature obligations}}
{\text{Total applicable feature obligations}}
\]

An obligation is a documentation-derived statement such as: role can save;
role cannot save; field name on the wire; backend persists; job uses the
value; UI reflects it; value survives reload; errors do not fake success.

Refresh machine totals:

```bash
make coverage-intelligence
```

See `artifacts/coverage-intelligence/behavioral-coverage-ledger.json`.

| Feature | Obligations | Verified | Open risk | Unit L/B | Contract | E2E | Mutation | Status |
| :--- | ---: | ---: | :--- | :--- | :--- | :--- | :--- | :--- |
| *(per-feature rows filled by `/test` closed loop)* | | | | | | | | |

**Do not** treat repository-wide line coverage as this metric.
