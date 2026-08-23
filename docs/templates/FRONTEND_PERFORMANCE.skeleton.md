---
type: Template
title: FRONTEND_PERFORMANCE (canonical skeleton)
description: Shared outline for each consumer's local frontend performance instance. The framework itself is NOT copied — it is read from shared/docs/FRONTEND_PERFORMANCE.md.
status: canonical
applies_to:
- llm-benchmark/docs/FRONTEND_PERFORMANCE.md
- dc-planner/docs/FRONTEND_PERFORMANCE.md
- cluster-manager/docs/FRONTEND_PERFORMANCE.md
- knowledge-exchange/docs/FRONTEND_PERFORMANCE.md
---
# `[[FRONTEND_PERFORMANCE]]` Local Performance Instance

> **Authoring rule.** This skeleton produces a *short* document. The metric model, wait ladder,
> job model, functional requirements, and instrumentation contract live once in
> [`shared/docs/FRONTEND_PERFORMANCE.md`](../FRONTEND_PERFORMANCE.md) and are **linked, never
> copied**. A local instance that restates a canonical section has created a future contradiction.
>
> Section *count* and *headings* are canonical. Every value inside them is consumer-specific.
> Target length: 150–250 lines. If yours is longer, you are duplicating the framework.

## 1) Framework Reference · [CANONICAL]

State that `shared/docs/FRONTEND_PERFORMANCE.md` is authoritative and that this document supplies
only local values. Name D, M, and the job threshold as inherited defaults or declare overrides.

Link the local testing instance, since Tier 6 is where these requirements are verified.

## 2) Surface Declaration · [CANONICAL heading, LOCAL content]

What is actually being budgeted. One row per page or view that a user loads directly.

| Surface | Route | Type | Primary user goal |
| :--- | :--- | :--- | :--- |

State the application shape — multi-page, SPA, server-rendered, hybrid — and whether a bundler or
build step exists. Both change which budgets are achievable and how they are enforced.

## 3) Measured Baseline · [CANONICAL heading, LOCAL numbers]

**Measure before budgeting.** A budget set without a baseline is a guess, and a guess set too high
never fails.

| Metric | Current | Source | Date |
| :--- | :--- | :--- | :--- |
| LCP p75 | | | |
| INP p75 | | | |
| CLS p75 | | | |
| TBT (lab) | | | |
| Page payload — compressed | | | |
| Page payload — raw | | | |
| Render-blocking bytes / requests | | | |

Record the measurement conditions: device profile, throttling, cache state. Without them the
numbers are not reproducible and the trend line is meaningless.

## 4) Budgets · [CANONICAL heading, LOCAL numbers]

One number per class in framework §3 (B1–B8), plus the NFR table values from §8. Where a budget is
looser than the framework default because of a known constraint, say so and link the §7 entry.

| ID | Budget | Value | Baseline | Headroom |
| :--- | :--- | :--- | :--- | :--- |

Mark each as **enforced** (a gate fails) or **tracked** (measured, not gating). An unenforced
budget is documentation, not a requirement, and should be honest about which it is.

## 5) Operation Inventory · [CANONICAL heading, LOCAL content]

Every operation subject to the wait ladder, with the expected bucket and the fixed corpus used to
measure it.

| Operation | Trigger | Endpoint | Expected bucket | Corpus | p50 | p95 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |

Buckets: `<D`, `D–3 s`, `3–10 s`, `job`. An operation in the `job` bucket must satisfy all six
properties in framework §4.4; note any it does not yet meet.

## 6) Gap Register · [CANONICAL heading, LOCAL content]

Verified findings against **this** repo. Never inherited from a sibling consumer.

| # | Finding | Evidence | Severity | Fix |
| :--- | :--- | :--- | :--- | :--- |

Evidence must be checkable — a path, a measured number, a command and its output.

## 7) Local Deviations · [CANONICAL]

Any canonical rule this consumer does not follow, with a reason and an expiry date. An empty table
is a valid and good answer.

| Canonical rule | Deviation | Reason | Expires |
| :--- | :--- | :--- | :--- |

Record house targets stricter than the published thresholds here too, so a future reader does not
mistake a local preference for a standard.

## 8) Sequencing · [CANONICAL heading, LOCAL content]

The ordered remediation plan for §6. Order by *unblocking*: instrumentation before budgets, budgets
before enforcement, enforcement before tightening.
