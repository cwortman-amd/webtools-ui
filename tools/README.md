# One-line installers

Canonical curl bootstrap scripts for each webtools consumer. Full documentation: [`docs/INSTALL.md`](../docs/INSTALL.md).

```bash
curl -fsSL https://curt.wortman.ai/tools/install-<tool>.sh | bash
```

| Script | Tool |
|--------|------|
| `install-webtools-ui.sh` | Tools Hub |
| `install-dc-planner.sh` | DC Planner |
| `install-llm-benchmark.sh` | LLM Benchmark |
| `install-cluster-manager.sh` | Cluster Manager |
| `install-demo-portal.sh` | GPU Demo Portal |
| `install-knowledge-exchange.sh` | Knowledge Exchange |
| `install-slide-presenter.sh` | Slide Presenter |
| `install-all.sh` | Clone all repos (no auto-start) |

Shared library: `install-lib.sh` (sourced by each script; also fetched from `INSTALL_BASE` when curl-piped).

Host this directory at `https://curt.wortman.ai/tools/` for public one-liners.

Cursor agent skill for the full suite: [`../.cursor/skills/webtools-suite-install/SKILL.md`](../.cursor/skills/webtools-suite-install/SKILL.md)
