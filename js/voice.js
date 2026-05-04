/*!
 * shared-ui canonical asset: voice.js
 *
 * PROMOTED in harmonization Phase 6 — was cluster-manager/js/voice.js
 * (the richest STT + wake-word + TTS implementation across the 3
 * consumer repos), extended with two consumer-pluggable layers
 * promoted from llm-benchmark/data/present-script.json:
 *
 *   - configure({ phoneticReplacements }) — pronunciation overrides
 *     applied to text BEFORE TTS synthesis. Each consumer ships its
 *     own dictionary appropriate to its domain (e.g. llm-benchmark
 *     pronounces MI300X as "em eye three hundred ex"). Documented
 *     in `shared/docs/templates/voice-config.schema.json`.
 *
 *   - configure({ personas })           — voice / rate / pitch /
 *     audience preferences keyed by persona id (e.g. "executive",
 *     "presales", "engineer"). The active persona can be selected
 *     via `setPersona(id)` and is then applied automatically by
 *     `say(text)`.
 *
 * Single intent path: STT-finalized transcripts are routed via
 * `routeTranscript(text)` to whichever orb / chat dispatcher the
 * consumer has wired (in priority order: `window.ChatOrb.dispatch`,
 * `window.chatOrb.send`, `window.chatLLM.handle`). This means voice
 * input automatically inherits the slash router (Phase 4) and any
 * per-consumer intent layer.
 *
 * Public API: window.voiceBridge (and an alias `window.SharedVoice`
 * for forward compat). Methods:
 *
 *   START / STOP recognition:
 *     start()                   → begin one push-to-talk window
 *     stop()                    → end recognition early
 *     toggle()
 *     isActive()                → bool (mic currently listening)
 *     isSupported()             → bool (browser supports Web Speech)
 *
 *   SESSION (auto-speak AI replies):
 *     beginSession() / endSession() / isSessionActive()
 *
 *   SPEAK (TTS):
 *     say(text, opts?)          → returns Promise<{ ok, reason? }>;
 *                                 applies phonetics + active persona
 *     cancelSpeech()
 *
 *   WAKE WORD:
 *     enableWakeWord(phrase)
 *     disableWakeWord()
 *
 *   ROUTING / SUBSCRIPTIONS:
 *     onTranscript(fn)          → fn(transcript, isFinal)
 *     routeTranscript(text)     → manually inject a finalized
 *                                 transcript (used by demo engine)
 *     lastTranscript()
 *
 *   CONFIG:
 *     configure(opts)           → idempotent; merges into current
 *                                 config. Recognized keys:
 *       - phoneticReplacements:  { "MI300X": "em eye three hundred ex" }
 *       - personas:              { "executive": { voice, rate, pitch, ... } }
 *       - sessionStorageKey:     overrides "shared-voice-session"
 *       - lang:                  e.g. "en-US"
 *       - storagePrefix:         consumer-scoped localStorage prefix
 *       - chatTarget:            "chat-orb" | "chat-llm" | "auto"
 *     setPersona(id) / getPersona() / listPersonas()
 *     handleSlash(rest)         → /voice [on|off|...] command
 *
 * Slash command:  `/voice [on|off|start|stop|status|say <text>|wake
 *                          <phrase>|persona <id>|persona list|persona reset]`
 *
 * Loaded as `../shared/js/voice.js`. Each consumer ships a thin
 * per-repo `js/voice-config.js` (Phase 6.3 follow-up) that calls
 * `window.voiceBridge.configure({...})` with its phonetic dictionary
 * and personas before any chat input arrives.
 */
(function (global) {
  "use strict";
  if (global.__voiceBridgeLoaded) return;
  global.__voiceBridgeLoaded = true;

  // ───────────────────────────────────────────────────────────────────────────
  // STATE
  // ───────────────────────────────────────────────────────────────────────────
  var DEFAULT_SESSION_KEY = "shared-voice-session";
  var DEFAULT_PERSONA_KEY = "shared-voice-persona";

  var _config = {
    sessionStorageKey: DEFAULT_SESSION_KEY,
    personaStorageKey: DEFAULT_PERSONA_KEY,
    storagePrefix: "",
    lang: null,                 // null → use navigator.language
    chatTarget: "auto",         // "chat-orb" | "chat-llm" | "auto"
    phoneticReplacements: {},   // { "MI300X": "em eye three hundred ex" }
    personas: {}                // { "executive": { voice, rate, pitch, ... } }
  };

  var _active = false;
  var _sessionActive = false;
  var _activePersonaId = null;  // resolved on first configure()
  var _recognition = null;
  var _wakeWord = null;
  var _wakeRecognition = null;
  var _subscribers = [];
  var _lastTranscript = "";
  var _voiceCache = null;       // cached SpeechSynthesisVoice list
  var _orbWrapped = false;

  // Read persisted session / persona AFTER the first configure() call
  // (which may override the storage keys).
  function _hydratePersisted() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(_config.sessionStorageKey);
      _sessionActive = raw === "true";
    } catch (_) { _sessionActive = false; }
    try {
      var p = global.localStorage && global.localStorage.getItem(_config.personaStorageKey);
      if (p && _config.personas && _config.personas[p]) _activePersonaId = p;
    } catch (_) {}
  }
  _hydratePersisted();

  function _writeSession(b) {
    try { global.localStorage && global.localStorage.setItem(_config.sessionStorageKey, b ? "true" : "false"); } catch (_) {}
  }
  function _writePersona(id) {
    try { global.localStorage && global.localStorage.setItem(_config.personaStorageKey, id || ""); } catch (_) {}
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BROWSER API LOOKUPS (lazy, so headless tests can stub)
  // ───────────────────────────────────────────────────────────────────────────
  function _Recognition() {
    return global.SpeechRecognition || global.webkitSpeechRecognition || null;
  }
  function _Synthesis() { return global.speechSynthesis || null; }
  function _Utterance() { return global.SpeechSynthesisUtterance || null; }

  function isSupported() {
    return !!_Recognition() && !!_Synthesis() && !!_Utterance();
  }

  function _emit(transcript, final_) {
    _lastTranscript = transcript;
    _subscribers.forEach(function (fn) {
      try { fn(transcript, !!final_); } catch (_) {}
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STT (push-to-talk)
  // ───────────────────────────────────────────────────────────────────────────
  function _ensureRecognition() {
    if (_recognition) return _recognition;
    var R = _Recognition();
    if (!R) return null;
    var rec = new R();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = _config.lang || (global.navigator && global.navigator.language) || "en-US";
    rec.onstart = function () { _active = true; };
    rec.onend = function () { _active = false; };
    rec.onerror = function (ev) {
      _active = false;
      _emit("[voice error] " + (ev && ev.error ? ev.error : "unknown"), true);
    };
    rec.onresult = function (ev) {
      var transcript = "";
      var isFinal = false;
      for (var i = ev.resultIndex; i < ev.results.length; i += 1) {
        transcript += ev.results[i][0].transcript;
        if (ev.results[i].isFinal) isFinal = true;
      }
      transcript = transcript.trim();
      if (!transcript) return;
      _emit(transcript, isFinal);
      if (isFinal) routeTranscript(transcript);
    };
    _recognition = rec;
    return rec;
  }

  function start() {
    var rec = _ensureRecognition();
    if (!rec) return false;
    try { rec.start(); _active = true; return true; }
    catch (_) { return false; }
  }
  function stop() {
    if (!_recognition) return false;
    try { _recognition.stop(); _active = false; return true; }
    catch (_) { return false; }
  }
  function toggle() { return _active ? stop() : start(); }
  function isActive() { return _active; }
  function isSessionActive() { return _sessionActive; }

  function beginSession() {
    _sessionActive = true;
    _writeSession(true);
    _hookOrbAutoSay();
  }
  function endSession() {
    _sessionActive = false;
    _writeSession(false);
    cancelSpeech();
  }

  // Single intent path: route a finalized transcript to the orb /
  // chat dispatcher. Order is configurable via _config.chatTarget,
  // with "auto" preferring the canonical Phase 2/3 ChatOrb first.
  function routeTranscript(text) {
    if (!text) return false;
    var target = _config.chatTarget;

    // Try the canonical Phase 2/3 orb first (preferred everywhere).
    if (target === "auto" || target === "chat-orb") {
      // ChatOrb (canonical, Phase 2 / 3) — uses dispatch(text)
      if (global.ChatOrb && typeof global.ChatOrb.dispatch === "function") {
        try { global.ChatOrb.dispatch(text); return true; } catch (_) {}
      }
      // Legacy chatOrb facade (cluster-manager pre-Phase-3)
      if (global.chatOrb && typeof global.chatOrb.send === "function") {
        try { global.chatOrb.send(text); return true; } catch (_) {}
      }
    }
    // chat-llm fallback
    if (target === "auto" || target === "chat-llm") {
      if (global.chatLLM && typeof global.chatLLM.handle === "function") {
        try { global.chatLLM.handle(text); return true; } catch (_) {}
      }
    }
    return false;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PHONETIC + PERSONA LAYER (Phase 6 extension)
  // ───────────────────────────────────────────────────────────────────────────
  // Apply phonetic replacements as whole-word, case-insensitive matches.
  // Longer keys win (so "MI300X" beats "MI300" if both are in the dict).
  function applyPhonetics(text) {
    if (typeof text !== "string" || !text) return text;
    var dict = _config.phoneticReplacements || {};
    var keys = Object.keys(dict);
    if (!keys.length) return text;
    keys.sort(function (a, b) { return b.length - a.length; });
    var out = text;
    keys.forEach(function (k) {
      var v = dict[k];
      if (typeof v !== "string") return;
      // \b is too aggressive for keys containing non-word chars — fall
      // back to a manual word-boundary look-around.
      var esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      var re;
      try {
        re = new RegExp("(^|[^A-Za-z0-9_])(" + esc + ")(?=[^A-Za-z0-9_]|$)", "gi");
      } catch (_) { return; }
      out = out.replace(re, function (_m, lead) { return lead + v; });
    });
    return out;
  }

  function _resolveVoice(name) {
    if (!name || typeof name !== "string") return null;
    var synth = _Synthesis();
    if (!synth) return null;
    if (!_voiceCache) {
      try { _voiceCache = synth.getVoices() || []; } catch (_) { _voiceCache = []; }
    }
    var lower = name.toLowerCase();
    for (var i = 0; i < _voiceCache.length; i += 1) {
      if ((_voiceCache[i].name || "").toLowerCase() === lower) return _voiceCache[i];
    }
    return null;
  }

  // Walk the active persona's preferred-voice fallback chain and
  // return the first SpeechSynthesisVoice matched on the user's
  // machine, or null.
  function _pickPreferredVoice(persona) {
    if (!persona || !Array.isArray(persona.preferred_voices)) return null;
    for (var i = 0; i < persona.preferred_voices.length; i += 1) {
      var v = _resolveVoice(persona.preferred_voices[i]);
      if (v) return v;
    }
    return null;
  }

  function setPersona(id) {
    if (!id) { _activePersonaId = null; _writePersona(""); return null; }
    if (!_config.personas || !_config.personas[id]) return null;
    _activePersonaId = id;
    _writePersona(id);
    return _config.personas[id];
  }
  function getPersona() {
    if (!_activePersonaId) return null;
    return (_config.personas || {})[_activePersonaId] || null;
  }
  function listPersonas() {
    return Object.keys(_config.personas || {}).sort();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TTS
  // ───────────────────────────────────────────────────────────────────────────
  function say(text, opts) {
    opts = opts || {};
    var synth = _Synthesis();
    var Utt = _Utterance();
    if (!synth || !Utt) return Promise.resolve({ ok: false, reason: "tts_unsupported" });

    var spoken = applyPhonetics(String(text || ""));
    var persona = getPersona();

    return new Promise(function (resolve) {
      var u = new Utt(spoken);
      // Persona defaults — opts wins.
      if (persona) {
        if (persona.rate != null && opts.rate == null) u.rate = persona.rate;
        if (persona.pitch != null && opts.pitch == null) u.pitch = persona.pitch;
        if (persona.volume != null && opts.volume == null) u.volume = persona.volume;
        if (persona.lang && !opts.lang) u.lang = persona.lang;
        if (!opts.voice) {
          var pv = _pickPreferredVoice(persona);
          if (pv) u.voice = pv;
        }
      }
      // Per-call overrides
      if (opts.rate != null) u.rate = opts.rate;
      if (opts.pitch != null) u.pitch = opts.pitch;
      if (opts.volume != null) u.volume = opts.volume;
      if (opts.lang) u.lang = opts.lang;
      if (opts.voice) {
        u.voice = (typeof opts.voice === "string") ? (_resolveVoice(opts.voice) || null) : opts.voice;
      }

      u.onend = function () { resolve({ ok: true, spoken: spoken }); };
      u.onerror = function (ev) { resolve({ ok: false, reason: ev && ev.error || "speech_error" }); };
      try { synth.speak(u); }
      catch (e) { resolve({ ok: false, reason: e.message || String(e) }); }
    });
  }
  function cancelSpeech() {
    var synth = _Synthesis();
    if (synth) try { synth.cancel(); } catch (_) {}
  }

  // Hook chatOrb.append (legacy) so AI bubbles auto-speak in session.
  function _hookOrbAutoSay() {
    if (_orbWrapped) return;
    if (!global.chatOrb || typeof global.chatOrb.append !== "function") return;
    var orig = global.chatOrb.append.bind(global.chatOrb);
    global.chatOrb.append = function (role, content, opts) {
      var bubble = orig(role, content, opts);
      if (_sessionActive && role === "ai" && typeof content === "string" && content.trim()) {
        try { say(content); } catch (_) {}
      }
      return bubble;
    };
    _orbWrapped = true;
  }
  if (_sessionActive) _hookOrbAutoSay();

  // ───────────────────────────────────────────────────────────────────────────
  // WAKE WORD (continuous recognition watching for the phrase)
  // ───────────────────────────────────────────────────────────────────────────
  function enableWakeWord(phrase) {
    _wakeWord = String(phrase || "").trim().toLowerCase();
    if (!_wakeWord) return false;
    var R = _Recognition();
    if (!R) return false;
    if (_wakeRecognition) try { _wakeRecognition.stop(); } catch (_) {}
    var rec = new R();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = _config.lang || (global.navigator && global.navigator.language) || "en-US";
    rec.onresult = function (ev) {
      var i, transcript = "";
      for (i = ev.resultIndex; i < ev.results.length; i += 1) {
        transcript += ev.results[i][0].transcript;
      }
      if (transcript.toLowerCase().indexOf(_wakeWord) >= 0) {
        try { rec.stop(); } catch (_) {}
        start();
      }
    };
    rec.onend = function () { if (_wakeWord) try { rec.start(); } catch (_) {} };
    try { rec.start(); _wakeRecognition = rec; return true; }
    catch (_) { return false; }
  }
  function disableWakeWord() {
    _wakeWord = null;
    if (_wakeRecognition) try { _wakeRecognition.stop(); } catch (_) {}
    _wakeRecognition = null;
  }

  function onTranscript(fn) {
    if (typeof fn === "function") _subscribers.push(fn);
    return function () {
      _subscribers = _subscribers.filter(function (g) { return g !== fn; });
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CONFIG (Phase 6 extension — phonetics + personas)
  // ───────────────────────────────────────────────────────────────────────────
  function configure(opts) {
    if (!opts || typeof opts !== "object") return _config;
    if (typeof opts.sessionStorageKey === "string") _config.sessionStorageKey = opts.sessionStorageKey;
    if (typeof opts.personaStorageKey === "string") _config.personaStorageKey = opts.personaStorageKey;
    if (typeof opts.storagePrefix === "string") _config.storagePrefix = opts.storagePrefix;
    if (typeof opts.lang === "string") _config.lang = opts.lang;
    if (typeof opts.chatTarget === "string") _config.chatTarget = opts.chatTarget;
    if (opts.phoneticReplacements && typeof opts.phoneticReplacements === "object") {
      // Merge, not replace, so multiple modules can contribute.
      Object.keys(opts.phoneticReplacements).forEach(function (k) {
        _config.phoneticReplacements[k] = opts.phoneticReplacements[k];
      });
    }
    if (opts.personas && typeof opts.personas === "object") {
      Object.keys(opts.personas).forEach(function (k) {
        _config.personas[k] = opts.personas[k];
      });
    }
    if (typeof opts.defaultPersona === "string" && _config.personas[opts.defaultPersona] && !_activePersonaId) {
      _activePersonaId = opts.defaultPersona;
    }
    // Re-hydrate persisted state in case the storage keys changed.
    _hydratePersisted();
    return _config;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // SLASH COMMAND  /voice ...
  // ───────────────────────────────────────────────────────────────────────────
  function _handleSlash(rest) {
    var raw = String(rest || "").trim();
    var args = raw.split(/\s+/);
    var sub = (args[0] || "").toLowerCase();
    if (sub === "" || sub === "status") {
      return { ok: true, kind: "voice",
               text: "voice supported=" + isSupported() +
                     " session=" + (_sessionActive ? "ON" : "OFF") +
                     " listening=" + (_active ? "YES" : "NO") +
                     (_activePersonaId ? " persona=" + _activePersonaId : "") +
                     (_wakeWord ? " wake='" + _wakeWord + "'" : "") };
    }
    if (sub === "on" || sub === "begin" || sub === "session") {
      beginSession();
      return { ok: true, kind: "voice", text: "Voice session ON. AI replies will be spoken." };
    }
    if (sub === "off" || sub === "end") {
      endSession();
      return { ok: true, kind: "voice", text: "Voice session OFF." };
    }
    if (sub === "start" || sub === "listen") {
      var ok1 = start();
      return { ok: ok1, kind: "voice", text: ok1 ? "Listening…" : "Voice unsupported in this browser." };
    }
    if (sub === "stop") {
      var ok2 = stop();
      return { ok: ok2, kind: "voice", text: "Stopped." };
    }
    if (sub === "say") {
      var rest2 = raw.slice(args[0].length).trim();
      if (!rest2) return { ok: false, kind: "voice", text: "Usage: /voice say <text>" };
      say(rest2);
      return { ok: true, kind: "voice", text: "Speaking: " + rest2.slice(0, 80) };
    }
    if (sub === "wake") {
      var phrase = raw.slice(args[0].length).trim();
      if (!phrase) { disableWakeWord(); return { ok: true, kind: "voice", text: "Wake-word disabled." }; }
      var ok3 = enableWakeWord(phrase);
      return { ok: ok3, kind: "voice", text: ok3 ? "Wake-word armed: " + phrase : "Voice unsupported." };
    }
    if (sub === "persona") {
      var sub2 = (args[1] || "").toLowerCase();
      if (sub2 === "" || sub2 === "list") {
        var list = listPersonas();
        return { ok: true, kind: "voice",
                 text: list.length
                       ? "Personas: " + list.map(function (id) {
                           return id + (id === _activePersonaId ? " (active)" : "");
                         }).join(", ")
                       : "No personas configured." };
      }
      if (sub2 === "reset" || sub2 === "clear" || sub2 === "off") {
        setPersona(null);
        return { ok: true, kind: "voice", text: "Persona cleared." };
      }
      var p = setPersona(args[1]);
      return p
        ? { ok: true, kind: "voice", text: "Persona set: " + args[1] }
        : { ok: false, kind: "voice",
            text: "Unknown persona '" + args[1] + "'. Try /voice persona list." };
    }
    return { ok: false, kind: "voice",
             text: "Usage: /voice [on|off|start|stop|status|say <text>|wake <phrase>|persona <id>|persona list|persona reset]" };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC FACADE
  // ───────────────────────────────────────────────────────────────────────────
  var bridge = {
    version: 2,                  // bumped from cluster-manager v1 → v2 (phonetics+personas)
    isSupported: isSupported,

    // Recognition
    start: start, stop: stop, toggle: toggle,
    isActive: isActive, isSessionActive: isSessionActive,
    beginSession: beginSession, endSession: endSession,

    // TTS
    say: say, cancelSpeech: cancelSpeech,

    // Wake
    enableWakeWord: enableWakeWord, disableWakeWord: disableWakeWord,

    // Subscribe / inject
    onTranscript: onTranscript,
    routeTranscript: routeTranscript,
    lastTranscript: function () { return _lastTranscript; },

    // Phonetic + persona layer
    configure: configure,
    setPersona: setPersona, getPersona: getPersona, listPersonas: listPersonas,
    applyPhonetics: applyPhonetics,

    // Slash
    handleSlash: _handleSlash
  };

  global.voiceBridge = bridge;
  global.SharedVoice = bridge;  // forward-compat alias

  // Auto-wire /voice onto chatLLM if it exists (cluster-manager
  // legacy path). The canonical orb (ChatOrb) registers /voice
  // itself via shared/js/slash-catalog.js + chat-orb-mount.js.
  function _wireSlashIntoChatLLM() {
    if (!global.chatLLM) { setTimeout(_wireSlashIntoChatLLM, 50); return; }
    if (typeof global.chatLLM.dispatchSlash !== "function") return;
    if (global.chatLLM.__voiceWrapped) return;
    global.chatLLM.__voiceWrapped = true;
    var prev = global.chatLLM.dispatchSlash;
    global.chatLLM.dispatchSlash = function (input) {
      if (typeof input === "string" && input[0] === "/") {
        var parts = input.trim().split(/\s+/);
        if (parts[0].toLowerCase() === "/voice") {
          return Promise.resolve(_handleSlash(parts.slice(1).join(" ")));
        }
      }
      return prev(input);
    };
  }
  _wireSlashIntoChatLLM();
})(typeof window !== "undefined" ? window : this);
