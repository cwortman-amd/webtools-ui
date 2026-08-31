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
updated: 2026-08-31
related:
- '[[CHAT_INTELLIGENCE]]'
- '[[KNOWLEDGE_CHAT]]'
- '[[TEST_KNOWLEDGE_CHAT]]'
- '[[TESTING_STRATEGY]]'
---
<!-- markdownlint-disable MD025 -->

# Chat Intelligence Layers — Test Program

**Status:** Draft, 2026-08-31. Binds to [`CHAT_INTELLIGENCE.md`](./CHAT_INTELLIGENCE.md).

| Consumer | Implementation | Test suites |
| --- | --- | --- |
| Knowledge Exchange | `ke/studio/tutor/temporal_engine.py`, `freshness_pipeline.py`, `wikiqa.py` | `tests/test_temporal_engine.py`, `tests/test_freshness_pipeline.py`, `tests/test_wiki_retrieval.py` (w6l–w6o) |

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
```

## Phased gates (not yet active)

| Phase | Scope | Gate |
| --- | --- | --- |
| Phase 3 | Graph + policy + solvers | INT-G02, INT-P01 active; evidence API; INT-V* planned |
| Phase 4 | Durable workflows + approvals | INT-W01 workflow scaffold; full UX planned |
| Phase 5 | Continuous eval regression | INT-E01–E12 in `chat_intelligence_eval.py` |

## Property-based targets (§15.4)

- `resolve("in n days", d) − d = n` calendar days — covered by `test_property_in_n_days_roundtrip`
- `status ∈ {superseded, revoked} ⇒ cannot support current claim` — covered by `test_detect_stale_source_contamination`
