---
type: Product Requirements
title: Chat Intelligence Layers — Architecture PRD
description: >-
  Intelligence-layer architecture for enterprise chat — grounded retrieval, temporal
  intelligence, structured knowledge, deterministic rules, constraint validation, durable
  workflows, safety controls, response grading, and human approval. Platform contract in
  webtools-ui; primary reference implementation in Knowledge Exchange.
aliases:
- Chat Intelligence
- Intelligence Layers
- Chat Intelligence Layers
domain: platform
tags:
- prd
- chat
- intelligence
- retrieval
- temporal
- grounding
- agents
- grading
- platform-service
summary: >-
  Composable intelligence-layer architecture treating the LLM as a language interface,
  not the sole source of truth — with deterministic temporal logic, freshness-aware
  retrieval, policy enforcement, validation, workflows, and response grading.
status: draft
audience:
- product
- architecture
- platform
- ai-ml
- backend
- search
- knowledge-engineering
- security
- sre
- qa
updated: 2026-08-31
related:
- '[[KNOWLEDGE_CHAT]]'
- '[[TEST_KNOWLEDGE_CHAT]]'
- '[[TEST_CHAT_INTELLIGENCE]]'
- '[[CHAT_ARCHITECTURE]]'
- '[[SDK]]'
- '[[PLATFORM_MODEL]]'
- templates/CHAT.skeleton.md
---
<!-- markdownlint-disable MD025 MD033 MD060 -->

# Chat Intelligence Layers — Architecture PRD

**Status:** Draft v0.2 · **Last updated:** 2026-08-31  
**Owner:** Chat Platform / AI Architecture  
**Audience:** Product, AI Platform, Backend, Search/RAG, Knowledge Engineering, Security, SRE, QA

This document lives in `webtools-ui/docs/` so sibling consumer repos read one source of truth via
their `shared/` symlink. It is **read, not copied**.

| Layer | Owner | Document |
| --- | --- | --- |
| Orb chrome, slash router, LLM settings | Platform (`shared/js/chat-orb.js`) | [`SDK.md`](SDK.md), [`templates/CHAT.skeleton.md`](templates/CHAT.skeleton.md) |
| Corpus chat backend (retrieval, citations, web) | Platform contract; consumer implements | [`KNOWLEDGE_CHAT.md`](KNOWLEDGE_CHAT.md) |
| Intelligence layers (this PRD) | Platform contract; consumer implements | `CHAT_INTELLIGENCE.md` |
| Product mount, commands, routing | Consumer (`js/chat-orb-mount.js`) | `<consumer>/docs/CHAT.md` |

> **Relationship to [`KNOWLEDGE_CHAT.md`](KNOWLEDGE_CHAT.md).** That PRD defines the corpus-backed
> Q&A backend (vault registration, ingestion, trust-aware retrieval, citations, web research).
> **This PRD** defines the broader intelligence-layer stack that wraps and governs chat — temporal
> resolution, freshness grading, policy, validation, workflows, and response QA. Consumers may adopt
> layers incrementally; Knowledge Exchange is the reference implementation.

---

## 1. Executive summary

This PRD defines an intelligence-layer architecture for an enterprise chat system. The system
treats the large language model (LLM) as a language interface and probabilistic planner, not as
the sole source of truth, policy authority, or execution engine.

The platform combines grounded retrieval, temporal intelligence, structured knowledge,
deterministic rules, constraint validation, durable workflows, safety controls, response grading,
and human approval. This creates a chat experience that can answer questions with evidence, reason
over time and state, validate proposed actions, and safely coordinate multi-step work.

**Central design principle:**

> The LLM interprets and explains; authoritative systems, deterministic logic, validation, and
> governed workflows establish what is true, allowed, feasible, and executed.

---

## 2. Problem statement

An LLM-only chatbot has several limits that are unacceptable for enterprise support, operational
intelligence, and action-oriented assistants:

- Its learned knowledge may be outdated, incomplete, or inconsistent with organization-specific facts.
- It cannot reliably calculate calendar periods, business-day schedules, or historical "as-of"
  state without deterministic temporal logic.
- It may produce plausible but invalid configurations, plans, calculations, or policy interpretations.
- It does not retain trustworthy long-running task state without an external state and workflow system.
- It cannot safely decide authorization, compliance, or irreversible action eligibility through prompting alone.
- It cannot prove that a cited document supports a claim, remains active, or is current enough for a
  "latest" question.
- It lacks durable recovery, idempotency, approval gates, and auditability for operational actions.

The product needs a composable architecture in which every answer and action can be grounded,
evaluated, traced, and governed according to its risk.

---

## 3. Goals

### 3.1 Product goals

- Deliver accurate, evidence-grounded answers from internal vault/corpus data, connected systems,
  and approved web sources.
- Resolve natural-language time expressions into deterministic dates, intervals, recurrences, and
  retrieval filters.
- Distinguish current, historical, future, and "as-of" questions.
- Prefer active, authoritative, valid, and current sources without treating recency alone as truth.
- Apply executable policies and authorization rules outside the LLM.
- Validate candidate plans, calculations, configurations, and structured outputs before presenting
  or executing them.
- Support durable, observable, resumable, approval-gated agent workflows.
- Provide source provenance, freshness/validity metadata, confidence, and explainable decision receipts.
- Grade responses automatically for factual grounding, temporal correctness, citation entailment,
  source validity, safety, and task completion.
- Enable repeatable regression tests, evaluation datasets, and operational telemetry.

### 3.2 Engineering goals

- Define stable typed contracts between intelligence layers.
- Allow components to be adopted incrementally.
- Keep deterministic calculations and enforcement independent of a specific model vendor or agent
  framework.
- Support local/self-hosted model serving and external model providers.
- Support synchronous chat, streaming chat, and asynchronous multi-step jobs.
- Make critical decision inputs auditable and replayable.

---

## 4. Non-goals

- Replacing systems of record such as CMDBs, ticketing systems, IAM, source control, or monitoring platforms.
- Treating retrieved text as executable instructions.
- Building a universal theorem prover for unrestricted natural language.
- Guaranteeing that every answer requires a complex agent loop; straightforward answers should stay
  inexpensive and fast.
- Exposing private model chain-of-thought. The system emits concise, inspectable calculation traces
  and evidence receipts instead.
- Automatically performing high-impact infrastructure, account, financial, legal, or customer-facing
  actions without explicit policy and approval controls.

---

## 5. Users and primary use cases

| User | Need | Representative question or task |
| --- | --- | --- |
| Knowledge worker | Find current, trusted organizational knowledge | "What is the current approved incident escalation policy?" |
| Technical support engineer | Diagnose and summarize an issue from evidence | "What changed in this cluster since the last successful validation?" |
| Solution architect | Validate a proposed design under known constraints | "Can this workload fit within the available GPU, network, and power capacity?" |
| Operations engineer | Run governed multi-step workflows | "Collect diagnostics, compare against baseline, and prepare a remediation plan." |
| Manager or approver | Review risk and approve controlled execution | "Show the proposed change, its policy checks, and its blast radius." |
| Platform administrator | Measure quality and improve the system | "Which answers failed due to stale citations this week?" |

---

## 6. Architecture overview

```text
User / Chat UI
  │
  ├─ Identity, tenant, session, locale, timezone
  │
  ▼
Chat Gateway
  │
  ├─ Input safety and request normalization
  ├─ Intent, risk, and temporal classification
  ├─ Session and task-state lookup
  │
  ▼
Intelligence Orchestrator
  │
  ├─ Knowledge and retrieval layer ──────► Vault, SQL, APIs, web, vector/keyword indexes
  ├─ Temporal intelligence layer ────────► Calendar, interval, fiscal, business-day resolution
  ├─ Structured knowledge layer ─────────► Graph DB, ontology, relationship traversal
  ├─ Logic and policy layer ─────────────► OPA/DMN/rules/authorization decisions
  ├─ Constraint and verification layer ──► Schemas, calculators, SMT/CP-SAT/validators
  ├─ Workflow and action layer ──────────► Durable orchestration, retries, approvals, tools
  ├─ Memory layer ───────────────────────► Session, episodic, preference, task memory
  │
  ▼
Response Composer
  │
  ├─ LLM synthesis with bounded, typed context
  ├─ Evidence citations and source metadata
  ├─ Resolution receipts and uncertainty disclosure
  │
  ▼
Response QA and Audit
  ├─ Contract grader
  ├─ Citation entailment/validity/freshness grader
  ├─ Safety and policy audit
  └─ Trace, metrics, and evaluation store
```

### 6.1 Layering principle

Each layer has a specific authority:

| Layer | Authoritative for | Must not be authoritative for |
| --- | --- | --- |
| LLM | Natural-language interpretation, synthesis, explanation, candidate generation | Facts, policy, authorization, arithmetic, final feasibility, action execution |
| Retrieval | Evidence selection and provenance | Truth absent source evaluation |
| Temporal engine | Calendar, clock, interval, fiscal/business-time resolution | Source authority and semantic relevance |
| Knowledge graph | Entity/relationship traversal and structured dependencies | Unverified external facts |
| Rules/policy engine | Explicit policies and decisions | Open-ended interpretation of natural language |
| Solver/validator | Feasibility, constraint satisfaction, schemas, calculations | User intent interpretation |
| Workflow engine | State, sequencing, retries, idempotency, approvals | Business policy or factual truth |
| Response grader | Quality gates and regressions | Replacing primary validation or governance |

### 6.2 Implementation status (Knowledge Exchange reference)

| Layer | Contract in this PRD | Reference implementation | Status |
| --- | --- | --- | --- |
| L1 Interaction/context | §7.1 | `ke/studio/tutor/intent.py`, `conversation.py` | Partial |
| L2 Grounded retrieval | §7.2, [`KNOWLEDGE_CHAT.md`](KNOWLEDGE_CHAT.md) §10 | `ke/studio/tutor/wikiqa.py`, `ke/studio/wiki/corpus.py` | Shipped (vault + web) |
| L3 Temporal intelligence | §7.3 | `temporal_engine.py`, `try_temporal_answer`, `try_temporal_vault_answer` | Shipped v1.3 (birthday recurrence, cross-TZ, nth-weekday, ISO/fiscal membership, INT-T-GOLD) |
| L4 Structured knowledge | §7.4 | Wiki links, `knowledge_graph.py`, graph metrics | Partial (multi-hop; predicate topology planned) |
| L5 Logic/policy | §7.5 | `policy_engine.py`, `policy_rules.py`, evidence API | Partial (grounding gates; nested policy AST planned) |
| L6 Constraint/verification | §7.6 | `solver_engine.py`, `POST /api/v1/solver/check` | Partial (GPU memory, business deadline; placement CP-SAT planned) |
| L7 Workflow/action | §7.7 | `ke/studio/tutor/research_task.py`, `patch_proposal.py` | Partial |
| L8 Memory | §7.8 | Session state in `intent.py`, conversation context | Partial |
| L9 Safety | §7.9 | Evidence fencing, untrusted-data prompts, scope ACL | Shipped (core) |
| L10 Response grading | §7.10 | `grade_answerability`, `freshness_pipeline`, `ragmetrics.py` | Partial |

Platform UI: citation freshness chips in `portal/chat-orb-mount.js`; orb contract in
`shared/js/chat-orb.js`.

---

## 7. Intelligence layers

### 7.1 Layer 1: Interaction, identity, and context

**Purpose:** Establish who is asking, what they can access, where they are, and the active
conversational/task context.

**Responsibilities**

- Authenticate users and establish tenant/workspace boundaries.
- Resolve roles, permissions, and data access scopes.
- Maintain session state, thread state, and correlation IDs.
- Provide locale, IANA timezone, fiscal-calendar configuration, and business-calendar configuration.
- Normalize user requests, attachments, and input modalities.
- Classify basic request risk before tool selection.

**Inputs:** User message, attachment references, authenticated identity, selected workspace, client
locale/timezone.

**Outputs:**

```json
{
  "request_id": "req_...",
  "conversation_id": "conv_...",
  "user_id": "user_...",
  "tenant_id": "tenant_...",
  "timezone": "America/New_York",
  "locale": "en-US",
  "authorization_context": {
    "roles": ["solution_architect"],
    "scopes": ["vault:read", "cluster:read"]
  }
}
```

**Acceptance criteria**

- Every tool call and retrieved artifact is scoped to tenant and authorization context.
- Server-side time is canonical for calculations and audit events.
- A request may not inherit access from prior conversation text alone.

---

### 7.2 Layer 2: Grounded knowledge and retrieval

**Purpose:** Retrieve relevant evidence from approved internal and external sources and attach
provenance to every candidate claim.

**Capabilities**

- Hybrid retrieval: lexical/BM25, vector search, metadata filtering, and structured search.
- Query decomposition and query planning.
- Reranking using semantic relevance plus source metadata.
- Chunk-to-document provenance preservation.
- Source hierarchy and trust policies.
- Corpus versioning, supersession, approval state, and content deduplication.
- Web acquisition through approved search/fetch connectors with timestamp extraction.

**Source classes**

| Class | Examples | Default trust treatment |
| --- | --- | --- |
| System of record | CMDB, inventory, IAM, ticketing, monitoring, source control | Highest for its owned domain |
| Approved internal source | Approved ADR, runbook, design specification, validation report | High when active and in scope |
| Official external source | Vendor release notes, standards body, product documentation | High for public product/standards claims |
| Independent source | Research paper, reputable analyst material | Contextual; verify claims where material |
| Community source | Forum, blog, social post, issue discussion | Discovery signal; low default authority |

**Required artifact metadata**

```yaml
source_id: vault:adr-002
source_type: vault
status: active                 # active | draft | archived | superseded | revoked
authority: internal-approved   # official | internal-approved | vendor | community | unknown
published_at: 2026-04-16T00:00:00Z
updated_at: 2026-08-29T18:40:00Z
retrieved_at: 2026-08-31T10:14:23Z
valid_from: 2026-06-01T00:00:00Z
valid_to: null
observed_at: 2026-08-29T18:40:00Z
version: "2.4"
supersedes: vault:adr-001
content_hash: "sha256:..."
provenance_confidence: high
```

**Acceptance criteria**

- Citations resolve to a source and precise supporting span/chunk.
- Retrieval retains source status, authority, dates, and version data through answer generation.
- Superseded and revoked artifacts are excluded from current-state answers unless requested for
  historical context.
- The system never equates index time with source update/effective time.

**Binding:** [`KNOWLEDGE_CHAT.md`](KNOWLEDGE_CHAT.md) §5–§12. Eval: [`TEST_KNOWLEDGE_CHAT.md`](TEST_KNOWLEDGE_CHAT.md).

---

### 7.3 Layer 3: Temporal intelligence

**Purpose:** Convert temporal language into deterministic, typed temporal meaning; compile it into
source filters; and validate temporal claims and citations.

**Temporal object types**

- **Instant:** `2026-10-15T09:00:00-04:00`
- **Calendar day or partial date:** `2026-10-15`, mid-September 2026
- **Closed/open interval:** past 14 days, Q2 2026
- **Duration:** three weeks, 48 hours
- **Recurrence:** every Friday at 09:00
- **Relation:** before deployment, after the last approved release
- **Event-relative reference:** since the last validation, as of the outage start

**Supported categories**

| Category | Examples | Canonical output |
| --- | --- | --- |
| Relative offsets | "in 45 days", "three weeks ago" | Instant/date with reference receipt |
| Relative windows | "past 30 days", "last two weeks" | Interval with inclusivity rules |
| Named weekdays | "next Friday", "second Tuesday next month" | Date plus convention/ambiguity flag |
| Calendar boundaries | "end of month", "start of next quarter" | Date or interval |
| Quarters and fiscal periods | "Q3 2026", "FY27 Q1" | Range using configured calendar |
| Business time | "five business days", "next business day" | Date using business/holiday calendar |
| Countdown/difference | "days until October 15" | Numeric duration plus target date |
| Historical state | "as of June 1" | Valid-time constraint |
| Change over time | "what changed since last release?" | Paired intervals/events and diff plan |
| Recurrence | "every weekday at 8" | RRULE/recurrence structure |

**Temporal context contract**

```python
@dataclass
class TemporalContext:
    reference_time: datetime
    timezone: str
    locale: str = "en-US"
    week_start: int = 0
    fiscal_year_start_month: int = 10
    business_calendar_id: str | None = "us-federal"
```

**Temporal resolution contract**

```python
@dataclass
class TemporalResolution:
    kind: str
    start: datetime | None
    end: datetime | None
    timezone: str
    precision: str
    anchor_time: datetime
    interpretation: str
    ambiguity: str | None
    confidence: float
    parser_version: str
```

**Implementation requirements**

- Use calendar-aware operations for month/year shifts; do not approximate months as average day counts.
- Use `dateutil.relativedelta` or equivalent for calendar-month and calendar-year arithmetic.
- Store timezone-aware timestamps internally; present user-local time by default.
- Use IANA timezone identifiers, not only abbreviations.
- Support ISO week semantics and configurable fiscal-year start month.
- Support a configurable organization-specific holiday/business calendar.
- Preserve precision. Do not represent "mid-September" as a falsely exact timestamp.
- Detect material ambiguity and either apply a documented tenant convention or ask a clarification question.
- Treat client-side parsing as an advisory UI fast path; the backend is canonical for retrieval,
  execution, citations, and grading.

**Engine facade and defaults**

- Canonical module: `ke/studio/tutor/temporal_engine.py` (compat shim:
  `scripts/backend/system/temporal_engine.py`).
- Facade class: `UniversalTemporalEngine` with `resolve_temporal_query()`,
  `add_business_days()`, `get_fiscal_quarter_bounds()`, and `get_us_federal_holidays()`.
- Default `fiscal_year_start_month = 10` (US federal / enterprise); pass `1` for calendar fiscal.
- Default `business_calendar_id = "us-federal"`. Register additional calendars via
  `register_business_calendar(calendar_id, provider)`.
- Business-day resolutions emit `operation.traversal`: a day-by-day list of skipped weekends/holidays
  and counted business days for audit receipts.

**Temporal receipt example**

```json
{
  "expression": "45 days from now",
  "reference_timestamp": "2026-08-31T06:10:00-04:00",
  "timezone": "America/New_York",
  "operation": {"type": "calendar_day_offset", "quantity": 45},
  "result": "2026-10-15",
  "display": "Thursday, October 15, 2026",
  "precision": "day",
  "parser_version": "temporal-engine/1.0.0"
}
```

**Acceptance criteria**

- Given a fixed reference time and tenant calendar configuration, resolution is deterministic.
- "Last month" resolves to the preceding calendar month; "past 30 days" resolves to a trailing 30-day interval.
- "As of" retrieval uses source valid-time semantics rather than simply filtering on document age.
- Temporal filters are logged in normalized form with the retrieval request.
- The response includes a concise time anchor when timezone, fiscal period, or ambiguity materially
  affects the answer.

---

### 7.4 Layer 4: Structured knowledge and graph reasoning

**Purpose:** Represent entities and relationships explicitly so the system can perform reliable
multi-hop navigation, dependency analysis, and topology-aware retrieval.

**Capabilities**

- Entity resolution across people, systems, documents, services, configurations, incidents,
  releases, and assets.
- Relationship traversal: ownership, dependency, connectivity, version compatibility, approval
  lineage, and supersession.
- Temporal edges and facts using `valid_from`, `valid_to`, `observed_at`, and provenance.
- Graph-assisted retrieval and relationship explanations.
- Change detection across graph snapshots or event streams.

**Example domain model**

```text
Cluster ─[contains]──────────────► Node
Node ─[contains]─────────────────► GPU
Node ─[connected_to]─────────────► FabricSwitch
Service ─[deployed_on]───────────► Cluster
Policy ─[applies_to]─────────────► Service
ADR ─[supersedes]────────────────► ADR
ValidationRun ─[observed_state]─► ConfigurationSnapshot
```

**Example use case**

A user asks: "Which active services depend on the switches affected by this maintenance window?"

The graph layer resolves the maintenance window, finds affected switches, traverses topology and
service dependencies, applies active-time filters, and returns a structured dependency set. The LLM
summarizes it; it does not infer topology from prose.

**Acceptance criteria**

- Graph query results retain node/edge provenance and temporal validity.
- The system can distinguish current topology from topology at a prior time.
- Entity identifiers are resolved before action planning.

---

### 7.5 Layer 5: Deterministic logic, rules, and policy

**Purpose:** Evaluate explicit business logic, safety rules, authorization decisions, and
operational policy outside the LLM.

**Recommended mechanisms**

| Need | Recommended mechanism |
| --- | --- |
| Authorization and resource access | Policy-as-code such as OPA/Rego or Cedar |
| Business decisions with analyst-owned tables | DMN decision tables |
| Complex rule chaining | Rules engine or Datalog |
| Admission/configuration policy | OPA/Rego, custom typed rule service |
| Temporal/event patterns | Complex event processing or stateful rule service |
| Simple stable logic | Versioned, tested application code |

**Policy decision contract**

```json
{
  "decision": "deny",
  "policy_id": "change-window-policy/v3",
  "reason_codes": ["OUTSIDE_APPROVED_WINDOW", "MISSING_CHANGE_APPROVAL"],
  "evaluated_at": "2026-08-31T10:15:11Z",
  "inputs_hash": "sha256:..."
}
```

**Example rule**

```text
Allow change execution only when:
- the requester holds the required role;
- the target resource belongs to the requester tenant;
- an approved change record is present;
- the maintenance window is active;
- risk classification does not require a separate approval;
- no blackout or active incident restriction applies.
```

**Acceptance criteria**

- The LLM cannot bypass or redefine policy by generated text.
- Policy decisions are versioned, logged, replayable, and explainable with reason codes.
- Authorization is evaluated at tool/action time, not merely at initial chat login.

---

### 7.6 Layer 6: Constraint solving and verification

**Purpose:** Verify that structured outputs, calculations, configurations, and plans satisfy hard
constraints before they are presented as valid or executed.

**Capabilities**

- JSON Schema/Pydantic validation for model/tool outputs.
- Deterministic arithmetic and unit conversion.
- Configuration compatibility validation.
- SAT/SMT verification for logical and arithmetic constraints.
- CP-SAT or optimization for scheduling, allocation, placement, and capacity planning.
- Feasibility reports with machine-readable violations.
- Generate → verify → repair loops.

**Recommended technology mapping**

| Problem | Tool category |
| --- | --- |
| Typed structured output | JSON Schema, Pydantic, protobuf/Avro where appropriate |
| Numeric calculations | Deterministic library/service with unit-aware types |
| Resource placement/scheduling | OR-Tools CP-SAT or MILP solver |
| Logical/configuration consistency | Z3 SMT solver or SAT solver |
| Policy validation | Rules/policy layer plus schema checks |
| Infrastructure plan validation | Graph lookup + typed checks + solver |

**Generate → verify → repair flow**

```text
LLM produces a typed candidate
  → Schema parser validates shape
  → Inventory/graph data supplies constraints
  → Policy engine evaluates permission and guardrails
  → Solver/validator evaluates feasibility
  → Violations are returned to the planner
  → LLM revises, asks for clarification, or escalates
```

**Acceptance criteria**

- The user never receives an infeasible plan as a confirmed feasible recommendation.
- Validation failure includes stable reason codes and constraint details.
- High-impact actions require successful validation immediately before execution.

---

### 7.7 Layer 7: Agent planning and durable workflow

**Purpose:** Coordinate tool use and multi-step work with explicit state, retries, timeouts,
idempotency, human review, and observability.

**Principles**

- Start with a single bounded agent and an explicit graph/state machine.
- Add multiple agents only when different roles require distinct tools, permission boundaries, or
  independent review.
- Keep nondeterministic LLM decisions separate from deterministic workflow orchestration.
- Store task state externally; do not rely on conversation text as the only state store.
- Make write actions idempotent and approval-gated.

**Workflow phases**

```text
INTAKE
  → CLASSIFY
  → RESOLVE ENTITIES/TIME
  → PLAN
  → RETRIEVE / OBSERVE
  → VALIDATE
  → REQUEST APPROVAL (if needed)
  → EXECUTE
  → VERIFY POSTCONDITIONS
  → REPORT
  → AUDIT / CLOSE
```

**Action contract**

```json
{
  "action_id": "act_...",
  "tool": "create_change_request",
  "target": {
    "resource_type": "cluster",
    "resource_id": "cluster-17"
  },
  "arguments": {},
  "risk_level": "high",
  "idempotency_key": "...",
  "policy_decision_id": "...",
  "approval_required": true,
  "preconditions": ["inventory_fresh", "capacity_validated"],
  "postconditions": ["change_record_created"]
}
```

**Acceptance criteria**

- Workflows resume safely after process failures.
- Each action has an idempotency key, correlation ID, audit event, and final result.
- The system pauses for human approval before irreversible or high-risk actions.
- Retries do not repeat non-idempotent external actions.

---

### 7.8 Layer 8: Memory and state

**Purpose:** Retain useful conversational and task context while separating transient state, durable
facts, preferences, and untrusted conversation content.

**Memory classes**

| Memory type | Contents | Storage/retention guidance |
| --- | --- | --- |
| Working memory | Current turn context, temporary plan, tool results | Request/task scoped; short-lived |
| Session memory | Conversation summary, selected entities, unresolved questions | Conversation scoped and editable |
| Episodic memory | Prior tasks, outcomes, troubleshooting sequences | Durable, attributable, retention-controlled |
| Semantic memory | Curated organizational knowledge | Versioned vault/knowledge system; not free-form chat logs |
| User preference memory | Formatting, defaults, workspace preferences | Opt-in, inspectable, user-controlled |
| Operational state | Workflow status, retries, approvals, locks | Durable workflow/state store |

**Acceptance criteria**

- Memory is tenant-scoped and authorization-aware.
- Untrusted conversation text is not promoted to semantic truth without validation/curation.
- Users and administrators can inspect and correct stored preference/session memory where applicable.

---

### 7.9 Layer 9: Safety, guardrails, and human oversight

**Purpose:** Protect users, systems, data, and operations across input, retrieval, tool use, output,
and long-running workflows.

**Controls**

- Prompt-injection detection and trusted/untrusted content separation.
- Tool allowlists, typed arguments, least-privilege credentials, and network egress controls.
- Sensitive-data classification, redaction, and access filtering.
- Policy enforcement at retrieval and action time.
- Output schema validation and prohibited-action checks.
- Risk classification and approval gates.
- Rate limits, budgets, retry caps, circuit breakers, and kill switches.
- Immutable audit trail for decisions, evidence, tool calls, approvals, and results.

**Human-in-the-loop triggers**

- Irreversible or externally visible action.
- Production configuration mutation.
- Financial, legal, compliance, or customer-impacting decision.
- Low-confidence entity resolution or material temporal ambiguity.
- Conflicting high-authority sources.
- Unsatisfied hard constraint or incomplete evidence.

**Acceptance criteria**

- Retrieved text cannot grant new permissions or alter system policy.
- High-risk actions cannot proceed without explicit, current approval bound to the resolved target
  and arguments.
- Safety events are searchable by request, user, policy, tool, and source.

---

### 7.10 Layer 10: Response composition and quality grading

**Purpose:** Produce clear, evidence-backed answers and independently evaluate whether they meet the
expected response contract.

**Response requirements**

- Distinguish verified facts, inferences, assumptions, and recommendations.
- Cite evidence at the point of use.
- Display source status, authority, effective/updated date, and freshness/validity indicators when material.
- Use concise temporal receipts where time semantics matter.
- State uncertainty or insufficient evidence explicitly.
- Avoid claiming "latest," "current," or "supported" without satisfying the applicable evidence policy.

**Response contract**

```python
@dataclass
class ResponseContract:
    answer_type: str
    required_entities: list[str]
    required_claims: list[str]
    temporal_contract: dict | None
    citation_policy: str
    tool_result_requirements: list[str]
    safety_requirements: list[str]
```

**Grading dimensions**

| Dimension | What is checked | Example failure code |
| --- | --- | --- |
| Answer type | Response matches requested task | `answer_type_mismatch` |
| Grounding | Material factual claims have evidence | `unsupported_claim` |
| Citation entailment | Cited span supports the claim | `citation_non_entailment` |
| Authority | Evidence source is appropriate for claim domain | `insufficient_source_authority` |
| Supersession | Current answer does not rely on superseded/revoked evidence | `superseded_source_used` |
| Temporal correctness | Date/range matches deterministic result | `temporal_value_incorrect` |
| Temporal validity | Evidence was valid at requested time | `citation_validity_error` |
| Freshness | Current/latest claim meets its freshness policy | `stale_source_contamination` |
| Constraint validity | Proposed plan passed required validation | `unvalidated_feasibility_claim` |
| Safety/policy | Output/action conforms to policy | `policy_violation` |
| Calibration | Uncertainty is represented honestly | `unjustified_certainty` |
| Style | Clear, direct, useful response format | `response_quality_low` |

**Hard gates**

The response must fail or be downgraded to a clarification/insufficient-evidence answer when any
of the following are true:

- A high-impact action lacks policy approval, validation, or user confirmation.
- A current/latest claim relies only on stale, undated, superseded, or low-authority evidence.
- A temporal response conflicts with canonical engine output.
- A citation does not support the claim it is attached to.
- Material source conflicts cannot be resolved by authority, scope, or validity time.
- The answer includes a configuration/action recommendation that fails a hard constraint.

**Reference implementation (Knowledge Exchange)**

| Component | Module | Role |
| --- | --- | --- |
| Answerability grader | `ke/studio/tutor/wikiqa.py` → `grade_answerability()` | Sufficiency, freshness intent, route |
| Freshness decay | `ke/studio/tutor/freshness_pipeline.py` | Half-life scoring, web snippet dates, supersession |
| Stale contamination gate | `freshness_pipeline.detect_stale_source_contamination()` | Hard gate on superseded citations |
| NLI / faithfulness | `wikiqa.nli_grade`, `maybe_accept_synthesis()` | Sentence-level entailment |
| Eval metrics | `ke/studio/tutor/ragmetrics.py` | Faithfulness, relevancy, tool correctness |
| Citation UX | `portal/chat-orb-mount.js` | Freshness chips on source pills |

---

### 7.11 Deterministic Grounded Latent Composition (DGLC)

**Purpose:** Handle question classes where natural-language understanding is necessary but
insufficient. The system must resolve **latent state** (policies, topology, version chains,
reservations), ignore decoys, apply non-negotiable constraints, reconcile conflicts, and emit
results that can be **independently verified**—not merely fluent prose.

DGLC is the compositional pattern that binds Layers 3–6 and 10: each sub-problem is routed to
the authoritative engine; outcomes are merged from **receipts**, not re-inferred by the LLM.

**Composition pipeline**

```text
NL query
  → Task classification (deduction | policy | feasibility | graph | temporal | evidence)
  → Fact extraction → typed facts (not free-text premises)
  → Latent state materialization (graph snapshot, policy facts, inventory, version chain)
  → Deterministic engines (parallel where independent)
  → Receipt merge under precedence (deny-overrides-permit; unknown poisons feasibility claims)
  → Calibrated outcome + audit trail
  → LLM synthesis (optional; must not add facts absent from receipts)
```

**Three-valued and multi-valued outcomes**

Enterprise reasoning requires more than binary yes/no:

| Domain | Outcomes |
| --- | --- |
| Deduction / policy | `entailed`, `contradicted`, `unknown` |
| Feasibility | `feasible`, `infeasible`, `unknown` (missing facts) |
| Evidence | `supported`, `unsupported`, `conflicted` |
| Operational state | `verified`, `pending`, `conflicted`, `stale_observation` |

The assistant must not collapse `unknown` or `conflicted` into a helpful-sounding definite answer.

**Engine receipt contract (merge input)**

```json
{
  "engine": "policy/v2",
  "outcome": "deny",
  "confidence": "entailed",
  "reason_codes": ["DENY_RESTRICTED_PII_CISO_APPROVAL_REQUIRED"],
  "derivation": ["Policy C applies; no CISO approval fact present"],
  "inputs_hash": "sha256:..."
}
```

**Representative hard archetypes (evaluation targets)**

| Archetype | Required mechanism | Implementation status |
| --- | --- | --- |
| Quantifier / scope traps | Datalog or FOL subset; explicit `unknown` | Planned (`dglc.yaml`) |
| Negation / policy precedence | Policy AST, deny-overrides-permit | Partial (`policy_engine.py` v1) |
| Globally satisfiable, locally infeasible | CP-SAT / MILP with binding constraint receipt | Partial (`solver_engine.py` scaffold) |
| Hard + soft objectives | Ranked feasible plans only | Planned |
| Constrained graph reachability | Predicate traversal (encrypted, maintenance, alarms) | Partial (wikilink graph) |
| Version / supersession / scope | Directed version graph + applicability | Partial (vault metadata) |
| Counterfactual causality | Hypothesis ledger; intervention evidence types | Planned |
| Partial observability | Formal health contract; coverage scoring | Emerging (`needs_clarification` in temporal) |
| Conflicting authoritative sources | Bitemporal model + conflict lattice | Planned |
| Non-monotonic multi-turn state | Event-sourced entity ledger | Planned |
| Recursive / fixed-point rules | Cycle-aware policy evaluation | Planned |
| Minimal-change repair | MUS / minimal relaxations from solver | Planned |
| Cross-domain unit traps | Unit-aware calculator + assumption ledger | Planned |
| Prompt injection in evidence | Instruction/data separation | Shipped (L9) |
| Meta-consistency across paraphrases | Shared policy service + paraphrase battery | Planned |

**Boss-battle prompts** combine multiple traps (policy + graph + capacity + state). They are the
highest-value private regression cases and must grade intermediate receipts independently—not only
final prose.

**Benchmark portfolio (layered)**

Public references (RuleTaker, FOLIO, ProofWriter, CausalBench, GRS-QA, GAIA) inform design;
executable gold lives in Knowledge Exchange:

- `tests/fixtures/chat/golden_questions/temporal.yaml` — INT-T-GOLD (shipped)
- `tests/fixtures/chat/golden_questions/mechanism.yaml` — route/evidence (shipped)
- `tests/fixtures/chat/golden_questions/dglc.yaml` — deduction, policy, placement (planned)

Each DGLC case stores: typed `facts`, `expected` receipts, `binding_constraints`, `distractors`,
`prohibited_claims`, and paraphrase variants for robustness grading.

**Acceptance criteria**

- High-risk conclusions require at least one deterministic receipt from the authoritative layer.
- Feasibility claims include binding-constraint identification when infeasible.
- Policy denials include stable reason codes; permits never override explicit denies without precedence rules.
- Source conflicts surface as `conflicted` with per-source state—not a merged hallucination.
- Graders score outcome, grounding, distractor isolation, constraint coverage, calibration, and receipt quality independently.

---

## 8. Freshness and validity model

### 8.1 Time dimensions

A source timestamp must not be reduced to one generic date.

| Field | Definition | Use |
| --- | --- | --- |
| `published_at` | When authored/released publicly | Assess source age and release chronology |
| `updated_at` | When content was last materially updated | Assess maintenance recency |
| `retrieved_at` | When the platform acquired the source | Assess index/cache freshness |
| `observed_at` | When a fact/measurement was observed | Assess telemetry/inventory recency |
| `valid_from` | When a claim/policy/config became effective | Historical and current validity |
| `valid_to` | When a claim/policy/config ceased to be effective | Historical and current validity |
| `approved_at` | When internal governance approved an artifact | Internal decision authority |

### 8.2 Intent-conditioned evidence score

Recency is a bounded input to evidence ranking, not an override for authority or validity.

```text
S_evidence = w_r·R + w_a·A + w_v·V + w_f·F + w_c·C + w_p·P − P_superseded − P_conflict − P_unsupported
```

Where:

- **R** — semantic relevance
- **A** — authority for the claim domain
- **V** — validity at the requested/implied time
- **F** — freshness appropriate to query volatility
- **C** — corroboration across trustworthy independent sources
- **P** — provenance completeness and extraction confidence

A bounded freshness function (implemented in `freshness_pipeline.compute_temporal_score`):

```text
F = 2^(−Δt / H_q)
```

Where Δt is source age in days and H_q is a query-specific half-life (14 days for time-sensitive
queries, 90 days standard, 730 days historical). For explicit live official sources, freshness may
be represented as verified-current rather than inferred from age.

Multi-signal relevance weighting (time-sensitive queries boost temporal weight):

```text
final = w_rerank·S_rerank + w_fusion·S_fusion + w_structure·S_structure
      + w_metadata·S_metadata + w_authority·S_authority + w_temporal·S_temporal − P_staleness
```

With `w_temporal = 0.25` (time-sensitive) or `0.06` (routine).

### 8.3 Volatility policy

| Query class | Freshness expectation | Preferred evidence |
| --- | --- | --- |
| Live status, outage, inventory, pricing | Minutes to days | Live system/API/status source |
| Current software release/support compatibility | Days to months | Official release notes/support matrix/current docs |
| Active runbook/architecture decision | Weeks to months, with active approval status | Approved active internal artifact |
| Historical/audit question | Validity at target date; no recency preference | Snapshot, version history, dated event record |
| Stable technical reference | Months to years acceptable | Standards, official specification, primary paper |

### 8.4 Citation display policy

Show the user only the metadata needed to judge relevance:

```text
Internal ADR-002
Approved • Active • Version 2.4
Effective: Jun 1, 2026–present
Updated: Aug 29, 2026
```

```text
Vendor release notes
Official source • Published Aug 28, 2026
Verified Aug 31, 2026
```

Statuses may include: **Current authoritative**, **Historical**, **Archived/superseded**,
**Current but unverified**, and **Insufficient for a current claim**.

UI freshness levels (Knowledge Exchange): `current`, `stable`, `dated`, `stale`, `superseded`,
`unknown` — rendered as compact chips on citation pills.

---

## 9. Core request flows

### 9.1 Direct factual answer

```text
User question
  → classify as informational / low risk
  → resolve entities and temporal language
  → retrieve/rerank authorized evidence
  → assess source authority, validity, freshness
  → LLM composes cited answer
  → response grader checks grounding and contracts
  → return answer and evidence metadata
```

### 9.2 Temporal vault retrieval

```text
"Show notes from the past two weeks"
  → temporal engine resolves trailing interval
  → compiler creates normalized metadata filter
  → vault retrieval applies overlap predicate
  → reranker considers relevance + source metadata
  → response reports range and selected artifacts
```

Example compiled filter:

```json
{
  "temporal_filter": {
    "field": "updated_at",
    "operator": "overlaps",
    "start": "2026-08-17T00:00:00-04:00",
    "end": "2026-08-31T23:59:59.999999-04:00"
  },
  "exclude_status": ["superseded", "revoked"]
}
```

### 9.3 "Latest" answer

```text
"What is the latest approved architecture decision?"
  → classify current/latest intent
  → apply source hierarchy and active/approved constraint
  → retrieve candidate documents and version chains
  → validate effective period and supersession status
  → reject unsupported currentness claims
  → answer with active artifact, version, effective date, and citation
```

Knowledge Exchange behavior: freshness-intent questions keep vault hits labeled **historical** and
attach a separate **web supplement** (hybrid two-block) when web is allowed; `/vault` scope returns
historical vault body with `research_offer` and never egresses silently.

### 9.4 Planning/action request

```text
User goal
  → identify target entities and time constraints
  → produce typed candidate plan
  → retrieve live state and dependency graph
  → evaluate policy/authorization
  → validate constraints/feasibility
  → request approval if required
  → durable workflow executes idempotent steps
  → verify postconditions
  → report outcome with audit receipt
```

---

## 10. Data contracts and storage

### 10.1 Required stores

| Store | Purpose | Examples |
| --- | --- | --- |
| Relational operational DB | Sessions, tasks, approvals, policy receipts, metadata | PostgreSQL |
| Vector/lexical index | Hybrid corpus retrieval | OpenSearch, pgvector, Qdrant, Vespa |
| Object/document store | Canonical artifacts and source snapshots | S3-compatible store, Git-backed vault |
| Graph database | Entity relationships/topology/dependencies | Neo4j, Neptune, Memgraph, RDF store |
| Event/workflow store | Durable execution and audit events | Temporal backend, event log, workflow DB |
| Cache | Short-lived request/session/tool state | Redis |
| Evaluation store | Golden cases, traces, grader outcomes | PostgreSQL, warehouse, experiment tracker |

### 10.2 Audit event schema

```json
{
  "event_id": "evt_...",
  "timestamp": "2026-08-31T10:15:11Z",
  "request_id": "req_...",
  "conversation_id": "conv_...",
  "actor": "user_...",
  "event_type": "policy_evaluated",
  "component": "policy-engine",
  "inputs_hash": "sha256:...",
  "outputs": {
    "decision": "allow",
    "reason_codes": []
  },
  "trace_id": "trace_..."
}
```

### 10.3 Data retention and privacy

- Apply tenant isolation to every store and index namespace.
- Store minimal required content for evaluation and audit; apply configurable retention policy.
- Redact or tokenize sensitive data before it enters shared evaluation datasets.
- Support deletion/correction workflows for user preference/session memory where required.
- Maintain provenance for generated summaries so they do not become untraceable source material.

---

## 11. API and tool interfaces

### 11.1 Temporal resolution API

```http
POST /api/v1/temporal/resolve
```

Request:

```json
{
  "text": "the second Tuesday of next month",
  "reference_time": "2026-08-31T06:10:00-04:00",
  "timezone": "America/New_York",
  "locale": "en-US",
  "fiscal_year_start_month": 10,
  "business_calendar_id": "us-federal"
}
```

Response:

```json
{
  "kind": "instant",
  "start": "2026-09-08T00:00:00-04:00",
  "end": "2026-09-08T23:59:59.999999-04:00",
  "precision": "day",
  "interpretation": "second Tuesday of September 2026",
  "ambiguity": null,
  "receipt": {}
}
```

### 11.2 Evidence evaluation API

```http
POST /api/v1/evidence/evaluate
```

```json
{
  "query": "What is the latest approved design?",
  "intent": "latest",
  "temporal_context": {},
  "candidates": ["vault:adr-001", "vault:adr-002"]
}
```

Response must include source ranking, validity rationale, supersession decisions, and freshness
policy result.

### 11.3 Typed tool interface

All agent tools must expose a schema with:

- Tool name and version
- Explicit read/write classification
- Required scopes
- Input schema and output schema
- Timeout and retry policy
- Idempotency requirements
- Risk class
- Audit fields and error codes

No general-purpose shell, unrestricted SQL, or arbitrary network tool should be exposed directly to
the model in production.

**Knowledge Exchange tool vocabulary** (mapped in `wikiqa.infer_tools_called`): `search_vault`,
`read_vault`, `search_web`, `fetch_web`, `apply_vault_patch` (never invoked from Ask).

---

## 12. User experience requirements

### 12.1 Answer presentation

- Lead with a direct answer.
- Show citations inline for material claims.
- Use compact source cards or pills for source status and date metadata.
- Reveal detailed temporal receipts, source scoring, or tool traces on demand.
- Clearly label assumptions, inferred conclusions, and unresolved uncertainty.
- Show a clear approval card for pending action rather than treating approval as ordinary chat text.

Platform orb: [`shared/js/chat-orb.js`](../../js/chat-orb.js). Consumer mount:
`<consumer>/portal/chat-orb-mount.js`.

### 12.2 Temporal answer examples

**Simple:**

> Three weeks before August 31, 2026 is August 10, 2026.

**Ambiguous:**

> I interpreted "next Friday" as the immediately upcoming Friday in the workspace timezone:
> September 4, 2026. If you mean the Friday of the following week, that is September 11.

**Fiscal:**

> Using the configured calendar fiscal year, the previous quarter is Q2 2026, April 1–June 30. A
> non-calendar fiscal year would produce a different range.

### 12.3 Source freshness UX

Do not use age-only color coding. Use semantic labels:

- Current authoritative
- Current but unverified
- Historical — valid for requested period
- Archived/superseded — shown for context
- Insufficient for current claim

---

## 13. Security and governance requirements

- Enforce authentication, tenant isolation, and authorization before retrieval and again before tool execution.
- Treat user prompts, retrieved documents, web pages, and tool output as untrusted data unless
  specifically designated as trusted system input.
- Separate instructions from evidence in prompt construction.
- Validate all structured LLM output before use.
- Require explicit confirmation for high-impact or irreversible external actions.
- Bind approval to exact resolved targets, arguments, and change scope.
- Encrypt sensitive data in transit and at rest.
- Log access to sensitive sources and all write-capable tool calls.
- Support policy simulation and dry-run mode for action workflows.
- Provide a kill switch for tools, workflow classes, model providers, and tenant-level agent execution.

---

## 14. Observability and evaluation

### 14.1 Required telemetry

- End-to-end latency, first-token latency, retrieval latency, tool latency, workflow duration.
- Retrieval recall proxies, reranker scores, source-status distributions, citation coverage.
- Temporal parser resolution rate, ambiguity rate, fallback rate, and canonical mismatch rate.
- Policy allow/deny/error rates by tool and tenant.
- Validation pass/fail rates and top violated constraints.
- Approval rates, abandonment, rollback, retry, and postcondition failure rates.
- Response grader distributions and hard-gate failure reasons.
- Cost/token/tool usage by request class.

### 14.2 Evaluation datasets

Maintain versioned datasets for:

- Grounded factual QA.
- Citation entailment and source attribution.
- Current/latest questions with intentionally stale distractors.
- Historical/as-of questions with validity-time traps.
- Temporal parsing and arithmetic.
- Business-calendar, fiscal-calendar, timezone, DST, and leap-year cases.
- Tool selection and authorization boundaries.
- Plan feasibility and solver-based validation.
- Prompt injection and retrieval poisoning.
- Human-review/approval workflows.

Platform pointer: [`TEST_KNOWLEDGE_CHAT.md`](TEST_KNOWLEDGE_CHAT.md). Consumer catalog:
`docs/TEST_CHAT.md` (Knowledge Exchange).

### 14.3 Quality targets

Initial targets should be calibrated per domain, but the platform must measure:

| Metric | Initial target direction |
| --- | --- |
| Citation coverage for factual answers | Increase toward complete material-claim coverage |
| Citation entailment precision | High; hard-gate critical unsupported claims |
| Temporal exact-match accuracy | Near-perfect on deterministic supported grammar |
| Superseded-source leakage in current answers | Zero tolerance for high-risk/current answer classes |
| Unauthorized tool execution | Zero tolerance |
| High-risk action without approval | Zero tolerance |
| Workflow postcondition verification | Required for all write workflows |
| Clarification rate | Low but non-zero; ambiguity should not be hidden |

---

## 15. Test strategy

### 15.1 Unit tests

- Temporal arithmetic for day/week/month/year shifts.
- Leap years, month-end normalization, ISO week boundaries, DST transitions, and timezone conversion.
- Fiscal and business calendar resolution.
- Date range inclusivity/exclusivity.
- Source metadata parsing and timestamp confidence.
- Supersession graph traversal.
- Evidence scoring and source hierarchy logic.
- Policy decision reason codes.
- Schema and solver validation behavior.

**Shipped examples (Knowledge Exchange):**

- `tests/test_freshness_pipeline.py` — decay, web grading, contamination, badges
- `tests/test_wiki_retrieval.py` — `test_w6l`–`test_w6o` freshness-intent and answerability cases
- `tests/test_temporal_golden.py` + `golden_questions/temporal.yaml` — INT-T-GOLD deterministic temporal corpus
- `ke/studio/tutor/temporal_eval.py` — YAML receipt grader for temporal gold cases

**Planned (DGLC — §7.11):**

- `golden_questions/dglc.yaml` — policy, placement, deduction, boss-battle cases with typed facts and receipt grading

### 15.2 Integration tests

- Temporal query → compiled SQL/vector/graph filter fidelity.
- Retrieval → citation span → answer claim attribution.
- Current/latest intent → authority/validity/freshness filtering.
- Historical/as-of intent → effective-time filtering.
- Generate → verify → repair loop.
- Approval gate → bound write action → postcondition verification.
- Workflow failure/restart/idempotency behavior.

### 15.3 End-to-end tests

- Streaming and non-streaming chat parity.
- Sidebar/client fast-path versus backend canonical temporal result.
- Source metadata visualization.
- Clarification and disambiguation flows.
- Human approval UI flows.
- Regression tests for prior incident classes.

### 15.4 Property-based tests

Examples:

- `resolve("in n days", d) − d = n days`
- `resolve("n days ago", d) + n days = d`
- `interval.start ≤ interval.end`
- `status ∈ {superseded, revoked} ⇒ source cannot support a current claim`
- `as_of(t) ⇒ valid_from ≤ t < valid_to`

---

## 16. Delivery plan

### Phase 0: Foundations

- Define common IDs, tracing, tenant boundaries, source metadata schema, and tool contract.
- Establish evaluation store and baseline response/citation grader.
- Implement read-only retrieval and provenance-preserving citations.

### Phase 1: Grounded chat

- Hybrid vault retrieval, source hierarchy, document status/versioning, citation UX.
- Basic source freshness and supersession rules.
- Structured response contracts and grounded-answer grading.

**Status:** Largely shipped in Knowledge Exchange (`wikiqa`, `corpus`, hybrid two-block, answerability).

### Phase 2: Temporal intelligence

- Canonical backend temporal engine.
- Calendar, quarter, fiscal, business-day, interval, and timezone support.
- Temporal retrieval compiler for vault/SQL/graph queries.
- Temporal response and citation-validity graders.
- Advisory client parser with canonical backend reconciliation.

**Status:** Shipped in Knowledge Exchange — `temporal_engine.py` (`temporal-engine/1.3.0`:
business-day traversal, fiscal calendar default October, pluggable calendars, birthday recurrence,
leap-day observance, month/day span, cross-timezone conversion, nth-weekday, ISO week, fiscal-quarter
membership, calendar-month “last month”, yesterday intervals, `needs_clarification` / `invalid_date`),
`POST /api/v1/temporal/resolve`, tenant defaults via `temporal_config.py` and `product.json`
`temporal` block, advisory client parser (`shared/js/temporal-advisory.js`) with backend
reconciliation in Chat Orb. Golden corpus: `tests/fixtures/chat/golden_questions/temporal.yaml`
(INT-T-GOLD, 47 active cases); gate: `make temporal-eval` in `make ci`. Freshness decay and web
snippet dating also shipped (`freshness_pipeline.py`). Remaining: DST elapsed-time multi-step,
multi-turn temporal state chains, full SQL/graph retrieval compiler backend execution.

**Shipped v0.2 additions:** temporal retrieval compiler execution (`temporal_compiler.py`),
`named_weekday_time` grammar, stream temporal grading, policy deny UX, graph lift metrics,
tenant policy rules, solver API scaffold, telemetry, domain packs.

### Phase 3: Structured reasoning and validation

- Entity resolution and graph-backed retrieval (multi-hop wikilink expansion shipped).
- Rules/policy engine integration (`policy_engine.py`, `POST /api/v1/evidence/evaluate`).
- Graph temporal filter compiler (`compile_graph_filter`).
- Typed tool invocation and deterministic validation — solvers planned (INT-V*).

**Status:** v1 shipped — one-hop/multi-hop graph expansion, grounding policy v1,
evidence evaluation API. OPA/Rego and solver-backed feasibility remain planned.

### Phase 4: Durable agent workflows

- Explicit workflow graph/state machine (`workflow_engine.py` scaffold).
- Durable execution, retries, idempotency, approval cards — research handoff uses
  existing `WebResearchTask`; full workflow UI planned.

**Status:** Scaffold shipped; durable web research path active; full state-machine
UX and audit views planned.

### Phase 5: Continuous improvement

- Curated failure corpus (`scripts/chat_intelligence_eval.py` — INT-E01–E19).
- Temporal golden corpus (`scripts/temporal_eval.py`, `temporal.yaml` — INT-T-GOLD).
- Automated regression gates (`benchmark_chat_intelligence.py --check`,
  `coverage_chat_intelligence.py` ≥80% branch/condition, `temporal_eval.py --check`).

**Status:** Benchmark, coverage, INT-E, and INT-T-GOLD gates wired into `make ci`.
DGLC golden corpus (`dglc.yaml`) and placement/policy boss-battle regressions planned.
Online telemetry and A/B experiments remain planned.

### Phase 6: Deterministic Grounded Latent Composition (DGLC)

- Three-valued outcome contract across policy, solver, and deduction engines.
- `dglc.yaml` executable corpus (quantifier traps, nested policy, power-domain placement,
  ADR supersession, boss battles).
- Policy AST v2 with deny-overrides-permit and typed facts.
- CP-SAT placement solver with binding-constraint and minimal-relaxation receipts.
- Receipt composition layer before LLM synthesis.

**Status:** Architecture specified in §7.11; temporal `unknown`/`needs_clarification` pattern
established; full DGLC pipeline planned.

---

## 17. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Over-reliance on document age | New but unreliable sources displace authoritative sources | Weight authority, validity, provenance, and supersession above recency alone |
| Temporal ambiguity hidden from user | Incorrect retrieval/action boundaries | Represent ambiguity; apply documented conventions or clarify |
| Client/server time mismatch | Inconsistent answers and filters | Canonical backend resolution with signed/recorded reference time |
| Tool overreach | Unsafe actions/data access | Typed allowlisted tools, least privilege, policy checks, approval gates |
| Agent complexity | Cost, latency, debugging difficulty | Start with deterministic workflows and one bounded agent |
| Stale internal corpus | Incorrect current guidance | Artifact lifecycle, approval state, version chain, freshness monitors |
| Citation theater | Citations exist but do not support claims | Span-level entailment grading and hard gates |
| Prompt injection in retrieved content | Policy/data exfiltration risk | Trust boundaries, instruction stripping, content isolation, tool policy enforcement |
| Incomplete observability | Incidents cannot be explained/repaired | Mandatory trace IDs, audit events, persisted receipts, evaluation dashboards |

---

## 18. Open decisions

- Which workflow engine is the canonical platform for durable action workflows?
- Which graph representation best fits the corpus and infrastructure topology: property graph, RDF/ontology, or both?
- Which policy engine will govern authorization and operational policy?
- What fiscal calendars, holiday calendars, and workspace-level timezone defaults are required at launch?
- What source classes may support a "latest/current" claim without independent corroboration?
- What response grader failures are blocking versus advisory by risk tier?
- What is the retention policy for traces, tool payloads, user memory, and source snapshots?
- Which actions are permitted in read-only, dry-run, approval-required, and autonomous modes?

---

## 19. Definition of done

The Chat Intelligence Layers initiative is ready for production use in a target domain when:

- The domain has defined systems of record, source hierarchy, artifact lifecycle, and metadata requirements.
- Chat answers cite attributable supporting evidence with authority and validity metadata.
- Deterministic temporal questions resolve correctly for supported grammar, timezones, fiscal/business calendars, and edge cases.
- "Latest" and "as-of" answers use different evidence policies and are evaluated against stale/superseded distractors.
- Authorization and operational policy are enforced outside the LLM.
- All write-capable tools use typed schemas, audit logs, idempotency, validation, and approval gates as required.
- Critical actions verify postconditions and surface failures clearly.
- Response grading blocks unsupported, temporally incorrect, stale-contaminated, unsafe, or infeasible high-risk answers.
- Offline regression suites and production telemetry demonstrate stable quality against defined targets.
- Operators can inspect a request's evidence, time resolution, policy decision, validation results, workflow state, and final response.

---

## Appendix A: Reference implementation layout

Platform contract lives in `webtools-ui/docs/` (this file, [`KNOWLEDGE_CHAT.md`](KNOWLEDGE_CHAT.md)).
Primary reference implementation lives in **Knowledge Exchange**:

```text
knowledge-exchange/
├── ke/studio/tutor/
│   ├── wikiqa.py              # Ask pipeline, routing, answerability, grounding policy
│   ├── freshness_pipeline.py  # Recency decay, web grading, supersession, contamination
│   ├── ragmetrics.py          # Eval metrics (faithfulness, relevancy, tool correctness)
│   ├── intent.py              # Dialogue acts, scope, session state
│   ├── research_task.py       # Durable web research (mode 3)
│   ├── patch_proposal.py      # Human-approved vault writes
│   ├── clock.py               # Local wall-clock facts
│   └── evidence_state.py      # Evidence lifecycle on ask results
├── ke/studio/wiki/
│   └── corpus.py              # BM25 retrieval, page metadata, citations
├── ke/studio/http/
│   └── ask.py                 # POST /api/ask, /api/ask/stream
├── portal/
│   ├── chat-orb-mount.js      # Consumer orb + citation freshness chips
│   └── portal.css             # Freshness badge styles
└── tests/
    ├── test_freshness_pipeline.py
    └── test_wiki_retrieval.py # Freshness-intent cases w6l–w6o
```

Planned modules (not yet extracted):

```text
ke/studio/temporal/           # Universal temporal parser, compiler, receipts
ke/studio/evidence/           # Validity, supersession graph, ranker
ke/studio/policy/             # OPA/Cedar integration
ke/studio/validation/         # Schemas, solvers
ke/studio/workflows/          # Durable orchestration
ke/studio/audit/              # Event schema, tracing
```

Platform shared assets:

```text
webtools-ui/
├── docs/CHAT_INTELLIGENCE.md   # This PRD
├── docs/KNOWLEDGE_CHAT.md      # Corpus chat backend PRD
├── js/chat-orb.js              # Orb shell contract
└── js/agent-gateway.js         # Cross-consumer /api/ask proxy
```

---

## Appendix B: Example infrastructure-planning flow

**User request:** "Can we add eight GPUs to Cluster A next Tuesday for a 70B-model service without disrupting current tenants?"

1. The **interaction layer** authenticates the requester and resolves Cluster A to a canonical cluster ID.
2. The **temporal layer** resolves next Tuesday using the workspace timezone and calendar convention.
3. The **retrieval layer** obtains live inventory, reservations, tenant allocations, maintenance windows, and support constraints.
4. The **graph layer** finds topology, GPU-to-NIC affinity, fabric rails, rack power, cooling, and failure domains.
5. The **policy layer** checks entitlement, change-management requirements, blackout periods, and tenant isolation policy.
6. The **constraint layer** validates HBM, GPU count, placement, network capacity, rack power, and service SLO requirements.
7. The **LLM** explains a verified result, assumptions, constraints, and alternatives with citations/receipts.
8. If a reservation or change is requested, a **durable workflow** creates a plan and pauses for bound human approval before execution.

The LLM makes the interaction understandable. The surrounding intelligence layers make the conclusion
trustworthy, repeatable, and safe.
