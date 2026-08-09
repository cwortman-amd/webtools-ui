/* ── Shortcuts ──────────────────────────────────────────────
 * A shared registry and help sheet for keyboard shortcuts.
 *
 * The three consumers each grew their own bindings — cluster-manager
 * wires Ctrl+1..7, the others less — and none of them advertised what
 * they support, so the only way to discover a shortcut was to hover a
 * tab and read the tooltip. This gives every app one "?" surface
 * listing whatever it registered.
 *
 * Consumers register their real bindings; this module does not bind
 * them on their behalf, so an app that already handles a key keeps
 * ownership of it and nothing is double-bound.
 */
(function (global) {
  "use strict";

  var ORDER = [];          // group names, in registration order
  var GROUPS = {};         // group -> [{ keys: [..], label }]
  var PROVIDERS = {};      // group -> fn returning [{ keys, label }]
  var openState = null;    // { backdrop, returnFocus }

  var IS_MAC = /Mac|iPhone|iPad/.test(global.navigator ? global.navigator.platform : "");

  /* "Ctrl+1" -> ["Ctrl", "1"], with the platform's modifier glyphs. */
  function parseKeys(spec) {
    return String(spec).split("+").map(function (part) {
      var k = part.trim();
      if (!IS_MAC) return k;
      if (/^ctrl$/i.test(k)) return "\u2318";      // ⌘ — Mac users expect Cmd
      if (/^alt$/i.test(k)) return "\u2325";       // ⌥
      if (/^shift$/i.test(k)) return "\u21E7";     // ⇧
      return k;
    });
  }

  function register(group, keys, label) {
    if (!group || !keys || !label) return;
    if (!GROUPS[group]) { GROUPS[group] = []; ORDER.push(group); }
    // Re-registering the same binding (e.g. a tab list rebuilt after a
    // user-mode change) should replace rather than duplicate it.
    var existing = GROUPS[group].filter(function (r) { return r.spec === keys; })[0];
    if (existing) { existing.label = label; return; }
    GROUPS[group].push({ spec: keys, keys: parseKeys(keys), label: label });
  }

  function clearGroup(group) {
    if (GROUPS[group]) GROUPS[group] = [];
  }

  /* For groups whose contents change at runtime — a tab list that depends
   * on user mode, say. Resolved when the sheet opens, so callers never
   * have to re-publish. */
  function registerProvider(group, fn) {
    if (!group || typeof fn !== "function") return;
    if (!GROUPS[group]) { GROUPS[group] = []; ORDER.push(group); }
    PROVIDERS[group] = fn;
  }

  function rowsFor(group) {
    if (PROVIDERS[group]) {
      var out = [];
      try { out = PROVIDERS[group]() || []; } catch (_) { out = []; }
      return out.map(function (r) {
        return { spec: r.keys, keys: parseKeys(r.keys), label: r.label };
      });
    }
    return GROUPS[group] || [];
  }

  function buildSheet() {
    var backdrop = document.createElement("div");
    backdrop.className = "ks-backdrop";

    var sheet = document.createElement("div");
    sheet.className = "ks-sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-labelledby", "ks-title");
    sheet.tabIndex = -1;

    var head = document.createElement("div");
    head.className = "ks-head";
    var title = document.createElement("h2");
    title.className = "ks-title";
    title.id = "ks-title";
    title.textContent = "Keyboard shortcuts";
    var close = document.createElement("button");
    close.type = "button";
    close.className = "ks-close";
    close.setAttribute("aria-label", "Close keyboard shortcuts");
    close.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true" style="font-size:18px">close</span>';
    close.addEventListener("click", hide);
    head.appendChild(title);
    head.appendChild(close);

    var body = document.createElement("div");
    body.className = "ks-body";

    var any = false;
    ORDER.forEach(function (group) {
      var rows = rowsFor(group);
      if (!rows.length) return;
      any = true;
      var h = document.createElement("div");
      h.className = "ks-group-name";
      h.textContent = group;
      body.appendChild(h);
      rows.forEach(function (r) {
        var row = document.createElement("div");
        row.className = "ks-row";
        var label = document.createElement("span");
        label.className = "ks-label";
        label.textContent = r.label;
        var keys = document.createElement("span");
        keys.className = "ks-keys";
        r.keys.forEach(function (k) {
          var kbd = document.createElement("kbd");
          kbd.textContent = k;
          keys.appendChild(kbd);
        });
        row.appendChild(label);
        row.appendChild(keys);
        body.appendChild(row);
      });
    });

    if (!any) {
      var empty = document.createElement("p");
      empty.className = "ks-empty";
      empty.textContent = "This view has no keyboard shortcuts yet.";
      body.appendChild(empty);
    }

    sheet.appendChild(head);
    sheet.appendChild(body);
    backdrop.appendChild(sheet);

    backdrop.addEventListener("click", function (ev) {
      if (ev.target === backdrop) hide();
    });
    backdrop.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.preventDefault(); hide(); return; }
      if (ev.key !== "Tab") return;
      var f = sheet.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });

    return { backdrop: backdrop, sheet: sheet, close: close };
  }

  function show() {
    if (openState) return;
    var built = buildSheet();
    openState = { backdrop: built.backdrop, returnFocus: document.activeElement };
    document.body.appendChild(built.backdrop);
    built.close.focus();
  }

  function hide() {
    if (!openState) return;
    var ret = openState.returnFocus;
    if (openState.backdrop.parentNode) openState.backdrop.parentNode.removeChild(openState.backdrop);
    openState = null;
    if (ret && typeof ret.focus === "function") ret.focus();
  }

  function toggle() { openState ? hide() : show(); }

  function isTypingTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    return /^(input|textarea|select)$/i.test(el.tagName);
  }

  function init() {
    // "?" is Shift+/ on most layouts; match the produced character so
    // alternative layouts still work.
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== "?") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      toggle();
    });
    register("General", "?", "Show this shortcut list");
  }

  global.Shortcuts = {
    register: register,
    registerProvider: registerProvider,
    clearGroup: clearGroup,
    open: show,
    close: hide,
    toggle: toggle,
    init: init
  };

  // Self-initialising: every consumer wants the "?" binding, and none of
  // them should have to remember to call this.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(window);
