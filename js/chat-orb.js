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
 *       title:          "LLM Benchmark Agent",
 *       initials:       "LB",
 *       storagePrefix:  "llm-benchmark",
 *       greeting:       "Ask me about a sweep, or type /help to see commands.",
 *       placeholder:    "Ask, navigate, or /command…"
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
  // Legacy keys (`shared-ui:chat-orb:*`) predated per-product isolation.
  // Pass `storagePrefix: "<product-id>"` in mount() so each sibling keeps
  // its own transcript and LLM settings. Omitting storagePrefix keeps the
  // legacy namespace for backward compatibility only.
  var LEGACY_STORAGE_KEY = "shared-ui:chat-orb:v1";
  var LEGACY_LLM_KEY     = "shared-ui:chat-orb:llm:v1";
  var PROMPT_HISTORY_MAX = 50;
  var DEFAULTS = {
    title:       "AI Assistant",
    // Product id for localStorage namespacing, e.g. "cluster-manager".
    storagePrefix: "",
    subtitle:    "Online · ready to act",
    initials:    "AI",
    greeting:    "Hi! Type a question, or `/help` to see what I can do.",
    placeholder: "Ask me anything, or /command…",
    // First-run chips under the greeting. Accepts command strings
    // (["/demo", "/pitch"]) or {label, command, hint} objects; `false`
    // disables them. Unset auto-picks from the registered commands, so a
    // consumer that registers a command gets a chip without extra wiring.
    suggestions: null,
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
    githubRepo:      "",
    // Opt-in push-to-talk composer control. `true` uses window.voiceBridge;
    // an object may provide `{ bridge, registerSlash, coarseMQ }`.
    // The default is off so consumers that do not load voice.js are unchanged.
    voiceComposer: false
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
    storageKeys: { history: LEGACY_STORAGE_KEY, llm: LEGACY_LLM_KEY, prompts: LEGACY_STORAGE_KEY + ":prompts" },
    llm:      Object.assign({}, LLM_DEFAULTS),
    handlers: Object.create(null),
    history:  [],
    prompts:  [],
    promptIndex: -1,
    promptDraft: ""
  };

  function resolveStorageKeys(prefix) {
    var p = String(prefix || "").trim();
    if (!p) {
      return {
        history: LEGACY_STORAGE_KEY,
        llm: LEGACY_LLM_KEY,
        prompts: LEGACY_STORAGE_KEY + ":prompts"
      };
    }
    var base = p.replace(/:+$/, "") + ":";
    return {
      history: base + "chat-orb:v1",
      llm: base + "chat-orb:llm:v1",
      prompts: base + "chat-orb:prompts:v1"
    };
  }

  var ui = { orb: null, panel: null, msgs: null, input: null, send: null,
             close: null, llmBtn: null, llmCard: null, demoBtn: null,
             demoCard: null, feedbackBtn: null, feedbackCard: null,
             voiceBtn: null, voiceStatus: null };

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
      var raw = localStorage.getItem(state.storageKeys.llm);
      if (!raw) return Object.assign({}, LLM_DEFAULTS);
      var parsed = JSON.parse(raw);
      return Object.assign({}, LLM_DEFAULTS, parsed);
    } catch (e) { return Object.assign({}, LLM_DEFAULTS); }
  }

  function saveLLM() {
    try { localStorage.setItem(state.storageKeys.llm, JSON.stringify(state.llm)); } catch (e) {}
  }

  function loadHistory() {
    try {
      var raw = localStorage.getItem(state.storageKeys.history);
      return raw ? JSON.parse(raw).history || [] : [];
    } catch (e) { return []; }
  }

  function saveHistory() {
    try {
      // Cap stored history at 50 messages so localStorage doesn't bloat.
      var trimmed = state.history.slice(-50);
      localStorage.setItem(state.storageKeys.history, JSON.stringify({ history: trimmed }));
    } catch (e) {}
  }

  function loadPromptHistory() {
    try {
      var raw = localStorage.getItem(state.storageKeys.prompts);
      var arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      return arr.filter(function (s) { return typeof s === "string" && s; })
        .slice(-PROMPT_HISTORY_MAX);
    } catch (e) { return []; }
  }

  function savePromptHistory() {
    try {
      localStorage.setItem(
        state.storageKeys.prompts,
        JSON.stringify(state.prompts.slice(-PROMPT_HISTORY_MAX))
      );
    } catch (e) {}
  }

  function pushPromptHistory(text) {
    var t = String(text || "").trim();
    if (!t) return;
    if (state.prompts[state.prompts.length - 1] === t) {
      state.promptIndex = -1;
      state.promptDraft = "";
      return;
    }
    state.prompts.push(t);
    if (state.prompts.length > PROMPT_HISTORY_MAX) {
      state.prompts = state.prompts.slice(-PROMPT_HISTORY_MAX);
    }
    savePromptHistory();
    state.promptIndex = -1;
    state.promptDraft = "";
  }

  function caretLineIsFirst(el) {
    var start = el.selectionStart;
    if (start == null) return true;
    return el.value.slice(0, start).indexOf("\n") < 0;
  }

  function caretLineIsLast(el) {
    var start = el.selectionStart;
    if (start == null) return true;
    return el.value.slice(start).indexOf("\n") < 0;
  }

  function applyPromptHistory(index) {
    var el = ui.input;
    if (!el) return;
    state.promptIndex = index;
    el.value = index < 0 ? state.promptDraft : (state.prompts[index] || "");
    var n = el.value.length;
    try { el.setSelectionRange(n, n); } catch (e) {}
    if (typeof Event === "function") {
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  /* Readline-style recall. Slash-command palette keeps ArrowUp/Down.
     In a multiline draft, arrows move the caret unless it is already on
     the first (Up) or last (Down) line. */
  function promptHistoryKeydown(e) {
    if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return false;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return false;
    if (paletteOpen()) return false;
    var el = ui.input;
    if (!el) return false;
    if (e.key === "ArrowUp") {
      if (!caretLineIsFirst(el)) return false;
      if (!state.prompts.length) return false;
      if (state.promptIndex < 0) {
        state.promptDraft = el.value;
        applyPromptHistory(state.prompts.length - 1);
      } else if (state.promptIndex > 0) {
        applyPromptHistory(state.promptIndex - 1);
      }
      e.preventDefault();
      return true;
    }
    if (state.promptIndex < 0) return false;
    if (!caretLineIsLast(el)) return false;
    if (state.promptIndex >= state.prompts.length - 1) applyPromptHistory(-1);
    else applyPromptHistory(state.promptIndex + 1);
    e.preventDefault();
    return true;
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
    // Non-modal: the page stays interactive and focus is deliberately not trapped,
    // so this is a complementary landmark rather than a dialog. As a landmark it
    // also shows up in screen-reader landmark navigation.
    panel.setAttribute("role", "complementary");
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
      '  <div class="ai-llm-row"><label for="chatLlmModel">Model</label><input type="text" id="chatLlmModel" placeholder="qwen2.5:0.5b" autocomplete="off" /></div>',
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
      (state.cfg.voiceComposer
        ? '<div class="ai-voice-status" id="chatVoiceStatus" role="status" aria-live="polite"></div>'
        : ""),
      '<div class="ai-input-row">',
      '  <div class="ai-input-wrap">',
      '    <ul id="chatPalette" class="ai-palette" role="listbox" aria-label="Slash commands" hidden></ul>',
      '    <textarea id="chatInput" class="ai-input" rows="1" placeholder="' + escapeAttr(state.cfg.placeholder) + '" maxlength="600"' +
      ' role="combobox" aria-expanded="false" aria-controls="chatPalette" aria-autocomplete="list" aria-keyshortcuts="ArrowUp ArrowDown"></textarea>',
      "  </div>",
      (state.cfg.voiceComposer
        ? '  <button type="button" id="chatVoiceBtn" class="ai-voice" aria-controls="chatInput" aria-pressed="false"><span class="material-symbols-outlined" aria-hidden="true">mic</span></button>'
        : ""),
      '  <button type="button" id="chatSend" class="ai-send" aria-label="Send message"><span class="material-symbols-outlined">arrow_upward</span></button>',
      "</div>"
    ].join("");
    return panel;
  }

  // ── iOS software-keyboard tracking ───────────────────────────────
  // On iPhone the panel is `position: fixed; bottom: 0`, but iOS Safari
  // does NOT shrink the layout viewport when the keyboard opens — it
  // overlays it. So the composer the user just tapped ends up behind the
  // keyboard. visualViewport reports the *visible* rect, and the gap
  // between its bottom edge and the layout viewport bottom is exactly the
  // keyboard height. We publish it as `--ai-kb-inset`; chat-orb.css
  // translates the panel up by that amount.
  //
  // `visualViewport` is absent on older browsers and on desktop the
  // computed inset is always 0, so this is inert everywhere but mobile.
  //
  // `visualViewport` scroll fires for ordinary page scrolling too, not just
  // for the keyboard, so this runs constantly on mobile. Two guards keep it
  // cheap: the work is coalesced into one rAF callback per frame, and an
  // unchanged inset writes nothing. Setting a custom property on the root
  // element invalidates style for the whole document, and the inset is 0 and
  // unchanging through every scroll that does not involve the keyboard — by
  // far the common case — so the write is almost always a document-wide
  // invalidation in exchange for no visual change at all.
  function trackKeyboardInset() {
    var vv = global.visualViewport;
    if (!vv) return;

    var lastInset = null;
    var frame = 0;

    function measure() {
      frame = 0;
      // offsetTop covers the case where the page itself is scrolled
      // within the visual viewport (pinch-zoom / scrolled-into-view).
      var overlap = global.innerHeight - vv.height - vv.offsetTop;
      var inset = overlap > 0 ? Math.round(overlap) : 0;
      if (inset === lastInset) return;
      lastInset = inset;
      document.documentElement.style.setProperty("--ai-kb-inset", inset + "px");
    }

    function sync() {
      if (frame) return;
      frame = global.requestAnimationFrame(measure);
    }

    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    measure();
  }

  // Coarse pointer == touch. Used to suppress desktop-only affordances
  // (autofocus, which yanks up the keyboard and covers half the panel).
  function isTouch() {
    return !!(global.matchMedia && global.matchMedia("(pointer: coarse)").matches);
  }

  function wireVoiceComposer() {
    if (!ui.voiceBtn || !ui.voiceStatus) return;
    var opts = state.cfg.voiceComposer === true ? {} : (state.cfg.voiceComposer || {});
    var bridge = opts.bridge || global.voiceBridge;
    var coarseMQ = opts.coarseMQ || "(pointer: coarse)";
    var coarse = !!(global.matchMedia && global.matchMedia(coarseMQ).matches);
    var ignoreClickUntil = 0;
    var receivedFinal = false;
    var receivedError = false;
    var hasStateEvents = !!(bridge && typeof bridge.onState === "function");
    var supported = !!(
      bridge &&
      typeof bridge.start === "function" &&
      typeof bridge.stop === "function" &&
      typeof bridge.isActive === "function" &&
      typeof bridge.isSupported === "function" &&
      bridge.isSupported()
    );

    function setVoiceState(active, message, isError) {
      ui.voiceBtn.classList.toggle("is-listening", !!active);
      ui.voiceBtn.setAttribute("aria-pressed", active ? "true" : "false");
      ui.voiceBtn.setAttribute(
        "aria-label",
        active ? "Stop voice input" : (coarse ? "Hold to talk" : "Start voice input")
      );
      ui.voiceBtn.title = active
        ? "Listening — release or activate again to stop"
        : (coarse ? "Hold to talk" : "Start voice input");
      ui.voiceStatus.textContent = message || "";
      ui.voiceStatus.classList.toggle("is-visible", !!message);
      ui.voiceStatus.classList.toggle("is-error", !!isError);
    }

    function startVoice() {
      receivedFinal = false;
      receivedError = false;
      setVoiceState(false, "Requesting microphone access…", false);
      if (!bridge.start()) {
        setVoiceState(false, "Microphone access failed or was denied.", true);
        return false;
      }
      if (!hasStateEvents) {
        setVoiceState(true, coarse ? "Listening… release to send." : "Listening… activate again to stop.", false);
      }
      return true;
    }

    function stopVoice() {
      setVoiceState(false, "Processing speech…", false);
      bridge.stop();
    }

    setVoiceState(false, "", false);
    if (!supported) {
      ui.voiceBtn.disabled = true;
      ui.voiceBtn.setAttribute("aria-disabled", "true");
      setVoiceState(false, "Voice input is not supported by this browser.", true);
      return;
    }

    if (typeof bridge.onTranscript === "function") {
      bridge.onTranscript(function (text, isFinal) {
        var transcript = String(text || "");
        if (/^\[voice error\]/i.test(transcript)) {
          receivedError = true;
          var code = transcript.replace(/^\[voice error\]\s*/i, "");
          var message = /^(not-allowed|service-not-allowed)$/i.test(code)
            ? "Microphone permission was denied."
            : (/^audio-capture$/i.test(code) ? "No microphone is available." : "Voice error: " + code);
          setVoiceState(false, message, true);
        } else if (isFinal) {
          receivedFinal = true;
          setVoiceState(false, transcript ? "Voice message sent." : "No speech detected.", !transcript);
        } else if (transcript) {
          setVoiceState(true, "Hearing: " + transcript.slice(0, 80), false);
        }
      });
    }

    if (hasStateEvents) {
      bridge.onState(function (voiceState, detail) {
        if (voiceState === "listening") {
          setVoiceState(true, coarse ? "Listening… release to send." : "Listening… activate again to stop.", false);
        } else if (voiceState === "error") {
          receivedError = true;
          var code = String(detail || "unknown");
          setVoiceState(
            false,
            /^(not-allowed|service-not-allowed)$/.test(code)
              ? "Microphone permission was denied."
              : (code === "audio-capture" ? "No microphone is available." : "Voice error: " + code),
            true
          );
        } else if (voiceState === "idle" && !receivedFinal && !receivedError) {
          setVoiceState(false, "No speech detected.", true);
        }
      });
    }

    ui.voiceBtn.addEventListener("pointerdown", function (event) {
      if (!coarse || (event.pointerType && event.pointerType === "mouse")) return;
      event.preventDefault();
      ignoreClickUntil = Date.now() + 600;
      try { ui.voiceBtn.setPointerCapture(event.pointerId); } catch (_) {}
      if (!bridge.isActive()) startVoice();
    });
    ui.voiceBtn.addEventListener("pointerup", function (event) {
      if (!coarse || (event.pointerType && event.pointerType === "mouse")) return;
      event.preventDefault();
      ignoreClickUntil = Date.now() + 600;
      if (bridge.isActive()) stopVoice();
    });
    ui.voiceBtn.addEventListener("pointercancel", function () {
      if (bridge.isActive()) stopVoice();
    });
    ui.voiceBtn.addEventListener("click", function () {
      if (Date.now() < ignoreClickUntil) return;
      if (bridge.isActive()) stopVoice();
      else startVoice();
    });
  }

  function registerVoiceSlash() {
    var opts = state.cfg.voiceComposer === true ? {} : (state.cfg.voiceComposer || {});
    if (!state.cfg.voiceComposer || !opts.registerSlash) return;
    register("/voice", function (args) {
      var bridge = opts.bridge || global.voiceBridge;
      if (!bridge || typeof bridge.handleSlash !== "function") {
        return { reply: "Voice controls are unavailable in this browser session.", kind: "system" };
      }
      return Promise.resolve(bridge.handleSlash(args || "")).then(function (result) {
        return {
          reply: (result && (result.text || result.reply)) || "Voice command completed.",
          kind: "system"
        };
      });
    }, { description: "Control push-to-talk, speech output, and voice personas" });
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
      if (paletteKeydown(e)) return;
      if (promptHistoryKeydown(e)) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitInput();
      }
    });
    ui.input.addEventListener("input", refreshPalette);
    ui.input.addEventListener("blur", function () {
      // Delay so a click on an option lands before the list is torn down.
      setTimeout(closePalette, 120);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      // Escape dismisses the palette first, the panel second.
      if (paletteOpen()) { closePalette(); return; }
      if (state.open) setOpen(false);
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
      setBadge("");
      // Render any backlog history if first open.
      if (state.history.length === 0) {
        printSystem(state.cfg.greeting);
        renderSuggestions();
      }
      // Don't autofocus on touch: it summons the iOS keyboard before the
      // user has asked to type, hiding the message log they just opened.
      if (!isTouch()) setTimeout(function () { ui.input.focus(); }, 80);
    } else {
      // Blur so iOS retracts the keyboard along with the panel; without
      // this the keyboard can linger over the page after the panel closes.
      try { ui.input.blur(); } catch (_) {}
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
    // Route through this orb's own dispatcher. This used to call
    // `SlashRouter.run(...)`, which SlashRouter never exported, so with no
    // onDemoSelect configured the audience picker silently did nothing.
    // Dispatching locally also means the fallback works whether or not
    // slash-router.js is loaded.
    runCommand("/demo " + audienceId, { echo: true });
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

  // Render only. Kept separate from addMessage so history replay can paint
  // the log without touching state.history or localStorage.
  function renderMessage(role, text, opts) {
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
  }

  function addMessage(role, text, opts) {
    opts = opts || {};
    renderMessage(role, text, opts);
    state.history.push({ role: role, text: text, html: !!opts.html, ts: Date.now() });
    saveHistory();
  }

  function printUser(text)   { addMessage("user", text); }
  function printAi(text, opts) { addMessage("ai", text, opts); }
  function printSystem(text) { addMessage("system", text); }

  // ── First-run suggestion chips ───────────────────────────────────
  // The greeting used to be the only onboarding: a paragraph telling the
  // user to type "/demo" or "/help". Nobody types a command they've never
  // seen, so the first run now offers the same commands as one-tap chips.
  // Deliberately NOT written to state.history — these are an affordance,
  // not a message, and replaying them on every load would be noise.

  // `suggestions` may be command strings ("/demo") or {label, command}.
  // Unset falls back to whatever the consumer registered, so a repo that
  // adds a command gets a chip for free.
  function resolveSuggestions() {
    var configured = state.cfg.suggestions;
    if (configured === false) return [];
    var list = configured;
    if (!list) {
      // Auto-pick is a fallback — consumers should curate `suggestions`.
      // Commands that destroy state or end a session are never offered as a
      // first thing to try.
      var NEVER_SUGGEST = /^\/(help|clear|exit|stop|undo|redo|privacy)$/;
      list = listCommands()
        .filter(function (c) { return c !== "*" && !NEVER_SUGGEST.test(c); })
        .slice(0, 3);
      if (state.handlers["/help"]) list.push("/help");
    }
    return list.map(function (item) {
      if (typeof item === "string") {
        var entry = state.handlers[item.toLowerCase()];
        return {
          command: item,
          label: item,
          hint: (entry && entry.meta && entry.meta.description) || ""
        };
      }
      return { command: item.command, label: item.label || item.command, hint: item.hint || "" };
    }).filter(function (s) { return !!s.command; }).slice(0, 4);
  }

  function clearSuggestions() {
    if (ui.suggestions && ui.suggestions.parentNode) {
      ui.suggestions.parentNode.removeChild(ui.suggestions);
    }
    ui.suggestions = null;
  }

  function renderSuggestions() {
    clearSuggestions();
    var items = resolveSuggestions();
    if (!items.length) return;

    var row = document.createElement("div");
    row.className = "ai-suggestions";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Suggested commands");

    items.forEach(function (item) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "ai-suggestion";
      chip.textContent = item.label;
      if (item.hint) chip.title = item.hint;
      chip.addEventListener("click", function () {
        clearSuggestions();
        runCommand(item.command, { echo: true });
      });
      row.appendChild(chip);
    });

    ui.suggestions = row;
    ui.msgs.appendChild(row);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }

  function clearLog() {
    ui.msgs.innerHTML = "";
    ui.suggestions = null;   // node went with the innerHTML wipe
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

  function dispatchInner(trimmed) {
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

  function dispatch(input) {
    var trimmed = String(input || "").trim();
    if (!trimmed) return Promise.resolve(null);

    if (trimmed.charAt(0) !== "/" &&
        global.AgentGateway &&
        typeof global.AgentGateway.route === "function" &&
        global.AgentGateway.isEnabled()) {
      return global.AgentGateway.route({ text: trimmed }).then(function (result) {
        if (result && result.handled && result.reply) {
          return { reply: result.reply, kind: "ai", html: !!result.html };
        }
        return dispatchInner(trimmed);
      });
    }

    return dispatchInner(trimmed);
  }

  // Dispatch `text` and render whatever comes back, exactly as if the user
  // had typed it. Shared by the input box and by in-orb affordances (the
  // demo audience picker) that need to trigger a command programmatically.
  function runCommand(text, opts) {
    opts = opts || {};
    clearSuggestions();
    if (opts.echo) printUser(text);

    setTyping(true);
    return Promise.resolve(dispatch(text)).then(function (result) {
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

  function submitInput() {
    var text = (ui.input.value || "").trim();
    if (!text) return;
    pushPromptHistory(text);
    ui.input.value = "";
    closePalette();
    runCommand(text, { echo: true });
  }

  // ── Slash-command palette ────────────────────────────────────────
  // Each consumer registers ~34 commands, but the only way to see them
  // was `/help` dumping a wall of text into the log. Typing "/" now
  // filters the same registry inline, so the long tail is reachable
  // without memorising it.
  // `navigated` records whether the user actively moved through the list.
  // Enter only autocompletes once they have; otherwise typing a command in
  // full and pressing Enter would complete it instead of running it.
  var palette = { items: [], index: -1, navigated: false };

  function paletteOpen() {
    return !!(ui.palette && !ui.palette.hidden);
  }

  /* The palette only applies while the caret is still inside the leading
   * command token — once the user types an argument, they have chosen. */
  function paletteQuery() {
    var v = ui.input.value || "";
    if (v.charAt(0) !== "/") return null;
    if (/\s/.test(v)) return null;
    return v;
  }

  function paletteCandidates(q) {
    var needle = q.slice(1).toLowerCase();
    var native = [];
    var elsewhere = [];
    listCommands().forEach(function (c) {
      if (c === "*") return;
      var meta = (state.handlers[c] && state.handlers[c].meta) || {};
      if (meta.hiddenInHelp) return;
      if (needle && c.slice(1).toLowerCase().indexOf(needle) !== 0) return;
      (meta.outOfDomain ? elsewhere : native).push({
        command: c,
        description: meta.description || "",
        elsewhere: !!meta.outOfDomain
      });
    });
    return native.concat(elsewhere).slice(0, 12);
  }

  function closePalette() {
    if (!ui.palette) return;
    ui.palette.hidden = true;
    ui.palette.innerHTML = "";
    palette.items = [];
    palette.index = -1;
    palette.navigated = false;
    ui.input.setAttribute("aria-expanded", "false");
    ui.input.removeAttribute("aria-activedescendant");
  }

  function highlight(i) {
    if (!palette.items.length) return;
    palette.index = (i + palette.items.length) % palette.items.length;
    [].slice.call(ui.palette.children).forEach(function (li, n) {
      var on = n === palette.index;
      li.classList.toggle("is-active", on);
      li.setAttribute("aria-selected", String(on));
      if (on) {
        ui.input.setAttribute("aria-activedescendant", li.id);
        if (li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function acceptPalette() {
    var pick = palette.items[palette.index];
    if (!pick) return false;
    // Leave a trailing space so an argument can be typed straight away,
    // and keep the palette closed now that a command is chosen.
    ui.input.value = pick.command + " ";
    closePalette();
    ui.input.focus();
    return true;
  }

  function refreshPalette() {
    if (!ui.palette) return;
    var q = paletteQuery();
    if (q === null) { closePalette(); return; }
    var items = paletteCandidates(q);
    if (!items.length) { closePalette(); return; }

    palette.items = items;
    palette.navigated = false;
    ui.palette.innerHTML = "";
    items.forEach(function (it, n) {
      var li = document.createElement("li");
      li.className = "ai-palette-item";
      li.id = "chatPaletteOpt" + n;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");

      var cmd = document.createElement("span");
      cmd.className = "ai-palette-cmd";
      cmd.textContent = it.command;
      li.appendChild(cmd);

      if (it.description) {
        var desc = document.createElement("span");
        desc.className = "ai-palette-desc";
        desc.textContent = it.description;
        li.appendChild(desc);
      }
      if (it.elsewhere) {
        var tag = document.createElement("span");
        tag.className = "ai-palette-tag";
        tag.textContent = "other app";
        li.appendChild(tag);
      }

      // mousedown, not click: the input's blur would otherwise close the
      // list before the click resolved.
      li.addEventListener("mousedown", function (ev) {
        ev.preventDefault();
        palette.index = n;
        acceptPalette();
      });
      ui.palette.appendChild(li);
    });

    ui.palette.hidden = false;
    // The list grows upward from the composer, so a fixed max-height
    // punched through the panel header on short panels (and off the top
    // of the panel entirely on a phone). Cap it to the gap that is
    // actually free between the header and the composer.
    var wrap = ui.palette.parentNode.getBoundingClientRect();
    var hdr = ui.panel && ui.panel.querySelector(".ai-hdr");
    var top = hdr ? hdr.getBoundingClientRect().bottom : 0;
    ui.palette.style.maxHeight = Math.max(96, Math.round(wrap.top - top - 12)) + "px";

    ui.input.setAttribute("aria-expanded", "true");
    highlight(0);
  }

  /* Returns true when the palette consumed the key. */
  function paletteKeydown(e) {
    if (!paletteOpen()) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); palette.navigated = true; highlight(palette.index + 1); return true; }
    if (e.key === "ArrowUp")   { e.preventDefault(); palette.navigated = true; highlight(palette.index - 1); return true; }
    if (e.key === "Tab")       { e.preventDefault(); acceptPalette(); return true; }
    // stopPropagation, or the panel-level Escape handler would see a
    // now-closed palette and close the whole panel in the same keystroke.
    if (e.key === "Escape")    { e.preventDefault(); e.stopPropagation(); closePalette(); return true; }
    // Enter submits what was typed unless the user picked from the list.
    if (e.key === "Enter" && !e.shiftKey && palette.navigated) { e.preventDefault(); return acceptPalette(); }
    return false;
  }

  // ── Built-in slash handlers (/help, /clear, /llm) ────────────────
  function builtinHelp(args) {
    var native = [];
    var elsewhere = [];
    listCommands().forEach(function (c) {
      if (c === "*") return;
      var meta = (state.handlers[c] && state.handlers[c].meta) || {};
      if (meta.hiddenInHelp) return;
      (meta.outOfDomain ? elsewhere : native).push(c);
    });

    // Keep help as plain text so it survives history replay without
    // exposing raw HTML tags in the message bubble.
    var lines = ["Commands available in this chat orb:", ""];
    native.forEach(function (c) {
      var meta = state.handlers[c].meta || {};
      lines.push(c + " — " + (meta.description || "(no description)"));
    });

    // SlashRouter.coverAll() exists to give every consumer an identical
    // command surface, registering the other apps' commands as friendly
    // no-ops. Filtering `outOfDomain` out of /help entirely defeated that:
    // the handlers answered when typed but were undiscoverable. List them
    // in their own section instead, so they're advertised without being
    // confused for features of this app.
    if (elsewhere.length) {
      lines.push("");
      lines.push("Available in the other dashboards:");
      lines.push("");
      elsewhere.forEach(function (c) {
        var meta = state.handlers[c].meta || {};
        lines.push(c + " — " + (meta.description || "(no description)"));
      });
    }

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
    state.storageKeys = resolveStorageKeys(state.cfg.storagePrefix);
    state.llm = loadLLM();

    // DOM
    ui.orb     = buildOrb();
    ui.panel   = buildPanel();
    document.body.appendChild(ui.orb);
    document.body.appendChild(ui.panel);

    ui.msgs    = document.getElementById("chatMsgs");
    ui.input   = document.getElementById("chatInput");
    ui.palette = document.getElementById("chatPalette");
    ui.send    = document.getElementById("chatSend");
    ui.close   = document.getElementById("chatClose");
    ui.llmBtn  = document.getElementById("chatLlmBtn");
    ui.llmCard = document.getElementById("chatLlmCard");
    ui.demoBtn  = document.getElementById("chatDemoBtn");  // null when showDemoBtn=false
    ui.demoCard = document.getElementById("chatDemoCard"); // null when showDemoBtn=false
    ui.feedbackBtn  = document.getElementById("chatFeedbackBtn");   // null when showFeedbackBtn=false
    ui.feedbackCard = document.getElementById("chatFeedbackCard");  // null when showFeedbackBtn=false
    ui.voiceBtn = document.getElementById("chatVoiceBtn");          // null when voiceComposer=false
    ui.voiceStatus = document.getElementById("chatVoiceStatus");    // null when voiceComposer=false

    // Built-in commands
    register("/help",  builtinHelp,  { description: "Show all available commands" });
    register("/clear", builtinClear, { description: "Clear the chat history" });
    register("/llm",   builtinLlm,   { description: "Configure or toggle the LLM agent" });
    if (state.cfg.showFeedbackBtn) {
      register("/feedback", builtinFeedback, { description: "Send product feedback — file a GitHub issue" });
    }
    registerVoiceSlash();

    wireEvents();
    wireVoiceComposer();
    trackKeyboardInset();
    refreshStatusSubtitle();
    global.addEventListener("voicebridge:tts-mode-changed", refreshStatusSubtitle);

    // Replay any persisted history (tail only, to keep things snappy).
    //
    // Replay renders without persisting. The previous version called
    // addMessage and popped the duplicate afterwards, but addMessage had
    // already written the duplicate to localStorage, so the next mount read
    // it back as real history and the last message multiplied on every load.
    //
    // A message is rendered as HTML only when its stored `html` flag says so.
    // There used to be a sniff here that re-flagged any stored system message
    // matching /<(div|code|br)\b/ as HTML, for the benefit of legacy /help
    // replies. That turned the log into a stored-XSS sink: dispatch() echoes
    // unknown commands back verbatim ("Unknown command `…`") as a persisted
    // system message, so typing a space-free payload like
    // `/<div/onmouseover=alert(1)/style=position:fixed;inset:0>` got stored as
    // plain text and then re-parsed as markup on every subsequent page load.
    // /help emits plain text now, so the compatibility shim only bought
    // correct rendering for history written by much older builds.
    state.history = loadHistory();
    state.history.slice(-10).forEach(function (m) {
      renderMessage(m.role, m.text, { html: !!m.html });
    });
    state.prompts = loadPromptHistory();
    state.promptIndex = -1;
    state.promptDraft = "";

    if (state.cfg.agentGateway && global.AgentGateway) {
      if (typeof global.AgentGateway.configure === "function") {
        global.AgentGateway.configure({ enabled: true });
      }
      if (typeof global.AgentGateway.installChatInterceptor === "function") {
        global.AgentGateway.installChatInterceptor();
      }
    }

    state.mounted = true;
    return Promise.resolve(api);
  }

  var api = {
    mount:       mount,
    register:    register,
    unregister:  unregister,
    listCommands: listCommands,
    dispatch:    dispatch,
    // dispatch() resolves the reply but renders nothing; run() dispatches
    // and prints the result into the log, as typing the command would.
    run:         function (text, opts) { return runCommand(text, opts || { echo: true }); },
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
    getHistory:  function () { return state.history.slice(); },
    openDemoCard:   openDemoCard,
    toggleDemoCard: toggleDemoCard
  };

  global.ChatOrb = api;
})(typeof window !== "undefined" ? window : this);
