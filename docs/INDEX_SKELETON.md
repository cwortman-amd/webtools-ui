# `pages/index.html` skeleton — canonical template + CI guard

> **Status**: live (Phase 9.8e P4, 2026-05-05)
> **Source of truth**: [`templates/index.skeleton.html`](../templates/index.skeleton.html)
> **CI guard**: [`scripts/check_index_skeleton.py`](../scripts/check_index_skeleton.py)
> **Adopted by**: `llm-benchmark`, `cluster-manager`, `dc-planner`

The three consumer dashboards (`llm-benchmark`, `cluster-manager`, `dc-planner`) all serve their main entry from `pages/index.html`. The first ~18 lines — doctype, `<html>`, `<head>` charset/viewport, title, icon, canonical stylesheet stack, optional manifest + theme-color — are structurally identical (modulo per-repo titles, icons, and a few optional metadata blocks). Without a guard, this prefix routinely drifts: stylesheet load order swaps, viewport meta loses `viewport-fit=cover`, dc-planner's font preload re-points at a local `../css/...` path instead of the canonical `../shared/css/...`, etc.

This doc describes the template + per-consumer values + strict-diff CI guard that locks that prefix down.

## 1. The template

[`templates/index.skeleton.html`](../templates/index.skeleton.html) holds the canonical shape:

```html
<!doctype html>
<html lang="en" data-skin="matte-dark" data-theme="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>{{TITLE}}</title>
{{ICON_LINK}}
{{?STRUCTURED_DATA}}
  <link rel="preload" href="../shared/css/fonts/material-symbols-outlined.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="../shared/css/material-symbols.css" />
  <link rel="stylesheet" href="../shared/css/base.css" />
{{?PER_REPO_STYLESHEETS}}
  <link rel="stylesheet" id="skinStylesheet" href="../shared/css/skins/matte-dark.css" />
  <link rel="stylesheet" href="../shared/css/chat-orb.css" />
  <link rel="stylesheet" href="../shared/css/demo-mode.css" />
{{?MANIFEST_LINK}}
{{?THEME_COLOR_META}}
  <!-- end:skeleton -->
```

> **Phase 9.8e P5 (2026-05-05) — `demo-mode.css` promoted to canonical.**
> Originally per-repo: `dc-planner` carried it in `PER_REPO_STYLESHEETS`,
> `llm-benchmark` + `cluster-manager` didn't load it at all. With the
> canonical audience-picker (`shared/js/demo-picker.js` exposing
> `window.DemoPicker`) now serving all three consumers, the
> `.demo-picker*` rules in `shared/css/demo-mode.css` are mandatory
> head-loaded chrome — promoted into the template alongside
> `chat-orb.css`. See [`DEMO.skeleton.md` §6.4](templates/DEMO.skeleton.md)
> and [`PLAN.md`](PLAN.md) Phase 9.8e P5 for the full rollout. Each
> consumer's own `docs/DEMO.md` mirrors the §3.1 adoption matrix.

### Placeholder grammar

| syntax | meaning | example |
| --- | --- | --- |
| `{{NAME}}` | required, **inline** substitution within a line | `<title>{{TITLE}}</title>` |
| `{{NAME}}` (alone on a line) | required, **whole-line** replacement | `{{ICON_LINK}}` (value carries its own indent) |
| `{{?NAME}}` (alone on a line) | **optional** whole-line replacement; line is dropped if value is missing/null | `{{?MANIFEST_LINK}}` |

A line that is entirely a placeholder (with optional surrounding whitespace) is treated as a line-block: the value replaces the entire line and may itself be multi-line (use `\n` in JSON). The value is responsible for its own indentation.

### Why `<!-- end:skeleton -->`?

The sentinel demarcates the **template-driven prefix** from per-repo head content (inline `<style>` blocks, page-specific `<script>` tags, `error-popup.js`, mobile-drawer.js, etc.). Everything below the sentinel diverges intentionally and is **not** checked. The CI guard extracts lines 1 through the sentinel from `pages/index.html` and diffs against the rendered template; bytes below the sentinel are out of scope.

This shape was chosen deliberately:

* The first ~18 lines are pure scaffolding — they should be identical, so they're locked.
* The 100+ lines of per-repo layout CSS (sidebar variables, drawer rules, mode-visibility tweaks) below the sentinel are **per-repo concerns** that legitimately diverge — they're not in the template.
* When a future canonical asset is promoted (e.g. the inline `<style>` block becomes `webtools-ui/css/shell-layout.css`), the template can grow downward without breaking existing consumers.

## 2. Per-consumer values

Each consumer ships `pages/index.skeleton.values.json`:

```json
{
  "_doc": "…",
  "_owner": "<repo-name>",
  "TITLE": "<repo's title>",
  "ICON_LINK": "  <link rel=\"icon\" … />",
  "STRUCTURED_DATA": null,                 // or "  <script …>…</script>"
  "PER_REPO_STYLESHEETS": "  <link … />",  // or null
  "MANIFEST_LINK": null,                   // or "  <link rel=\"manifest\" … />"
  "THEME_COLOR_META": null                 // or "  <meta name=\"theme-color\" … />"
}
```

### Adoption matrix (Phase 9.8e P4 + P5)

| placeholder | `llm-benchmark` | `cluster-manager` | `dc-planner` |
| --- | --- | --- | --- |
| `TITLE` | "LLM Benchmark" | "Cluster Manager" | "DC Planner" |
| `ICON_LINK` | `/favicon.svg` (file) | inline SVG data-URI (cluster icon) | inline SVG data-URI (DC monogram) |
| `STRUCTURED_DATA` | — | `application/ld+json` schema.org `WebPage` | — |
| `PER_REPO_STYLESHEETS` | `dashboard-tutor.css` | `cm-overrides.css` + `demo.css` | `dc-planner.css` |
| `MANIFEST_LINK` | — | — | `../data/manifest.json` |
| `THEME_COLOR_META` | — | — | `#111315` |

> **P5 changelog**: `dc-planner`'s `PER_REPO_STYLESHEETS` value lost
> `shared/css/demo-mode.css` — that asset now ships from the canonical
> template, so all three consumers load it from the same head position
> (right after `chat-orb.css`).

## 3. The check

[`scripts/check_index_skeleton.py`](../scripts/check_index_skeleton.py) is the strict-diff CI guard. It:

1. Reads `templates/index.skeleton.html` from this repo (resolved relative to the script).
2. Reads `<consumer-repo>/pages/index.skeleton.values.json`.
3. Renders the template with the values (`{{NAME}}` → string, `{{?NAME}}` → string-or-omit).
4. Reads `<consumer-repo>/pages/index.html` and extracts lines 1 through the `<!-- end:skeleton -->` sentinel.
5. Byte-compares (3) against (4). If they match, exits 0. If they differ, prints a unified diff to stderr and exits 1.

### Manual invocation

```bash
# from any consumer repo root
python3 shared/scripts/check_index_skeleton.py --repo .

# or from the webtools-ui repo (specify the consumer)
python3 scripts/check_index_skeleton.py --repo /path/to/llm-benchmark
```

### Wired into

* `llm-benchmark` — `test_offline.sh` §25e (runs in the cross-repo CI gate alongside the vendor-manifest hash check).
* `cluster-manager` — `scripts/self-check.sh` Stage 1b (runs as a static validator, before the slow Playwright stages).
* `dc-planner` — `tests/self-check.sh` §2x (runs immediately after the existing `index.html` structure & feature checks).

All three exit non-zero on drift, so any branch that diverges from the canonical skeleton fails CI before it can land.

## 4. Modifying the template

When you need to change the canonical scaffolding (e.g. promote a new shared stylesheet to head, retire an obsolete preload, swap stylesheet load order), follow this protocol:

1. **Open a webtools-ui PR** that updates `templates/index.skeleton.html` *and* this `INDEX_SKELETON.md` adoption matrix.
2. **In the same PR (or a stacked one)**, update each of the three consumers' `pages/index.html` so the rendered template still matches byte-for-byte. Run the check locally per consumer to confirm.
3. Each consumer's CI will catch any consumer that didn't get the update.

If the change is **opt-in per consumer** (e.g. only dc-planner needs `<link rel="manifest">`), use a `{{?BLOCK_NAME}}` optional placeholder so consumers that don't need it can leave the slot null.

If the change is **per-consumer cosmetic** (e.g. icon glyph), use a `{{NAME}}` placeholder — the consumer just updates its `index.skeleton.values.json` and the check passes again.

## 5. Why strict diff (not lint)

We considered three shapes (see commit `[Phase 9.8e P4]`'s body for the full design dialogue):

| approach | pro | con |
| --- | --- | --- |
| **structural lint** (require canonical anchors, allow extras between) | ships green from day 1, surfaces only meaningful drift | lets cosmetic drift survive (mixed `1` vs `1.0` viewport scale, missing `viewport-fit=cover`, redundant inline `<style>` blocks) |
| **diff with per-consumer baseline snapshot** (jest-style `index.head.snapshot.html`) | catches all drift, no big-bang refactor | harmonization happens via PR review when the snapshot updates, not automatically — drift creeps in via the snapshot |
| **strict diff** (template + per-consumer values, byte-for-byte) | catches every drift, drives consumers toward canonical | required a one-time alignment refactor across all three repos |

**Strict diff wins** because the alignment-refactor cost is bounded (one commit per consumer) and the long-term behavior is the strongest: drift is impossible without an explicit values-JSON or template change, both of which surface in PR review. The other two approaches accept ongoing cosmetic drift; this one closes the door.

## 6. Future template growth

Candidates for promotion into the template (each requires consumer-side alignment first):

* `<script src="../shared/js/mobile-drawer.js" defer></script>` — currently per-repo (dc-planner loads in head with defer; llm-benchmark + cluster-manager load in body without defer). Decision deferred until the inline-bootstrap-vs-defer ordering is harmonized.
* `<link rel="manifest" href="../data/manifest.json" />` and `<meta name="theme-color" content="…" />` — currently optional. Promoting from optional to required would mean adding manifest files to llm-benchmark and cluster-manager.
* The shell layout `<style>` block — currently per-repo, would need to become a canonical `webtools-ui/css/shell-layout.css` first.

When any of these graduate from "per-repo concern" to "canonical asset", the template grows downward and the consumers' `index.skeleton.values.json` files lose the corresponding placeholder.
