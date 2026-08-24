import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function runFile(rel, sandbox) {
  const file = path.join(root, rel);
  sandbox.window = sandbox.window || sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

test("AgentGateway registry failure, KE gaps, hybrid fallback, and tool picking", async () => {
  const warns = [];
  const sandbox = {
    console: { warn: (m) => warns.push(m) },
    fetch: (url) => {
      if (String(url).includes("knowledge-registry")) {
        return Promise.reject(new Error("offline"));
      }
      if (String(url).includes("/api/ask")) {
        return Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    },
  };
  runFile("js/mcp-suite.js", sandbox);
  runFile("js/agent-gateway.js", sandbox);

  sandbox.AgentGateway.configure({ enabled: true, corpora: ["ke-curriculum"], keAskUrl: "" });
  await sandbox.AgentGateway.loadFromManifest({
    id: "demo",
    contributes: { services: { agent: true } },
  });
  assert.ok(warns.some((w) => /registry unavailable/i.test(w)));

  const noFetch = { console: { warn() {} } };
  runFile("js/agent-gateway.js", noFetch);
  noFetch.AgentGateway.configure({ enabled: true, keAskUrl: "/api/ask" });
  assert.equal(await noFetch.AgentGateway.retrieveFromKe("q"), null);

  sandbox.AgentGateway.configure({
    enabled: true,
    corpora: ["ke-curriculum"],
    keAskUrl: "/api/ask",
  });
  const hybrid = await sandbox.AgentGateway.route({ text: "explain and export report now" });
  assert.equal(hybrid.intent, "act");
  assert.equal(hybrid.handled, false);

  sandbox.__workbenchMcp = { tools: [{ name: "report.summarize" }] };
  sandbox.WebtoolsMcp.listTools = () => sandbox.__workbenchMcp.tools;
  sandbox.WebtoolsMcp.callTool = async () => "done";
  const picked = await sandbox.AgentGateway.act({ text: "summarize quarterly report" });
  assert.equal(picked.tool, "report.summarize");
  assert.equal(picked.handled, true);

  const isolated = { console: { warn() {} } };
  runFile("js/mcp-suite.js", isolated);
  runFile("js/agent-gateway.js", isolated);
  isolated.AgentGateway.configure({ enabled: true });
  isolated.WebtoolsMcp.callTool = undefined;
  const noMcp = await isolated.AgentGateway.act({ text: "summarize", tool: "demo.tool" });
  assert.match(noMcp.note, /WebtoolsMcp unavailable/i);

  isolated.AgentGateway.configure({ enabled: true, corpora: [], keAskUrl: "/api/ask" });
  const learnNoCorpus = await isolated.AgentGateway.route({ text: "how does ROCm work" });
  assert.equal(learnNoCorpus.intent, "learn");
  assert.equal(learnNoCorpus.handled, false);

  sandbox.AgentGateway.installChatInterceptor();
  assert.equal(sandbox.ChatOrb, undefined);
});

test("AgentGateway loadFromManifest resolves keAskUrl from registry corpora", async () => {
  const sandbox = {
    console: { warn() {} },
    fetch: (url) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            corpora: { "ke-curriculum": { httpAsk: "/registry/ask" } },
          }),
      }),
  };
  runFile("js/agent-gateway.js", sandbox);
  await sandbox.AgentGateway.loadFromManifest({
    id: "llm-benchmark",
    contributes: { services: { agent: { enabled: true, corpora: ["ke-curriculum"] } } },
  });
  sandbox.AgentGateway.configure({ enabled: true, corpora: ["ke-curriculum"], keAskUrl: "" });
  await sandbox.AgentGateway.loadFromManifest({
    id: "llm-benchmark",
    contributes: { services: { agent: { enabled: true, corpora: ["ke-curriculum"] } } },
  });
  const result = await sandbox.AgentGateway.route({ text: "what is MI355X" });
  assert.ok(result.intent === "learn" || result.handled === false);
});

test("ExtensionHost boot attaches hooks, nav ARIA, and startup activation", async () => {
  const navBtns = [];
  const panels = [];
  const scripts = [];
  const sandbox = {
    console: { warn() {} },
    URL,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: {
        appendChild(el) {
          scripts.push(el.src);
          el.onload?.();
        },
      },
      querySelector(sel) {
        if (String(sel).includes("data-extension-host-src")) return scripts.length > 1 ? {} : null;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === ".sidebar-nav .nav-btn[data-tab]") return navBtns;
        if (sel === ".tab-panel[role='tabpanel']") return panels;
        return [];
      },
      createElement() {
        return { src: "", setAttribute() {}, onload: null, onerror: null };
      },
    },
    fetch: (url) => {
      const u = String(url);
      if (u.includes("extensions.json") && !u.includes("extension.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              defaultTab: "catalog",
              extensions: [
                {
                  id: "hook-pack",
                  path: "extensions/hook-pack/extension.json",
                  manifest: "../extensions/hook-pack/extension.json",
                },
              ],
            }),
        });
      }
      if (u.includes("extension.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "hook-pack",
              displayName: "Hook Pack",
              main: "main.js",
              activationEvents: ["onStartup"],
              contributes: {
                shellModule: "custom-tab",
                mcp: { tools: [{ name: "hook.ping" }] },
                views: { sidebar: { id: "catalog", label: "Catalog" } },
              },
            }),
        });
      }
      if (u.includes("view.html")) {
        return Promise.resolve({ ok: false, status: 404 });
      }
      return Promise.resolve({ ok: false, status: 404 });
    },
    ShellModules: {
      mods: [],
      init({ modules, render }) {
        this.mods = modules;
        return Promise.resolve();
      },
      get(id) {
        return this.mods.find((m) => m.id === id) || { id, panel: {} };
      },
    },
    WebtoolsExtensions: {
      "hook-pack": {
        mount(panel, ctx) {
          return { panel, ctx };
        },
        onActivate() {},
        onDeactivate() {},
        activate() {
          this.started = true;
        },
      },
    },
  };
  runFile("js/extension-host.js", sandbox);

  navBtns.push({
    getAttribute(k) {
      return k === "data-tab" ? "catalog" : null;
    },
    id: "",
    setAttribute(k, v) {
      if (k === "id") this.id = v;
      if (k === "aria-controls") this.ariaControls = v;
    },
  });
  panels.push({
    id: "panel-catalog",
    setAttribute() {},
  });

  const manifests = await sandbox.ExtensionHost.boot({ catalog: "../data/extensions.json" });
  assert.equal(manifests.length, 1);
  sandbox.ExtensionHost.afterShellModulesRender();
  assert.equal(navBtns[0].id, "tab-catalog");
  assert.equal(sandbox.WebtoolsExtensions["hook-pack"].started, true);
  assert.equal(sandbox.ExtensionHost.list().length, 1);
  assert.equal(sandbox.ExtensionHost.get("missing"), null);
});

test("ExtensionHost init failure and manifest path variants", async () => {
  const sandbox = {
    console: { warn() {} },
    URL,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: { appendChild() {} },
      querySelector() {
        return null;
      },
      createElement() {
        return { setAttribute() {}, onload: null, onerror: null };
      },
    },
    fetch: () => Promise.resolve({ ok: false, status: 500 }),
  };
  runFile("js/extension-host.js", sandbox);
  await sandbox.ExtensionHost.init({ source: "../data/broken.json" });
  assert.equal(sandbox.ExtensionHost.getPanelHtml("x"), "");
});

test("LocalVoice STT capture, stopListening, and error branches", async () => {
  class FakeReader {
    constructor() {
      this.result = "data:audio/wav;base64,abc";
      this.onloadend = null;
    }
    readAsDataURL() {
      queueMicrotask(() => this.onloadend?.());
    }
  }
  class FakeRecorder {
    constructor(_stream, opts) {
      this.mimeType = opts?.mimeType || "audio/webm";
      this.state = "inactive";
      this.ondataavailable = null;
      this.onstop = null;
    }
    static isTypeSupported(type) {
      return type.includes("webm");
    }
    start() {
      this.state = "recording";
      queueMicrotask(() => this.ondataavailable?.({ data: { size: 4 } }));
    }
    stop() {
      this.state = "inactive";
      queueMicrotask(() => this.onstop?.());
    }
  }
  const sandbox = {
    console: { warn() {} },
    CM_API_BASE: "http://127.0.0.1",
    URL: { createObjectURL: () => "blob:stt", revokeObjectURL() {} },
    Audio: class {
      play() {
        return Promise.reject(new Error("play fail"));
      }
      pause() {}
    },
    FileReader: FakeReader,
    Blob: class {
      constructor(parts, opts) {
        this.size = parts.length;
        this.type = opts?.type;
      }
    },
    MediaRecorder: FakeRecorder,
    navigator: {
      mediaDevices: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() {} }] }),
      },
    },
    fetch: (url, init) => {
      const u = String(url);
      if (u.includes("/api/voice/capabilities")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ ok: true, tts: { available: true }, stt: { available: true } }),
        });
      }
      if (u.includes("/api/voice/tts")) {
        return Promise.resolve({ ok: true, blob: () => Promise.resolve(new sandbox.Blob(["x"])) });
      }
      if (u.includes("/api/voice/stt") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ text: "hello world" }) });
      }
      return Promise.reject(new Error(u));
    },
  };
  runFile("js/voice-local.js", sandbox);
  await sandbox.LocalVoice.startListening();
  assert.equal(sandbox.LocalVoice.isListening(), true);
  const text = await sandbox.LocalVoice.stopListening();
  assert.equal(text, "hello world");
  sandbox.LocalVoice.cancelListening();

  await assert.rejects(() => sandbox.LocalVoice.stopListening(), /not-listening/);
  await assert.rejects(
    () =>
      runFile("js/voice-local.js", {
        console: { warn() {} },
        fetch: () =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: false }),
          }),
      }).LocalVoice.speak("hi"),
    /tts-unavailable/
  );
});

test("LocalVoice mic denied and capture unsupported", async () => {
  const sandbox = {
    console: { warn() {} },
    fetch: (url) =>
      url.includes("/api/voice/capabilities")
        ? Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({ ok: true, tts: { available: false }, stt: { available: true } }),
          })
        : Promise.reject(new Error("unexpected")),
  };
  runFile("js/voice-local.js", sandbox);
  await assert.rejects(() => sandbox.LocalVoice.startListening(), /capture-unsupported/);

  const denied = {
    console: { warn() {} },
    MediaRecorder: class {},
    navigator: {
      mediaDevices: {
        getUserMedia: () => Promise.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })),
      },
    },
    fetch: sandbox.fetch,
  };
  runFile("js/voice-local.js", denied);
  await denied.LocalVoice.refresh();
  await assert.rejects(() => denied.LocalVoice.startListening(), /mic-denied/);
});

test("PluginBootstrap resolveScriptPath and no-document loadScript", async () => {
  const sandbox = { console: { warn() {} } };
  runFile("js/plugin-bootstrap.js", sandbox);
  assert.equal(sandbox.PluginBootstrap.resolveExtensionsSource({ contributes: { extensions: ["a", "b"] } }), "");
  const noDoc = { console: { warn() {} } };
  runFile("js/plugin-bootstrap.js", noDoc);
  await noDoc.PluginBootstrap.loadDeferredScripts({ registrations: { slashCommands: "x.js" } }, { chatMount: true });
});

test("Suite carousel controls, install modal, and hash boot", async () => {
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
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
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
    { id: "llm-benchmark", name: "LLM", localUrl: "../llm-benchmark/index.html" },
    { id: "demo-portal", name: "Demo", localUrl: "./index.html", install: { script: "custom.sh", archive: "demo.zip" } },
  ];
  const sandbox = {
    console: { warn() {} },
    addEventListener() {},
    requestAnimationFrame(fn) {
      fn();
    },
    matchMedia(q) {
      return { matches: String(q).includes("reduce") };
    },
    history: { replaceState() {} },
    location: { hash: "#demo-portal", href: "http://127.0.0.1/pages/index.html", hostname: "127.0.0.1" },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    document: {
      readyState: "complete",
      hidden: false,
      activeElement: null,
      body: {
        contains() {
          return true;
        },
        appendChild(el) {
          const stub = {
            className: "",
            innerHTML: "",
            setAttribute() {},
            getAttribute: () => "",
            addEventListener: () => {},
            querySelector(sel) {
              if (sel === "#suiteInstallTitle") return { textContent: "" };
              if (sel === "#suiteInstallCommand") return { textContent: "curl …" };
              if (sel === "#suiteInstallCopy") return { textContent: "Copy", addEventListener: () => {} };
              if (sel === "#suiteInstallDownload") return { href: "#", setAttribute() {}, addEventListener: () => {} };
              if (sel === ".suite-install-modal__close") return { addEventListener: () => {}, focus() {} };
              if (sel === "#suiteInstallDone") return { addEventListener: () => {} };
              return { textContent: "", addEventListener: () => {}, focus() {}, setAttribute() {} };
            },
            querySelectorAll: () => [],
          };
          Object.assign(el, stub);
          byId.installBackdrop = el;
          return el;
        },
        removeChild() {},
      },
      getElementById(id) {
        return byId[id] || el(id);
      },
      querySelectorAll(sel) {
        const toggleEl = () => ({ classList: { toggle() {} }, setAttribute() {} });
        if (sel === ".suite-dot") {
          return [
            { getAttribute: () => "0", addEventListener() {}, classList: { toggle() {} } },
            { getAttribute: () => "1", addEventListener() {}, classList: { toggle() {} } },
          ];
        }
        if (sel === ".suite-tool-card") {
          return [
            {
              getAttribute(k) {
                return k === "data-index" ? "0" : "../demo/index.html";
              },
              classList: { toggle() {} },
              addEventListener(type, fn) {
                if (type === "mouseenter" || type === "focus") fn();
                if (type === "keydown") fn({ key: "Enter", target: { closest: () => null }, preventDefault() {} });
              },
            },
            {
              getAttribute(k) {
                return k === "data-index" ? "1" : "../demo/index.html";
              },
              classList: { toggle() {} },
              addEventListener() {},
            },
          ];
        }
        if (sel === ".suite-pill--install") {
          return [{ getAttribute: () => "demo-portal", addEventListener() {} }];
        }
        if (sel === ".suite-banner-slide") return [toggleEl(), toggleEl()];
        return [];
      },
      querySelector() {
        return null;
      },
      createElement() {
        return el("dynamic");
      },
      addEventListener(type, fn) {
        if (type === "keydown") {
          fn({ key: "ArrowRight", preventDefault() {} });
          fn({ key: "Home", preventDefault() {} });
        }
        if (type === "visibilitychange") fn();
      },
    },
    fetch: () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ plugins }),
      }),
  };
  runFile("js/suite.js", sandbox);
  await new Promise((r) => setTimeout(r, 50));
  if (byId["suite-prev"]._click) byId["suite-prev"]._click();
  if (byId["suite-next"]._click) byId["suite-next"]._click();
  if (byId["suite-banner-viewport"]._mouseenter) byId["suite-banner-viewport"]._mouseenter();
  if (byId["suite-banner-viewport"]._mouseleave) byId["suite-banner-viewport"]._mouseleave();
  assert.match(byId["suite-grid"].innerHTML, /suite-tool-card/);
});

test("ExtensionHost sidebar array shape and script dedupe", async () => {
  const sandbox = {
    console: { warn() {} },
    URL,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: { appendChild(el) { el.onload?.(); } },
      querySelector(sel) {
        return String(sel).includes("already.js") ? {} : null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return { src: "already.js", setAttribute() {}, onload: null, onerror: null };
      },
    },
    fetch: (url) => {
      if (String(url).includes("extensions.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              extensions: [
                { id: "array-sidebar", path: "extensions/array-sidebar/extension.json" },
              ],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "array-sidebar",
            displayName: "Array",
            contributes: { views: { sidebar: ["create"] } },
          }),
      });
    },
  };
  runFile("js/extension-host.js", sandbox);
  assert.equal(
    sandbox.ExtensionHost.toShellModule({
      id: "x",
      contributes: { views: { sidebar: ["create"] } },
    }),
    null
  );
  await sandbox.ExtensionHost.init({ source: "../data/extensions.json" });
});

test("ExtensionHost boot hooksOnly and startup activation errors", async () => {
  const warns = [];
  const sandbox = {
    console: { warn: (m) => warns.push(m) },
    URL,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: { appendChild(el) { el.onerror?.(); el.onload?.(); } },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      createElement() {
        return { src: "", setAttribute() {}, onload: null, onerror: null };
      },
    },
    fetch: (url) => {
      if (String(url).includes("extensions.json")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              extensions: [{ id: "bad-start", path: "extensions/bad-start" }],
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "bad-start",
            main: "missing.js",
            activationEvents: ["onStartup"],
            contributes: { views: { sidebar: { id: "bad", label: "Bad" } } },
          }),
      });
    },
    ShellModules: {
      init({ modules }) {
        this.modules = modules;
        return Promise.resolve();
      },
      get() {
        return null;
      },
    },
    WebtoolsExtensions: {
      "bad-start": {
        activate() {
          throw new Error("boom");
        },
      },
    },
  };
  runFile("js/extension-host.js", sandbox);
  const manifests = await sandbox.ExtensionHost.boot({
    catalog: "../data/extensions.json",
    render: false,
  });
  assert.equal(manifests.length, 1);
  sandbox.ExtensionHost.afterShellModulesRender();
  assert.ok(warns.some((w) => /onStartup failed|no shell module|extension script failed/i.test(w)));
});

test("AgentGateway chat interceptor returns gateway reply when handled", async () => {
  const sandbox = {
    console: { warn() {} },
    fetch: () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ answer: "from KE" }),
      }),
    ChatOrb: {
      run(text) {
        return Promise.resolve({ reply: "orb:" + text });
      },
    },
  };
  runFile("js/agent-gateway.js", sandbox);
  sandbox.AgentGateway.configure({
    enabled: true,
    corpora: ["ke-curriculum"],
    keAskUrl: "/api/ask",
  });
  sandbox.AgentGateway.installChatInterceptor();
  const out = await sandbox.ChatOrb.run("how does training work");
  assert.match(out.reply, /from KE/);
  const fallback = await sandbox.ChatOrb.run("run export now");
  assert.match(fallback.reply, /orb:/);
});

test("LocalVoice tts-error, audio failure, and empty recording", async () => {
  class BadAudio {
    constructor() {
      this.paused = true;
      this.onerror = null;
    }
    play() {
      queueMicrotask(() => this.onerror?.());
      return Promise.resolve();
    }
    pause() {}
  }
  const sandbox = {
    console: { warn() {} },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
    Audio: BadAudio,
    fetch: (url) => {
      if (String(url).includes("/api/voice/capabilities")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, tts: { available: true }, stt: { available: false } }),
        });
      }
      if (String(url).includes("/api/voice/tts")) {
        return Promise.resolve({ ok: false, status: 500 });
      }
      return Promise.reject(new Error(String(url)));
    },
  };
  runFile("js/voice-local.js", sandbox);
  await assert.rejects(() => sandbox.LocalVoice.speak("hello"), /tts-error/);
  assert.equal(sandbox.LocalVoice.isSpeaking(), false);
});

test("PluginBootstrap dedupes already-loaded bootstrap scripts", async () => {
  let loads = 0;
  const sandbox = {
    console: { warn() {} },
    document: {
      head: {
        appendChild(el) {
          loads += 1;
          el.onload?.();
        },
      },
      querySelector() {
        return {};
      },
      createElement() {
        return { src: "", setAttribute() {}, onload: null, onerror: null };
      },
    },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  await sandbox.PluginBootstrap.loadDeferredScripts(
    { registrations: { slashCommands: "chat.js" }, entry: {} },
    { chatMount: true }
  );
  assert.equal(loads, 0);
});

test("AgentGateway retrieve HTTP failure and string MCP replies", async () => {
  const sandbox = {
    console: { warn() {} },
    fetch: (url, init) => {
      if (init && init.method === "POST") {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    },
  };
  runFile("js/mcp-suite.js", sandbox);
  runFile("js/agent-gateway.js", sandbox);
  sandbox.AgentGateway.configure({ enabled: true, keAskUrl: "/api/ask" });
  assert.equal(await sandbox.AgentGateway.retrieveFromKe("q"), null);
  sandbox.WebtoolsMcp.listTools = () => [{ name: "demo.echo" }];
  sandbox.WebtoolsMcp.callTool = async () => "plain text reply";
  const acted = await sandbox.AgentGateway.act({ tool: "demo.echo" });
  assert.equal(acted.reply, "plain text reply");
});

test("LocalVoice capabilities bad JSON and empty STT blob", async () => {
  class FakeRecorder {
    constructor() {
      this.mimeType = "audio/webm";
      this.state = "recording";
      this.onstop = null;
    }
    static isTypeSupported() {
      return false;
    }
    start() {}
    stop() {
      queueMicrotask(() => this.onstop?.());
    }
  }
  const sandbox = {
    console: { warn() {} },
    URL: { createObjectURL: () => "blob:0", revokeObjectURL() {} },
    Blob: class {
      constructor() {
        this.size = 0;
      }
    },
    FileReader: class {
      readAsDataURL() {}
    },
    MediaRecorder: FakeRecorder,
    navigator: {
      mediaDevices: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() {} }] }),
      },
    },
    fetch: (url) => {
      if (String(url).includes("/api/voice/capabilities")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, tts: { available: false }, stt: { available: true } }),
        });
      }
      return Promise.reject(new Error(String(url)));
    },
  };
  runFile("js/voice-local.js", sandbox);
  const caps = await sandbox.LocalVoice.capabilities();
  assert.equal(caps.stt.available, true);
  await sandbox.LocalVoice.startListening();
  await assert.rejects(() => sandbox.LocalVoice.stopListening(), /empty-audio/);
});

test("PluginBootstrap resolveScriptPath normalizes relative script names", async () => {
  const loaded = [];
  const sandbox = {
    console: { warn() {} },
    document: {
      head: {
        appendChild(el) {
          loaded.push(el.src);
          el.onload?.();
        },
      },
      querySelector() {
        return null;
      },
      createElement() {
        return { src: "", setAttribute() {}, onload: null, onerror: null };
      },
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
  assert.ok(loaded.some((s) => s.includes("chat-orb-mount.js")));
  assert.ok(loaded.some((s) => s.includes("voice-local.js")));
});

test("AgentGateway registry HTTP error path", async () => {
  const warns = [];
  const sandbox = {
    console: { warn: (m) => warns.push(String(m)) },
    fetch: () => Promise.resolve({ ok: false, status: 500 }),
  };
  runFile("js/agent-gateway.js", sandbox);
  await sandbox.AgentGateway.loadFromManifest({
    id: "demo",
    contributes: { services: { agent: { enabled: true, corpora: ["ke-curriculum"] } } },
  });
  assert.ok(warns.some((w) => /registry/i.test(w)));
});

test("Suite empty registry surfaces error banner", async () => {
  const grid = { innerHTML: "" };
  const sandbox = {
    console: { warn() {} },
    addEventListener() {},
    location: { hash: "", href: "http://127.0.0.1/", hostname: "127.0.0.1" },
    document: {
      readyState: "complete",
      getElementById(id) {
        return id === "suite-grid" ? grid : { addEventListener() {}, style: {}, children: [], clientWidth: 100, offsetLeft: 0 };
      },
      addEventListener() {},
      querySelectorAll() {
        return [];
      },
      createElement() {
        return { style: {}, setAttribute() {}, classList: { add() {}, remove() {} } };
      },
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ plugins: [] }) }),
  };
  runFile("js/suite.js", sandbox);
  await new Promise((r) => setTimeout(r, 30));
  assert.match(grid.innerHTML, /suite-error/);
});

test("LocalVoice capabilities HTTP not ok defaults to unavailable", async () => {
  const sandbox = {
    console: { warn() {} },
    fetch: () => Promise.resolve({ ok: false, status: 503 }),
  };
  runFile("js/voice-local.js", sandbox);
  const caps = await sandbox.LocalVoice.capabilities();
  assert.equal(caps.tts.available, false);
  assert.equal(caps.stt.available, false);
});

test("LocalVoice refresh clears cached capabilities", async () => {
  let n = 0;
  const sandbox = {
    console: { warn() {} },
    fetch: () => {
      n += 1;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: false }),
      });
    },
  };
  runFile("js/voice-local.js", sandbox);
  await sandbox.LocalVoice.capabilities();
  await sandbox.LocalVoice.refresh();
  await sandbox.LocalVoice.capabilities();
  assert.equal(n, 2);
  assert.equal(sandbox.LocalVoice.ttsAvailable(), false);
});

test("PluginBootstrap wires ExtensionHost when extensions source resolved", async () => {
  let initSource = null;
  const sandbox = {
    console: { warn() {} },
    document: {
      head: { appendChild() {} },
      querySelector() {
        return null;
      },
      createElement() {
        return { src: "", setAttribute() {}, onload: null, onerror: null };
      },
    },
    PluginServices: {
      bootFromManifest() {
        return Promise.resolve({
          id: "ke",
          registrations: { extensions: "ext.json" },
          contributes: {},
        });
      },
    },
    ExtensionHost: {
      init({ source }) {
        initSource = source;
        return Promise.resolve({});
      },
    },
    WebtoolsMcp: { loadFromManifest() {} },
    AgentGateway: { loadFromManifest: () => Promise.resolve() },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  await sandbox.PluginBootstrap.bootstrapFromManifest("../plugin.manifest.json", { chatMount: false });
  assert.equal(initSource, "../data/ext.json");
});

test("PluginBootstrap skips duplicate voice entry when same as voicePersonas", async () => {
  const loaded = [];
  const sandbox = {
    console: { warn() {} },
    document: {
      head: {
        appendChild(el) {
          loaded.push(el.src);
          el.onload?.();
        },
      },
      querySelector() {
        return null;
      },
      createElement() {
        return { src: "", setAttribute() {}, onload: null, onerror: null };
      },
    },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  await sandbox.PluginBootstrap.loadDeferredScripts(
    {
      registrations: { slashCommands: "chat.js", voicePersonas: "js/voice.js" },
      entry: { voice: "js/voice.js" },
    },
    { chatMount: true }
  );
  assert.equal(loaded.length, 1);
});

test("LocalVoice startListening is idempotent while already listening", async () => {
  class FakeRecorder {
    constructor() {
      this.state = "recording";
    }
    static isTypeSupported() {
      return false;
    }
    start() {}
    stop() {}
  }
  const sandbox = {
    console: { warn() {} },
    fetch: (url) =>
      url.includes("/api/voice/capabilities")
        ? Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ ok: true, tts: { available: false }, stt: { available: true } }),
          })
        : Promise.reject(new Error("unexpected")),
    MediaRecorder: FakeRecorder,
    navigator: {
      mediaDevices: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [{ stop() {} }] }),
      },
    },
  };
  runFile("js/voice-local.js", sandbox);
  await sandbox.LocalVoice.startListening();
  await sandbox.LocalVoice.startListening();
  assert.equal(sandbox.LocalVoice.isListening(), true);
  sandbox.LocalVoice.cancelListening();
});

test("Shell setSkin fallback, theme/mode, layout, and tab deep links", () => {
  const storage = {};
  const attrs = {};
  const sandbox = {
    SHELL_PREFIX: "ke",
    localStorage: {
      getItem(k) {
        if (k === "throw") throw new Error("blocked");
        return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null;
      },
      setItem(k, v) {
        storage[k] = v;
      },
    },
    location: { search: "?tab=create", hash: "#tab-legacy", href: "http://127.0.0.1/pages/index.html" },
    history: { pushState() {} },
    URL,
    URLSearchParams,
    CSS: { escape: (s) => s },
    addEventListener: () => {},
    CustomEvent: class {
      constructor(_name, opts) {
        this.detail = opts?.detail;
      }
    },
    document: {
      documentElement: {
        setAttribute(k, v) {
          attrs[k] = v;
        },
      },
      body: {
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        setAttribute(k, v) {
          attrs[k] = v;
        },
        getAttribute(k) {
          return attrs[k] || "dark";
        },
      },
      getElementById(id) {
        if (id === "panel-create") {
          return { classList: { add() {}, remove() {} }, querySelector: () => null };
        }
        return null;
      },
      querySelector(sel) {
        if (String(sel).includes('data-tab="create"')) {
          return { getAttribute: (k) => (k === "data-tab" ? "create" : null) };
        }
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: () => {},
      dispatchEvent: () => true,
    },
  };
  sandbox.window = sandbox;
  runFile("js/shell.js", sandbox);
  sandbox.Shell.setSkin("not-a-skin");
  assert.equal(attrs["data-skin"], "amd-gold");
  sandbox.Shell.setTheme("light");
  sandbox.Shell.setUserMode("expert");
  sandbox.Shell.setLayout("top");
  sandbox.Shell.setCollapsed(true);
  sandbox.Shell.setCollapsed(false);
  sandbox.Shell.switchTab("create", { updateUrl: false });
  assert.equal(storage["ke-skin"], "amd-gold");
});

test("ChatOrb register, dispatch, and handler error paths", async () => {
  const sandbox = {
    console: { warn() {} },
    localStorage: { getItem: () => null, setItem() {} },
    document: {
      body: { appendChild() {} },
      createElement: () => ({
        style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        setAttribute() {},
        appendChild() {},
        addEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => [],
      }),
    },
  };
  sandbox.window = sandbox;
  runFile("js/chat-orb.js", sandbox);
  sandbox.ChatOrb.register("/ping", () => ({ reply: "pong" }));
  const ok = await sandbox.ChatOrb.dispatch("/ping");
  assert.equal(ok.reply, "pong");
  const missing = await sandbox.ChatOrb.dispatch("/missing");
  assert.match(missing.reply, /Unknown command/);
  sandbox.ChatOrb.register("/boom", () => {
    throw new Error("fail");
  });
  const err = await sandbox.ChatOrb.dispatch("/boom");
  assert.match(err.reply, /Error in handler/);
  sandbox.ChatOrb.register("*", (text) => ({ reply: "free:" + text }));
  const free = await sandbox.ChatOrb.dispatch("hello");
  assert.equal(free.reply, "free:hello");
  assert.ok(sandbox.ChatOrb.listCommands().includes("/ping"));
});

test("Suite install modal copy fallback when clipboard fails", async () => {
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
  let copyBtn;
  const plugins = [
    { id: "demo-portal", name: "Demo", localUrl: "./index.html", install: { script: "custom.sh", archive: "demo.zip" } },
  ];
  const sandbox = {
    console: { warn() {} },
    addEventListener() {},
    requestAnimationFrame(fn) {
      fn();
    },
    matchMedia: () => ({ matches: false }),
    history: { replaceState() {} },
    location: { hash: "", href: "http://127.0.0.1/pages/index.html", hostname: "127.0.0.1" },
    navigator: { clipboard: { writeText: () => Promise.reject(new Error("denied")) } },
    document: {
      readyState: "complete",
      hidden: false,
      activeElement: null,
      body: {
        contains: () => true,
        appendChild(el) {
          const stub = {
            className: "",
            innerHTML: "",
            setAttribute() {},
            getAttribute: () => "",
            addEventListener: () => {},
            querySelector(sel) {
              if (sel === "#suiteInstallTitle") return { textContent: "" };
              if (sel === "#suiteInstallCommand") return { textContent: "curl …" };
              if (sel === "#suiteInstallCopy") {
                copyBtn = { textContent: "Copy", addEventListener(_t, fn) { this._click = fn; } };
                return copyBtn;
              }
              if (sel === "#suiteInstallDownload") return { href: "#", setAttribute() {}, addEventListener: () => {} };
              if (sel === ".suite-install-modal__close") return { addEventListener: () => {}, focus() {} };
              if (sel === "#suiteInstallDone") return { addEventListener: () => {} };
              return { textContent: "", addEventListener: () => {}, focus: () => {}, setAttribute() {} };
            },
            querySelectorAll: () => [],
          };
          Object.assign(el, stub);
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
      querySelector: () => null,
      createElement: () => el("dynamic"),
      addEventListener: () => {},
    },
    fetch: () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ plugins }),
      }),
  };
  runFile("js/suite.js", sandbox);
  await new Promise((r) => setTimeout(r, 50));
  if (copyBtn?._click) {
    copyBtn._click();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(copyBtn.textContent, "Select & copy");
  }
});
