# Agent instructions

This repository uses the [Agent Skills](https://agentskills.io/specification) open format.

- **Playbooks:** [`skills/`](skills/README.md) — source of truth, not `.cursor/`.
- **UI/UX:** `python3 skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux`
- **Run tests without an IDE/agent:** `bash scripts/run_test_workflow.sh`
- **Link Cursor / Gemini / Claude / Codex / Hermes adapters:** `bash scripts/link_agent_skills.sh --suite --user`

Product overlays (optional): `.cursor/commands/`, `.gemini/`, Makefile targets.

Prefer stdio/HTTP MCP and `make` / `scripts/` over any vendor-specific command palette.
