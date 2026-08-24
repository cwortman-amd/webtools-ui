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

test("AgentGateway retrieve, act, manifest, interceptor, and hybrid fallback", async () => {
  const sandbox = {
    console,
    fetch: (url, init) => {
      if (String(url).includes("knowledge-registry")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ corpora: { "ke-curriculum": { httpAsk: "/api/ask" } } }),
        });
      }
      if (init && init.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ answer: "cited", sources: ["a"] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    },
  };
  runFile("js/mcp-suite.js", sandbox);
  runFile("js/agent-gateway.js", sandbox);

  assert.equal(sandbox.AgentGateway.classify(""), "act");
  sandbox.AgentGateway.configure({
    enabled: true,
    productId: "llm-benchmark",
    corpora: ["ke-curriculum"],
    keAskUrl: "/api/ask",
  });
  assert.equal(sandbox.AgentGateway.isEnabled(), true);
  const retrieved = await sandbox.AgentGateway.retrieve("What is ROCm?");
  assert.ok(retrieved);

  const noTools = await sandbox.AgentGateway.act({ text: "summarize nothing" });
  assert.equal(noTools.handled, false);

  sandbox.__workbenchMcp = { tools: [{ name: "report.summarize" }] };
  sandbox.WebtoolsMcp.callTool = async () => ({ ok: true });
  const acted = await sandbox.AgentGateway.act({ text: "please summarize the report", params: { q: 1 } });
  assert.equal(acted.handled, true);

  sandbox.WebtoolsMcp.callTool = async () => {
    throw new Error("boom");
  };
  const failed = await sandbox.AgentGateway.act({ tool: "report.summarize" });
  assert.equal(failed.handled, false);

  await sandbox.AgentGateway.loadFromManifest({
    id: "knowledge-exchange",
    contributes: { services: { agent: { enabled: true, corpora: ["ke-curriculum"] } } },
  });
  assert.equal(sandbox.AgentGateway.isEnabled(), false);

  sandbox.AgentGateway.configure({ enabled: true, keAskUrl: "/api/ask", corpora: ["ke-curriculum"] });
  sandbox.ChatOrb = { run: async (text) => ({ reply: "fallback:" + text }) };
  sandbox.AgentGateway.installChatInterceptor();
  sandbox.AgentGateway.installChatInterceptor();
  const intercepted = await sandbox.ChatOrb.run("Explain ROCm");
  assert.ok(intercepted.reply);

  sandbox.AgentGateway.configure({ enabled: false });
  const off = await sandbox.AgentGateway.route({ text: "how does this work" });
  assert.equal(off.handled, false);
});

test("WebtoolsMcp manifest, extension handlers, bridge map, and missing transport", async () => {
  const sandbox = {
    console: { warn() {} },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ result: { n: 1 } }) }),
    agentBridge: {
      getMap() {
        return { mcp_tools: ["bridge.ping"] };
      },
      call(method, params) {
        return { method, params };
      },
    },
    WebtoolsExtensions: {
      "im-report": { mcpHandlers: { "report.summarize": (p) => ({ ok: true, p }) } },
    },
    __workbenchMcp: { tools: [{ name: "wb.tool" }] },
  };
  runFile("js/mcp-suite.js", sandbox);
  sandbox.WebtoolsMcp.loadFromManifest(null);
  sandbox.WebtoolsMcp.loadFromManifest({
    id: "llm-benchmark",
    contributes: { services: { mcp: { enabled: true } } },
    registrations: { mcp: { http: "/mcp", browserBridge: true } },
  });
  const names = sandbox.WebtoolsMcp.listTools().map((t) => t.name);
  assert.ok(names.includes("wb.tool"));
  const ext = await sandbox.WebtoolsMcp.callTool("report.summarize", { q: 1 });
  assert.equal(ext.ok, true);
  await sandbox.WebtoolsMcp.call("bridge.ping", { a: 1 });

  const isolated = { console, fetch: undefined };
  runFile("js/mcp-suite.js", isolated);
  isolated.WebtoolsMcp.configure({ enabled: true, registration: { http: "" } });
  await assert.rejects(() => isolated.WebtoolsMcp.call("x"), /No MCP transport/);
});

test("PluginBootstrap adapters, script skip/error, and HTTP failure", async () => {
  const sandbox = {
    console,
    document: {
      head: {
        appendChild(el) {
          if (String(el.src).includes("fail.js")) el.onerror?.();
          else el.onload?.();
        },
      },
      querySelector(sel) {
        return String(sel).includes("already.js") ? {} : null;
      },
      createElement() {
        return { src: "", setAttribute() {}, onload: null, onerror: null };
      },
    },
    fetch: () => Promise.resolve({ ok: false, status: 500 }),
    WebtoolsPlatform: {},
    WebtoolsMcp: {
      seen: null,
      loadFromManifest(m) {
        this.seen = m;
      },
    },
    AgentGateway: {
      seen: null,
      loadFromManifest(m) {
        this.seen = m;
        return Promise.resolve(m);
      },
    },
  };
  runFile("js/plugin-bootstrap.js", sandbox);
  assert.equal(typeof sandbox.WebtoolsPlatform.bootstrapFromManifest, "function");

  await sandbox.PluginBootstrap.loadDeferredScripts(
    { registrations: { slashCommands: "https://cdn.example/chat.js" }, entry: { voice: "js/voice.js" } },
    { chatMount: true }
  );
  await sandbox.PluginBootstrap.loadDeferredScripts(
    { registrations: { slashCommands: "already.js" }, entry: {} },
    { chatMount: true }
  );
  await assert.rejects(
    () =>
      sandbox.PluginBootstrap.loadDeferredScripts(
        { registrations: { slashCommands: "fail.js" }, entry: {} },
        { chatMount: true }
      ),
    /bootstrap script failed/
  );

  const manifest = { id: "x", registrations: {}, contributes: {} };
  sandbox.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) });
  const out = await sandbox.PluginBootstrap.bootstrapFromManifest(undefined, { chatMount: false });
  assert.equal(out.id, "x");
  assert.equal(sandbox.WebtoolsMcp.seen.id, "x");
  assert.equal(sandbox.AgentGateway.seen.id, "x");

  sandbox.fetch = () => Promise.resolve({ ok: false, status: 404 });
  await assert.rejects(
    () => sandbox.PluginBootstrap.bootstrapFromManifest("../plugin.manifest.json", { chatMount: false }),
    /HTTP 404/
  );
});

test("LocalVoice TTS/STT success and degradation paths", async () => {
  class FakeAudio {
    constructor() { this.paused = true; this.src = ""; this.onended = null; }
    play() {
      this.paused = false;
      const self = this;
      queueMicrotask(function () { self.paused = true; if (self.onended) self.onended(); });
      return Promise.resolve();
    }
    pause() { this.paused = true; }
  }
  const sandbox = {
    console,
    URL: { createObjectURL() { return "blob:tts"; }, revokeObjectURL() {} },
    Audio: FakeAudio,
    fetch: (url) => {
      if (String(url).includes("/api/voice/capabilities")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, tts: { available: true }, stt: { available: false } }),
        });
      }
      if (String(url).includes("/api/voice/tts")) {
        return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(["wav"])) });
      }
      return Promise.reject(new Error(String(url)));
    },
  };
  runFile("js/voice-local.js", sandbox);
  await sandbox.LocalVoice.speak("");
  await sandbox.LocalVoice.speak("hello");
  sandbox.LocalVoice.pause();
  sandbox.LocalVoice.resume();
  sandbox.LocalVoice.cancel();
  await sandbox.LocalVoice.refresh();
  await assert.rejects(() => sandbox.LocalVoice.startListening(), /stt-unavailable/);

  const down = {
    console,
    fetch: () => Promise.reject(new Error("offline")),
    URL: sandbox.URL,
    Audio: FakeAudio,
  };
  runFile("js/voice-local.js", down);
  const caps = await down.LocalVoice.capabilities();
  assert.equal(caps.tts.available, false);
});

test("ExtensionHost catalog boot, MCP tools, and missing ShellModules", async () => {
  const sandbox = {
    console,
    URL,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: { appendChild(el) { el.onload?.(); } },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return { src: "", setAttribute() {}, onload: null, onerror: null }; },
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
                { id: "skip", enabled: false, path: "extensions/skip" },
                {
                  id: "demo-catalog",
                  path: "extensions/demo-catalog",
                  manifest: "../extensions/demo-catalog/extension.json",
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
              id: "demo-catalog",
              displayName: "Catalog",
              panel: "view.html",
              main: "main.js",
              activationEvents: ["onStartup"],
              contributes: {
                mcp: { tools: [{ name: "catalog.list" }] },
                views: { sidebar: { id: "catalog", label: "Catalog" } },
              },
            }),
        });
      }
      if (u.includes("view.html")) {
        return Promise.resolve({ ok: true, text: () => Promise.resolve("<div>panel</div>") });
      }
      return Promise.resolve({ ok: false, status: 404 });
    },
  };
  runFile("js/extension-host.js", sandbox);
  assert.equal(sandbox.ExtensionHost.toShellModule({ id: "x" }), null);
  await sandbox.ExtensionHost.init({ source: "../data/extensions.json" });
  assert.ok(sandbox.ExtensionHost.get("demo-catalog"));
  assert.match(sandbox.ExtensionHost.getPanelHtml("demo-catalog"), /panel/);
  const empty = await sandbox.ExtensionHost.boot({ catalog: "../data/extensions.json" });
  assert.ok(Array.isArray(empty));
});

test("suite boot renders registry cards and registry HTTP errors", async () => {
  function el() {
    return {
      innerHTML: "",
      textContent: "",
      className: "",
      style: {},
      children: [],
      clientWidth: 800,
      offsetLeft: 0,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      setAttribute() {},
      getAttribute() { return "0"; },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      appendChild(child) { this.children.push(child); },
      focus() {},
    };
  }
  const byId = {};
  ["suite-grid", "suite-banner-track", "suite-dots", "suite-prev", "suite-next", "suite-banner-viewport"].forEach(
    (id) => { byId[id] = el(); }
  );
  const sandbox = {
    console,
    addEventListener() {},
    requestAnimationFrame(fn) { fn(); },
    matchMedia() { return { matches: true }; },
    history: { replaceState() {} },
    location: { hash: "#llm-benchmark", href: "http://127.0.0.1/pages/index.html", hostname: "127.0.0.1" },
    document: {
      readyState: "complete",
      hidden: false,
      body: { contains() { return false; }, appendChild() {}, removeChild() {} },
      getElementById(id) { return byId[id] || el(); },
      querySelector() { return el(); },
      querySelectorAll() { return []; },
      createElement() { return el(); },
      addEventListener() {},
    },
    fetch: () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            plugins: [
              { id: "demo-portal", name: "Demo", localUrl: "./index.html" },
              { id: "llm-benchmark", name: "LLM", localUrl: "../llm-benchmark/index.html" },
            ],
          }),
      }),
  };
  runFile("js/suite.js", sandbox);
  await new Promise((r) => setTimeout(r, 40));
  assert.match(byId["suite-grid"].innerHTML, /suite-tool-card/);

  const errGrid = { innerHTML: "" };
  const errBox = {
    console,
    addEventListener() {},
    location: { hash: "", href: "http://example.test/", hostname: "example.test" },
    document: {
      readyState: "complete",
      getElementById(id) { return id === "suite-grid" ? errGrid : null; },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return { style: {}, setAttribute() {}, classList: { add() {}, remove() {} } }; },
    },
    fetch: () => Promise.resolve({ ok: false, status: 500 }),
  };
  runFile("js/suite.js", errBox);
  await new Promise((r) => setTimeout(r, 30));
  assert.match(errGrid.innerHTML, /suite-error/);
});
