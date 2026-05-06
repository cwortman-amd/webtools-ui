/**
 * webtools-ui canonical asset: js/demo-picker.js
 *
 * Cross-repo audience-picker modal for Demo Mode (Phase 9.8e P5,
 * 2026-05-05). Renders the same "pick your audience" UX in every
 * sibling consumer so a user who has seen Demo Mode in one dashboard
 * recognizes it instantly in the others — and so the catalog defined
 * in `js/demo-audiences.js` actually drives a real picker everywhere.
 *
 * Public API (UMD-ish; attaches to `window.DemoPicker`):
 *
 *   DemoPicker.open({
 *     audiences   : Array<{ id, name, time?, desc?, tag? }>,  // optional
 *     title       : "Pick your audience",                     // optional
 *     subtitle    : "…short hint about how to pause/exit…",   // optional
 *     cancelLabel : "Cancel",                                 // optional
 *     onSelect    : function (audienceId) { ... },            // required for actionable use
 *     onCancel    : function () { ... }                       // optional
 *   });
 *
 *   DemoPicker.close();   // imperatively close any open picker
 *   DemoPicker.isOpen();  // → boolean
 *
 * Behavior:
 *   - First call lazily mounts a single backdrop+modal under <body>;
 *     subsequent calls reuse it.
 *   - Closes on backdrop click, Esc, the cancel button, or after a
 *     selection is made (close fires BEFORE onSelect runs so the
 *     consumer can reveal new chrome without the picker on top).
 *   - If `audiences` is omitted, falls back to `window.DemoAudiences`
 *     (the canonical catalog from js/demo-audiences.js); if THAT is
 *     also unavailable, ships a hard-coded 3-tier fallback so the
 *     picker degrades gracefully.
 *   - Disabled options (`tag` set) render with the tag pill and are
 *     non-clickable.
 *
 * CSS contract: `webtools-ui/css/demo-mode.css` ships the canonical
 * `.demo-picker*` rules. Each consumer must already load demo-mode.css
 * (most do, since the demo player chrome lives in the same sheet).
 *
 * Adoption matrix lives in webtools-ui/docs/DEMO.md §3 (Phase 9.8e P5).
 */
(function (global) {
  "use strict";

  /* Single-instance state. The modal is created on first open() and
   * reused; we never tear down the DOM, just toggle .is-open and rebuild
   * the body via innerHTML on each open() so audience changes (or per-
   * call title/subtitle overrides) apply cleanly. */
  var INSTANCE = null;

  /* Hard-coded fallback so the picker degrades gracefully when neither
   * window.DemoAudiences nor an explicit `audiences` arg is present.
   * Kept in sync with webtools-ui/js/demo-audiences.js by content
   * (not by tooling) — if you change one, update the other. */
  var FALLBACK_AUDIENCES = [
    {
      id: "onboarding",
      name: "Standard Onboarding",
      time: "~5 min",
      desc: "Standard-view walkthrough. Why each section exists, the typical day-one workflow, and a closing preview of the user-mode picker so first-time users know where to go next."
    },
    {
      id: "advanced",
      name: "Advanced Usage",
      time: "~10 min",
      desc: "Advanced-mode workflow tour. Power-user features, multi-step comparisons and side-by-side analysis, providing a deeper level of understanding."
    },
    {
      id: "expert",
      name: "Expert Training",
      time: "~15 min",
      desc: "Full engineering training. End-to-end deep-dive: trade-off reasoning, root-cause workflows, advanced configuration, and the expert-only deliverables."
    }
  ];

  function resolveAudiences(override) {
    if (Array.isArray(override) && override.length) {
      return override.slice();
    }
    if (Array.isArray(global.DemoAudiences) && global.DemoAudiences.length) {
      return global.DemoAudiences.slice();
    }
    return FALLBACK_AUDIENCES.slice();
  }

  function ensureMounted() {
    if (INSTANCE && INSTANCE.backdrop && document.body.contains(INSTANCE.backdrop)) {
      return INSTANCE;
    }
    var backdrop = document.createElement("div");
    backdrop.className = "demo-picker-backdrop";
    backdrop.setAttribute("aria-hidden", "true");

    var modal = document.createElement("div");
    modal.className = "demo-picker";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "demoPickerTitle");

    backdrop.appendChild(modal);

    /* Prefer body > html so the modal participates in the shell's
     * stacking context (z-index 110 in CSS). */
    var host = document.body || document.documentElement;
    host.appendChild(backdrop);

    INSTANCE = {
      backdrop: backdrop,
      modal: modal,
      onSelect: null,
      onCancel: null,
      keyHandler: null,
      backdropHandler: null,
      previousFocus: null
    };
    return INSTANCE;
  }

  function detachListeners(inst) {
    if (inst.keyHandler) {
      document.removeEventListener("keydown", inst.keyHandler, true);
      inst.keyHandler = null;
    }
    if (inst.backdropHandler) {
      inst.backdrop.removeEventListener("click", inst.backdropHandler);
      inst.backdropHandler = null;
    }
  }

  function close() {
    if (!INSTANCE) return;
    var inst = INSTANCE;

    inst.backdrop.classList.remove("is-open");
    inst.backdrop.setAttribute("aria-hidden", "true");

    detachListeners(inst);

    var cb = inst.onCancel;
    inst.onSelect = null;
    inst.onCancel = null;

    /* Restore prior focus for keyboard users. */
    if (inst.previousFocus && typeof inst.previousFocus.focus === "function") {
      try { inst.previousFocus.focus(); } catch (_) { /* element may be gone */ }
    }
    inst.previousFocus = null;

    if (typeof cb === "function") {
      try { cb(); } catch (e) {
        if (global.console && console.warn) console.warn("[DemoPicker] onCancel threw:", e);
      }
    }
  }

  function buildOptionButton(audience) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "demo-picker-option";
    btn.setAttribute("data-audience", audience.id);
    if (audience.tag) {
      btn.disabled = true;
      btn.title = String(audience.tag);
    }

    var row = document.createElement("div");
    row.className = "demo-picker-option-row";

    var nameEl = document.createElement("span");
    nameEl.className = "demo-picker-option-name";
    nameEl.textContent = audience.name || audience.id;
    if (audience.tag) {
      var tag = document.createElement("span");
      tag.className = "demo-picker-option-tag";
      tag.textContent = String(audience.tag);
      nameEl.appendChild(document.createTextNode(" "));
      nameEl.appendChild(tag);
    }
    row.appendChild(nameEl);

    var time = document.createElement("span");
    time.className = "demo-picker-option-time";
    time.textContent = audience.time || "";
    row.appendChild(time);

    btn.appendChild(row);

    var desc = document.createElement("p");
    desc.className = "demo-picker-option-desc";
    desc.textContent = audience.desc || "";
    btn.appendChild(desc);

    return btn;
  }

  function open(opts) {
    opts = opts || {};
    var inst = ensureMounted();

    /* If a previous open() is still wired up, tear down its listeners
     * first so we don't double-fire on the new open. */
    detachListeners(inst);

    inst.onSelect = typeof opts.onSelect === "function" ? opts.onSelect : null;
    inst.onCancel = typeof opts.onCancel === "function" ? opts.onCancel : null;
    inst.previousFocus = (document.activeElement && typeof document.activeElement.focus === "function")
      ? document.activeElement
      : null;

    var audiences = resolveAudiences(opts.audiences);
    var title = opts.title || "Select your demo track";
    var subtitle = opts.subtitle || "Choose onboarding, advanced usage, or expert training.";
    var cancelLabel = opts.cancelLabel || "Cancel";

    /* Build modal contents from scratch each time so per-call overrides
     * (custom title, custom audience subset, etc.) apply cleanly. */
    var modal = inst.modal;
    while (modal.firstChild) modal.removeChild(modal.firstChild);

    var eyebrow = document.createElement("div");
    eyebrow.className = "demo-picker-eyebrow";
    eyebrow.textContent = "Demo Mode";
    modal.appendChild(eyebrow);

    var titleEl = document.createElement("h2");
    titleEl.className = "demo-picker-title";
    titleEl.id = "demoPickerTitle";
    titleEl.textContent = title;
    modal.appendChild(titleEl);

    var subEl = document.createElement("p");
    subEl.className = "demo-picker-sub";
    subEl.textContent = subtitle;
    modal.appendChild(subEl);

    var listEl = document.createElement("div");
    listEl.className = "demo-picker-list";
    modal.appendChild(listEl);

    audiences.forEach(function (aud) {
      if (!aud || !aud.id) return;
      var btn = buildOptionButton(aud);
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        var id = btn.getAttribute("data-audience");
        var sel = inst.onSelect;
        /* Close BEFORE the consumer's onSelect fires so any UI it
         * reveals (a tutor bar, a side-banner, etc.) isn't covered
         * by the dimmed backdrop. */
        inst.onSelect = null;
        inst.onCancel = null;
        close();
        if (typeof sel === "function") {
          try { sel(id); } catch (e) {
            if (global.console && console.warn) console.warn("[DemoPicker] onSelect threw:", e);
          }
        }
      });
      listEl.appendChild(btn);
    });

    var actions = document.createElement("div");
    actions.className = "demo-picker-actions";
    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "demo-picker-btn-cancel";
    cancelBtn.textContent = cancelLabel;
    cancelBtn.addEventListener("click", function () { close(); });
    actions.appendChild(cancelBtn);
    modal.appendChild(actions);

    /* Wire backdrop + Esc only AFTER the DOM is populated so we don't
     * race with click events from the previous open() that might still
     * be in flight in the macrotask queue. */
    inst.backdropHandler = function (e) {
      if (e.target === inst.backdrop) close();
    };
    inst.backdrop.addEventListener("click", inst.backdropHandler);

    inst.keyHandler = function (e) {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", inst.keyHandler, true);

    inst.backdrop.classList.add("is-open");
    inst.backdrop.setAttribute("aria-hidden", "false");

    /* Focus the first non-disabled option for keyboard users. The
     * focus call is deferred a frame so the open transition has a
     * chance to start (otherwise some browsers cancel the transition
     * when focus changes mid-paint). */
    requestAnimationFrame(function () {
      var firstOption = modal.querySelector(".demo-picker-option:not([disabled])");
      var focusTarget = firstOption || cancelBtn;
      try { focusTarget.focus(); } catch (_) { /* shrug */ }
    });
  }

  function isOpen() {
    return !!(INSTANCE && INSTANCE.backdrop && INSTANCE.backdrop.classList.contains("is-open"));
  }

  global.DemoPicker = {
    open: open,
    close: close,
    isOpen: isOpen
  };
})(typeof window !== "undefined" ? window : this);
