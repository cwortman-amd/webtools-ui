import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadPitchNarration() {
  const sandbox = {
    window: {},
    document: {
      createElement() {
        return { innerHTML: "", value: "" };
      },
    },
    console,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/pitch-narration.js"), "utf8"), sandbox);
  return sandbox.PitchNarration;
}

test("stripForSpeech removes markdown and entities", () => {
  const pn = loadPitchNarration();
  const out = pn.stripForSpeech("**Bold** and `code` &amp; text");
  assert.match(out, /Bold/);
  assert.doesNotMatch(out, /\*\*/);
  assert.doesNotMatch(out, /`/);
});

test("splitChunks respects max length", () => {
  const pn = loadPitchNarration();
  const long = "Sentence one. ".repeat(40).trim();
  const chunks = pn.splitChunks(long, 80);
  assert.ok(chunks.length > 1);
  chunks.forEach((c) => assert.ok(c.length <= 80, `chunk too long: ${c.length}`));
});

test("formatNotesHtml wraps paragraphs", () => {
  const pn = loadPitchNarration();
  const html = pn.formatNotesHtml("First paragraph.\n\nSecond **bold** line.");
  assert.match(html, /<p>/);
  assert.match(html, /<strong>bold<\/strong>/);
});
