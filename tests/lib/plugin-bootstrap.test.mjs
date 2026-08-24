import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadPluginBootstrap(sandboxExtras = {}) {
  const scriptsLoaded = [];
  const sandbox = {
    console,
    document: {
      head: { appendChild() {} },
      querySelector() {
        return null;
      },
      createElement() {
        return {
          src: "",
          setAttribute() {},
          onload: null,
          onerror: null,
        };
      },
    },
    fetch: () => Promise.reject(new Error("fetch not mocked")),
    PluginServices: null,
    ExtensionHost: null,
    WebtoolsPlatform: {},
    ...sandboxExtras,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const file = path.join(root, "js/plugin-bootstrap.js");
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  sandbox.__scriptsLoaded = scriptsLoaded;
  return sandbox;
}

test("resolveExtensionsSource handles registrations.extensions string paths", () => {
  const { PluginBootstrap } = loadPluginBootstrap();
  assert.equal(
    PluginBootstrap.resolveExtensionsSource({ registrations: { extensions: "pack.json" } }),
    "../data/pack.json"
  );
  assert.equal(
    PluginBootstrap.resolveExtensionsSource({ registrations: { extensions: "data/pack.json" } }),
    "data/pack.json"
  );
});

test("resolveExtensionsSource handles contributes.extensions string and array", () => {
  const { PluginBootstrap } = loadPluginBootstrap();
  assert.equal(
    PluginBootstrap.resolveExtensionsSource({ contributes: { extensions: "ext.json" } }),
    "../data/ext.json"
  );
  assert.equal(
    PluginBootstrap.resolveExtensionsSource({ contributes: { extensions: "../custom/ext.json" } }),
    "../custom/ext.json"
  );
  assert.equal(
    PluginBootstrap.resolveExtensionsSource({ contributes: { extensions: ["../only/one.json"] } }),
    "../only/one.json"
  );
  assert.equal(PluginBootstrap.resolveExtensionsSource({}), "");
});

test("loadDeferredScripts skips when chatMount is false", async () => {
  let scriptLoads = 0;
  const sandbox = loadPluginBootstrap({
    document: {
      head: { appendChild(el) { scriptLoads += 1; el.onload?.(); } },
      querySelector() {
        return null;
      },
      createElement() {
        return {
          src: "",
          setAttribute() {},
          onload: null,
          onerror: null,
        };
      },
    },
  });
  const manifest = {
    registrations: { slashCommands: "chat-orb-mount.js", voicePersonas: "voice.js" },
    entry: { voice: "voice-alt.js" },
  };
  await sandbox.PluginBootstrap.loadDeferredScripts(manifest, { chatMount: false });
  assert.equal(scriptLoads, 0);
});

test("loadDeferredScripts loads slashCommands when chatMount enabled", async () => {
  let scriptLoads = 0;
  const sandbox = loadPluginBootstrap({
    document: {
      head: {
        appendChild(el) {
          scriptLoads += 1;
          el.onload?.();
        },
      },
      querySelector() {
        return null;
      },
      createElement() {
        return {
          src: "",
          setAttribute() {},
          onload: null,
          onerror: null,
        };
      },
    },
  });
  const manifest = {
    registrations: { slashCommands: "chat-orb-mount.js" },
    entry: {},
  };
  await sandbox.PluginBootstrap.loadDeferredScripts(manifest, { chatMount: true });
  assert.equal(scriptLoads, 1);
});

test("bootstrapFromManifest uses PluginServices and ExtensionHost", async () => {
  const manifest = {
    id: "demo",
    registrations: { extensions: "demo-extensions.json" },
    contributes: {},
  };
  let extInitSource = null;
  const sandbox = loadPluginBootstrap({
    PluginServices: {
      bootFromManifest(_url, _opts) {
        return Promise.resolve(manifest);
      },
    },
    ExtensionHost: {
      init({ source }) {
        extInitSource = source;
        return Promise.resolve();
      },
    },
  });
  const out = await sandbox.PluginBootstrap.bootstrapFromManifest("../plugin.manifest.json", {});
  assert.equal(out.id, "demo");
  assert.equal(extInitSource, "../data/demo-extensions.json");
});

test("bootstrapFromManifest falls back to fetch when PluginServices absent", async () => {
  const manifest = { id: "fetched", registrations: {}, contributes: {} };
  const sandbox = loadPluginBootstrap({
    fetch(url) {
      assert.equal(url, "../plugin.manifest.json");
      return Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) });
    },
  });
  const out = await sandbox.PluginBootstrap.bootstrapFromManifest("../plugin.manifest.json", {
    extensions: false,
    chatMount: false,
  });
  assert.equal(out.id, "fetched");
});
