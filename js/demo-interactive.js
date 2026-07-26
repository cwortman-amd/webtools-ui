/* eslint-disable */
/* ─────────────────────────────────────────────────────────────────
 * webtools-ui · Interactive Narration
 *
 * Turns the passive narrated Demo Mode into a two-way experience: while a
 * module's narration is playing, the operator can push-to-talk to ask a
 * question or give feedback. The controller:
 *
 *   1. pauses the walkthrough (DemoEngine.pause + stops any TTS),
 *   2. captures speech  — LocalVoice (whisper.cpp) if available, else the
 *      browser Web Speech bridge (window.voiceBridge),
 *   3. answers via the existing LLM agent (window.chatLLM.handle), grounded in
 *      the CURRENT module/scene/step context from DemoEngine.getState(),
 *   4. shows the answer in the chat orb and speaks it back — LocalVoice
 *      (Piper) if available, else Web Speech,
 *   5. auto-resumes the walkthrough from where it paused.
 *
 * Everything degrades: no mic / no STT → prompts the user to type in the orb;
 * LLM disabled → explains how to enable it; no on-device voice → Web Speech.
 *
 * Public API — window.InteractiveNarration:
 *   init()            — idempotent; wires the floating push-to-talk control
 *   ask()             — begin a question turn programmatically
 *   isBusy()          — true while listening/answering
 * ─────────────────────────────────────────────────────────────── */
(function (global) {
  "use strict";

  var STATE = { IDLE: "idle", LISTENING: "listening", THINKING: "thinking" };
  var _state = STATE.IDLE;
  var _btn = null;
  var _inited = false;
  var _syncTimer = null;
  var _engine = null;        // DemoEngine instance (DcDemo.engine), once present
  var _captureMode = null;   // "local" | "bridge"
  var _bridgeResolve = null; // pending onTranscript resolver for voiceBridge

  function _doc() { return global.document; }

  /* ── dependency probes ──────────────────────────────────────── */
  function _demo() { return global.DcDemo || global.SharedDemo || null; }
  function _getEngine() {
    var d = _demo();
    return (d && d.engine) ? d.engine : null;
  }
  function _orb() { return global.ChatOrb || null; }
  function _llm() { return global.chatLLM || null; }
  function _bridge() { return global.voiceBridge || global.SharedVoice || null; }
  function _local() { return global.LocalVoice || null; }

  function isBusy() { return _state !== STATE.IDLE; }

  /* ── UI: floating push-to-talk button ───────────────────────── */
  function _ensureButton() {
    if (_btn || !_doc()) return _btn;
    var b = _doc().createElement("button");
    b.id = "demoAskBtn";
    b.type = "button";
    b.className = "demo-ask-btn";
    b.setAttribute("aria-label", "Ask about this step");
    b.title = "Ask about this step (pauses the walkthrough)";
    b.innerHTML = '<span class="demo-ask-ico" aria-hidden="true">🎙️</span>'
                + '<span class="demo-ask-label">Ask</span>';
    b.hidden = true;
    b.addEventListener("click", _onClick);
    _doc().body.appendChild(b);
    _injectStyles();
    _btn = b;
    return b;
  }

  function _injectStyles() {
    if (!_doc() || _doc().getElementById("demo-ask-style")) return;
    var css = ""
      + ".demo-ask-btn{position:fixed;right:20px;bottom:96px;z-index:3550;"
      + "display:inline-flex;align-items:center;gap:8px;padding:10px 16px;"
      + "border:none;border-radius:999px;cursor:pointer;font:600 13px/1 system-ui,sans-serif;"
      + "color:#fff;background:#2563eb;box-shadow:0 4px 14px rgba(0,0,0,.25);"
      + "transition:background .15s,transform .1s}"
      + ".demo-ask-btn:hover{transform:translateY(-1px)}"
      + ".demo-ask-btn.is-listening{background:#dc2626;animation:demoAskPulse 1.2s infinite}"
      + ".demo-ask-btn.is-thinking{background:#6b7280;cursor:default}"
      + "@keyframes demoAskPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}"
      + "50%{box-shadow:0 0 0 10px rgba(220,38,38,0)}}";
    var s = _doc().createElement("style");
    s.id = "demo-ask-style";
    s.textContent = css;
    _doc().head.appendChild(s);
  }

  function _setState(next) {
    _state = next;
    if (!_btn) return;
    _btn.classList.toggle("is-listening", next === STATE.LISTENING);
    _btn.classList.toggle("is-thinking", next === STATE.THINKING);
    var label = _btn.querySelector(".demo-ask-label");
    if (label) {
      label.textContent = next === STATE.LISTENING ? "Stop"
                        : next === STATE.THINKING ? "Thinking…" : "Ask";
    }
  }

  function _showButton(show) {
    _ensureButton();
    if (_btn) _btn.hidden = !show;
  }

  /* ── show/hide the control based on demo phase ──────────────── */
  function _syncVisibility() {
    var eng = _getEngine();
    if (eng && eng !== _engine) { _engine = eng; }
    if (!eng || typeof eng.getState !== "function") { _showButton(false); return; }
    var phase = "";
    try { phase = (eng.getState() || {}).phase || ""; } catch (_) {}
    // Visible while a walkthrough is running or already paused for Q&A.
    _showButton(phase === "playing" || phase === "paused" || isBusy());
  }

  /* ── speech capture (local whisper → bridge Web Speech) ─────── */
  function _captureStart() {
    var lv = _local();
    if (lv && lv.sttAvailable && lv.sttAvailable()) {
      _captureMode = "local";
      return lv.startListening();
    }
    var vb = _bridge();
    if (vb && (!vb.isSupported || vb.isSupported())) {
      _captureMode = "bridge";
      return new Promise(function (resolve, reject) {
        _bridgeResolve = resolve;
        try {
          if (typeof vb.onTranscript === "function") {
            vb.onTranscript(function (text, isFinal) {
              if (isFinal && _bridgeResolve) { var r = _bridgeResolve; _bridgeResolve = null; r(String(text || "")); }
            });
          }
          vb.start();
        } catch (e) { reject("capture-error"); }
      });
    }
    return Promise.reject("no-stt");
  }

  function _captureStop() {
    if (_captureMode === "local") {
      var lv = _local();
      return lv ? lv.stopListening() : Promise.reject("no-stt");
    }
    if (_captureMode === "bridge") {
      var vb = _bridge();
      // The transcript arrives asynchronously via the onTranscript hook set in
      // _captureStart; give it a short grace window after stop().
      return new Promise(function (resolve) {
        var settled = false;
        var prev = _bridgeResolve;
        _bridgeResolve = function (t) { settled = true; resolve(t); };
        try { if (vb) vb.stop(); } catch (_) {}
        setTimeout(function () {
          if (!settled) {
            _bridgeResolve = null;
            var last = (vb && typeof vb.lastTranscript === "function") ? vb.lastTranscript() : "";
            resolve(String(last || ""));
          }
        }, 1500);
        void prev;
      });
    }
    return Promise.reject("no-stt");
  }

  /* ── answer + speak ─────────────────────────────────────────── */
  function _currentContext() {
    var eng = _getEngine();
    if (!eng || typeof eng.getState !== "function") return null;
    var st = {};
    try { st = eng.getState() || {}; } catch (_) { return null; }
    var track = st.track || {};
    var scene = (track.scenes || [])[st.sceneIdx] || {};
    var step = (scene.steps || [])[st.stepIdx] || {};
    return {
      demo: {
        track: track.track || null,
        title: track.title || null,
        scene: scene.title || scene.id || null,
        step: step.id || null,
        narration: step.narration || null,
      },
    };
  }

  function _speak(text) {
    var lv = _local();
    var speakLocal = (lv && lv.ttsAvailable && lv.ttsAvailable())
      ? lv.speak(text) : Promise.reject("tts-unavailable");
    return speakLocal.catch(function () {
      var vb = _bridge();
      if (vb && typeof vb.say === "function") { try { vb.say(text); } catch (_) {} }
      else if (global.speechSynthesis) {
        try { global.speechSynthesis.speak(new global.SpeechSynthesisUtterance(text)); } catch (_) {}
      }
      return null;
    });
  }

  function _print(text) {
    var orb = _orb();
    if (orb) {
      try { if (typeof orb.open === "function") orb.open(); } catch (_) {}
      try { if (typeof orb.printAi === "function") { orb.printAi(text); return; } } catch (_) {}
    }
    // Last resort: no orb wired.
    try { console.info("[demo Q&A]", text); } catch (_) {}
  }

  function _answer(question) {
    question = String(question || "").trim();
    if (!question) return Promise.resolve();
    var context = _currentContext();
    var orb = _orb();
    var llm = _llm();
    var enabled = !!(llm && typeof llm.getConfig === "function" && llm.getConfig().enabled);
    if (!enabled) {
      var msg = "I've paused the walkthrough. Interactive Q&A needs a local LLM "
              + "endpoint configured (open the assistant settings and set the LLM "
              + "base URL, e.g. a local vLLM/Ollama). Ask me again once it's on.";
      _print(msg);
      return _speak(msg);
    }
    try { if (orb && typeof orb.setTyping === "function") orb.setTyping(true); } catch (_) {}
    return llm.handle(question, { context: context })
      .then(function (res) {
        try { if (orb && typeof orb.setTyping === "function") orb.setTyping(false); } catch (_) {}
        var text = (res && res.text) ? res.text
          : (res && res.kind === "disabled")
            ? "The assistant's LLM is disabled. Enable it in settings to ask questions."
            : "Sorry — I couldn't produce an answer.";
        _print(text);
        return _speak(text);
      })
      .catch(function () {
        try { if (orb && typeof orb.setTyping === "function") orb.setTyping(false); } catch (_) {}
        var e = "Sorry — the assistant call failed. The walkthrough will resume.";
        _print(e);
        return _speak(e);
      });
  }

  /* ── pause / resume the walkthrough ─────────────────────────── */
  function _pauseDemo() {
    var eng = _getEngine();
    if (eng && typeof eng.pause === "function") { try { eng.pause(); } catch (_) {} }
  }
  function _resumeDemo() {
    var eng = _getEngine();
    if (eng && typeof eng.play === "function") { try { eng.play(); } catch (_) {} }
  }

  /* ── turn orchestration ─────────────────────────────────────── */
  function _beginTurn() {
    _pauseDemo();
    _setState(STATE.LISTENING);
    _captureStart().catch(function (reason) {
      _setState(STATE.IDLE);
      if (reason === "no-stt") {
        _print("No microphone/speech-to-text is available here. Type your question "
             + "in the assistant and I'll answer, then the walkthrough resumes.");
      } else if (reason === "mic-denied") {
        _print("Microphone access was denied. Enable it (or type your question) to ask.");
      }
      // Resume so a failed capture doesn't strand the user mid-pause.
      _resumeDemo();
    });
  }

  function _finishTurn() {
    _setState(STATE.THINKING);
    _captureStop()
      .then(function (question) {
        if (!question) {
          _print("I didn't catch that — the walkthrough will resume. Tap Ask to try again.");
          return null;
        }
        return _answer(question);
      })
      .catch(function () { /* swallow; resume below */ })
      .then(function () {
        _setState(STATE.IDLE);
        _resumeDemo();
      });
  }

  function _onClick() {
    if (_state === STATE.IDLE) { _beginTurn(); }
    else if (_state === STATE.LISTENING) { _finishTurn(); }
    // THINKING: ignore.
  }

  function ask() { if (_state === STATE.IDLE) _beginTurn(); }

  /* ── init ───────────────────────────────────────────────────── */
  function init() {
    if (_inited || !_doc()) return;
    _inited = true;
    _ensureButton();
    // Warm the capability probe so the first click is snappy.
    var lv = _local();
    if (lv && typeof lv.capabilities === "function") { lv.capabilities().catch(function () {}); }
    // Poll for the demo engine + phase to show/hide the control. Cheap and
    // resilient to the engine being created lazily when a demo starts.
    _syncTimer = setInterval(_syncVisibility, 700);
    // Stop polling while the tab is in the background; the visibility state
    // cannot change under the user there, and this otherwise kept waking the
    // page every 700ms for the life of the session.
    _doc().addEventListener("visibilitychange", _onVisibilityChange);
    _syncVisibility();
  }

  function _onVisibilityChange() {
    if (!_inited) return;
    if (_doc().hidden) {
      if (_syncTimer !== null) { clearInterval(_syncTimer); _syncTimer = null; }
    } else if (_syncTimer === null) {
      _syncTimer = setInterval(_syncVisibility, 700);
      _syncVisibility();
    }
  }

  // Tear down everything init() created. Without this the 700ms interval and
  // the button's click listener lived for the whole page session with no way
  // to release them — a problem for SPAs and for repeated demo mounts.
  function destroy() {
    if (!_inited) return;
    _inited = false;
    if (_syncTimer !== null) { clearInterval(_syncTimer); _syncTimer = null; }
    if (_doc()) _doc().removeEventListener("visibilitychange", _onVisibilityChange);
    if (_btn) {
      _btn.removeEventListener("click", _onClick);
      if (_btn.parentNode) _btn.parentNode.removeChild(_btn);
      _btn = null;
    }
    _state = STATE.IDLE;
  }

  global.InteractiveNarration = { init: init, ask: ask, isBusy: isBusy, destroy: destroy };

  if (_doc()) {
    if (_doc().readyState === "loading") {
      _doc().addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }
})(typeof window !== "undefined" ? window : this);
