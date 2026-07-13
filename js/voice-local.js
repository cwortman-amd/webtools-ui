/* eslint-disable */
/* ─────────────────────────────────────────────────────────────────
 * webtools-ui · LocalVoice — on-device (CPU) TTS/STT client
 *
 * Thin browser client for the dashboard's on-device voice endpoints:
 *   GET  /api/voice/capabilities  → { tts:{available}, stt:{available,...} }
 *   POST /api/voice/tts   {text}          → audio/wav
 *   POST /api/voice/stt   {audio_b64,mime}→ { ok, text }
 *
 * The backend runs Piper (TTS) and whisper.cpp (STT) locally — zero egress,
 * air-gap friendly (see scripts/voice_service.py + docs/SECURITY.md).
 *
 * This client is intentionally degradation-first: if the server reports the
 * engines are unavailable (503 / available:false), speak()/listen() reject
 * with a stable reason string so callers can fall back to the browser Web
 * Speech API (window.voiceBridge / speechSynthesis).
 *
 * Public API — window.LocalVoice:
 *   capabilities()            → Promise<caps>  (cached)
 *   refresh()                 → Promise<caps>  (force re-probe)
 *   ttsAvailable()/sttAvailable() → bool (valid after capabilities resolves)
 *   speak(text)               → Promise (resolves when playback ends)
 *   cancel()                  → stop playback
 *   pause()/resume()          → pause/resume playback
 *   isSpeaking()              → bool
 *   startListening()          → Promise (mic capture begins)
 *   stopListening()           → Promise<string> (transcript)
 *   isListening()             → bool
 *   cancelListening()         → abort capture, no transcript
 * ─────────────────────────────────────────────────────────────── */
(function (global) {
  "use strict";

  var _capsPromise = null;
  var _caps = null;

  // ── TTS playback state ──────────────────────────────────────────
  var _audio = null;       // active HTMLAudioElement
  var _audioUrl = null;    // object URL to revoke

  // ── STT capture state ───────────────────────────────────────────
  var _recorder = null;
  var _chunks = [];
  var _stream = null;
  var _listening = false;

  function _apiBase() {
    // Same-origin by default; a consumer may override before load.
    return (global.CM_API_BASE || "").replace(/\/$/, "");
  }

  function capabilities() {
    if (_capsPromise) return _capsPromise;
    _capsPromise = fetch(_apiBase() + "/api/voice/capabilities", {
      headers: { "Accept": "application/json" },
      credentials: "same-origin",
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        _caps = (j && j.ok) ? j : {
          tts: { available: false }, stt: { available: false },
        };
        return _caps;
      })
      .catch(function () {
        _caps = { tts: { available: false }, stt: { available: false } };
        return _caps;
      });
    return _capsPromise;
  }

  function refresh() { _capsPromise = null; _caps = null; return capabilities(); }
  function ttsAvailable() { return !!(_caps && _caps.tts && _caps.tts.available); }
  function sttAvailable() { return !!(_caps && _caps.stt && _caps.stt.available); }

  /* ── TTS ─────────────────────────────────────────────────────── */

  function isSpeaking() { return !!_audio && !_audio.paused; }

  function cancel() {
    if (_audio) {
      try { _audio.pause(); } catch (_) {}
      try { _audio.src = ""; } catch (_) {}
    }
    if (_audioUrl) { try { URL.revokeObjectURL(_audioUrl); } catch (_) {} _audioUrl = null; }
    _audio = null;
  }

  function pause() { if (_audio) { try { _audio.pause(); } catch (_) {} } }
  function resume() { if (_audio) { try { _audio.play(); } catch (_) {} } }

  function speak(text) {
    text = String(text == null ? "" : text).trim();
    if (!text) return Promise.resolve();
    return capabilities().then(function () {
      if (!ttsAvailable()) return Promise.reject("tts-unavailable");
      cancel();
      return fetch(_apiBase() + "/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "audio/wav" },
        credentials: "same-origin",
        body: JSON.stringify({ text: text }),
      }).then(function (r) {
        if (!r.ok) return Promise.reject(r.status === 503 ? "tts-unavailable" : "tts-error");
        return r.blob();
      }).then(function (blob) {
        return new Promise(function (resolve, reject) {
          _audioUrl = URL.createObjectURL(blob);
          _audio = new Audio(_audioUrl);
          _audio.onended = function () { cancel(); resolve(); };
          _audio.onerror = function () { cancel(); reject("tts-error"); };
          _audio.play().catch(function () { cancel(); reject("tts-error"); });
        });
      });
    });
  }

  /* ── STT ─────────────────────────────────────────────────────── */

  function isListening() { return _listening; }

  function _stopStream() {
    if (_stream) {
      try { _stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
      _stream = null;
    }
  }

  function _supportsCapture() {
    return typeof global.MediaRecorder !== "undefined"
      && global.navigator && global.navigator.mediaDevices
      && typeof global.navigator.mediaDevices.getUserMedia === "function";
  }

  function startListening() {
    return capabilities().then(function () {
      if (!sttAvailable()) return Promise.reject("stt-unavailable");
      if (!_supportsCapture()) return Promise.reject("capture-unsupported");
      if (_listening) return Promise.resolve();
      return global.navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function (stream) {
          _stream = stream;
          _chunks = [];
          var mime = "";
          var prefs = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
          for (var i = 0; i < prefs.length; i++) {
            if (global.MediaRecorder.isTypeSupported && global.MediaRecorder.isTypeSupported(prefs[i])) {
              mime = prefs[i]; break;
            }
          }
          _recorder = mime ? new global.MediaRecorder(stream, { mimeType: mime })
                           : new global.MediaRecorder(stream);
          _recorder.ondataavailable = function (e) { if (e.data && e.data.size) _chunks.push(e.data); };
          _recorder.start();
          _listening = true;
        })
        .catch(function (err) {
          _stopStream();
          return Promise.reject(err && err.name === "NotAllowedError" ? "mic-denied" : "capture-error");
        });
    });
  }

  function cancelListening() {
    _listening = false;
    if (_recorder && _recorder.state !== "inactive") { try { _recorder.stop(); } catch (_) {} }
    _recorder = null; _chunks = [];
    _stopStream();
  }

  function _blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function () {
        var s = String(reader.result || "");
        var comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      reader.onerror = function () { reject("read-error"); };
      reader.readAsDataURL(blob);
    });
  }

  function stopListening() {
    if (!_listening || !_recorder) { return Promise.reject("not-listening"); }
    var rec = _recorder;
    var mime = (rec.mimeType || "audio/webm");
    return new Promise(function (resolve, reject) {
      rec.onstop = function () {
        _listening = false;
        _stopStream();
        var blob = new Blob(_chunks, { type: mime });
        _chunks = []; _recorder = null;
        if (!blob.size) { reject("empty-audio"); return; }
        _blobToBase64(blob).then(function (b64) {
          return fetch(_apiBase() + "/api/voice/stt", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ audio_b64: b64, mime: mime }),
          });
        }).then(function (r) {
          if (!r.ok) return Promise.reject(r.status === 503 ? "stt-unavailable" : "stt-error");
          return r.json();
        }).then(function (j) {
          resolve((j && j.text) ? String(j.text).trim() : "");
        }).catch(reject);
      };
      try { rec.stop(); } catch (e) { reject("capture-error"); }
    });
  }

  global.LocalVoice = {
    capabilities: capabilities,
    refresh: refresh,
    ttsAvailable: ttsAvailable,
    sttAvailable: sttAvailable,
    speak: speak,
    cancel: cancel,
    pause: pause,
    resume: resume,
    isSpeaking: isSpeaking,
    startListening: startListening,
    stopListening: stopListening,
    cancelListening: cancelListening,
    isListening: isListening,
  };
})(typeof window !== "undefined" ? window : this);
