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
| **L1 Browser** | `js/agent-bridge.js` | Live browser tab open |
| **L2 HTTP** | `POST /mcp` on product API | curl, Agent Gateway, remote agents |
| **L3 Stdio** | MCP bridge in `plugin.manifest.json` | Cursor `.cursor/mcp.json`, Claude Desktop |

**Headless agents should prefer L3 stdio or L2 HTTP.** Use L1 only when mutating browser-only state (e.g. DC Planner worksheet).

## Authoring new skills

Template: [`docs/templates/TOOL_SKILL.skeleton.md`](templates/TOOL_SKILL.skeleton.md)

Canonical consumer agent architecture: [`docs/templates/AGENT.skeleton.md`](templates/AGENT.skeleton.md)
