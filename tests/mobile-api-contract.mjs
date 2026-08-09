#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class Classes {
  constructor() { this.values = new Set(); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.values.has(name) : !!force;
    next ? this.values.add(name) : this.values.delete(name);
    return next;
  }
}

function element() {
  const listeners = {};
  return {
    nodeType: 1,
    style: { position: "", top: "", width: "", overflow: "" },
    attrs: {},
    classList: new Classes(),
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    emit(type, event = {}) {
      for (const fn of listeners[type] || []) fn({ stopPropagation() {}, ...event });
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name]; },
  };
}

const menu = element();
const backdrop = element();
const drawer = element();
const body = element();
let scrollY = 240;
const mediaListeners = [];
const media = {
  matches: true,
  addEventListener(type, fn) { if (type === "change") mediaListeners.push(fn); },
};
const selectors = { "#menu": menu, "#backdrop": backdrop, "#drawer": drawer };
const documentListeners = {};
const context = {
  console,
  setTimeout(fn) { fn(); return 1; },
  document: {
    body,
    currentScript: null,
    documentElement: { scrollTop: 0 },
    getElementById() { return null; },
    querySelector(selector) { return selectors[selector] || null; },
    addEventListener(type, fn) { (documentListeners[type] ||= []).push(fn); },
  },
  matchMedia() { return media; },
  addEventListener() {},
  get pageYOffset() { return scrollY; },
  scrollTo(_x, y) { scrollY = y; },
};
context.window = context;

vm.runInNewContext(
  fs.readFileSync(path.join(root, "js/mobile-drawer.js"), "utf8"),
  context,
  { filename: "mobile-drawer.js" }
);

const handle = context.MobileDrawer.install({
  menuBtn: "#menu",
  backdrop: "#backdrop",
  drawer: "#drawer",
  closeOnTap: ".nav-btn,.util-btn",
});
assert.ok(handle, "selector-based installation returns a handle");
assert.equal(menu.getAttribute("aria-expanded"), "false");
assert.equal(drawer.getAttribute("aria-hidden"), "true");

assert.equal(context.MobileDrawer.install({
  menuBtn: "#menu", backdrop: "#backdrop", drawer: "#drawer",
}), handle, "double installation returns the existing handle");

menu.emit("click");
assert.equal(handle.isOpen(), true);
assert.equal(body.style.position, "fixed", "mobile open pins body scroll");
assert.equal(menu.getAttribute("aria-expanded"), "true");
assert.equal(drawer.getAttribute("aria-hidden"), "false");

backdrop.emit("click");
assert.equal(handle.isOpen(), false);
assert.equal(body.style.position, "", "close restores body style");
assert.equal(scrollY, 240, "close restores scroll position");

media.matches = false;
for (const fn of mediaListeners) fn({ matches: false });
assert.equal(drawer.getAttribute("aria-hidden"), "false", "desktop sidebar is exposed to AT");
handle.open();
assert.equal(handle.isOpen(), false, "desktop install does not create overlay state");

const chatSource = fs.readFileSync(path.join(root, "js/chat-orb.js"), "utf8");
const chatCss = fs.readFileSync(path.join(root, "css/chat-orb.css"), "utf8");
assert.match(chatSource, /voiceComposer:\s*false/, "voice composer remains opt-in");
assert.match(chatSource, /bridge\.onTranscript/, "recognized speech updates accessible state");
assert.match(chatSource, /bridge\.onState/, "recognition lifecycle updates permission/no-speech state");
assert.match(chatSource, /bridge\.handleSlash/, "optional shared voice slash route exists");
assert.match(chatSource, /pointerdown/, "coarse-pointer hold interaction exists");
assert.match(chatCss, /\.ai-voice\.is-listening/, "shared listening state is styled");
assert.match(chatCss, /touch-action:\s*none/, "touch push-to-talk avoids gesture leakage");

console.log("mobile-api-contract: all assertions passed");
