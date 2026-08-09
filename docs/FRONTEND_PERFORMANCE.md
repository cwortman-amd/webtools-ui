# Frontend Performance & Responsiveness — Canonical Framework

**Status:** Canonical, 2026-08-05. Applies to every consumer that mounts this repo at `shared/`.

This doc lives in `webtools-ui/docs/` so all sibling consumer repos (`llm-benchmark`,
`cluster-manager`, `dc-planner`, `knowledge-exchange`) read the same source of truth via their
`shared/` symlink. It is **read, not copied** — there is exactly one framework and it lives here.

Each consumer keeps a **local instance** declaring its own pages, measured baselines, budgets, and
gap register. The instance outline is
[`docs/templates/FRONTEND_PERFORMANCE.skeleton.md`](templates/FRONTEND_PERFORMANCE.skeleton.md).

> **Canonical vs local.** Sections marked **[CANONICAL]** are fixed: their structure, rules, and
> vocabulary are identical in every consumer, and a consumer that deviates records the deviation in
> its instance rather than editing this file. Sections marked **[LOCAL]** supply numbers.

**Relationship to the testing framework.** This document defines *what good feels like and what we
promise*. [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md) defines *how anything is tested*. Performance
requirements here are verified by that framework's **Tier 6** (§12.1 performance, §12.3
accessibility). Where the two overlap, the tier model wins on test mechanics and this document wins
on thresholds.

---

## 1. Scope · [CANONICAL]

In scope: user-perceived responsiveness of a web frontend — initial load, interaction latency,
visual stability, asset weight, and the feedback shown during data import, save, export, and other
long operations.

Out of scope: backend throughput and per-endpoint latency (framework §12.1, Python/Node rows), and
artifact generation time measured server-side (framework §11).

The distinction that matters: a frontend can meet every Core Web Vital and still feel broken if a
user clicks *Save* and nothing visibly happens for two seconds. Load metrics and *feedback*
discipline are separate obligations, and §4 exists because most specs get the second one wrong.

---

## 2. Metric model · [CANONICAL]

### 2.1 Field and lab are different instruments

| | Field (RUM) | Lab (synthetic) |
| :--- | :--- | :--- |
| Measures | Real users, real devices, real networks | One scripted run on fixed hardware |
| Good for | Release gates, regression alerts, truth | Debugging, CI gates, pre-merge signal |
| Bad for | Root-cause analysis | Claiming users are happy |
| Variance | High; needs percentiles | Low; needs throttling to be meaningful |

Never gate a release on a single lab run, and never debug from field percentiles alone. A lab number
without declared throttling, cache state, and device profile is unfalsifiable and belongs in no
requirements document.

### 2.2 Core Web Vitals are defined at p75 — do not re-percentile them

| Metric | Good | Needs work | Poor |
| :--- | :--- | :--- | :--- |
| **LCP** — Largest Contentful Paint | ≤ 2.5 s | ≤ 4.0 s | > 4.0 s |
| **INP** — Interaction to Next Paint | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| **CLS** — Cumulative Layout Shift | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| **TTFB** — Time to First Byte (diagnostic) | ≤ 800 ms | ≤ 1800 ms | > 1800 ms |
| **FCP** — First Contentful Paint (diagnostic) | ≤ 1.8 s | ≤ 3.0 s | > 3.0 s |

**Use p75, and only p75, for these five.** The thresholds above were calibrated by Chrome against
the 75th percentile of real-user distributions; a p50 LCP of 2.5 s is a materially worse experience
than a p75 LCP of 2.5 s, and a p95 gate on CLS will fail on outliers that no amount of engineering
removes. Quoting "LCP p95 ≤ 2.5 s" produces a number that cannot be compared to any published
benchmark, including your own competitors'.

TTFB and FCP are **diagnostics, not goals**. They explain a bad LCP; they are not independently
worth optimizing, and a consumer that hits its LCP budget with a slow TTFB has no problem to fix.

> **A tighter house target is legitimate — say so explicitly.** A consumer may set TTFB ≤ 500 ms as
> an internal bar. Record it in the local instance as a house target and note that it is stricter
> than the published "good" threshold, so nobody later mistakes it for the standard.

### 2.3 Task timings use p50 and p95

Import, save, export, and search are *your* operations, not standardized vitals, so you choose the
percentiles. Use both:

- **p50** — the typical experience. Regressions here are felt by everyone.
- **p95** — the tail. This is where large files, cold caches, and slow devices live, and it is the
  number that generates support tickets.

Always pair a task timing with its **input size**. "Import completes in 4 s" is meaningless;
"import of 5,000 rows completes in 4 s at p95" is a requirement. Declare the representative sizes
in the local instance and hold them fixed across releases, or the trend line is noise.

### 2.4 What not to budget — the long-task trap

A **long task** is *defined* as a main-thread task exceeding 50 ms. A requirement reading "no
main-thread task may exceed 50 ms" is therefore a restatement of "no long tasks may exist," which no
non-trivial application satisfies: a single JSON parse of a few hundred kilobytes breaches it.
Specs that contain this line are never enforced, which is worse than having no line at all.

Budget the aggregate instead:

| Instead of | Budget this | Where |
| :--- | :--- | :--- |
| "No task over 50 ms" | **TBT ≤ 200 ms** (Total Blocking Time — summed time beyond 50 ms across all long tasks) | Lab |
| "UI never freezes" | **INP ≤ 200 ms at p75** | Field |
| "Interactions feel instant" | **No single task > 200 ms during a named critical interaction** | Lab, per-interaction |

TBT is the lab proxy for INP and is what Lighthouse reports. The third row is the only per-task
budget worth writing, and it applies to *named* interactions you have chosen to protect, not to
every task in the application.

---

## 3. Budget classes · [CANONICAL classes, LOCAL numbers]

Every consumer declares a number for each class. A class with no number is a declared gap, recorded
in the instance's gap register — not an empty row.

| # | Class | Metric | Percentile |
| :--- | :--- | :--- | :--- |
| B1 | Page load | LCP, FCP | p75, field |
| B2 | Interaction latency | INP | p75, field |
| B3 | Visual stability | CLS | p75, field |
| B4 | Lab blocking | TBT, Lighthouse performance score | Single throttled run |
| B5 | Asset weight — per page | Compressed JS, CSS, images, total | Absolute ceiling |
| B6 | Asset weight — critical path | Render-blocking bytes and request count | Absolute ceiling |
| B7 | Task timings | Import, save, export, search, by input size | p50 and p95 |
| B8 | Feedback latency | Acknowledgment, indicator onset (§4) | Absolute ceiling |

### 3.1 Asset weight is the budget most specs omit

It is also the one that most often *causes* a failing LCP. Set ceilings on **compressed transfer
size**, since that is what crosses the network, but track raw size too — raw bytes drive parse and
execute cost on low-end devices, and a heavily-compressible 250 KiB JSON blob is cheap to transfer
and expensive to parse.

Budget separately for **render-blocking** bytes. A page may legitimately ship a megabyte of
lazily-loaded JavaScript; the same megabyte in parser-blocking `<script>` tags in `<head>` is a
different product. Scripts without `defer`, `async`, or `type="module"` block the parser at their
position in the document, so their placement is part of the budget, not an implementation detail.

---

## 4. The wait ladder · [CANONICAL]

### 4.1 Acknowledgment and progress indication are two different obligations

Most specifications conflate them, then contradict themselves. Separate them:

**Acknowledgment** answers *did it hear me?* It is synchronous, unconditional, and immediate — a
button enters its pressed or disabled state, a row highlights, an input locks. It happens on every
action regardless of expected duration, within one frame where possible and **≤ 100 ms** always.
There is no scenario in which acknowledgment is withheld.

**Progress indication** answers *is it still working, and how much is left?* It is conditional on
duration and is what §4.2 governs. It is the spinner, skeleton, or progress bar.

A spec that says "show a loading state within 1 s for slow operations" *and* "show no loader for
operations under 1 s" is not wrong in intent but is untestable as written, because the
implementation cannot know an operation's duration before starting it. The resolution is not a
better prediction. It is two constants.

### 4.2 Two constants make the ladder testable

| Constant | Default | Purpose |
| :--- | :--- | :--- |
| **D** — delay threshold | 300 ms | Do not mount an indicator until D has elapsed. Operations finishing before D never show one. |
| **M** — minimum visible duration | 500 ms | Once mounted, keep the indicator for at least M. Prevents a flash on operations finishing just after D. |

This converts both rules into decidable assertions:

- *No flicker* → for any operation completing in < D, no indicator is ever mounted.
- *Always inform* → for any operation exceeding D, an indicator is mounted at D (± tolerance).
- *No flash* → any mounted indicator remains visible ≥ M.

The cost is bounded and worth naming: an operation finishing at D + ε holds its indicator until
D + M, adding up to M of perceived latency in that narrow window. This is deliberate. A visible
element that appears and vanishes within 200 ms reads as a glitch and measurably lowers confidence,
which is a worse outcome than a half-second of honest waiting.

Both constants are tunable per consumer but must be **declared once and applied uniformly**.
Per-component values are how a UI ends up feeling inconsistent.

### 4.3 The ladder

Duration is *elapsed* time, so a single operation moves down the ladder as it runs.

| Elapsed | Pattern | Requirement |
| :--- | :--- | :--- |
| 0 ms | **Acknowledgment** | Always. Control enters pressed/disabled/busy state. ≤ 100 ms. |
| < D | Nothing further | No indicator is mounted. |
| D – 3 s | **Indeterminate** | Spinner or skeleton, placed in the region being updated — not a page-level overlay. |
| 3 – 10 s | **Determinate where possible** | Progress bar with percentage or count. If progress is genuinely unknowable, keep the indeterminate indicator and add status text describing the phase. |
| > 10 s | **Backgroundable job** | §4.4. |

Placement matters as much as timing. An indicator in the region being updated tells the user *what*
is loading; a full-page overlay for a partial update blocks interaction the user could otherwise
continue, and converts a partial wait into a total one.

**Never show a fake determinate bar.** A progress bar that animates on a timer rather than tracking
real work is a lie that users detect quickly, usually when it sits at 99% for a minute. If progress
is unknowable, indeterminate plus honest status text is the correct and more trustworthy choice.

### 4.4 Operations beyond 10 seconds are jobs, not waits

Past roughly ten seconds the interaction model must change. A progress bar is no longer sufficient,
because the reasonable user behavior is to go do something else. Such an operation becomes a **job**
with these properties:

1. **Identity.** A stable id the client can poll or subscribe to.
2. **Survivable.** Navigating away, reloading, or losing the connection does not cancel it, and
   returning re-attaches to live status rather than showing a fresh empty state.
3. **Phased.** Status names the current phase and position — "Rendering slide 12 of 40", not
   "Working…". Phase changes are the natural update milestone.
4. **Non-blocking.** The user can continue with unrelated parts of the application.
5. **Terminal.** Ends in an explicit success carrying its result, or a failure carrying a reason and
   a retry path. A job that stops updating is a defect, not a state.
6. **Cancellable** where the underlying work permits it, with the control visible during the run.

A UI that polls a job endpoint but discards status on reload has implemented (1) and not (2), which
is the most common partial implementation and the one users notice first.

### 4.5 Status copy

Generic text wastes the one channel that reduces uncertainty. Name the operation and, when known,
the quantity and position.

| Instead of | Write |
| :--- | :--- |
| Loading… | Loading dashboard… |
| Please wait | Importing 3,428 rows… |
| Processing | Validating rows 1,200 of 3,428 |
| Working… | Generating report — step 2 of 4 |
| Error | Import failed at row 412: unexpected column "qty" |

Copy is part of the requirement, not decoration. "Importing 3,428 rows…" tells the user the file
parsed and the count matched their expectation — information a spinner cannot carry.

---

## 5. Status semantics and accessibility · [CANONICAL]

Every asynchronous operation exposes exactly one of: `idle`, `pending`, `progress`, `success`,
`error`. Model this explicitly — a boolean `isLoading` cannot represent "succeeded with warnings" or
"failed, retryable" and always grows into a tangle of correlated flags.

Accessibility obligations, which the framework's §12.3 verifies:

- Status regions use `role="status"` (polite) or `role="alert"` (assertive, errors only). Reserve
  assertive announcements for conditions requiring immediate attention; a polite region that
  interrupts on every progress tick is worse than silence.
- The updating container carries `aria-busy="true"` while pending, cleared on settle.
- Determinate bars use `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
  Indeterminate bars omit `aria-valuenow`.
- Throttle live-region updates to **no more than one announcement every 3–5 s**. A region updated at
  animation rate renders a screen reader unusable.
- State is never conveyed by color or motion alone; pair with text or an icon with an accessible
  name.
- Respect `prefers-reduced-motion` for spinners and skeleton shimmer.

---

## 6. Progressive rendering · [CANONICAL]

Render the shell first, then fill regions as data arrives. Prioritize by what the user came for, not
by what returns fastest.

Rules:

- Sections load and fail independently. One failed widget renders its own error state; it does not
  blank the page.
- Reserve layout space for pending content — this is the primary defense against CLS. A skeleton
  whose dimensions differ from the content that replaces it *causes* the layout shift it was meant
  to prevent.
- One progress signal per logical task. Competing spinners in one view read as a broken page.
- Above-the-fold and primary actions come before secondary widgets.
- Prefer streaming or pagination over a spinner for large result sets: first results visible early
  beats a complete result set later, at equal total duration.

---

## 7. Functional requirements · [CANONICAL]

Behavioral obligations. Thresholds live in §8; each consumer's numbers live in its instance.

| ID | Requirement | Acceptance criteria | Verification |
| :--- | :--- | :--- | :--- |
| **FE-01** | The frontend shall acknowledge every user-initiated action. | The control enters a pressed, disabled, or busy state within the acknowledgment budget, independent of operation duration. | Component test asserting state change on the dispatched event; E2E timing probe. |
| **FE-02** | The frontend shall not mount a progress indicator for operations completing within **D**. | No indicator element enters the DOM for a mocked response resolving before D. | E2E with a response mocked below D; assert the indicator selector never matches. |
| **FE-03** | The frontend shall mount a progress indicator for operations exceeding **D**. | An indicator appears at D within tolerance and is scoped to the affected region. | E2E with a response mocked above D; assert onset time and container. |
| **FE-04** | A mounted progress indicator shall remain visible for at least **M**. | Indicator visible duration ≥ M for a response resolving at D + ε. | E2E measuring mount-to-unmount interval. |
| **FE-05** | The frontend shall use determinate progress when progress is measurable, and shall not simulate progress otherwise. | Determinate bars advance in response to real work; no timer-driven animation stands in for unknown progress. | Code review plus E2E asserting progress correlates with emitted work events. |
| **FE-06** | The frontend shall display contextual status text naming the operation. | Status text names the task and, where known, quantity and position. | Component and visual-regression tests over each operation's status region. |
| **FE-07** | The frontend shall render the page shell before non-critical content. | Shell and primary navigation are interactive before secondary sections settle. | E2E with staggered stubs; assert shell interactivity precedes section completion. |
| **FE-08** | Sections shall load and fail independently. | A single failed section renders a scoped error; siblings render normally. | E2E injecting one failing endpoint. |
| **FE-09** | The frontend shall reserve layout space for pending content. | Replacing a placeholder with content produces no layout shift beyond the CLS budget. | Lab CLS measurement over the load sequence. |
| **FE-10** | Operations exceeding the job threshold shall be modeled as jobs per §4.4. | Job has an id, survives reload, reports phase, is non-blocking, and terminates explicitly. | E2E: start job, reload, assert re-attachment to live status and terminal state. |
| **FE-11** | The frontend shall expose a terminal state for every operation. | Every operation ends in success or error; none remain pending indefinitely. | State-machine unit tests proving no non-terminal absorbing state; E2E timeout assertions. |
| **FE-12** | Failures shall be actionable and preserve user input. | Error names what failed and why, offers retry where recoverable, and no user-entered data is lost. | E2E failure-path tests over network, server, and validation errors. |
| **FE-13** | Status changes shall be exposed to assistive technology per §5. | Correct roles and `aria-busy`; announcements throttled to the declared rate. | Automated axe-core audit plus manual screen-reader pass. |
| **FE-14** | The frontend shall preserve user control during long operations. | Where cancel, pause, or background is supported, the control is visible and functional throughout. | E2E asserting the control is enabled mid-operation and takes effect. |

---

## 8. Non-functional requirements · [CANONICAL shape, LOCAL numbers]

`<>` denotes a value supplied by the local instance.

| ID | Requirement | Threshold | Method | Pass criteria |
| :--- | :--- | :--- | :--- | :--- |
| **NFR-01** | Main content renders promptly. | LCP ≤ `<2.5 s>` at p75 | Field RUM; lab under declared throttling | p75 at or below budget over the reporting window |
| **NFR-02** | Interactions remain responsive. | INP ≤ `<200 ms>` at p75 | Field RUM | p75 at or below budget |
| **NFR-03** | Layout remains stable. | CLS ≤ `<0.1>` at p75 | Field RUM; lab over load sequence | p75 at or below budget |
| **NFR-04** | Main thread is not saturated during load. | TBT ≤ `<200 ms>` | Lighthouse, declared throttling | Median of ≥ 3 runs at or below budget |
| **NFR-05** | Named critical interactions do not block. | No single task > `<200 ms>` during the named interaction | Lab trace per interaction | No task exceeds budget in the traced window |
| **NFR-06** | Page payload is bounded. | Compressed ≤ `<N KiB>`, raw ≤ `<N KiB>` per page | Static analysis of built assets | Both at or below budget |
| **NFR-07** | Critical path is bounded. | Render-blocking ≤ `<N KiB>` and ≤ `<N>` requests | Static analysis of document markup | Both at or below budget |
| **NFR-08** | Server responds promptly. | TTFB ≤ `<800 ms>` | Field RUM | p75 at or below budget (diagnostic; see §2.2) |
| **NFR-09** | Acknowledgment is immediate. | ≤ `<100 ms>` from input event | E2E timing probe | Every measured action within budget |
| **NFR-10** | Indicator onset matches the ladder. | Mounted at D = `<300 ms>` ± `<100 ms>` | E2E with mocked delays | Onset within tolerance |
| **NFR-11** | Indicators do not flash. | Visible ≥ M = `<500 ms>` | E2E mount-to-unmount timing | Duration at or above M |
| **NFR-12** | Data operations complete predictably. | Per operation and input size, p50 ≤ `<x>`, p95 ≤ `<y>` | Instrumented timings over a fixed corpus | Both percentiles within budget |
| **NFR-13** | Long jobs report progress. | Status update at least every `<5 s>` while running | E2E observation of a long job | No gap exceeds the interval |
| **NFR-14** | Announcements do not flood. | ≤ 1 live-region announcement per `<3 s>` | Instrumented live-region observation | Rate at or below budget |

---

## 9. Instrumentation contract · [CANONICAL]

Budgets are unenforceable without measurement, and measurement added after the fact never covers
the paths that matter. Emit a common event shape so every consumer's data is comparable:

```json
{
  "event": "task_timing",
  "task": "import",
  "phase": "complete",
  "durationMs": 4182,
  "inputSize": 3428,
  "inputUnit": "rows",
  "outcome": "success",
  "page": "/catalog"
}
```

Required coverage:

| Signal | Source |
| :--- | :--- |
| LCP, INP, CLS, TTFB, FCP | `PerformanceObserver`, reported on `visibilitychange` → `hidden` |
| Task timings | Explicit start/settle marks around each declared operation in §3 B7 |
| Indicator lifecycle | Mount and unmount timestamps, to verify D and M in the field |
| Job phase transitions | Emitted on each phase change, to verify NFR-13 |

Rules:

- Report vitals on `visibilitychange`, **not** `unload` — `unload` is unreliable on mobile and
  silently loses a biased subset of sessions, typically the slow ones.
- Use `navigator.sendBeacon` so reporting cannot delay navigation.
- Sample deliberately and record the rate. An unrecorded sample rate makes every percentile
  derived from it uninterpretable.
- Instrumentation must never itself breach a budget: no synchronous work in the interaction path.

---

## 10. Verification · [CANONICAL]

Map every requirement to a tier in [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md).

| Requirement class | Tier | Mechanism |
| :--- | :--- | :--- |
| State machines, terminal states (FE-11) | 1 Unit | Reachability over the state model |
| Status text and roles (FE-06, FE-13) | 2 Component | Rendered-output assertions |
| Ladder timing (FE-02 – FE-04) | 4 E2E | Mocked latency, measured onset and duration |
| Progressive rendering (FE-07 – FE-09) | 4 E2E | Staggered stubs |
| Job lifecycle (FE-10) | 4 E2E | Start, reload, re-attach, terminate |
| Failure paths (FE-12) | 4 E2E | Fault injection |
| Vitals and TBT (NFR-01 – NFR-05) | 6 Non-func | Lighthouse CI plus field RUM |
| Asset weight (NFR-06, NFR-07) | 6 Non-func | Static analysis, gated in CI |
| Accessibility (FE-13, NFR-14) | 6 Non-func | axe-core plus manual screen-reader pass |

Lab runs declare **device profile, network throttling, and cache state**, and compare like with
like. A cold-cache mobile-throttled LCP and a warm-cache desktop LCP are different measurements, and
a trend line mixing them means nothing.

---

## 11. Keeping the measurements honest · [CANONICAL]

The failure mode for a performance suite is not a red build. It is a green one that measures
nothing. These rules mirror the testing framework's §13 anti-false-positive protocol.

1. **Assert the measurement is non-zero.** A vitals test where the observer never fired reports
   perfect scores. Assert the metric was actually collected before asserting it is within budget.
2. **A skipped perf test is not a pass.** Lighthouse unavailable in CI must fail or explicitly
   report SKIPPED, never silently succeed.
3. **Budget against a measured baseline, then ratchet.** A budget set far above current performance
   never fails and provides no protection. Set it just above today's number and tighten it.
4. **Fix the corpus.** Task-timing budgets are meaningless if the input changes between runs.
   Version the fixture corpus alongside the budget.
5. **Watch p75 drift, not just breaches.** A metric moving from 1.2 s to 2.4 s against a 2.5 s
   budget is a regression that has not yet failed. Alert on trend.
6. **Prove a ladder test can fail.** A timing assertion whose mock never delays passes trivially.
   Verify each ladder test fails against a deliberately wrong delay before trusting it.

---

## Sources

- [Core Web Vitals thresholds and p75 rationale](https://web.dev/articles/vitals) — web.dev
- [INP](https://web.dev/articles/inp), [LCP](https://web.dev/articles/lcp),
  [CLS](https://web.dev/articles/cls), [TTFB](https://web.dev/articles/ttfb) — metric definitions
- [Total Blocking Time](https://web.dev/articles/tbt) and
  [Long Tasks](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming) — why the
  50 ms figure is a definition rather than a budget
- [Performance budgets](https://web.dev/articles/performance-budgets-101) — web.dev
- [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
  and [`progressbar` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/progressbar) — MDN
- Nielsen Norman Group, *Response Times: The 3 Important Limits* — origin of the 0.1 s / 1 s / 10 s
  boundaries underlying §4.3
