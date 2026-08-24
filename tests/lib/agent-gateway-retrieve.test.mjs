import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadGateway(fetchImpl) {
  const file = path.join(root, "js/agent-gateway.js");
  const sandbox = {
    console,
    fetch: fetchImpl,
    WebtoolsMcp: { listTools() { return []; } },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file });
  return sandbox;
}

test("AgentGateway.retrieve is the documented public KE lookup", async () => {
  const sandbox = loadGateway(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ answer: "cited", sources: ["/wiki/x"] }),
    })
  );
  sandbox.AgentGateway.configure({ enabled: true, keAskUrl: "/api/ask" });
  assert.equal(typeof sandbox.AgentGateway.retrieve, "function");
  const payload = await sandbox.AgentGateway.retrieve("What is ROCm?");
  assert.equal(payload.answer, "cited");
  assert.deepEqual(payload.sources, ["/wiki/x"]);
});
