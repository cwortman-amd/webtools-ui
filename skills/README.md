# Agent Skills (open format)

Canonical playbooks for **any** agent that implements [agentskills.io](https://agentskills.io/specification):
Cursor, Gemini CLI, Claude Code, Codex, Hermes, Copilot, and others.

```text
skills/<name>/SKILL.md     ← edit here (source of truth)
scripts/                   ← optional executables bundled with a skill
```

Do **not** treat `.cursor/skills/` as master. Those directories are **adapter
symlinks** so each product can discover the same files:

| Adapter | Workspace | User-global |
| :--- | :--- | :--- |
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| Gemini CLI | `.gemini/skills/` or `.agents/skills/` | `~/.gemini/skills/`, `~/.agents/skills/` |
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `.codex/skills/` | `~/.codex/skills/` |
| Hermes | `.hermes/skills/` | `~/.hermes/skills/` |
| Interop alias | `.agents/skills/` | `~/.agents/skills/` |

Refresh:

```bash
bash scripts/link_agent_skills.sh --suite --user
```

## Tools are not the agent

Skills describe *when* and *how*. Execution is always a normal process:

```bash
make adversarial-preflight
make coverage-snapshot
bash scripts/run_test_workflow.sh          # no agent required
python3 skills/ui-ux-pro-max/scripts/search.py "dashboard" --domain ux
curl -fsSL https://curt.wortman.ai/tools/install-<tool>.sh | bash
```

MCP stdio / HTTP (`plugin.manifest.json`) also work without a particular IDE.

## Skills in this tree

| Directory | Purpose |
| :--- | :--- |
| `adversarial-documentation-driven-testing/` | Doc→impl→test, FE/BE linkage (any codebase) |
| `webtools-ecosystem/` | Route work to the right Instinct webtool |
| `webtools-platform/` | Platform SDK / CI |
| `webtools-suite-install/` | Clone and bootstrap the suite |
| `ui-ux-pro-max/` | Generic UI/UX design intelligence ([upstream](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)); run `python3 skills/ui-ux-pro-max/scripts/search.py` |
