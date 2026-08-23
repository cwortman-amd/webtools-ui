---
type: Template
title: TESTING_STRATEGY (canonical skeleton)
description: Shared outline for each consumer's local testing instance. The framework itself is NOT copied — it is read from shared/docs/TESTING_STRATEGY.md.
status: canonical
applies_to:
- llm-benchmark/docs/TESTING_STRATEGY.md
- dc-planner/docs/TESTING_STRATEGY.md
- cluster-manager/docs/TESTING_STRATEGY.md
- knowledge-exchange/docs/TESTING_STRATEGY.md
---
# `[[TESTING_STRATEGY]]` Local Testing Instance

> **Authoring rule.** This skeleton produces a *short* document. The tier model, seam model,
> anti-false-positive protocol, UI coverage framework, and combinatorial strategy live once in
> [`shared/docs/TESTING_STRATEGY.md`](../TESTING_STRATEGY.md) and are **linked, never copied**.
> A local instance that restates a canonical section has created a future contradiction.
>
> Section *count* and *headings* are canonical. Every value inside them is consumer-specific.
> Target length: 150–250 lines. If yours is longer, you are duplicating the framework.

## 1) Framework Reference · [CANONICAL]

Required statement: the canonical framework is `shared/docs/TESTING_STRATEGY.md`, it is
authoritative, and this document declares only what is specific to this repo. Name the tier
vocabulary (Tier 0–6) as inherited, not redefined.

Also link the consumer's own feature-level test plans, if any, and state the difference: the
framework is *how we test anything*, a feature test plan is *the cases for one feature*.

## 2) Stack Declaration · [CANONICAL heading, LOCAL content]

State which runtime layers exist in this repo and which seams follow from them:

| Layer | Present? | What it is here |
| :--- | :--- | :--- |
| A — Browser | | |
| B — Python services | | |
| C — Node toolchain | | |
| D — External binaries | | |

| Seam | Present? | Where |
| :--- | :--- | :--- |
| 1 — HTTP/JSON | | |
| 2 — Subprocess | | |
| 3 — Filesystem handoff | | |
| 4 — Third-party binary | | |

Record any seam the framework does not model (a message queue, a WebSocket protocol, a native
addon) so it is visibly untested rather than silently missing.

## 3) Tooling Table · [CANONICAL heading, LOCAL content]

One row per tier the consumer actually runs. Every cell is a command a person can paste.

| Tier | Marker / target | Command | Wired into |
| :--- | :--- | :--- | :--- |
| 0 Static | | | |
| 1 Unit (Python) | | | |
| 1 Unit (Node) | | | |
| 1 Unit (Browser JS) | | | |
| 2 Schema / contract | | | |
| 3A Integration | | | |
| 3B Boundary | | | |
| 4 E2E | | | |
| 5 Artifact | | | |
| 6 Perf / security / a11y | | | |

A tier with no command is a declared gap and belongs in §6, not an empty row.

## 4) Threshold Parameters · [CANONICAL heading, LOCAL numbers]

The framework defines the *shape*; this section supplies the numbers. Do not omit — an unstated
threshold is unenforceable.

| Parameter | Value |
| :--- | :--- |
| Coverage floor — new/changed code | |
| Coverage floor — core logic | |
| Coverage floor — repository (ratchet) | |
| Tier runtime budgets | |
| Cognitive complexity ceiling | |
| Browser performance budgets | |
| Backend latency budgets | |
| Flake pass-rate floor | |
| Quarantine expiry window | |

## 5) Workflow Inventory · [CANONICAL heading, LOCAL content]

The product-specific half of Tier 4 and §14 of the framework.

- **E2E workflows** — the user journeys this product must never break.
- **Component inventory tree** — every modal, menu, and settings surface, to the leaf. Required by
  the framework; coverage claims without it are unfalsifiable.
- **Combinatorial parameter model** — the parameters and constraints for this product.

## 6) Gap Register · [CANONICAL heading, LOCAL content]

Verified findings against **this** repo. Never inherited from a sibling consumer.

| # | Finding | Evidence | Severity | Fix |
| :--- | :--- | :--- | :--- | :--- |

Evidence must be checkable — a path, a count, a command and its output. "We probably don't have
X" is not a finding.

Optionally add a **Practices worth preserving** subsection: local practices stronger than the
framework requires. These are promotion candidates — raise them into
[`shared/docs/TESTING_STRATEGY.md`](../TESTING_STRATEGY.md) so every consumer benefits.

## 7) Local Deviations · [CANONICAL]

Any canonical rule this consumer does not follow, with a reason and an expiry date. An empty table
is a valid and good answer.

| Canonical rule | Deviation | Reason | Expires |
| :--- | :--- | :--- | :--- |

Silence is not a deviation record. A consumer that quietly skips a canonical rule is
indistinguishable from one that forgot.

## 8) Sequencing · [CANONICAL heading, LOCAL content]

The ordered remediation plan for §6. Order by *unblocking*, not by severity alone — foundations
(markers, fixtures, config) gate the tiers built on top of them.
