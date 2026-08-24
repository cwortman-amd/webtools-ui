---
type: Implementation Plan
title: Harmonization Implementation Plan
description: This document turns the **modular component infrastructure** (ExtensionHost, MCP contract, unified bootstrap, CI parity) and **federated AI agent** (Agent Gateway + KE knowledge plane) recommendations into **parallel workstreams**. Each task lists dependencies, deliverables, and
aliases:
- Implementation Plan
- Parallel Workstreams
- P11+ Roadmap
status: active
owner: platform
updated: 2026-08-22
related:
- '[[PLATFORM_MODEL]]'
- '[[CONTRIBUTIONS]]'
- '[[PLUGIN_CONTRACT]]'
- '[[KNOWLEDGE_CHAT]]'
- '[[CROSS_CONSUMER_TESTING]]'
---
<!-- markdownlint-disable MD025 -->
# Harmonization Implementation Plan

This document turns the **modular component infrastructure** (ExtensionHost, MCP contract,
unified bootstrap, CI parity) and **federated AI agent** (Agent Gateway + KE knowledge plane)
recommendations into **parallel workstreams**. Each task lists dependencies, deliverables, and
acceptance gates so multiple agents or teams can land work concurrently without merge conflicts.

**Audience:** platform maintainers, consumer-repo owners, CI operators.

**Scope:** six application plugins — `llm-benchmark`, `dc-planner`, `cluster-manager`,
`demo-portal`, `knowledge-exchange`, `slide-presenter` — plus `webtools-ui` (T1 platform).

**Non-goals (this plan):**

- Forcing `Shell.init()` on cluster-manager or dc-planner (Pattern B/C stay)
- Merging chat transcripts across products (see KE `22-agent-boundaries.md`)
- Replacing dc-planner's dual-orb hybrid

---

## Harmonization status (2026-08-22)

**Waves W0–W7 are complete.** All six application plugins use the shared platform mount,
MCP manifest contract, federated Agent Gateway (learn + act), and cross-consumer CI gates.

| Layer | State |
| --- | --- |
| ExtensionHost + bootstrap | ✓ Platform canonical; consumers on `PluginBootstrap.bootstrapFromManifest()` |
| MCP L1/L2/L3 | ✓ Declared in manifests; `check_mcp_registration.py --strict` |
| Agent Gateway | ✓ `route()` learn/hybrid/act; `WebtoolsMcp.callTool()` + extension handlers |
| Handoff packets | ✓ `agent-handoff.js` + `ke-handoff.js` → KE `portal/agent-context.js` |
| CI pyramid | ✓ `make ci` + L1b extension sidebars + registry `--strict` + cross-consumer shell |
| Extension pilots | ✓ LB `im-report`, CM `cm-docs`, DC `dc-expert` (MCP metadata + pilot handlers) |

**Operational close-out** (manual, not gated in CI):

1. Live KE smoke — run Knowledge Exchange; set `KE_ASK_URL`; verify learn intent in llm-benchmark orb.
2. Handoff round-trip — LB agent → handoff card → KE banner with decoded `agent_ctx`.
3. Full pyramid — `make enhanced-validation` (no `--skip-slow`).

**Optional backlog:** P15 convergence items only (see §P15).

---

## How to read this plan

| Symbol | Meaning |
| --- | --- |
| **WS-*** | Workstream — can be owned by a different person/agent |
| **P11–P15** | Modular infrastructure phases (platform model extensions) |
| **AG-*** | Agent Gateway phases (federated orchestrator) |
| **Blocker** | Must complete before dependent tasks start |
| **Gate** | CI check that proves the task is done |

Tasks within the same **wave** and **workstream column** with no mutual dependency may run
**fully in parallel**. Tasks in different workstreams that touch the same file should coordinate
via the **file ownership** table in §File ownership.

---

## Target end state

```text
webtools-ui (T1)
├── extension-host.js          ← canonical ExtensionHost (from demo-portal + slide-presenter)
├── plugin-bootstrap.js        ← manifest-driven mount (replaces split mount adapters)
├── plugin-services.js         ← MCP + Agent Gateway manifest bootstrap
├── agent-gateway.js           ← federated routing: KE RAG + product MCP tools (learn/act/hybrid)
├── agent-handoff.js           ← AG-5 structured context packets (?agent_ctx=)
├── ke-handoff.js              ← reverse handoff cards on dashboard agents
├── knowledge-registry.json    ← corpus IDs → endpoints (seed + consumer extensions)
├── webtools_mcp/host.py       ← stdio + HTTP proxy (existing; extended)
├── check_{extensions,mcp,agent}.py
└── require_shared_mount.sh    ← CI fail-fast when consumer shared/ unresolved

Each consumer (T2)
├── plugin.manifest.json       ← contributes + registrations (extensions, mcp, knowledge, agent)
├── extensions/*/              ← optional VS Code-style packs (code + tests/ travel together)
├── data/shell-modules.json    ← compiled snapshot / hooksOnly registry
└── js/plugin-mount.js         ← thin: bootstrapFromManifest() only
```

---

## Workstreams (parallel lanes)

| ID | Lane | Primary repo | Can start |
| --- | --- | --- | --- |
| **WS-0** | Platform schemas & CI gates | webtools-ui | Immediately |
| **WS-1** | ExtensionHost promotion | webtools-ui → consumers | After WS-0 schemas |
| **WS-2** | MCP manifest contract | webtools-ui → consumers | After WS-0 schemas |
| **WS-3** | Unified mount bootstrap | webtools-ui → consumers | After WS-1 + WS-2 APIs stable |
| **WS-4** | Cross-consumer CI parity | webtools-ui + all 6 | Partially parallel with WS-0 |
| **WS-5** | Agent Gateway & federation | webtools-ui + KE + dashboards | After WS-2 MCP shape (AG-1) |

```text
         WS-0 ─────────────────────────────────────────────┐
          │                                                  │
    ┌─────┴─────┬─────────────┬──────────────┐              │
    ▼           ▼             ▼              ▼              ▼
  WS-1       WS-2          WS-4           WS-5 ──► AG-2..5
    │           │             │              │
    └─────┬─────┘             │              │
          ▼                   │              │
        WS-3 ◄────────────────┘              │
          │                                  │
          └──────────────► WS-4 (final gate) ┘
```

---

## Wave schedule

| Wave | Calendar intent | Parallel tracks | Exit gate |
| --- | --- | --- | --- |
| **W0** | Foundation | WS-0 entirely; WS-4 design | Schemas merge; `make ci` green |
| **W1** | Platform modules land | WS-1 platform, WS-2 platform, WS-5 AG-0 design | New JS/Python in webtools-ui |
| **W2** | Consumer adoption (batch 1) | WS-1 ×3, WS-2 ×3, WS-4 ×2, WS-5 AG-1 | 3 consumers on ExtensionHost; 3 on MCP manifest |
| **W3** | Consumer adoption (batch 2) | WS-1 ×3, WS-2 ×3, WS-3 platform, WS-5 AG-2 | Remaining consumers migrated |
| **W4** | Bootstrap + agent | WS-3 all consumers, WS-5 AG-3..4 | Single mount adapter per repo |
| **W5** | Hardening | WS-4 full matrix, WS-5 AG-5, doc sync | `make enhanced-validation` all 6 plugins |
| **W6** | CI + handoff + extension depth | Bundles A/B/C | Registry strict CI, `agent_ctx`, pilot ExtensionHost hooks |
| **W7** | Production close-out | Bundles D/E/F | AG-3 `act()`, KE receive banner, L1b extension sidebars, workflow mounts |

Waves are **logical** — teams may overlap W1–W3 if task dependencies are satisfied.

---

## WS-0 — Platform schemas & CI gates

**Owner:** webtools-ui · **Blocker for:** WS-1, WS-2, WS-5

### Tasks (all parallel within WS-0)

| ID | Task | Deliverable | Gate |
| --- | --- | --- | --- |
| **0-T1** | Author `schemas/extension.schema.json` | JSON Schema for `extensions/*/extension.json` | Schema validates demo-portal + slide-presenter samples |
| **0-T2** | Extend `plugin.manifest.schema.json` | `registrations.extensions`, `registrations.mcp`, `registrations.knowledge`, `contributes.services.agent` | `check_plugin_manifests.py --strict` accepts new fields |
| **0-T3** | Author `data/knowledge-registry.seed.json` | Seed corpus entries: `ke-curriculum`, per-product stubs | Valid JSON; documented in this file §Knowledge registry |
| **0-T4** | Stub `scripts/check_extensions.py` | Validates extension packs ↔ `data/extensions.json` | Exits 0 on slide-presenter; `--help` documents flags |
| **0-T5** | Stub `scripts/check_mcp_registration.py` | Manifest ↔ bridge script ↔ tool list | Exits 0 on slide-presenter |
| **0-T6** | Stub `scripts/check_agent_gateway.py` | Manifest agent flags ↔ `agent-gateway.js` load | Exits 0 when feature disabled (no-op pass) |
| **0-T7** | Update `enhanced_validation.sh` | Wire 0-T4..T6 as L1c (optional skip until consumers ready) | Script runs without regression |

**Acceptance:** `make ci` green; new checkers exist and document `--repo` flag.

---

## P11 / WS-1 — ExtensionHost (modular sidebar packs)

**Goal:** One canonical `ExtensionHost` in webtools-ui; consumers delete local copies.

### P11-W1 — Platform (sequential: T1 → T2 → T3)

| ID | Task | Depends | Deliverable |
| --- | --- | --- | --- |
| **1-T1** | Merge `demo-portal/js/extension-host.js` + `slide-presenter/js/extension-host.js` | 0-T1 | `js/extension-host.js` |
| **1-T2** | Add `ExtensionHost.toShellModule()`, `boot()`, `afterShellModulesRender()` API docs | 1-T1 | `docs/SHELL_MODULES.md` § Extension packs |
| **1-T3** | Export in vendor manifest + `SDK.md` | 1-T1 | `scripts/vendor-manifest.json` regen |
| **1-T4** | Implement `check_extensions.py` (full) | 0-T4, 1-T1 | L1c gate enforced |

### P11-W2 — Consumer migrations (**parallel across repos**)

Each row is independent once **1-T1** merges.

| ID | Consumer | Tasks | Notes |
| --- | --- | --- | --- |
| **1-C-DP** | demo-portal | Delete local host; import `shared/js/extension-host.js`; verify 4 packs | Reference hub adopter |
| **1-C-SP** | slide-presenter | Delete local host; keep `shell-modules.json` sync test | MCP tools in extensions stay |
| **1-C-KE** | knowledge-exchange | Replace hardcoded extension scripts with `ExtensionHost.init()`; migrate `ke-lms-browse` | Largest script-list reduction |
| **1-C-DM** | demo-portal only | `check_extensions.py --repo demo-portal` in `make ci` | Already partially done in 1-C-DP |

### P11-W3 — Dashboard extension pilots (**parallel**)

Optional proof packs; do not block other workstreams.

| ID | Consumer | Task |
| --- | --- | --- |
| **1-C-LB** | llm-benchmark | Extract one tab group to `extensions/im-report/` |
| **1-C-CM** | cluster-manager | Extract `docs` bottom-nav pack to `extensions/cm-docs/` |
| **1-C-DC** | dc-planner | Extract expert tab group stub `extensions/dc-expert/` |

**Gate:** `check_extensions.py --repo <consumer>` passes; Playwright smoke for that consumer unchanged.

---

## P12 / WS-2 — MCP manifest contract

**Goal:** Declare MCP in manifest; three layers documented and validated.

### MCP three-layer model (all consumers)

| Layer | Surface | Declared in manifest |
| --- | --- | --- |
| **L1 Browser** | Consumer `js/agent-bridge.js` (not shipped in this repo) | `registrations.mcp.browserBridge` |
| **L2 HTTP** | `POST /mcp` on product API | `registrations.mcp.http` |
| **L3 Stdio** | `scripts/mcp_stdio_bridge.py` | `registrations.mcp.stdio` |
| **Tools** | JSON Schema list | `registrations.mcp.toolManifest` or extension `contributes.mcp.tools` |

### P12-W1 — Platform (**parallel** after 0-T2)

| ID | Task | Deliverable |
| --- | --- | --- |
| **2-T1** | Document three-layer model in `CONTRIBUTIONS.md` § `services.mcp` | Doc section |
| **2-T2** | Add `data/mcp-tool-manifest.schema.json` | Shared tool schema |
| **2-T3** | Extend `webtools_mcp/host.py` — `register_from_manifest()` helper | Python API |
| **2-T4** | Implement `check_mcp_registration.py` (full) | CI gate |

### P12-W2 — Consumer manifest adoption (**parallel**)

| ID | Consumer | Layers to declare | Priority |
| --- | --- | --- | --- |
| **2-C-SP** | slide-presenter | L1+L2+L3 + extension tools | **First** — already wired |
| **2-C-LB** | llm-benchmark | L1+L2+L3 (`agent_mcp.py`, `mcp_stdio_bridge.py`) | High |
| **2-C-CM** | cluster-manager | L1+L2+L3; align `agent-bridge` tab list with shell-modules | High |
| **2-C-DC** | dc-planner | L1 only initially; L2 `POST /mcp` backlog | Medium |
| **2-C-KE** | knowledge-exchange | Map `tools/registry.json` → manifest slot | Medium |
| **2-C-DP** | demo-portal | Optional hub aggregator stub | Low |
| **2-C-SP2** | slide-presenter | Flip `status: draft` → `active` after gates | After 2-C-SP + WS-4 |

**Gate:** `check_mcp_registration.py --repo <consumer> --strict`

---

## P13 / WS-3 — Unified mount bootstrap

**Goal:** One mount script per consumer; platform loads manifest registrations.

**Blocker:** P11 + P12 API shapes stable (does not require all consumers migrated).

### P13-W1 — Platform

| ID | Task | Deliverable |
| --- | --- | --- |
| **3-T1** | Author `js/plugin-bootstrap.js` with `WebtoolsPlatform.bootstrapFromManifest(url)` | Loads extensions (`ExtensionHost`), MCP + Agent Gateway (`loadFromManifest`), and deferred slash/voice scripts from manifest paths. Shell module init remains `Shell` / `ShellModules` in the consumer. |
| **3-T2** | Wire `activationEvents` from manifest (`onStartup`, `onTab:*`) | `platform.js` emits events and binds handlers (`WebtoolsPlatform.register`); bootstrap does not duplicate that wiring. |
| **3-T3** | Deprecation shim: log once if `chat-orb-mount.js` loaded separately | Console warning + docs |

### P13-W2 — Consumer collapse (**parallel per repo**)

| ID | Pattern | Task |
| --- | --- | --- |
| **3-C-*` | A (`Shell.init`) | llm-benchmark, demo-portal, KE, slide-presenter: merge `plugin-mount.js` + `chat-orb-mount.js` |
| **3-C-CM** | B (custom controller) | Keep `shell-tab-controller.js`; mount only registers services |
| **3-C-DC** | C (in-page) | Keep `setActiveTab()`; mount only registers services |

**Gate:** Each consumer has exactly one mount entry in manifest; `check_shell_modules.py` passes.

---

## P14 / WS-4 — Cross-consumer CI parity

**Goal:** All six plugins in the same validation pyramid.

### P14 tasks (**mostly parallel**)

| ID | Task | Owner | Depends |
| --- | --- | --- | --- |
| **4-T1** | Add `demo-portal` + `slide-presenter` to `tests/contracts/consumer-matrix.json` | webtools-ui | ✓ Done |
| **4-T2** | Extend `check_shell_modules.py` for extension-sourced sidebars | webtools-ui | ✓ Done (W7) |
| **4-T3** | `sync_plugin_registry_snapshot.py` in CI `--strict` | webtools-ui | ✓ Done (W6) |
| **4-T4** | Require sibling `webtools-ui` checkout in all 6 workflows (no silent skip) | each consumer | ✓ Done (W7 — public clone + `require_shared_mount.sh`) |
| **4-T5** | Nightly `cross-consumer-shell.mjs` covers 6 entries | webtools-ui | ✓ Done |
| **4-T6** | iPhone matrix row per new consumer | webtools-ui | ✓ Done |

**Consumer-local parallel work:**

| ID | Repo | Task |
| --- | --- | --- |
| **4-C-DP** | demo-portal | Fix registry/doc drift (`catalog-topnav` vs `sidebar-iframe`) | ✓ Done (W7 — registry `sidebar-iframe`) |
| **4-C-SP** | slide-presenter | `make shared-check check-plugins` mandatory in CI | ✓ Done |
| **4-C-KE** | knowledge-exchange | Already in matrix — verify L1b shell-modules + extensions | ✓ Done; `panelChecks: false` in matrix |

**Gate:** `make enhanced-validation` reports 6/6 plugins at L1+; nightly smoke green.

---

## P15 — Optional convergence (parallel, non-blocking)

Pick up only when a consumer hits maintenance pain.

| ID | Task | Consumer | Trigger |
| --- | --- | --- | --- |
| **5-O-CM** | Move iframe prewarm into `ShellModules.onBeforeActivate` | cluster-manager | Controller code churn |
| **5-O-DC** | Ship `POST /mcp` backend | dc-planner | External agent demand |
| **5-O-DP** | Hub catalog-topnav layout OR update platform docs | demo-portal | UX decision |
| **5-O-KE** | Extract Create tab → `extensions/ke-create/` | knowledge-exchange | Create tab bundle size |
| **5-O-P10** | Cross-plugin `import` in shell-modules | platform | Shared tab across repos |

---

## WS-5 / AG — Federated Agent Gateway

**Goal:** One orb UX; orchestrator routes to **KE knowledge plane** + **active product MCP tools**.
Does **not** merge transcripts (per `knowledge-exchange/docs/meta/22-agent-boundaries.md`).

### Architecture reference

```text
ChatOrb (T1)
    │ onSend(text)
    ▼
AgentGateway.route({ productId, tabId, pathname, text })
    ├── classify(intent) → learn | act | hybrid
    ├── retrieve(corpora[]) → citations required
    ├── act(tools[]) → scoped to active product + user mode
    └── handoff(target) → .ke-orb-handoff card + optional context packet
```

### AG phases

| Phase | ID | Depends | Summary |
| --- | --- | --- | --- |
| **AG-0** | Design | — | ADR in this doc §Agent policy; no code |
| **AG-1** | Platform core | 0-T2, 2-T1 | `agent-gateway.js`, `knowledge-registry.json` |
| **AG-2** | KE integration | AG-1 | Proxy `/api/ask` + MCP `portal_catalog_query` from gateway |
| **AG-3** | Product tool registration | AG-1, P12 partial | Federated `tools/list` from active MCP map |
| **AG-4** | Consumer adoption | AG-2, AG-3 | Opt-in `contributes.services.agent.enabled` |
| **AG-5** | Handoff packets | AG-4 | Structured context on cross-app navigation |

### AG-0 — Policy (parallel with W0)

Document and lock:

| Rule | Behavior |
| --- | --- |
| **Retrieve** | KE curriculum default for learn/hybrid; citations mandatory |
| **Act** | Only active product's MCP tools; destructive ops require expert mode |
| **Memory** | Per-product `storagePrefix`; no shared localStorage |
| **Handoff** | Explicit card; optional `?agent_ctx=` base64url JSON packet (size cap 4 KB) |
| **Offline** | Extractive KE + local MCP only; graceful degradation message |

### AG-1 — Platform tasks (**sequential T1→T3**)

| ID | Task | Deliverable | Gate |
| --- | --- | --- | --- |
| **AG-1-T1** | `js/agent-gateway.js` — `route()`, `classify()`, `retrieve()`, `act()` stubs | Module + unit tests in `tests/lib/agent-gateway.test.mjs` | Node tests pass |
| **AG-1-T2** | `data/knowledge-registry.json` + loader | Seed + merge consumer manifest `registrations.knowledge` | Schema valid |
| **AG-1-T3** | `ChatOrb.mount({ agentGateway: true })` hook | Orb calls gateway before default handler | llm-benchmark pilot |

### AG-2 — KE plane (**parallel with AG-1-T2** once AG-1-T1 stub exists)

| ID | Task | Owner | Deliverable |
| --- | --- | --- | --- |
| **AG-2-T1** | CORS-safe ask proxy contract doc | KE | `docs/MCP_CROSS_APP.md` § browser gateway |
| **AG-2-T2** | `portal_catalog_query` client in gateway | webtools-ui | No KE repo change required |
| **AG-2-T3** | Optional same-origin proxy route on KE studio | KE | `/api/ask/proxy` for static deployments |

### AG-3 — Product tools (**parallel per dashboard**)

| ID | Consumer | Task |
| --- | --- | --- |
| **AG-3-LB** | llm-benchmark | Register MCP map with gateway; pilot hybrid QA |
| **AG-3-CM** | cluster-manager | Register map; policy: block destructive from learn-only intent |
| **AG-3-DC** | dc-planner | Bridge-only; no HTTP MCP until 5-O-DC |
| **AG-3-DP** | demo-portal | Catalog-only tools via registry |
| **AG-3-SP** | slide-presenter | Extension MCP tools in federated list |
| **AG-3-KE** | knowledge-exchange | Gateway default = native `/api/ask`; no double-hop |

### AG-4 — Adoption wave (**parallel**)

Enable in manifest:

```json
{
  "contributes": {
    "services": {
      "agent": {
        "enabled": true,
        "gateway": "../shared/js/agent-gateway.js",
        "corpora": ["ke-curriculum", "local"]
      }
    }
  }
}
```

Rollout order (recommended): **llm-benchmark** → **cluster-manager** → **demo-portal** →
**slide-presenter** → **dc-planner** → **knowledge-exchange** (KE last — already has native agent).

### AG-5 — Handoff packets (**parallel**)

| ID | Task | Files |
| --- | --- | --- |
| **AG-5-T1** | `AgentHandoff.encode/decode` | `js/agent-handoff.js` | ✓ Done (W6) |
| **AG-5-T2** | Wire `KeHandoff.install` to attach packet | `js/ke-handoff.js` | ✓ Done (W6) |
| **AG-5-T3** | Per-consumer `data/ke-handoffs.json` | CM, DC, LB | ✓ Done |
| **AG-5-T4** | KE receive banner | `knowledge-exchange/portal/agent-context.js` | ✓ Done (W7) |

**Gate:** Manual test: ask in LB → handoff card → KE opens with cited context summary.

---

## Knowledge registry (seed corpora)

`data/knowledge-registry.seed.json` entries (consumers add `registrations.knowledge[]` ids):

| Corpus ID | Source | Transport | Owner repo |
| --- | --- | --- | --- |
| `ke-curriculum` | Wiki + portal manifest | MCP `portal_catalog_query`, HTTP `/api/ask` | knowledge-exchange |
| `ke-portal-manifest` | `portal/manifest.json` | MCP resource `ke://portal/manifest` | knowledge-exchange |
| `lb-docs` | Product docs + agent-map | MCP HTTP + browser bridge | llm-benchmark |
| `cm-ops` | Remediation catalog, fabric findings | MCP stdio/HTTP | cluster-manager |
| `dc-planner-domain` | Scenarios, TCO help | agent-bridge read_context | dc-planner |
| `demo-catalog` | `data/manifest.json` | Local JSON fetch | demo-portal |
| `slides-deck` | Active deck via sidecar | MCP `present.*` / `notes.*` | slide-presenter |

---

## File ownership (merge conflict avoidance)

| Path pattern | Owner WS | Consumers may |
| --- | --- | --- |
| `webtools-ui/js/extension-host.js` | WS-1 | — |
| `webtools-ui/js/plugin-bootstrap.js` | WS-3 | — |
| `webtools-ui/js/agent-gateway.js` | WS-5 | — |
| `webtools-ui/schemas/*` | WS-0 | — |
| `webtools-ui/scripts/check_*.py` | WS-0, WS-4 | — |
| `<consumer>/plugin.manifest.json` | consumer owner | extend contributes |
| `<consumer>/extensions/**` | WS-1 consumer | add packs |
| `<consumer>/js/plugin-mount.js` | WS-3 consumer | shrink only |
| `<consumer>/js/chat-orb-mount.js` | WS-3 consumer | delete after bootstrap |
| `<consumer>/data/shell-modules.json` | consumer owner | sync from extensions |
| `knowledge-exchange/ke/mcp/**` | WS-5 KE | add tools |
| `knowledge-exchange/docs/MCP_CROSS_APP.md` | WS-5 KE | extend |

---

## Consumer adoption matrix

Track per-repo status in PR descriptions; update this table at each wave exit.

| Consumer | P11 ExtHost | P12 MCP manifest | P13 Bootstrap | P14 CI matrix | AG Gateway |
| --- | --- | --- | --- | --- | --- |
| llm-benchmark | 1-C-LB ✓ | 2-C-LB ✓ | 3-C-* ✓ | ✓ | AG-3 ✓ |
| cluster-manager | 1-C-CM ✓ | 2-C-CM ✓ | 3-C-CM ✓ | ✓ | AG-3 ✓ |
| dc-planner | 1-C-DC ✓ | 2-C-DC ✓ | 3-C-DC ✓ | ✓ | AG-3 ✓ |
| demo-portal | 1-C-DP ✓ | 2-C-DP | 3-C-* ✓ | 4-C-DP ✓ | AG-3 |
| knowledge-exchange | 1-C-KE ✓ | 2-C-KE ✓ | 3-C-* ✓ | ✓ | native |
| slide-presenter | 1-C-SP ✓ | 2-C-SP ✓ | 3-C-* ✓ | 4-C-SP ✓ | AG-3 ✓ |

Legend: ✓ = done; blank = optional backlog; pilot handlers = MCP stubs until product APIs wired.

---

## CI gate ladder (per wave)

| Level | Command | Proves |
| --- | --- | --- |
| **L0** | `make ci` | Platform + plugin registry |
| **L1** | `make enhanced-validation-quick` | Shared mounts + manifests |
| **L1b** | `check_shell_modules.py --repo all` | Shell module wiring |
| **L1c** | `check_extensions.py` + `check_mcp_registration.py` | Modular packs + MCP |
| **L1d** | `check_agent_gateway.py` | Agent manifest ↔ script |
| **L2** | Consumer self-check / `test_offline.sh` | Product regressions |
| **L2c** | `cross-consumer-shell.mjs` + `iphone-ui.mjs` | Visual contract 6-wide |
| **L3** | Agent gateway unit tests | `tests/lib/agent-gateway*.test.mjs`, `agent-handoff.test.mjs`, `agent-context.test.mjs` |

Add targets to `Makefile`:

```makefile
check-extensions:
	python3 scripts/check_extensions.py --strict
check-mcp:
	python3 scripts/check_mcp_registration.py --strict
check-agent:
	python3 scripts/check_agent_gateway.py --strict
enhanced-validation: ci check-extensions check-mcp check-agent
	@bash scripts/enhanced_validation.sh
```

---

## Parallel execution examples

### Example A — Three agents, wave W1

| Agent | Assignment | No conflict because |
| --- | --- | --- |
| Agent 1 | 0-T1, 0-T2, 1-T1 | webtools-ui schemas + extension-host |
| Agent 2 | 2-T1, 2-T2, 2-T4 | webtools-ui MCP docs + checker |
| Agent 3 | AG-0, AG-1-T1 stub | webtools-ui agent-gateway stub |

### Example B — Six agents, wave W2

| Agent | Assignment |
| --- | --- |
| Agent 1 | 1-C-DP (demo-portal ExtensionHost) |
| Agent 2 | 1-C-SP (slide-presenter ExtensionHost) |
| Agent 3 | 1-C-KE (knowledge-exchange ExtensionHost) |
| Agent 4 | 2-C-LB (llm-benchmark MCP manifest) |
| Agent 5 | 2-C-CM (cluster-manager MCP manifest) |
| Agent 6 | 4-C-DP + 4-C-SP (CI matrix + workflow tokens) |

### Example C — Agent federation after MCP lands

| Agent | Assignment |
| --- | --- |
| Agent 1 | AG-1-T2 knowledge registry (webtools-ui) |
| Agent 2 | AG-2-T1..T3 (knowledge-exchange proxy docs/route) |
| Agent 3 | AG-3-LB (llm-benchmark pilot) |
| Agent 4 | AG-5-T3 lb `data/ke-handoffs.json` |

---

## Task checklist template (copy per PR)

```markdown
## Implementation task

- **Task ID:** e.g. 2-C-LB
- **Workstream:** WS-2
- **Wave:** W2
- **Repo(s):** llm-benchmark, webtools-ui (if checker)
- **Depends on:** 2-T4 merged
- **Deliverables:**
  - [ ] plugin.manifest.json registrations.mcp.*
  - [ ] check_mcp_registration.py --repo llm-benchmark
  - [ ] docs/AGENT.md § MCP manifest pointer
- **Out of scope:**
  - …
- **Verification:**
  - [ ] Local gate commands
  - [ ] No changes to webtools-ui/js/extension-host.js (file ownership)
```

---

## Related documents

| Doc | Role |
| --- | --- |
| [`PLATFORM_MODEL.md`](PLATFORM_MODEL.md) | Four-tier architecture (P1–P10 roadmap) |
| [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) | Contribution slots + activation events |
| [`PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md) | Manifest required fields |
| [`KNOWLEDGE_CHAT.md`](KNOWLEDGE_CHAT.md) | Corpus-backed Q&A contract (agent retrieve layer) |
| [`CROSS_CONSUMER_TESTING.md`](CROSS_CONSUMER_TESTING.md) | L0–L3 validation pyramid |
| [`PLAN.md`](PLAN.md) | Historical harmonization Phases 0–9 |
| `knowledge-exchange/docs/meta/22-agent-boundaries.md` | Agent isolation + handoff rules |
| `knowledge-exchange/docs/MCP_CROSS_APP.md` | KE cross-app MCP integration |

---

## Revision log

| Date | Change |
| --- | --- |
| 2026-08-22 | **OKF v0.2 doc headers:** all platform + consumer `docs/**/*.md` carry `type`/`title`/`description`; see [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) § OKF headers and `scripts/okf_doc_headers.py` |
| 2026-08-22 | **W7 complete:** AG-3 `act()`, KE `agent-context.js`, L1b extension sidebars, workflow shared-mount gates, pilot MCP handlers |
| 2026-08-22 | **W6 complete:** `agent-handoff.js`, registry CI `--strict`, ExtensionHost pilot hooks (LB/CM/DC) |
| 2026-08-22 | **W5 complete:** Agent Gateway in ChatOrb, bootstrap chat-mount, cross-consumer matrix |
| 2026-08-22 | Initial plan: P11–P15 modular infrastructure + AG-0..5 federated agent; parallel workstreams WS-0..5 |
