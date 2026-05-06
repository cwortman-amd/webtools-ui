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
    personas: {},               // { "executive": { voice, rate, pitch, ... } }
    cloudTTS: {
      mode: "local",            // "local" | "cloud" | "auto"
      provider: "elevenlabs",   // "elevenlabs" | "gemini" | "grok"
      timeoutMs: 25000,
      providers: {
        elevenlabs: {
          apiKey: "",
          voiceId: "EXAVITQu4vr4xnSDxMaL",
          model: "eleven_multilingual_v2",
          outputFormat: "mp3_44100_128"
        },
        gemini: {
          apiKey: "",
          model: "gemini-2.5-flash-preview-tts",
          voice: "Kore",
          endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        },
        grok: {
          apiKey: "",
          model: "grok-2-tts",
          voice: "alloy",
          format: "mp3",
          endpoint: "https://api.x.ai/v1/audio/speech"
        }
      }
    }
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
  var _cloudAudio = null;
  var _cloudAudioUrl = "";

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
  function _userAgent() {
    return (global.navigator && global.navigator.userAgent || "").toLowerCase();
  }
  function _isIOSLike() {
    var ua = _userAgent();
    if (/iphone|ipad|ipod/.test(ua)) return true;
    // iPadOS can present as Macintosh while still exposing touch points.
    var nav = global.navigator || {};
    return /macintosh/.test(ua) && !!nav.maxTouchPoints && nav.maxTouchPoints > 1;
  }
  function _isWindows() { return /windows/.test(_userAgent()); }
  function _isLinux() { return /linux/.test(_userAgent()) && !/android/.test(_userAgent()); }
  function _safeGetVoices() {
    var synth = _Synthesis();
    if (!synth || typeof synth.getVoices !== "function") return [];
    try { return synth.getVoices() || []; }
    catch (_) { return []; }
  }
  function _prewarmVoices() {
    var synth = _Synthesis();
    if (!synth || typeof synth.getVoices !== "function") return;
    _voiceCache = _safeGetVoices();
    if (_voiceCache && _voiceCache.length) return;
    // Chromium can populate voices asynchronously on first page load.
    // Keep a light listener so first TTS utterance doesn't fall back.
    try {
      var prev = synth.onvoiceschanged;
      synth.onvoiceschanged = function () {
        _voiceCache = _safeGetVoices();
        if (typeof prev === "function") {
          try { prev(); } catch (_) {}
        }
      };
    } catch (_) {}
    try {
      setTimeout(function () { _voiceCache = _safeGetVoices(); }, 250);
      setTimeout(function () { _voiceCache = _safeGetVoices(); }, 1000);
    } catch (_) {}
  }

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
    if (!_voiceCache) _voiceCache = _safeGetVoices();
    var lower = name.toLowerCase();
    for (var i = 0; i < _voiceCache.length; i += 1) {
      if ((_voiceCache[i].name || "").toLowerCase() === lower) return _voiceCache[i];
    }
    for (var j = 0; j < _voiceCache.length; j += 1) {
      if ((_voiceCache[j].name || "").toLowerCase().indexOf(lower) >= 0) return _voiceCache[j];
    }
    return null;
  }

  function _platformVoiceHints() {
    var ua = _userAgent();
    var iOS = _isIOSLike();
    var android = /android/.test(ua);
    if (iOS) {
      return ["Siri", "Samantha", "Ava", "Karen", "Moira", "Daniel", "Alex"];
    }
    if (android) {
      return [
        "Google US English",
        "Google UK English Female",
        "Google UK English Male",
        "en-us-x-sfg",
        "en-us-x-iolocal",
        "en-us"
      ];
    }
    if (_isWindows()) {
      return [
        "Online (Natural)",
        "Natural",
        "Microsoft Aria",
        "Microsoft Jenny",
        "Microsoft Guy",
        "Google US English"
      ];
    }
    if (_isLinux()) {
      return [
        "Google US English",
        "English (America)",
        "espeak-ng",
        "espeak",
        "festival",
        "en-us"
      ];
    }
    return ["Microsoft Aria", "Microsoft Jenny", "Google US English", "Samantha", "Alex"];
  }

  function _pickNaturalVoice(voices, lang) {
    if (!voices || !voices.length) return null;
    var prefix = String(lang || "en-US").toLowerCase().split("-")[0];
    var best = null;
    for (var i = 0; i < voices.length; i += 1) {
      var n = (voices[i].name || "").toLowerCase();
      var l = (voices[i].lang || "").toLowerCase();
      var langOk = l === String(lang || "").toLowerCase() || l.indexOf(prefix) === 0;
      if (!langOk) continue;
      var score = 0;
      if (n.indexOf("online (natural)") >= 0) score += 5;
      else if (n.indexOf("natural") >= 0) score += 4;
      else if (n.indexOf("neural") >= 0) score += 3;
      if (_isLinux() && (n.indexOf("google") >= 0 || n.indexOf("chrome") >= 0)) score += 2;
      if (_isWindows() && n.indexOf("microsoft") >= 0) score += 2;
      if (!best || score > best.score) best = { voice: voices[i], score: score };
    }
    return best && best.score > 0 ? best.voice : null;
  }

  // Walk the active persona's preferred-voice fallback chain and
  // return the first SpeechSynthesisVoice matched on the user's
  // machine, or null.
  function _pickPreferredVoice(persona) {
    // On iOS/iPadOS, prioritize Siri-class system voices for the
    // highest quality on-device synthesis experience.
    if (_isIOSLike()) {
      var siri = _resolveVoice("Siri");
      if (siri) return siri;
      var samantha = _resolveVoice("Samantha");
      if (samantha) return samantha;
    }
    var preferred = [];
    if (persona && Array.isArray(persona.preferred_voices)) {
      preferred = preferred.concat(persona.preferred_voices);
    }
    preferred = preferred.concat(_platformVoiceHints());
    for (var i = 0; i < preferred.length; i += 1) {
      var v = _resolveVoice(preferred[i]);
      if (v) return v;
    }
    var voices = _safeGetVoices();
    if (!voices.length) return null;
    var lang = ((_config.lang || (global.navigator && global.navigator.language) || "en-US") + "").toLowerCase();
    var natural = _pickNaturalVoice(voices, lang);
    if (natural) return natural;
    for (var j = 0; j < voices.length; j += 1) {
      if ((voices[j].lang || "").toLowerCase() === lang) return voices[j];
    }
    var prefix = lang.split("-")[0];
    for (var k = 0; k < voices.length; k += 1) {
      if ((voices[k].lang || "").toLowerCase().indexOf(prefix) === 0) return voices[k];
    }
    return voices[0];
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

  function _cleanupCloudAudio() {
    try {
      if (_cloudAudio) {
        _cloudAudio.pause();
        _cloudAudio.src = "";
      }
    } catch (_) {}
    _cloudAudio = null;
    if (_cloudAudioUrl) {
      try { URL.revokeObjectURL(_cloudAudioUrl); } catch (_) {}
    }
    _cloudAudioUrl = "";
  }

  function _replacePathVars(template, vars) {
    return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, function (_m, k) {
      return encodeURIComponent(vars[k] == null ? "" : String(vars[k]));
    });
  }

  function _cloudStatus() {
    var c = _config.cloudTTS || {};
    return {
      mode: c.mode || "local",
      provider: c.provider || "elevenlabs",
      timeoutMs: c.timeoutMs || 25000
    };
  }

  function _effectiveTTSModeLabel() {
    var st = _cloudStatus();
    var mode = String(st.mode || "local").toLowerCase();
    return mode === "local" ? "local" : "cloud";
  }

  function _emitTTSModeChanged(reason) {
    try {
      if (!global || typeof global.dispatchEvent !== "function") return;
      var st = _cloudStatus();
      global.dispatchEvent(new CustomEvent("voicebridge:tts-mode-changed", {
        detail: {
          mode: _effectiveTTSModeLabel(),
          configuredMode: st.mode || "local",
          provider: st.provider || "elevenlabs",
          reason: reason || "update"
        }
      }));
    } catch (_) {}
  }

  function _speakCloud(text, _persona, opts) {
    opts = opts || {};
    var c = _config.cloudTTS || {};
    var mode = c.mode || "local";
    if (mode === "local") return Promise.resolve({ ok: false, reason: "cloud_disabled" });
    var provider = (opts.provider || c.provider || "elevenlabs").toLowerCase();
    var p = (c.providers && c.providers[provider]) || {};
    var timeoutMs = Number(c.timeoutMs || 25000);
    if (!global.fetch) return Promise.resolve({ ok: false, reason: "fetch_unsupported" });

    var controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = null;
    if (controller) timer = setTimeout(function () { try { controller.abort(); } catch (_) {} }, timeoutMs);

    var req = null;
    if (provider === "elevenlabs") {
      if (!p.apiKey || !p.voiceId) return Promise.resolve({ ok: false, reason: "elevenlabs_not_configured" });
      req = {
        url: "https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(p.voiceId) +
             "/stream?output_format=" + encodeURIComponent(p.outputFormat || "mp3_44100_128"),
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": p.apiKey },
          body: JSON.stringify({ text: text, model_id: p.model || "eleven_multilingual_v2" }),
          signal: controller && controller.signal
        },
        parse: "arrayBuffer",
        mimeType: "audio/mpeg"
      };
    } else if (provider === "gemini") {
      if (!p.apiKey || !p.model) return Promise.resolve({ ok: false, reason: "gemini_not_configured" });
      var endpoint = _replacePathVars(
        p.endpoint || "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        { model: p.model }
      );
      var sep = endpoint.indexOf("?") >= 0 ? "&" : "?";
      req = {
        url: endpoint + sep + "key=" + encodeURIComponent(p.apiKey),
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: text }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: p.voice || "Kore" }
                }
              }
            }
          }),
          signal: controller && controller.signal
        },
        parse: "geminiAudio"
      };
    } else if (provider === "grok") {
      if (!p.apiKey || !p.model) return Promise.resolve({ ok: false, reason: "grok_not_configured" });
      req = {
        url: p.endpoint || "https://api.x.ai/v1/audio/speech",
        init: {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + p.apiKey
          },
          body: JSON.stringify({
            model: p.model,
            voice: p.voice || "alloy",
            input: text,
            format: p.format || "mp3"
          }),
          signal: controller && controller.signal
        },
        parse: "arrayBuffer"
      };
    } else {
      return Promise.resolve({ ok: false, reason: "provider_unsupported" });
    }

    return fetch(req.url, req.init).then(function (resp) {
      if (!resp.ok) {
        return resp.text().then(function (t) {
          return { ok: false, reason: "http_" + resp.status, detail: (t || "").slice(0, 280) };
        });
      }
      if (req.parse === "geminiAudio") {
        return resp.json().then(function (json) {
          var candidates = (json && json.candidates) || [];
          var parts = (((candidates[0] || {}).content) || {}).parts || [];
          var i;
          for (i = 0; i < parts.length; i += 1) {
            var inline = parts[i] && (parts[i].inlineData || parts[i].inline_data);
            if (inline && inline.data) {
              var mime = inline.mimeType || inline.mime_type || "audio/wav";
              var bin = atob(inline.data);
              var bytes = new Uint8Array(bin.length);
              for (var b = 0; b < bin.length; b += 1) bytes[b] = bin.charCodeAt(b);
              return { ok: true, bytes: bytes, mime: mime };
            }
          }
          return { ok: false, reason: "gemini_no_audio" };
        });
      }
      return resp.arrayBuffer().then(function (buf) {
        var contentType = resp.headers && resp.headers.get ? resp.headers.get("content-type") : "";
        return {
          ok: true,
          bytes: new Uint8Array(buf),
          mime: req.mimeType || contentType || "audio/mpeg"
        };
      });
    }).then(function (result) {
      if (!result || !result.ok) return result || { ok: false, reason: "cloud_no_result" };
      _cleanupCloudAudio();
      var blob = new Blob([result.bytes], { type: result.mime || "audio/mpeg" });
      _cloudAudioUrl = URL.createObjectURL(blob);
      var audio = new Audio(_cloudAudioUrl);
      _cloudAudio = audio;
      return new Promise(function (resolve) {
        audio.onended = function () {
          _cleanupCloudAudio();
          resolve({ ok: true, cloud: provider });
        };
        audio.onerror = function () {
          _cleanupCloudAudio();
          resolve({ ok: false, reason: "cloud_audio_playback_error", cloud: provider });
        };
        var playPromise;
        try { playPromise = audio.play(); }
        catch (e) {
          _cleanupCloudAudio();
          resolve({ ok: false, reason: e && e.message || "cloud_audio_playback_exception", cloud: provider });
          return;
        }
        if (playPromise && typeof playPromise.then === "function") {
          playPromise.catch(function (e) {
            _cleanupCloudAudio();
            resolve({ ok: false, reason: e && e.message || "cloud_audio_playback_blocked", cloud: provider });
          });
        }
      });
    }).catch(function (e) {
      return { ok: false, reason: e && e.message || "cloud_fetch_error" };
    }).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TTS
  // ───────────────────────────────────────────────────────────────────────────
  function _sayLocal(text, opts, persona) {
    opts = opts || {};
    var synth = _Synthesis();
    var Utt = _Utterance();
    if (!synth || !Utt) return Promise.resolve({ ok: false, reason: "tts_unsupported" });
    var spoken = String(text || "");

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

  function say(text, opts) {
    opts = opts || {};
    var spoken = applyPhonetics(String(text || ""));
    var persona = getPersona();
    var mode = (_config.cloudTTS && _config.cloudTTS.mode) || "local";
    if (mode === "cloud" || mode === "auto") {
      if (mode === "auto" && _isIOSLike()) {
        return _sayLocal(spoken, opts, persona).then(function (r0) {
          return (r0 && r0.ok) ? r0 : _speakCloud(spoken, persona, opts);
        });
      }
      return _speakCloud(spoken, persona, opts).then(function (r) {
        return (r && r.ok) ? r : _sayLocal(spoken, opts, persona);
      });
    }
    return _sayLocal(spoken, opts, persona);
  }
  function cancelSpeech() {
    _cleanupCloudAudio();
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
    if (opts.cloudTTS && typeof opts.cloudTTS === "object") {
      var c = opts.cloudTTS;
      if (typeof c.mode === "string") _config.cloudTTS.mode = c.mode;
      if (typeof c.provider === "string") _config.cloudTTS.provider = c.provider;
      if (c.timeoutMs != null && isFinite(c.timeoutMs)) _config.cloudTTS.timeoutMs = Number(c.timeoutMs);
      if (c.providers && typeof c.providers === "object") {
        Object.keys(c.providers).forEach(function (name) {
          var curr = _config.cloudTTS.providers[name] || {};
          var next = c.providers[name];
          if (next && typeof next === "object") {
            _config.cloudTTS.providers[name] = Object.assign({}, curr, next);
          }
        });
      }
    }
    if (typeof opts.defaultPersona === "string" && _config.personas[opts.defaultPersona] && !_activePersonaId) {
      _activePersonaId = opts.defaultPersona;
    }
    // Re-hydrate persisted state in case the storage keys changed.
    _hydratePersisted();
    _emitTTSModeChanged("configure");
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
      var tts = _cloudStatus();
      return { ok: true, kind: "voice",
               text: "voice supported=" + isSupported() +
                     " session=" + (_sessionActive ? "ON" : "OFF") +
                     " listening=" + (_active ? "YES" : "NO") +
                     " ttsMode=" + tts.mode +
                     " ttsProvider=" + tts.provider +
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
    if (sub === "tts") {
      var ttsSub = (args[1] || "").toLowerCase();
      if (!ttsSub || ttsSub === "status") {
        var st = _cloudStatus();
        return { ok: true, kind: "voice",
                 text: "tts mode=" + st.mode + " provider=" + st.provider + " timeoutMs=" + st.timeoutMs };
      }
      if (ttsSub === "local" || ttsSub === "cloud" || ttsSub === "auto") {
        _config.cloudTTS.mode = ttsSub;
        _emitTTSModeChanged("slash_tts_mode");
        return { ok: true, kind: "voice", text: "TTS mode set to `" + ttsSub + "`." };
      }
      if (ttsSub === "provider") {
        var pv = (args[2] || "").toLowerCase();
        if (!pv) {
          return { ok: false, kind: "voice", text: "Usage: /voice tts provider <elevenlabs|gemini|grok>" };
        }
        _config.cloudTTS.provider = pv;
        _emitTTSModeChanged("slash_tts_provider");
        return { ok: true, kind: "voice", text: "TTS provider set to `" + pv + "`." };
      }
      return { ok: false, kind: "voice",
               text: "Usage: /voice tts <status|local|cloud|auto|provider <id>>" };
    }
    return { ok: false, kind: "voice",
             text: "Usage: /voice [on|off|start|stop|status|say <text>|wake <phrase>|persona <id>|persona list|persona reset|tts <status|local|cloud|auto|provider <id>>]" };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PUBLIC FACADE
  // ───────────────────────────────────────────────────────────────────────────
  var bridge = {
    version: 3,                  // v3 adds platform voice heuristics + cloud TTS adapters
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
    getTTSConfig: function () {
      return JSON.parse(JSON.stringify(_config.cloudTTS || {}));
    },
    setTTSConfig: function (cfg) {
      return configure({ cloudTTS: cfg || {} });
    },

    // Slash
    handleSlash: _handleSlash
  };

  global.voiceBridge = bridge;
  global.SharedVoice = bridge;  // forward-compat alias

  // Prime voice list early to reduce first-utterance fallback on
  // Windows/Linux browsers where voices load asynchronously.
  _prewarmVoices();
  _emitTTSModeChanged("init");

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
