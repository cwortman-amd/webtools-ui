/*!
 * webtools-ui/js/chat-orb.js
 *
 * Canonical agent orb + panel + slash-command router for all three sibling
 * consumer dashboards (`llm-benchmark`, `dc-planner`, `cluster-manager`).
 *
 * Extracted (and substantially cleaned up) from `dc-planner/js/chat-feedback.js`'s
 * orb chrome per the harmonization plan (`webtools-ui/docs/PLAN.md` Phase 2). The
 * dc-planner monolith mixes orb chrome with 12+ domain-specific intents
 * (`/explain`, `/solve dc_tco`, `/skills`, `/journal`, etc.); this module ships
 * ONLY the generic, reusable pieces every consumer needs:
 *
 *   - Animated orb button (mounted bottom-right, tap to open).
 *   - Chat panel with header, message log, single-line input, send button.
 *   - LLM settings card (host/model/path/key/mode/enabled, persisted in localStorage).
 *   - Slash-command router with built-in `/help`, `/clear`, `/llm`.
 *   - Pluggable handler registry: `ChatOrb.register("/foo", fn)`.
 *
 * Domain intents (`/pitch`, `/demo`, `/solve`, `/skills`, …) are NOT shipped here.
 * Each consumer registers its own slash handlers in a thin per-repo file.
 *
 * USAGE:
 *
 *   <link rel="stylesheet" href="../shared/css/chat-orb.css">
 *   <script src="../shared/js/chat-orb.js"></script>
 *   <script>
 *     ChatOrb.mount({
 *       title:       "LLM Benchmark Copilot",
 *       initials:    "LB",
 *       greeting:    "Ask me about a sweep, or type /help to see commands.",
 *       placeholder: "Ask, navigate, or /command…"
 *     });
 *
 *     ChatOrb.register("/pitch", function () {
 *       window.open("pitch.html", "_self");
 *       return { reply: "Opening the pitch deck…" };
 *     });
 *   </script>
 *
 * THEMING: Override `--ai-accent` on `:root` (or `body`) before this script
 * loads to brand the orb. Defaults to a neutral blue (#4f8ef7).
 */

(function (global) {
  "use strict";

  // ── Module state ─────────────────────────────────────────────────
  // NOTE: the `shared-ui:` namespace on these localStorage keys predates
  // the 2026-05-04 directory rename to `webtools-ui` (Phase 9.8c). They
  // are intentionally NOT renamed — these keys carry per-user orb history
  // and LLM settings across all 3 sibling consumers, and a rename would
  // silently lose that state for every existing user with no migration
  // path. New keys added after this date should use the `webtools-ui:`
  // prefix; legacy keys keep their original namespace.
  var STORAGE_KEY = "shared-ui:chat-orb:v1";
  var LLM_KEY     = "shared-ui:chat-orb:llm:v1";
  var DEFAULTS = {
    title:       "AI Assistant",
    subtitle:    "Online · ready to act",
    initials:    "AI",
    greeting:    "Hi! Type a question, or `/help` to see what I can do.",
    placeholder: "Ask me anything, or /command…",
    tooltip:     "Open AI chat",
    onHelpExtra: null,    // optional fn returning string to append to /help output
    // Optional extra header action: when truthy, a play_circle "Demo" button
    // is rendered to the LEFT of the gear (LLM settings) icon in the panel
    // header.
    //
    // Default behavior (recommended): clicking the button toggles an in-orb
    // slide-down audience picker (`.ai-demo-card`) — same UX shape as the
    // gear opens the LLM settings card. When the user picks an audience the
    // orb fires `onDemoSelect(audienceId)` if defined, else falls back to
    // `SlashRouter.run('/demo ' + id)` (every consumer registers a `/demo`
    // handler that knows how to start its own runtime).
    //
    // Legacy escape hatch: if `onDemoClick` is set, it fully overrides the
    // default and the in-orb card is never shown — the consumer is in
    // charge of opening whatever picker/modal it wants.
    showDemoBtn: false,
    onDemoClick: null,
    onDemoSelect: null,
    // Optional feedback button: when truthy, a `feedback` icon button is
    // rendered to the LEFT of the Demo button (or gear if demo is off) and
    // typing `/feedback` in the chat input opens the same composer. The
    // built-in composer is a single-screen, 2-field form (description +
    // optional email) that constructs a GitHub issue deeplink and opens
    // it in a new tab with the title/body prefilled. Consumers opt in by
    // setting `showFeedbackBtn: true` AND `githubRepo: "<owner>/<repo>"`;
    // `onFeedbackClick` lets a consumer override the built-in composer
    // with its own flow (dc-planner-style multi-step, a ticketing API, etc).
    showFeedbackBtn: false,
    onFeedbackClick: null,
    githubRepo:      ""
  };
  var LLM_DEFAULTS = {
    host:    "",
    model:   "",
    path:    "/v1/chat/completions",
    key:     "",
    mode:    "fallback",
    enabled: false
  };

  var state = {
    mounted:  false,
    open:     false,
    cfg:      Object.assign({}, DEFAULTS),
    llm:      loadLLM(),
    handlers: Object.create(null),
    history:  []
  };

  var ui = { orb: null, panel: null, msgs: null, input: null, send: null,
             close: null, llmBtn: null, llmCard: null, demoBtn: null,
             demoCard: null, feedbackBtn: null, feedbackCard: null };

  function resolveVoiceModeLabel() {
    try {
      if (!global.voiceBridge || typeof global.voiceBridge.getTTSConfig !== "function") return "local";
      var cfg = global.voiceBridge.getTTSConfig() || {};
      var m = String(cfg.mode || "local").toLowerCase();
      return m === "local" ? "local" : "cloud";
    } catch (_) {
      return "local";
    }
  }
  function statusSubtitleText() {
    return "Online  · " + resolveVoiceModeLabel();
  }
  function refreshStatusSubtitle() {
    var el = document.getElementById("chatStatusSubtitle");
    if (el) el.textContent = statusSubtitleText();
  }

  // ── Persistence helpers ──────────────────────────────────────────
  function loadLLM() {
    try {
      var raw = localStorage.getItem(LLM_KEY);
      if (!raw) return Object.assign({}, LLM_DEFAULTS);
      var parsed = JSON.parse(raw);
      return Object.assign({}, LLM_DEFAULTS, parsed);
    } catch (e) { return Object.assign({}, LLM_DEFAULTS); }
  }

  function saveLLM() {
    try { localStorage.setItem(LLM_KEY, JSON.stringify(state.llm)); } catch (e) {}
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).history || [] : [];
    } catch (e) { return []; }
  }

  function saveHistory() {
    try {
      // Cap stored history at 50 messages so localStorage doesn't bloat.
      var trimmed = state.history.slice(-50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ history: trimmed }));
    } catch (e) {}
  }

  // ── DOM construction ─────────────────────────────────────────────
  function buildOrb() {
    var orb = document.createElement("button");
    orb.type = "button";
    orb.className = "ai-orb";
    orb.id = "chatOrb";
    orb.setAttribute("aria-label", state.cfg.tooltip);
    orb.setAttribute("aria-haspopup", "dialog");
    orb.setAttribute("aria-expanded", "false");
    orb.innerHTML = [
      '<span class="ai-orb-pulse" aria-hidden="true"></span>',
      '<span class="ai-orb-core" aria-hidden="true">',
      '  <span class="material-symbols-outlined ai-orb-glyph is-chat">auto_awesome</span>',
      '  <span class="material-symbols-outlined ai-orb-glyph is-close">close</span>',
      '  <span class="ai-orb-typing" aria-hidden="true"><span></span><span></span><span></span></span>',
      "</span>",
      '<span class="ai-orb-status" aria-hidden="true"></span>',
      '<span class="ai-orb-badge" aria-hidden="true">!</span>'
    ].join("");
    return orb;
  }

  function buildPanel() {
    var panel = document.createElement("section");
    panel.className = "ai-panel";
    panel.id = "chatPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", state.cfg.title);
    panel.innerHTML = [
      '<div class="ai-hdr">',
      '  <div class="ai-hdr-main">',
      '    <span class="ai-hdr-mark" aria-hidden="true">' + escapeHtml(state.cfg.initials) + "</span>",
      '    <span class="ai-hdr-text">',
      '      <span class="ai-hdr-title">' + escapeHtml(state.cfg.title) + "</span>",
      '      <span class="ai-hdr-sub"><span class="ai-online-dot" aria-hidden="true"></span><span id="chatStatusSubtitle">' + escapeHtml(statusSubtitleText()) + "</span></span>",
      "    </span>",
      "  </div>",
      '  <div class="ai-hdr-actions">',
      (state.cfg.showFeedbackBtn
        ? '    <button type="button" class="ai-btn-icon" id="chatFeedbackBtn" title="Send feedback — file a GitHub issue" aria-label="Send feedback"><span class="material-symbols-outlined">feedback</span></button>'
        : ""),
      (state.cfg.showDemoBtn
        ? '    <button type="button" class="ai-btn-icon" id="chatDemoBtn" title="Demo Mode — guided walkthrough" aria-label="Start demo mode"><span class="material-symbols-outlined">play_circle</span></button>'
        : ""),
      '    <button type="button" class="ai-btn-icon" id="chatLlmBtn" title="LLM settings" aria-label="LLM settings"><span class="material-symbols-outlined">settings</span></button>',
      '    <button type="button" class="ai-btn-icon" id="chatClose" title="Close" aria-label="Close chat"><span class="material-symbols-outlined">close</span></button>',
      "  </div>",
      "</div>",
      '<div class="ai-feedback-card" id="chatFeedbackCard" role="region" aria-label="Send feedback">',
      '  <div class="ai-feedback-hdr">Send feedback</div>',
      '  <label class="ai-feedback-field" for="chatFeedbackText">Describe your feedback or issue</label>',
      '  <textarea id="chatFeedbackText" rows="5" placeholder="Be specific. What did you try? What did you expect? What happened instead?" maxlength="4000"></textarea>',
      '  <label class="ai-feedback-field" for="chatFeedbackEmail">Email (optional)</label>',
      '  <input type="email" id="chatFeedbackEmail" placeholder="you@example.com" autocomplete="email" />',
      '  <div class="ai-feedback-hint">To associate the issue and receive an email when resolved, please include your email.</div>',
      '  <div class="ai-feedback-status" id="chatFeedbackStatus"></div>',
      '  <div class="ai-feedback-actions">',
      '    <button type="button" id="chatFeedbackCancel">Cancel</button>',
      '    <button type="button" class="primary" id="chatFeedbackSubmit">Open GitHub draft</button>',
      "  </div>",
      "</div>",
      (state.cfg.showDemoBtn
        ? '<div class="ai-demo-card" id="chatDemoCard" role="region" aria-label="Demo Mode audience picker">'
          + '  <div class="ai-demo-hdr">Demo Mode</div>'
          + '  <div class="ai-demo-sub">Pick an audience to start the walkthrough.</div>'
          + '  <div class="ai-demo-list" id="chatDemoList"></div>'
          + '  <div class="ai-demo-actions">'
          + '    <button type="button" id="chatDemoCancel">Cancel</button>'
          + '  </div>'
          + '</div>'
        : ""),
      '<div class="ai-llm-card" id="chatLlmCard" role="region" aria-label="LLM agent settings">',
      '  <div class="ai-llm-row"><label for="chatLlmHost">Host</label><input type="text" id="chatLlmHost" placeholder="10.0.0.5:11434" autocomplete="off" /></div>',
      '  <div class="ai-llm-row"><label for="chatLlmModel">Model</label><input type="text" id="chatLlmModel" placeholder="llama3.1:8b-instruct" autocomplete="off" /></div>',
      '  <div class="ai-llm-row"><label for="chatLlmPath">API path</label><input type="text" id="chatLlmPath" placeholder="/v1/chat/completions" autocomplete="off" /></div>',
      '  <div class="ai-llm-row"><label for="chatLlmKey">API key</label><input type="password" id="chatLlmKey" placeholder="optional bearer token" autocomplete="off" /></div>',
      '  <div class="ai-llm-row"><label for="chatLlmMode">Mode</label><select id="chatLlmMode"><option value="fallback">Fallback (regex first)</option><option value="primary">Primary (LLM first)</option></select></div>',
      '  <div class="ai-llm-row"><label></label><label class="ai-llm-toggle"><input type="checkbox" id="chatLlmEnabled" /> Enable LLM agent</label></div>',
      '  <div class="ai-llm-status" id="chatLlmStatus"></div>',
      '  <div class="ai-llm-actions">',
      '    <button type="button" id="chatLlmReset">Defaults</button>',
      '    <button type="button" id="chatLlmCancel">Cancel</button>',
      '    <button type="button" class="primary" id="chatLlmSave">Save</button>',
      "  </div>",
      "</div>",
      '<div class="ai-msgs" id="chatMsgs" role="log" aria-live="polite"></div>',
      '<div class="ai-input-row">',
      '  <div class="ai-input-wrap">',
      '    <textarea id="chatInput" class="ai-input" rows="1" placeholder="' + escapeAttr(state.cfg.placeholder) + '" maxlength="600"></textarea>',
      "  </div>",
      '  <button type="button" id="chatSend" class="ai-send" aria-label="Send message"><span class="material-symbols-outlined">arrow_upward</span></button>',
      "</div>"
    ].join("");
    return panel;
  }

  // ── Event wiring ─────────────────────────────────────────────────
  function wireEvents() {
    ui.orb.addEventListener("click", toggle);
    ui.close.addEventListener("click", function () { setOpen(false); });
    ui.llmBtn.addEventListener("click", toggleLlmCard);

    // Demo-launch button (showDemoBtn config flag). Default behavior is to
    // toggle the in-orb `.ai-demo-card` slide-down picker (parallel to how
    // the gear opens `.ai-llm-card`). The legacy `onDemoClick` config takes
    // precedence when set and fully overrides the in-orb path.
    if (ui.demoBtn) {
      ui.demoBtn.addEventListener("click", function () {
        if (typeof state.cfg.onDemoClick === "function") {
          try { state.cfg.onDemoClick(); } catch (e) { console.warn("[chat-orb] onDemoClick threw:", e); }
          return;
        }
        toggleDemoCard();
      });
    }
    if (ui.demoCard) {
      var cancelBtn = document.getElementById("chatDemoCancel");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", function () {
          ui.demoCard.classList.remove("show");
        });
      }
    }

    // Optional feedback button (showFeedbackBtn config flag). Prefers the
    // consumer-supplied onFeedbackClick callback; falls back to the
    // built-in single-screen feedback composer (slide-down card with a
    // textarea + optional email, then opens a prefilled GitHub issue).
    if (ui.feedbackBtn) {
      ui.feedbackBtn.addEventListener("click", function () {
        if (typeof state.cfg.onFeedbackClick === "function") {
          try { state.cfg.onFeedbackClick(); } catch (e) { console.warn("[chat-orb] onFeedbackClick threw:", e); }
          return;
        }
        toggleFeedbackCard();
      });
    }
    if (ui.feedbackCard) {
      document.getElementById("chatFeedbackCancel").addEventListener("click", function () {
        ui.feedbackCard.classList.remove("show");
        setFeedbackStatus("");
      });
      document.getElementById("chatFeedbackSubmit").addEventListener("click", submitFeedback);
    }

    ui.send.addEventListener("click", submitInput);
    ui.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitInput();
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.open) { setOpen(false); }
    });

    // LLM card buttons
    document.getElementById("chatLlmReset").addEventListener("click", function () {
      state.llm = Object.assign({}, LLM_DEFAULTS);
      saveLLM();
      hydrateLlmInputs();
      setLlmStatus("Defaults restored.");
    });
    document.getElementById("chatLlmCancel").addEventListener("click", function () {
      hydrateLlmInputs();
      ui.llmCard.classList.remove("show");
    });
    document.getElementById("chatLlmSave").addEventListener("click", function () {
      state.llm.host    = (document.getElementById("chatLlmHost").value || "").trim();
      state.llm.model   = (document.getElementById("chatLlmModel").value || "").trim();
      state.llm.path    = (document.getElementById("chatLlmPath").value || LLM_DEFAULTS.path).trim();
      state.llm.key     = (document.getElementById("chatLlmKey").value || "").trim();
      state.llm.mode    = document.getElementById("chatLlmMode").value;
      state.llm.enabled = document.getElementById("chatLlmEnabled").checked;
      saveLLM();
      setLlmStatus("Saved.");
      ui.llmCard.classList.remove("show");
    });
  }

  // ── Public-facing UI methods ─────────────────────────────────────
  function setOpen(open) {
    state.open = !!open;
    ui.orb.classList.toggle("is-open", state.open);
    ui.orb.setAttribute("aria-expanded", state.open ? "true" : "false");
    ui.panel.classList.toggle("open", state.open);
    if (state.open) {
      // Render any backlog history if first open.
      if (state.history.length === 0) {
        printSystem(state.cfg.greeting);
      }
      setTimeout(function () { ui.input.focus(); }, 80);
    } else {
      ui.llmCard.classList.remove("show");
      if (ui.feedbackCard) ui.feedbackCard.classList.remove("show");
      if (ui.demoCard) ui.demoCard.classList.remove("show");
    }
  }

  function toggle() { setOpen(!state.open); }

  function toggleLlmCard() {
    var showing = ui.llmCard.classList.toggle("show");
    if (showing) {
      if (ui.feedbackCard) ui.feedbackCard.classList.remove("show");
      if (ui.demoCard) ui.demoCard.classList.remove("show");
      hydrateLlmInputs();
      setLlmStatus("");
    }
  }

  // ── Feedback composer ────────────────────────────────────────────
  // Single-screen alternative to dc-planner's 6-step intake. Collects
  // a description (required) + an optional email, constructs a
  // prefilled GitHub issue URL, and opens it in a new tab. The user
  // reviews and clicks "Submit new issue" in GitHub to actually file.
  function toggleFeedbackCard() {
    if (!ui.feedbackCard) return;
    if (!state.open) setOpen(true);
    if (ui.llmCard) ui.llmCard.classList.remove("show");
    if (ui.demoCard) ui.demoCard.classList.remove("show");
    var showing = ui.feedbackCard.classList.toggle("show");
    if (showing) {
      setFeedbackStatus("");
      setTimeout(function () {
        var ta = document.getElementById("chatFeedbackText");
        if (ta) ta.focus();
      }, 100);
    }
  }

  // ── Demo audience picker (in-orb) ────────────────────────────────
  // Slide-down card that lets the user pick an audience track without
  // opening a separate page-level modal. Audience catalog comes from
  // window.DemoAudiences (canonical webtools-ui/js/demo-audiences.js)
  // when present, with a static fallback so the card renders even if
  // the catalog hasn't loaded yet.
  function resolveDemoAudiences() {
    if (typeof global.getDemoAudiences === "function") {
      try {
        var live = global.getDemoAudiences();
        if (Array.isArray(live) && live.length) return live;
      } catch (_) {}
    }
    if (Array.isArray(global.DemoAudiences) && global.DemoAudiences.length) {
      return global.DemoAudiences.slice();
    }
    return [
      { id: "onboarding", name: "Standard Onboarding", time: "~5 min",  desc: "Standard-view walkthrough of each section's purpose and day-one usage." },
      { id: "advanced",   name: "Advanced Usage",      time: "~10 min", desc: "Power-user tour of advanced features and options for deeper understanding." },
      { id: "expert",     name: "Expert Training",     time: "~15 min", desc: "Technical deep-dive into advanced configuration options for expert analysis." }
    ];
  }

  function hydrateDemoCard() {
    if (!ui.demoCard) return;
    var listEl = document.getElementById("chatDemoList");
    if (!listEl) return;
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    resolveDemoAudiences().forEach(function (aud) {
      if (!aud || !aud.id) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ai-demo-option";
      btn.setAttribute("data-audience", aud.id);
      if (aud.tag) {
        btn.disabled = true;
        btn.title = String(aud.tag);
      }

      var head = document.createElement("div");
      head.className = "ai-demo-option-row";
      var nameEl = document.createElement("span");
      nameEl.className = "ai-demo-option-name";
      nameEl.textContent = aud.name || aud.id;
      head.appendChild(nameEl);
      if (aud.time) {
        var t = document.createElement("span");
        t.className = "ai-demo-option-time";
        t.textContent = aud.time;
        head.appendChild(t);
      }
      btn.appendChild(head);

      if (aud.desc) {
        var d = document.createElement("p");
        d.className = "ai-demo-option-desc";
        d.textContent = aud.desc;
        btn.appendChild(d);
      }

      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        var id = btn.getAttribute("data-audience");
        ui.demoCard.classList.remove("show");
        handleDemoSelect(id);
      });
      listEl.appendChild(btn);
    });
  }

  function toggleDemoCard() {
    if (!ui.demoCard) return;
    if (!state.open) setOpen(true);
    if (ui.llmCard) ui.llmCard.classList.remove("show");
    if (ui.feedbackCard) ui.feedbackCard.classList.remove("show");
    var showing = ui.demoCard.classList.toggle("show");
    if (showing) hydrateDemoCard();
  }

  function openDemoCard() {
    if (!ui.demoCard) return;
    if (!state.open) setOpen(true);
    if (ui.llmCard) ui.llmCard.classList.remove("show");
    if (ui.feedbackCard) ui.feedbackCard.classList.remove("show");
    ui.demoCard.classList.add("show");
    hydrateDemoCard();
  }

  function handleDemoSelect(audienceId) {
    if (!audienceId) return;
    if (typeof state.cfg.onDemoSelect === "function") {
      try { state.cfg.onDemoSelect(audienceId); }
      catch (e) { console.warn("[chat-orb] onDemoSelect threw:", e); }
      return;
    }
    if (global.SlashRouter && typeof global.SlashRouter.run === "function") {
      global.SlashRouter.run("/demo " + audienceId);
    }
  }

  function setFeedbackStatus(text, kind) {
    var el = document.getElementById("chatFeedbackStatus");
    if (!el) return;
    el.textContent = text || "";
    el.className = "ai-feedback-status" + (kind ? " is-" + kind : "");
  }

  function submitFeedback() {
    var ta = document.getElementById("chatFeedbackText");
    var em = document.getElementById("chatFeedbackEmail");
    var desc = (ta && ta.value ? ta.value : "").trim();
    var email = (em && em.value ? em.value : "").trim();

    if (!desc) {
      setFeedbackStatus("Please describe the feedback or issue.", "error");
      if (ta) ta.focus();
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFeedbackStatus("Email doesn't look valid. Leave it blank or fix the address.", "error");
      if (em) em.focus();
      return;
    }
    if (!state.cfg.githubRepo) {
      setFeedbackStatus("Feedback target not configured. Please contact the site admin.", "error");
      console.warn("[chat-orb] submitFeedback: githubRepo is empty; cannot build issue URL.");
      return;
    }

    // Title = first line, trimmed to ~60 chars with ellipsis.
    var firstLine = desc.split(/\r?\n/)[0].trim();
    var title = firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;

    var body =
      desc + "\n\n" +
      "---\n" +
      "**Page:** " + (window.location.href || "(unknown)") + "\n" +
      "**User agent:** " + (navigator.userAgent || "(unknown)") + "\n" +
      "**Viewport:** " + window.innerWidth + " × " + window.innerHeight + "\n" +
      "**Timestamp:** " + new Date().toISOString() + "\n" +
      "**Contact email:** " + (email || "—") + "\n\n" +
      "_Submitted via the in-app Feedback orb._";

    var url = "https://github.com/" + state.cfg.githubRepo +
              "/issues/new" +
              "?labels=" + encodeURIComponent("feedback") +
              "&title=" + encodeURIComponent(title) +
              "&body="  + encodeURIComponent(body);

    try { window.open(url, "_blank", "noopener,noreferrer"); }
    catch (e) { console.warn("[chat-orb] window.open failed:", e); }

    // Clear + close the card, drop a confirmation bubble in the chat log.
    if (ta) ta.value = "";
    if (em) em.value = "";
    ui.feedbackCard.classList.remove("show");
    setFeedbackStatus("");
    printSystem("Opened a prefilled GitHub issue draft in a new tab. Review it and click **Submit new issue** to file it. Thanks for the feedback!");
  }

  function hydrateLlmInputs() {
    document.getElementById("chatLlmHost").value    = state.llm.host;
    document.getElementById("chatLlmModel").value   = state.llm.model;
    document.getElementById("chatLlmPath").value    = state.llm.path;
    document.getElementById("chatLlmKey").value     = state.llm.key;
    document.getElementById("chatLlmMode").value    = state.llm.mode;
    document.getElementById("chatLlmEnabled").checked = !!state.llm.enabled;
  }

  function setLlmStatus(text) {
    var el = document.getElementById("chatLlmStatus");
    if (el) el.textContent = text || "";
  }

  function setTyping(typing) {
    ui.orb.classList.toggle("is-typing", !!typing);
  }

  function setBadge(text) {
    if (!text) {
      ui.orb.classList.remove("has-notice");
      return;
    }
    ui.orb.classList.add("has-notice");
    var badge = ui.orb.querySelector(".ai-orb-badge");
    if (badge) badge.textContent = String(text);
  }

  // ── Message log ──────────────────────────────────────────────────
  function addMessage(role, text, opts) {
    opts = opts || {};
    var wrap = document.createElement("div");
    wrap.className = "ai-msg ai-msg-" + role;
    var bubble = document.createElement("div");
    bubble.className = "ai-bubble";
    if (opts.html) {
      bubble.innerHTML = text;
    } else {
      bubble.textContent = text;
    }
    wrap.appendChild(bubble);
    ui.msgs.appendChild(wrap);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;

    state.history.push({ role: role, text: text, html: !!opts.html, ts: Date.now() });
    saveHistory();
  }

  function printUser(text)   { addMessage("user", text); }
  function printAi(text, opts) { addMessage("ai", text, opts); }
  function printSystem(text) { addMessage("system", text); }

  function clearLog() {
    ui.msgs.innerHTML = "";
    state.history.length = 0;
    saveHistory();
  }

  // ── Slash-command router ─────────────────────────────────────────
  function register(command, handler, meta) {
    if (!command || (command !== "*" && command.charAt(0) !== "/")) {
      throw new Error("ChatOrb.register: command must start with '/' or be '*' (got '" + command + "')");
    }
    state.handlers[command.toLowerCase()] = {
      handler: handler,
      meta:    meta || {}
    };
  }

  function unregister(command) {
    delete state.handlers[command.toLowerCase()];
  }

  function listCommands() {
    return Object.keys(state.handlers).sort();
  }

  function dispatch(input) {
    var trimmed = String(input || "").trim();
    if (!trimmed) return Promise.resolve(null);

    if (trimmed.charAt(0) === "/") {
      var space = trimmed.indexOf(" ");
      var cmd = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase();
      var args = space === -1 ? "" : trimmed.slice(space + 1);
      var entry = state.handlers[cmd];
      if (entry) {
        try {
          var out = entry.handler(args, { rawInput: trimmed, cmd: cmd });
          return Promise.resolve(out);
        } catch (err) {
          return Promise.resolve({ reply: "Error in handler for `" + cmd + "`: " + (err && err.message || err) });
        }
      }
      return Promise.resolve({
        reply: "Unknown command `" + cmd + "`. Type `/help` for the list.",
        kind:  "system"
      });
    }

    // Free-text — no built-in routing. Consumers can register a handler
    // for arbitrary text via `ChatOrb.register("*", fn)` if they wish.
    var fallback = state.handlers["*"];
    if (fallback) {
      try {
        var out2 = fallback.handler(trimmed, { rawInput: trimmed, cmd: "*" });
        return Promise.resolve(out2);
      } catch (err2) {
        return Promise.resolve({ reply: "Error: " + (err2 && err2.message || err2) });
      }
    }
    return Promise.resolve({
      reply: state.llm.enabled
        ? "(LLM mode is enabled but no handler is registered for free-text. Type `/llm` to review settings, or use a `/command`.)"
        : "I don't have a handler for free-text yet. Try `/help` to see available commands.",
      kind:  "system"
    });
  }

  function submitInput() {
    var text = (ui.input.value || "").trim();
    if (!text) return;
    ui.input.value = "";
    printUser(text);

    setTyping(true);
    Promise.resolve(dispatch(text)).then(function (result) {
      setTyping(false);
      if (!result) return;
      if (typeof result === "string") {
        printAi(result);
        return;
      }
      if (result.reply) {
        if (result.kind === "system") {
          // Forward `html: true` so callers like /help can render their
          // own structured HTML (instead of relying on `pre-line` CSS).
          addMessage("system", result.reply, { html: !!result.html });
        } else {
          printAi(result.reply, { html: !!result.html });
        }
      }
    }).catch(function (err) {
      setTyping(false);
      printSystem("Internal error: " + (err && err.message || err));
    });
  }

  // ── Built-in slash handlers (/help, /clear, /llm) ────────────────
  function builtinHelp(args) {
    var cmds = listCommands().filter(function (c) {
      if (c === "*") return false;
      var meta = (state.handlers[c] && state.handlers[c].meta) || {};
      return !meta.outOfDomain && !meta.hiddenInHelp;
    });
    // Keep help as plain text so it survives history replay without
    // exposing raw HTML tags in the message bubble.
    var lines = ["Commands available in this chat orb:", ""];
    cmds.forEach(function (c) {
      var meta = state.handlers[c].meta || {};
      var desc = meta.description || "(no description)";
      lines.push(c + " — " + desc);
    });
    if (typeof state.cfg.onHelpExtra === "function") {
      var extra = state.cfg.onHelpExtra();
      if (extra) {
        lines.push("");
        lines.push(String(extra));
      }
    }
    return { reply: lines.join("\n"), kind: "system" };
  }

  function builtinClear() {
    clearLog();
    printSystem("Chat cleared.");
    return null;
  }

  function builtinLlm(args) {
    var token = (args || "").trim().split(/\s+/)[0];
    if (!token || token === "settings" || token === "config" || token === "configure") {
      // Pop the LLM settings card open and stop here.
      ui.llmCard.classList.add("show");
      hydrateLlmInputs();
      return { reply: "Opened LLM settings panel.", kind: "system" };
    }
    if (token === "status") {
      var s = state.llm;
      return { reply:
          "**LLM agent**: " + (s.enabled ? "enabled" : "disabled") + "\n" +
          "  host:  `" + (s.host || "(unset)") + "`\n" +
          "  model: `" + (s.model || "(unset)") + "`\n" +
          "  path:  `" + s.path + "`\n" +
          "  mode:  `" + s.mode + "`",
        kind: "system" };
    }
    if (token === "on" || token === "enable") {
      state.llm.enabled = true; saveLLM();
      return { reply: "LLM agent enabled.", kind: "system" };
    }
    if (token === "off" || token === "disable") {
      state.llm.enabled = false; saveLLM();
      return { reply: "LLM agent disabled.", kind: "system" };
    }
    if (token === "reset" || token === "defaults") {
      state.llm = Object.assign({}, LLM_DEFAULTS); saveLLM();
      return { reply: "LLM settings reset to defaults.", kind: "system" };
    }
    return { reply:
        "Usage: `/llm [settings | status | on | off | reset]`. " +
        "Use `/llm settings` to open the configuration card.",
      kind: "system" };
  }

  function builtinFeedback() {
    toggleFeedbackCard();
    return { reply: "Opened the feedback composer. Describe your feedback and submit — I'll open a prefilled GitHub issue in a new tab.", kind: "system" };
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── Public API ───────────────────────────────────────────────────
  function mount(opts) {
    if (state.mounted) return Promise.resolve(api);
    state.cfg = Object.assign({}, DEFAULTS, opts || {});

    // DOM
    ui.orb     = buildOrb();
    ui.panel   = buildPanel();
    document.body.appendChild(ui.orb);
    document.body.appendChild(ui.panel);

    ui.msgs    = document.getElementById("chatMsgs");
    ui.input   = document.getElementById("chatInput");
    ui.send    = document.getElementById("chatSend");
    ui.close   = document.getElementById("chatClose");
    ui.llmBtn  = document.getElementById("chatLlmBtn");
    ui.llmCard = document.getElementById("chatLlmCard");
    ui.demoBtn  = document.getElementById("chatDemoBtn");  // null when showDemoBtn=false
    ui.demoCard = document.getElementById("chatDemoCard"); // null when showDemoBtn=false
    ui.feedbackBtn  = document.getElementById("chatFeedbackBtn");   // null when showFeedbackBtn=false
    ui.feedbackCard = document.getElementById("chatFeedbackCard");  // null when showFeedbackBtn=false

    // Built-in commands
    register("/help",  builtinHelp,  { description: "Show all available commands" });
    register("/clear", builtinClear, { description: "Clear the chat history" });
    register("/llm",   builtinLlm,   { description: "Configure or toggle the LLM agent" });
    if (state.cfg.showFeedbackBtn) {
      register("/feedback", builtinFeedback, { description: "Send product feedback — file a GitHub issue" });
    }

    wireEvents();
    refreshStatusSubtitle();
    global.addEventListener("voicebridge:tts-mode-changed", refreshStatusSubtitle);

    // Replay any persisted history (tail only, to keep things snappy).
    state.history = loadHistory();
    state.history.slice(-10).forEach(function (m) {
      var html = !!m.html;
      // Backward compatibility: older /help replies were persisted as raw
      // HTML strings without an `html` flag, which rendered literal tags
      // after reopening. Detect and render those as HTML once.
      if (!html && m && m.role === "system" && /<(div|code|br)\b/i.test(String(m.text || ""))) {
        html = true;
      }
      addMessage(m.role, m.text, { html: html });
      // Don't double-persist; remove the duplicate appended by addMessage.
      state.history.pop();
    });
    state.history = loadHistory(); // restore canonical history after replay
    saveHistory();

    state.mounted = true;
    return Promise.resolve(api);
  }

  var api = {
    mount:       mount,
    register:    register,
    unregister:  unregister,
    listCommands: listCommands,
    dispatch:    dispatch,
    open:        function () { setOpen(true); },
    close:       function () { setOpen(false); },
    toggle:      toggle,
    print:       function (role, text, opts) { addMessage(role, text, opts); },
    printSystem: printSystem,
    printAi:     printAi,
    setBadge:    setBadge,
    setTyping:   setTyping,
    clear:       clearLog,
    getLLM:      function () { return Object.assign({}, state.llm); },
    setLLM:      function (cfg) { state.llm = Object.assign({}, state.llm, cfg); saveLLM(); },
    openDemoCard:   openDemoCard,
    toggleDemoCard: toggleDemoCard
  };

  global.ChatOrb = api;
})(typeof window !== "undefined" ? window : this);
