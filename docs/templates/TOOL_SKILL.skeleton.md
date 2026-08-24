---
name: <tool-id>
description: >-
  Operates <Tool Name> on a local node without the browser GUI — via CLI, MCP,
  and HTTP APIs. Use when the user asks to run, configure, or automate <tool-id>,
  or when routing to connected AMD Instinct webtools.
---

# <Tool Name> — headless agent skill

## Bootstrap

```bash
curl -fsSL https://curt.wortman.ai/tools/install-<tool-id>.sh | bash
```

See `shared/docs/INSTALL.md` (or `webtools-ui/docs/INSTALL.md`) for env vars (`WT_WORKSPACE`, `SETUP_FAST`, …).

**Sibling requirement:** `shared/css/base.css` must resolve to **webtools-ui**.

## Headless vs browser

| Headless (this skill) | Browser / L1 bridge required |
| :--- | :--- |
| *(fill per tool)* | *(fill per tool)* |

## Connected tools

| Tool | Relationship | Agent entry |
| :--- | :--- | :--- |
| **webtools-ui** | Platform SDK (`shared/`) | Validation only — not a runtime target |
| *(peers)* | *(fill)* | *(fill)* |

Registry: `webtools-ui/plugins.registry.json` · Knowledge: `webtools-ui/data/knowledge-registry.json`

## Primary interfaces

*(MCP stdio, HTTP, CLI — fill per tool)*

## Common workflows

*(numbered steps)*

## Testing

This repo must ship **adversarial-documentation-driven-testing** (`.cursor/skills/adversarial-documentation-driven-testing/SKILL.md`) and **`/test`** (`.cursor/commands/test.md`). Invoke with `/test` or `make adversarial-preflight` from **this** repo. Refresh from webtools-ui: `bash shared/scripts/install_adversarial_workflow.sh --repo .`

## Safety

*(mutations, confirm tokens, air-gap)*

## Deep reference

- `docs/AGENT.md` (if present)
- `plugin.manifest.json`
- `docs/SKILLS.md` (if present)
