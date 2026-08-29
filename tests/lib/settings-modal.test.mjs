import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

class MiniEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = !!options.bubbles;
    this.cancelable = !!options.cancelable;
    this.defaultPrevented = false;
    this.button = options.button;
    this.clientX = options.clientX ?? 0;
    this.clientY = options.clientY ?? 0;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._stopped = true; }
}

function matches(node, selector) {
  return selector.split(",").some((part) => {
    const sel = part.trim().replace(/:not\([^)]*\)/g, "");
    if (sel.startsWith("#")) return node.id === sel.slice(1);
    if (sel.startsWith(".")) return node.classList.contains(sel.slice(1));
    const attr = /^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/.exec(sel);
    if (attr) return node.hasAttribute(attr[1]) && (attr[2] == null || node.getAttribute(attr[1]) === attr[2]);
    const tagAttr = /^([a-z]+)(\[.+\])?$/i.exec(sel);
    if (tagAttr) return node.tagName === tagAttr[1].toUpperCase();
    return false;
  });
}

class MiniElement {
  constructor(tagName, document) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.attributes = Object.create(null);
    this.listeners = Object.create(null);
    this.style = {};
    this.hidden = false;
    this.value = "";
    this.checked = false;
    this._text = "";
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force) => {
        if (force === true) classes.add(name);
        else if (force === false) classes.delete(name);
        else if (classes.has(name)) classes.delete(name);
        else classes.add(name);
      },
      toString: () => [...classes].join(" "),
    };
  }
  set id(value) { this.setAttribute("id", value); }
  get id() { return this.getAttribute("id") || ""; }
  set className(value) {
    this.attributes.class = String(value);
    String(value).split(/\s+/).filter(Boolean).forEach((name) => this.classList.add(name));
  }
  get className() { return this.attributes.class || ""; }
  set type(value) { this.setAttribute("type", value); }
  get type() { return this.getAttribute("type") || ""; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
  set innerHTML(html) {
    this.children = [];
    this._text = "";
    const re = /<([a-z][a-z0-9-]*)([^>]*)>/gi;
    let match;
    while ((match = re.exec(String(html)))) {
      if (match[0].startsWith("</")) continue;
      const child = new MiniElement(match[1], this.ownerDocument);
      const attrs = match[2];
      let attr;
      const attrRe = /([:\w-]+)(?:="([^"]*)")?/g;
      while ((attr = attrRe.exec(attrs))) child.setAttribute(attr[1], attr[2] ?? "");
      this.appendChild(child);
    }
  }
  get innerHTML() { return ""; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") this.className = value;
    if (name === "hidden") this.hidden = true;
    if (name === "checked") this.checked = true;
    if (name === "value") this.value = String(value);
    if (name === "id") this.ownerDocument._ids[String(value)] = this;
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "style") this.style = {};
  }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    this.children = this.children.filter((item) => item !== child);
    child.parentNode = null;
  }
  querySelector(selector) { return this.ownerDocument.querySelector(selector); }
  querySelectorAll(selector) { return this.ownerDocument.querySelectorAll(selector); }
  closest(selector) {
    let current = this;
    while (current && current.tagName) {
      if (matches(current, selector)) return current;
      current = current.parentNode;
    }
    return null;
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== fn);
  }
  dispatchEvent(event) {
    if (!event.target) Object.defineProperty(event, "target", { value: this });
    (this.listeners[event.type] || []).forEach((fn) => fn.call(this, event));
    if (event.bubbles && !event._stopped && this.parentNode?.dispatchEvent) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  click() { this.dispatchEvent(new MiniEvent("click", { bubbles: true, cancelable: true })); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { this.dispatchEvent(new MiniEvent("blur", { bubbles: false })); }
  getBoundingClientRect() { return { left: 140, top: 80, width: 920, height: 680 }; }
  insertAdjacentHTML(_position, html) {
    const holder = new MiniElement("div", this.ownerDocument);
    holder.innerHTML = html;
    holder.children.forEach((child) => this.appendChild(child));
  }
  get offsetParent() { return this.hidden ? null : this.ownerDocument.body; }
}

class MiniDocument {
  constructor() {
    this._ids = Object.create(null);
    this.listeners = Object.create(null);
    this.readyState = "complete";
    this.activeElement = null;
    this.documentElement = new MiniElement("html", this);
    this.documentElement.parentNode = this;
    this.body = new MiniElement("body", this);
    this.documentElement.appendChild(this.body);
  }
  createElement(tag) { return new MiniElement(tag, this); }
  getElementById(id) { return this._ids[id] || null; }
  _all() {
    const out = [];
    const visit = (node) => {
      out.push(node);
      node.children.forEach(visit);
    };
    visit(this.documentElement);
    return [...new Set([...out, ...Object.values(this._ids)])];
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { return this._all().filter((node) => matches(node, selector)); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== fn);
  }
  dispatchEvent(event) {
    if (!event.target) Object.defineProperty(event, "target", { value: this });
    (this.listeners[event.type] || []).forEach((fn) => fn.call(this, event));
    return !event.defaultPrevented;
  }
}

function fixture() {
  const document = new MiniDocument();
  document.documentElement.setAttribute("data-theme", "dark");
  document.documentElement.setAttribute("data-skin", "amd-gold");
  document.body.setAttribute("data-theme", "dark");
  document.body.setAttribute("data-skin", "amd-gold");
  const storage = Object.create(null);
  const globalListeners = Object.create(null);
  const sandbox = {
    window: null,
    globalThis: null,
    document,
    navigator: { platform: "Linux", userAgent: "node-test" },
    location: { search: "", hash: "", href: "http://127.0.0.1/pages/index.html" },
    history: { pushState() {}, replaceState() {} },
    localStorage: {
      getItem(key) { return storage[key] ?? null; },
      setItem(key, value) { storage[key] = String(value); },
      removeItem(key) { delete storage[key]; },
    },
    CustomEvent: class extends MiniEvent {
      constructor(type, options = {}) { super(type, options); this.detail = options.detail; }
    },
    Event: MiniEvent,
    MouseEvent: MiniEvent,
    URL,
    URLSearchParams,
    CSS: { escape: (value) => value },
    console: { warn() {}, log() {}, error() {} },
    innerWidth: 1200,
    innerHeight: 800,
    setTimeout,
    clearTimeout,
    requestAnimationFrame(fn) { return setTimeout(fn, 0); },
    cancelAnimationFrame: clearTimeout,
    matchMedia() { return { matches: false }; },
    addEventListener(type, fn) { (globalListeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      globalListeners[type] = (globalListeners[type] || []).filter((item) => item !== fn);
    },
    dispatchEvent(event) {
      (globalListeners[event.type] || []).forEach((fn) => fn(event));
    },
    getComputedStyle: () => ({}),
    SHELL_PREFIX: "settings-test",
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  return { sandbox, document, storage };
}

function run(rel, sandbox) {
  const file = path.join(root, rel);
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
}

async function loadAll() {
  const fx = fixture();
  run("js/shortcuts.js", fx.sandbox);
  run("js/shell.js", fx.sandbox);
  run("js/chat-orb.js", fx.sandbox);
  await fx.sandbox.ChatOrb.mount({ storagePrefix: "settings-test" });
  run("js/settings.js", fx.sandbox);
  return fx;
}

test("Settings opens requested panes, traps Escape, and restores focus", async () => {
  const { sandbox, document } = await loadAll();
  const trigger = document.createElement("button");
  trigger.id = "settingsToggleSide";
  trigger.setAttribute("data-open-settings", "");
  document.body.appendChild(trigger);
  let restored = false;
  trigger.focus = () => { restored = true; };

  trigger.click();
  assert.equal(sandbox.WebtoolsSettings.isOpen(), true);
  sandbox.Shell.closeSettings();
  assert.equal(sandbox.Shell.openSettings({ pane: "agent", returnFocus: trigger }), true);
  assert.equal(document.querySelector("#settingsModal").hidden, false);
  assert.equal(document.querySelector("#pane-agent").classList.contains("active"), true);

  document.querySelector("#settingsModal").dispatchEvent(new sandbox.Event("keydown", { bubbles: true }));
  const escape = new sandbox.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(escape, "key", { value: "Escape" });
  document.querySelector("#settingsModal").dispatchEvent(escape);
  assert.equal(sandbox.WebtoolsSettings.isOpen(), false);
  assert.equal(restored, true);

  const hotkey = new sandbox.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperties(hotkey, {
    key: { value: "," },
    ctrlKey: { value: true },
    metaKey: { value: false },
    altKey: { value: false },
  });
  document.dispatchEvent(hotkey);
  assert.equal(sandbox.WebtoolsSettings.isOpen(), true);
  assert.equal(sandbox.Shell.closeSettings(), true);
});

test("Shell adapter controls appearance and reset without changing ChatOrb storage", async () => {
  const { sandbox, document } = await loadAll();
  const values = { skin: "matte-dark", theme: "dark", "user-mode": "advanced", "nav-collapsed": true };
  const applied = [];
  let resets = 0;
  sandbox.Shell.configure({
    defaults: { skin: "matte-dark" },
    read(key) { return values[key]; },
    apply(key, value) { values[key] = value; applied.push([key, value]); },
    reset() { resets += 1; },
  });
  sandbox.ChatOrb.setLLM({ key: "unchanged" });
  sandbox.Shell.openSettings({ pane: "appearance" });
  assert.equal(sandbox.WebtoolsSettings.mount(), document.querySelector("#settingsModal"));

  const skin = document.querySelector("#settingsSkin");
  skin.value = "amd-teal";
  skin.dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  const theme = document.querySelector("#settingsTheme");
  theme.value = "light";
  theme.dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  const mode = document.querySelector("#settingsUserMode");
  mode.value = "expert";
  mode.dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  const collapsed = document.querySelector("#settingsNavCollapsed");
  collapsed.checked = false;
  collapsed.dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  document.querySelector("#settingsResetShell").click();

  assert.deepEqual(applied, [
    ["skin", "amd-teal"],
    ["theme", "light"],
    ["user-mode", "expert"],
    ["nav-collapsed", false],
  ]);
  assert.equal(resets, 1);
  assert.equal(sandbox.ChatOrb.getLLM().key, "unchanged");
});

test("Agent pane masks, preserves, replaces, clears, and cross-tab syncs API keys", async () => {
  const { sandbox, document, storage } = await loadAll();
  sandbox.ChatOrb.setLLM({
    host: "old-host",
    model: "old-model",
    path: "/v1/chat/completions",
    key: "secret",
    mode: "fallback",
    enabled: false,
  });
  sandbox.Shell.openSettings({ pane: "agent" });

  const orb = document.querySelector("#chatOrb");
  const orbToggle = document.querySelector("#settingsAgentOrbVisible");
  assert.equal(sandbox.ChatOrb.isOrbVisible(), false);
  assert.equal(orb.hidden, true);
  orbToggle.checked = true;
  orbToggle.dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  assert.equal(sandbox.ChatOrb.isOrbVisible(), true);
  assert.equal(orb.hidden, false);

  const key = document.querySelector("#settingsAgentKey");
  assert.equal(key.type, "password");
  assert.equal(key.value, "");
  assert.equal(sandbox.ChatOrb.getLLMForm().key, undefined);
  assert.equal(sandbox.ChatOrb.getLLMForm().keyConfigured, true);

  const host = document.querySelector("#settingsAgentHost");
  host.value = " new-host ";
  host.dispatchEvent(new sandbox.Event("blur", { bubbles: true }));
  assert.equal(sandbox.ChatOrb.getLLM().host, "new-host");
  assert.equal(sandbox.ChatOrb.getLLM().key, "secret");

  key.value = "replacement";
  key.dispatchEvent(new sandbox.Event("input", { bubbles: true }));
  key.dispatchEvent(new sandbox.Event("blur", { bubbles: true }));
  assert.equal(sandbox.ChatOrb.getLLM().key, "replacement");

  document.querySelector("#settingsClearAgentKey").click();
  assert.equal(sandbox.ChatOrb.getLLM().key, "");
  document.querySelector("#settingsAgentMode").value = "primary";
  document.querySelector("#settingsAgentMode").dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  document.querySelector("#settingsAgentEnabled").checked = true;
  document.querySelector("#settingsAgentEnabled").dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  assert.equal(sandbox.ChatOrb.getLLM().mode, "primary");
  assert.equal(sandbox.ChatOrb.getLLM().enabled, true);

  document.querySelector("#settingsResetAgent").click();
  assert.equal(sandbox.ChatOrb.getLLM().enabled, false);
  assert.equal(sandbox.ChatOrb.isOrbVisible(), false);
  assert.equal(orb.hidden, true);

  const storageKey = "settings-test:chat-orb:llm:v1";
  storage[storageKey] = JSON.stringify({ host: "other-tab", key: "other-secret", enabled: true });
  sandbox.dispatchEvent(Object.assign(new sandbox.Event("storage"), { key: "unrelated" }));
  sandbox.dispatchEvent(Object.assign(new sandbox.Event("storage"), { key: storageKey }));
  assert.equal(sandbox.ChatOrb.getLLMForm().host, "other-tab");
  assert.equal(sandbox.ChatOrb.getLLMForm().keyConfigured, true);
  assert.equal(document.querySelector("#settingsAgentKey").value, "");

  const launcherKey = "settings-test:chat-orb:launcher:v1";
  storage[launcherKey] = JSON.stringify({ visible: true });
  sandbox.dispatchEvent(Object.assign(new sandbox.Event("storage"), { key: launcherKey }));
  assert.equal(sandbox.ChatOrb.isOrbVisible(), true);
  assert.equal(document.querySelector("#settingsAgentOrbVisible").checked, true);
});

test("Hotkeys, search, extension panes, window controls, and Agent redirects are live", async () => {
  const { sandbox, document } = await loadAll();
  let rendered = 0;
  assert.equal(sandbox.WebtoolsSettings.registerPane({
    id: "product",
    title: "Product",
    description: "Product-specific settings",
    icon: "extension",
    render(host) {
      rendered += 1;
      host.appendChild(document.createElement("button"));
    },
  }), true);
  assert.equal(sandbox.WebtoolsSettings.registerPane({ id: "product", title: "Duplicate", render() {} }), false);
  assert.equal(sandbox.WebtoolsSettings.registerPane(null), false);

  sandbox.Shell.openSettings({ pane: "keyboard" });
  assert.match(document.querySelector("#settingsHotkeys").textContent, /Open settings/);
  document.querySelector("#settingsOpenShortcuts").click();
  sandbox.Shortcuts.close();

  const search = document.querySelector("#settingsSearchInput");
  search.value = "agent";
  search.dispatchEvent(new sandbox.Event("input", { bubbles: true }));
  search.value = "not-a-real-setting";
  search.dispatchEvent(new sandbox.Event("input", { bubbles: true }));
  search.value = "";
  search.dispatchEvent(new sandbox.Event("input", { bubbles: true }));

  document.querySelector('[data-settings-action="maximize"]').click();
  assert.equal(document.querySelector(".settings-modal").classList.contains("maximized"), true);
  document.querySelector('[data-settings-action="maximize"]').click();
  assert.equal(rendered, 1);

  document.querySelector("#chatLlmBtn").click();
  assert.equal(document.querySelector("#pane-agent").classList.contains("active"), true);
  const reply = await sandbox.ChatOrb.dispatch("/llm configure");
  assert.match(reply.reply, /Agent settings/);
});

test("Settings degrades without Shell or ChatOrb and contains extension failures", () => {
  const { sandbox, document } = fixture();
  run("js/settings.js", sandbox);
  assert.equal(sandbox.WebtoolsSettings.registerPane({
    id: "broken",
    title: "Broken",
    render() { throw new Error("extension failed"); },
  }), true);

  sandbox.WebtoolsSettings.open({ pane: "not-a-pane" });
  assert.equal(document.querySelector("#pane-appearance").classList.contains("active"), true);
  document.querySelector("#settingsSkin").value = "amd";
  document.querySelector("#settingsSkin").dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  sandbox.WebtoolsSettings.selectPane("agent");
  assert.equal(document.querySelector("#pane-agent").classList.contains("is-unavailable"), true);
  document.querySelector("#settingsResetAgent").click();
  document.querySelector("#settingsOpenAgent").click();
  assert.equal(sandbox.WebtoolsSettings.isOpen(), false);
  assert.match(document.querySelector("#pane-broken").textContent, /Could not load/);
});

test("Settings tolerates throwing adapters and exercises focus and pointer geometry", async () => {
  const { sandbox, document } = await loadAll();
  sandbox.Shell.configure({
    read() { throw new Error("blocked read"); },
    apply() { throw new Error("blocked write"); },
    reset() { throw new Error("blocked reset"); },
  });
  sandbox.Shell.openSettings({ pane: "appearance" });
  document.querySelector("#settingsTheme").value = "light";
  document.querySelector("#settingsTheme").dispatchEvent(new sandbox.Event("change", { bubbles: true }));
  document.querySelector("#settingsResetShell").click();

  const modal = document.querySelector(".settings-modal");
  const buttons = document.querySelectorAll("button");
  document.activeElement = buttons[0];
  const shiftTab = new sandbox.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperties(shiftTab, {
    key: { value: "Tab" },
    shiftKey: { value: true },
  });
  modal.dispatchEvent(shiftTab);
  document.activeElement = buttons.at(-1);
  const tab = new sandbox.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperties(tab, {
    key: { value: "Tab" },
    shiftKey: { value: false },
  });
  modal.dispatchEvent(tab);

  const down = new sandbox.Event("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: 200, clientY: 100 });
  document.querySelector("#settingsWindowTitlebar").dispatchEvent(down);
  document.dispatchEvent(new sandbox.Event("pointermove", { cancelable: true, clientX: 240, clientY: 140 }));
  document.dispatchEvent(new sandbox.Event("pointerup"));
  assert.equal(modal.style.position, "fixed");

  const resize = new sandbox.Event("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: 900, clientY: 700 });
  document.querySelector('[data-resize="se"]').dispatchEvent(resize);
  document.dispatchEvent(new sandbox.Event("pointermove", { cancelable: true, clientX: 950, clientY: 750 }));
  document.dispatchEvent(new sandbox.Event("pointercancel"));
  assert.match(modal.style.width, /px$/);

  const wrongButton = new sandbox.Event("pointerdown", { bubbles: true, button: 1 });
  document.querySelector("#settingsWindowTitlebar").dispatchEvent(wrongButton);
  document.querySelector('[data-settings-action="maximize"]').click();
  document.querySelector('[data-resize="nw"]').dispatchEvent(
    new sandbox.Event("pointerdown", { bubbles: true, button: 0 }),
  );
  document.querySelector('[data-settings-action="maximize"]').click();
  document.querySelector('[data-resize="nw"]').dispatchEvent(
    new sandbox.Event("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: 140, clientY: 80 }),
  );
  document.dispatchEvent(new sandbox.Event("pointermove", { cancelable: true, clientX: 100, clientY: 40 }));
  document.dispatchEvent(new sandbox.Event("pointerup"));

  const untouched = document.querySelector("#settingsAgentKey");
  sandbox.WebtoolsSettings.selectPane("agent");
  untouched.dispatchEvent(new sandbox.Event("blur"));
  assert.equal(sandbox.ChatOrb.getLLM().key, "");

  const ignoredHotkey = new sandbox.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperties(ignoredHotkey, {
    key: { value: "," },
    ctrlKey: { value: true },
    altKey: { value: false },
    target: { value: document.querySelector("#settingsSearchInput") },
  });
  document.dispatchEvent(ignoredHotkey);
  document.querySelector('[data-settings-action="minimize"]').click();
  assert.equal(sandbox.WebtoolsSettings.isOpen(), false);
  sandbox.WebtoolsSettings.open();
  document.querySelector("#settingsModal").click();
  assert.equal(sandbox.WebtoolsSettings.isOpen(), false);
});
