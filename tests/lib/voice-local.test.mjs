import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadLocalVoice(fetchImpl) {
  const sandbox = {
    console,
    fetch: fetchImpl,
    URL: {
      createObjectURL() {
        return "blob:mock";
      },
      revokeObjectURL() {},
    },
    Audio: class {
      constructor() {
        this.paused = false;
        this.onended = null;
        this.onerror = null;
      }
      play() {
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
    },
  };
  sandbox.window = sandbox;
  const file = path.join(root, "js/voice-local.js");
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

test("LocalVoice capabilities probes GET /api/voice/capabilities", async () => {
  const hits = [];
  const sandbox = loadLocalVoice((url, init) => {
    hits.push({ url, init });
    if (url.endsWith("/api/voice/capabilities")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            tts: { available: true },
            stt: { available: false },
          }),
      });
    }
    return Promise.reject(new Error("unexpected fetch: " + url));
  });
  const caps = await sandbox.LocalVoice.capabilities();
  assert.equal(caps.tts.available, true);
  assert.equal(caps.stt.available, false);
  assert.equal(hits.length, 1);
  assert.match(hits[0].url, /\/api\/voice\/capabilities$/);
});

test("LocalVoice speak rejects with tts-unavailable on POST 503", async () => {
  const sandbox = loadLocalVoice((url, init) => {
    if (url.endsWith("/api/voice/capabilities")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            tts: { available: true },
            stt: { available: false },
          }),
      });
    }
    if (url.endsWith("/api/voice/tts") && init?.method === "POST") {
      return Promise.resolve({ ok: false, status: 503 });
    }
    return Promise.reject(new Error("unexpected fetch: " + url));
  });
  await assert.rejects(() => sandbox.LocalVoice.speak("hello"), /tts-unavailable/);
});

test("LocalVoice speak rejects when capabilities report tts unavailable", async () => {
  const sandbox = loadLocalVoice((url) => {
    if (url.endsWith("/api/voice/capabilities")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            tts: { available: false },
            stt: { available: false },
          }),
      });
    }
    return Promise.reject(new Error("tts should not be called"));
  });
  await assert.rejects(() => sandbox.LocalVoice.speak("hello"), /tts-unavailable/);
});

test("LocalVoice handles failed probes, refresh, empty speech, and unsupported capture", async () => {
  let probes = 0;
  const unavailable = loadLocalVoice(() => {
    probes += 1;
    return Promise.resolve({ ok: false });
  });

  assert.equal(unavailable.LocalVoice.ttsAvailable(), false);
  assert.equal(unavailable.LocalVoice.sttAvailable(), false);
  assert.equal(await unavailable.LocalVoice.speak(null), undefined);
  const first = await unavailable.LocalVoice.capabilities();
  assert.equal(first.tts.available, false);
  await unavailable.LocalVoice.capabilities();
  assert.equal(probes, 1);
  await unavailable.LocalVoice.refresh();
  assert.equal(probes, 2);
  unavailable.LocalVoice.pause();
  unavailable.LocalVoice.resume();
  unavailable.LocalVoice.cancel();
  assert.equal(unavailable.LocalVoice.isSpeaking(), false);
  assert.equal(unavailable.LocalVoice.isListening(), false);
  await assert.rejects(() => unavailable.LocalVoice.startListening(), /stt-unavailable/);
  await assert.rejects(() => unavailable.LocalVoice.stopListening(), /not-listening/);

  const noCapture = loadLocalVoice(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          tts: { available: false },
          stt: { available: true },
        }),
    }),
  );
  await assert.rejects(() => noCapture.LocalVoice.startListening(), /capture-unsupported/);
  noCapture.LocalVoice.cancelListening();
});

test("LocalVoice degrades when the capability request rejects", async () => {
  const sandbox = loadLocalVoice(() => Promise.reject(new Error("offline")));
  const caps = await sandbox.LocalVoice.capabilities();
  assert.equal(caps.tts.available, false);
  assert.equal(caps.stt.available, false);
});

test("LocalVoice plays, pauses, resumes, and cleans up successful TTS audio", async () => {
  let audio;
  const sandbox = loadLocalVoice((url) => {
    if (url.endsWith("/api/voice/capabilities")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, tts: { available: true }, stt: { available: false } }),
      });
    }
    return Promise.resolve({ ok: true, blob: () => Promise.resolve({ size: 4 }) });
  });
  sandbox.Audio = class {
    constructor(src) {
      this.src = src;
      this.paused = false;
      audio = this;
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  };

  const speaking = sandbox.LocalVoice.speak(" hello ");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sandbox.LocalVoice.isSpeaking(), true);
  sandbox.LocalVoice.pause();
  assert.equal(audio.paused, true);
  sandbox.LocalVoice.resume();
  assert.equal(audio.paused, false);
  audio.onended();
  await speaking;
  assert.equal(sandbox.LocalVoice.isSpeaking(), false);
});
