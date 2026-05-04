---
title: "VOICE (canonical skeleton)"
description: "Shared H1–H3 outline for `docs/VOICE.md` across consumer repos. All 3 consumers already converge on this structure; the skeleton just locks it in."
status: phase-7-canonical
applies_to:
  - llm-benchmark/docs/VOICE.md
  - dc-planner/docs/VOICE.md
  - cluster-manager/docs/VOICE.md
---

# `[[VOICE]]` Voice AI Navigation Layer

> Authoring rules: see top of `DEMO.skeleton.md`.

## 1) Purpose · [CANONICAL]

Single-paragraph statement: *"The voice layer turns finalized
transcripts into the same `chatOrb.send()` calls a typed message
would, so every slash command, intent, and skill works through
voice with zero duplication."*

### 1.1) Design goals · [CANONICAL]

Required goals:

- **Single intent path.** Voice → `chatOrb.send(transcript)`,
  never a separate parser.
- **Push-to-talk by default.** Wake-word is opt-in.
- **Browser-native, offline.** Web Speech API only by default.
- **TTS playback during voice sessions.** AI replies can be
  spoken back; pronunciation overrides via the phonetic table.

## 2) Hook specification · [CANONICAL]

What voice needs from the agent layer to navigate accurately.

### 2.1) Required data attributes · [CANONICAL]

`data-agent-hook`, `data-agent-context`, `data-agent-tab` —
same hooks the agent bridge already expects (see AGENT.md §4.2).

### 2.2) Naming convention · [CANONICAL]

Same `<scope>.<surface>.<element>` naming used in AGENT.md.

### 2.3) ARIA label requirements · [CANONICAL]

Every voice-actionable element must carry an ARIA label that the
voice prompt grammar uses for fuzzy matching.

## 3) Navigation map · [CONSUMER-SPECIFIC]

### 3.1) Page / shell structure · [CONSUMER-SPECIFIC]

Each consumer's tabs and their voice aliases.

### 3.2) Section / page commands · [CONSUMER-SPECIFIC]

### 3.3) Voice command vocabulary · [CONSUMER-SPECIFIC]

### 3.4) Hook registry · [CONSUMER-SPECIFIC]

### 3.5) Voice transcript event contract · [CONSUMER-SPECIFIC]

The DOM `CustomEvent` name and payload shape the consumer emits
when a transcript finalizes (e.g. `dc-voice-transcript`,
`im-voice-transcript`).

## 4) Transformation examples · [CONSUMER-SPECIFIC]

Before / after pairs showing how undecorated DOM gets
auto-decorated with hook attributes for voice. Each consumer ships
its own examples.

## 5) Agent interaction protocol · [CANONICAL]

### 5.1) Navigation · [CANONICAL]

How "go to <tab>" maps to `agentBridge.call("navigate", {...})`.

### 5.2) Form interaction · [CANONICAL]

How "set <field> to <value>" maps to `set_field`.

### 5.3) Reading context · [CANONICAL]

How "read me <section>" maps to `get_state` + TTS playback.

### 5.4) Section reading · [CANONICAL]

### 5.5) Composite commands · [CANONICAL]

Multi-step utterances ("go to plan, set concurrency to 50, run").

## 6) STT (speech recognition) · [CANONICAL]

How the voice layer wires `window.SpeechRecognition`. Source of
truth: `shared/js/voice.js` (Phase 6 — promotion of
cluster-manager's voice.js). Subsections:

### 6.1) Push-to-talk · [CANONICAL]

### 6.2) Wake-word (opt-in) · [CANONICAL]

### 6.3) Continuous listening · [OPTIONAL]

### 6.4) Mic permissions · [CANONICAL]

## 7) TTS (speech synthesis) · [CANONICAL]

How the voice layer wires `window.speechSynthesis`. Phase 6 unifies
this with the demo engine's narration via a single `say(text, opts)`
function.

### 7.1) Voice selection · [CANONICAL]

Preferred-voice fallback chain (e.g. Microsoft Aria → Google US
English → Samantha → first available).

### 7.2) Phonetic overrides · [CONSUMER-SPECIFIC]

Each consumer ships a phonetic dictionary appropriate to its
domain. llm-benchmark's lives in `data/present-script.json`
(canonical for Phase 6).

### 7.3) Persona modes · [CONSUMER-SPECIFIC]

Audience-aware narration tweaks (decimals, dollar signs, opening /
closing phrases).

## 8) Slash commands · [CANONICAL]

The voice-relevant subset of `shared/js/slash-catalog.js`:

- `/voice on|off` — toggle voice session.
- `/voice say <text>` — TTS-only test.
- `/voice status` — diagnostic.
- `/voice wake <phrase>` — arm a wake-word.

## 9) Demo / present integration · [CANONICAL]

How the voice layer cooperates with the demo engine's narration
(prevents double-speaking; pauses STT during AI playback).

## 10) Deployment / lifecycle · [CANONICAL]

### 10.1) Auto-discovery of hooks · [CANONICAL]

### 10.2) Live navigation map · [CANONICAL]

### 10.3) Webhook configuration · [OPTIONAL]

### 10.4) Accessibility alignment · [CANONICAL]

## 11) Testing · [CANONICAL]

### 11.1) Hook coverage validation · [CANONICAL]

Each consumer's offline test rig asserts every actionable element
carries the required hook attributes (Phase 8).

### 11.2) Live map consistency · [CANONICAL]

## 12) Privacy, security, and operating constraints · [CANONICAL]

Required: STT runs in the browser; no audio is uploaded; transcripts
are not logged to disk by default.

## 13) Cross-references · [CANONICAL]

Required links:

- `docs/AGENT.md` — action surface the transcripts dispatch to
- `docs/CHAT.md` — orb host of the mic button and `/voice` command
- `docs/DEMO.md` — narration consumer of the same TTS layer
- `shared/js/voice.js` — canonical voice module (Phase 6)
- `shared/js/slash-catalog.js` — canonical command surface
- `shared/docs/PLAN.md` — harmonization status log

## 14) Changelog · [CONSUMER-SPECIFIC]
