import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadPluginServices(fetchImpl) {
  const file = path.join(root, "js/plugin-services.js");
  const sandbox = {
    console,
    fetch: fetchImpl,
    WebtoolsMcp: {
      loaded: null,
      loadFromManifest(manifest) {
        this.loaded = manifest;
      },
    },
    AgentGateway: {
      loaded: null,
      loadFromManifest(manifest) {
        this.loaded = manifest;
        return Promise.resolve(manifest);
      },
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

test("PluginServices.bootFromManifest loads MCP and Agent Gateway from the manifest", async () => {
  const manifest = {
    id: "llm-benchmark",
    contributes: { services: { mcp: true, agent: true } },
    registrations: { mcp: { http: "/mcp" } },
  };
  const sandbox = loadPluginServices(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(manifest),
    })
  );
  const out = await sandbox.PluginServices.bootFromManifest("../plugin.manifest.json");
  assert.equal(out.id, "llm-benchmark");
  assert.equal(sandbox.WebtoolsMcp.loaded.id, "llm-benchmark");
  assert.equal(sandbox.AgentGateway.loaded.id, "llm-benchmark");
});

test("PluginServices.loadManifest rejects HTTP errors", async () => {
  const sandbox = loadPluginServices(() => Promise.resolve({ ok: false, status: 404 }));
  await assert.rejects(
    () => sandbox.PluginServices.loadManifest("../missing.json"),
    /HTTP 404/
  );
});
