---
type: Test Plan
title: Testing Strategy — Canonical Framework
description: '**Status:** Canonical, 2026-08-05. Applies to every consumer that mounts this repo at `shared/`.'
---
# Testing Strategy — Canonical Framework

**Status:** Canonical, 2026-08-05. Applies to every consumer that mounts this repo at `shared/`.

This doc lives in `webtools-ui/docs/` so all sibling consumer repos (`llm-benchmark`,
`cluster-manager`, `dc-planner`, `knowledge-exchange`) read the same source of truth via their
`shared/` symlink. It is **read, not copied** — there is exactly one framework and it lives here.

Each consumer keeps a **local instance** document that declares its own stack, tooling, thresholds,
workflows, and verified gap register. The instance outline is
[`docs/templates/TESTING_STRATEGY.skeleton.md`](templates/TESTING_STRATEGY.skeleton.md).

> **Canonical vs local.** Sections marked **[CANONICAL]** are fixed: their structure, rules, and
> vocabulary are the same in every consumer, and a consumer that deviates records the deviation in
> its local instance with a reason. Sections marked **[LOCAL]** are placeholders here and must be
> filled in by each consumer — this doc deliberately contains no product-specific findings,
> commands, element ids, or thresholds.

---

## 1. Scope and consumer profile · [CANONICAL]

This framework targets the shared architecture of the consumer dashboards: an **HTML/CSS/JS browser
frontend** served alongside **Python backend services**, with an optional **Node toolchain** for
build, capture, render, or export work, plus **external binaries** (headless Chrome, ffmpeg, TTS,
document converters).

The governing observation is that in this architecture **most production defects originate at the
seams between runtimes, not inside any one of them**. A strategy organized only by test phase hides
those seams. This framework is therefore a **matrix**: every test is located by
*(runtime layer × test tier)*.

---

## 2. Stack model — runtimes and seams · [CANONICAL]

```text
┌──────────────────────────────────────────────────────────────────────┐
│  LAYER A — Browser runtime                                           │
│  HTML templates · CSS (incl. shared/ sheets) · frontend JS            │
└───────────────┬──────────────────────────────────────────────────────┘
                │  SEAM 1: HTTP/JSON  (fetch, SSE/streaming, static assets)
┌───────────────▼──────────────────────────────────────────────────────┐
│  LAYER B — Python services                                           │
│  HTTP server · CLI · orchestration · validation engines               │
└───────┬──────────────────────────────────────┬───────────────────────┘
        │ SEAM 2: subprocess                   │ SEAM 3: filesystem
        │ (argv, exit code, stdio, env)        │ (generated artifacts, JSON handoff)
┌───────▼───────────────────────────┐  ┌───────▼───────────────────────────────┐
│  LAYER C — Node toolchain          │  │  LAYER D — External binaries          │
│  ESM modules · headless browser    │  │  Chrome · ffmpeg · TTS · converters   │
│  drivers · capture/render pipeline │  │  SEAM 4: third-party process contract │
└────────────────────────────────────┘  └───────────────────────────────────────┘
```

A consumer declares in its local instance which layers and seams it actually has. A consumer with no
Node toolchain has no Seam 2 and says so; that is a filled-in declaration, not an omission.

### 2.1 Why seams dominate the risk

Seam failures share properties that make them uniquely hard to catch:

- **Invisible to single-language suites.** Python tests mock the subprocess, Node tests are invoked
  directly, and neither exercises the handoff.
- **Environmental, not logical.** A missing binary, a `PATH` difference, a locale that changes number
  formatting, a runtime major-version bump.
- **Non-deterministic.** Timeouts, buffer deadlocks, partial writes on kill.
- **Diagnostic-destroying.** `stderr=DEVNULL` and bare return-code checks discard the only evidence
  of what broke.

**Governing principle:** a defect's cost rises with the number of seams it crosses before detection.
Test each layer in isolation cheaply, then test **each seam explicitly** — never let end-to-end be
the first place a seam is exercised.

---

## 3. Tier model · [CANONICAL]

| Tier | Name | Scope | Gate |
| :--- | :--- | :--- | :--- |
| **0** | Static analysis & type safety | All layers, no execution | pre-commit |
| **1** | Unit | Pure logic, per runtime | pre-commit |
| **2** | Component & schema | Modules, DOM fragments, data schemas | PR |
| **3A** | Integration (in-runtime) | Multi-module flows within one runtime | PR |
| **3B** | **Cross-runtime boundary** | Seams 1–4 | PR |
| **4** | End-to-end | Real browser, real server, real workflows | merge |
| **5** | Artifact integrity & determinism | Generated binaries and documents | merge |
| **6** | Non-functional | Performance, security, accessibility | release |

Tier names and numbers are canonical vocabulary. Use them in marker names, CI job names, and
review discussion so the same word means the same thing in every consumer.

---

## 4. Coverage matrix — layer × tier · [CANONICAL]

Read this as the completeness check. An empty cell must be a recorded decision, not an oversight.

| | **A. Browser** | **B. Python** | **C. Node toolchain** | **Seams** |
| :--- | :--- | :--- | :--- | :--- |
| **0 Static** | ESLint, `tsc --noEmit`, stylelint, HTML validate | ruff, mypy, byte-compile | ESLint (ESM), `node --check` | Schema lint of handoff payloads |
| **1 Unit** | jsdom / DOM-isolated modules | pytest (pure functions) | `node --test` | — |
| **2 Component** | Rendered fragment + a11y tree | Route handlers, schema models | Module contract tests | JSON Schema conformance |
| **3A Integration** | Multi-component state flows | Server routes, stubbed generators | Pipeline stage chaining | — |
| **3B Boundary** | — | **Subprocess contract tests** | **Invoked-as-child tests** | **Seams 1–4** |
| **4 E2E** | Real browser automation | Live server under test | Real pipeline invocation | Full stack |
| **5 Artifact** | Screenshot baselines | Artifact structural validators | Media container validation | Determinism hashes |
| **6 Non-func** | Lighthouse, axe-core | Latency budgets, injection tests | Throughput | Resource ceilings |

---

## 5. Test data & environment contract · [CANONICAL]

Every tier inherits these rules; they are what make results trustworthy.

| Rule | Requirement |
| :--- | :--- |
| **Hermetic filesystem** | Tests write only under a temp root; never mutate real content directories |
| **Hermetic network** | No outbound network in tiers 0–3; explicit allowlist in tier 4+ |
| **Port isolation** | Serialize server-bound suites on a lockfile; refuse to reuse an existing listener so the run always exercises the current build |
| **Deterministic clock/RNG** | Freeze time and seed RNG wherever output is compared |
| **Golden files** | Version reference outputs; regenerate only via an explicit, reviewed command |
| **Fixture ownership** | Each test creates its own data with unique ids; no order dependency, no shared mutable state |
| **Stubbed heavy tools** | Tiers 1–3A stub subprocess and model calls, asserting composed arguments rather than executing |

---

## 6. Tier 0 — Static analysis & type safety · [CANONICAL]

The most commonly skipped tier and the cheapest. **Syntax checking is not linting, and linting is
not type checking.** A repo that only byte-compiles Python and runs `node --check` has no static
tier at all.

| Layer | Check | Typical tool |
| :--- | :--- | :--- |
| Python | Lint, import hygiene, dead code | `ruff check` |
| Python | Type safety | `mypy` — strict on new modules, lenient on legacy |
| Python | Byte-compile | `compileall` |
| Node | Lint (ESM correctness, unhandled promises) | ESLint + `eslint-plugin-n` |
| Node / Browser | Type safety | `tsc --noEmit --allowJs --checkJs` with JSDoc types |
| Browser | Template validity | HTML validator — matched tags, required ids, ARIA roles |
| CSS | Lint, dead selector detection | stylelint |
| All | Cognitive complexity | ESLint `cognitive-complexity` or SonarQube, ceiling declared locally |
| All | Secret scanning | Gitleaks |

**Why this tier protects seams:** the argv list, the child environment dict, and the parsed handoff
payload are exactly the values a type checker can constrain. `list[str]` on a subprocess argv
eliminates the `None`-in-argv defect class before any test runs.

---

## 7. Tier 1 — Unit tests, per runtime · [CANONICAL]

Unit tests are runtime-local by definition. Three runtimes means three harnesses, and **all of them
must be wired into CI** — an unwired harness is worse than none, because it looks like coverage.

| Runtime | Harness | Scope |
| :--- | :--- | :--- |
| Python | pytest | Parsers, schema models, state utilities, decision logic, formatters |
| Node | `node:test` + `node:assert/strict` | Pure toolchain modules: caching, alignment, config resolution |
| Browser JS | `node:test` + jsdom | State reducers, filters, selection sets, parameter builders |

Prefer the built-in `node:test` runner: it needs no dependency, which matters when the toolchain
install is optional in some CI tiers.

**The browser-JS unit tier is the most frequently missing tier in HTML-first apps.** When frontend
logic is covered only by end-to-end tests, every logic bug costs a full browser run to find and
cannot be unit-debugged. The remedy is not a framework migration — extract pure functions out of
event handlers and test them directly.

Enhancements available at this tier: property-based testing (Hypothesis, fast-check), snapshot tests
for serialization, benchmark tests on hot paths, frozen-locale tests for formatters.

---

## 8. Tier 2 — Component & schema conformance · [CANONICAL]

### 8.1 Component tests

| Layer | Subject | Assertion |
| :--- | :--- | :--- |
| Browser | Rendered fragment | Correct DOM shape, ARIA roles, no console errors |
| Python | Route handler in isolation | Request → response shape, status codes, validation errors |
| Node | Module with fixture inputs | Deterministic output, correct exit semantics |

### 8.2 Bind contracts to a real source of truth

A contract test without a canonical schema is just a duplicated assertion. Anchor every contract to
a versioned schema artifact:

- **Data artifacts** → JSON Schema files.
- **HTTP API** → an OpenAPI document generated from, or validated against, the server.
- **Subprocess handoff** → a JSON Schema for every file or stdout payload passed between runtimes.

**Rule:** if a producer and a consumer live in different runtimes, the thing between them gets a
schema. No exceptions — that is the only mechanism that makes a seam testable.

---

## 9. Tier 3B — Cross-runtime boundary testing · [CANONICAL]

The highest-value tier in this architecture, and the one most often absent. It targets Seams 2–4:
Python invoking Node, Python invoking external binaries, and filesystem handoff.

### 9.1 The subprocess contract — six testable elements

Every cross-runtime invocation is an API with six elements. Each is independently testable, and each
is a real, observed failure mode:

| Element | Failure mode | Test |
| :--- | :--- | :--- |
| **argv composition** | Wrong flag, unescaped path, `None` in list, wrong order | Assert composed argv without executing |
| **Exit code** | Non-zero swallowed; `OSError` mapped to a synthetic code | Assert the caller distinguishes 0 / non-zero / not-found |
| **stdout / stderr** | Diagnostics discarded; buffer deadlock on large output | Assert stderr is captured and surfaced on failure |
| **Encoding** | Non-ASCII mangled across the pipe; locale-dependent decoding | Round-trip a UTF-8 fixture through the child |
| **Environment** | Required variable unset in CI; secret leaks into the child | Assert the child env matches an explicit allowlist |
| **Timeout & cleanup** | No timeout hangs CI; kill leaves a half-written artifact | Assert a timeout exists and partial output is removed |

### 9.2 Five test patterns

**Pattern 1 — argv composition, no execution.** Fast, hermetic, needs no external binary, and catches
the majority of seam defects. This is the pattern to adopt first.

```python
def test_child_argv(monkeypatch, fixture):
    captured = {}
    monkeypatch.setattr(subprocess, "run",
                        lambda argv, **kw: captured.update(argv=argv, kw=kw) or _ok())

    invoke_child(fixture)

    assert all(isinstance(a, str) for a in captured["argv"])   # no None / Path leakage
    assert captured["kw"].get("timeout"), "every subprocess call must set a timeout"
```

**Pattern 2 — invoked-as-child.** Run the child exactly as the parent runs it, then assert the
contract from the *caller's* perspective.

```python
@pytest.mark.boundary
def test_child_contract(tmp_path):
    proc = subprocess.run([...], capture_output=True, text=True,
                          timeout=60, encoding="utf-8")
    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout)      # stdout must be pure JSON, no log noise
    jsonschema.validate(payload, HANDOFF_SCHEMA)
```

**Pattern 3 — failure injection.** The child *will* fail in production; assert the parent degrades
correctly rather than hanging or reporting success.

```python
@pytest.mark.parametrize("mode", ["nonzero", "missing-binary", "timeout",
                                  "garbage-stdout", "stderr-flood"])
def test_child_failure_is_surfaced(mode, fixture):
    with fake_child(mode):
        result = run_stage(fixture)
    assert result.rc != 0
    assert result.message, "failure must carry diagnostics, not an empty error"
    assert not orphaned_processes()
    assert not partial_artifacts(fixture)
```

**Pattern 4 — environment contract.** The classic "works locally, fails in CI" defect.

```python
def test_child_env_contract():
    env = build_child_env()
    assert env["PATH"], "child must inherit a usable PATH"
    for key in REQUIRED_CHILD_ENV:
        assert key in env, f"{key} missing — child will silently fall back"
    for key in FORBIDDEN_CHILD_ENV:
        assert key not in env, f"{key} must not leak into child processes"
```

**Pattern 5 — external binary preflight.** Third-party tools are a contract you do not control.
Assert the **capability**, not the version string.

```python
@pytest.mark.boundary
def test_binary_capability():
    out = subprocess.run([BINARY, "-capabilities"], capture_output=True,
                         text=True, timeout=15).stdout
    assert REQUIRED_FEATURE in out, "required capability unavailable in this environment"
```

### 9.3 Filesystem handoff — Seam 3

When runtimes communicate through files rather than pipes, add:

- **Schema validation** of the handoff file on both the write and the read side.
- **Atomicity** — write to a temp path and rename, so a crash never leaves a readable-but-truncated
  file. Test by interrupting mid-write and asserting the reader sees either the old file or nothing.
- **Staleness** — assert the consumer detects an output older than its inputs rather than silently
  reusing it.

### 9.4 Streaming and long-running jobs — Seam 1

| Case | Assertion |
| :--- | :--- |
| Incremental delivery | Client renders partial output before completion |
| Client disconnect | Server terminates the child; no orphan process |
| Error mid-stream | Client shows an error state, not a silent truncation |
| Job lifecycle | `queued → running → done/failed` transitions observable and terminal |
| Concurrency | Two jobs do not interleave logs or clobber each other's output paths |

---

## 10. Tier 4 — End-to-end · [CANONICAL method, LOCAL workflows]

The **method** below is canonical. The **list of workflows** is product-specific and belongs in the
local instance.

### 10.1 Hybrid API + UI validation · [CANONICAL]

Never assert UI state alone for a mutating action — a UI that lies is precisely the defect you are
looking for. Seed through the API, act through the UI, verify through the API.

```python
record_id = api.post("/items", json={...}).json()["id"]
page.click(f"[data-testid='item-{record_id}']")
page.click("[data-testid='bulkMove']")
page.wait_for_load_state("networkidle")
assert api.get(f"/items/{record_id}").json()["folder"] == "destination"
```

### 10.2 Environment coverage · [CANONICAL]

| Dimension | Coverage |
| :--- | :--- |
| Browsers | Chromium always; WebKit and Firefox at the merge gate |
| Viewports | Desktop plus at least two mobile device profiles with real touch emulation |
| Input modality | Mouse, keyboard-only, touch (coarse pointer) |
| Network | Fast, throttled, offline, 5xx, malformed payload |
| API mode | Live server and static/offline |

**Device emulation caveat.** A default headless browser reports `hover: hover` and `pointer: fine`.
Any CSS behind `@media (hover: none) and (pointer: coarse)` is therefore **untested** unless you
emulate a real device descriptor with `isMobile` and `hasTouch`. Assert the media query matched
before asserting anything that depends on it — otherwise the test passes by never entering the code
path it claims to cover.

This repo ships a canonical cross-consumer implementation of that discipline in
[`tests/iphone-ui.mjs`](../tests/iphone-ui.mjs) (CDP safe-area insets via [`tests/lib/iphone-helpers.mjs`](../tests/lib/iphone-helpers.mjs)),
[`tests/cross-consumer-shell.mjs`](../tests/cross-consumer-shell.mjs) (generic shell tab/panel regression),
and an API-shape check in [`tests/mobile-api-contract.mjs`](../tests/mobile-api-contract.mjs).
See [`docs/CROSS_CONSUMER_TESTING.md`](CROSS_CONSUMER_TESTING.md) for the full matrix, CI wiring, and consumer adoption map.

---

## 11. Tier 5 — Artifact integrity & determinism · [CANONICAL]

When a product's output *is* a generated file, "the pipeline exited 0" is not a test. Separate three
concerns:

| Concern | Question | Method |
| :--- | :--- | :--- |
| **Structural** | Is the file a valid instance of its format? | Format-level validation |
| **Semantic** | Does it contain what it should? | Content assertions |
| **Determinism** | Does the same input reproduce the same output? | Normalized hash comparison |

### 11.1 Structural validators by format

| Format | Minimum assertions |
| :--- | :--- |
| PDF | Parses; expected page count; non-empty text layer; no zero-byte pages |
| PPTX | Valid OPC zip; slide count matches source; relationships resolve; no dangling media refs |
| MP4 / WebM | Container parses; duration within tolerance; video and audio streams present; non-zero bitrate |
| VTT / captions | Monotonic non-overlapping cues; timings inside media duration; no empty cues |
| PNG / poster | Decodes; expected dimensions; not uniformly blank |
| HTML export | Well-formed; local asset refs resolve; no absolute filesystem paths leaked |

### 11.2 Determinism

Non-determinism in generated artifacts destroys the value of caching, diffing, and regression
baselines.

```python
@pytest.mark.artifact
def test_output_is_reproducible(fixture):
    assert normalized_digest(build(fixture)) == normalized_digest(build(fixture))
```

`normalized_digest` strips legitimately-varying fields — embedded timestamps, temp paths, generator
version strings, archive entry ordering. **Write that normalizer once and share it**; ad-hoc
normalization per test is how determinism suites rot.

### 11.3 Freshness

Assert that generated outputs are not older than their inputs, and that committed derived files
match a fresh regeneration. A `--check` mode that regenerates in memory and diffs is the cheapest
possible guard against a stale committed artifact.

---

## 12. Tier 6 — Non-functional · [CANONICAL classes, LOCAL budgets]

### 12.1 Performance

Frontend-only performance testing is a common blind spot. Budget **every** layer; the numeric values
belong in the local instance.

| Layer | Metric |
| :--- | :--- |
| Browser | LCP, CLS, INP |
| Browser | Interaction handler duration for synchronous work |
| Browser | Per-page asset weight |
| Python | API p95 latency, per endpoint |
| Python | Server cold start |
| Node | Throughput per unit of work |
| All | Peak memory per pipeline stage |

### 12.2 Security — beyond dependency scanning

A dependency scan finds *known* vulnerabilities in *other people's* code. It finds nothing in yours.
For a stack that renders derived content into HTML and shells out to subprocesses, test these classes
explicitly:

| Class | Applies when | Test |
| :--- | :--- | :--- |
| **XSS via rendered content** | Any content rendered into HTML | Inject script payloads into source fixtures; assert escaped output |
| **Path traversal** | Endpoints reading/writing directory-scoped files | Request `../` and absolute paths; assert rejection |
| **Command injection** | Subprocess argv built from influenced values | Shell metacharacters in fixtures; assert list-form argv, never `shell=True` |
| **SSRF** | Server-side fetch of a supplied URL | Assert internal and link-local addresses refused |
| **Content injection** | Source documents treated as evidence | Assert embedded directives are never executed or echoed as instructions |
| **Secret leakage** | Child env, logs, committed files | Assert child env allowlist; scan logs and diffs |
| **Headers / CSP** | Served pages | Assert CSP, `X-Content-Type-Options`, frame options |
| **Supply chain** | Dependency trees | `pip-audit`, `npm audit`, SBOM diff on lockfile change |

### 12.3 Accessibility

Automated rulesets catch roughly a third of WCAG issues; the rest need targeted assertions.

| Check | Method |
| :--- | :--- |
| WCAG ruleset | axe-core on every route and every open modal/menu state |
| Keyboard-only traversal | Tab through the page; every interactive element reachable with a visible focus indicator |
| Focus management | Modal traps focus, Escape closes, focus returns to trigger |
| Tap targets | Every rendered interactive element meets the minimum size under touch emulation |
| Zoom / text scaling | 200% zoom and a 16px minimum input font produce no horizontal overflow |
| Reduced motion | `prefers-reduced-motion` suppresses non-essential animation |
| Contrast | Computed contrast meets AA in every skin |
| Screen reader semantics | Roles, names, and live-region announcements on critical flows |

**Measure what renders, not what a stylesheet claims.** Asserting that a CSS rule exists is vacuous
if no element on the page matches its selector — see §13.3.

---

## 13. Anti-false-positive protocol · [CANONICAL]

The purpose of this section is to prevent tests that are green for reasons unrelated to correctness.
It is canonical in full; consumers may add rules but may not remove them.

### 13.1 Element level

| Rule | Implementation |
| :--- | :--- |
| **No synthetic JS for UI actions** | Real click / hover / keyboard — never `page.evaluate("openModal()")` |
| **`state="visible"`, never `attached` alone** | `attached` passes inside a `display: none` parent |
| **Physical visibility** | Non-zero bounding box **and** computed `display !== 'none'` |
| **Wait for the condition, not the clock** | Condition waits and network idle; no fixed sleeps |
| **Stable locators** | `data-testid` and ARIA roles over structural CSS/XPath |
| **Non-vacuous measurement** | Assert the matched element count is greater than zero before asserting over the set |
| **Precondition assertions** | Assert the environment is what the test requires — device class, media query, API mode — before the real assertion |

### 13.2 Suite level

Element-level rigor is undone if the whole suite can silently not run.

| Rule | Implementation |
| :--- | :--- |
| **Skip is not pass** | A suite that cannot run exits with a distinct non-zero code and prints an explicit "did not run" banner; it must never print PASS |
| **Missing dependency is loud** | An absent browser, runtime, or tool is reported, not swallowed |
| **Opt-in skip tolerance** | Callers that must not hard-fail set an explicit env flag; the banner still says skipped |
| **No silent test filtering** | A marker or selector matching zero tests fails the run — register markers and enable strict-marker enforcement |
| **Known-failing stays red** | Real defects remain failing rather than being deleted; a permanently-red assertion that trains people to ignore the suite is converted to a tracked annotation instead |

### 13.3 Coverage honesty

An **inert rule** — a selector that matches nothing in the consuming application — provides zero
coverage while appearing green. This is a live hazard for `shared/` CSS specifically: a tap-target or
focus rule written against one consumer's chrome silently covers nothing in a consumer that names its
controls differently.

Periodically assert that shared styles and utilities actually match rendered elements, record inert
rules as findings rather than passes, and buy the coverage back with an assertion over *every
rendered* control of the relevant kind, which cannot pass vacuously.

---

## 14. UI coverage framework · [CANONICAL method, LOCAL inventory]

### 14.1 Principles

- **Every state:** default, hover, focus, active, disabled, loading.
- **Every layer:** depth-first traversal of nested menus, accordions, cascading selects.
- **Every combination:** see §15.
- **Every modality:** mouse, keyboard, touch, screen reader.

### 14.2 Component inventory

Build the tree first; each path becomes a test case. **Coverage claims without an inventory are
unfalsifiable.** The tree itself is local; the requirement to have one is canonical.

```text
Settings Modal
├── General Tab
├── Advanced Tab
│   ├── Performance Section
│   │   ├── Setting (select)
│   │   └── Setting (slider)
│   └── Security Section
└── Account Tab
```

### 14.3 Coverage matrix

| Component | States | Interactions | Persistence | A11y | Visual |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Buttons | default, hover, focus, active, disabled, loading | click, keyboard | — | name, `aria-busy`, focus ring | all states |
| Toggles / settings | on/off, enabled/disabled | click, keyboard | storage + API | announcement | skin diff |
| Selects / dropdowns | open, closed, selected, empty | click, arrows, touch | API-backed options | `aria-expanded`, `aria-selected` | option list |
| Context menus | open, closed, at-edge | right-click, Escape, outside click | — | focus trap, roles | cursor position, viewport clamp |
| Modals | open, nested (≤2), loading, error | click, Escape, Tab loop | form state | `role=dialog`, `aria-modal` | overlay + content |
| Bulk operations | none, one, many selected | Ctrl/Shift-click, Select All | backend state | live region | action bar |
| Trees / accordions | expanded, collapsed, deep | click, arrows | expansion state | `aria-expanded`, `aria-controls` | each depth |

### 14.4 Button state assertions

| State | Trigger | Assertion |
| :--- | :--- | :--- |
| Default | Load | Visible, enabled, accessible name correct |
| Hover | `hover()` | Computed style changes (fine-pointer only) |
| Focus | Tab | Is `document.activeElement`; visible focus indicator |
| Active | Click | Visual feedback |
| Disabled | Precondition | `aria-disabled="true"`; activation is a no-op |
| Loading | Async start | `aria-busy="true"`; repeat activation blocked; no duplicate request |

### 14.5 Nested menu and modal checklists

**Menus** — Enter/Space opens; arrows navigate; ArrowRight opens a submenu; Escape closes and
restores focus to the trigger; `aria-expanded` and `aria-haspopup` accurate at every level; submenu
items not focusable while collapsed; the menu clamps inside the viewport at screen edges.

**Modals** — focus moves in on open; Tab and Shift+Tab both loop within; Escape closes; focus returns
to the trigger; the background is inert and not focusable; nested modals are capped at two layers
with Escape closing the topmost first.

---

## 15. Combinatorial coverage · [CANONICAL]

| Strategy | Relative cost | Coverage | Use when |
| :--- | :--- | :--- | :--- |
| Full Cartesian | Highest | Exhaustive | Critical path, few small parameters |
| **Pairwise (2-way)** | Low | Most interaction defects | **Default** |
| 3-way | Medium | Higher-order interactions | Safety-critical |
| Random sample | Lowest | Smoke | Low-risk surfaces |

Model parameters with explicit `IF/THEN` constraints so impossible states — bulk operations while
offline, for example — are excluded from the matrix rather than asserted around inside tests.

Run the matrix in parallel: `pytest -n <N>` or runner-level sharding.

---

## 16. Coverage budgets, gate cadence, flake discipline · [CANONICAL shape, LOCAL numbers]

### 16.1 Pyramid budget

Ratios matter more than absolute counts; an inverted pyramid is slow and flaky by construction.

| Tier | Share of suite |
| :--- | :--- |
| 1 Unit | ~60% |
| 2 Component / schema | ~15% |
| 3 Integration + boundary | ~15% |
| 4 E2E | ~7% |
| 5–6 Artifact / non-functional | ~3% |

### 16.2 Code coverage

Thresholds are local; **these two rules are canonical**:

- **Overall coverage ratchets and never drops.** Start at whatever today's number is.
- **Boundary call sites are 100%.** Every cross-runtime invocation has at least one contract test.

Coverage is a **floor, not a goal.** Pair it with periodic mutation testing on core logic — a
high-coverage suite that asserts nothing still passes every mutant.

### 16.3 Gate cadence

| Trigger | Tiers |
| :--- | :--- |
| Pre-commit | 0, 1 |
| Pull request | 0–3B, coverage delta |
| Merge | 0–5, cross-browser E2E |
| Nightly | Full matrix, 3-way combinatorial, flake detection, mutation |
| Release | 0–6, determinism, security, performance budgets |

### 16.4 Flake discipline

| Practice | Detail |
| :--- | :--- |
| **Detection** | Nightly reruns on an unchanged commit; below a declared pass-rate floor is flaky |
| **Retry policy** | Zero retries in PR runs so flakes surface; retry the flaky *operation* only, never the whole test, and log every retry |
| **Quarantine** | Tag and move to a non-blocking suite; never delete silently |
| **Signature logging** | Test id, commit, normalized error hash, environment — grouped for trend analysis |
| **Ownership** | Every quarantined test has an owner and a ticket; reviewed on a fixed cadence |
| **Expiry** | Unfixable within a declared window plus low value → delete. A smaller trusted suite beats a large distrusted one |

**Resolve the retry tension by direction:** zero retries where you want signal (PR runs, flake
detection), bounded and logged retries only where you want throughput (release smoke).

---

## 17. Tooling reference · [CANONICAL]

| Concern | Python | Node / Browser |
| :--- | :--- | :--- |
| Test runner | pytest | `node:test`, Playwright |
| Lint | ruff | ESLint |
| Types | mypy | `tsc --checkJs` with JSDoc |
| Coverage | pytest-cov | `node --experimental-test-coverage`, c8 |
| Property-based | Hypothesis | fast-check |
| Mutation | mutmut | Stryker |
| Benchmark | pytest-benchmark | Lighthouse CI |
| Schema | jsonschema, Pydantic | ajv |
| Contract | Pact, OpenAPI validators | MSW, request interception |
| Parallel | pytest-xdist | Runner sharding |
| Security | pip-audit, bandit | npm audit, Snyk, Gitleaks, Trivy |
| Accessibility | — | axe-core, Lighthouse |

---

## 18. Instance contract — what each consumer must declare · [CANONICAL]

A consumer's local testing document is **not** a copy of this file. It must be short and must contain
exactly these sections, in this order. The skeleton is
[`docs/templates/TESTING_STRATEGY.skeleton.md`](templates/TESTING_STRATEGY.skeleton.md).

| # | Section | Content |
| :--- | :--- | :--- |
| 1 | **Framework reference** | Link to this document; state that it is authoritative and not duplicated |
| 2 | **Stack declaration** | Which of layers A–D exist; which of seams 1–4 exist; note any seam this framework does not model |
| 3 | **Tooling table** | The real command for every tier in §3 that the consumer runs |
| 4 | **Threshold parameters** | Coverage floors, tier runtime budgets, performance budgets, complexity ceiling, flake pass-rate floor, quarantine expiry |
| 5 | **Workflow inventory** | Product-specific E2E workflows and the component inventory tree (§14.2) |
| 6 | **Gap register** | Verified findings against *that* repo, with evidence and severity. Never inherited from another consumer |
| 7 | **Local deviations** | Any canonical rule the consumer does not follow, with a reason and an expiry |
| 8 | **Sequencing** | The ordered remediation plan for its own gap register |

**Rules for instances:**

- **Never copy canonical sections.** Link to them. A duplicated framework section is a future
  contradiction.
- **Never inherit a gap register.** Findings must be verified against the repo that claims them.
- **Deviations are recorded, not silent.** A consumer that skips a canonical rule says so in §7.

---

## 19. Change protocol · [CANONICAL]

This document is consumed by every sibling repo through `shared/`, so a change here changes every
consumer's strategy at the next read.

- **Additive changes** (a new pattern, a new format validator) may land directly.
- **Changes that tighten a canonical rule** require a note in [`docs/PLAN.md`](PLAN.md) and a grace
  window, because they can turn a green consumer red.
- **Consumer-specific content never lands here.** If it names a product, a route, an element id, or a
  threshold, it belongs in that consumer's instance.
- **When a consumer discovers a durable, general practice**, promote it here rather than keeping it
  local — that is how the framework earns its keep.
