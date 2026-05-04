/*!
 * shared-ui canonical asset: demo-engine.js
 *
 * PROMOTED in harmonization Phase 5.1 — was gpu-planner/js/demo-engine.js,
 * now the single source of truth for the narrated-demo state machine
 * across all 3 sibling consumers. Loaded as `../shared/js/demo-engine.js`.
 *
 * Domain coupling notes for downstream consumers:
 *   - The engine talks to the dashboard via `window.agentBridge`. Each
 *     consumer must ship its own `js/agent-bridge.js` exposing the same
 *     RPC surface (navigate / set_field / click / get_state / set_state)
 *     for the engine's actions to land.
 *   - The `SNAPSHOT_KEYS` array below is dc-planner-specific (rack /
 *     scenarios / pricing-tab keys). The keys use the `dc-planner-*`
 *     prefix that landed with dc-planner's gpu-planner → dc-planner
 *     rebrand (2026-05-03); cluster-manager and llm-benchmark have their
 *     own `js/demo-bridge.js` that mounts this engine and would pass
 *     consumer-specific keys via a future `DemoEngine.create({ snapshotKeys: [...] })`
 *     override hook (not yet implemented — defaults are dc-planner's).
 *   - Track JSON files live in each consumer's own `data/demo-tracks/`
 *     directory (the canonical schema is documented in
 *     `shared-ui/docs/templates/demo-track.schema.json`).
 *
 * --- (original header below) ---
 *
 * Demo Engine
 *
 * State machine + action executor that drives the cockpit through a
 * declarative track of scenes and steps. The engine never targets
 * private DOM directly — it goes through window.agentBridge whenever
 * possible (navigate / set_field / click / get_state / set_state) so
 * every demo step exercises the same agent-native surface a real LLM
 * orchestrator would call. See /docs/DEMO.md for the design rationale.
 *
 * Public API: window.DemoEngine.create(opts) → instance.
 *
 *   loadTrack(name)       — fetch /data/demo-tracks/<name>.json
 *   play()                — resume / start playback
 *   pause()               — pause speech + timers
 *   next() / prev()       — manual scrub
 *   goTo(scene, step)     — jump to specific position
 *   exit({ restore })     — stop, restore user state if requested
 *   on(event, fn)         — subscribe to engine events
 *   getState()            — { phase, sceneIdx, stepIdx, track }
 *
 * Events: track:loaded, track:complete, scene:enter, step:enter,
 * step:exit, narration:start, narration:end, narration:boundary,
 * action:executed, phase:changed, error.
 */
(function () {
  "use strict";

  const SNAPSHOT_KEY = "dc-planner-demo-snapshot";

  /* ── Tiny event bus ─────────────────────────────────────────────── */

  function makeBus() {
    const handlers = new Map();
    return {
      on(event, fn) {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event).add(fn);
        return () => handlers.get(event).delete(fn);
      },
      emit(event, payload) {
        const set = handlers.get(event);
        if (!set) return;
        set.forEach(fn => {
          try { fn(payload); }
          catch (e) { console.warn("[demo] handler error:", event, e); }
        });
      }
    };
  }

  /* ── Bridge helpers (lazy resolution; bridge is SW-injected) ────── */

  function getBridge() {
    return window.agentBridge || window.mcpBridge || null;
  }

  function bridgeCall(method, params) {
    const b = getBridge();
    if (!b) return { error: "agent bridge not loaded" };
    try { return b.call(method, params || {}); }
    catch (e) { return { error: String(e && e.message || e) }; }
  }

  function findHookEl(hook) {
    return document.querySelector(`[data-agent-hook='${hook}']`);
  }

  function findContextEl(id) {
    return document.querySelector(`[data-agent-context='${id}']`);
  }

  // Reverse of agent-bridge.js' resolveTabName alias map. Used when the
  // bridge isn't loaded (e.g. SW hasn't activated yet on first run) and
  // we need to find the side-nav button by its raw data-tab attribute.
  const TAB_SLUG_TO_DATATAB = {
    "node":         "config",
    "architecture": "arch",
    "networking":   "net",
    "data-center":  "dc"
  };

  function clickTabFallback(target) {
    // Try `data-agent-tab` first (set by the bridge after decoration),
    // then fall back to the raw `data-tab` attribute on the side-nav
    // buttons that exists in index.html source even before the bridge
    // has run.
    let el = document.querySelector(`[data-agent-tab='${target}']`);
    if (!el) {
      const raw = TAB_SLUG_TO_DATATAB[target] || target;
      el = document.querySelector(`.side-nav-tab[data-tab='${raw}']`)
        || document.querySelector(`.hero-tabs [data-tab='${raw}']`)
        || document.querySelector(`[data-tab='${raw}']`);
    }
    if (!el) return { ok: false, reason: "tab-not-found", target };
    el.click();
    return { ok: true, via: "dom-fallback", target };
  }

  /* ── Snapshot & restore ─────────────────────────────────────────── */

  // Keys we capture so a demo can mutate the cockpit and we can put
  // the user back exactly where they were on exit.
  const SNAPSHOT_KEYS = [
    "dc-planner-state",
    "pricing-active-tab",
    "dc-planner-scenarios",
    "dc-planner-tco-mode",
    "dc-planner-rack-types",
    "dc-planner-annotations",
    "dc-planner-discovery-v1"
  ];

  function takeSnapshot() {
    const snap = { takenAt: new Date().toISOString(), keys: {} };
    SNAPSHOT_KEYS.forEach(k => {
      try { snap.keys[k] = localStorage.getItem(k); } catch (_) { /* noop */ }
    });
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap)); }
    catch (e) { console.warn("[demo] snapshot save failed:", e); }
    return snap;
  }

  function restoreSnapshot() {
    let snap = null;
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return false;
      snap = JSON.parse(raw);
    } catch (e) {
      console.warn("[demo] snapshot parse failed:", e);
      return false;
    }
    if (!snap || !snap.keys) return false;
    Object.entries(snap.keys).forEach(([k, v]) => {
      try {
        if (v === null || v === undefined) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      } catch (_) { /* noop */ }
    });
    try { localStorage.removeItem(SNAPSHOT_KEY); } catch (_) { /* noop */ }
    // Replay the planner state into live DOM so the user sees their
    // own work, not the demo's residue.
    try {
      const raw = snap.keys["gpu-planner-state"];
      if (raw && typeof window.__dcPlannerSetState === "function") {
        window.__dcPlannerSetState(JSON.parse(raw));
      }
    } catch (e) { console.warn("[demo] state replay failed:", e); }
    return true;
  }

  function hasSnapshot() {
    try { return !!localStorage.getItem(SNAPSHOT_KEY); }
    catch (_) { return false; }
  }

  /* ── Action executor ────────────────────────────────────────────── */

  // Returns a Promise that resolves when the action has completed
  // enough that the next action / narration can begin. Each verb is
  // intentionally conservative — visible side-effects only.
  function executeAction(action, ctx) {
    if (!action || typeof action.type !== "string") {
      return Promise.resolve({ ok: false, reason: "bad-action" });
    }
    switch (action.type) {

      case "switch_tab":
      case "navigate": {
        const target = action.target || action.hook || action.tab;
        let res = bridgeCall("navigate", { target });
        let via = "agent-bridge.navigate";
        // The agent-bridge is service-worker-injected; on first page
        // load before the SW activates, window.agentBridge doesn't
        // exist yet and the bridge call returns an error. Fall back to
        // a direct side-nav click so the demo always navigates.
        if (!res || res.error) {
          res = clickTabFallback(target);
          via = "dom-fallback";
        }
        return wait(action.settle_ms || 200).then(() => ({
          ok: !res || !res.error,
          via,
          target,
          bridgeResult: res
        }));
      }

      case "highlight": {
        ctx.bus.emit("highlight", {
          selector: action.selector || null,
          hook: action.hook || null,
          context: action.context || null,
          mode: action.mode || "ring"
        });
        return wait(action.settle_ms || 0).then(() => ({ ok: true }));
      }

      case "clear_highlight": {
        ctx.bus.emit("highlight:clear");
        return Promise.resolve({ ok: true });
      }

      case "fill":
      case "set_field": {
        const hook = action.hook;
        if (!hook) return Promise.resolve({ ok: false, reason: "missing-hook" });
        const res = bridgeCall("set_field", { hook, value: action.value });
        return wait(action.settle_ms || 120).then(() => ({
          ok: !res || !res.error,
          bridgeResult: res
        }));
      }

      // set_state — call agent-bridge.set_state with arbitrary params
      // (e.g. dashboard mode, persona id). Distinct from `load_scenario`,
      // which fetches a pre-staged scenario JSON from a URL.
      case "set_state": {
        const params = action.params || {};
        const res = bridgeCall("set_state", params);
        return wait(action.settle_ms || 120).then(() => ({
          ok: !res || !res.error,
          bridgeResult: res
        }));
      }

      // expect / assert — regression-harness primitives. Resolve as
      // no-op success when no harness is wired so live demo runs are
      // not blocked. A future regression harness can subscribe to the
      // engine's bus and hook into these to verify post-conditions.
      case "expect":
      case "assert": {
        ctx.bus.emit("assert", {
          type: action.type,
          expect: action.expect || null,
          hook: action.hook || null
        });
        return Promise.resolve({ ok: true, harness: "noop" });
      }

      case "click": {
        if (action.hook) {
          const res = bridgeCall("click", { hook: action.hook });
          return wait(action.settle_ms || 200).then(() => ({
            ok: !res || !res.error,
            bridgeResult: res
          }));
        }
        if (action.selector) {
          const el = document.querySelector(action.selector);
          if (!el) return Promise.resolve({ ok: false, reason: "no-element" });
          el.click();
          return wait(action.settle_ms || 200).then(() => ({ ok: true }));
        }
        return Promise.resolve({ ok: false, reason: "missing-target" });
      }

      case "scroll_to": {
        let el = null;
        if (action.hook) el = findHookEl(action.hook);
        else if (action.context) el = findContextEl(action.context);
        else if (action.selector) el = document.querySelector(action.selector);
        if (!el) return Promise.resolve({ ok: false, reason: "no-element" });
        // Use the engine's eased scroll instead of the browser's native
        // smooth-scroll so motion is consistent with scroll_tour and we
        // don't fight Chromium's heavier easing curve.
        const tour = easedScrollToElement(el, {
          block: action.block || "center",
          duration_ms: action.duration_ms || 700,
          easing: action.easing || "ease-in-out"
        });
        if (ctx && typeof ctx.registerScrollTour === "function") ctx.registerScrollTour(tour);
        return tour.promise.then((r) => {
          if (ctx && typeof ctx.clearScrollTour === "function") ctx.clearScrollTour(tour);
          return wait(action.settle_ms || 80).then(() => Object.assign({ ok: true }, r));
        });
      }

      case "wait":
        return wait(action.ms || 500).then(() => ({ ok: true }));

      case "scroll_tour": {
        const tour = startScrollTour({
          from: action.from,
          to: action.to || "bottom",
          duration_ms: action.duration_ms || 6000,
          easing: action.easing || "ease-in-out",
          pause_at_end_ms: action.pause_at_end_ms || 0
        });
        // Register cancel handle so engine.pause() / exit() can stop it.
        if (ctx && typeof ctx.registerScrollTour === "function") {
          ctx.registerScrollTour(tour);
        }
        if (action.parallel) {
          // Don't await: narration will speak while the scroll continues.
          tour.promise.then(() => {
            if (ctx && typeof ctx.clearScrollTour === "function") ctx.clearScrollTour(tour);
          });
          return Promise.resolve({ ok: true, parallel: true });
        }
        return tour.promise.then((r) => {
          if (ctx && typeof ctx.clearScrollTour === "function") ctx.clearScrollTour(tour);
          return r;
        });
      }

      case "load_scenario": {
        const url = action.url;
        if (!url) return Promise.resolve({ ok: false, reason: "missing-url" });
        return fetch(url, { credentials: "omit" })
          .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
          .then(scenario => {
            const res = bridgeCall("set_state", { state: scenario });
            return { ok: !res || !res.error, bridgeResult: res };
          })
          .catch(err => ({ ok: false, reason: String(err && err.message || err) }));
      }

      default:
        return Promise.resolve({ ok: false, reason: "unknown-action:" + action.type });
    }
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /* ── Smooth scroll primitives ───────────────────────────────────────
   *
   *   easedScrollTo(targetY, opts)         → core RAF + cubic easing
   *   easedScrollToElement(el, opts)       → centre/start/end an element
   *   findActivePanelBottom()              → bottom of the active tab
   *                                          panel, ignoring footers
   *   startScrollTour(opts)                → top→bottom (or any y→y) tab
   *                                          tour for scene openers
   *
   * All three return { promise, cancel } so the engine can stop them on
   * pause / exit / step-advance. They share the same easing curves
   * (`linear`, `ease-in`, `ease-out`, `ease-in-out`) so every page-level
   * scroll the audience sees feels like the same camera. Honour
   * `prefers-reduced-motion` by snapping to the destination instantly.
   * ─────────────────────────────────────────────────────────────── */

  function maxScrollY() {
    return Math.max(
      0,
      (document.documentElement.scrollHeight || 0) - window.innerHeight
    );
  }

  function findActivePanelBottom() {
    // Prefer an explicitly-active tab panel so we stop where the tab
    // content ends, not where the document's footer ends. Looks for
    // (in order): aria-pressed pricing tab, .pricing-tab-panel.active,
    // [role=tabpanel].active, .tab-panel.active, .tab-content.active.
    const candidates = [
      document.querySelector("[role='tabpanel']:not([hidden])"),
      document.querySelector(".tab-panel.active, .pricing-tab-panel.active, .tab-content.active"),
      document.querySelector("[data-pricing-tab].active, [data-pricing-tab][aria-selected='true']")
    ].filter(Boolean);
    if (!candidates.length) return maxScrollY();
    const panel = candidates[0];
    const rect = panel.getBoundingClientRect();
    const panelBottom = rect.bottom + window.scrollY;
    // Subtract one viewport so the bottom edge sits at the bottom of
    // the visible area (not below the fold).
    return Math.max(0, Math.min(maxScrollY(), panelBottom - window.innerHeight + 24));
  }

  function easeFnFor(name) {
    switch (name) {
      case "linear":     return (t) => t;
      case "ease-in":    return (t) => t * t * t;
      case "ease-out":   return (t) => 1 - Math.pow(1 - t, 3);
      case "ease-in-out":
      default:
        return (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    }
  }

  // ~3 ms per CSS pixel of travel feels like a slow, watchable pan;
  // clamp so very short distances aren't instantaneous and very long
  // tabs (5K+ px in Expert mode) don't drag past attention budget.
  function autoDurationMs(distancePx, opts) {
    const o = opts || {};
    const minMs = o.min_ms || 4000;
    const maxMs = o.max_ms || 12000;
    const msPerPx = o.ms_per_px || 3;
    return Math.round(Math.max(minMs, Math.min(maxMs, Math.abs(distancePx) * msPerPx)));
  }

  function easedScrollTo(targetY, opts) {
    const o = Object.assign({ duration_ms: 700, easing: "ease-in-out", pause_at_end_ms: 0 }, opts || {});
    const reduced = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const startY = window.scrollY;
    const clamped = Math.max(0, Math.min(maxScrollY(), Number(targetY) || 0));

    if (Math.abs(clamped - startY) < 4 || reduced) {
      window.scrollTo(0, clamped);
      return {
        promise: Promise.resolve({
          ok: true,
          skipped: reduced ? "reduced-motion" : "no-distance",
          finalY: clamped
        }),
        cancel: () => {}
      };
    }

    const dur = (o.duration_ms === "auto")
      ? autoDurationMs(clamped - startY, o)
      : Math.max(60, Number(o.duration_ms) || 700);
    const ease = easeFnFor(o.easing);
    const startTime = performance.now();
    let rafId = null;
    let cancelled = false;

    const promise = new Promise((resolve) => {
      function tick(now) {
        if (cancelled) { resolve({ ok: false, reason: "cancelled", finalY: window.scrollY }); return; }
        const t = Math.min((now - startTime) / dur, 1);
        window.scrollTo(0, startY + (clamped - startY) * ease(t));
        if (t < 1) {
          rafId = requestAnimationFrame(tick);
        } else if (o.pause_at_end_ms > 0) {
          setTimeout(() => resolve({ ok: true, finalY: clamped }), o.pause_at_end_ms);
        } else {
          resolve({ ok: true, finalY: clamped });
        }
      }
      rafId = requestAnimationFrame(tick);
    });

    return {
      promise,
      cancel: () => { cancelled = true; if (rafId !== null) cancelAnimationFrame(rafId); }
    };
  }

  function easedScrollToElement(el, opts) {
    const o = Object.assign({ block: "center", duration_ms: 700, easing: "ease-in-out" }, opts || {});
    const rect = el.getBoundingClientRect();
    const elTop = rect.top + window.scrollY;
    const vh = window.innerHeight;
    let target;
    if (o.block === "start")      target = elTop - 24;
    else if (o.block === "end")   target = elTop + rect.height - vh + 24;
    else                          target = elTop - (vh - rect.height) / 2;
    return easedScrollTo(target, o);
  }

  function startScrollTour(opts) {
    const o = Object.assign({
      to: "bottom",
      from: null,
      duration_ms: 6000,
      easing: "ease-in-out",
      pause_at_end_ms: 0
    }, opts || {});

    function destFor(target) {
      if (target === "top")          return 0;
      if (target === "bottom")       return maxScrollY();
      if (target === "panel-bottom") return findActivePanelBottom();
      const n = Number(target);
      return Number.isFinite(n) ? n : 0;
    }

    const startY = (o.from === null || o.from === undefined)
      ? window.scrollY
      : destFor(o.from);
    const endY = destFor(o.to);

    // Snap to startY first so the animation begins from the right
    // place when the author specified `from: "top"` after a tab
    // switch left the page mid-scroll.
    if (Math.abs(window.scrollY - startY) > 1) {
      window.scrollTo(0, startY);
    }

    return easedScrollTo(endY, {
      duration_ms: o.duration_ms,
      easing: o.easing,
      pause_at_end_ms: o.pause_at_end_ms,
      min_ms: o.min_ms,
      max_ms: o.max_ms,
      ms_per_px: o.ms_per_px
    });
  }

  /* ── Engine factory ─────────────────────────────────────────────── */

  function create(opts) {
    const cfg = Object.assign({
      tracksBaseUrl: "../data/demo-tracks/",
      voice: null,        // expected: window.DemoVoice.create(...) instance
      onError: null
    }, opts || {});

    const bus = makeBus();
    const activeScrollTours = new Set();
    const ctx = {
      bus,
      registerScrollTour(tour) { activeScrollTours.add(tour); },
      clearScrollTour(tour) { activeScrollTours.delete(tour); }
    };

    let track = null;
    let sceneIdx = 0;
    let stepIdx = 0;
    let phase = "idle"; // idle | playing | paused | complete
    let currentSpeechCancel = null;
    let cancelRequested = false;

    function cancelAllScrollTours() {
      activeScrollTours.forEach(t => { try { t.cancel(); } catch (_) { /* noop */ } });
      activeScrollTours.clear();
    }

    function setPhase(next) {
      if (phase === next) return;
      phase = next;
      bus.emit("phase:changed", { phase });
    }

    function getState() {
      return { phase, sceneIdx, stepIdx, track };
    }

    /* ── Track loading ──────────────────────────────────────────── */

    function loadTrack(name) {
      const url = cfg.tracksBaseUrl + encodeURIComponent(name) + ".json";
      return fetch(url, { credentials: "omit" })
        .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
        .then(json => {
          track = json;
          sceneIdx = 0;
          stepIdx = 0;
          bus.emit("track:loaded", { track });
          return track;
        })
        .catch(err => {
          const msg = String(err && err.message || err);
          bus.emit("error", { stage: "load-track", message: msg });
          throw err;
        });
    }

    /* ── Playback loop ──────────────────────────────────────────── */

    function play() {
      if (!track) return Promise.reject(new Error("no track loaded"));
      if (phase === "playing") return Promise.resolve();
      if (phase === "paused" && cfg.voice && cfg.voice.isSpeaking()) {
        cfg.voice.resume();
        setPhase("playing");
        return Promise.resolve();
      }
      // Snapshot only on the very first play (idle → playing).
      if (phase === "idle" && !hasSnapshot()) {
        takeSnapshot();
      }
      cancelRequested = false;
      setPhase("playing");
      return runFromCurrent();
    }

    function pause() {
      if (phase !== "playing") return;
      if (cfg.voice) cfg.voice.pause();
      // Stop any in-flight scroll tour so the page doesn't keep
      // scrolling after the audience clicks pause.
      cancelAllScrollTours();
      setPhase("paused");
    }

    function next() {
      if (!track) return;
      cancelCurrentSpeech();
      const moved = advanceCursor();
      if (!moved) {
        finalize();
        return;
      }
      bus.emit("step:enter", { sceneIdx, stepIdx });
      if (phase === "playing") runFromCurrent();
    }

    function prev() {
      if (!track) return;
      cancelCurrentSpeech();
      retreatCursor();
      bus.emit("step:enter", { sceneIdx, stepIdx });
      if (phase === "playing") runFromCurrent();
    }

    function goTo(targetScene, targetStep) {
      if (!track) return;
      cancelCurrentSpeech();
      sceneIdx = clampSceneIdx(targetScene);
      stepIdx = clampStepIdx(sceneIdx, targetStep || 0);
      bus.emit("step:enter", { sceneIdx, stepIdx });
      if (phase === "playing") runFromCurrent();
    }

    // restart() rewinds the cursor to (0,0) and resumes the prior phase.
    // Used by the player chrome's "Restart" affordance (R key / button)
    // so a presenter can re-run the same track without reloading.
    function restart() {
      if (!track) return;
      const wasPlaying = phase === "playing";
      cancelCurrentSpeech();
      sceneIdx = 0;
      stepIdx = 0;
      bus.emit("step:enter", { sceneIdx, stepIdx });
      if (wasPlaying) runFromCurrent();
    }

    // setMuted(bool) — pass-through to the voice provider. The engine's
    // playback loop is unaffected; muted speech still resolves so steps
    // advance in time. Returns the new muted state, or false when no
    // voice provider is wired.
    function setMuted(flag) {
      if (cfg.voice && typeof cfg.voice.setMuted === "function") {
        return cfg.voice.setMuted(flag);
      }
      return false;
    }

    function isMuted() {
      if (cfg.voice && typeof cfg.voice.isMuted === "function") {
        return cfg.voice.isMuted();
      }
      return false;
    }

    // Scene-level + step-level position helper for the player chrome's
    // counter ("Scene 1 / 5" or "1 / 18"). The UI is free to render
    // either dimension; we expose both.
    function getProgress() {
      if (!track || !Array.isArray(track.scenes)) {
        return { sceneIdx: 0, sceneCount: 0, stepIdx: 0, stepsInScene: 0, totalStep: 0, totalSteps: 0 };
      }
      const sceneCount = track.scenes.length;
      const scene = track.scenes[sceneIdx];
      const stepsInScene = (scene && scene.steps && scene.steps.length) || 0;
      let totalStep = 0;
      for (let i = 0; i < sceneIdx; i++) {
        totalStep += (track.scenes[i].steps || []).length;
      }
      totalStep += stepIdx;
      let totalSteps = 0;
      for (let i = 0; i < sceneCount; i++) {
        totalSteps += (track.scenes[i].steps || []).length;
      }
      return { sceneIdx, sceneCount, stepIdx, stepsInScene, totalStep, totalSteps };
    }

    function exit(options) {
      const opts = Object.assign({ restore: true }, options || {});
      cancelRequested = true;
      cancelCurrentSpeech();
      if (opts.restore) restoreSnapshot();
      else { try { localStorage.removeItem(SNAPSHOT_KEY); } catch (_) { /* noop */ } }
      bus.emit("highlight:clear");
      setPhase("idle");
      bus.emit("track:exited", { restored: !!opts.restore });
    }

    function cancelCurrentSpeech() {
      if (cfg.voice) cfg.voice.cancel();
      if (typeof currentSpeechCancel === "function") {
        try { currentSpeechCancel(); } catch (_) { /* noop */ }
      }
      currentSpeechCancel = null;
      cancelAllScrollTours();
    }

    function clampSceneIdx(i) {
      if (!track || !Array.isArray(track.scenes)) return 0;
      return Math.max(0, Math.min(track.scenes.length - 1, i || 0));
    }

    function clampStepIdx(sIdx, stepI) {
      const scene = track && track.scenes && track.scenes[sIdx];
      if (!scene || !Array.isArray(scene.steps)) return 0;
      return Math.max(0, Math.min(scene.steps.length - 1, stepI || 0));
    }

    function advanceCursor() {
      if (!track) return false;
      const scene = track.scenes[sceneIdx];
      if (!scene) return false;
      if (stepIdx + 1 < scene.steps.length) { stepIdx += 1; return true; }
      if (sceneIdx + 1 < track.scenes.length) {
        sceneIdx += 1; stepIdx = 0;
        bus.emit("scene:enter", { sceneIdx });
        return true;
      }
      return false;
    }

    function retreatCursor() {
      if (!track) return;
      if (stepIdx > 0) { stepIdx -= 1; return; }
      if (sceneIdx > 0) {
        sceneIdx -= 1;
        const prevScene = track.scenes[sceneIdx];
        stepIdx = (prevScene && prevScene.steps.length - 1) || 0;
        bus.emit("scene:enter", { sceneIdx });
        return;
      }
      stepIdx = 0;
    }

    function finalize() {
      cancelCurrentSpeech();
      bus.emit("highlight:clear");
      setPhase("complete");
      bus.emit("track:complete", { track });
    }

    function runFromCurrent() {
      if (!track) return Promise.resolve();
      const scene = track.scenes[sceneIdx];
      if (!scene) { finalize(); return Promise.resolve(); }
      const step = scene.steps[stepIdx];
      if (!step) { finalize(); return Promise.resolve(); }

      // Stop any parallel scroll tour from the previous step before
      // its successor's highlight/scrollIntoView actions take over.
      cancelAllScrollTours();

      bus.emit("scene:enter", { sceneIdx });
      bus.emit("step:enter", { sceneIdx, stepIdx });

      // 1. Optional auto switch_tab on scene entry (only if first step
      //    and scene has a tab attribute and current step doesn't
      //    already include a switch_tab action).
      const actions = Array.isArray(step.actions) ? step.actions.slice() : [];
      const isSceneOpener = stepIdx === 0;
      const explicitSwitch = actions.some(a => a && a.type === "switch_tab");
      if (isSceneOpener && scene.tab && !explicitSwitch) {
        actions.unshift({ type: "switch_tab", target: scene.tab });
      }

      const runActions = actions.reduce((p, action) => {
        return p.then(() => {
          if (cancelRequested || phase === "paused") return null;
          return executeAction(action, ctx).then(result => {
            bus.emit("action:executed", { action, result });
            return result;
          });
        });
      }, Promise.resolve());

      return runActions.then(() => {
        if (cancelRequested) return;
        if (phase === "paused") return;

        const text = (step.narration || "").trim();
        if (!text) {
          // No narration on this step — small breath then advance.
          return wait(step.pause_after_ms || 600).then(() => autoAdvance());
        }
        bus.emit("narration:start", { text, sceneIdx, stepIdx });
        if (!cfg.voice) {
          // Voice unsupported — display-only mode: short pause sized
          // to reading time (~14 chars/sec ≈ 140 wpm).
          const fallbackMs = Math.max(2500, Math.min(20000, Math.round(text.length / 14 * 1000)));
          return wait(fallbackMs).then(() => {
            bus.emit("narration:end", { text, sceneIdx, stepIdx });
            return autoAdvance();
          });
        }
        return cfg.voice.speak(text).then(res => {
          bus.emit("narration:end", { text, sceneIdx, stepIdx, result: res });
          if (cancelRequested || phase !== "playing") return;
          return wait(step.pause_after_ms || (track.voice && track.voice.step_pause_ms) || 700)
            .then(() => autoAdvance());
        });
      }).catch(err => {
        bus.emit("error", { stage: "run-step", message: String(err && err.message || err) });
        if (typeof cfg.onError === "function") cfg.onError(err);
      });
    }

    function autoAdvance() {
      if (cancelRequested || phase !== "playing") return;
      const moved = advanceCursor();
      if (!moved) { finalize(); return; }
      return runFromCurrent();
    }

    /* ── Wire voice → bus passthrough ───────────────────────────── */

    if (cfg.voice && typeof cfg.voice.onBoundary === "function") {
      cfg.voice.onBoundary((charIndex, text) => {
        bus.emit("narration:boundary", { charIndex, text, sceneIdx, stepIdx });
      });
    }

    return {
      loadTrack,
      play,
      pause,
      next,
      prev,
      goTo,
      restart,
      setMuted,
      isMuted,
      getProgress,
      exit,
      on: bus.on,
      getState,
      hasSnapshot,
      restoreSnapshot,
      // Shared eased-scroll surface so demo-ui.js (and any consumer)
      // uses the same RAF + cubic easing as scroll_tour, instead of the
      // browser's native `scrollIntoView({behavior:"smooth"})` which
      // has a heavier curve.
      scroll: {
        to:        easedScrollTo,
        toElement: easedScrollToElement,
        panelBottom: findActivePanelBottom,
        autoDurationMs
      },
      // Test seam
      _executeAction: executeAction,
      _bus: bus
    };
  }

  window.DemoEngine = { create, SNAPSHOT_KEY };
})();
