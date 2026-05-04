---
title: "PITCH (canonical skeleton)"
description: "Shared H1–H3 outline for `docs/PITCH.md` (the executive deck slide outline) across consumer repos. The slide-by-slide structure already converges across all 3."
status: phase-7-canonical
applies_to:
  - llm-benchmark/docs/PITCH.md
  - dc-planner/docs/PITCH.md
  - cluster-manager/docs/PITCH.md
---

# `[[PITCH]]` Pitch Deck — Slide Outline & Build Guide

> Authoring rules: see top of `DEMO.skeleton.md`. The slide titles
> themselves are **[CONSUMER-SPECIFIC]** (each consumer pitches a
> different product) but the slide *count*, *narrative arc*, and
> *backup pack discipline* are canonical.

## 1) Purpose of this document · [CANONICAL]

This is the source-of-truth slide outline that drives `pages/pitch.html`
in this consumer. Refining the deck means editing this doc first, then
the HTML. Every speaker-note line in `pitch.html` traces back to a row
in §4 below.

## 2) Audience · [CANONICAL]

A short paragraph describing the audience. Required statement: *"This
deck is built for a technical executive audience that critiques on
technical merit; avoid marketing fluff."*

## 3) Narrative arc · [CANONICAL]

A 1-paragraph story arc covering: **problem → solution → proof →
ask**. Each consumer fills in the specifics, but the four-beat
structure is fixed.

## 4) Deck map · [CANONICAL]

A required summary table of all main-deck slides. Columns:
`#`, `Title`, `Key message (1 line)`, `Primary visual`,
`Speaker time (mm:ss)`. The table is the at-a-glance index of the
deck and must stay in sync with §5.

## 5) Main deck (Slides 01–10) · [CONSUMER-SPECIFIC]

Each main-deck slide gets its own H3 in this section, using the
template below. Required slot count: **10 main slides** (matches the
10-slide standard adopted across all 3 consumers in 2026-04).

### Slide 01 — Title · [CANONICAL slot]

The cover slide. Required elements: title, subtitle, presenter, AMD
branding, NDA tag.

### Slide 02 — Executive Summary · [CANONICAL slot]

The "if you see only one slide today, this is it" slide. Required:
problem, solution, benefit, in a single frame.

### Slide 03 · [CONSUMER-SPECIFIC slot]

llm-benchmark uses this slot for "AI Native"; dc-planner for "The
Problem"; cluster-manager for "The Problem". The slot is canonical
in *count*, not *title*.

### Slide 04 · [CONSUMER-SPECIFIC slot]

(Continue per consumer.)

### Slide 05 · [CONSUMER-SPECIFIC slot]

### Slide 06 · [CONSUMER-SPECIFIC slot]

### Slide 07 · [CONSUMER-SPECIFIC slot]

### Slide 08 — Reports / Outputs · [CANONICAL slot]

What artefacts the tool produces (PDF report, PPTX deck, etc.).

### Slide 09 — Value · [CANONICAL slot]

Quantified benefit (time saved, accuracy lift, cost reduction).

### Slide 10 — Call to Action · [CANONICAL slot]

The ask: funding, deployment scope, or pilot commitment.

#### Slide template (apply to every H3 in §5) · [CANONICAL]

Each slide H3 should contain these labelled lines:

- **Why this slide:** 1 sentence.
- **Key messages:** 3 bullets.
- **Primary visual:** what artefact / chart / screenshot anchors it.
- **Speaker notes (verbatim):** the exact wording for the presenter,
  sized to ~2–3 minutes per slide for a technical executive audience.
- **Anticipated questions:** 2–4 likely audience challenges.
- **Cross-references:** link to relevant `docs/*.md`.

## 6) Backup pack · [CANONICAL]

A required "Backup pack" section at the end of the deck (numbered
`B1, B2, …` or `Slide 11, 12, …` per consumer convention). These
slides are *not* presented in the main flow but are pre-built for
deeper Q&A.

### B1 — Backup divider · [CANONICAL slot]

A clear divider slide marking the end of the main deck.

### B2…Bn · [CONSUMER-SPECIFIC]

Each consumer chooses which deep-dive surfaces it stages as backups.

### Backup discipline rules · [CANONICAL]

- Every backup slide must have a clear "if asked, here's the deeper
  answer" intent.
- No backup slide repeats main-deck content.
- Backup slides may be bumped to the main deck during deck refinement
  if the audience needs them.

## 7) Visual & branding conventions · [CANONICAL]

Source of truth for fonts, colors, accents: `docs/STYLE.md` and
`shared/css/skins/`. Required statements:

- Fonts: ≥ 12pt body, ≥ 14pt preferred.
- Colors: skin-aware (default `matte-dark`).
- AMD Confidential / NDA tag: present on every slide.

## 8) PDF / PPTX export · [CANONICAL]

How the deck exports cleanly to PDF (landscape 11in × 8.5in) and
PPTX. Source of truth: `scripts/export-pitch-pdf.mjs` and the
`@page { size: 11in 8.5in }` rule in `pitch.html`. The exporter is
shared cross-repo (Phase 1.3).

## 9) Speaker notes drawer · [CANONICAL]

How the floating control bar in `pitch.html` shows speaker notes in
a right-side drawer. Source of truth: `shared/css/notes-panel.css`
(Phase 1.2). Required structure: `id="notesPanel"`,
`class="notes-panel"`, `id="notesPanelBody"`, `id="notesSlidePill"`.

## 10) Slash command · [CANONICAL]

`/pitch` opens `pages/pitch.html` in the same browser tab.
Registered in this consumer's `js/chat-orb-mount.js` per Phase 3.

## 11) Authoring conventions · [CANONICAL]

Required rules:

- Edit this doc first, then `pitch.html`.
- Speaker notes ≈ 2–3 minutes per slide.
- Avoid flowery / marketing language; technical critique audience.
- Anticipate questions per slide.

## 12) Cross-references · [CANONICAL]

Required links:

- `pages/pitch.html` — the rendered deck
- `pages/pitch.pdf` — the exported PDF
- `scripts/export-pitch-pdf.mjs` — the Playwright exporter
- `shared/css/notes-panel.css` — speaker-notes drawer styling
- `docs/STYLE.md` — visual tokens
- `docs/DEMO.md` — sister narrated walkthrough surface
- `shared/docs/PLAN.md` — harmonization status log

## 13) Changelog · [CONSUMER-SPECIFIC]
