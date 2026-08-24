---
name: webtools-suite-install
description: >-
  Installs the full AMD Instinct webtools suite — webtools-ui plus all six consumer
  tools (llm-benchmark, dc-planner, cluster-manager, demo-portal, knowledge-exchange,
  slide-presenter) on a local node. Use when the user asks to install everything, clone
  the whole workspace, bootstrap the Tools Hub, or set up all sibling repos.
---

# Webtools suite install — all 6 tools + platform

## One-line clone (all repos)

Clones **webtools-ui** and all **six consumers** into `~/workspace` (default). Does **not** start servers — avoids port conflicts and lets you bring tools up selectively.

```bash
curl -fsSL https://curt.wortman.ai/tools/install-all.sh | bash
```

Local checkout:

```bash
cd ~/workspace/webtools-ui
./tools/install-all.sh
```

### Environment

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `WT_WORKSPACE` | `~/workspace` | Clone destination |
| `WT_ORG` | `cwortman-amd` | GitHub org |
| `WT_PROTO` | `ssh` | `ssh` or `https` |
| `WT_REF` | *(default branch)* | Optional branch/tag |
| `INSTALL_BASE` | `https://curt.wortman.ai/tools` | Remote install-lib URL |

After clone, verify each consumer:

```bash
test -f ~/workspace/dc-planner/shared/css/base.css && echo OK
# repeat for llm-benchmark, cluster-manager, demo-portal, knowledge-exchange, slide-presenter
```

## What gets cloned

| Repo | Role |
| :--- | :--- |
| `webtools-ui` | Platform SDK (`shared/`) + Tools Hub |
| `llm-benchmark` | Benchmark queue + dashboard |
| `dc-planner` | Static planning dashboard |
| `cluster-manager` | Cluster Ansible + dashboard API |
| `demo-portal` | Demo catalog hub |
| `knowledge-exchange` | Enablement portal + `ke` CLI |
| `slide-presenter` | Deck sidecar + presenter |

Registry: `webtools-ui/plugins.registry.json`

## Start each tool (after clone)

Run **one installer per tool** — each clones/updates `webtools-ui` if missing, verifies `shared/`, then runs `./setup.sh` or a static server.

```bash
BASE=https://curt.wortman.ai/tools

curl -fsSL $BASE/install-webtools-ui.sh       | bash   # :8090 Tools Hub
curl -fsSL $BASE/install-dc-planner.sh        | bash   # :8080 static
curl -fsSL $BASE/install-llm-benchmark.sh       | bash   # :8787 API
curl -fsSL $BASE/install-cluster-manager.sh   | bash   # :8686 API
curl -fsSL $BASE/install-demo-portal.sh       | bash   # :8080 portal (+ :8765 agent)
curl -fsSL $BASE/install-knowledge-exchange.sh | bash  # :8765 ke serve
curl -fsSL $BASE/install-slide-presenter.sh   | bash   # :8788 sidecar
```

**Port note:** `dc-planner` and `demo-portal` both default to **8080** — run one at a time, or set `PORT` / `DASHBOARD_PORT` before `./setup.sh`.

**Air-gapped / fast path:**

```bash
SETUP_FAST=1 curl -fsSL $BASE/install-cluster-manager.sh | bash
```

**Demo Portal Tools tab (links to sibling dashboards):**

```bash
WT_CLONE_SIBLINGS=1 curl -fsSL $BASE/install-demo-portal.sh | bash
```

## Recommended agent workflow

1. **Clone suite:** `install-all.sh` (or parallel `WT_NO_SETUP=1` per-tool curls if repos already exist).
2. **Verify mounts:** `shared/css/base.css` in every consumer.
3. **Hub only:** `install-webtools-ui.sh` — open `http://127.0.0.1:8090/pages/index.html` (card links need siblings present).
4. **Start products on demand:** run the matching `install-<tool>.sh` for what the user needs; do not start all APIs at once unless ports are remapped.
5. **Validate ecosystem:** `cd webtools-ui && make enhanced-validation` (optional, needs deps).
6. **Local `/test` skill:** `cd webtools-ui && bash scripts/install_adversarial_workflow.sh` so each consumer has `.cursor/skills/adversarial-documentation-driven-testing/` and can run `make adversarial-preflight` from its own root.

## Open workspace in Cursor

Open **`~/workspace`** (parent) or **`webtools-ui`** as the project root. Per-tool agent skills live in each repo:

- `webtools-ui/.cursor/skills/webtools-ecosystem/SKILL.md` — router
- `<consumer>/.cursor/skills/<tool-id>/SKILL.md` — headless ops per tool

See `webtools-ui/docs/AGENT_SKILLS.md`.

## Deep reference

- `docs/INSTALL.md` — full install matrix, prerequisites, troubleshooting
- `tools/install-lib.sh` — shared clone/verify/start logic
- `tools/install-all.sh` — clone-all entry point
- `plugins.registry.json` — consumer list and local URLs
