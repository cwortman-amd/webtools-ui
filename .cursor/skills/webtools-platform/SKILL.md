---
name: webtools-platform
description: >-
  Validates and maintains the webtools-ui platform SDK and cross-consumer plugin
  contracts. Use for harmonization CI, plugin manifests, MCP host library, installer
  scripts, and knowledge-registry — not for operating a specific product dashboard.
---

# webtools-ui — platform agent skill

## Role

**webtools-ui** is the shared UI SDK (CSS, chat orb, voice, demo engine, Agent Gateway). It is **not** a product runtime — agents usually target a **consumer** skill instead. Use this skill for platform-wide validation and registry work.

## Bootstrap

```bash
curl -fsSL https://curt.wortman.ai/tools/install-webtools-ui.sh | bash
# → http://127.0.0.1:8090/pages/index.html (Tools Hub; needs sibling repos for card links)
```

## Connected tools

| Consumer | Registry id | Manifest |
| :--- | :--- | :--- |
| cluster-manager | `cluster-manager` | `../cluster-manager/plugin.manifest.json` |
| dc-planner | `dc-planner` | `../dc-planner/plugin.manifest.json` |
| llm-benchmark | `llm-benchmark` | `../llm-benchmark/plugin.manifest.json` |
| demo-portal | `demo-portal` | `../demo-portal/plugin.manifest.json` |
| knowledge-exchange | `knowledge-exchange` | `../knowledge-exchange/plugin.manifest.json` |
| slide-presenter | `slide-presenter` | `../slide-presenter/plugin.manifest.json` |

Sources: `plugins.registry.json`, `data/knowledge-registry.json`

## Headless operations

```bash
cd ~/workspace/webtools-ui
make ci                      # core gates
make enhanced-validation     # cross-consumer HTML + agent checks
make check-mcp check-agent   # MCP/agent wiring validators
python3 scripts/check_plugin_manifests.py --strict
python3 scripts/html_consistency_audit.py --workspace ..
```

Install scripts: `tools/install-*.sh` · Docs: `docs/INSTALL.md`, `docs/AGENT_SKILLS.md`

For installing **all six consumers**, use skill **webtools-suite-install** or `./tools/install-all.sh` then per-tool `install-<tool>.sh` to start services.

## What agents should not do here

- Do not treat `:8090` static server as a product API.
- Do not mutate consumer repos from this skill unless running a documented sync script (e.g. `scripts/sync_plugin_registry_snapshot.py`).

## Deep reference

- `docs/PLUGIN_CONTRACT.md` — manifest schema, lifecycle
- `docs/IMPLEMENTATION.md` — Agent Gateway, MCP three-layer model
- `js/agent-gateway.js`, `js/mcp-suite.js`, `python/webtools_mcp/host.py`
