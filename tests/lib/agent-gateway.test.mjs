import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadAgentGateway(fetchImpl) {
  const sandbox = {
    window: {},
    console,
    fetch: fetchImpl || (() => Promise.reject(new Error("offline"))),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const mcpFile = path.join(root, "js/mcp-suite.js");
  const gwFile = path.join(root, "js/agent-gateway.js");
  vm.runInNewContext(fs.readFileSync(mcpFile, "utf8"), sandbox, { filename: mcpFile });
  vm.runInNewContext(fs.readFileSync(gwFile, "utf8"), sandbox, { filename: gwFile });
  sandbox.AgentGateway.configure({
    enabled: true,
    corpora: ["ke-curriculum"],
    keAskUrl: "/api/ask",
    productId: "llm-benchmark",
  });
  return sandbox;
}

test("AgentGateway classifies learn intents", () => {
  const sandbox = loadAgentGateway();
  assert.equal(sandbox.AgentGateway.classify("How do I tune MI355X?"), "learn");
  assert.equal(sandbox.AgentGateway.classify("run sweep now"), "act");
  assert.equal(sandbox.AgentGateway.classify("explain export report"), "hybrid");
});

test("AgentGateway handles offline KE gracefully", async () => {
  const sandbox = loadAgentGateway();
  const result = await sandbox.AgentGateway.route({ text: "Explain ROCm profiling" });
  assert.equal(result.intent, "learn");
  assert.equal(result.handled, false);
});

test("AgentGateway routes learn intent to KE when proxy responds", async () => {
  const sandbox = loadAgentGateway(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ answer: "Use rocprof for kernel counters." }),
    })
  );
  const result = await sandbox.AgentGateway.route({ text: "Explain ROCm profiling" });
  assert.equal(result.intent, "learn");
  assert.equal(result.handled, true);
  assert.match(result.reply, /rocprof/i);
});
