import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBrowserSandbox, makeElement } from "./dom-harness.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function runFile(rel, sandbox) {
  const file = path.join(root, rel);
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

test("Shell init binds controls, deep links, shortcuts, and MobileDrawer", () => {
  const sandbox = createBrowserSandbox();
  sandbox.MobileDrawer = { install() {} };
  sandbox.Shortcuts = { registerProvider() {} };
  runFile("js/shell.js", sandbox);

  sandbox.Shell.init();

  sandbox.Shell.setSkin("amd-teal");
  sandbox.Shell.setTheme("light");
  sandbox.Shell.setUserMode("advanced");
  sandbox.Shell.setLayout("top");
  sandbox.Shell.setCollapsed(true);
  sandbox.Shell.setCollapsed(false);
  sandbox.Shell.switchTab("search");

  byIdClick(sandbox, "themeToggleTop");
  byIdClick(sandbox, "collapseToggle");
  byIdClick(sandbox, "skinMenuBtnTop");
  byIdClick(sandbox, "skinToggleSide");
  byIdClick(sandbox, "modeToggleSide");
  byIdClick(sandbox, "navCreate");

  const skinOpt = sandbox._byId.skinOpt;
  skinOpt._click?.();
  const modeOpt = sandbox._byId.modeOpt;
  modeOpt._click?.();

  sandbox.document.dispatchEvent({ type: "click", target: sandbox._byId.heroSkinWrap });
  sandbox._byId.sidebar._sidebarClick?.({ target: sandbox._byId.sidebar, preventDefault() {} });

  const kd = sandbox._docListeners.keydown?.[0];
  if (kd) {
    kd({ ctrlKey: true, metaKey: false, altKey: false, key: "2", preventDefault() {} });
  }

  sandbox._globalListeners.popstate?.[0]?.();
  assert.equal(sandbox._storage["test-skin"], "amd-teal");
});

function byIdClick(sandbox, id) {
  const el = sandbox._byId[id];
  el?._click?.();
}

test("Shell readPref survives blocked localStorage and switchTab lazy iframe", () => {
  const sandbox = createBrowserSandbox();
  runFile("js/shell.js", sandbox);

  sandbox.localStorage.getItem = (k) => {
    throw new Error("blocked");
  };
  sandbox.Shell.init();

  const frame = makeElement("iframe", "lazy-frame", sandbox._byId);
  frame._dataSrc = "../ext/view.html";
  frame.getAttribute = (k) => (k === "data-src" ? "../ext/view.html" : null);
  frame.removeAttribute = () => {};
  sandbox._byId.panelCreate.querySelector = (sel) =>
    String(sel).includes("iframe") ? frame : null;

  sandbox.Shell.switchTab("create", { updateUrl: true });
  assert.equal(frame.src, "../ext/view.html");
});

test("Shell knownTab rejects unknown ids and writeTabToUrl no-ops without history", () => {
  const sandbox = createBrowserSandbox();
  sandbox.history = null;
  runFile("js/shell.js", sandbox);
  sandbox.Shell.switchTab("missing", { updateUrl: true });
  sandbox.Shell.setUserMode("not-a-mode");
  sandbox.Shell.setSkin("glass-dark");
  assert.ok(sandbox.Shell.switchTab);
});

test("ChatOrb mount exercises panel, slash commands, LLM card, and feedback", async () => {
  const storage = Object.create(null);
  const sandbox = createBrowserSandbox({
    navigator: { userAgent: "node-test" },
    localStorage: {
      getItem(k) {
        return storage[k] ?? null;
      },
      setItem(k, v) {
        storage[k] = v;
      },
    },
    open() {},
    voiceBridge: {
      getTTSConfig: () => ({ mode: "cloud" }),
    },
    AgentGateway: {
      configure() {},
      installChatInterceptor() {},
    },
  });
  sandbox.matchMedia = () => ({ matches: false });

  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({
    title: "Test Agent",
    initials: "TA",
    storagePrefix: "slide-presenter",
    showDemoBtn: true,
    showFeedbackBtn: true,
    githubRepo: "amd/test",
    onFeedbackClick() {
      throw new Error("consumer feedback failed");
    },
    agentGateway: true,
    onHelpExtra: () => "Extra help line",
    suggestions: ["/help"],
    voiceComposer: {
      bridge: {
        isSupported: () => true,
        isActive: () => false,
        start: () => true,
        stop() {},
        onTranscript(fn) {
          fn("hello", true);
        },
        onState(fn) {
          fn("listening");
          fn("idle");
        },
        getTTSConfig: () => ({ mode: "local" }),
      },
      registerSlash: true,
      coarseMQ: "(pointer: coarse)",
    },
  });

  sandbox.ChatOrb.open();
  const help = await sandbox.ChatOrb.dispatch("/help");
  assert.match(help.reply, /Commands available/);
  await sandbox.ChatOrb.run("/clear");
  await sandbox.ChatOrb.run("/llm status");
  await sandbox.ChatOrb.run("/llm on");
  await sandbox.ChatOrb.run("/llm off");
  await sandbox.ChatOrb.run("/llm reset");
  await sandbox.ChatOrb.run("/llm settings");
  await sandbox.ChatOrb.run("/llm config");
  await sandbox.ChatOrb.run("/llm configure");
  await sandbox.ChatOrb.run("/llm unknown");
  await sandbox.ChatOrb.run("/feedback");
  await sandbox.ChatOrb.run("/missing-cmd");

  sandbox.ChatOrb.register("/echo", (args) => ({ reply: "echo:" + args }), {
    description: "echo test",
    outOfDomain: true,
  });
  await sandbox.ChatOrb.run("/echo hi");

  const input = sandbox.document.getElementById("chatInput");
  const send = sandbox.document.getElementById("chatSend");
  input.value = "/help";
  send._click?.();

  sandbox.document.getElementById("chatLlmBtn")._click?.();
  sandbox.document.getElementById("chatLlmReset")._click?.();
  sandbox.document.getElementById("chatLlmCancel")._click?.();
  sandbox.document.getElementById("chatLlmHost").value = "localhost";
  sandbox.document.getElementById("chatLlmModel").value = "m";
  sandbox.document.getElementById("chatLlmPath").value = "/v1/chat/completions";
  sandbox.document.getElementById("chatLlmKey").value = "k";
  sandbox.document.getElementById("chatLlmMode").value = "primary";
  sandbox.document.getElementById("chatLlmEnabled").checked = true;
  sandbox.document.getElementById("chatLlmSave")._click?.();

  sandbox.document.getElementById("chatFeedbackBtn")._click?.();
  sandbox.document.getElementById("chatFeedbackText").value = "Bug report";
  sandbox.document.getElementById("chatFeedbackEmail").value = "a@b.c";
  sandbox.document.getElementById("chatFeedbackSubmit")._click?.();
  sandbox.document.getElementById("chatFeedbackCancel")._click?.();

  sandbox.document.getElementById("chatDemoBtn")._click?.();
  sandbox.document.getElementById("chatDemoCancel")?._click?.();

  sandbox.document.getElementById("chatVoiceBtn")._click?.();
  sandbox.document.getElementById("chatClose")._click?.();
  sandbox.document.getElementById("chatOrb")._click?.();

  sandbox.ChatOrb.setLLM({ enabled: true, host: "h" });
  assert.ok(sandbox.ChatOrb.getLLM().enabled);
  sandbox.ChatOrb.print("user", "hi");
  sandbox.ChatOrb.printSystem("sys");
  sandbox.ChatOrb.printAi("ai");
  sandbox.ChatOrb.setBadge("!");
  sandbox.ChatOrb.setTyping(true);
  sandbox.ChatOrb.setTyping(false);
  sandbox.ChatOrb.toggleDemoCard?.();
  sandbox.ChatOrb.openDemoCard?.();
  sandbox.ChatOrb.close();
  sandbox.ChatOrb.unregister("/echo");
  assert.ok(Array.isArray(sandbox.ChatOrb.getHistory()));
});

test("ChatOrb mount idempotent and legacy storage without prefix", async () => {
  const sandbox = createBrowserSandbox({
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: true }),
    visualViewport: {
      height: 600,
      offsetTop: 0,
      addEventListener() {},
    },
  });
  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({ storagePrefix: "" });
  await sandbox.ChatOrb.mount({});
  sandbox.globalThis.dispatchEvent?.({ type: "voicebridge:tts-mode-changed" });
  const esc = await sandbox.ChatOrb.dispatch("<script>");
  assert.ok(esc.reply);
});

test("ChatOrb LLM form API normalizes values and tolerates blocked storage", () => {
  const sandbox = createBrowserSandbox({
    localStorage: {
      getItem() {
        return "{not-json";
      },
      setItem() {
        throw new Error("blocked");
      },
    },
  });
  runFile("js/chat-orb.js", sandbox);

  assert.equal(sandbox.ChatOrb.openAgentSettings(), false);
  sandbox.Shell = {
    openSettings(opts) {
      assert.equal(opts.pane, "agent");
      return "opened";
    },
  };
  assert.equal(sandbox.ChatOrb.openAgentSettings({ returnFocus: "gear" }), "opened");

  const normalized = sandbox.ChatOrb.setLLM({
    host: null,
    model: "  model-a  ",
    path: "",
    key: null,
    mode: "unsupported",
    enabled: 1,
  });
  assert.equal(normalized.host, "");
  assert.equal(normalized.model, "model-a");
  assert.equal(normalized.path, "/v1/chat/completions");
  assert.equal(normalized.key, "");
  assert.equal(normalized.mode, "fallback");
  assert.equal(normalized.enabled, true);
  assert.equal(sandbox.ChatOrb.getLLMForm().keyConfigured, false);

  sandbox.ChatOrb.setLLM({ key: " token ", mode: "primary", enabled: false });
  assert.equal(sandbox.ChatOrb.getLLMForm().keyConfigured, true);
  assert.equal(sandbox.ChatOrb.getLLM().mode, "primary");
  sandbox.ChatOrb.reloadLLM({ key: "another-product:chat-orb:llm:v1" });
  assert.equal(sandbox.ChatOrb.getLLM().key, "token");
  sandbox.ChatOrb.reloadLLM();
  assert.equal(sandbox.ChatOrb.getLLM().key, "");
  assert.equal(sandbox.ChatOrb.resetLLM().enabled, false);
});

test("ChatOrb loads without window and keeps optional Settings hooks guarded", () => {
  const sandbox = createBrowserSandbox({
    localStorage: { getItem: () => null, setItem() {} },
  });
  delete sandbox.window;
  sandbox.Shell = {};
  runFile("js/chat-orb.js", sandbox);

  assert.equal(sandbox.ChatOrb.getStoragePrefix(), "");
  assert.equal(sandbox.ChatOrb.openAgentSettings(null), false);
  assert.equal(sandbox.ChatOrb.setLLM().enabled, false);
  assert.doesNotThrow(() => sandbox.ChatOrb.reloadLLM({}));
  sandbox.document.dispatchEvent = () => {
    throw new Error("events unavailable");
  };
  assert.doesNotThrow(() => sandbox.ChatOrb.setLLM({ host: "guarded" }));
  assert.doesNotThrow(() => sandbox.ChatOrb.reloadLLM());
});

test("ExtensionHost resolveUrl fallbacks, hooks, preload, and init catch", async () => {
  const navBtns = [];
  const panels = [];
  const sandbox = {
    console: { warn() {} },
    URL,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: {
        appendChild(el) {
          el.onload?.();
        },
      },
      querySelector(sel) {
        return String(sel).includes("dedupe.js") ? {} : null;
      },
      querySelectorAll(sel) {
        if (sel === ".sidebar-nav .nav-btn[data-tab]") return navBtns;
        if (sel === ".tab-panel[role='tabpanel']") return panels;
        return [];
      },
      createElement() {
        return { src: "dedupe.js", setAttribute() {}, onload: null, onerror: null };
      },
    },
    fetch: (url) => {
      const u = String(url);
      if (u.includes("extensions.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              defaultTab: "pack",
              extensions: [
                { id: "pack", path: "extensions/pack/extension.json" },
                { id: "bare", enabled: false },
                { id: "nopath" },
              ],
            }),
        });
      }
      if (u.includes("extension.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "pack",
              displayName: "Pack",
              panel: "view.html",
              main: "main.js",
              entry: { scripts: ["dedupe.js"] },
              activationEvents: ["onStartup"],
              contributes: {
                shellModule: "custom-tab",
                mcp: { tools: [{ name: "pack.ping" }] },
                views: { sidebar: { id: "pack", label: "Pack" } },
              },
            }),
        });
      }
      if (u.includes("view.html")) {
        return Promise.resolve({ ok: false, status: 404 });
      }
      return Promise.resolve({ ok: false, status: 500 });
    },
    ShellModules: {
      init({ modules, render }) {
        this.modules = modules;
        return Promise.resolve();
      },
      get(id) {
        return (this.modules || []).find((m) => m.id === id) || { id, panel: {} };
      },
    },
    WebtoolsExtensions: {
      pack: {
        mount(panel, ctx) {
          return { panel, ctx };
        },
        onActivate() {},
        onDeactivate() {},
        activate() {},
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  runFile("js/extension-host.js", sandbox);

  assert.equal(sandbox.ExtensionHost.toShellModule({ id: "x", contributes: { shellModule: "only" } }), null);

  navBtns.push({
    getAttribute(k) {
      return k === "data-tab" ? "pack" : null;
    },
    id: "",
    setAttribute(k, v) {
      if (k === "id") this.id = v;
    },
  });
  panels.push({ id: "panel-pack", setAttribute() {} });

  await sandbox.ExtensionHost.init({ source: "../data/extensions.json" });
  const booted = await sandbox.ExtensionHost.boot({ catalog: "../data/extensions.json" });
  assert.equal(booted.length, 1);
  sandbox.ExtensionHost.afterShellModulesRender();
  assert.ok(sandbox.ExtensionHost.getPanelHtml("pack") === "" || typeof sandbox.ExtensionHost.getPanelHtml("pack") === "string");

  const noDoc = { console: { warn() {} }, URL, location: sandbox.location, fetch: sandbox.fetch };
  noDoc.window = noDoc;
  runFile("js/extension-host.js", noDoc);
});

test("Suite copyText execCommand fallback and autoplay hash navigation", async () => {
  function el(id) {
    return {
      id,
      innerHTML: "",
      textContent: "",
      className: "",
      style: {},
      children: [],
      clientWidth: 640,
      offsetLeft: 0,
      offsetHeight: 1,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      setAttribute() {},
      getAttribute(k) {
        return this[k] || "0";
      },
      addEventListener(type, fn) {
        this[`_${type}`] = fn;
      },
      appendChild(c) {
        this.children.push(c);
        return c;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      focus() {},
    };
  }
  const byId = {};
  ["suite-grid", "suite-banner-track", "suite-dots", "suite-prev", "suite-next", "suite-banner-viewport"].forEach(
    (id) => {
      byId[id] = el(id);
    }
  );
  const plugins = [
    { id: "llm-benchmark", name: "LLM", localUrl: "../llm-benchmark/index.html", tabs: ["queue", "deploy"] },
    { id: "demo-portal", name: "Demo", localUrl: "./index.html" },
    { id: "dc-planner", name: "DC", localUrl: "../dc-planner/index.html" },
  ];
  let intervalFn;
  const sandbox = {
    console: { warn() {} },
    addEventListener() {},
    requestAnimationFrame(fn) {
      fn();
    },
    matchMedia: () => ({ matches: false }),
    history: { replaceState() {} },
    location: { hash: "#llm-benchmark", href: "http://127.0.0.1/pages/index.html", hostname: "127.0.0.1" },
    navigator: {},
    setInterval(fn) {
      intervalFn = fn;
      return 1;
    },
    clearInterval() {},
    document: {
      readyState: "complete",
      hidden: false,
      activeElement: null,
      body: { contains: () => false, appendChild() {}, removeChild() {} },
      getElementById(id) {
        return byId[id] || el(id);
      },
      querySelector: () => null,
      querySelectorAll(sel) {
        if (sel === ".suite-dot") {
          return [{ getAttribute: () => "0", addEventListener() {}, classList: { toggle() {} } }];
        }
        if (sel === ".suite-tool-card") {
          return [
            {
              getAttribute(k) {
                if (k === "data-index") return "0";
                if (k === "data-app-href") return "../demo/index.html";
                return null;
              },
              classList: { toggle() {} },
              addEventListener(type, fn) {
                if (type === "mouseenter") fn();
                if (type === "keydown") {
                  fn({
                    key: " ",
                    target: { closest: () => ({ getAttribute: () => "../demo/index.html" }) },
                    preventDefault() {},
                  });
                }
              },
            },
          ];
        }
        if (sel === ".suite-banner-slide") {
          return [{ classList: { toggle() {} }, setAttribute() {} }];
        }
        return [];
      },
      createElement(tag) {
        const node = el(tag);
        node.select = () => node;
        return node;
      },
      addEventListener(type, fn) {
        if (type === "keydown") {
          fn({ key: "End", preventDefault() {} });
          fn({ key: "ArrowLeft", preventDefault() {} });
        }
        if (type === "visibilitychange") fn();
      },
      execCommand(cmd) {
        return cmd === "copy";
      },
    },
    fetch: () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ plugins }),
      }),
  };
  runFile("js/suite.js", sandbox);
  await new Promise((r) => setTimeout(r, 60));
  if (intervalFn) intervalFn();
  if (byId["suite-next"]._click) byId["suite-next"]._click();
  assert.match(byId["suite-grid"].innerHTML, /suite-tool-card/);
});

test("Shell init collapsed skin/mode menus and outside-click close", () => {
  const sandbox = createBrowserSandbox();
  sandbox.document.body.classList._c.add("nav-collapsed");
  sandbox.document.body.classList._c.add("nav-side");
  runFile("js/shell.js", sandbox);
  sandbox.Shell.init();

  byIdClick(sandbox, "skinToggleSide");
  byIdClick(sandbox, "modeToggleSide");

  const outside = makeElement("div", "outside", sandbox._byId);
  sandbox._byId.heroSkinWrap.contains = () => false;
  const docClick = sandbox._docListeners.click?.[0];
  docClick?.({ target: outside });

  byIdClick(sandbox, "themeToggleTop");
  sandbox.Shell.setTheme("dark");
  assert.ok(sandbox._storage["test-theme"]);
});

test("ChatOrb demo picker, feedback validation, palette, and prompt history", async () => {
  const storage = {
    "slide-presenter:chat-orb:v1": JSON.stringify({
      history: [{ role: "system", text: "prior", html: false, ts: 1 }],
    }),
    "slide-presenter:chat-orb:prompts:v1": JSON.stringify(["/help", "/clear"]),
  };
  let demoSelected = null;
  const sandbox = createBrowserSandbox({
    navigator: { userAgent: "test" },
    getDemoAudiences: () => [{ id: "expert", name: "Expert", time: "15m", desc: "Deep dive" }],
    localStorage: {
      getItem(k) {
        return storage[k] ?? null;
      },
      setItem(k, v) {
        storage[k] = v;
      },
    },
    open: () => {},
  });
  sandbox.matchMedia = (q) => ({ matches: String(q).includes("coarse") });

  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({
    storagePrefix: "slide-presenter",
    showDemoBtn: true,
    showFeedbackBtn: true,
    githubRepo: "amd/test",
    onDemoSelect: (id) => {
      demoSelected = id;
    },
    suggestions: [{ label: "Help", command: "/help", hint: "List commands" }],
  });

  sandbox.ChatOrb.open();
  sandbox.ChatOrb.openDemoCard();
  const list = sandbox.document.getElementById("chatDemoList");
  assert.ok(list && list.children.length > 0, "demo options rendered");
  list.children[0]._click?.();
  assert.equal(demoSelected, "expert");

  sandbox.document.getElementById("chatFeedbackSubmit")._click?.();
  sandbox.document.getElementById("chatFeedbackEmail").value = "bad-email";
  sandbox.document.getElementById("chatFeedbackText").value = "Valid issue description";
  sandbox.document.getElementById("chatFeedbackSubmit")._click?.();

  const input = sandbox.document.getElementById("chatInput");
  const palette = sandbox.document.getElementById("chatPalette");
  const panel = sandbox.document.getElementById("chatPanel");
  const wrap = {
    getBoundingClientRect: () => ({ top: 200, left: 0, width: 100, height: 20 }),
  };
  palette.parentNode = wrap;
  panel.querySelector = (sel) =>
    String(sel).includes("ai-hdr") ? { getBoundingClientRect: () => ({ bottom: 50 }) } : null;
  input.getBoundingClientRect = () => ({ top: 180, left: 0, width: 100, height: 20 });
  input.value = "/h";
  input.dispatchEvent({ type: "input" });
  input.dispatchEvent({
    type: "keydown",
    key: "ArrowDown",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
  });
  input.dispatchEvent({
    type: "keydown",
    key: "ArrowUp",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
  });
  input.value = "/demo x";
  input.dispatchEvent({ type: "keydown", key: "Enter", shiftKey: false, preventDefault() {} });

  sandbox.document.dispatchEvent({ type: "keydown", key: "Escape" });
  sandbox.ChatOrb.register("/demo", () => ({ reply: "demo started" }));
  await sandbox.ChatOrb.run("/demo expert");
});

test("LocalVoice CM_API_BASE prefix and resume after speak", async () => {
  class FakeAudio {
    constructor() {
      this.paused = true;
      this.src = "";
      this.onended = null;
    }
    play() {
      this.paused = false;
      queueMicrotask(() => {
        if (this.onended) this.onended();
      });
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  const sandbox = {
    console: { warn() {} },
    CM_API_BASE: "http://127.0.0.1:9000",
    URL: { createObjectURL: () => "blob:1", revokeObjectURL() {} },
    Audio: FakeAudio,
    fetch: (url) => {
      if (String(url).includes("/api/voice/capabilities")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, tts: { available: true }, stt: { available: false } }),
        });
      }
      if (String(url).includes("/api/voice/tts")) {
        return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["x"])) });
      }
      return Promise.reject(new Error(String(url)));
    },
  };
  runFile("js/voice-local.js", sandbox);
  await sandbox.LocalVoice.capabilities();
  await sandbox.LocalVoice.speak("hello");
  sandbox.LocalVoice.pause();
  sandbox.LocalVoice.resume();
  assert.equal(sandbox.LocalVoice.isSpeaking(), false);
});

test("LocalVoice capabilities ok:false envelope marks engines unavailable", async () => {
  const sandbox = {
    console: { warn() {} },
    fetch: () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: false }),
      }),
  };
  runFile("js/voice-local.js", sandbox);
  const caps = await sandbox.LocalVoice.capabilities();
  assert.equal(caps.tts.available, false);
  assert.equal(caps.stt.available, false);
});

test("PluginBootstrap loadScript append path loads new script URLs", async () => {
  const appended = [];
  const sandbox = {
    console: { warn() {} },
    document: {
      head: {
        appendChild(el) {
          appended.push(el.src);
          el.onload?.();
        },
      },
      querySelector: () => null,
      createElement: () => ({ src: "", setAttribute() {}, onload: null, onerror: null }),
    },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  await sandbox.PluginBootstrap.loadDeferredScripts(
    {
      registrations: { slashCommands: "js/chat-orb-mount.js" },
      entry: { voice: "js/voice-local.js" },
    },
    { chatMount: true }
  );
  assert.equal(appended.length, 2);
});

test("PluginBootstrap loadScript onerror rejects bootstrap failure", async () => {
  const sandbox = {
    console: { warn() {} },
    document: {
      head: {
        appendChild(el) {
          el.onerror?.();
        },
      },
      querySelector: () => null,
      createElement: () => ({ src: "", setAttribute() {}, onload: null, onerror: null }),
    },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  await assert.rejects(
    () =>
      sandbox.PluginBootstrap.loadDeferredScripts(
        { registrations: { slashCommands: "fail.js" }, entry: {} },
        { chatMount: true }
      ),
    /bootstrap script failed/
  );
});

test("Shell hash deep link and localStorage setItem degradation", () => {
  const sandbox = createBrowserSandbox();
  sandbox.location = { search: "", hash: "#tab-search", href: "http://127.0.0.1/pages/index.html" };
  sandbox.localStorage.setItem = () => {
    throw new Error("blocked");
  };
  runFile("js/shell.js", sandbox);
  sandbox.Shell.init();
  sandbox.Shell.switchTab("search", { updateUrl: true });
  sandbox.Shell.setSkin("amd");
  sandbox.Shell.setUserMode("standard");
});

test("ChatOrb onDemoClick override and invalid register guard", async () => {
  let demoClicked = false;
  const sandbox = createBrowserSandbox({
    navigator: { userAgent: "x" },
    localStorage: { getItem: () => null, setItem() {} },
    open: () => {},
  });
  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({
    showDemoBtn: true,
    onDemoClick: () => {
      demoClicked = true;
    },
  });
  sandbox.document.getElementById("chatDemoBtn")._click?.();
  assert.equal(demoClicked, true);
  assert.throws(() => sandbox.ChatOrb.register("bad", () => ({})), /must start with/);
  sandbox.ChatOrb.register("*", (text) => ({ reply: "free:" + text }));
  const wild = await sandbox.ChatOrb.dispatch("plain question");
  assert.match(wild.reply, /free:/);
});

test("ExtensionHost shellModule id and onActivate hook wiring", async () => {
  const sandbox = {
    console: { warn() {} },
    URL,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: { appendChild(el) { el.onload?.(); } },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ src: "", setAttribute() {}, onload: null, onerror: null }),
    },
    fetch: (url) => {
      if (String(url).includes("extensions.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              extensions: [{ id: "mod-pack", path: "extensions/mod-pack" }],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "mod-pack",
            contributes: {
              shellModule: "custom-shell",
              views: { sidebar: { id: "pack", label: "Pack" } },
            },
          }),
      });
    },
    ShellModules: {
      init({ modules }) {
        this.modules = modules;
        return Promise.resolve();
      },
      get(id) {
        return (this.modules || []).find((m) => m.id === id) || { id: "custom-shell", panel: {} };
      },
    },
    WebtoolsExtensions: {
      "mod-pack": {
        onActivate: () => {},
        onDeactivate: () => {},
      },
    },
  };
  sandbox.window = sandbox;
  runFile("js/extension-host.js", sandbox);
  const mod = sandbox.ExtensionHost.toShellModule({
    id: "mod-pack",
    contributes: { shellModule: "custom-shell", views: { sidebar: { id: "pack", label: "P" } } },
  });
  assert.equal(mod.id, "pack");
  await sandbox.ExtensionHost.boot({ catalog: "../data/extensions.json", render: false });
  sandbox.ExtensionHost.afterShellModulesRender();
});

test("ExtensionHost loadScript resolves immediately without document", async () => {
  const noDoc = {
    console: { warn() {} },
    URL,
    location: { href: "http://127.0.0.1/" },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ extensions: [] }) }),
  };
  noDoc.window = noDoc;
  runFile("js/extension-host.js", noDoc);
  await noDoc.ExtensionHost.init({ source: "../data/extensions.json" });
});

test("PluginBootstrap bootstrap wires ExtensionHost when extensions source present", async () => {
  let initCalled = false;
  const sandbox = {
    console: { warn() {} },
    document: {
      head: { appendChild() {} },
      querySelector: () => null,
      createElement: () => ({ src: "", setAttribute() {}, onload: null, onerror: null }),
    },
    PluginServices: {
      bootFromManifest: () =>
        Promise.resolve({
          id: "ke",
          registrations: { extensions: "../data/extensions.json" },
          contributes: {},
        }),
    },
    ExtensionHost: {
      init() {
        initCalled = true;
        return Promise.resolve({});
      },
    },
    WebtoolsMcp: { loadFromManifest: () => {} },
    AgentGateway: { loadFromManifest: () => Promise.resolve() },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  await sandbox.PluginBootstrap.bootstrapFromManifest("../plugin.manifest.json", {
    chatMount: false,
    extensions: true,
  });
  assert.equal(initCalled, true);
});

test("LocalVoice speak skips empty text and rejects tts 503", async () => {
  const sandbox = {
    console: { warn() {} },
    fetch: (url) => {
      if (String(url).includes("/api/voice/capabilities")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, tts: { available: true }, stt: { available: false } }),
        });
      }
      if (String(url).includes("/api/voice/tts")) {
        return Promise.resolve({ ok: false, status: 503 });
      }
      return Promise.reject(new Error(String(url)));
    },
  };
  runFile("js/voice-local.js", sandbox);
  await sandbox.LocalVoice.speak("");
  await assert.rejects(() => sandbox.LocalVoice.speak("hi"), /tts-unavailable/);
});

test("LocalVoice stopListening rejects stt-error on HTTP 500", async () => {
  class FakeRecorder {
    constructor() {
      this.mimeType = "audio/webm";
      this.state = "recording";
      this.onstop = null;
    }
    static isTypeSupported(type) {
      return type.includes("webm");
    }
    start() {}
    stop() {
      this.ondataavailable?.({ data: { size: 1 } });
      queueMicrotask(() => this.onstop?.());
    }
  }
  const sandbox = {
    console: { warn() {} },
    URL: { createObjectURL: () => "blob:0", revokeObjectURL() {} },
    Blob: class {
      constructor(parts, opts) {
        this.size = parts.length;
        this.type = opts?.type;
      }
    },
    FileReader: class {
      readAsDataURL() {
        queueMicrotask(() => this.onloadend?.());
      }
      get result() {
        return "data:audio/wav;base64,abc";
      }
    },
    MediaRecorder: FakeRecorder,
    navigator: {
      mediaDevices: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() {} }] }),
      },
    },
    fetch: (url, init) => {
      if (String(url).includes("/api/voice/capabilities")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, tts: { available: false }, stt: { available: true } }),
        });
      }
      if (init?.method === "POST" && String(url).includes("/api/voice/stt")) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.reject(new Error(String(url)));
    },
  };
  runFile("js/voice-local.js", sandbox);
  await sandbox.LocalVoice.startListening();
  await assert.rejects(() => sandbox.LocalVoice.stopListening(), /stt-error/);
});

test("Suite copyText uses textarea fallback when clipboard missing", async () => {
  function el(id) {
    return {
      id,
      innerHTML: "",
      style: {},
      children: [],
      clientWidth: 640,
      offsetLeft: 0,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      setAttribute() {},
      getAttribute: () => "0",
      addEventListener() {},
      appendChild(c) {
        this.children.push(c);
        return c;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      focus() {},
      select() {},
    };
  }
  const byId = {};
  ["suite-grid", "suite-banner-track", "suite-dots", "suite-prev", "suite-next", "suite-banner-viewport"].forEach(
    (id) => {
      byId[id] = el(id);
    }
  );
  let copyBtn;
  const plugins = [
    { id: "demo-portal", name: "Demo", localUrl: "./index.html", install: { script: "x.sh", archive: "d.zip" } },
  ];
  const sandbox = {
    console: { warn() {} },
    addEventListener() {},
    requestAnimationFrame(fn) {
      fn();
    },
    matchMedia: () => ({ matches: false }),
    history: { replaceState() {} },
    location: { hash: "", href: "http://127.0.0.1/", hostname: "127.0.0.1" },
    navigator: {},
    document: {
      readyState: "complete",
      hidden: false,
      activeElement: null,
      body: {
        contains: () => true,
        appendChild(el) {
          Object.assign(el, {
            querySelector(sel) {
              if (sel === "#suiteInstallCopy") {
                copyBtn = { textContent: "Copy", addEventListener(_t, fn) { this._click = fn; } };
                return copyBtn;
              }
              if (sel === "#suiteInstallTitle") return { textContent: "" };
              if (sel === "#suiteInstallCommand") return { textContent: "curl …" };
              if (sel === "#suiteInstallDownload") return { href: "#", setAttribute() {}, addEventListener() {} };
              if (sel === ".suite-install-modal__close") return { addEventListener() {}, focus() {} };
              if (sel === "#suiteInstallDone") return { addEventListener() {} };
              return { textContent: "", addEventListener() {} };
            },
            querySelectorAll: () => [],
            addEventListener: () => {},
            setAttribute: () => {},
            getAttribute: () => "",
          });
          return el;
        },
        removeChild() {},
      },
      getElementById(id) {
        return byId[id] || el(id);
      },
      querySelectorAll(sel) {
        if (sel === ".suite-pill--install") {
          return [
            {
              getAttribute: () => "demo-portal",
              addEventListener(_t, fn) {
                fn({ preventDefault() {}, stopPropagation() {} });
              },
            },
          ];
        }
        return [];
      },
      createElement: () => el("textarea"),
      execCommand: () => false,
      addEventListener: () => {},
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ plugins }) }),
  };
  runFile("js/suite.js", sandbox);
  await new Promise((r) => setTimeout(r, 50));
  copyBtn?._click?.();
  await new Promise((r) => queueMicrotask(r));
  assert.equal(copyBtn?.textContent, "Select & copy");
});

test("Suite remote hostname uses CDN archive base in install modal", async () => {
  function el(id) {
    return {
      id,
      innerHTML: "",
      style: {},
      children: [],
      clientWidth: 640,
      offsetLeft: 0,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      setAttribute() {},
      getAttribute: () => "0",
      addEventListener() {},
      appendChild(c) {
        this.children.push(c);
        return c;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      focus() {},
    };
  }
  const byId = {};
  ["suite-grid", "suite-banner-track", "suite-dots", "suite-prev", "suite-next", "suite-banner-viewport"].forEach(
    (id) => {
      byId[id] = el(id);
    }
  );
  let downloadHref = "";
  const plugins = [
    { id: "demo-portal", name: "Demo", localUrl: "./index.html", install: { script: "x.sh", archive: "demo.zip" } },
  ];
  const sandbox = {
    console: { warn() {} },
    addEventListener() {},
    requestAnimationFrame(fn) {
      fn();
    },
    matchMedia: () => ({ matches: true }),
    history: { replaceState() {} },
    location: { hash: "", href: "https://example.test/pages/index.html", hostname: "example.test" },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    document: {
      readyState: "complete",
      hidden: false,
      activeElement: null,
      body: {
        contains: () => true,
        appendChild(el) {
          Object.assign(el, {
            querySelector(sel) {
              if (sel === "#suiteInstallDownload") {
                return {
                  href: "",
                  setAttribute() {},
                  addEventListener: () => {},
                  set href(v) {
                    downloadHref = v;
                  },
                  get href() {
                    return downloadHref;
                  },
                };
              }
              if (sel === "#suiteInstallTitle") return { textContent: "" };
              if (sel === "#suiteInstallCommand") return { textContent: "curl …" };
              if (sel === "#suiteInstallCopy") return { textContent: "Copy", addEventListener: () => {} };
              if (sel === ".suite-install-modal__close") return { addEventListener: () => {}, focus() {} };
              if (sel === "#suiteInstallDone") return { addEventListener: () => {} };
              return { textContent: "", addEventListener: () => {} };
            },
            querySelectorAll: () => [],
            addEventListener: () => {},
            setAttribute: () => {},
            getAttribute: () => "",
          });
          return el;
        },
        removeChild() {},
      },
      getElementById(id) {
        return byId[id] || el(id);
      },
      querySelectorAll(sel) {
        if (sel === ".suite-pill--install") {
          return [
            {
              getAttribute: () => "demo-portal",
              addEventListener(_t, fn) {
                fn({ preventDefault() {}, stopPropagation() {} });
              },
            },
          ];
        }
        return [];
      },
      createElement: () => el("dynamic"),
      addEventListener: () => {},
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ plugins }) }),
  };
  runFile("js/suite.js", sandbox);
  await new Promise((r) => setTimeout(r, 50));
  assert.match(downloadHref, /archives\/demo\.zip/);
});

test("Shell setTheme toggles light and dark icon branches", () => {
  const sandbox = createBrowserSandbox();
  const extraSkinOpts = [
    { classList: { toggle() {} }, getAttribute: () => "amd-gold" },
    { classList: { toggle() {} }, getAttribute: () => "amd-teal" },
  ];
  const baseQsa = sandbox.document.querySelectorAll.bind(sandbox.document);
  sandbox.document.querySelectorAll = (sel) => {
    const s = String(sel);
    if (s.includes("material-symbols-outlined")) return [{ textContent: "dark_mode" }];
    if (s.includes("hero-skin-option") || s.includes("side-nav-skin-option")) return extraSkinOpts;
    return baseQsa(sel);
  };
  runFile("js/shell.js", sandbox);
  sandbox.Shell.setTheme("light");
  sandbox.Shell.setTheme("dark");
  sandbox.Shell.setSkin("amd-teal");
  byIdClick(sandbox, "themeToggleTop");
});

test("ChatOrb full surface: suggestions, voice unsupported, feedback misconfig", async () => {
  const sandbox = createBrowserSandbox({
    navigator: { userAgent: "test-agent" },
    localStorage: { getItem: () => null, setItem() {} },
    open: () => {},
    matchMedia: () => ({ matches: false }),
  });
  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({
    storagePrefix: "test",
    showFeedbackBtn: true,
    githubRepo: "",
    voiceComposer: true,
    suggestions: false,
  });
  sandbox.ChatOrb.setSuggestions([{ label: "Ping", command: "/help", hint: "x" }]);
  sandbox.ChatOrb.open();
  await sandbox.ChatOrb.dispatch("/help");
  await sandbox.ChatOrb.dispatch("/clear");
  await sandbox.ChatOrb.dispatch("/llm status");
  sandbox.ChatOrb.setBadge("");
  sandbox.ChatOrb.clear();
  sandbox.document.getElementById("chatFeedbackBtn")._click?.();
  sandbox.document.getElementById("chatFeedbackSubmit")._click?.();
  const voiceBtn = sandbox.document.getElementById("chatVoiceBtn");
  assert.equal(voiceBtn.disabled, true);
});

test("ChatOrb AgentGateway route, html replay, and llm-enabled free text", async () => {
  const storage = {
    "orb:chat-orb:v1": JSON.stringify({
      history: [{ role: "ai", text: "<b>hi</b>", html: true, ts: 1 }],
    }),
  };
  const sandbox = createBrowserSandbox({
    localStorage: {
      getItem(k) {
        return storage[k] ?? null;
      },
      setItem(k, v) {
        storage[k] = v;
      },
    },
    AgentGateway: {
      isEnabled: () => true,
      route: () => Promise.resolve({ handled: true, reply: "gateway reply", html: true }),
    },
  });
  runFile("js/chat-orb.js", sandbox);
  await sandbox.ChatOrb.mount({ storagePrefix: "orb" });
  const routed = await sandbox.ChatOrb.dispatch("explain ROCm");
  assert.equal(routed.reply, "gateway reply");

  sandbox.AgentGateway.isEnabled = () => false;
  sandbox.ChatOrb.setLLM({ enabled: true });
  const llmFree = await sandbox.ChatOrb.dispatch("free text without handler");
  assert.match(llmFree.reply, /LLM mode is enabled/);
  sandbox.ChatOrb.register("/work", () => "string reply");
  await sandbox.ChatOrb.run("/work");
  sandbox.ChatOrb.printAi("html", { html: true });
  assert.equal(await sandbox.ChatOrb.dispatch(""), null);
});

test("Shell skips rebinding nav buttons already wired by ShellModules", () => {
  const sandbox = createBrowserSandbox();
  sandbox._byId.navSearch._shellModulesBound = true;
  runFile("js/shell.js", sandbox);
  sandbox.Shell.init();
  sandbox.Shell.switchTab("search", { updateUrl: false });
});

test("PluginBootstrap loadScript dedupes when script already present", async () => {
  let appendCount = 0;
  const sandbox = {
    console: { warn() {} },
    document: {
      head: {
        appendChild() {
          appendCount += 1;
        },
      },
      querySelector: () => ({}),
      createElement: () => ({ src: "", setAttribute() {}, onload: null, onerror: null }),
    },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  await sandbox.PluginBootstrap.loadDeferredScripts(
    { registrations: { slashCommands: "present.js" }, entry: {} },
    { chatMount: true }
  );
  assert.equal(appendCount, 0);
});

test("ExtensionHost preload panel success and mount hook panel type", async () => {
  const sandbox = {
    console: { warn() {} },
    URL,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: { appendChild(el) { el.onload?.(); } },
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ src: "", setAttribute() {}, onload: null, onerror: null }),
    },
    fetch: (url) => {
      const u = String(url);
      if (u.includes("extensions.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              extensions: [{ id: "mount-pack", path: "extensions/mount-pack" }],
            }),
        });
      }
      if (u.includes("view.html")) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve("<div>panel</div>") });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "mount-pack",
            panel: "view.html",
            main: "main.js",
            contributes: { views: { sidebar: { id: "mount", label: "Mount" } } },
          }),
      });
    },
    ShellModules: {
      init({ modules }) {
        this.modules = modules;
        return Promise.resolve();
      },
      get(id) {
        return (this.modules || []).find((m) => m.id === id) || { id, panel: {} };
      },
    },
    WebtoolsExtensions: {
      "mount-pack": {
        mount: (panel) => panel,
      },
    },
  };
  sandbox.window = sandbox;
  runFile("js/extension-host.js", sandbox);
  await sandbox.ExtensionHost.init({ source: "../data/extensions.json" });
  assert.match(sandbox.ExtensionHost.getPanelHtml("mount-pack"), /panel/);
  await sandbox.ExtensionHost.boot({ catalog: "../data/extensions.json", render: false });
  sandbox.ExtensionHost.afterShellModulesRender();
});

test("PluginBootstrap manifest fetch rejects when PluginServices offline", async () => {
  const sandbox = {
    console: { warn() {} },
    document: {
      head: { appendChild() {} },
      querySelector: () => null,
      createElement: () => ({ src: "", setAttribute() {}, onload: null, onerror: null }),
    },
    fetch: () => Promise.resolve({ ok: false, status: 503 }),
    WebtoolsMcp: { loadFromManifest() {} },
    AgentGateway: { loadFromManifest: () => Promise.resolve() },
    PluginServices: {
      bootFromManifest: () => Promise.reject(new Error("offline")),
    },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  await assert.rejects(
    () => sandbox.PluginBootstrap.bootstrapFromManifest("../plugin.manifest.json", { chatMount: false }),
    /offline/
  );
});
