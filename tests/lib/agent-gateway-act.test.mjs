import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadGatewayAndMcp() {
  const sandbox = {
    window: {},
    console,
    fetch: () => Promise.reject(new Error("offline")),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.WebtoolsExtensions = {
    "im-report": {
      mcpHandlers: {
        "report.summarize": function () {
          return { ok: true, summary: "pilot metrics" };
        },
      },
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/mcp-suite.js"), "utf8"), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/agent-gateway.js"), "utf8"), sandbox);
  sandbox.AgentGateway.configure({ enabled: true, corpora: [], productId: "llm-benchmark" });
  return sandbox;
}

test("AgentGateway act routes to extension MCP handler", async () => {
  const sandbox = loadGatewayAndMcp();
  sandbox.__workbenchMcp = { tools: [{ name: "report.summarize", extension: "im-report" }] };
  const result = await sandbox.AgentGateway.act({ text: "summarize report metrics" });
  assert.equal(result.handled, true);
  assert.equal(result.tool, "report.summarize");
  assert.match(result.reply, /pilot metrics/i);
});

test("WebtoolsMcp.callTool prefers extension handler", async () => {
  const sandbox = loadGatewayAndMcp();
  const out = await sandbox.WebtoolsMcp.callTool("report.summarize", {});
  assert.equal(out.ok, true);
  assert.equal(out.summary, "pilot metrics");
});

test("AgentGateway hybrid falls back to act when KE offline", async () => {
  const sandbox = loadGatewayAndMcp();
  sandbox.AgentGateway.configure({
    enabled: true,
    corpora: ["ke-curriculum"],
    keAskUrl: "/api/ask",
    productId: "llm-benchmark",
  });
  const result = await sandbox.AgentGateway.route({ text: "export report pdf now" });
  assert.equal(result.intent, "act");
  assert.equal(result.handled, false);
});
