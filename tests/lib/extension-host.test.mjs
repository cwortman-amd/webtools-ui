import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadExtensionHost() {
  const file = path.join(root, "js/extension-host.js");
  const sandbox = {
    console,
    location: { href: "http://127.0.0.1/pages/index.html" },
    document: {
      location: { href: "http://127.0.0.1/pages/index.html" },
      head: { appendChild() {} },
      _listeners: {},
      querySelector() {
        return null;
      },
      addEventListener(name, handler) {
        (this._listeners[name] = this._listeners[name] || []).push(handler);
      },
      removeEventListener(name, handler) {
        const list = this._listeners[name] || [];
        const idx = list.indexOf(handler);
        if (idx >= 0) list.splice(idx, 1);
      },
      createElement() {
        return { setAttribute() {}, onload: null, onerror: null };
      },
    },
    URL,
    fetch: () => Promise.reject(new Error("offline")),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

test("ExtensionHost.toShellModule maps sidebar contribution to a shell module", () => {
  const { ExtensionHost } = loadExtensionHost();
  const mod = ExtensionHost.toShellModule({
    id: "demo-catalog",
    displayName: "Catalog",
    contributes: {
      views: {
        sidebar: {
          id: "catalog",
          label: "Catalog",
          icon: "grid_view",
          panel: { type: "iframe", src: "panel.html" },
        },
      },
    },
  });
  assert.equal(mod.id, "catalog");
  assert.equal(mod.label, "Catalog");
  assert.equal(mod.provider, "demo-catalog");
});

test("ExtensionHost.toShellModule returns null without sidebar view", () => {
  const { ExtensionHost } = loadExtensionHost();
  assert.equal(ExtensionHost.toShellModule({ id: "x", contributes: {} }), null);
});

test("ExtensionHost.validateManifest rejects missing id", () => {
  const { ExtensionHost } = loadExtensionHost();
  const result = ExtensionHost.validateManifest({});
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("missing id"));
});

test("ExtensionHost.boot warns and resolves empty when ShellModules is absent", async () => {
  const sandbox = loadExtensionHost();
  const packs = await sandbox.ExtensionHost.boot({ catalog: "../data/extensions.json" });
  assert.ok(Array.isArray(packs));
  assert.equal(packs.length, 0);
});

test("ExtensionHost.DisposableStore disposes once", () => {
  const { ExtensionHost } = loadExtensionHost();
  let n = 0;
  const store = new ExtensionHost.DisposableStore();
  store.push(() => { n += 1; });
  store.dispose();
  store.dispose();
  assert.equal(n, 1);
});

test("ExtensionHost.DisposableStore disposes items pushed after dispose", () => {
  const { ExtensionHost } = loadExtensionHost();
  let n = 0;
  const store = new ExtensionHost.DisposableStore();
  store.dispose();
  store.push(() => { n += 1; });
  assert.equal(n, 1);
});

test("ExtensionHost.validateManifest checks apiVersion and engine compatibility", () => {
  const { ExtensionHost } = loadExtensionHost();
  const missingApi = ExtensionHost.validateManifest({ id: "x" });
  assert.equal(missingApi.ok, false);
  assert.ok(missingApi.errors.includes("missing apiVersion"));

  const badEngine = ExtensionHost.validateManifest(
    { id: "x", apiVersion: "1.0.0", engines: { webtools: "^2.0.0" } },
    { hostVersion: "1.0.0" },
  );
  assert.equal(badEngine.ok, false);
  assert.ok(badEngine.errors.includes("incompatible engines.webtools"));

  const ok = ExtensionHost.validateManifest(
    { id: "x", apiVersion: "1.0.0", engines: { webtools: "^1.0.0" } },
    { hostVersion: "1.0.0" },
  );
  assert.equal(ok.ok, true);
});

test("ExtensionHost.createContext registers commands, services, and events", () => {
  const sandbox = loadExtensionHost();
  const { ExtensionHost } = sandbox;
  const pack = { id: "demo-pack", manifest: { id: "demo-pack" } };
  const ctx = ExtensionHost.createContext(pack);
  let heard = false;
  ctx.events.on("demo:event", () => { heard = true; });
  sandbox.document.addEventListener("demo:event", () => {});
  ctx.commands.register("demo.cmd", (args) => ({ echo: args }));
  ctx.services.register("demo.svc", { ping: () => "pong" });
  assert.deepEqual(ExtensionHost.executeCommand("demo.cmd", { x: 1 }), { echo: { x: 1 } });
  assert.equal(ExtensionHost.getService("demo.svc").ping(), "pong");
  const missing = ExtensionHost.executeCommand("missing", {});
  assert.equal(missing.error, "unknown command missing");
  ctx.subscriptions.dispose();
});

test("ExtensionHost.toShellModule maps sidebar.mount to panel mount type", () => {
  const { ExtensionHost } = loadExtensionHost();
  const mod = ExtensionHost.toShellModule({
    id: "mount-pack",
    contributes: {
      views: {
        sidebar: {
          id: "create",
          label: "Create",
          mount: "mountCreate",
        },
      },
    },
  });
  assert.equal(mod.panel.type, "mount");
  assert.equal(mod.panel.mount, "mountCreate");
});

test("ExtensionHost.deactivate disposes context subscriptions", () => {
  const sandbox = loadExtensionHost();
  const { ExtensionHost } = sandbox;
  const pack = { id: "hook-pack", manifest: { id: "hook-pack" } };
  const ctx = ExtensionHost.createContext(pack);
  ctx.commands.register("x", () => 1);
  assert.equal(ExtensionHost.executeCommand("x", {}), 1);
  ExtensionHost.deactivate("hook-pack");
  assert.equal(ExtensionHost.executeCommand("x", {}).error, "unknown command x");
});


