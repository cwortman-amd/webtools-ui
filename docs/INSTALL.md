---
type: Reference
title: Local install — webtools consumers
description: One-line curl installers for each webtools consumer on a local node.
---

# Local install — webtools consumers

Each tool is a sibling repo that mounts **webtools-ui** at `shared/`. The installers clone both repos into `~/workspace` (by default), verify `shared/css/base.css`, then start the tool.

## One-line install (recommended)

Pipe the script to **bash** (not to the script name):

```bash
curl -fsSL https://curt.wortman.ai/tools/install-<tool>.sh | bash
```

Replace `<tool>` with one of:

| Tool | One-liner | Default URL |
|------|-----------|-------------|
| **Tools Hub** | `curl -fsSL https://curt.wortman.ai/tools/install-webtools-ui.sh \| bash` | http://127.0.0.1:8090/pages/index.html |
| **DC Planner** | `curl -fsSL https://curt.wortman.ai/tools/install-dc-planner.sh \| bash` | http://127.0.0.1:8080/pages/index.html |
| **LLM Benchmark** | `curl -fsSL https://curt.wortman.ai/tools/install-llm-benchmark.sh \| bash` | http://127.0.0.1:8787/dashboard |
| **Cluster Manager** | `curl -fsSL https://curt.wortman.ai/tools/install-cluster-manager.sh \| bash` | http://127.0.0.1:8686/dashboard |
| **Demo Portal** | `curl -fsSL https://curt.wortman.ai/tools/install-demo-portal.sh \| bash` | http://127.0.0.1:8080/pages/index.html?tab=catalog |
| **Knowledge Exchange** | `curl -fsSL https://curt.wortman.ai/tools/install-knowledge-exchange.sh \| bash` | http://127.0.0.1:8765/pages/index.html |
| **Slide Presenter** | `curl -fsSL https://curt.wortman.ai/tools/install-slide-presenter.sh \| bash` | http://127.0.0.1:8788/pages/index.html |
| **All repos** (clone only) | `curl -fsSL https://curt.wortman.ai/tools/install-all.sh \| bash` | — |

Agent skill for the full suite: `.cursor/skills/webtools-suite-install/SKILL.md` (see [`docs/AGENT_SKILLS.md`](AGENT_SKILLS.md)).

### GitHub fallback (before curt.wortman.ai is wired)

```bash
INSTALL_BASE=https://raw.githubusercontent.com/cwortman-amd/webtools-ui/main/tools \
  bash -c 'source <(curl -fsSL "$INSTALL_BASE/install-lib.sh") && wt_install dc-planner'
```

Or run from a local **webtools-ui** checkout:

```bash
cd ~/workspace/webtools-ui
./tools/install-dc-planner.sh
```

## What each installer does

1. **Clone** `webtools-ui` + the consumer repo into `WT_WORKSPACE` (default `~/workspace`).
2. **Verify** `shared/css/base.css` resolves (prevents an unstyled UI with no error).
3. **Start** the tool:
   - **Tools Hub** (webtools-ui): `./setup.sh` (static file server on `:8090`).
   - **Static** (dc-planner): `python3 -m http.server` in the background.
   - **Everything else**: `./setup.sh` (creates a venv, installs deps, starts the API/sidecar).

Re-running an installer is **idempotent**: existing clones are fetched, not deleted.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `WT_WORKSPACE` | `~/workspace` | Where repos are cloned |
| `WT_ORG` | `cwortman-amd` | GitHub org |
| `WT_PROTO` | `ssh` | `ssh` or `https` clone URL |
| `WT_REF` | *(default branch)* | Optional branch or tag |
| `WT_NO_SETUP` | `0` | `1` = clone only, skip setup/start |
| `WT_HOST` | `127.0.0.1` | Bind address for static servers |
| `WT_CLONE_SIBLINGS` | `0` | `1` on demo-portal also clones other dashboards for the Tools tab |
| `SETUP_FAST` | `0` | Passed to `./setup.sh` — skip apt/playwright on air-gapped nodes |
| `INSTALL_BASE` | `https://curt.wortman.ai/tools` | Where `install-lib.sh` is fetched when not run locally |

**Cluster Manager** also accepts legacy `CM_*` names (`CM_WORKSPACE`, `CM_PROTO`, `CM_NO_SETUP`, …).

### Examples

```bash
# HTTPS clone into /opt/tools
WT_WORKSPACE=/opt/tools WT_PROTO=https \
  curl -fsSL https://curt.wortman.ai/tools/install-dc-planner.sh | bash

# Clone only (run setup yourself)
WT_NO_SETUP=1 curl -fsSL https://curt.wortman.ai/tools/install-cluster-manager.sh | bash

# Air-gapped: skip apt/playwright in setup.sh
SETUP_FAST=1 curl -fsSL https://curt.wortman.ai/tools/install-cluster-manager.sh | bash

# Demo portal with sibling dashboards for the Tools tab
WT_CLONE_SIBLINGS=1 curl -fsSL https://curt.wortman.ai/tools/install-demo-portal.sh | bash
```

## Prerequisites

| Tool | Minimum |
|------|---------|
| All | `git`, network access to GitHub |
| Static tools | `python3` |
| API-backed tools | `python3`, `curl`; `./setup.sh` installs **uv** if missing |
| LLM Benchmark (GPU runs) | Docker/ROCm, `HF_TOKEN` in `.env` |
| Cluster Manager (cluster ops) | `ansible`, SSH to target hosts, `sudo` on first setup |
| Knowledge Exchange (full Studio) | Node ≥ 22, Chrome, ffmpeg; optional Ollama for AI features |

## Hosting `curt.wortman.ai/tools`

Serve the `webtools-ui/tools/` directory over HTTPS. Example **Caddy**:

```caddy
curt.wortman.ai {
  handle_path /tools/* {
    root * /var/www/webtools-ui/tools
    file_server
  }
  handle_path /archives/* {
    root * /var/www/webtools-ui/archives
    file_server
  }
}
```

Build source archives for the Tools Hub install modal:

```bash
cd ~/workspace/webtools-ui
./scripts/build-source-archives.sh
# → archives/<tool>-source.zip
```

After deploy, verify:

```bash
curl -fsSL https://curt.wortman.ai/tools/install-lib.sh | head
```

## Manual install (no curl)

```bash
mkdir -p ~/workspace && cd ~/workspace
git clone git@github.com:cwortman-amd/webtools-ui.git
git clone git@github.com:cwortman-amd/dc-planner.git
test -f dc-planner/shared/css/base.css
cd dc-planner && python3 -m http.server 8080
# → http://127.0.0.1:8080/pages/index.html
```

See each consumer's `setup.sh` and README for tool-specific options.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Unstyled white page | `shared/css/base.css` missing — re-run installer or clone `webtools-ui` as sibling |
| `Repository not found` on clone | Use `WT_PROTO=https` with a token, or load your SSH key |
| Port already in use | Stop the old process or set `DASHBOARD_PORT` / `PORT` before `./setup.sh` |
| Knowledge Exchange Create tab 404 | Do not use plain `http.server` — use `./setup.sh` (`ke serve`) |
| Slide Presenter API errors | Same — requires sidecar on `:8788`, not static hosting |

Script sources: [`tools/install-lib.sh`](../tools/install-lib.sh) and [`tools/install-*.sh`](../tools/).

## Agent skills (no browser required)

Each tool has a Cursor skill for headless operation — CLI, MCP, and HTTP APIs plus connected-tool routing:

[`docs/AGENT_SKILLS.md`](../docs/AGENT_SKILLS.md)
