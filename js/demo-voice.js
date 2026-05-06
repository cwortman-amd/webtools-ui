/*!
 * webtools-ui canonical asset: demo-voice.js
 *
 * PROMOTED in harmonization Phase 5.1 — was dc-planner/js/demo-voice.js,
 * now the single source of truth for narrated-demo voice across all 3
 * sibling consumers. Loaded as `../shared/js/demo-voice.js`. Phase 6 will
 * fold in cluster-manager's STT + wake-word capability and llm-benchmark's
 * persona / phonetic-overrides layer.
 *
 * --- (original header below) ---
 *
 * Demo Voice
 *
 * Thin wrapper around the browser's SpeechSynthesis API so the demo
 * engine can speak narration, listen for sentence boundaries (to
 * highlight transcript lines in sync), and pause / resume / cancel
 * cleanly. P0 scope is browser-native voice only — no remote TTS — so
 * the cockpit stays offline-capable and zero-egress.
 *
 * Public API: window.DemoVoice.create(opts) → instance with
 *   speak(text)   – returns a promise that resolves when utterance ends
 *   pause()       – pause current utterance
 *   resume()      – resume a paused utterance
 *   cancel()      – stop and flush queue
 *   onBoundary(fn) – fn(charIndex, text) fires on word/sentence boundaries
 *   isSpeaking()
 */
(function () {
  "use strict";

  const SUPPORTED = typeof window !== "undefined"
    && typeof window.speechSynthesis !== "undefined"
    && typeof window.SpeechSynthesisUtterance !== "undefined";

  function pickVoice(preferred) {
    if (!SUPPORTED) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    if (Array.isArray(preferred)) {
      for (const name of preferred) {
        const hit = voices.find(v => v.name === name);
        if (hit) return hit;
      }
      for (const name of preferred) {
        const partial = voices.find(v =>
          v.name.toLowerCase().includes(String(name).toLowerCase())
        );
        if (partial) return partial;
      }
    }
    const enUS = voices.find(v => /en[-_]US/i.test(v.lang));
    return enUS || voices.find(v => /^en/i.test(v.lang)) || voices[0];
  }

  function whenVoicesReady() {
    if (!SUPPORTED) return Promise.resolve([]);
    const synth = window.speechSynthesis;
    const ready = synth.getVoices();
    if (ready && ready.length) return Promise.resolve(ready);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(synth.getVoices() || []);
      };
      synth.addEventListener("voiceschanged", finish, { once: true });
      setTimeout(finish, 800);
    });
  }

  function create(opts) {
    const cfg = Object.assign({
      preferred_voices: [],
      rate: 0.95,
      pitch: 1.0,
      volume: 1.0
    }, opts || {});

    const boundaryHandlers = new Set();
    let currentUtterance = null;
    let muted = false;
    let voicesReadyPromise = whenVoicesReady();

    function onBoundary(fn) {
      if (typeof fn === "function") boundaryHandlers.add(fn);
      return () => boundaryHandlers.delete(fn);
    }

    function speak(text) {
      if (!SUPPORTED || !text) {
        return Promise.resolve({ ok: false, reason: "unsupported-or-empty" });
      }
      // Muted: still resolve so the engine's playback loop can advance,
      // but skip the actual synthesis call entirely. The engine's
      // boundary-driven UI progress is keyed off speech events, so when
      // muted we synthesize an immediate end-of-utterance.
      if (muted) {
        return Promise.resolve({ ok: true, reason: "muted" });
      }
      return voicesReadyPromise.then(() => new Promise((resolve) => {
        const synth = window.speechSynthesis;
        try { synth.cancel(); } catch (_) { /* noop */ }

        const utt = new SpeechSynthesisUtterance(text);
        utt.rate = cfg.rate;
        utt.pitch = cfg.pitch;
        utt.volume = cfg.volume;
        const voice = pickVoice(cfg.preferred_voices);
        if (voice) utt.voice = voice;

        utt.onboundary = (ev) => {
          const ci = typeof ev.charIndex === "number" ? ev.charIndex : 0;
          boundaryHandlers.forEach(fn => {
            try { fn(ci, text); } catch (e) { /* swallow */ }
          });
        };
        utt.onend = () => {
          currentUtterance = null;
          resolve({ ok: true });
        };
        utt.onerror = (ev) => {
          currentUtterance = null;
          resolve({ ok: false, reason: ev.error || "speech-error" });
        };

        currentUtterance = utt;
        try {
          synth.speak(utt);
        } catch (e) {
          currentUtterance = null;
          resolve({ ok: false, reason: String(e && e.message || e) });
        }
      }));
    }

    function pause() {
      if (!SUPPORTED) return false;
      try { window.speechSynthesis.pause(); return true; } catch (_) { return false; }
    }

    function resume() {
      if (!SUPPORTED) return false;
      try { window.speechSynthesis.resume(); return true; } catch (_) { return false; }
    }

    function cancel() {
      if (!SUPPORTED) return false;
      try {
        window.speechSynthesis.cancel();
        currentUtterance = null;
        return true;
      } catch (_) { return false; }
    }

    function isSpeaking() {
      return !!(SUPPORTED && window.speechSynthesis.speaking);
    }

    function setMuted(flag) {
      muted = !!flag;
      // When entering muted state mid-utterance, cancel speech so the
      // audience doesn't hear the tail of whatever was already queued.
      if (muted) cancel();
      return muted;
    }

    function isMuted() { return muted; }

    return {
      speak,
      pause,
      resume,
      cancel,
      onBoundary,
      isSpeaking,
      setMuted,
      isMuted,
      isSupported: () => SUPPORTED
    };
  }

  window.DemoVoice = { create, isSupported: () => SUPPORTED };
})();
