---
title: "STYLE (canonical skeleton)"
description: "Shared H1–H3 outline for `docs/STYLE.md` across consumer repos. All 3 consumers already converge on this numbered structure."
status: phase-7-canonical
applies_to:
  - llm-benchmark/docs/STYLE.md
  - dc-planner/docs/STYLE.md
  - cluster-manager/docs/STYLE.md
---

# `[[STYLE]]` UI Style Guide

> Authoring rules: see top of `DEMO.skeleton.md`. Section *count* and
> *headings* are canonical; the token *values* (specific hex codes,
> shadow recipes, etc.) are consumer-specific because each product's
> brand accent and skin defaults differ slightly.

## 1) Design Intent · [CANONICAL]

Single-paragraph design philosophy. Required emphasis: dense,
data-first, minimal chrome, AMD-aligned brand, dark by default.

## 2) Source of Truth · [CANONICAL]

Required statement: *"The canonical CSS lives in
`shared/css/skins/<skin>.css` (Phase 1.1) and
`shared/css/{chat-orb,notes-panel,demo-mode}.css` (Phases 1.2 + 2).
This document explains the token model that those files
implement."*

## 3) Color tokens · [CANONICAL]

### 3.1 Core theme tokens — Dark default · [CANONICAL]

`--ui-*` and `--skin-*` variables (background, surface, border,
text, accent). Each consumer documents the defaults that ship in
`shared/css/skins/matte-dark.css`.

### 3.2 Core theme tokens — Light mode · [CANONICAL]

The `body[data-theme="light"]` overrides.

### 3.3 Shadow scale · [CANONICAL]

`--shadow-{xs,sm,md,lg,xl}`.

### 3.4 Semantic / status colors · [CANONICAL]

Success / warn / danger / info, with the consumer's preferred
hex / hsl values.

### 3.5 Presentation slide colors · [CANONICAL]

The deck-specific palette used by `pages/pitch.html`. Should match
across consumers within the same skin family.

### 3.6 Page-level variable aliases · [OPTIONAL]

Any per-page `--page-*` aliases.

## 4) Typography · [CANONICAL]

### 4.1 Font family · [CANONICAL]

System font stack first, with optional brand-font augmentation.

### 4.2 Base sizing · [CANONICAL]

Required: HTML root `font-size` and `rem`-based scale.

### 4.3 Common size scale in use · [CANONICAL]

A table of typical font-sizes per surface (body, labels, hero,
slide headers, slide body, pill text, etc.).

### 4.4 Icon font · [OPTIONAL]

If the consumer uses an icon font (Material Icons, Font Awesome,
etc.).

## 5) Layout and Spacing · [CANONICAL]

### 5.1 Panel and card surfaces · [CANONICAL]

### 5.2 Border radius scale · [CANONICAL]

### 5.3 Stat cards (KPI surface) · [OPTIONAL]

## 6) Components · [CANONICAL]

### 6.1 Header bar (`.hero`) · [CANONICAL]

### 6.2 Tabs · [CANONICAL]

### 6.2A Shell sidebar navigation · [CANONICAL]

The reusable left rail used by every consumer's main shell.

### 6.3 Buttons · [CANONICAL]

Variants: `primary`, `secondary`, `ghost`, `danger`, plus the
floating `chip` for in-page actions.

### 6.4 Inputs and selects · [CANONICAL]

### 6.5 Tables · [CANONICAL]

### 6.6 Cards and shells · [CANONICAL]

### 6.7 Special UI blocks · [OPTIONAL]

Consumer-specific surfaces (e.g. cluster-manager's debug summary
badge, dc-planner's BOM grid).

## 7) Responsive behavior · [CANONICAL]

Required breakpoints: ≥ 1280, 1024–1279, 768–1023, < 768.

## 8) Interaction and state styling · [CANONICAL]

Required states documented on every interactive element: `:hover`,
`:focus-visible`, `:active`, `[disabled]`, `[aria-pressed=true]`,
`[aria-selected=true]`.

## 9) CSS conventions · [CANONICAL]

Required:

- BEM-ish (`.block__element--modifier`), no nesting > 2 deep.
- All colors via tokens, no inline hex.
- All spacing via `--space-*` tokens.
- `prefers-reduced-motion` honored on every animation.

## 10) Skin system · [CANONICAL]

The 8 canonical skins promoted in Phase 1.1, served from
`shared/css/skins/`. Required list:

| Skin | File | Mood |
| :--- | :--- | :--- |
| `matte-dark` | `shared/css/skins/matte-dark.css` | Default, neutral |
| `nebula-dark` | `shared/css/skins/nebula-dark.css` | Cool gradients |
| `nebula-light` | `shared/css/skins/nebula-light.css` | Light mode |
| `solar-light` | `shared/css/skins/solar-light.css` | Warm light |
| `arctic-light` | `shared/css/skins/arctic-light.css` | High-contrast light |
| `synthwave` | `shared/css/skins/synthwave.css` | Retro neon |
| `terminal-green` | `shared/css/skins/terminal-green.css` | Mono terminal |
| `amd` | `shared/css/skins/amd.css` | AMD red / corporate |

The skin picker (in the side-nav and on `index.html`) must list
all 8 in the same order across consumers.

## 11) Print & export styling · [CANONICAL]

Print-mode tweaks for `pages/pitch.html` and PDF export. Source of
truth: the `@media print` and `@page` rules in `pitch.html`.

## 12) Accessibility · [CANONICAL]

Required: WCAG 2.1 AA color contrast, full keyboard navigation,
ARIA labels on every interactive element, `prefers-reduced-motion`
support.

## 13) Cross-references · [CANONICAL]

Required links:

- `shared/css/skins/` — canonical skin sources
- `shared/css/chat-orb.css` — orb visual tokens
- `shared/css/notes-panel.css` — pitch deck speaker-notes drawer
- `docs/CHAT.md`, `docs/DEMO.md`, `docs/PITCH.md` — consumers of
  these tokens
- `shared/docs/PLAN.md` — harmonization status log

## 14) Changelog · [CONSUMER-SPECIFIC]
