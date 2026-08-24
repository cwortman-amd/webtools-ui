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
