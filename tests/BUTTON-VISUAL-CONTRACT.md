---
type: Test Plan
title: Button visual contract (cross-consumer)
description: 'Shell consumers (Knowledge Exchange portal, future dashboards) share accent-filled primary controls from `webtools-ui/css/`. Those controls must use readable contrast: **light text on solid accent fills**, driven by the `--ui-accent-contrast` token.'
---
# Button visual contract (cross-consumer)

Shell consumers (Knowledge Exchange portal, future dashboards) share accent-filled
primary controls from `webtools-ui/css/`. Those controls must use readable contrast:
**light text on solid accent fills**, driven by the `--ui-accent-contrast` token.

## Design tokens

| Token | Role |
| --- | --- |
| `--ui-accent` | Solid fill for primary CTAs |
| `--ui-accent-contrast` | Text/icons on `--ui-accent` fills (default `#ffffff`) |
| `--ui-accent-soft` | Tinted surface for selected chips / secondary emphasis |
| `--ui-header` | Text on soft surfaces (selected chips, active nav label) |

Skins with light accent fills (e.g. AMD Gold) may override `--ui-accent-contrast`
to a dark value in their skin CSS.

## Button tiers

| Tier | Typical selectors | Contrast rule |
| --- | --- | --- |
| `primary-accent` | `.dev-btn--primary`, `.util-btn-agent`, `.resume-hero-card__btn`, `.recall-open-btn` | `color: var(--ui-accent-contrast)` on `background: var(--ui-accent)`; ratio ≥ 3:1 (bold/large CTA) |
| `secondary` | `.dev-btn`, `.module-secondary` | Muted/body text on neutral fill; ratio ≥ 4.5:1 |
| `chip-selected` | `.chip[aria-checked="true"]` | Header text on `--ui-accent-soft`; ratio ≥ 3:1 |
| `nav-active` | `.nav-btn.active` | Header text on tab-active surface; ratio ≥ 3:1 |

## Shared test helper

`tests/lib/shell-visual-contract.mjs` exports:

- `contrastRatio`, `parseCssRgb` — color math (unit-tested)
- `assertButtonVisualContract(page, tiers, expect)` — Playwright assertion
- `DEFAULT_SHELL_BUTTON_TIERS` — baseline shell controls

Run unit tests (no browser):

```bash
node --test tests/lib/shell-visual-contract.test.mjs
```

## Consumer registration

1. Import the helper from the `shared/` symlink (`../webtools-ui`):

```javascript
const {
  assertButtonVisualContract,
  DEFAULT_SHELL_BUTTON_TIERS,
} = require("../../shared/tests/lib/shell-visual-contract.mjs");
```

2. Define consumer-specific tiers (portal progress tab, create studio, etc.):

```javascript
const PORTAL_BUTTON_TIERS = [
  ...DEFAULT_SHELL_BUTTON_TIERS,
  { role: "primary-accent", selector: ".resume-hero-card__btn", minContrast: 4.5 },
  { role: "primary-accent", selector: ".recall-open-btn", minContrast: 4.5 },
];
```

3. Call after navigation / tab switch:

```javascript
await assertButtonVisualContract(page, PORTAL_BUTTON_TIERS, expect);
```

Optional: add a `data/shell-button-contract.json` beside `shell-modules.json`
with the same `{ role, selector, minContrast, optional }` objects and load it in
the spec — the helper stays unchanged.

Knowledge Exchange reference spec: `tests/ui/button-visual-contract.spec.js`.
