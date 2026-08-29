---
type: Design System
title: Design tokens (`css/tokens.css`)
description: 'Harmonization **T4.1**: neutral defaults for every `--ui-*` custom property before skins override them.'
---
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

## Overlay z-index scale

Defined in `tokens.css` for consistent stacking (avoid arbitrary `z-index: 9999`):

| Token | Default | Use |
| :--- | :--- | :--- |
| `--wt-z-panel` | 20 | Sticky panels, local chrome |
| `--wt-z-popover` | 40 | Tool popovers, dropdowns |
| `--wt-context-menu` | 50 | Right-click context menus (`.wt-context-menu`) |
| `--wt-z-modal` | 100 | Modals and blocking overlays |

Product consumers may map these to local names (e.g. Slide Presenter `--sp-z-context-menu`).

## Context menu tokens (`components.css`)

Opaque Windows-style menus — set on `:root` / `[data-theme="light"]` in `components.css`:

| Token | Role |
| :--- | :--- |
| `--wt-context-menu-bg` | Solid panel background |
| `--wt-context-menu-border` | 1px outline |
| `--wt-context-menu-hover` | Row hover fill |
| `--wt-context-menu-text` | Primary label color |
| `--wt-context-menu-text-disabled` | Disabled row color |
| `--wt-context-menu-icon` | Icon column color |
| `--wt-context-menu-danger` | Destructive actions |
| `--wt-context-menu-shadow` | Drop shadow |

See [`SDK.md`](SDK.md) §Shared widgets and [`DESIGN.md`](DESIGN.md) for markup (`wt-context-menu-item__icon` + `__label`).
