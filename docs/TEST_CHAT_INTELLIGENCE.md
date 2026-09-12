---
type: Test Plan
title: Chat Intelligence Layers — Test Program
description: >-
  Platform ownership pointer for the Chat Intelligence Layers acceptance suite
  (temporal engine, freshness pipeline, response grading). Working implementation
  and pytest suites live in Knowledge Exchange; requirement IDs use INT-* prefix.
aliases:
- TEST_CHAT_INTELLIGENCE
- Chat Intelligence Test Plan
domain: platform
tags:
- prd
- testing
- chat
- intelligence
- temporal
- freshness
- platform-service
summary: >-
  Platform test program for CHAT_INTELLIGENCE.md — temporal resolution, freshness
  decay, stale-source gates, and ask-path integration.
status: draft
audience:
- qa
- architecture
- platform
- ai-ml
updated: 2026-09-11
related:
- '[[CHAT_INTELLIGENCE]]'
- '[[KNOWLEDGE_CHAT]]'
- '[[TEST_KNOWLEDGE_CHAT]]'
- '[[TESTING_STRATEGY]]'
---
<!-- markdownlint-disable MD025 -->

# Chat Intelligence Layers — Test Program

**Status:** Draft, 2026-09-11. Binds to [`CHAT_INTELLIGENCE.md`](./CHAT_INTELLIGENCE.md).

| Consumer | Implementation | Test suites |
| --- | --- | --- |
| Knowledge Exchange | `ke/studio/tutor/temporal_engine.py`, `unit_engine.py`, `reasoning_plan.py`, `challenge_router.py`, `freshness_pipeline.py`, `wikiqa.py` | `tests/test_temporal_engine.py`, `tests/test_unit_engine.py`, `tests/test_reasoning_challenge.py`, `tests/test_freshness_pipeline.py`, `tests/test_wiki_retrieval.py` (w6l–w6o) |

## Active suites (Phase 1–2)

| ID | Layer | Requirement | Test module | Status |
| --- | --- | --- | --- | --- |
| INT-T01 | L3 Temporal | 45-day offset matches PRD receipt | `test_temporal_engine.py` | Active |
| INT-T02 | L3 Temporal | Named weekday (next Friday) | `test_temporal_engine.py` | Active |
| INT-T03 | L3 Temporal | Trailing interval (past 2 weeks) | `test_temporal_engine.py` | Active |
| INT-T04 | L3 Temporal | Calendar quarter (last quarter) | `test_temporal_engine.py` | Active |
| INT-T05 | L3 Temporal | Vault filter compiler (§9.2) | `test_temporal_engine.py` | Active |
| INT-T06 | L3 Temporal | Ask-path `try_temporal_answer` / `answer()` short-circuit | `test_temporal_engine.py`, `test_wiki_retrieval.py` w6p | Active |
| INT-T07 | L3 Temporal | Countdown and calendar boundaries | `test_temporal_engine.py` | Active |
| INT-T08 | L2+L3 Temporal vault | Interval filter + dated citations (`temporal-vault`) | `test_temporal_engine.py`, `test_wiki_retrieval.py` w6q | Active |
| INT-T09 | L3 Temporal | Business-day + fiscal calendar | `test_business_days_and_fiscal_calendar.py` | Active |
| INT-T10 | L3 Temporal API | POST `/api/v1/temporal/resolve` | `test_temporal_api.py` | Active |
| INT-T11 | L3 Client | Advisory parser + backend reconciliation | `js/temporal-advisory.test.mjs`, `tests/ui/chat-intelligence-temporal.spec.js` | Active |
| INT-T12 | L3 Temporal | DST, leap-year, `reference_instant` anchors | `test_temporal_int_t12.py` | Active |
| INT-T13 | L3 Temporal | Retrieval compiler execution (vault + graph) | `test_chat_intelligence_tiers.py` | Active |
| INT-T-GOLD | L3 Temporal | Golden corpus — birthday, leap, duration, adversarial | `tests/fixtures/chat/golden_questions/temporal.yaml`, `test_temporal_golden.py` | Active (54 active / 6 planned) |
| INT-UNIT | L1 Unit | Throughput capacity, BER expected errors, assumption ledger | `tests/fixtures/chat/golden_questions/unit.yaml`, `test_unit_golden.py` | Active (4 active) |
| INT-ESC | L0+L1 Challenge | Answer verification escalation (`retry`/`rewrite`/`explain`) | `test_reasoning_challenge.py`, `intent.yaml` INT-ESC-* | Active |
| INT-DGLC | L5–L6 DGLC | Policy facts, quantifier deduction, placement, compose | `tests/fixtures/chat/golden_questions/dglc.yaml`, `test_dglc_golden.py` | Active (15 active) |
| INT-V01 | L5 Solver | GPU memory feasibility | `test_chat_intelligence_tiers.py` | Active |
| INT-W01 | L4 Workflow | Research handoff workflow receipt | `test_workflow_engine.py`, `ask.py` | Active |
| INT-G01 | L10 Grading | Temporal consistency grader | `test_temporal_engine.py` | Active |
| INT-G02 | L4 Graph | Wiki link graph expansion (multi-hop) | `test_knowledge_graph.py`, `test_chat_intelligence_phases.py` | Active |
| INT-P01 | L5 Policy | Grounding/scope policy decisions | `test_policy_engine.py` | Active |
| INT-F01 | L2/L10 Freshness | Time-sensitive intent detection | `test_freshness_pipeline.py` | Active |
| INT-F02 | L2/L10 Freshness | Half-life decay scoring | `test_freshness_pipeline.py` | Active |
| INT-F03 | L2/L10 Freshness | Web snippet date extraction | `test_freshness_pipeline.py` | Active |
| INT-F04 | L2/L10 Freshness | Superseded vault penalty | `test_freshness_pipeline.py` | Active |
| INT-F05 | L10 Grading | Stale source contamination gate | `test_freshness_pipeline.py` | Active |
| INT-F06 | L2 Retrieval | Freshness-intent hybrid routing | `test_wiki_retrieval.py` w6l | Active |
| INT-F07 | L2 Retrieval | Vault-scope historical answer | `test_wiki_retrieval.py` w6n | Active |

## Commands

```bash
# Knowledge Exchange — intelligence layer unit + integration slice
cd knowledge-exchange
python3 -m pytest tests/test_temporal_engine.py tests/test_freshness_pipeline.py -v
python3 -m pytest tests/test_wiki_retrieval.py -k "w6l or w6m or w6n or w6o" -v

# Platform contract (webtools-ui)
cd webtools-ui
node --test tests/lib/chat-intelligence-contract.test.mjs

# Temporal golden corpus + continuous eval
cd knowledge-exchange
python3 -m pytest tests/test_temporal_golden.py -v
make temporal-eval   # INT-T-GOLD golden corpus (--check for CI)
make unit-eval       # INT-UNIT throughput/BER golden corpus (--check for CI)
make dglc-eval       # INT-DGLC golden corpus (--check for CI)
make chat-intelligence-eval  # INT-E01–E19 continuous eval
make coverage-chat-intelligence  # ≥80% branch/condition per module
```

## Phased gates (not yet active)

| Phase | Scope | Gate |
| --- | --- | --- |
| Phase 3 | Graph + policy + solvers | INT-G02, INT-P01 active; evidence API; INT-V* planned |
| Phase 4 | Durable workflows + approvals | INT-W01 workflow scaffold; full UX planned |
| Phase 5 | Continuous eval regression | INT-E01–E19, INT-T-GOLD in `make ci` |
| Phase 6 | DGLC composition | INT-DGLC (15 active) + deduction, minimal relaxation, boss compose |

## Temporal golden corpus (INT-T-GOLD)

Canonical prompts live at `tests/fixtures/chat/golden_questions/temporal.yaml`. Every **active**
case pins `reference_time` (default `2026-08-31T09:56:00-04:00`) so expressions like “next year”
are deterministic. Suites mirror temporal-reasoning benchmark categories: birthday recurrence,
leap-century rules, calendar vs elapsed duration, boundaries, named weekdays, fiscal/ISO, business
calendars, timezone/DST (planned), multi-turn (planned), temporal RAG, and adversarial traps.

Example receipt for the birthday prompt:

```json
{
  "reference_date": "2026-08-31",
  "birthday_month_day": "07-02",
  "target_year": 2027,
  "target_date": "2027-07-02",
  "weekday": "Friday"
}
```

Birth year is graded as **ignored input** unless the question asks for birth-weekday or age.
Ask-path grading checks `required_answer_facts` and `forbidden_claims` (e.g. must not invent age).

**Engine v1.3 additions (active gold):** cross-timezone meeting conversion, nth-weekday of month,
calendar-month “last month” (not trailing 30 days), yesterday vault intervals, ISO week queries,
fiscal-quarter membership on a named date, quarter countdown, explicit `needs_clarification` and
`invalid_date` outcomes.

## DGLC evaluation corpus (INT-DGLC)

Deterministic Grounded Latent Composition cases live in `tests/fixtures/chat/golden_questions/dglc.yaml`
(see CHAT_INTELLIGENCE §7.11). Each case specifies typed `facts`, expected engine receipts, and
`binding_constraints`. **Shipped archetypes (v2):**

- Nested policy deny-overrides-permit → `deny` + stable reason codes (`policy_facts.py`)
- Quantifier ∀ traps → `entailed` / `contradicted` / `unknown` (`deduction_engine.py`)
- Power-domain placement → `infeasible` + binding constraint + `minimal_relaxations` (`placement_solver.py`)
- Compose merge → deny short-circuits downstream engines (`dglc_engine.py` v2)

**Planned:** CP-SAT MUS, ADR supersession, multi-turn ledger, paraphrase battery.

## Unit arithmetic golden corpus (INT-UNIT)

Closed-world rate × duration cases live in `tests/fixtures/chat/golden_questions/unit.yaml`.
The `unit_engine.py` calculator handles:

- **Throughput:** `At 212Gbps how much data can transfer in a month` → ~68.7 PB (30-day default)
- **BER:** `At 212Gbps with a 10-15BER how many errors do I see in a month` → ~550 expected errors

Each ask-path case grades `required_answer_facts` and an explicit **assumption ledger** (decimal Gbps,
30-day month, 100% utilization, pre-FEC BER, Poisson mean). Negative cases assert `resolve_none`
when quantifiers or rates are missing.

**Quality framing:** report closed-world pass rate on the versioned suite — not “zero hallucination.”

## Answer challenge escalation (INT-ESC)

Verification is a first-class workflow, not “regenerate.” Natural-language triggers:

| Trigger | Mode | Level |
| --- | --- | --- |
| `retry`, verify phrases | `verify_answer` | 1 |
| `rewrite` | `deep_investigate` | 3 |
| `explain` | `explain_assumptions` | 1 |

Implementation: `challenge_router.py`, `challenge_executor.py`, `wikiqa.answer()` escalation hook
(before session short-circuit). Verdicts: Verified, Corrected, Partially supported, Inconclusive.

Golden intent cases: `INT-ESC-001`–`INT-ESC-003` in `intent.yaml`. Planned HTTP:
`POST /api/v1/chat/answers/{answer_id}/challenge`.

## Reasoning Plan contract (INT-RP)

`reasoning_plan.py` compiles inspectable multi-step plans (`ReasoningMode`, `ReasoningStep`,
`answer_contract`) for composite prompts spanning temporal + policy + placement + retrieval.
Rules-first routing; model assistance only when classification is ambiguous.

## Property-based targets (§15.4)

- `resolve("in n days", d) − d = n` calendar days — covered by `test_property_in_n_days_roundtrip`
- `status ∈ {superseded, revoked} ⇒ cannot support current claim` — covered by `test_detect_stale_source_contamination`
