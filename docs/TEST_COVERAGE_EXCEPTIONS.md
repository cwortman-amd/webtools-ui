# Test Coverage Exceptions

**Updated:** 2026-08-23  
**Owner of this register:** webtools-ui platform

Every supported documentation claim must have executable test evidence **or** a
row in this register (and, for FE→BE controls, `tests/contracts/linkage-exclusions.json`).

| ID | Scope | Why deferred | Owner | Risk | Due |
| --- | --- | --- | --- | --- | --- |
| EXC-PRD-MATRIX | Remaining consumer `docs/TEST.md` / PRD P0 rows not yet mapped | `tests/contracts/prd-p0-map.json` now accounts for llm-benchmark TEST.md P0 ids (mapped or deferred). dc-planner / cluster-manager / others still incomplete. Do not treat this as program-complete. | webtools-ui | high | 2026-09-30 |
| EXC-RBAC | Role-based API denial paths beyond documented mode-gating (standard/advanced/expert) | Suite is mostly single-user local dashboards; mode-gating is tested per consumer, multi-role ACL is not a product claim. Do not implement a fake RBAC layer. | webtools-ui | medium | 2026-10-15 |
| EXC-FLAGS | Feature-flag matrix across all consumers | No central flag service; per-tool `localStorage` modes are the supported analog. Do not invent a flag product. | webtools-ui | medium | 2026-10-15 |
| EXC-NIGHTLY-NET | dc-planner Azure retail TCO refresh | External network; listed in `linkage-exclusions.json` as `tco.cloudRefresh` | dc-planner | medium | 2026-09-30 |
| EXC-JS-C8-TLS | Node core modules (`js/*`) in `coverage-snapshot` | `npx c8` fails with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`; modules stay `NO_DATA`, which is not a pass. Install c8 from a trusted cache or set `NODE_EXTRA_CA_CERTS`. | webtools-ui | medium | 2026-09-30 |

When an exception expires, either land tests or file a new dated exception. Do not silently keep expired rows.
