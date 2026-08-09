# Design tokens (`css/tokens.css`)

Harmonization **T4.1**: neutral defaults for every `--ui-*` custom property before skins
override them.

## Load order (catalog consumers)

```html
<link rel="stylesheet" href="../shared/css/material-symbols.css" />
<link rel="stylesheet" href="../shared/css/tokens.css" />
<link rel="stylesheet" href="../shared/css/base.css" />
<link id="skinStylesheet" rel="stylesheet" href="../shared/css/skins/<skin>.css" />
<link rel="stylesheet" href="../shared/css/chrome.css" />
<link rel="stylesheet" href="../shared/css/components.css" />
```

Dashboard consumers may adopt `tokens.css` in a follow-up; skins continue to work without it
because each skin file still declares its own `--ui-*` block.

## Rules

- Do not reference `--ui-border`, `--ui-body`, or `--ui-accent-contrast` in consumer CSS unless
  `tokens.css` (or the active skin) is loaded first.
- Prefer `--ui-*` over hex literals in portal-specific layers.
- New tokens land here first, then propagate into skin files as overrides.
