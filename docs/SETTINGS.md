---
type: Design System
title: Settings window — chrome, persistence, and panes
description: 'Canonical Settings modal for AMD Instinct dashboards. Relocates skin, light/dark appearance, and user mode out of the product left sidebar into a two-pane settings window. Complements [`DESIGN.md`](DESIGN.md) (shell layout) and [`js/shell.js`](../js/shell.js) (`Shell.setSkin` / `setTheme` / `setUserMode`).'
status: implemented
updated: 2026-08-27
---
<!-- markdownlint-disable MD025 -->
# Settings

The **webtools-ui Settings** system is the single chrome surface for workspace appearance and
user-mode gating across AMD Instinct dashboards (`llm-benchmark`, `dc-planner`, `cluster-manager`,
and other `type: dashboard` consumers). Catalog products (`demo-portal`, `knowledge-exchange`)
reuse the same window chrome when they expose Settings from `css/chrome.css` toolbars.

This document is the **implementation contract**. It is not ViXCi/Obsidian: there is no vault,
community theme marketplace, keychain product, or central feature-flag service. Those claims
are out of scope (**EXC-RBAC**, **EXC-FLAGS**).

**Related:** [`DESIGN.md`](DESIGN.md) · [`TOKENS.md`](TOKENS.md) · [`SDK.md`](SDK.md) ·
[`SHELL_MODULES.md`](SHELL_MODULES.md) · [`PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md)

---

## 1. Product overview and design philosophy

### Why Settings exists

Skin, light/dark, and Standard / Advanced / Expert previously lived in **product left sidebar**
expanders. The shared Settings rollout removes those inline lists and keeps one compact Settings
entry point, avoiding preference controls that overflow or disappear with a collapsed rail.

**Implemented contract:**

1. **Move** Theme (skin), Light/Dark appearance, and User mode into this Settings window.
2. **Remove inline settings chrome from the left sidebar.** `.sidebar-bottom` keeps **Agent**
   (chat orb), one **Settings** gear, and **Collapse**. Inline `.side-nav-skin-list` / `.side-nav-mode-list` and
   `#themeToggleSide` / `#skinToggleSide` / `#modeToggleSide` go away.
3. **Do not remove the product tab sidebar.** `Shell.setLayout` already retired top-bar tab
   strips (`nav-side` is the only layout). Tab navigation stays in `.sidebar-nav`. Settings is a
   **modal**, not a replacement for `?tab=` routing.

Entry points after the change: a **Settings** control in the remaining utility rail (gear,
`settings` Material Symbol), the mobile hero toolbar, and a keyboard shortcut (see §9).

### Core design principles

1. **Direct manipulation with instant persistence.** Changing a row applies immediately and
   writes `localStorage` under `window.SHELL_PREFIX`. No Save / Apply for standard rows.
   `localStorage` reads/writes stay `try/catch` wrapped (iOS “Block All Cookies” throws).
2. **Deterministic defaults.** Invalid or missing keys fall back to factory defaults without
   blanking the shell (`setSkin` → `amd-gold`, `setTheme` → `dark`, `setUserMode` → `standard`).
3. **Reactive shell APIs.** Settings **must** call existing `window.Shell` methods so
   `data-skin`, `data-theme`, `data-user-mode`, stylesheet `href`, and `shell:modeChanged`
   stay the single runtime. Do not invent a parallel event bus (`ViXCiEventBus` is not in this
   repo). Optional: dispatch `shell:settingChanged` with `{ key, value }` after Shell applies.
4. **Per-product isolation.** Keys are `${SHELL_PREFIX}-skin` (and siblings). Chat orb LLM
   keys use `ChatOrb.mount({ storagePrefix })` — **never** merge those namespaces.
5. **Token-led chrome.** Overlay, modal, rows, and toggles use `--ui-*` from
   [`TOKENS.md`](TOKENS.md) / the active skin. Do not hard-code ViXCi `#1e1e1e` / `#ff5a00`.
6. **Native window ergonomics.** Settings is a structured window (titlebar, drag, 8-way resize,
   maximize/restore, Escape) over a dimmed backdrop — same class of overlay as
   `Shortcuts` (`ks-backdrop` / `ks-sheet`) and suite install modals, with a two-pane interior.
7. **Left-justified pop-up chrome.** Group headings, nav rows, search, and pane copy are
   left-aligned. Settings must override consumer `button` centering
   (`text-align: left` + `justify-content: flex-start`). Canonical rule:
   [`DESIGN.md` — Workspace pop-up menus](DESIGN.md#workspace-pop-up-menus-all-projects).

---

## 2. Spatial layout: two-pane Settings window (not the product sidebar)

The Settings UI is a master–detail **inside the modal**. It is not a second app sidebar.

```
+----------------------------------------------------------------------------------+
| Settings  [data-component="settings-modal"]                                      |
| Titlebar: Settings                                           [ _ ] [ [] ] [ X ]  |
+------------------------------+---------------------------------------------------+
| LEFT: GROUPS (220px)         | RIGHT: PANE (flex: 1)                             |
| [ Search settings…      (Q)] | [ Appearance ]                                    |
|                              | ------------------------------------------------- |
| SHELL                        | Theme (skin)                                      |
| - Appearance         Active  | Visual language for chrome and accents.  [ AMD  v]|
| - User mode                  | ------------------------------------------------- |
| - Layout                     | Light / Dark appearance                           |
|                              | Light surfaces vs dark.                  [ Dark v]|
| TOOLS                        | ------------------------------------------------- |
| - Keyboard                   |                                                   |
| - Agent                      |                                                   |
|                              |                                                   |
| EXTENSIONS                   |                                                   |
| - (from ExtensionHost)       |                                                   |
+------------------------------+---------------------------------------------------+
```

### 2.1 Left pane: category navigation (220px)

- Search field at top (`#settingsSearchInput`). Filters nav items and rows (see §5.4).
- Section headings: **Shell**, **Tools**, **Extensions** (hide headings while a query is active).
- Nav items (`.settings-nav-item`): Material Symbol (18px outlined), label, `.active` with
  `--ui-accent` indicator. Keyboard: ArrowUp / ArrowDown among items.
- **Do not** copy Obsidian groups (Editor, Files and links, Keychain, Community plugins
  marketplace). This suite does not ship those products.

### 2.2 Right pane: configuration viewport

- One `.settings-pane` per category (`#pane-appearance`, `#pane-user-mode`, …). Only `.active`
  is shown (`display: flex; flex-direction: column`).
- Subheads: `.settings-section-label` (uppercase 10px, `--ui-muted`) — e.g. Theme, Appearance,
  Advanced.
- Rows: `.settings-row` — title + description left, control right.

### 2.3 Layout tokens

Use CSS variables; hex below are **fallbacks** matching `tokens.css` dark defaults, not a second
palette.

| Surface | Spec |
| --- | --- |
| Overlay `.settings-overlay` | `position: fixed; inset: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; background: color-mix(in srgb, #000 72%, transparent); backdrop-filter: blur(8px);` |
| Window `.settings-modal` | Default `width: 920px; max-width: 94vw; height: 680px; max-height: 90vh;` Maximize: `width: calc(100vw - 32px); height: calc(100vh - 32px);` `background: var(--ui-panel); border: 1px solid var(--ui-line); border-radius: 12px; box-shadow: 0 24px 48px color-mix(in srgb, #000 50%, transparent); display: flex; flex-direction: column; overflow: hidden;` |
| Titlebar | Height **40px** (`flex-shrink: 0`), `background: var(--ui-bg-soft); border-bottom: 1px solid var(--ui-line); padding: 0 14px; user-select: none;` |
| Settings sidebar | **220px** (`flex-shrink: 0`), `background: var(--ui-bg-soft); border-right: 1px solid var(--ui-line); padding: 12px 8px; overflow-y: auto;` (220px, not 240px — product rail is already 180px; keep Settings denser.) **Text:** left-justified group headings and nav items; search uses placeholder only (no visible duplicate label). |
| Content | `flex: 1; overflow-y: auto; padding: 24px 32px; background: var(--ui-bg);` |

Respect `prefers-reduced-motion`: skip blur and drag animations; keep 0.2s or instant.

---

## 3. Window lifecycle: move, resize, maximize, dismiss

Same desktop-window model as the example (8-way resize, titlebar drag, maximize), implemented
against this overlay — not `toggleSettings()` from another product.

### 3.1 Drag

- Handle: `#settingsWindowTitlebar` excluding window buttons and the search field.
- `pointerdown` → document `pointermove` / `pointerup` (`{ passive: false }` while dragging).
- Clamp: keep ≥80px of the window on-screen horizontally; titlebar `top` in `[0, innerHeight - 40]`.
- `.settings-modal.dragging { cursor: grabbing; }`

### 3.2 8-way resize

- Edges 6px, corners 12px (`.modal-edge-*`, `.modal-corner-*`).
- Min **480×360**; max `window.innerWidth - 20` × `innerHeight - 20`.
- West/north resize must adjust `left`/`top` so the opposite edge stays anchored.
- Disable handles while `.maximized`.

### 3.3 Maximize / restore / minimize

- Maximize caches geometry on the element, applies `.maximized` (near-viewport fixed box,
  10px inset), swaps icon `crop_square` → `filter_none`.
- Restore reapplies cache.
- Minimize **closes** the modal (same as close) but **does not** reset the active pane id;
  reopen restores last pane. Do not invent a docked mini-window.

### 3.4 Dismiss

1. Titlebar close (`aria-label="Close settings"`).
2. Backdrop click on `.settings-overlay` (not on `.settings-modal`).
3. `Escape` — close and return focus to the gear that opened it.
4. Teardown: remove `.active` / `hidden` from overlay, drop drag/resize listeners, restore
   `document.body` scroll lock if used.

Open/close API: `Shell.openSettings({ pane })` / `Shell.closeSettings()` so slash
commands and the agent can deep-link (`/settings appearance`).

---

## 4. UI component catalog

Reuse dashboard density from [`DESIGN.md`](DESIGN.md): 13px body, 0.72–0.78 rem chrome type,
Material Symbols outlined, visible `:focus-visible` using `--ui-accent`.

### 4.1 Settings row

```html
<div class="settings-row" data-setting-key="skin">
  <div class="settings-row-info">
    <h4>Theme</h4>
    <p>Skin stylesheet for chrome, accents, and surfaces. Default is AMD Gold.</p>
  </div>
  <div class="settings-row-control">
    <select class="settings-select" data-setting="skin" aria-label="Theme">…</select>
  </div>
</div>
```

| Token | Value |
| --- | --- |
| Row | `display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--ui-line);` |
| Title `h4` | `font-size: 13px; font-weight: 600; color: var(--ui-header); margin: 0 0 3px;` |
| Description `p` | `font-size: 11.5px; color: var(--ui-muted); line-height: 1.4; margin: 0;` |
| Control cell | `display: flex; align-items: center; justify-content: flex-end; min-width: 140px;` |

Touch: controls ≥ **40×40px** on coarse pointers; desktop selects may be shorter in height but
must remain keyboard operable.

### 4.2 Control primitives

**Toggle** (binary). `role="switch"` + `aria-checked`. Track 36×20, handle 16×16, on-state
`background: var(--ui-accent)`. Enter/Space toggles. Use for Agent Gateway enablement **only if**
the product already exposes `contributes.services.agent` — do not add fake flags.

**Select** (`.settings-select`). Theme list, appearance, user mode. Style:
`background: var(--ui-bg-soft); border: 1px solid var(--ui-line); color: var(--ui-text);
border-radius: 6px; padding: 6px 12px; font-size: 12px; min-width: 160px;`
Focus: `border-color: var(--ui-accent); box-shadow: 0 0 0 2px var(--ui-accent-soft);`

**Text / number** (LLM host is **not** duplicated here — see §5.3 Agent). Use only for values
Settings owns.

**Slider** — not required for v1 (no editor font product). Omit rather than copy unused ViXCi
font-size sliders.

**Action button** (`.settings-action-btn`). Reset factory defaults (shell keys only). Danger
variant for reset: border/text using existing warning tokens (`--ui-warning-text`), not a new red
system unless `error-popup` already defines one.

Skin swatches (optional): a row of `.settings-skin-swatch` buttons `aria-pressed` matching
`data-skin`, in addition to or instead of the `<select>`. Do not use clickable `<div>`s.

---

## 5. Navigation, panes, and search

### 5.1 Shell panes (required)

| Pane ID | Title | Icon | Scope |
| --- | --- | --- | --- |
| `pane-appearance` | Appearance | `palette` | Skin (`data-skin` + `#skinStylesheet`) and light/dark (`data-theme`) |
| `pane-user-mode` | User mode | `tune` | Standard / Advanced / Expert (`data-user-mode`, `shell:modeChanged`) |
| `pane-layout` | Layout | `view_sidebar` | Sidebar collapsed vs expanded (`nav-collapsed`). **Not** top vs side — top layout is retired |

### 5.2 Tools panes (required / optional)

| Pane ID | Title | Icon | Scope |
| --- | --- | --- | --- |
| `pane-keyboard` | Keyboard | `keyboard` | Discoverability: embed or link `Shortcuts` help sheet (`?` / `Shortcuts.open`). Do not re-bind Ctrl+1..9; `shell.js` already owns tab shortcuts |
| `pane-agent` | AI Agent | `auto_awesome` | Canonical editor for ChatOrb Host, Model, API Path, masked API Key, Mode, Enabled state, and floating orb visibility; show storage prefix and Agent Gateway status |

### 5.3 Extensions

The Agent pane writes through `ChatOrb.setLLM()` and reads the form-safe
`ChatOrb.getLLMForm()` result. It never reads or renders the saved API key.
An untouched empty key field preserves the existing key; entering text replaces
it, and the dedicated Clear action removes it. Changes apply on blur or change,
without a second copy of the LLM configuration in Shell storage.
The floating agent orb is disabled by default so the left-sidebar Agent control
is the primary launcher. Enabling **Show floating agent orb** persists a
per-product launcher preference and displays the collapsed orb at bottom right.

When `ExtensionHost.list()` has packs, each pack with `contributes.settings` (or a
`WebtoolsExtensions[id].settingsPane` hook) gets a nav item under **Extensions**. Empty section
is omitted (no placeholder marketplace).

### 5.4 Search

On `input` of `#settingsSearchInput`:

1. Case-insensitive match on `.settings-nav-item` text; hide non-matches.
2. Hide `.settings-section-heading` while query non-empty.
3. Filter `.settings-row` in **all** panes by title + description; auto-activate the first pane
   that still has a visible row.
4. Clearing search restores headings and the last user-selected pane.

---

## 6. Appearance, theme, and user mode (this product)

### 6.1 Theme (skin) — not “community themes”

Canonical default: **`amd-gold`**. `Shell.setSkin(id)` sets `data-skin` on `html`/`body`,
rewrites `#skinStylesheet` to `../shared/css/skins/<id>.css`, persists `${PREFIX}-skin`.

| `data-skin` | Label (`SKIN_LABELS` in `js/shell.js`) |
| --- | --- |
| `amd-gold` | AMD Gold (default) |
| `amd` | AMD Red |
| `amd-teal` | AMD Teal |
| `glass-dark` | Glass Dark |
| `matte-dark` | Matte Dark |
| `minimal-monochrome` | Monochrome |
| `soft-neutral-light` | Soft Neutral |

Unknown ids → `amd-gold`. One skin per screen ([`DESIGN.md`](DESIGN.md) color policy). Accent
(`--ui-accent`) **comes from the skin file**. Do not add a separate accent color picker that
fights the skin.

### 6.2 Light / Dark appearance

`Shell.setTheme("dark" | "light")` sets `data-theme` on `html`/`body`, persists
`${PREFIX}-theme`. Default **`dark`**.

| Value | Behavior |
| --- | --- |
| `dark` | Skin dark surfaces (factory default) |
| `light` | `data-theme="light"` washes (see `base.css` / `shell.css`) |

**v1 does not persist `system`.** Optional later: a third option that listens to
`prefers-color-scheme` without storing `"system"` until implemented and tested. Do not claim
Adapt to system until that lands.

Settings **replaces** `#themeToggleSide` / `#themeToggleTop` as the primary control. A compact
moon/sun in the remaining rail is allowed only if it calls `Shell.toggleTheme` and stays in sync
with the Settings select (same `setTheme` path).

### 6.3 User mode

`Shell.setUserMode("standard" | "advanced" | "expert")` sets `body[data-user-mode]`, persists
`${PREFIX}-user-mode`, updates labels, dispatches `shell:modeChanged`.

| Mode | CSS effect (`css/shell.css` / `base.css`) |
| --- | --- |
| `standard` | Hides `.mode-advanced` and `.mode-expert` |
| `advanced` | Hides `.mode-expert` only |
| `expert` | All mode-gated chrome visible |

Optional `body[data-mode-gating="lock"]` keeps lock semantics already in `base.css`. This is
**not** RBAC.

Settings **replaces** `#modeToggleSide` and `.side-nav-mode-list`.

---

## 7. State management and events

### 7.1 Storage schema (shell)

`PREFIX = window.SHELL_PREFIX || "app"` — set **before** `Shell.init()` (e.g. `"llm-benchmark"`,
`"dc-planner"`, `"cluster-manager"`, `"im"`).

| Key | Type | Default | Writer |
| --- | --- | --- | --- |
| `${PREFIX}-skin` | string | `amd-gold` | `Shell.setSkin` |
| `${PREFIX}-theme` | string | `dark` | `Shell.setTheme` |
| `${PREFIX}-user-mode` | string | `standard` | `Shell.setUserMode` |
| `${PREFIX}-nav-collapsed` | `"0"` / `"1"` | `"0"` | `Shell.setCollapsed` |
| `${PREFIX}-nav-layout` | string | always `"side"` | `Shell.setLayout` (legacy overwrite) |

### 7.2 Storage that Settings must not own

| Key / prefix | Owner | Notes |
| --- | --- | --- |
| `{storagePrefix}:chat-orb:llm:v1` | `ChatOrb` | host, model, path, key, mode, enabled |
| `{storagePrefix}:chat-orb:v1` | `ChatOrb` | transcript |
| `{storagePrefix}:chat-orb:prompts:v1` | `ChatOrb` | prompt history |
| `{storagePrefix}:chat-orb:launcher:v1` | `ChatOrb` | floating orb visibility; defaults to `false` |
| Legacy `shared-ui:chat-orb:*` | `ChatOrb` | only when `storagePrefix` omitted |

### 7.3 Apply path

```javascript
function applyShellSetting(key, value) {
  if (!global.Shell) return;
  if (key === "skin") global.Shell.setSkin(value);
  else if (key === "theme") global.Shell.setTheme(value);
  else if (key === "user-mode") global.Shell.setUserMode(value);
  else if (key === "nav-collapsed") global.Shell.setCollapsed(value === "1" || value === true);
  document.dispatchEvent(new CustomEvent("shell:settingChanged", { detail: { key: key, value: value } }));
}
```

Reset factory defaults: `setSkin("amd-gold"); setTheme("dark"); setUserMode("standard");`
optionally `setCollapsed(false)`. Do not wipe ChatOrb keys.

---

## 8. Extension settings contract

Extensions register a pane; they do not fork modal CSS.

```javascript
// WebtoolsExtensions["im-report"].settingsPane(containerEl)
function settingsPane(containerEl) {
  containerEl.innerHTML = "";
  var row = document.createElement("div");
  row.className = "settings-row";
  row.setAttribute("data-setting-key", "im-report.example");
  // title + description + control; persist under product SHELL_PREFIX or extension id
  containerEl.appendChild(row);
}
```

Manifest extension point: `contributes.settings: true` or a `settings` object on the extension pack.
Host calls `settingsPane` when the nav item is selected. Persistence stays local; no fake cloud
sync.

---

## 9. Accessibility, responsiveness, keyboard

- Overlay: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the titlebar
  heading.
- Focus trap inside `.settings-modal`; initial focus on search or first nav item.
- Visible focus ring on every control (including titlebar buttons). Icon-only controls need
  `aria-label` (Close settings, Maximize, Minimize).
- Toggles: `role="switch"` + `aria-checked`.
- Contrast: body text vs panel ≥ 4.5:1 (skin-defined `--ui-text` / `--ui-panel`).
- **Desktop (>768px):** 220px nav + content.
- **Mobile (≤768px):** modal `100vw × 100vh` (respect `safe-area-inset-*`); category nav becomes
  a `<select>` or a one-line chip scroller so rows remain full width. Product tab sidebar still
  uses the existing hamburger drawer — Settings does not replace it.
- Suggested shortcut: `Ctrl+,` (Windows/Linux) / `⌘,` (Mac) to open Settings, listed via
  `Shortcuts.register`. `Escape` closes.

---

## 10. Product chrome migration (remove settings from the left sidebar)

| Remove from dashboards | Replacement |
| --- | --- |
| `#themeToggleSide`, `#themeToggleTop`, `#sideNavThemeBtn` as the only theme UI | Appearance pane + optional synced compact toggle |
| `#skinToggleSide`, `#sideNavSkinList`, `.hero-skin-menu` as the only skin UI | Appearance pane Theme select/swatches |
| `#modeToggleSide`, `#sideNavModeList`, `.hero-mode-option` popovers | User mode pane |
| Expand/collapse of those lists when `nav-collapsed` | Settings always has room for full labels |

**Keep:** `#collapseToggle`, Agent / chat orb button, `.sidebar-nav` tabs, brand, mobile
hamburger + `MobileDrawer`.

Skeleton / CI: when markup is updated, extend
[`templates/index.skeleton.html`](../templates/index.skeleton.html) only if the **head** changes;
sidebar HTML below `<!-- end:skeleton -->` is per-consumer but should drop the three util
expanders in each `pages/index.html`.

---

## 11. Quality checklist

- [ ] Changing Theme updates `#skinStylesheet` and `data-skin` without reload; reopen Settings
      shows the same value.
- [ ] Light/Dark updates `data-theme` on `html` and `body`; ChatOrb / demo chrome follow tokens.
- [ ] User mode updates `data-user-mode`, hides `.mode-advanced` / `.mode-expert` correctly,
      fires `shell:modeChanged`, and Ctrl+1..9 tab list still matches visible tabs.
- [ ] Persistence uses `${SHELL_PREFIX}-*` only; ChatOrb LLM keys unchanged after Reset.
- [ ] Blocked cookies: Settings still opens; failed writes do not throw (existing `try/catch`).
- [ ] Search filters nav + rows; empty query restores structure.
- [ ] Escape closes modal; focus returns to the Settings gear; focus rings visible.
- [ ] Drag/resize/maximize respect min size and viewport clamp; reduced-motion skips blur.
- [ ] Product left sidebar has **no** skin/theme/mode expanders; tabs + Agent + Collapse remain.
- [ ] `Shell.openSettings({ pane: "user-mode" })` opens the correct pane.

---

## 12. Implementation notes (when coding)

| Piece | Location |
| --- | --- |
| Apply + persist | `js/shell.js` (`setSkin`, `setTheme`, `setUserMode`, `setCollapsed`) — keep public |
| New modal | Prefer `js/settings.js` + `css/settings.css` mounted from plugin bootstrap; do not grow
  `chat-orb.js` |
| Markup | Injected once per page (like ChatOrb), not copied into every tab iframe |
| Tests | Node `vm` harness with `{ filename }` for `js/settings.js`; Playwright: open Settings,
  change skin, assert `data-skin` |

Do not implement EXC-RBAC or a flag matrix in this window.
