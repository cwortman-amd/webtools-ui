# Test exceptions and risk register

Every deferred gap needs feature, evidence, impact, owner, compensating
control, and a remediation date. Never treat silence as coverage.

See also `docs/TEST_COVERAGE_EXCEPTIONS.md` and
`tests/contracts/linkage-exclusions.json`.

| ID | Feature | Evidence | Impact | Owner | Compensating control | Due |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| EXC-PRD-MATRIX | Remaining consumer `docs/TEST.md` P0 rows | `tests/contracts/prd-p0-map.json` partial | High — unmapped PRD claims | webtools-ui | Phase 1 `linkage-inventory.json` (36 controls) | 2026-09-30 |
| EXC-RBAC | Multi-role API denial | Not a product claim | Medium if mistaken for coverage | webtools-ui | Per-consumer mode-gating only | 2026-10-15 |
| EXC-FLAGS | Central feature-flag matrix | No flag service | Medium if mistaken for coverage | webtools-ui | `localStorage` modes | 2026-10-15 |
| EXC-NIGHTLY-NET | dc-planner Azure TCO refresh | External network | Medium | dc-planner | `tco.cloudRefresh` exclusion | 2026-09-30 |
| EXC-JS-C8-TLS | `npx c8` issuer cert on some hosts | `coverage-snapshot` V8 fallback | Medium — JS may be `NO_DATA` | webtools-ui | `NODE_V8_COVERAGE` in snapshot | 2026-09-30 |
