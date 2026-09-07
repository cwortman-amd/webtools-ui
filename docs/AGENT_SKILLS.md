# Agent skills — AMD Instinct webtools

Each consumer ships a **Cursor project skill** at `.cursor/skills/<tool-id>/SKILL.md`. The skill teaches a local AI agent how to **operate the tool without opening the browser GUI**, while documenting **connected tools** in the ecosystem.

## Install skills (for humans)

Skills are project-scoped — open the consumer repo (or `~/workspace` with all siblings) in Cursor. Skills under `.cursor/skills/` load automatically for that workspace.

To use a tool skill from chat, name it explicitly (skills default to `disable-model-invocation: true`):

> Use the **llm-benchmark** skill to queue a preset sweep on the local API.

## One-line tool install (for agents)

Before operating a tool, bootstrap the repo + **webtools-ui** sibling:

```bash
curl -fsSL https://curt.wortman.ai/tools/install-<tool-id>.sh | bash
```

## Skill map

| Tool | Skill path | Headless strength |
| :--- | :--- | :--- |
| Ecosystem router | `webtools-ui/.cursor/skills/webtools-ecosystem/SKILL.md` | Pick the right tool |
| **Suite install (all 6 tools)** | `webtools-ui/.cursor/skills/webtools-suite-install/SKILL.md` | Clone + bootstrap full workspace |
| Platform | `webtools-ui/.cursor/skills/webtools-platform/SKILL.md` | CI / validation only |
| Adversarial / `/test` | `<repo>/.cursor/skills/adversarial-documentation-driven-testing/SKILL.md` | Doc→impl→test preflight (every suite repo) |
| LLM Benchmark | `llm-benchmark/.cursor/skills/llm-benchmark/SKILL.md` | REST queue + MCP + sweeps |
| DC Planner | `dc-planner/.cursor/skills/dc-planner/SKILL.md` | Read catalogs; mutations need browser |
| Cluster Manager | `cluster-manager/.cursor/skills/cluster-manager/SKILL.md` | REST jobs + MCP stdio + Ansible |
| Demo Portal | `demo-portal/.cursor/skills/demo-portal/SKILL.md` | Manifest validate + MCP list |
| Knowledge Exchange | `knowledge-exchange/.cursor/skills/knowledge-exchange/SKILL.md` | `ke` CLI + ke-studio MCP |
| Slide Presenter | `slide-presenter/.cursor/skills/slide-presenter/SKILL.md` | Sidecar API + MCP |

Knowledge Exchange also has **domain skills** under `knowledge-exchange/agentskills/` (deck authoring, FAQ research, etc.). Use the top-level **knowledge-exchange** skill for portal/CLI/MCP; use domain skills for curriculum pipelines.

## Three agent layers (all dashboards)

| Layer | Mechanism | When |
| :--- | :--- | :--- |
| **L1 Browser** | Consumer `js/agent-bridge.js` | Live browser tab open |
| **L2 HTTP** | `POST /mcp` on product API | curl, Agent Gateway, remote agents |
| **L3 Stdio** | MCP bridge in `plugin.manifest.json` | Cursor `.cursor/mcp.json`, Claude Desktop |

**Headless agents should prefer L3 stdio or L2 HTTP.** Use L1 only when mutating browser-only state (e.g. DC Planner worksheet).

## Harmonized agent knowledge base

All webtools plugins share one **read-only knowledge plane** through `AgentGateway`:

| Layer | File | Role |
| :--- | :--- | :--- |
| Defaults | [`data/agent-knowledge-defaults.json`](../data/agent-knowledge-defaults.json) | Shared corpora + KE hub URL |
| Index manifest | [`data/llm-wiki-index-manifest.json`](../data/llm-wiki-index-manifest.json) | **User-editable** GitHub repos + site URLs to index |
| Registry | [`data/knowledge-registry.json`](../data/knowledge-registry.json) | Corpus transport (owner, HTTP paths) |
| Hub | Knowledge Exchange `ke serve` | Curriculum wiki + AMD Git docs index ingest |

**Every dashboard** registers `ke-curriculum`, `amd-rocm-docs`, `amd-instinct-docs`, `amd-rocm-blogs`, plus its product corpus. Siblings set `keHubUrl` / `keAskUrl` to `http://127.0.0.1:8765` (override with `WT_KE_HUB_URL`). Only Knowledge Exchange runs `make amd-docs-ingest`.

Validated by `scripts/check_plugin_manifests.py` (agent harmonization rules).

## Agent transport matrix (all consumers)

Canonical registry: [`data/knowledge-registry.json`](../data/knowledge-registry.json). MCP wiring is validated by `scripts/check_mcp_registration.py`.

| Consumer | L1 browser (`js/agent-bridge.js`) | L2 HTTP `/mcp` | L3 stdio entry | KE `/api/ask` | Notes |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **cluster-manager** | yes | yes | `scripts/core/mcp_server.py` | via corpora | CM ops server is the canonical **ops** MCP (not the shared `mcp_stdio_bridge.py` template) |
| **dc-planner** | yes | yes | `scripts/mcp_stdio_bridge.py` | via corpora | Browser mutations for worksheet state |
| **llm-benchmark** | yes | yes | `scripts/mcp_stdio_bridge.py` | yes (`keAskUrl`) | Queue + sweep API alongside MCP |
| **demo-portal** | no | no | `scripts/mcp_stdio_bridge.py` | via corpora | Hub uses extension-pack orb mount; catalog JSON is local |
| **knowledge-exchange** | no | no | `scripts/mcp_stdio_bridge.py` | yes (server) | Portal agent service disabled; KE is the ask provider |
| **slide-presenter** | yes | yes | `scripts/mcp_stdio_bridge.py` | via corpora | Sidecar API is the primary runtime; bridge covers shell tabs |

### MCP stdio naming

Most consumers ship **`scripts/mcp_stdio_bridge.py`** — a thin JSON-RPC bridge over product REST/MCP handlers. **Cluster Manager** is the exception: **`scripts/core/mcp_server.py`** embeds Ansible/cluster ops tools and is referenced explicitly in `plugin.manifest.json`. Agents must not assume a single stdio filename across the suite.

### Browser bridge contract

When `registrations.mcp.browserBridge` is set, load the script in `pages/index.html` **before** `js/plugin-mount.js`. The bridge exposes `window.agentBridge.call(method, params)` and a JSON-RPC `postMessage` listener. Demo Portal and Knowledge Exchange intentionally omit L1 — use stdio/HTTP or (for KE) `ke` CLI + ke-studio MCP instead.

## Authoring new skills

Template: [`docs/templates/TOOL_SKILL.skeleton.md`](templates/TOOL_SKILL.skeleton.md)

Canonical consumer agent architecture: [`docs/templates/AGENT.skeleton.md`](templates/AGENT.skeleton.md)
