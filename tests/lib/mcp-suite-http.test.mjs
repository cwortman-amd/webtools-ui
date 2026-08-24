import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadMcpSuite(fetchImpl) {
  const sandbox = {
    console,
    fetch: fetchImpl,
    agentBridge: null,
    mcpBridge: null,
    WebtoolsExtensions: {},
    __workbenchMcp: null,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const file = path.join(root, "js/mcp-suite.js");
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  sandbox.WebtoolsMcp.configure({ enabled: true, registration: { http: "/mcp" } });
  return sandbox;
}

test("WebtoolsMcp.call POST /mcp returns JSON-RPC result", async () => {
  const calls = [];
  const sandbox = loadMcpSuite((url, init) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonrpc: "2.0",
          id: 1,
          result: { demos: [{ id: "alpha" }] },
        }),
    });
  });
  const result = await sandbox.WebtoolsMcp.call("list_demos", { limit: 5 });
  assert.deepEqual(result, { demos: [{ id: "alpha" }] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/mcp");
  assert.equal(calls[0].init.method, "POST");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.method, "list_demos");
  assert.deepEqual(body.params, { limit: 5 });
});

test("WebtoolsMcp.call rejects on HTTP error", async () => {
  const sandbox = loadMcpSuite(() =>
    Promise.resolve({
      ok: false,
      status: 502,
      json: () => Promise.resolve({}),
    })
  );
  await assert.rejects(() => sandbox.WebtoolsMcp.call("ping"), /MCP HTTP 502/);
});

test("WebtoolsMcp.call rejects on JSON-RPC error payload", async () => {
  const sandbox = loadMcpSuite(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32601, message: "Method not found" },
        }),
    })
  );
  await assert.rejects(() => sandbox.WebtoolsMcp.call("missing_tool"), /Method not found/);
});

test("WebtoolsMcp.call rejects when no transport available", async () => {
  const sandbox = loadMcpSuite(undefined);
  delete sandbox.fetch;
  sandbox.WebtoolsMcp.configure({ enabled: true, registration: { http: "" } });
  await assert.rejects(
    () => sandbox.WebtoolsMcp.call("offline_tool"),
    /No MCP transport available/
  );
});
