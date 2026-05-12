---
title: "Cross-Repo Harmonization Plan"
description: "Phased plan to harmonize the DEMO, PITCH, AGENT, VOICE, and STYLE feature surfaces across `llm-benchmark`, `dc-planner`, and `cluster-manager` via the shared `webtools-ui/` library (mounted as `shared/` in each consumer). Historical phase narratives below preserve the original `shared-ui` and `gpu-planner` names that pre-date the 2026-05-03 (gpu-planner→dc-planner) and 2026-05-04 (shared-ui→webtools-ui) renames."
date: 2026-05-02
updated: 2026-05-10
status: complete
phase: 9.8g
owner: "Curt Wortman"
category: architecture
tags:
  - harmonization
  - shared-ui
  - cross-repo
  - subtree
---

# Cross-Repo Harmonization Plan

## Scope

Three sibling projects share substantial UI surface area but have drifted
into independent implementations of the same features:

| Repo | Surface area |
| :--- | :--- |
| `llm-benchmark` | LLM inference benchmarking workbench for AMD Instinct GPUs |
| `gpu-planner` | GPU rack/cluster sizing & TCO planner |
| `cluster-manager` | Cluster provisioning, fabric, and switch management |

All three ship a dashboard with: pitch deck, demo mode, chat agent orb,
voice assistance, and a skinning system. The first three repos already
share ~95% of the chrome (same `@page` rules, same Playwright PDF
exporter, same color tokens) but the last few percent of drift compounds
the maintenance burden across every release.

This plan unifies the canonical implementation in a new `shared-ui/`
sibling repo, mounted via `git subtree` as `shared/` in each consumer.

## Architectural decisions (locked in)

| Decision | Choice | Rationale |
| :--- | :--- | :--- |
| Sync mechanism | **`git subtree`** | Survives fresh clones (no submodule UX pain); single git history per consumer; no build step. |
| Canonical orb | **Extract clean `chat-orb.js`** from gpu-planner's 181 KB `chat-feedback.js` | Consumers should not inherit gpu-planner's domain-specific intents. |
| Slash command surface | **Every command everywhere** | Out-of-domain commands return a friendly "not applicable here, try X" no-op. |
| Demo engine winner | **gpu-planner's split-file engine** (`demo-engine.js` + `demo-ui.js` + `demo-voice.js`, file-per-track JSON) | Most modular; cleanest separation of concerns. |
| Doc strategy | **Shared H1–H3 skeleton** | Each repo's docs remain independently readable; per-repo specifics live in clearly-marked appendices. |
| Branch strategy | **Direct to `main`** | Matches existing project habit; tag harmonization commits with `harmonize:` prefix for grep. |
| `shared-ui/` location | `~/workspace/shared-ui/` (sibling) | Matches existing workspace layout. |
| Consumer mount path | **`shared/`** (repo root) | Cleaner `<link>` paths than `vendor/`; explicit-enough for git status to flag drift. |

## Repo layout (target end-state)

```
~/workspace/
├── shared-ui/                    ← canonical source of truth (NEW)
│   ├── css/
│   │   ├── base.css
│   │   ├── chat-orb.css
│   │   ├── notes-panel.css
│   │   ├── demo-engine.css
│   │   └── skins/   (7 canonical skins; was 10 before retiring amber/blue/nebula-light 2026-05-04)
│   ├── js/
│   │   ├── agent-bridge.js
│   │   ├── chat-orb.js
│   │   ├── slash-router.js
│   │   ├── notes-panel.js
│   │   ├── demo-engine.js
│   │   ├── demo-ui.js
│   │   ├── demo-voice.js
│   │   └── voice.js
│   ├── docs/templates/
│   │   ├── DEMO.skeleton.md
│   │   ├── AGENT.skeleton.md
│   │   ├── CHAT.skeleton.md
│   │   ├── VOICE.skeleton.md
│   │   ├── PITCH.skeleton.md
│   │   └── STYLE.skeleton.md
│   └── scripts/
│       └── export-pitch-pdf.mjs
│
├── llm-benchmark/
│   ├── shared/                   ← `git subtree` of shared-ui
│   ├── data/
│   │   ├── demo-tracks/          ← per-repo tour catalogs (NEW schema)
│   │   └── personas/             ← per-repo persona overrides
│   └── pages/
│       └── index.html            ← <link>s into shared/...
├── gpu-planner/
│   └── shared/   data/   pages/  ← same pattern
└── cluster-manager/
    └── shared/   data/   pages/  ← same pattern
```

## Phased rollout

| Phase | Scope | Risk | Effort |
| :---: | :--- | :---: | :---: |
| 0 | Scaffold `shared-ui/` + subtree-mount in all 3 consumers + commit `docs/HARMONIZATION.md` | Low | S |
| 1 | Skin parity (8 skins everywhere) + right-drawer notes ported to other 2 pitch decks + minor comment drift fixes | Low | M |
| 2 | Extract canonical `chat-orb.js` from gpu-planner monolith into `shared-ui/` | Medium | L |
| 3 | Mount canonical orb in all 3 consumers + register `/pitch` and `/demo` slash commands | Medium | M |
| 4 | Register every slash command from every repo in every repo with friendly out-of-domain no-ops | Low | S |
| 5 | Demo engine convergence — port gpu-planner's split-file engine to other 2; migrate JSON/YAML schemas | High | XL |
| 6 | Voice consolidation — promote cluster-manager's STT + wake-word + llm-benchmark's persona/phonetic schema to canonical | Medium | M |
| 7 | Doc skeleton harmonization across DEMO/AGENT/CHAT/VOICE/PITCH/STYLE in all 3 repos | Low | L |
| 8 | Cross-repo CI gate: `test_offline.sh` §25 (vendor hash check + slash command coverage) | Low | S |

## Phase 0 — Scaffold (this commit)

Done in this commit:

- `~/workspace/shared-ui/` initialized as a git repo on `main`.
- Directory skeleton: `css/skins/`, `js/`, `docs/templates/`, `scripts/`.
- This `docs/PLAN.md` and a top-level `README.md`.
- No canonical assets have been promoted yet — Phase 0 is scaffold only.

Next steps in Phase 0 (after this initial commit):

1. `git subtree add --prefix=shared shared-ui main --squash` in each consumer.
2. Each consumer's `Makefile` gains `sync-shared` and `push-shared` targets.
3. Each consumer commits `docs/HARMONIZATION.md` (a copy of this plan).

## Resumption notes

This plan is the single source of truth. Each consumer ships an identical
`docs/HARMONIZATION.md` that links here. When work resumes after a session
break, the next assistant reads this file, finds the highest in-progress
phase, and continues from there. The `## Status log` section below is
appended to as phases complete.

## Status log

- **2026-05-02 — Phase 0 (complete)** — `shared-ui/` scaffolded; subtree
  mounted as `shared/` in all 3 consumers; `Makefile` `sync-shared` /
  `push-shared` targets and pointer `docs/HARMONIZATION.md` committed
  in each consumer.
- **2026-05-02 — Phase 1.1 (complete)** — Skin inventory parity done.
  All canonical skins live only in `shared-ui/css/skins/`; each
  consumer's `pages/*.html`, `js/*.js`, service worker, and skin-picker
  UI now reference `../shared/css/skins/`. Local `css/skins/`
  directories deleted. Consumer API servers
  (`regression_queue_api.py`, `cluster_manager_api.py`) extended with
  `"shared/"` static prefix. (Phase 1.1 originally promoted 8 skins;
  the AMD-branded triplet `amd-gold` / `amd-teal` was added 2026-05-04
  and `amber` / `blue` (Corporate Blue) / `nebula-light` were retired
  the same day — current canonical set is 7.)
- **2026-05-02 — Phase 1.2 (complete)** — `gpu-planner`'s right-drawer
  notes panel CSS promoted to `shared-ui/css/notes-panel.css`. All 3
  consumer `pitch.html` files refactored to link the shared sheet, use
  the canonical `id="notesPanel"` markup, and toggle via
  `classList.toggle('open', open)`. `llm-benchmark` test_offline.sh §9
  updated.
- **2026-05-02 — Phase 1.3 (complete)** — `gpu-planner`'s
  `scripts/export-pitch-pdf.mjs` comment drift fixed (now correctly
  documents `@page { size: 11in 8.5in }`).
- **2026-05-02 — Phase 2 (complete)** — Clean canonical orb extracted
  from `gpu-planner/js/chat-feedback.js` into `shared-ui`:
  `css/chat-orb.css` (orb + panel + LLM settings card visuals),
  `js/chat-orb.js` (mount + slash router + LLM settings + message log,
  built-in `/help` `/clear` `/llm`), `js/slash-router.js` (helpers).
- **2026-05-02 — Phase 3 (complete)** — Canonical orb mounted in
  `llm-benchmark` (new feature, `pages/index.html`) and
  `cluster-manager` (replacing the legacy `js/chat-orb.js` via
  `__cmChatOrbDisabled` flag, across all 9 pages). Per-repo
  `js/chat-orb-mount.js` files register `/pitch` `/demo` `/dashboard`
  `/docs` with consumer-specific branding (`--ai-accent`, title,
  greeting). `gpu-planner` retains its legacy `chat-feedback.js`
  (Phase 2/3 refactor deferred). `llm-benchmark` test_offline.sh §14b
  added with 12 wiring assertions.
- **2026-05-02 — Phase 4 (complete)** — Cross-repo "every command
  everywhere" coverage layer wired in all 3 consumers.
  `shared-ui/js/slash-catalog.js` documents 26 commands across the
  3 consumers; `shared-ui/js/slash-router.js` extended with
  `coverAll({ self })` that registers any catalog command not natively
  handled as a friendly out-of-domain no-op with a hint at the
  sibling consumer that owns it. `llm-benchmark` and `cluster-manager`
  load the catalog and call `coverAll()` from `chat-orb-mount.js`;
  `dc-planner` ships a thin `js/slash-coverage.js` bridge with a
  4-line preIntent hook in `chat-feedback.js` (so `/copilot`,
  `/remediate`, `/tools`, etc. now show a friendly hint, and `/pitch`
  `/demo` `/dashboard` `/docs` work natively for the first time).
  `llm-benchmark` test_offline.sh §14b extended with 5 catalog
  assertions (235/235 pass).
- **2026-05-02 — Phase 5.1 + 5.2 (complete)** — Demo engine convergence
  half 1: `dc-planner`'s 1392-line split-file demo engine
  (`js/demo-{engine,ui,voice}.js`) promoted byte-identical to
  `shared-ui/js/`. Each file got a Phase-5.1 header documenting
  per-consumer domain coupling (agent bridge, snapshot keys,
  launcher selectors). Canonical track schema authored as
  `shared/docs/templates/demo-track.schema.json` (JSON Schema,
  11 action verbs). `dc-planner` switched its `<script>` tags to
  `../shared/js/demo-*.js`, updated SW pre-cache, and deleted the
  byte-identical local copies. `llm-benchmark` and `cluster-manager`
  pulled the shared assets but kept their existing per-domain
  tutors; Phase 5.3 (their migration onto the shared engine) is
  DEFERRED to a later session — the shared engine is available
  whenever they want to consume it.
- **2026-05-02 — Phase 6 (complete)** — Voice consolidation.
  `cluster-manager/js/voice.js` (the richest STT + wake-word + TTS
  implementation) promoted to `shared/js/voice.js` and extended with
  two pluggable layers donated by `llm-benchmark/data/present-script.json`:
  `phoneticReplacements` (whole-word case-insensitive overrides applied
  before TTS, longer keys win, multiple `configure({})` calls MERGE)
  and `personas` (voice / rate / pitch / preferred_voices / lang /
  audience preferences keyed by id, persistent via `setPersona(id)`).
  `version` bumped 1 → 2. `routeTranscript(text)` keeps the single
  intent path: STT → `ChatOrb.dispatch` (preferred) → legacy
  `chatOrb.send` → `chatLLM.handle`. New `/voice persona [list|id|reset]`
  slash subcommand. Canonical config schema authored in
  `shared/docs/templates/voice-config.schema.json`. `cluster-manager`
  9 dashboard pages switched from `js/voice.js` to `shared/js/voice.js`;
  the local file kept (with deprecation banner) only because
  `tests/js/test_voice.js` and `test_agent_traces.js` still load it via
  `vm.runInContext` — Phase 6.4 (deferred) will migrate the tests so the
  local copy can be deleted. `llm-benchmark` test_offline.sh §14d added —
  9 voice-bridge wiring assertions (257/257 pass at this point).
- **2026-05-02 — Phase 7 (complete)** — Doc skeleton harmonization.
  Authored 6 canonical H1-H3 skeletons in
  `shared/docs/templates/{DEMO,AGENT,CHAT,VOICE,PITCH,STYLE}.skeleton.md`,
  each with [CANONICAL] / [CONSUMER-SPECIFIC] section markers and a
  cross-reference table. Each consumer's matching `docs/X.md` got an
  idempotent `<!-- harmonize:phase-7-note -->` blockquote inserted
  right after its H1 pointing at the canonical skeleton. Each
  consumer's `docs/HARMONIZATION.md` got a new "Doc skeleton
  harmonization (Phase 7)" section with the consumer-doc → skeleton
  table. `llm-benchmark` test_offline.sh §14c added — 13 new
  assertions verify the marker is present in every one of the 6 docs
  AND the matching skeleton file is synced. Total: 248/248 pass
  (was 235/235). Existing doc CONTENT was deliberately not rewritten
  (some are 1000+ lines); a follow-up structural-realignment PR per
  doc can adopt the canonical headings where current docs diverge.
  Drift summary in commit messages: STYLE/PITCH/VOICE/CHAT closely
  aligned across all 3; DEMO aligned (dc-planner was donor); AGENT
  most divergent and tagged for follow-up.
- **2026-05-02 — Phase 8 (complete)** — Cross-repo CI gate.
  Authored `scripts/build-vendor-manifest.sh` (sha256+size manifest
  generator), `scripts/vendor-manifest.json` (the manifest itself —
  31 files at this commit), and `scripts/verify-vendor-manifest.sh`
  (consumer-side verifier; auto-locates manifest, parses via python3
  or jq, reports drift / miss with truncated hashes). `llm-benchmark`
  test_offline.sh §25 wires four sub-gates: (a) vendor manifest hash
  match, (b) slash catalog ≥26 commands + `coverAll()` wired, (c) all
  6 Phase 7 doc skeleton markers present, (d) `HARMONIZATION.md`
  tracks the gate. The gate immediately caught real drift — 12 files
  in dc-planner where local edits had renamed `gpu-planner` →
  `dc-planner` in comments and 1 file with `plan.html` → `index.html`.
  Both renames adopted canonically in shared-ui (commits 982b674 +
  539782e), manifest regenerated, all 3 consumers re-synced. Final
  state: 31/31 matched in all 3 consumers; llm-benchmark test_offline.sh
  262/262 pass. The gate works as designed: it caught real cross-repo
  divergence the very first time it ran, and the canonical-rename +
  manifest-rebuild + consumer-resync loop is the documented upstream
  fix workflow.
- **2026-05-02 — Phase 6.4 (complete)** — Voice consolidation finish.
  (a) `cluster-manager/tests/js/test_voice.js` and `test_agent_traces.js`
  switched from `js/voice.js` to `shared/js/voice.js` (12 + 10 tests
  green against the canonical module); the local `cluster-manager/js/voice.js`
  was deleted (no remaining inbound refs once 6 docs were updated to
  point at the canonical path). (b) Authored `llm-benchmark/js/voice-config.js`
  — mirrors `data/present-script.json#/phoneticReplacements` (56 terms)
  and three personas (executive/presales/engineer) with the
  `audience` + `preferred_voices` shape from the schema, registers
  via `voiceBridge.configure({...})` with namespaced storage keys
  (`llm-benchmark-voice-*`), default persona `presales`, and exposes
  `window.LLMBenchmarkVoiceConfig.audience()` for the executive-narrator
  skill. Wired into `pages/index.html` as `shared/js/voice.js` →
  `js/voice-config.js` → `js/chat-orb-mount.js`. (c) Authored
  `dc-planner/js/voice-config.js` — same persona shape as llm-benchmark
  for cross-app voice continuity, but with planner-domain phonetics
  (MI455X, RoCE, NIC, kW, MW, PUE, BOM, RFI, RFP, …, 70 terms) and
  storage keys namespaced `dc-planner-voice-*`. Wired into
  `pages/{index,present,report}.html` BEFORE `slash-coverage.js` so
  `/voice` is reachable through `chat-feedback.js`'s preIntent hook.
  Service worker bumped to `dc-planner-v68` and pre-cache extended
  with `shared/js/voice.js`, `js/voice-config.js`, `js/slash-coverage.js`,
  `shared/js/slash-{catalog,router}.js`. (d) `llm-benchmark`
  test_offline.sh §14e added — 16 new wiring assertions (file exists,
  `configure()` called, 5 phonetic terms covered, 3 personas registered,
  defaultPersona set, accessor exposed, voice.js + voice-config.js
  loaded in `pages/index.html` AND voice.js loads BEFORE chat-orb-mount.js).
  Final: 278/278 pass (was 262/262). End state for Phase 6: every
  consumer loads a single canonical voice bridge with consumer-specific
  phonetics + personas; Phase 6.4 closes out the deferred sub-phase.

- **2026-05-02 — Phase 5.3a (complete)** — Canonical demo tracks for
  the two non-donor consumers. Authored:
    - `llm-benchmark/data/demo-tracks/onboarding.json` (7 scenes, 14
      steps, Aria/Jenny voice 0.95) — port of the legacy
      `data/demo-tours.json` onboarding tour into the canonical
      track schema.
    - `llm-benchmark/data/demo-tracks/presales.json` (6 scenes, 10
      steps, Aria/Jenny voice 0.92) — customer-facing variant
      tilted at SLOs / baseline diffs / report deliverable.
    - `llm-benchmark/data/demo-tracks/engineering.json` (6 scenes,
      14 steps, Guy/Daniel voice 1.0) — technical-deep-dive variant
      covering Profile categorization rules and Report
      recommendation logic.
    - `cluster-manager/data/demo-tracks/onboarding.json` (9 scenes,
      12 steps) — covers Install / Status / Network / Fabric /
      Monitor / Test / Debug. Coexists with the existing
      fixture-driven `pages/demo.js` (different system; canonical
      track feeds the shared engine when wired).
  All 4 tracks validate clean against
  `shared/docs/templates/demo-track.schema.json` (action enum, id
  patterns, required fields). `llm-benchmark` test_offline.sh §14f
  added — 7 new assertions (schema file present, 3 track files
  present + parse + schema-shape). HARMONIZATION.md updated in all 3
  consumers (dc-planner gets a "Canonical demo tracks" section
  cross-referencing sister-consumer track inventories);
  `docs/DEMO.md` in llm-benchmark + cluster-manager get a
  `<!-- harmonize:phase-5.3-note -->` blockquote with the engine-swap
  migration checklist. The engine-swap second half of Phase 5.3
  (wiring `shared/js/demo-engine.js` into `pages/index.html` as an
  opt-in `/demo-shared <track>` slash, with `data-agent-hook`
  annotations on dashboard elements) is intentionally scoped to a
  separate per-consumer PR. Final test_offline.sh: 285/285 pass
  (was 278/278).

- **2026-05-03 — Phase 5.3f / 5.3g / 5.3h (complete)** — Engine wire-up
  for the canonical tracks. Three layers:
    - **Phase 5.3f (engine ↔ schema alignment)** — `shared/js/demo-engine.js`
      previously implemented 5 of the 11 schema-enum action types
      (some under different names: `switch_tab` not `navigate`,
      `load_scenario` not `set_state`). This commit aliased
      `navigate` → `switch_tab`, `set_field` → `fill`, added a
      proper `set_state` handler that calls
      `bridgeCall("set_state", action.params)` (distinct from
      `load_scenario` which fetches a URL), and added `expect` /
      `assert` as no-op success that emits an `assert` event for a
      future regression-harness subscriber. The test_offline.sh §14g
      gate now asserts the engine handles every schema enum action.
    - **Phase 5.3g (llm-benchmark wire-up)** — Authored
      `llm-benchmark/js/demo-bridge.js` (174 lines, lazy engine
      instantiation, fetches a track from `data/demo-tracks/<id>.json`,
      registers `/demo-shared <track>` on the canonical orb with
      `status` / `list` / `exit` subcommands, exposes
      `window.SharedDemo.{start,stop,status,knownTracks}`).
      `pages/index.html` loads the engine modules with `defer` (lazy)
      and the bridge WITHOUT defer so the slash registers BEFORE
      `chat-orb-mount.js` calls `SlashRouter.coverAll()`. Legacy
      `/demo` + `js/dashboard-tutor.js` remain the live default.
      test_offline.sh §14g added — 16 new assertions for bridge
      presence, track advertisement, script-load order, schema
      alignment, and slash-catalog coverage. Total: 301 / 301.
    - **Phase 5.3h (cluster-manager wire-up)** — Authored
      `cluster-manager/js/demo-bridge.js` (164 lines, same shape as
      llm-benchmark's, but lists only the single `onboarding`
      track that ships today). All 9 dashboard pages
      (index/install/status/monitor/test/fabric/network/debug/present)
      now load the engine modules + bridge in the correct order.
      Legacy `/demo` + `pages/demo.js` (fixture-driven) remain the
      live default. Tests: `make agent-tests-py` 72 / 72,
      `make agent-tests-js` 13 + 10 traces, `make check-fixtures`
      passes, vendor manifest 31 / 31.
  Slash catalog (`shared/js/slash-catalog.js`) gained a
  `/demo-shared` entry so cross-repo `coverAll()` advertises it as a
  friendly out-of-domain reply when the bridge isn't loaded.

- **2026-05-03 — Phase 7r (complete)** — Structural realignment of
  `docs/AGENT.md` in all 3 consumers to the canonical 13-section
  `AGENT.skeleton.md`. The three docs predate the canonical skeleton
  and ship 487 / 1300 / 1550 lines of richly structured per-consumer
  content (R-* tracks in cluster-manager, catalog-update + embedded-
  LLM agent in dc-planner, validators + helper tools + golden
  trace runner in llm-benchmark). Rather than renumber every section
  (which would invalidate every internal cross-reference and every
  `[[ROADMAP]]` / `[[PRD]]` / `[[SKILLS]]` callout), each consumer's
  AGENT.md now ships:
    - a `<!-- harmonize:phase-7-crosswalk -->` table block right
      after the existing phase-7-note, mapping each canonical
      skeleton section (1-13) to where its content lives in this
      consumer's doc; and
    - three brief "Canonical: ..." pointer sections at the end of
      the doc (Slash commands / Skin / theme awareness / Changelog)
      wrapped in `<!-- harmonize:phase-7-canonical-stubs -->`
      markers, covering the canonical sections (§8 / §9 / §13) that
      didn't have a natural home in the existing structure.
  The treatment is content-additive only — no existing section is
  renumbered, deleted, or moved. `llm-benchmark/test_offline.sh §14h`
  added — 6 new assertions (both marker blocks present + crosswalk
  lists all 13 canonical sections + 3 expected stub headings).
  Final test_offline.sh: 307 / 307 PASS. Per-consumer commits:
  llm-benchmark cbafc17, cluster-manager a0862fd, dc-planner 91bf91e.

- **2026-05-03 — Phase 9 (complete)** — Live cross-repo dev mode.
  Replaced the 31-file `git subtree` mount of `shared/` in every
  consumer with a relative symlink (`shared -> ../shared-ui`) so
  canonical edits in `~/workspace/shared-ui/` reflect instantly across
  all 3 consumers without `git subtree pull`/`push` round-trips.
  Motivation: the subtree workflow had two friction points in active
  multi-consumer development — (a) `git subtree pull --squash` refuses
  to run with ANY uncommitted changes anywhere in the consumer's
  working tree, even paths unrelated to `shared/`, and (b) a single
  canonical edit requires N+1 commits (one in `shared-ui` + one
  squash-merge in each of the N consumers) just to fan out. The
  symlink eliminates both: edits in `shared-ui/` are visible in every
  consumer at the next file read, and consumer `git status` is
  unaffected by `shared-ui` working-tree state.
  Verified end-to-end:
    - `md5sum` on `shared/css/base.css` matches across `shared-ui` and
      all 3 consumer `shared/` paths after a one-line edit, with no
      sync command run.
    - `bash shared/scripts/verify-vendor-manifest.sh` reports
      `matched=31 / 31 · drift=0 · missing=0` from inside each of the
      3 consumers (the verifier's `find`/`sha256sum` calls follow the
      symlink transparently).
    - `llm-benchmark test_offline.sh` still passes 307 / 307,
      including §14 (skin system), §14b (canonical chat orb wiring),
      §14c-h (Phase 7/5.3/6.4/7r markers), and §25 (Phase 8
      cross-repo CI gate).
  Per-consumer commits (each: 1 swap + 1 Makefile/script update):
    - `llm-benchmark`: 8383693 + 44cea46
    - `cluster-manager`: 004b395 + 8b2c83f
    - `dc-planner`: ef553ad + a64f684
  `Makefile` `sync-shared` / `push-shared` / `shared-status` targets
  are now symlink-aware: `sync-shared` is a no-op that announces the
  symlink mode; `push-shared` directs the user to commit in
  `shared-ui` directly; `shared-status` reports the symlink target +
  `shared-ui` HEAD + dirty count. New `make shared-restore` target
  invokes the new `scripts/restore-shared-subtree.sh` (idempotent;
  removes the symlink, re-adds the subtree, commits — for CI runners
  or fresh clones without the sibling repo present). A
  `pre-symlink-shared` git tag was placed in each consumer at the
  pre-conversion commit for instant rollback (`git reset --hard
  pre-symlink-shared`). The Phase 8 vendor manifest gate continues to
  function unchanged because `find` + `sha256sum` follow symlinks; the
  `shared-ui` repo itself is unchanged (still local-only at
  `~/workspace/shared-ui/`).

- **2026-05-03 — Phase 9.5 (complete)** — Phase 2/3 dc-planner
  migration formally **not pursued**; dual-orb hybrid recorded as
  permanent design decision. The Phase 3 status entry (above) noted
  *"`gpu-planner` retains its legacy `chat-feedback.js` (Phase 2/3
  refactor deferred)"* — a 6-week-old deferral that this entry
  closes out as a permanent commitment, not pending work.
  **Investigation summary** (`chat-feedback.js`, 3925 lines):
    - Dispatcher for ~12 dc-planner-native slashes (`/llm` `/skills`
      `/skill` `/undo` `/redo` `/journal` `/validate` `/privacy`
      `/solve` `/explain` `/memory` `/workshop`) — unlike
      llm-benchmark / cluster-manager where the legacy orb was a
      thin shell and dispatch lived in separate modules.
    - 6-step interactive feedback intake (`state.feedback.step` 1→6:
      type → title → description → reproduction → severity →
      contact_email) with custom UI prompts at each step.
    - Workload-definition flow with similar guided structure.
    - `.ai-quick-menu` custom right-side quick-reply UI.
    - **157 `addMessage()` call sites + 100 `ui.*` DOM refs**
      throughout the dispatcher; canonical `chat-orb.js` has zero
      multi-step / quick-reply / inline-form primitives.
  **Why this is not a 3-5h job**: a headless-dispatcher migration
  would either drop the rich UX (plain-text re-route, regression),
  keep the legacy orb visible for those flows (defeats the
  migration), or require extending canonical orb with multi-step /
  quick-reply / inline-form primitives (becomes its own multi-week
  cross-repo Phase 9.6+ initiative). None of these match the
  ~3-5h scoping that motivated retrying Phase 2/3 today.
  **Functional parity confirmed**: dc-planner is fully harmonized
  at every user-visible layer — cross-repo nav slashes via
  `slash-coverage.js`, canonical demo engine via direct
  `shared/js/demo-*.js` load, canonical voice via
  `shared/js/voice.js`+`voice-config.js`, `#aiDemoBtn` (`play_circle`
  left of gear) for Demo-button parity (commit `55181f3`), 8 skins +
  vendor manifest + doc skeletons via the symlinked `shared/`.
  The only thing dc-planner does not share is the underlying
  `chat-orb.js` code; user-visible behavior is harmonized.
  **Revisit conditions** (any one):
    - dc-planner's dispatcher is extracted from UI for unrelated
      reasons (testing isolation, plugin architecture).
    - Canonical chat-orb gains first-class multi-step + quick-reply
      primitives whose cross-repo cost is judged worth carrying.
    - A future consumer (#4) needs the same dispatch surface,
      making per-handler extraction valuable beyond dc-planner.
  Until any hold, **the dual-orb hybrid is the final state for
  dc-planner**. See `dc-planner/docs/HARMONIZATION.md` §"Dual-orb
  hybrid: intentional design decision (Phase 9.5)" for the
  consumer-side reference.

- **2026-05-03 — Phase 9.6 (complete)** — Demo-chrome opt-out gate +
  cluster-manager `/demo` arg bug fix + cross-repo fresh-clone
  bootstrap docs + llm-benchmark Demo-button parity test gate. A
  focused follow-up after the 9.5 closeout that locked in three
  cross-repo loose ends discovered while sweeping for residual WIP.
  **(a) Opt-out gate** — `shared/js/demo-ui.js` boot() now early-
  returns when `window.__demoUiSkipAutoBoot === true`, so non-
  canonical consumers (llm-benchmark, cluster-manager) can keep
  `demo-engine.js` + `demo-voice.js` loaded for the optional
  `/demo-shared` slash bridge **without** the canonical body-level
  `.demo-player` chrome auto-mounting and 404'ing on the missing
  `css/demo-mode.css` (which only dc-planner ships — llm-benchmark's
  CSS is `css/dashboard-tutor.css`, cluster-manager's is
  `pages/demo.css`). dc-planner does NOT set the flag, so it
  continues to auto-boot exactly as before; it is the canonical
  consumer for this widget. Commits: `shared-ui ca2db9f`
  (`feat(demo-ui): add window.__demoUiSkipAutoBoot opt-out gate`,
  +15 lines with rationale comment naming each consumer);
  `shared-ui 05abc43` (manifest regen — `js/demo-ui.js` sha
  `26b47644` → `d45b4f2b`, size `20615` → `21477`); `llm-benchmark
  fb48625` (`pages/index.html` opt-out + 9-line rationale);
  `cluster-manager 79a2653` (9-page opt-out sweep — `debug, fabric,
  index, install, monitor, network, present, status, test`).
  **(b) cluster-manager `/demo` arg bug** (rode along in `79a2653`)
  — `pages/demo.js` `api.start()` expects `{mode: "..."}` (object),
  but the orb's `/demo` slash handler in `js/chat-orb-mount.js` was
  passing a bare string. Result: `/demo auto` and `/demo training`
  silently fell back to the `manual` default because `opts.mode`
  was undefined for any non-object argument. Fixed by wrapping the
  arg as `{ mode: token }` and adding a mode-validation arm that
  rejects unknown tokens with a usage hint instead of silently
  starting the wrong demo. **(c) Fresh-clone bootstrap docs** —
  added a "Fresh-clone bootstrap (post-Phase 9 symlink mode)"
  subsection to each consumer's `docs/HARMONIZATION.md` (commits
  `llm-benchmark 87e61fb`, `cluster-manager 8a8cccf`, `dc-planner
  e425541`) covering the three recipes for resolving the dangling-
  symlink failure mode that a fresh `git clone` will hit unless
  `~/workspace/shared-ui/` is present alongside: (1) sibling clone
  of shared-ui (preferred), (2) `make shared-restore` to re-
  materialize the subtree mount (CI-friendly), (3) retarget the
  symlink (rare). All three consumers' `make shared-status` is
  documented as the mode-detection probe. **(d) Demo-button parity
  gate** (in `llm-benchmark 87e61fb`) — `test_offline.sh §14i`
  adds 6 assertions defending llm-benchmark's specific Demo-button
  contract: `js/chat-orb-mount.js` opts into `showDemoBtn:true`,
  provides an `onDemoClick` handler bridging to
  `DashboardTutor.openLauncher` (so the in-orb button matches the
  `/demo` slash command registered just below it), and
  `shared/js/chat-orb.js` declares + gates + renders `#chatDemoBtn`
  with the `play_circle` icon. Defends regression from either side
  (consumer drops the opt-in, or canonical drops the primitive).
  Test count: 307 → 313, all pass. **All gates after this phase**:
  vendor manifest 31/31 / drift=0 in all 3 consumers;
  `test_offline.sh` 313/313 PASS in llm-benchmark; clean working
  trees across all 4 repos.

- **2026-05-04 — Phase 9.7 (complete)** — Tutor-bar promotion + canonical
  CSS file. The canonical narrated-demo player chrome rendered by
  `shared/js/demo-ui.js` was rebuilt to mirror the
  `llm-benchmark/css/dashboard-tutor.css` `.tutor-bar` look — the floating
  bottom-center pill with `[DEMO]` badge, prev / play-pause / next
  controls, scene counter `<b>step+1</b> / total`, restart (↺ / R),
  voice mute (🔊 / M), transcript toggle (T), and a red `EXIT` pill —
  so the canonical chrome finally matches the visual + control surface
  of the llm-benchmark legacy demo that users (and the dc-planner
  owner) preferred. Three sub-changes:
  **(a) `shared/js/demo-engine.js` API additions** — added `restart()`
  (rewinds cursor to (0,0) and resumes prior phase), `setMuted(bool)` /
  `isMuted()` (pass-through to the voice provider, gates speech without
  affecting the playback loop's step-advance timing), and
  `getProgress()` (returns `{ sceneIdx, sceneCount, stepIdx, stepsInScene,
  totalStep, totalSteps }` so the chrome's counter has a single source
  of truth). All exported on the engine instance returned by `create()`.
  **(b) `shared/js/demo-voice.js`** picked up `setMuted(bool)` and
  `isMuted()`. Muted `speak()` calls resolve `{ ok: true, reason: "muted" }`
  immediately so the engine's auto-advance still ticks.
  **(c) `shared/js/demo-ui.js`** — `createUi()` rewritten to emit the
  tutor-bar markup (preserving the `demo-player`* class namespace so
  existing tests + per-consumer overrides keep working); `M` and `R`
  keybindings added; `ensureCss()` href moved from `../css/demo-mode.css`
  (which only resolved correctly inside dc-planner) to
  `../shared/css/demo-mode.css` (resolves the same way from any
  consumer's `pages/<name>.html`).
  **(d) `shared/css/demo-mode.css`** — new canonical stylesheet (was
  the unused `shared/css/demo-engine.css` placeholder). Contains the
  tutor-bar palette and selectors plus the launcher chip / transcript
  panel / highlight ring / toast styles previously in
  `dc-planner/css/demo-mode.css`. Light-skin tokens auto-flip via
  `html[data-theme="light"]` and 3 light-skin attribute hooks.
  **Cross-consumer impact**: cluster-manager + llm-benchmark continue
  to ship their legacy chrome as the live default
  (`pages/demo.js` / `js/dashboard-tutor.js`); their opt-in
  `/demo-shared` slash now mounts the new tutor-bar chrome instead of
  the old icon-button player. The `window.__demoUiSkipAutoBoot`
  Phase 9.6 gate continues to suppress body-level chrome on pages that
  don't want it, so this is a no-op for any page that opted out.
  **dc-planner** is the canonical adopter — `pages/index.html` now
  `<link>`s `../shared/css/demo-mode.css`, the local
  `dc-planner/css/demo-mode.css` is removed, the SW cache list moved
  the entry from `css/demo-mode.css` → `shared/css/demo-mode.css` and
  bumped `dc-planner-v68 → v69`. Test gates: dc-planner
  `tests/self-check.sh §13` extended with the 3 new engine functions,
  the 5 new player-chrome class selectors, and the new
  `setMuted()` voice hook (487 → 492 structural assertions); a new
  `tests/e2e/16-demo-mode.spec.js` test "*tutor-bar: DEMO pill, scene
  counter, restart and mute render and respond*" exercises the
  promoted chrome end-to-end against a real browser.

- **2026-05-04 — Phase 9.7.1 (complete)** — Side-nav launcher chip
  opt-out + dc-planner `/demo` slash bug fix. A small follow-up to
  9.7 that makes dc-planner's demo entry points match its actual UX
  surface — the new always-visible tutor-bar player chrome plus the
  chat orb's existing `#aiDemoBtn` (`play_circle`, left of the gear)
  made the side-nav `.demo-launcher` chip in the top-left corner
  redundant and visually noisy. Three sub-changes:
  **(a) New opt-out gate in `shared/js/demo-ui.js`** —
  `window.__demoUiSkipLauncher` is checked at the top of
  `injectLauncher()`. When set BEFORE the script loads, the entire
  engine still boots (player / transcript / highlight / keyboard /
  `DcDemo` namespace / URL-param autoload) but the chip is never
  created. Symmetric with the Phase 9.6 `__demoUiSkipAutoBoot` gate
  that suppresses the entire boot. Sister consumers
  (cluster-manager, llm-benchmark) opt out of the entire boot via
  `__demoUiSkipAutoBoot` so they're unaffected by this change.
  **(b) dc-planner adoption** — `pages/index.html` sets
  `window.__demoUiSkipLauncher = true` on a `<script>` tag
  immediately preceding the `shared/js/demo-ui.js` load (with a
  rationale comment naming the three replacement entry points).
  SW cache bumped `dc-planner-v69 → v70`.
  **(c) `/demo` slash bug fix in dc-planner `js/slash-coverage.js`** —
  the Phase 4 cross-repo `/demo` handler was calling
  `window.DemoEngine.start({ source: "/demo slash" })`, but
  `DemoEngine` is the namespace `{ create, SNAPSHOT_KEY }` (not an
  instance with `.start`). Calling `.start` on it threw and silently
  fell through to a `?demo=manual` redirect that loaded nothing
  (no `manual.json` track exists). Now calls `window.DcDemo.start(track)`
  to match the orb's `#aiDemoBtn` handler exactly, so all four
  surfaces (orb button, `/demo` slash, `?demo=<track>` URL param,
  direct `DcDemo.start(...)` JS API) fire the same path. The slash
  handler also accepts an optional track arg (`/demo onboarding`,
  etc.).
  **Test gates**: dc-planner `tests/self-check.sh §13h.1` adds 3
  structural assertions (flag set + flag-before-script + gate-in-
  shared-ui); `§13h.2` adds 1 assertion (no broken `DemoEngine.start`
  reference in `slash-coverage.js`). Structural count: 492 → 496.
  Playwright `tests/e2e/16-demo-mode.spec.js` inverts the prior
  "launcher chip mount" assertion to "launcher chip suppressed +
  `#aiDemoBtn` renders" and adds a new test exercising the `/demo`
  slash end-to-end via `SlashCoverage.tryHandle("/demo")`.
  Cross-repo impact: `shared-ui 6bd9de1` (Phase 9.7) is unchanged;
  this phase is a single small additive edit (the opt-out gate)
  plus one consumer-side commit in dc-planner.

- **2026-05-04 — Phase 9.7.2 (complete, dc-planner-only)** — Page-header
  `.hero-icon-btn` style harmonized with sister consumers
  (llm-benchmark + cluster-manager). The chat-orb header buttons
  (`.ai-btn-icon`) were already byte-identical across all three
  dashboards (canonical `shared/css/chat-orb.css` ≡ inline copy in
  `dc-planner/js/chat-feedback.js`), but the **page-header toolbar**
  icon buttons (`#undoBtn`, `#redoBtn`, `#loadConfigBtn`,
  `#saveConfigBtn`, `#generateReportBtn`, `#heroSidebarToggle`,
  `#themeToggle`, `#skinMenuBtn`) used a richer hover-plate /
  focus-ring / pressed-state design (`6px` rounded plates, soft
  `--hover-plate` bg-tint, scale-down on click, focus-ring halo,
  `[aria-pressed="true"]` / `.is-active` / `[aria-expanded="true"]`
  plate) that visibly diverged from the sharp 0-radius squares with
  opacity-only hover that the sister consumers' `css/base.css`
  define for the same selector. dc-planner was downgraded to match
  the sister-consumer baseline verbatim (rather than promoting the
  rich style upward). No `shared-ui` changes — this is a one-file
  CSS rewrite in `dc-planner/css/dc-planner.css` (~92 lines → ~35
  lines), an SW bump (`v70 → v71`), 5 new `tests/self-check.sh`
  structural assertions, and a `docs/HARMONIZATION.md` entry.
  Functional consequence (deliberate): `#skinMenuBtn` no longer
  renders a background plate while its dropdown is open
  (`aria-expanded="true"`); the dropdown itself is the only "open"
  indicator, exactly matching how the sister dashboards behave.

- **2026-05-04 — Phase 9.8a (complete)** — `shared/css/base.css`
  promoted from a 10-line "Phase 0 placeholder" to the canonical
  baseline page chrome shared by all three sibling consumer
  dashboards. The new file is verbatim from `llm-benchmark/css/
  base.css` (275 lines): box-sizing reset, body typography, fixed
  `.hero` 40-px top bar, `.hero-toolbar` + the harmonized
  `.hero-icon-btn` (Phase 9.7.2), Material Symbols defaults, skin
  picker chrome, page layout primitives (`.page` / `.panel` /
  `.row`), summary chip strip (`.stats` / `.stat`), table chrome
  (`table` / `th` / `td`), tab strips (`.hero-tabs` + `.tabs` +
  `.tab-btn` + `.tab-icon`), `<button>` defaults, form controls,
  `:focus-visible` accent ring, `.bom-delete-btn`, utility classes
  (`.hint` / `.warning` / `.actions`), and `@media print` collapse
  rules. **dc-planner is the canonical adopter**: `pages/index.html`
  now `<link>`s `../shared/css/base.css` BEFORE
  `../css/dc-planner.css` (so the canonical baseline wins where
  dc-planner doesn't have a per-repo override, and dc-planner's
  later-loading rules still win where it intentionally diverges).
  The user-visible win: dc-planner's page-header tab strip
  (`.hero-tabs .tab-btn`) loses its chunky 16px-text override and
  inherits the canonical 0.68rem small-bold-tag look from the
  shared baseline, exactly matching what sister consumers render.
  dc-planner.css's per-repo `.hero-tabs .tab-btn` /
  `.hero-tabs .tab-icon` / `.tab-btn` body / `.tab-btn:hover` /
  `.tab-btn.active` / `.tab-icon` rules are deleted (the canonical
  version now owns them). The remaining ~20 dc-planner per-repo
  duplicates (`<body>` typography, `<input>` hardcoded colors,
  custom select arrow data URI, etc.) stay as deliberate per-repo
  overrides — they're flagged with a comment block pointing at
  Phase 9.8b/c for future decanonicalization.
  **Sister consumer migration is deferred to Phase 9.8b** — for
  now, llm-benchmark + cluster-manager continue to load their own
  `css/base.css` (which is byte-identical to the new canonical for
  llm-benchmark, and 99% identical for cluster-manager — the latter
  carries 3 lines of `.hero-toolbar` border tweaks and a
  `var(--ui-header)` color override that'll move into a per-repo
  override stylesheet when 9.8b lands).

## Initiative status: complete

All 8 phases plus all deferred follow-ups complete (6.4, 5.3a, 5.3f /
g / h, 7r), Phase 9 (live dev mode via symlink), Phase 9.5
(dc-planner dual-orb hybrid recorded as permanent design decision),
Phase 9.6 (demo-chrome opt-out gate + cluster-manager `/demo`
arg bug fix + cross-repo fresh-clone bootstrap docs + llm-benchmark
Demo-button parity test gate), Phase 9.7 (tutor-bar promotion of
the canonical player chrome from llm-benchmark/dashboard-tutor.js +
new canonical `shared/css/demo-mode.css`), Phase 9.7.1 (side-nav
launcher chip opt-out gate `__demoUiSkipLauncher` +
dc-planner-side `/demo` slash bug fix), Phase 9.7.2
(`.hero-icon-btn` page-header style harmonized with sister
consumers, dc-planner-only), Phase 9.8a (`shared/css/base.css`
promoted from placeholder to canonical baseline; dc-planner is the
first consumer; sister-consumer migration deferred to 9.8b), and
Phase 9.8c (operational rename of the upstream UI repo from
`shared-ui` to `webtools-ui` — symlinks, git remotes, Makefiles,
scripts, and operational doc headers updated across all 3
consumers; historical phase narratives intentionally preserved as
archival record). The canonical narrated-demo engine is
wired into all 3 consumers via `/demo-shared`. All 3 consumers'
`docs/AGENT.md` files carry the canonical skeleton crosswalk + stub
sections so the canonical spine is fully represented and
discoverable. Legacy `/demo` slashes + per-consumer demo systems
remain the live default and coexist intentionally with the canonical
engine during the migration window. As of Phase 9, `shared/` in each
consumer is a symlink to `~/workspace/shared-ui/` — canonical edits
propagate instantly with no sync step. The `git subtree` workflow
remains available via `make shared-restore` for CI / fresh-clone
scenarios that need a self-contained checkout. As of Phase 9.8c,
the upstream repo lives at `~/workspace/webtools-ui/` (renamed from
`~/workspace/shared-ui/` on 2026-05-04); each consumer's `shared/`
symlink, local-path git remote, Makefile, and operational docs all
point at the new path/name. As of Phase 9.5,
dc-planner's dual-orb hybrid (legacy `chat-feedback.js` +
`slash-coverage.js` bridge + `#aiDemoBtn`) is the recorded final
state, not deferred work; the chat-orb migration that was deferred
on 2026-05-02 has been formally closed-out after a focused
investigation confirmed the original deferral was correct. As of
Phase 9.6, the canonical demo-chrome auto-mount is opt-out via
`window.__demoUiSkipAutoBoot` so non-canonical consumers don't 404
on missing player CSS, the cluster-manager `/demo {auto,training}`
silent-fallback bug is fixed, all 3 consumers carry a fresh-clone
bootstrap recipe in `docs/HARMONIZATION.md`, and llm-benchmark's
`test_offline.sh §14i` defends the cross-repo Demo-button contract
against regression from either side. All cross-repo gates green:
vendor manifest 31/31 / drift=0 across all 3 consumers,
`test_offline.sh` 313/313 PASS in llm-benchmark, working trees clean
across all 4 repos.

- **2026-05-04 — Demo-content revamp (complete)** — Audience triptych
  aligned 1:1 with the Standard / Advanced / Expert user-mode picker
  across all 3 consumers. Durations authored to user guidance
  (~5 / 10 / 15 min), content depth designed by mode: Onboarding
  describes Standard tabs for new users + customer presales (why the
  tab exists, benefits of capabilities, closes with a 3-panel
  mode-upgrade preview); Advanced layers deeper technical description
  of each tab plus the features the Advanced unlock reveals; Expert
  gives the most detailed technical understanding including per-scene
  pro-insight ribbons (numeric benchmarks, pitfalls, trade-offs).
  Each track opens with a `set_state { mode }` action so target tabs
  are visible before navigation begins. Shared creative enhancements:
  persona-driven narrative arc per audience, explicit per-scene mode
  cues, consistent "open the feedback button / hit R to restart"
  sign-off. Deliverables: **nine canonical tracks** across three
  consumers — `llm-benchmark/data/demo-tracks/{onboarding,advanced,expert}.json`
  (renamed from `{onboarding,presales,engineering}.json` — legacy
  filenames retired), `cluster-manager/data/demo-tracks/{onboarding,advanced,expert}.json`
  (two net-new files), `dc-planner/data/demo-tracks/{onboarding,advanced,expert}.json`
  (all three net-new; dc-planner's flagship interactive `presales.json`
  is preserved unchanged as a fourth tactile track). Plus
  `llm-benchmark/data/demo-tours.json` mirrored 1:1 (DashboardTutor is
  llm-benchmark's live default engine). Cross-repo wiring:
  `shared-ui/js/demo-ui.js` `REGISTERED_TRACKS` expanded from
  `["presales"]` to `["onboarding", "advanced", "expert", "presales"]`
  with `DEFAULT_TRACK` flipped `presales → onboarding`; each consumer's
  `js/demo-bridge.js` `KNOWN_TRACKS` advertises the canonical slugs
  over the `/demo-shared` slash. Per-consumer test harnesses updated:
  llm-benchmark `test_offline.sh §14f` TRACKS list + `§14g` bridge
  catalog, dc-planner `tests/self-check.sh §13i2` schema validation
  for the 3 new tracks + `scripts/audit-demo-tracks.mjs` verb list
  extended with `navigate`/`set_state`/`set_field` (already engine-supported)
  and MAX_TRACK_MINUTES bumped 12→20 for the Expert track. Opportunistic
  fix in dc-planner `js/sw.js`: `css/demo-mode.css` → `shared/css/demo-mode.css`
  (reflecting the Phase 9.7 promotion; the SW was caching a stale path)
  and cache name bumped `v68 → v69`. All cross-repo gates green:
  vendor manifest 32/32 · drift=0 across all 3 consumers,
  llm-benchmark `test_offline.sh` 316/316 PASS, dc-planner
  `tests/self-check.sh` 530/530 PASS (Playwright E2E 179/181 passed
  with 2 skipped, 0 failed). Commits: shared-ui _(pending)_,
  llm-benchmark _(pending)_, cluster-manager _(pending)_,
  dc-planner _(pending)_.

- **2026-05-04 — Phase 9.8c (complete) — directory rename: shared-ui →
  webtools-ui.** Operational rename of the upstream UI repo. The user
  manually changed the directory name `~/workspace/shared-ui/` →
  `~/workspace/webtools-ui/` (and set up a new GitHub origin at
  `https://github.com/cwortman-amd/webtools-ui`, replacing the
  never-pushed `cwortman-amd/shared-ui` remote that had been added
  the day before). The new repo was a fresh `git init` rather than a
  rename, so the prior 42-commit shared-ui history was intentionally
  retired in favor of a clean slate (working tree carried over
  byte-identical, plus a parity `.gitignore` commit landed as
  webtools-ui's second commit). All three sister consumers
  (`dc-planner`, `llm-benchmark`, `cluster-manager`) need to follow
  the rename or their `shared/` symlinks dangle and their `make
  sync-shared` Makefile + `scripts/restore-shared-subtree.sh`
  fallback both point at a path that no longer exists. Five sub-
  changes per consumer (identical migration shape across all three):
  - **Symlink repointed**: `shared/` target `../shared-ui` →
    `../webtools-ui` (committed; mode 120000; same blob hash
    `fbdb649d…` across all three consumers — confirms the symlink
    target string is identical post-migration).
  - **Git remote renamed**: `git remote rename shared-ui webtools-ui`
    + `git remote set-url webtools-ui /home/cwortman/workspace/
    webtools-ui`. Remote NAME chosen to follow the directory NAME for
    consistency with the rename.
  - **Makefile + scripts/restore-shared-subtree.sh updated**:
    `~/workspace/shared-ui/` → `~/workspace/webtools-ui/` paths,
    `git subtree pull --prefix=shared shared-ui main` → `… webtools-ui
    main` remote-name refs, `ln -s ../shared-ui shared` → `ln -s
    ../webtools-ui shared` symlink hints. Top-of-file comment block
    in each documents the rename history so future-you can trace it
    without spelunking git log.
  - **Code-comment path refs**: `llm-benchmark/scripts/
    regression_queue_api.py` line 172, `cluster-manager/scripts/
    cluster_manager_api.py` line 612, `llm-benchmark/test_offline.sh`
    §14 + §25 — all comment blocks describing where `shared/` is
    mounted from now name `webtools-ui` (with a "was shared-ui pre
    2026-05-04 directory rename" callout for traceability).
  - **Operational doc updates**: each consumer's `docs/HARMONIZATION.
    md` operational header (lines 1-138 — Quick reference / Initial
    subtree setup / Fresh-clone bootstrap / Detecting which mode
    you're in / Why this exists) updated to reflect the new path +
    remote name; cluster-manager `docs/INDEX.md` cross-repo
    harmonization paragraph updated; dc-planner `pages/index.html`
    base.css link comment + `README.md` directory-tree caption
    updated; cluster-manager `pages/*.html` (9 files) voice-bridge
    promotion comments updated. Historical phase narratives (CHANGELOG
    entries, deep Phase 9.x sections in HARMONIZATION.md, `STYLE.md`,
    `DEMO.md`) were intentionally **left intact** — they describe
    what landed in the upstream repo at the time it was named
    shared-ui, and rewriting them would be a 50+ file sweep that
    falsifies historical context for no functional benefit.

  **What did NOT change**: the symlink directory NAME inside
  consumers (`shared/` — that's an internal mount point unrelated to
  the upstream repo name), and the conceptual "shared-ui" name in
  historical phase docs (the directory rename is a deployment-layer
  rename, not a project-identity rename — calling out "promoted to
  shared-ui in Phase 5.1" in CHANGELOG entries is still accurate
  history). The deferred Phase 9.8b sister-consumer base.css
  migration is unaffected — it remains queued.

  **Old directory disposition**: `~/workspace/shared-ui/` deleted
  (after verifying no consumer symlink resolved to it any longer).
  User retains a separate `~/workspace/shared-ui.old/` backup created
  manually before the rename — that backup is untouched and stays as
  archival reference. Final workspace state: `~/workspace/
  webtools-ui/` (live canonical), `~/workspace/shared-ui.old/`
  (user backup), `~/workspace/{dc-planner,llm-benchmark,
  cluster-manager}/` (consumers, all symlinking to webtools-ui).

  **Verified**: dc-planner `./test.sh --quick` 533 passed / 0 failed
  post-deletion; symlink resolves; `make shared-status` reports
  `webtools-ui HEAD: 60e6845 chore: add standard .gitignore (parity
  with prior shared-ui repo)`. Commits landed in all 4 repos local
  HEADs (push intentionally deferred — MCP credential cache was
  empty; the user pushes from interactive terminal): webtools-ui
  `60e6845` (parity .gitignore), dc-planner `c704850`, llm-benchmark
  `4799907` (migration files only — tracelens WIP unrelated to the
  rename was left unstaged for separate commits), cluster-manager
  `22567c3`.

- **Phase 9.8d-mobile (2026-05-05)**: iPhone-friendly mobile shell
  rolled out across all 3 consumers. Canonical mobile defaults moved
  into a single `@media (max-width: 640px)` block in `webtools-ui/css/
  base.css` (16px form inputs to defeat iOS auto-zoom; `min-height:
  40px` tap targets; `safe-area-inset` padding for `.hero` and `body`;
  `.table-scroll` overflow helper). Each consumer added `viewport-fit=
  cover` to its viewport meta (so `env(safe-area-inset-*)` works on
  iOS), an off-canvas hamburger drawer in `pages/index.html` (sidebar
  slides in from the left on tap, backdrop overlay, Esc / backdrop /
  nav-item-click all close), and per-page rules to collapse multi-
  column grids and enable horizontal scroll on wide tables/SVG. The
  top-bar tab buttons are also now text-only (no Material Symbols
  glyph) across all 3 consumers — the sidebar nav variant keeps its
  icons, only the top bar is text-only. **Commits**: webtools-ui
  (`base.css` mobile block sha update via `scripts/build-vendor-
  manifest.sh`), llm-benchmark `8ad7c61` (`feat(ui): mobile shell +
  agent orb refresh + Plan/View polish`), cluster-manager `<hash>` and
  dc-planner `<hash>` (parallel agent — see those repos' git logs).

- **Phase 9.8e (2026-05-05)**: canonical demo-audience catalog
  promoted to webtools-ui. New module `webtools-ui/js/demo-
  audiences.js` exposes `window.DemoAudiences` — a 3-entry array
  (`onboarding` / `advanced` / `expert`) with repo-agnostic `name` /
  `time` / `desc` fields. The `name` field changed from "Onboarding &
  Presales" to "Standard Onboarding" so the label reads correctly in
  any of the three sibling dashboards (presales is a use case, not an
  audience tier). Consumers can override per-audience copy via
  `window.DemoAudienceOverrides = {...}` declared before the script
  loads. **First adopter**: llm-benchmark (`js/dashboard-tutor.js`
  reads `window.DemoAudiences` if present, falls back to an inline
  copy; `pages/index.html` loads the canonical script before
  dashboard-tutor.js). **Pending adopters**: cluster-manager and
  dc-planner — neither ships an audience picker today, so the catalog
  is wired but unused until those repos add their own picker (or until
  Phase 9.8e-2 promotes the picker DOM construction itself into
  `webtools-ui/js/demo-ui.js`). **Commits**: webtools-ui (new
  `js/demo-audiences.js` + `scripts/vendor-manifest.json` regen),
  llm-benchmark `<hash>` (`feat(demo): canonical audience catalog +
  generic copy`).

- **Phase 9.8e follow-up — agent orb chrome (2026-05-05)**: orb
  panel renamed from "LLM Benchmark Copilot" to "LLM Benchmark Agent"
  in `js/chat-orb-mount.js` (consumer-side title, not canonical).
  `/help` now lists each command on its own line — `webtools-ui/js/
  chat-orb.js builtinHelp` produces newline-separated output and the
  submitInput dispatcher forwards the optional `result.html` flag
  through to `addMessage("system", …)` so structured HTML help
  responses render without escaping. The existing `white-space:
  pre-line` CSS in `webtools-ui/css/chat-orb.css` handles the
  newline-separated plain-text path with no extra work. **Commits**:
  webtools-ui `56484c3` (`/help` newline output + dispatcher HTML
  passthrough), llm-benchmark `8ad7c61` (orb rename, accent sync
  observer).

- **Phase 9.8e P4 — canonical `pages/index.html` skeleton (2026-05-05)**:
  the first ~18 lines of every consumer's main entry (`<!doctype html>`
  through the canonical chat-orb.css link) were drifting silently —
  stylesheet load order swapped, viewport meta lost `viewport-fit=
  cover`, dc-planner pointed font preload at a local `../css/...`
  path, cluster-manager carried a redundant 17-line `<style>` block
  redeclaring the Material Symbols font defaults already shipped in
  `shared/css/material-symbols.css`. Closed the door with a strict-
  diff template: `templates/index.skeleton.html` holds the canonical
  shape with `{{NAME}}` (required) and `{{?NAME}}` (optional) place-
  holders; each consumer ships `pages/index.skeleton.values.json`
  filling the slots; `scripts/check_index_skeleton.py` renders the
  template, extracts lines 1 through `<!-- end:skeleton -->` from
  `pages/index.html`, and asserts byte-for-byte equality. The sentinel
  comment demarcates the template-driven prefix from per-repo head
  content (inline `<style>` blocks, page-specific scripts) that
  legitimately diverges below it. Wired into all three test runners
  (`llm-benchmark/test_offline.sh §25e`, `cluster-manager/scripts/
  self-check.sh Stage 1b`, `dc-planner/tests/self-check.sh §2x`).
  Alignment work landed alongside: `cluster-manager` lost the
  redundant `<style>` block + moved chat-orb.css from body to head;
  `dc-planner` switched font preload + material-symbols.css to canon-
  ical paths, fixed `viewport=1.0` → `1`, swapped chat-orb↔skin order
  to put skin AFTER per-repo CSS (so theme tokens win the cascade),
  normalized void elements to ` />` self-close; `llm-benchmark`
  swapped skin↔dashboard-tutor order to match canonical. See
  [`docs/INDEX_SKELETON.md`](INDEX_SKELETON.md) for the schema, place-
  holder grammar, adoption matrix, and the design dialogue (strict-
  diff vs structural-lint vs snapshot). **Commits**: webtools-ui
  `<hash>` (template + script + doc), llm-benchmark `<hash>` (head
  alignment + 25e wire-in + values.json), cluster-manager `<hash>`
  (head alignment + Stage 1b wire-in + values.json), dc-planner
  `<hash>` (head alignment + 2x wire-in + values.json).

- **Phase 9.8e P5 — canonical audience-picker modal (2026-05-05)**:
  followed up Phase 9.8e (the canonical audience *catalog*) by also
  promoting the *picker modal DOM* itself into webtools-ui so all
  three consumers render the identical "DEMO MODE / Pick your
  audience" picker — same copy, same option cards (Standard
  Onboarding ~5min / Advanced Usage ~10min / Expert Training ~15min),
  same skin-aware styling, same Esc/backdrop/keyboard behavior.
  Before P5 only `llm-benchmark` rendered the picker (its
  `js/dashboard-tutor.js mountModal()` injected a private
  `.tutor-modal*` DOM tree); cluster-manager's `/demo` (no-token)
  showed a welcome banner with no audience choice, and dc-planner's
  `DcDemo.openLauncher` was a stub that fell through to a default
  track. Work shipped in 4 repos: **webtools-ui** added
  `js/demo-picker.js` (UMD-ish module exposing
  `window.DemoPicker.{open,close,isOpen}` with lazy-mounted
  single-instance modal, reads catalog from `window.DemoAudiences`
  with hard-coded fallback) and `.demo-picker*` rules in
  `css/demo-mode.css` (uses canonical `--ui-*` tokens so it follows
  the active skin); also promoted `shared/css/demo-mode.css` to the
  canonical `pages/index.html` skeleton template (was per-repo
  before — `dc-planner` had it in `PER_REPO_STYLESHEETS`,
  `llm-benchmark`+`cluster-manager` didn't load it at all). **llm-
  benchmark** retired its private `.tutor-modal*`/`.tutor-audience-*`
  CSS (~3 KB) plus the inline `mountModal()` builder, dropped the
  local `AUDIENCE_OPTIONS` constant, rewired
  `openLauncher`/`closeLauncher` to delegate to `DemoPicker`, added
  `<script src=demo-picker.js>` before `dashboard-tutor.js`.
  **cluster-manager** wired the existing `/demo` (no-token) chat-orb
  handler to call `DemoPicker.open()`; the `onSelect` callback maps
  audience id → engine mode (`onboarding→manual`, `advanced→auto`,
  `expert→training`) and forwards to `cmDemo.start({mode})`. **dc-
  planner** added `DcDemo.openLauncher()` to the canonical
  `shared/js/demo-ui.js` returned object — invoking
  `DemoPicker.open({onSelect: id => startTrack(engine, ui, id)})` —
  and loaded `demo-audiences.js` + `demo-picker.js` (deferred,
  before `demo-ui.js`) so the orb's existing `chat-orb-mount.js
  openDemo()` branch (which already called `DcDemo.openLauncher`
  defensively) finally has a real implementation behind it.
  Verified end-to-end across all three repos in a real browser
  (clicked the Demo entry point, captured screenshots; canonical
  picker rendered with the same 3 cards, same eyebrow/title,
  same Cancel button; Esc closes cleanly, backdrop click closes,
  selecting an option fires the consumer's `onSelect` and triggers
  the right engine code path). The visible chrome harmonization is
  now end-to-end (catalog → picker modal → audience-aware controller),
  closing the "Phase 9.8e-2" item that was promised on commit. See
  [`docs/DEMO.md` §3.1 adoption matrix](DEMO.md) for the per-repo
  status. **Commits**: webtools-ui `<hash>` (`js/demo-picker.js` +
  `css/demo-mode.css` `.demo-picker*` rules + skeleton template
  promotion of `demo-mode.css` + `shared/js/demo-ui.js`
  `DcDemo.openLauncher` + vendor-manifest regen + PLAN/DEMO updates),
  llm-benchmark `<hash>` (drop inline modal/CSS, wire DemoPicker,
  index.html script tag + demo-mode.css link, DEMO.md update),
  cluster-manager `<hash>` (chat-orb-mount.js wiring + index.html
  script tags + demo-mode.css link), dc-planner `<hash>` (index.html
  script tags + values.json move demo-mode.css from PER_REPO to
  canonical slot).

- **Phase 9.8e P6 — mobile notes + voice routing + slash cleanup (2026-05-05)**:
  follow-up stabilization after P5 focused on three cross-cutting
  quality items in the canonical webtools-ui layer:
  **(a) Mobile notes ergonomics** — `css/notes-panel.css` adds
  orientation-aware mobile layouts under `max-width: 900px`: landscape
  uses a narrower right drawer reserve, portrait switches the notes UI
  to a bottom-sheet style panel so the slide viewport keeps horizontal
  room and the panel remains reachable above mobile browser chrome.
  **(b) iOS/iPadOS voice quality in auto mode** — `js/voice.js` now
  detects iOS-like devices (including iPadOS user agents that present
  as Macintosh with touch points), prioritizes Siri/Samantha voices in
  local TTS voice resolution, and routes `cloudTTS.mode="auto"` to try
  local-first on iOS before cloud fallback (reduces perceived latency
  and keeps high-quality on-device synthesis as the preferred path).
  **(c) Slash catalog pruning** — `js/slash-catalog.js` removes
  `/demo-shared` and `/docs` from the canonical list so only currently
  supported cross-repo commands are advertised; this avoids help/menu
  drift from stale migration-era entries. Docs updated alongside:
  `docs/INDEX_SKELETON.md` records `demo-mode.css` canonical promotion,
  and `docs/templates/DEMO.skeleton.md` now documents the canonical
  `DemoPicker` contract and cross-repo adoption matrix.

- **Phase 9.8e P8 — minimal mobile top bar (2026-05-06)**: at viewport
  ≤ 640 px the `.hero` top bar now renders only two elements — the
  hamburger (`.hero-mobile-menu`, canonical from P2) and the brand
  (`.hero-title` icon + name, canonical from P2.1). The `.hero-tabs`
  strip and the `.hero-toolbar` (theme/skin/layout/demo toggles + the
  user-mode picker) are hidden on mobile because:
  - The hamburger opens the side-nav drawer, which already mirrors
    every entry in `.hero-tabs` 1-for-1 across all three consumers
    (llm-benchmark `.sidebar-nav`, cluster-manager `.sidebar-nav`,
    dc-planner `.side-nav-tabs`). Showing both was a pure
    duplication and forced a horizontal scroll strip on phones.
  - The toolbar utilities all have side-nav equivalents (theme/skin
    inside `sidebar-bottom` settings, layout toggle is hidden on
    mobile anyway since the drawer IS the layout, the demo launcher
    is present in BOTH the chat-orb header AND in `sidebar-bottom`).
    Nothing becomes unreachable.
  Implementation is a single rule inside `webtools-ui/css/base.css`'s
  existing `@media (max-width: 640px)` block:
  `.hero-tabs, .hero-toolbar { display: none !important; }`. The
  generic `.tab-btn` thumb-size rule (40 px min-height, 0.9 rem font)
  is preserved separately so in-page tab strips outside the hero
  (e.g. `pages/profile.html` sub-tabs, `pages/view.html` toggle
  pills) still get mobile-friendly sizing. **Result**: the same
  minimal "hamburger + tool icon + tool name" mobile top bar across
  llm-benchmark, cluster-manager, and dc-planner — one rule, three
  consumers. Per-repo HTML / inline `<style>` blocks unchanged
  (existing redundant hides like `#layoutToggleTop` are now belt-
  and-suspenders but harmless). **Commit**: webtools-ui `<hash>`
  (single `css/base.css` edit + this PLAN.md entry).

- **Phase 9.8e P9 — demo/picker polish + chat composer ergonomics (2026-05-06)**:
  follow-up hardening pass focused on interaction quality and visual
  consistency in the canonical webtools-ui layer:
  **(a) Mobile-menu specificity guard** — `css/base.css` now scopes
  `.hero-mobile-menu` visibility under `.hero` in both desktop-hide and
  mobile-show rules so later-loaded consumer `.hero-icon-btn` rules do
  not accidentally re-show the hamburger on desktop due to equal
  specificity + source-order ties.
  **(b) Chat composer ergonomics** — `js/chat-orb.js` swaps the composer
  input from single-line `<input>` to `<textarea rows="1">`; matching
  `css/chat-orb.css` updates add multiline sizing (`max-height`),
  resize affordances (desktop resizable panel + vertical text-area resize),
  and remove browser-default focus chrome so the canonical styles remain
  visually consistent across engines.
  **(c) Demo control behavior** — `js/demo-engine.js` now treats
  `next()`/`prev()`/`goTo()`/`restart()` while paused as explicit resume
  intents: phase flips back to `playing` before re-entering
  `runFromCurrent()`, eliminating the "step changed but playback stayed
  paused" trap.
  **(d) Demo chrome + picker refresh** — `js/demo-ui.js` replaces the
  text `EXIT` pill with a compact `×` close affordance (aligned with the
  pitch deck nav bar), while `css/demo-mode.css` + `js/demo-picker.js` +
  `js/demo-audiences.js` tighten audience copy and apply accent-driven
  picker tokens so the picker reads as first-class product chrome across
  dark/light skins.

- **Phase 9.8f — Mobile and Modal UI Harmonization (2026-05-06)**:
  Standardized the layout and visual consistency of modals and mobile UI
  elements across all three consumer repositories.
  **(a) Mobile Layout Harmonization** — Replaced `dc-planner`'s custom
  `.side-nav` classes with the canonical `.sidebar` and `.shell-body`
  primitives. Added `env(safe-area-inset)` rules to `shared/css/base.css`
  and enforced a 44x44px minimum touch target for iPhone compatibility.
  **(b) Modal Standardization** — Consolidated fragmented inline `.modal`
  styles from `llm-benchmark/pages/plan.html`, `llm-benchmark/pages/view.html`,
  and `cluster-manager/pages/status.html`. Extracted a single canonical
  modal structure (`.modal-overlay`, `.modal`, `.modal-header`, `.modal-body`,
  `.modal-footer`) into `shared/css/base.css` with consistent widths, shadows,
  fonts, and backdrop filters. Button fills inside modals now reliably
  inherit from the global button definitions.

- **Phase 9.8g — In-orb demo selector + orientation-aware notes (2026-05-10)**:
  Collapsed the demo audience picker and the speaker-notes drawer into
  surfaces the user already understands — the agent orb and the deck
  itself — and made the iPhone full-screen treatment uniform across
  every page in all three consumer repos.
  **(a) Canonical iPhone safe-area shell** — `css/base.css` switched the
  body root from `min-height: 100vh` to a paired `100vh` + `100dvh`
  declaration so iOS Safari's collapsing chrome no longer clips the
  bottom of the page. Added `env(safe-area-inset-*)` padding to body /
  hero / page so the notch (landscape) and home indicator (portrait)
  zones stay clear without shrinking the desktop layout. Audited every
  `index.html` (root + `pages/`) across cluster-manager, dc-planner,
  llm-benchmark, vixci-utils, and scaleout-utils to ensure
  `viewport-fit=cover` is on the meta viewport.
  **(b) In-orb demo audience picker** — `js/chat-orb.js` gained a
  slide-down `.ai-demo-card` (mirroring `.ai-llm-card` chrome and the
  same mutex behavior) populated from `js/demo-audiences.js`. Selecting
  an audience fires the consumer's new `onDemoSelect(audienceId)`
  callback, with a default fallback to `SlashRouter.run('/demo ' + id)`
  so consumers don't even need to wire it explicitly. New public API:
  `ChatOrb.openDemoCard()` / `ChatOrb.toggleDemoCard()`. All three
  per-repo `chat-orb-mount.js` files dropped their bespoke
  `onDemoClick` paths (which opened a page-level `DemoPicker` modal,
  invoked `window.prompt()`, or called `DashboardTutor.openLauncher()`)
  in favor of the canonical in-orb card. The deep-link / sessionStorage
  reentry paths now also open the orb's demo card on next page load.
  Audience copy was tightened to one sentence each: standard-view
  walkthrough · power-user tour · technical deep-dive.
  **(c) Orientation-aware speaker notes** — `css/notes-panel.css` was
  rewritten so the placement is driven by orientation, not width:
  landscape (any device) = right-side fixed drawer; portrait (any
  device) = bottom sheet. Added `env(safe-area-inset-*)` so the panel
  never sits under an iPhone notch or home indicator regardless of
  orientation. While a demo is running, the drawer is suppressed via
  `body.demo-active .notes-panel { display: none }` so the orb's chat
  panel — which `webtools-ui/js/demo-ui.js#narration.post` already
  populates with `<b>Demo Narration:</b> …` for each step — becomes
  the single speaker-notes surface. The `body.demo-active` toggle was
  promoted from llm-benchmark's `dashboard-tutor.js` into the canonical
  `demo-ui.js` `phase:changed` handler so it fires identically across
  `SharedDemo` (cluster-manager), `DcDemo` (dc-planner), and
  `DashboardTutor` (llm-benchmark).

- **Phase 9.8e P12 — retire page-level audience-picker modal (2026-05-12)**:
  finishes the migration begun in Phase 9.8g(b). The canonical chat orb
  (`webtools-ui/js/chat-orb.js`, mounted with `showDemoBtn:true`) now
  renders an in-orb slide-down audience picker (`.ai-demo-card`) and is
  the SOLE entry point for Demo Mode on the main screen across all
  three consumers. The page-level `webtools-ui/js/demo-picker.js`
  modal — promoted in Phase 9.8e P5 — is no longer loaded by any
  consumer's `pages/index.html`, and the three legacy call sites that
  still invoked `window.DemoPicker.open()` were each rewired to
  delegate to `window.ChatOrb.openDemoCard()`:
    - `llm-benchmark/js/dashboard-tutor.js openLauncher()` — now opens
      the orb's in-orb card. The `mountLaunchButton()` helper also
      stopped double-wiring `#chatDemoBtn` (the orb's own
      `toggleDemoCard` handler was being shadowed by an
      `openLauncher` click handler, stacking the retired modal on top
      of the in-orb card on every click) and stopped synthesizing the
      legacy floating bottom-right `demoLaunchBtn` pill (the orb is
      always reachable).
    - `cluster-manager/pages/index.html openDemoBanner()` — same
      delegate; the sidebar `#demoLaunchBtnSide` pill now opens the
      in-orb card instead of the modal.
    - `webtools-ui/js/demo-ui.js DcDemo.openLauncher` — same delegate;
      programmatic dc-planner callers (slash commands, URL handlers,
      test fixtures) keep working without surfacing the retired modal.
  `demo-audiences.js` is still loaded by all three consumers because
  the orb's `resolveDemoAudiences()` reads `window.DemoAudiences` to
  hydrate the in-orb card with the canonical Standard / Advanced /
  Expert copy. `demo-picker.js` itself remains on disk in
  `webtools-ui/js/` for any out-of-tree consumer that still imports
  it, but it is functionally retired from the harmonized 3-repo
  surface. Validated by reloading all three `pages/index.html` and
  clicking each Demo entry point: only the in-orb
  `Demo Mode audience picker` region opens (no `.demo-picker__overlay`
  / `dialog.demo-picker` is ever inserted), console clean.
