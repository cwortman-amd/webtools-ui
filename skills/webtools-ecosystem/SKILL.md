---
name: webtools-ecosystem
description: >-
  Routes agent work to the correct AMD Instinct webtool (llm-benchmark, dc-planner,
  cluster-manager, demo-portal, knowledge-exchange, slide-presenter). Use when the
  user names a capability but not a specific tool, or when coordinating cross-tool
  workflows on a local node without browser GUIs.
---

# Webtools ecosystem — agent router

## Pick the right tool

| User intent | Tool | Skill |
| :--- | :--- | :--- |
| GPU benchmark sweeps, queue, InferenceX | **llm-benchmark** | `.cursor/skills/llm-benchmark/SKILL.md` |
| DC/GPU BOM, TCO, rack, workload sizing | **dc-planner** | `.cursor/skills/dc-planner/SKILL.md` |
| Cluster install, fabric, remediation, Ansible | **cluster-manager** | `.cursor/skills/cluster-manager/SKILL.md` |
| Demo catalog, readiness, launch regression | **demo-portal** | `.cursor/skills/demo-portal/SKILL.md` |
| Training modules, wiki ask, deck pipeline | **knowledge-exchange** | `.cursor/skills/knowledge-exchange/SKILL.md` |
| Slide search, virtual decks, present mode | **slide-presenter** | `.cursor/skills/slide-presenter/SKILL.md` |
| Cross-repo CI, manifests, harmonization | **webtools-ui** | `.cursor/skills/webtools-platform/SKILL.md` |
| Doc-traceable tests, FE→BE linkage | **this repo** | `skills/adversarial-documentation-driven-testing/SKILL.md` |
| UI/UX design intelligence | **generic** | `skills/ui-ux-pro-max/SKILL.md` |

## Layout on disk

All consumers live as **siblings** under `~/workspace` (default):

```text
~/workspace/
  webtools-ui/          ← platform SDK (shared/)
  llm-benchmark/shared → ../webtools-ui
  dc-planner/shared    → ../webtools-ui
  …
```

**Health check:** `<tool>/shared/css/base.css` must exist before any UI or agent work.

## Install any tool

```bash
curl -fsSL https://curt.wortman.ai/tools/install-<tool-id>.sh | bash
```

Clone everything (no auto-start): `install-all.sh`

## Connected-tool graph

```text
webtools-ui (platform)
    ↑ shared/ mount
    ├── llm-benchmark ──keAsk──► knowledge-exchange (/api/ask)
    ├── dc-planner ────────────► knowledge-exchange (curriculum RAG)
    ├── cluster-manager ───────► knowledge-exchange (cm-ops corpus)
    ├── demo-portal ──aggregates► cm, dc, lb, ke (+ registry hub)
    ├── knowledge-exchange ◄──── slide-presenter (federation ask/STT)
    └── slide-presenter ───────► knowledge-exchange (catalog)
```

Knowledge registry (corpus → transport): `webtools-ui/data/knowledge-registry.json`

Plugin registry (URLs + aggregates): `webtools-ui/plugins.registry.json`

## Default ports (local node)

| Tool | Port | Headless entry |
| :--- | ---: | :--- |
| webtools-ui hub | 8090 | static only |
| dc-planner | 8080 | static or `dc_planner_api.py` |
| demo-portal | 8080 | static + run-agent :8765 |
| knowledge-exchange | 8765 | `python3 -m ke.cli serve` |
| cluster-manager | 8686 | `cluster_manager_api.py` |
| llm-benchmark | 8787 | `regression_queue_api.py` |
| slide-presenter | 8788 | `sidecar.slide_intelligence` |

## Cross-tool workflows

**Benchmark → report deck:** llm-benchmark (`scripts/report.py` or `/api/reports`) → slide-presenter (`build.*` MCP) or knowledge-exchange (`ke export`).

**Cluster proof → enablement:** cluster-manager (`/api/report/cluster/*`, remediation catalog) → knowledge-exchange (`wiki-ingest` skill, `ke build`).

**Demo readiness:** demo-portal (`make validate`) → sibling tool pitch/deck assets.

**Planning scenario:** dc-planner read `data/*.json` for catalogs; use browser bridge or exported JSON state for mutations.

## Agent layer preference

1. **MCP stdio** — `plugin.manifest.json` → `registrations.mcp.stdio`
2. **HTTP `/mcp`** — when API server is running
3. **REST** — product-specific `/api/*`
4. **Browser L1** — last resort for DOM mutations

Full map: `webtools-ui/docs/AGENT_SKILLS.md`
