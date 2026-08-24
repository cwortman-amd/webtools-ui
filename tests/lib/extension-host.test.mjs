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
      querySelector() {
        return null;
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

test("ExtensionHost.boot warns and resolves empty when ShellModules is absent", async () => {
  const sandbox = loadExtensionHost();
  const packs = await sandbox.ExtensionHost.boot({ catalog: "../data/extensions.json" });
  assert.ok(Array.isArray(packs));
  assert.equal(packs.length, 0);
});
