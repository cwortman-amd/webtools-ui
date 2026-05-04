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

The 7 canonical skins served from `shared/css/skins/`. Required list,
in canonical menu order — **AMD-branded triplet first (alphabetical),
remaining skins alphabetically**:

| Skin | File | Mood |
| :--- | :--- | :--- |
| `amd` | `shared/css/skins/amd.css` | AMD Red — corporate brand red `#ED1C24` |
| `amd-gold` | `shared/css/skins/amd-gold.css` | AMD Gold — `#C1A968` |
| `amd-teal` | `shared/css/skins/amd-teal.css` | AMD Teal — `#00C2DE` |
| `glass-dark` | `shared/css/skins/glass-dark.css` | Frosted midnight glassmorphism with cyan-violet glow |
| `matte-dark` | `shared/css/skins/matte-dark.css` | Default, refined charcoal with slate-blue accents |
| `minimal-monochrome` | `shared/css/skins/minimal-monochrome.css` | Editorial ink-on-paper |
| `soft-neutral-light` | `shared/css/skins/soft-neutral-light.css` | Warm-toned calm enterprise (light) |

The AMD-branded triplet shares a unified canonical-greys neutral
system (`--amd-gray-1` … `--amd-gray-5`) so backgrounds, panels,
and muted text stay consistent across the brand family.

The skin picker (in the side-nav and on `index.html`) must list
all 7 in this exact order across consumers. The default is
`matte-dark`, which `setSkin()` resolves on first load regardless
of menu position.

> **Retired 2026-05-04:** `amber`, `blue` (Corporate Blue),
> `nebula-light` were removed to focus the picker on the AMD-branded +
> neutral set. Existing localStorage values for those keys fall back to
> `matte-dark` via the consumer-side `setSkin()` / `normalizeSkin()`
> guard.

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
