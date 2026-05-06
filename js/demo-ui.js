/*!
 * webtools-ui canonical asset: demo-ui.js
 *
 * PROMOTED in harmonization Phase 5.1 — was dc-planner/js/demo-ui.js,
 * now the single source of truth for the demo player chrome (launcher
 * chip + floating player + orb-routed narration + highlight overlay) across
 * all 3 sibling consumers. Loaded as `../shared/js/demo-ui.js`.
 *
 * Domain coupling notes for downstream consumers (Phase 5.3):
 *   - Some selectors below assume dc-planner DOM (e.g. `.side-nav-tab`
 *     for the launcher chip mount point). When llm-benchmark and
 *     cluster-manager migrate to this UI, they will pass their own
 *     mount-point selector via `DemoUI.create({ launcherSelector: ... })`.
 *
 * --- (original header below) ---
 *
 * Demo UI
 *
 * The visible chrome that wraps the Demo Engine: a launcher chip in
 * the side-nav header, a floating player at the bottom of the viewport,
 * and a highlight overlay that pins to whatever element the engine is
 * pointing at. Narrated text is routed into the existing agent-orb
 * chat panel instead of creating a separate transcript modal.
 *
 * URL params: ?demo=<track>      — autoload + autoplay on page ready
 *             ?demo=<track>&autoplay=0 — load but wait for explicit play
 *
 * Keyboard (only while a demo is active):
 *   Space        play / pause
 *   ←  →         prev / next step
 *   T            open the assistant panel
 *   R            restart current track from (0,0)
 *   M            mute / unmute voice
 *   Esc          exit demo (asks before discarding restore-snapshot)
 */
(function () {
  "use strict";

  if (window.__demoUiLoaded) return;
  window.__demoUiLoaded = true;

  const DEFAULT_TRACK = "onboarding";
  const REGISTERED_TRACKS = ["onboarding", "advanced", "expert", "presales"];

  /* ── Boot ───────────────────────────────────────────────────────── */
  //
  // Two consumer-side opt-out gates control auto-boot behavior.
  // Both must be set BEFORE this script loads (i.e. on a <script>
  // tag that precedes `shared/js/demo-ui.js` in the page's load order).
  //
  // 1. window.__demoUiSkipAutoBoot = true  (added 2026-05-03, Phase 9.6)
  //    Skips the ENTIRE boot — no player chrome, no transcript, no
  //    highlight overlay, no keyboard listener, no launcher chip, no
  //    snapshot toast, no DcDemo namespace, no URL-param autoload.
  //    Used by cluster-manager + llm-benchmark — they ship their own
  //    demo engines (cluster-manager: pages/demo.js + cm-demo-* chrome;
  //    llm-benchmark: js/dashboard-tutor.js + .tutor-bar) and only
  //    want shared/js/demo-engine.js + demo-voice.js loaded so their
  //    js/demo-bridge.js can lazy-instantiate the canonical engine
  //    for the optional `/demo-shared <track>` slash. Without this
  //    gate, two players would compete on the same body.
  //
  // 2. window.__demoUiSkipLauncher = true  (added 2026-05-04, Phase 9.7.1)
  //    Skips ONLY the side-nav .demo-launcher chip — everything else
  //    (player chrome, transcript, highlight, keyboard, DcDemo
  //    namespace, URL-param autoload) still mounts. Used by dc-planner
  //    where the chip is redundant with the chat orb's `#aiDemoBtn`
  //    play-circle button, the `/demo` slash, and the `?demo=presales`
  //    URL parameter. The gate is checked inside injectLauncher()
  //    below; see that function's leading comment block.
  //
  // dc-planner historically did NOT set the auto-boot gate (it IS the
  // canonical consumer); as of Phase 9.7.1 it sets the launcher gate
  // only, so the bar / transcript / highlight still mount.
  if (window.__demoUiSkipAutoBoot) return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  function boot() {
    if (!window.DemoEngine || !window.DemoVoice) {
      console.warn("[demo-ui] DemoEngine or DemoVoice not loaded; skipping UI init.");
      return;
    }

    // Agent-bridge is normally injected by the service worker, but on
    // first page load before the SW activates (and in test/embed
    // environments where the SW is unregistered) it won't be there.
    // Load it eagerly so the demo's switch_tab / fill / click actions
    // always have a working surface.
    ensureAgentBridge();

    const voice = window.DemoVoice.create({
      preferred_voices: [
        "Microsoft Aria Online (Natural) - English (United States)",
        "Microsoft Jenny Online (Natural) - English (United States)",
        "Google US English",
        "Samantha",
        "Alex"
      ],
      rate: 0.95,
      pitch: 1.0
    });

    const engine = window.DemoEngine.create({ voice });

    const ui = createUi(engine);
    wireEngineEvents(engine, ui);
    wireKeyboard(engine);
    injectLauncher(ui);

    if (engine.hasSnapshot()) {
      ui.toast.show({
        message: "A previous demo session left a snapshot of your work.",
        primary: { label: "Restore my work", onClick: () => { engine.restoreSnapshot(); ui.toast.hide(); } },
        secondary: { label: "Discard", onClick: () => { try { localStorage.removeItem(window.DemoEngine.SNAPSHOT_KEY); } catch (_) {} ui.toast.hide(); } }
      });
    }

    window.DcDemo = {
      start(track) { return startTrack(engine, ui, track || DEFAULT_TRACK); },
      stop() { engine.exit({ restore: true }); },
      /* Phase 9.8e P5 (2026-05-05): cross-repo audience-picker entry
       * point. Calls window.DemoPicker.open() with onSelect wired to
       * DcDemo.start(). Falls back to starting the default track if
       * the canonical picker module didn't load (graceful degradation
       * — same shape llm-benchmark and cluster-manager use). */
      openLauncher() {
        if (window.DemoPicker && typeof window.DemoPicker.open === "function") {
          window.DemoPicker.open({
            onSelect(audienceId) {
              startTrack(engine, ui, audienceId);
            }
          });
          return;
        }
        if (window.console && console.warn) {
          console.warn("[demo-ui] DemoPicker unavailable; starting default track.");
        }
        startTrack(engine, ui, DEFAULT_TRACK);
      },
      engine,
      voice,
      tracks: REGISTERED_TRACKS.slice(),
      _ui: ui
    };

    autoStartFromUrl(engine, ui);
  }

  /* ── DOM construction ───────────────────────────────────────────── */

  function createUi(engine) {
    ensureCss();

    // Floating control bar — promoted from llm-benchmark/js/dashboard-tutor.js
    // (.tutor-bar) in 2026-05-04 to become the canonical chrome across all
    // 3 sibling consumers. Layout:
    //
    //   [DEMO]  ‹  ⏸  ›   1 / N   |   ↺  🔊  T  |  EXIT
    //
    // The class names keep the legacy `demo-player*` namespace (so existing
    // tests and CSS overrides keep working), but the visual structure /
    // affordances mirror the tutor-bar.
    const player = el("div", { class: "demo-player", role: "toolbar", "aria-label": "Demo Mode controls" });
    player.innerHTML = `
      <span class="demo-player__pill demo-player__pill--demo">DEMO</span>
      <button class="demo-player__btn" data-act="prev" title="Previous step (\u2190)" aria-label="Previous step">\u2039</button>
      <button class="demo-player__btn" data-act="toggle" title="Play / pause (Space)" aria-label="Play or pause">\u23F8</button>
      <button class="demo-player__btn" data-act="next" title="Next step (\u2192)" aria-label="Next step">\u203A</button>
      <span class="demo-player__counter" data-role="counter"><b>1</b> / 1</span>
      <span class="demo-player__divider"></span>
      <button class="demo-player__btn" data-act="restart" title="Restart track (R)" aria-label="Restart track">\u21BA</button>
      <button class="demo-player__btn" data-act="mute" title="Mute voice (M)" aria-label="Mute voice">\uD83D\uDD0A</button>
      <button class="demo-player__btn" data-act="transcript" title="Open assistant panel (T)" aria-label="Open assistant panel"><span class="material-symbols-outlined">chat</span></button>
      <span class="demo-player__divider"></span>
      <button class="demo-player__btn demo-player__btn--exit" data-act="exit" title="Exit demo (Esc)" aria-label="Exit demo">EXIT</button>
    `;
    document.body.appendChild(player);

    const highlight = el("div", { class: "demo-highlight is-hidden", "aria-hidden": "true" });
    document.body.appendChild(highlight);

    const toast = el("div", { class: "demo-toast", role: "status", "aria-live": "polite" });
    document.body.appendChild(toast);

    /* ── Player wiring ───────────────────────────────────────────── */

    player.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "prev") engine.prev();
      else if (act === "next") engine.next();
      else if (act === "toggle") {
        const st = engine.getState();
        if (st.phase === "playing") engine.pause();
        else engine.play();
      }
      else if (act === "restart") {
        if (typeof engine.restart === "function") engine.restart();
      }
      else if (act === "mute") {
        const next = !(typeof engine.isMuted === "function" && engine.isMuted());
        if (typeof engine.setMuted === "function") engine.setMuted(next);
        api.player.setMuted(next);
      }
      else if (act === "transcript") api.narration.openAssistant();
      else if (act === "exit") api.requestExit();
    });

    /* ── API for events to update DOM ────────────────────────────── */

    const api = {
      el: { player, highlight, toast },

      player: {
        show() { player.classList.add("is-visible"); },
        hide() { player.classList.remove("is-visible"); },
        setPhase(phase) {
          const btn = player.querySelector('[data-act="toggle"]');
          if (!btn) return;
          // Unicode glyphs match the tutor-bar look. ⏸ = U+23F8, ▶ = U+25B6.
          btn.textContent = (phase === "playing") ? "\u23F8" : "\u25B6";
          btn.setAttribute("title", (phase === "playing") ? "Pause (Space)" : "Play (Space)");
        },
        // setProgress maps the engine's getProgress() output to the
        // tutor-bar counter "<b>step+1</b> / total". The optional
        // `track`/`scene` title arguments are accepted but no longer
        // rendered in the bar (the transcript header carries that
        // context). Kept in the signature for backward compat.
        setProgress(currentStep, totalSteps /* , trackTitle, sceneTitle */) {
          const counter = player.querySelector('[data-role="counter"]');
          if (!counter) return;
          const cur = Math.max(1, Number(currentStep) || 1);
          const tot = Math.max(cur, Number(totalSteps) || cur);
          counter.innerHTML = "<b>" + cur + "</b> / " + tot;
        },
        // setTitle is kept as a no-op shim so legacy callers don't error
        // (the title now lives in the transcript header, which is
        // updated separately on track:loaded).
        setTitle() { /* moved to the transcript header */ },
        setMuted(flag) {
          const btn = player.querySelector('[data-act="mute"]');
          if (!btn) return;
          if (flag) {
            btn.textContent = "\uD83D\uDD07";   // 🔇 muted
            btn.classList.add("is-active");
            btn.setAttribute("title", "Unmute voice (M)");
          } else {
            btn.textContent = "\uD83D\uDD0A";   // 🔊 voice on
            btn.classList.remove("is-active");
            btn.setAttribute("title", "Mute voice (M)");
          }
        }
      },

      narration: {
        _lastKey: "",
        openAssistant() {
          if (window.ChatOrb && typeof window.ChatOrb.open === "function") {
            try { window.ChatOrb.open(); return true; } catch (_) {}
          }
          if (window.DCChatFeedback && typeof window.DCChatFeedback.open === "function") {
            try { window.DCChatFeedback.open(); return true; } catch (_) {}
          }
          return false;
        },
        post(text, meta) {
          var safe = String(text || "").trim();
          if (!safe) return;
          var key = (meta && meta.sceneIdx != null && meta.stepIdx != null)
            ? (meta.sceneIdx + ":" + meta.stepIdx + ":" + safe)
            : safe;
          if (key === api.narration._lastKey) return;
          api.narration._lastKey = key;
          var msg = "<b>Demo Narration:</b> " + escapeHtml(safe);
          api.narration.openAssistant();
          if (window.ChatOrb && typeof window.ChatOrb.printAi === "function") {
            try { window.ChatOrb.printAi(msg, { html: true }); return; } catch (_) {}
          }
          if (window.DCChatFeedback && typeof window.DCChatFeedback.addMessage === "function") {
            try { window.DCChatFeedback.addMessage(msg, "ai", { html: true }); return; } catch (_) {}
          }
        }
      },

      highlight: {
        showFor(target) {
          const el = resolveHighlightTarget(target);
          if (!el) { api.highlight.clear(); return; }
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) { api.highlight.clear(); return; }
          // Route through the engine's eased scroll so the page motion
          // matches scroll_tour's curve.
          if (engine && engine.scroll && typeof engine.scroll.toElement === "function") {
            engine.scroll.toElement(el, { block: "center", duration_ms: 450, easing: "ease-out" });
          } else {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          api.highlight.aimAt(el);
        },
        // Re-aims the ring to whatever the target's CURRENT bounding rect
        // is, without triggering another scroll. Called by the scroll /
        // resize listener so the ring tracks the element while the page
        // glides into position.
        aimAt(el) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) { api.highlight.clear(); return; }
          highlight.style.top    = (r.top + window.scrollY - 6) + "px";
          highlight.style.left   = (r.left + window.scrollX - 6) + "px";
          highlight.style.width  = (r.width + 12) + "px";
          highlight.style.height = (r.height + 12) + "px";
          highlight.classList.remove("is-hidden");
        },
        clear() {
          highlight.classList.add("is-hidden");
        }
      },

      toast: {
        show({ message, primary, secondary, icon }) {
          toast.innerHTML = "";
          if (icon !== false) {
            const ic = el("span", { class: "material-symbols-outlined demo-toast__icon" });
            ic.textContent = icon || "lightbulb";
            toast.appendChild(ic);
          }
          const txt = el("span"); txt.textContent = message; toast.appendChild(txt);
          if (primary || secondary) {
            const actions = el("div", { class: "demo-toast__actions" });
            if (primary) {
              const b = el("button", { class: "demo-toast__btn demo-toast__btn--primary" });
              b.textContent = primary.label;
              b.addEventListener("click", primary.onClick);
              actions.appendChild(b);
            }
            if (secondary) {
              const b = el("button", { class: "demo-toast__btn" });
              b.textContent = secondary.label;
              b.addEventListener("click", secondary.onClick);
              actions.appendChild(b);
            }
            toast.appendChild(actions);
          }
          toast.classList.add("is-visible");
        },
        hide() { toast.classList.remove("is-visible"); }
      },

      requestExit() {
        const st = engine.getState();
        if (st.phase === "idle") return;
        engine.pause();
        api.toast.show({
          message: "End demo and restore your work?",
          icon: "logout",
          primary: { label: "Restore", onClick: () => { engine.exit({ restore: true }); api.toast.hide(); } },
          secondary: { label: "Keep demo state", onClick: () => { engine.exit({ restore: false }); api.toast.hide(); } }
        });
      }
    };

    return api;
  }

  function resolveHighlightTarget(target) {
    if (!target) return null;
    if (target.hook) return document.querySelector(`[data-agent-hook='${target.hook}']`);
    if (target.context) return document.querySelector(`[data-agent-context='${target.context}']`);
    if (target.selector) return document.querySelector(target.selector);
    return null;
  }

  function ensureCss() {
    if (document.querySelector('link[data-demo-css]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    // Canonical CSS lives next to this script so all 3 sibling consumers
    // resolve the same path from their own pages/<name>.html. Promoted
    // 2026-05-04 from dc-planner/css/demo-mode.css. Consumers that
    // already <link> it explicitly in their HTML can skip the runtime
    // injection — this is a fallback for pages that don't.
    link.href = "../shared/css/demo-mode.css";
    link.dataset.demoCss = "1";
    document.head.appendChild(link);
  }

  function ensureAgentBridge() {
    if (window.agentBridge || window.__agentBridgeLoaded) return;
    if (document.querySelector('script[data-demo-agent-bridge]')) return;
    const s = document.createElement("script");
    s.src = "../js/agent-bridge.js";
    s.defer = true;
    s.dataset.demoAgentBridge = "1";
    document.head.appendChild(s);
  }

  function el(tag, attrs) {
    const node = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ── Engine event wiring ────────────────────────────────────────── */

  function wireEngineEvents(engine, ui) {
    engine.on("track:loaded", function () {
      if (ui && ui.narration) ui.narration._lastKey = "";
    });

    engine.on("phase:changed", ({ phase }) => {
      ui.player.setPhase(phase);
      if (phase === "idle") {
        ui.player.hide();
        ui.highlight.clear();
      } else {
        ui.player.show();
      }
    });

    engine.on("step:enter", ({ sceneIdx, stepIdx }) => {
      const st = engine.getState();
      if (!st.track) return;
      // Prefer the engine's getProgress() helper if available (added
      // 2026-05-04 alongside the tutor-bar promotion); fall back to the
      // local counters for older engine builds.
      let pos, total;
      if (typeof engine.getProgress === "function") {
        const p = engine.getProgress();
        pos = p.totalStep;
        total = p.totalSteps;
      } else {
        pos = stepPosition(st.track, sceneIdx, stepIdx);
        total = countSteps(st.track);
      }
      ui.player.setProgress(pos + 1, total);
    });

    engine.on("narration:start", ({ text, sceneIdx, stepIdx }) => {
      if (ui && ui.narration) ui.narration.post(text, { sceneIdx, stepIdx });
    });

    engine.on("highlight", (target) => {
      // Wait one frame so any preceding scroll/render settles.
      requestAnimationFrame(() => ui.highlight.showFor(target));
    });

    engine.on("highlight:clear", () => ui.highlight.clear());

    engine.on("track:complete", () => {
      ui.toast.show({
        message: "Demo complete.",
        icon: "check_circle",
        primary: { label: "Restore my work", onClick: () => { engine.exit({ restore: true }); ui.toast.hide(); } },
        secondary: { label: "Stay in demo state", onClick: () => { engine.exit({ restore: false }); ui.toast.hide(); } }
      });
    });

    engine.on("error", (err) => {
      console.warn("[demo] engine error:", err);
    });

    let lastTargetEl = null;
    engine.on("highlight", (t) => {
      lastTargetEl = resolveHighlightTarget(t);
    });
    engine.on("highlight:clear", () => { lastTargetEl = null; });
    // Track the ring to its element while the page glides into place,
    // but DO NOT call showFor() (which would start another eased scroll
    // and feed back into this listener). aimAt() is pure position math.
    function reAimHighlight() {
      if (lastTargetEl && document.contains(lastTargetEl)) {
        ui.highlight.aimAt(lastTargetEl);
      }
    }
    window.addEventListener("scroll", reAimHighlight, { passive: true });
    window.addEventListener("resize", reAimHighlight, { passive: true });
  }

  function countSteps(track) {
    if (!track || !Array.isArray(track.scenes)) return 0;
    return track.scenes.reduce((n, s) => n + (s.steps ? s.steps.length : 0), 0);
  }

  function stepPosition(track, sceneIdx, stepIdx) {
    let pos = 0;
    for (let i = 0; i < sceneIdx; i++) pos += (track.scenes[i].steps || []).length;
    return pos + stepIdx;
  }

  /* ── Keyboard ───────────────────────────────────────────────────── */

  function wireKeyboard(engine) {
    document.addEventListener("keydown", (ev) => {
      const st = engine.getState();
      if (st.phase === "idle") return;
      const tag = (ev.target && ev.target.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag) && !ev.ctrlKey && !ev.metaKey) return;
      if (ev.code === "Space") {
        ev.preventDefault();
        if (st.phase === "playing") engine.pause(); else engine.play();
      } else if (ev.code === "ArrowRight") {
        ev.preventDefault(); engine.next();
      } else if (ev.code === "ArrowLeft") {
        ev.preventDefault(); engine.prev();
      } else if (ev.code === "Escape") {
        ev.preventDefault();
        const ui = window.DcDemo && window.DcDemo._ui;
        if (ui && ui.requestExit) ui.requestExit();
      } else if (ev.key && ev.key.toLowerCase() === "t") {
        ev.preventDefault();
        const ui = window.DcDemo && window.DcDemo._ui;
        if (ui && ui.narration && ui.narration.openAssistant) ui.narration.openAssistant();
      } else if (ev.key && ev.key.toLowerCase() === "r") {
        // Restart current track from (0,0) — tutor-bar parity.
        ev.preventDefault();
        if (typeof engine.restart === "function") engine.restart();
      } else if (ev.key && ev.key.toLowerCase() === "m") {
        // Mute / unmute voice — tutor-bar parity.
        ev.preventDefault();
        if (typeof engine.setMuted === "function") {
          const next = !(typeof engine.isMuted === "function" && engine.isMuted());
          engine.setMuted(next);
          const ui = window.DcDemo && window.DcDemo._ui;
          if (ui && ui.player && ui.player.setMuted) ui.player.setMuted(next);
        }
      }
    });
  }

  /* ── Side-nav launcher chip ───────────────────────────────────────
   *
   * Opt-out gate (added 2026-05-04, Phase 9.7.1). When a consumer sets
   *   window.__demoUiSkipLauncher = true
   * BEFORE this script loads, the side-nav launcher chip is NOT
   * injected. Useful for consumers that already surface the demo from
   * other entry points (e.g. dc-planner — `play_circle` button in the
   * chat orb header `#aiDemoBtn`, the `/demo` slash, and the
   * `?demo=presales` URL parameter all start the demo, so the
   * side-nav chip is redundant and visually noisy).
   *
   * Symmetric with the Phase 9.6 `__demoUiSkipAutoBoot` gate above —
   * `__demoUiSkipAutoBoot` suppresses the entire boot (player + chip +
   * keyboard); `__demoUiSkipLauncher` suppresses ONLY the chip while
   * leaving the rest of the canonical engine wired up.
   */

  function injectLauncher(ui) {
    if (window.__demoUiSkipLauncher) return;
    const header = document.querySelector(".side-nav-header");
    if (!header) return;
    if (header.querySelector(".demo-launcher")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "demo-launcher";
    btn.title = "Start the narrated DC-Planner walkthrough";
    btn.innerHTML = '<span class="material-symbols-outlined">play_circle</span><span>Demo</span>';
    btn.addEventListener("click", () => {
      if (window.DcDemo) window.DcDemo.start(DEFAULT_TRACK);
    });
    header.appendChild(btn);
  }

  /* ── Track start helper + URL-param autoload ────────────────────── */

  function startTrack(engine, ui, name) {
    const safe = REGISTERED_TRACKS.includes(name) ? name : DEFAULT_TRACK;
    return engine.loadTrack(safe).then(() => {
      if (ui && ui.narration) ui.narration.openAssistant();
      return engine.play();
    }).catch(err => {
      ui.toast.show({
        message: "Could not load the demo track. Check the console.",
        icon: "error",
        primary: { label: "Dismiss", onClick: () => ui.toast.hide() }
      });
      console.warn("[demo-ui] track start failed:", err);
    });
  }

  function autoStartFromUrl(engine, ui) {
    const params = new URLSearchParams(window.location.search);
    const want = params.get("demo");
    if (!want) return;
    const autoplay = params.get("autoplay") !== "0";
    engine.loadTrack(want).then(() => {
      if (ui && ui.narration) ui.narration.openAssistant();
      if (autoplay) engine.play();
    }).catch(err => console.warn("[demo-ui] URL-param load failed:", err));
  }
})();
