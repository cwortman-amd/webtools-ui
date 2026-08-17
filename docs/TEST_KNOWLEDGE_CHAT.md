---
title: Universal Knowledge Chat — Test Program
aliases: [TEST_KNOWLEDGE_CHAT, Knowledge Chat Test Plan, UKC Test Plan]
domain: platform
tags: [prd, testing, chat, retrieval, okf, security, citations, platform-service]
summary: Platform ownership pointer for the Universal Knowledge Chat acceptance suite. Working copy with full case catalogs lives in each consumer as docs/TEST_CHAT.md; requirement IDs stay stable.
status: proposed
audience: [qa, security, product, architecture, platform, ai-ml]
updated: 2026-08-15
related:
  - "[[KNOWLEDGE_CHAT]]"
  - "[[CHAT_ARCHITECTURE]]"
  - "templates/CHAT.skeleton.md"
  - "[[TESTING_STRATEGY]]"
---

<!-- markdownlint-disable MD025 -->

# Universal Knowledge Chat — Test Program

**Status:** Proposed, 2026-08-15. Applies to every consumer implementing
[`KNOWLEDGE_CHAT.md`](./KNOWLEDGE_CHAT.md).

This file records **platform ownership** of the Universal Knowledge Chat test program. The full
objectives, gates, fixtures, case catalogs (`SRC-*` … `AUD-*`), security plan, and acceptance
checklist live in each consumer’s working copy:

| Consumer | Working copy |
| --- | --- |
| Knowledge Exchange | `docs/TEST_CHAT.md` (via repo root; also reachable as sibling of this `shared/` mount) |

### Rules

1. **PRD binding.** Requirements under test come from [`KNOWLEDGE_CHAT.md`](./KNOWLEDGE_CHAT.md).
   Orb UX / slash / voice stay in each consumer’s `CHAT.md` and may add local `ORB-*` IDs.
2. **Do not fork IDs.** Keep `SRC-*`, `OKF-*`, `SEC-*`, … stable. Consumers add prefixed IDs only
   for surface-specific glue.
3. **Phased gates.** Consumers must document which suites are *active* for the current release train
   versus *N/A until* a `KNOWLEDGE_CHAT` phase lands.
4. **Promotion.** When the platform corpus chat service is extracted, move the full suite text into
   this file and leave consumer `TEST_CHAT.md` as the phase map + local `ORB-*` cases.

### Minimum consumer TEST_CHAT contents

- Link to this pointer and to `KNOWLEDGE_CHAT.md`
- Phased applicability table (shipped vs proposed)
- Local commands for CI (`pytest`, chat-review, orb smoke)
- Full Universal suite (or an include/copy of the stable ID catalogs)
- Local `ORB-*` / boundary cases for the mounted orb

Knowledge Exchange also maintains [[CHAT_ARCHITECTURE]] (evaluation synthesis and Pareto
bake-off). That file is **not** a fork of this test program.
