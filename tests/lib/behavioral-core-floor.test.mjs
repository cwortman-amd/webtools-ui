import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserSandbox, makeElement } from "./dom-harness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function runFile(rel, sandbox, filenameOverride) {
  const file = path.join(root, rel);
  sandbox.window = sandbox.window || sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: filenameOverride || file });
  return sandbox;
}

function keyEvent(key, extra = {}) {
  return {
    type: "keydown",
    key,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
    ...extra,
  };
}

test("ChatOrb persists isolated LLM state, reloads storage, and recalls prompt history", async () => {
  const storage = {
    "product:chat-orb:llm:v1": JSON.stringify({
      host: " old-host ",
      model: "model-a",
      path: "/custom",
      key: "secret",
      mode: "primary",
      enabled: true,
    }),
    "product:chat-orb:prompts:v1": JSON.stringify(["", 4, "first prompt", "second prompt"]),
  };
  const sandbox = createBrowserSandbox({
    matchMedia: () => ({ matches: false }),
    localStorage: {
      getItem(key) { return storage[key] ?? null; },
      setItem(key, value) { storage[key] = String(value); },
    },
  });
  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({ storagePrefix: " product:: " });

  assert.equal(sandbox.ChatOrb.getStoragePrefix(), " product:: ");
  assert.equal(sandbox.ChatOrb.getLLM().model, "model-a");
  assert.equal(sandbox.ChatOrb.getLLMForm().keyConfigured, true);

  const input = sandbox.document.getElementById("chatInput");
  sandbox.document.getElementById("chatPalette").hidden = true;
  input.value = "draft";
  input.selectionStart = input.value.length;
  input.dispatchEvent(keyEvent("ArrowUp"));
  assert.equal(input.value, "second prompt");
  input.dispatchEvent(keyEvent("ArrowUp"));
  assert.equal(input.value, "first prompt");
  input.dispatchEvent(keyEvent("ArrowDown"));
  assert.equal(input.value, "second prompt");
  input.dispatchEvent(keyEvent("ArrowDown"));
  assert.equal(input.value, "draft");

  input.value = "line one\nline two";
  input.selectionStart = input.value.length;
  const notFirst = keyEvent("ArrowUp");
  input.dispatchEvent(notFirst);
  assert.equal(notFirst.prevented, undefined);
  input.selectionStart = 0;
  const modified = keyEvent("ArrowUp", { ctrlKey: true });
  input.dispatchEvent(modified);
  assert.equal(modified.prevented, undefined);

  input.value = "third prompt";
  sandbox.document.getElementById("chatSend")._click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  input.value = "third prompt";
  sandbox.document.getElementById("chatSend")._click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  storage["product:chat-orb:llm:v1"] = JSON.stringify({ host: "external", enabled: false });
  sandbox._globalListeners.storage[0]({ key: "another:key" });
  assert.notEqual(sandbox.ChatOrb.getLLM().host, "external");
  sandbox._globalListeners.storage[0]({ key: "product:chat-orb:llm:v1" });
  assert.equal(sandbox.ChatOrb.getLLM().host, "external");

  sandbox.localStorage.getItem = () => "{bad json";
  sandbox.ChatOrb.reloadLLM();
  assert.equal(sandbox.ChatOrb.getLLM().path, "/v1/chat/completions");
  sandbox.localStorage.setItem = () => { throw new Error("quota"); };
  assert.doesNotThrow(() => sandbox.ChatOrb.setLLM({
    host: "  next-host  ",
    model: "  next-model ",
    path: " ",
    key: " token ",
    mode: "invalid",
    enabled: 1,
  }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.ChatOrb.getLLM())),
    {
      host: "next-host",
      model: "next-model",
      path: "/v1/chat/completions",
      key: "token",
      mode: "fallback",
      enabled: true,
    },
  );
});

test("ChatOrb voice lifecycle reports failures, transcripts, states, and slash results", async () => {
  let active = false;
  let transcriptListener;
  let stateListener;
  let startCount = 0;
  const bridge = {
    isSupported: () => true,
    isActive: () => active,
    start() {
      startCount += 1;
      if (startCount === 1) return false;
      active = true;
      return true;
    },
    stop() { active = false; },
    onTranscript(fn) { transcriptListener = fn; },
    onState(fn) { stateListener = fn; },
    handleSlash(args) { return Promise.resolve({ text: `voice:${args}` }); },
  };
  const sandbox = createBrowserSandbox({
    matchMedia: () => ({ matches: false }),
    localStorage: { getItem: () => null, setItem() {} },
  });
  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({
    storagePrefix: "voice-product",
    voiceComposer: { bridge, registerSlash: true },
  });

  const button = sandbox.document.getElementById("chatVoiceBtn");
  button._click();
  assert.match(sandbox.document.getElementById("chatVoiceStatus").textContent, /failed|denied/i);
  button._click();
  assert.equal(active, true);
  button._click();
  assert.equal(active, false);

  transcriptListener("[voice error] not-allowed", false);
  transcriptListener("[voice error] audio-capture", false);
  transcriptListener("[voice error] network", false);
  transcriptListener("partial speech", false);
  transcriptListener("", true);
  transcriptListener("final speech", true);
  stateListener("listening");
  stateListener("error", "service-not-allowed");
  stateListener("error", "audio-capture");
  stateListener("error", "network");
  stateListener("idle");

  const slash = await sandbox.ChatOrb.dispatch("/voice status");
  assert.equal(slash.reply, "voice:status");
});

test("ChatOrb coarse pointer lifecycle stops active capture and handles missing voice slash bridge", async () => {
  let active = false;
  const bridge = {
    isSupported: () => true,
    isActive: () => active,
    start() { active = true; return true; },
    stop() { active = false; },
  };
  const sandbox = createBrowserSandbox({
    matchMedia: () => ({ matches: true }),
    localStorage: { getItem: () => null, setItem() {} },
  });
  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({
    voiceComposer: { bridge, registerSlash: true },
  });
  const button = sandbox.document.getElementById("chatVoiceBtn");
  button.dispatchEvent({
    type: "pointerdown", pointerType: "touch", pointerId: 1,
    preventDefault() {}, 
  });
  assert.equal(active, true);
  button.dispatchEvent({ type: "pointerup", pointerType: "touch", preventDefault() {} });
  assert.equal(active, false);
  active = true;
  button.dispatchEvent({ type: "pointercancel" });
  assert.equal(active, false);
  button.dispatchEvent({ type: "pointerdown", pointerType: "mouse", preventDefault() {} });
  button.dispatchEvent({ type: "pointerup", pointerType: "mouse", preventDefault() {} });

  const unavailable = await sandbox.ChatOrb.dispatch("/voice");
  assert.match(unavailable.reply, /unavailable/i);
});

test("ChatOrb product UI contains persistence failures, card lifecycles, and routed command failures", async () => {
  const prompts = Array.from({ length: 55 }, (_, index) => `prompt-${index}`);
  const storage = {
    "product-ui:chat-orb:prompts:v1": JSON.stringify(prompts),
  };
  const warnings = [];
  let routed = 0;
  let voiceStateListener;
  let voiceTranscriptListener;
  let voiceActive = false;
  let voiceStarts = 0;
  const viewportListeners = {};
  let animationFrame;
  const voiceBridge = {
    isSupported: () => true,
    isActive: () => voiceActive,
    start() {
      voiceStarts += 1;
      if (voiceStarts === 1) return false;
      voiceActive = true;
      return true;
    },
    stop() { voiceActive = false; },
    onState(fn) { voiceStateListener = fn; },
    onTranscript(fn) { voiceTranscriptListener = fn; },
    handleSlash(args) { return Promise.resolve({ text: `voice:${args}` }); },
  };
  const sandbox = createBrowserSandbox({
    console: { warn(value) { warnings.push(String(value)); }, log() {} },
    localStorage: {
      getItem(key) { return storage[key] ?? null; },
      setItem(key, value) { storage[key] = String(value); },
    },
    voiceBridge: {
      getTTSConfig() { throw new Error("tts config unavailable"); },
    },
    getDemoAudiences() { throw new Error("catalog unavailable"); },
    DemoAudiences: [
      { id: "coming-soon", name: "Coming soon", tag: "Unavailable" },
      { id: "expert", name: "Expert", time: "15m", desc: "Deep dive" },
    ],
    AgentGateway: {
      isEnabled: () => true,
      route: async ({ text }) => {
        routed += 1;
        return text === "handled request"
          ? { handled: true, reply: "handled reply", html: true }
          : { handled: false };
      },
    },
    innerHeight: 800,
    visualViewport: {
      height: 600,
      offsetTop: 0,
      addEventListener(type, fn) { viewportListeners[type] = fn; },
    },
    requestAnimationFrame(fn) { animationFrame = fn; return 1; },
    matchMedia: (query) => ({ matches: String(query).includes("pointer: coarse") }),
  });
  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({
    storagePrefix: "product-ui",
    showDemoBtn: true,
    showFeedbackBtn: true,
    githubRepo: "",
    onHelpExtra: () => "Product-specific help",
    voiceComposer: { bridge: voiceBridge, registerSlash: true },
  });
  viewportListeners.resize();
  viewportListeners.resize();
  animationFrame();
  sandbox.ChatOrb.register("/demo", (args) => ({ reply: `demo:${args}` }), {
    description: "Start demo",
  });
  sandbox.ChatOrb.register("/other", () => ({ reply: "other" }), {
    description: "Other dashboard command",
    outOfDomain: true,
  });
  sandbox.ChatOrb.register("/reject", () => Promise.reject(new Error("command rejected")));

  sandbox.ChatOrb.open();
  const suggestions = sandbox.document.getElementById("chatMsgs").children.find(
    (child) => child.className === "ai-suggestions",
  );
  suggestions?.children[0]?._click();
  [
    "chatLlmCard",
    "chatFeedbackCard",
    "chatDemoCard",
  ].forEach((id) => {
    const card = sandbox.document.getElementById(id);
    const toggle = card.classList.toggle.bind(card.classList);
    card.classList.toggle = (name, force) => {
      toggle(name, force);
      return card.classList.contains(name);
    };
  });
  sandbox.document.getElementById("chatLlmBtn")._click();
  assert.equal(sandbox.document.getElementById("chatLlmCard").classList.contains("show"), true);
  sandbox.document.getElementById("chatFeedbackBtn")._click();
  sandbox.document.getElementById("chatFeedbackText").value = "Valid feedback without a configured target";
  sandbox.document.getElementById("chatFeedbackSubmit")._click();
  assert.match(sandbox.document.getElementById("chatFeedbackStatus").textContent, /not configured/i);
  const voiceButton = sandbox.document.getElementById("chatVoiceBtn");
  voiceButton._click();
  voiceButton._click();
  voiceButton._click();
  voiceButton.dispatchEvent({
    type: "pointerdown",
    pointerType: "touch",
    pointerId: 7,
    preventDefault() {},
  });
  voiceButton.dispatchEvent({ type: "pointerup", pointerType: "touch", preventDefault() {} });
  voiceActive = true;
  voiceButton.dispatchEvent({ type: "pointercancel" });
  voiceStateListener("idle");
  assert.match(sandbox.document.getElementById("chatVoiceStatus").textContent, /No speech/i);
  voiceTranscriptListener("[voice error] not-allowed", false);
  voiceTranscriptListener("[voice error] audio-capture", false);
  voiceTranscriptListener("[voice error] network", false);
  voiceTranscriptListener("partial", false);
  voiceTranscriptListener("", true);
  voiceTranscriptListener("final", true);
  voiceStateListener("listening");
  voiceStateListener("error", "service-not-allowed");
  voiceStateListener("error", "audio-capture");
  voiceStateListener("error", "network");

  sandbox.ChatOrb.openDemoCard();
  const list = sandbox.document.getElementById("chatDemoList");
  assert.equal(list.children.length, 2);
  list.children[0]._click();
  list.children[1]._click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  const input = sandbox.document.getElementById("chatInput");
  const palette = sandbox.document.getElementById("chatPalette");
  palette.parentNode = { getBoundingClientRect: () => ({ top: 220 }) };
  sandbox.document.getElementById("chatPanel").querySelector = () => ({
    getBoundingClientRect: () => ({ bottom: 60 }),
  });
  input.value = "/o";
  input.dispatchEvent({ type: "input" });
  assert.equal(palette.hidden, false);
  input.dispatchEvent(keyEvent("x"));
  const otherOption = palette.children.find((child) =>
    child.children.some((item) => item.textContent === "/other"));
  otherOption.dispatchEvent({ type: "mousedown", preventDefault() {} });

  input.value = "newest prompt";
  sandbox.document.getElementById("chatSend")._click();
  input.value = "newest prompt";
  sandbox.document.getElementById("chatSend")._click();
  sandbox.document.getElementById("chatPalette").hidden = true;
  input.value = "draft";
  input.selectionStart = input.value.length;
  input.dispatchEvent(keyEvent("ArrowUp"));
  input.dispatchEvent(keyEvent("ArrowUp"));
  input.dispatchEvent(keyEvent("ArrowDown"));
  input.dispatchEvent(keyEvent("ArrowDown"));
  input.dispatchEvent({ type: "blur" });
  input.value = "/help";
  input.dispatchEvent(keyEvent("Enter"));
  const voiceResult = await sandbox.ChatOrb.dispatch("/voice status");
  assert.equal(voiceResult.reply, "voice:status");
  await sandbox.ChatOrb.run("/reject");
  const fallback = await sandbox.ChatOrb.dispatch("route then fall back");
  assert.match(fallback.reply, /don't have a handler/i);
  const handled = await sandbox.ChatOrb.dispatch("handled request");
  assert.equal(handled.reply, "handled reply");
  assert.equal(handled.html, true);
  assert.equal(routed, 4);
  sandbox.AgentGateway.isEnabled = () => false;
  sandbox.ChatOrb.register("*", () => { throw new Error("fallback failed"); });
  const failedFallback = await sandbox.ChatOrb.dispatch("local fallback");
  assert.match(failedFallback.reply, /fallback failed/);
  assert.match(storage["product-ui:chat-orb:prompts:v1"], /newest prompt/);
  sandbox.ChatOrb.setLLM({
    host: " host ",
    model: " model ",
    path: "",
    key: " key ",
    mode: "primary",
    enabled: true,
  });
  const dispatchEvent = sandbox.document.dispatchEvent;
  sandbox.document.dispatchEvent = () => { throw new Error("event target closed"); };
  assert.doesNotThrow(() => sandbox.ChatOrb.setLLM({ mode: "invalid" }));
  sandbox.document.dispatchEvent = dispatchEvent;
  sandbox._globalListeners.storage[0]({ key: "other" });
  storage["product-ui:chat-orb:llm:v1"] = "{malformed";
  sandbox.ChatOrb.reloadLLM();
  assert.equal(sandbox.ChatOrb.getLLM().enabled, false);
  storage["product-ui:chat-orb:llm:v1"] = JSON.stringify({ host: "external" });
  sandbox._globalListeners.storage[0]({ key: "product-ui:chat-orb:llm:v1" });
  assert.equal(sandbox.ChatOrb.getLLM().host, "external");
  sandbox.Shell = { openSettings: () => true };
  const settingsReply = await sandbox.ChatOrb.dispatch("/llm settings");
  assert.match(settingsReply.reply, /Opened Agent settings/);
  assert.match((await sandbox.ChatOrb.dispatch("/llm status")).reply, /LLM agent/);
  assert.match((await sandbox.ChatOrb.dispatch("/llm on")).reply, /enabled/);
  assert.match((await sandbox.ChatOrb.dispatch("/llm off")).reply, /disabled/);
  assert.match((await sandbox.ChatOrb.dispatch("/llm reset")).reply, /defaults/);
  assert.match((await sandbox.ChatOrb.dispatch("/llm unsupported")).reply, /Usage/);
  assert.match((await sandbox.ChatOrb.dispatch("/help")).reply, /Product-specific help/);
});

test("Shell default settings lifecycle persists values and exposes guarded shortcuts", () => {
  const sandbox = createBrowserSandbox();
  let settingsOpened = 0;
  let settingsClosed = 0;
  let shortcutProvider;
  sandbox.Shortcuts = {
    registerProvider(_group, provider) { shortcutProvider = provider; },
  };
  runFile("js/shell.js", sandbox);

  const adapter = sandbox.Shell.getSettingsAdapter();
  assert.equal(adapter.read("unknown"), null);
  adapter.apply("skin", "amd-teal");
  adapter.apply("theme", "light");
  adapter.apply("user-mode", "expert");
  adapter.apply("nav-collapsed", "1");
  adapter.apply("unknown", "ignored");
  adapter.reset();
  assert.equal(sandbox.Shell.openSettings(), false);
  assert.equal(sandbox.Shell.closeSettings(), false);
  sandbox.WebtoolsSettings = {
    open(opts) { settingsOpened += 1; assert.equal(Object.keys(opts).length, 0); },
    close() { settingsClosed += 1; },
  };
  assert.equal(sandbox.Shell.openSettings(), true);
  assert.equal(sandbox.Shell.closeSettings(), true);
  assert.equal(settingsOpened, 1);
  assert.equal(settingsClosed, 1);

  sandbox.Shell.init();
  const handler = sandbox._docListeners.keydown[0];
  handler(keyEvent("1"));
  handler(keyEvent("0", { ctrlKey: true }));
  sandbox._byId.navSearch.disabled = true;
  handler(keyEvent("1", { ctrlKey: true }));
  sandbox._byId.navSearch.disabled = false;
  const valid = keyEvent("1", { ctrlKey: true });
  handler(valid);
  assert.equal(valid.prevented, true);
  const rows = shortcutProvider();
  assert.equal(rows.map((row) => row.keys).join(","), "Ctrl+1,Ctrl+2");
});

test("PluginBootstrap skips unavailable adapters and empty extension sources", async () => {
  let extensionCalls = 0;
  const manifest = { id: "minimal", registrations: {}, contributes: {} };
  const sandbox = {
    console: { warn() {} },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) }),
    PluginServices: { bootFromManifest: "not-a-function" },
    ExtensionHost: {
      init() { extensionCalls += 1; return Promise.resolve(); },
    },
    WebtoolsMcp: { loadFromManifest: "not-a-function" },
    AgentGateway: { loadFromManifest: "not-a-function" },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  const result = await sandbox.PluginBootstrap.bootstrapFromManifest(undefined, {
    extensionsSource: "",
  });
  assert.equal(result.id, "minimal");
  assert.equal(extensionCalls, 0);
  await sandbox.PluginBootstrap.loadDeferredScripts({}, {});
});

test("PluginBootstrap normalizes every supported deferred script path and global fallback", async () => {
  const loaded = [];
  const sandbox = {
    console: { warn() {} },
    document: {
      querySelector: () => null,
      createElement: () => ({ src: "", setAttribute() {}, onload: null, onerror: null }),
      head: {
        appendChild(script) {
          loaded.push(script.src);
          script.onload();
        },
      },
    },
  };
  const file = path.join(root, "js/plugin-bootstrap.js");
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  await sandbox.PluginBootstrap.loadDeferredScripts(
    {
      registrations: { slashCommands: "/absolute/chat.js", voicePersonas: "different.js" },
      entry: { voice: "../shared/voice.js" },
    },
    { chatMount: true },
  );
  await sandbox.PluginBootstrap.loadDeferredScripts(
    {
      registrations: { slashCommands: "https://cdn.example/chat.js" },
      entry: { voice: "voice.js" },
    },
    {},
  );
  assert.equal(
    loaded.join(","),
    "../absolute/chat.js,../shared/voice.js,https://cdn.example/chat.js,../voice.js",
  );
  assert.equal(typeof sandbox.PluginBootstrap.bootstrapFromManifest, "function");
});

function suiteElement(id = "") {
  const listeners = Object.create(null);
  return {
    id,
    innerHTML: "",
    textContent: "",
    className: "",
    style: {},
    children: [],
    clientWidth: 720,
    offsetLeft: 0,
    offsetHeight: 1,
    classList: {
      values: new Set(),
      add(name) { this.values.add(name); },
      remove(name) { this.values.delete(name); },
      toggle(name, force) {
        if (force === true) this.values.add(name);
        else if (force === false) this.values.delete(name);
        else if (this.values.has(name)) this.values.delete(name);
        else this.values.add(name);
      },
      contains(name) { return this.values.has(name); },
    },
    setAttribute(name, value) { this[name] = value; },
    getAttribute(name) { return this[name] ?? null; },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    emit(type, event = {}) {
      (listeners[type] || []).forEach((fn) => fn({
        target: this,
        preventDefault() {},
        stopPropagation() {},
        ...event,
      }));
    },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    removeChild(child) { this.children = this.children.filter((item) => item !== child); },
    querySelector: () => null,
    querySelectorAll: () => [],
    focus() { this.focused = true; },
    select() {},
  };
}

test("Suite product cards, install modal, keyboard, and lifecycle controls remain operable", async () => {
  const ids = Object.create(null);
  ["suite-grid", "suite-banner-track", "suite-dots", "suite-prev", "suite-next", "suite-banner-viewport"]
    .forEach((id) => { ids[id] = suiteElement(id); });
  ids["suite-banner-track"].children = [suiteElement("slide-0"), suiteElement("slide-1")];
  ids["suite-banner-track"].children[1].offsetLeft = 720;

  const dots = [suiteElement("dot-bad"), suiteElement("dot-1")];
  dots[0]["data-index"] = "bad";
  dots[1]["data-index"] = "1";
  const card = suiteElement("card");
  card["data-index"] = "0";
  card["data-app-href"] = "../tool/index.html";
  const install = suiteElement("install");
  install["data-install-id"] = "demo-portal";
  const slides = ids["suite-banner-track"].children;
  const docListeners = Object.create(null);
  const globalListeners = Object.create(null);
  let backdrop;
  let previousFocusRestored = false;
  const previousFocus = { focus() { previousFocusRestored = true; } };
  const modalControls = Object.create(null);

  const document = {
    readyState: "loading",
    hidden: false,
    activeElement: previousFocus,
    body: {
      contains(node) { return node === backdrop; },
      appendChild(node) {
        backdrop = node;
        [
          "suiteInstallTitle", "suiteInstallCommand", "suiteInstallCopy",
          "suiteInstallDownload", "suiteInstallDone",
        ].forEach((id) => { modalControls[id] = suiteElement(id); });
        modalControls.close = suiteElement("close");
        node.querySelector = (selector) => ({
          ".suite-install-modal__close": modalControls.close,
          "#suiteInstallTitle": modalControls.suiteInstallTitle,
          "#suiteInstallCommand": modalControls.suiteInstallCommand,
          "#suiteInstallCopy": modalControls.suiteInstallCopy,
          "#suiteInstallDownload": modalControls.suiteInstallDownload,
          "#suiteInstallDone": modalControls.suiteInstallDone,
        }[selector] || null);
        return node;
      },
      removeChild() {},
    },
    getElementById(id) { return ids[id] || null; },
    querySelectorAll(selector) {
      if (selector === ".suite-dot") return dots;
      if (selector === ".suite-tool-card") return [card];
      if (selector === ".suite-pill--install") return [install];
      if (selector === ".suite-banner-slide") return slides;
      return [];
    },
    createElement(tag) { return suiteElement(tag); },
    execCommand: () => true,
    addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      docListeners[type] = (docListeners[type] || []).filter((item) => item !== fn);
    },
    dispatch(type, event = {}) {
      (docListeners[type] || []).slice().forEach((fn) => fn({ type, ...event }));
    },
  };
  const plugins = [
    { id: "demo-portal", name: "Demo", localUrl: "./index.html" },
    { id: "custom", name: "Custom", localUrl: "../custom/index.html", description: "Custom product" },
  ];
  const sandbox = {
    console: { warn() {} },
    document,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    location: { hash: "#custom", href: "http://127.0.0.1/pages/index.html", hostname: "127.0.0.1" },
    history: { replaceState() {} },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(fn) { fn(); },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(fn) { fn(); },
    addEventListener(type, fn) { (globalListeners[type] ||= []).push(fn); },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ plugins }) }),
  };
  runFile("js/suite.js", sandbox);
  assert.equal(ids["suite-grid"].innerHTML, "");
  document.dispatch("DOMContentLoaded");
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.match(ids["suite-grid"].innerHTML, /suite-tool-card/);

  dots[0].emit("click");
  dots[1].emit("click");
  card.emit("click", { target: { closest: () => ({}) } });
  card.emit("click", { target: { closest: () => null } });
  assert.equal(sandbox.location.href, "../tool/index.html");
  card.emit("keydown", { key: "x", target: { closest: () => null } });
  card.emit("keydown", { key: "Enter", target: { closest: () => ({}) } });
  card.emit("keydown", { key: " ", target: { closest: () => null } });

  install.emit("click");
  assert.equal(backdrop["aria-hidden"], "false");
  modalControls.suiteInstallCopy.emit("click");
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(modalControls.suiteInstallCopy.textContent, "Copy");
  backdrop.emit("click", { target: backdrop });
  assert.equal(previousFocusRestored, true);

  install.emit("click");
  document.dispatch("keydown", { key: "Escape" });
  install.emit("click");
  modalControls.suiteInstallDone.emit("click");
  globalListeners.resize[0]();
  document.hidden = true;
  document.dispatch("visibilitychange");
  document.hidden = false;
  document.dispatch("visibilitychange");
});
