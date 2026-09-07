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
  return sandbox;
}

test("AgentGateway federated host defers learn intents to native KE ask", async () => {
  const sandbox = loadAgentGateway();
  await sandbox.AgentGateway.loadFromManifest({
    id: "knowledge-exchange",
    contributes: {
      services: {
        agent: {
          enabled: true,
          federated: true,
          corpora: ["ke-curriculum", "cm-ops"],
        },
      },
    },
  });
  assert.equal(sandbox.AgentGateway.isEnabled(), true);
  const result = await sandbox.AgentGateway.route({ text: "Explain ROCm profiling" });
  assert.equal(result.intent, "learn");
  assert.equal(result.handled, false);
  assert.match(result.note, /native/i);
});

test("AgentGateway federated retrieve merges multi-corpus hits", async () => {
  const sandbox = loadAgentGateway((url, init) => {
    if (String(url).includes("federated")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            hits: [
              { title: "Fabric", excerpt: "RoCE lossless fabric", corpus_id: "cm-ops" },
            ],
          }),
      });
    }
    if (init && init.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ answer: "KE wiki answer." }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  sandbox.AgentGateway.configure({
    enabled: true,
    productId: "llm-benchmark",
    corpora: ["ke-curriculum", "cm-ops"],
    keAskUrl: "/api/ask",
    federatedRetrieveUrl: "/api/federated/retrieve",
  });
  const payload = await sandbox.AgentGateway.retrieve("Explain RoCE fabric");
  assert.ok(payload);
  assert.match(payload.answer, /RoCE|KE wiki/i);
});

test("AgentGateway routes amd corpora through KE hub", async () => {
  const calls = [];
  const sandbox = loadAgentGateway((url, init) => {
    calls.push(String(url));
    if (String(url).includes("127.0.0.1:8765/api/federated/retrieve")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            hits: [
              {
                title: "Linux install",
                excerpt: "Install ROCm on Ubuntu",
                corpus_id: "amd-rocm-docs",
                url: "https://rocm.docs.amd.com/en/latest/install/linux-install.html",
              },
            ],
          }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  await sandbox.AgentGateway.loadFromManifest({
    id: "cluster-manager",
    contributes: {
      services: {
        agent: {
          enabled: true,
          corpora: ["amd-rocm-docs"],
          keHubUrl: "http://127.0.0.1:8765",
        },
      },
    },
  });
  const payload = await sandbox.AgentGateway.retrieveCorpus(
    "amd-rocm-docs",
    "How do I install ROCm on Ubuntu?"
  );
  assert.ok(payload);
  assert.match(payload.answer, /Ubuntu|ROCm/i);
  assert.ok(calls.some((u) => u.includes("/api/federated/retrieve")));
});

test("AgentGateway merges platform shared corpora for dashboards", async () => {
  const sandbox = loadAgentGateway((url) => {
    if (String(url).includes("agent-knowledge-defaults")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            sharedCorpora: ["ke-curriculum", "amd-rocm-docs"],
            keHubUrl: "http://127.0.0.1:8765",
            keAskPath: "/api/ask",
            productCorpora: { "dc-planner": ["dc-planner-domain"] },
          }),
      });
    }
    if (String(url).includes("knowledge-registry")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: 1, corpora: {} }) });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  const cfg = await sandbox.AgentGateway.loadFromManifest({
    id: "dc-planner",
    contributes: {
      services: {
        agent: {
          enabled: true,
          corpora: ["dc-planner-domain"],
          keHubUrl: "http://127.0.0.1:8765",
        },
      },
    },
  });
  assert.ok(cfg.corpora.includes("ke-curriculum"));
  assert.ok(cfg.corpora.includes("amd-rocm-docs"));
  assert.ok(cfg.corpora.includes("dc-planner-domain"));
  assert.equal(cfg.keAskUrl, "http://127.0.0.1:8765/api/ask");
});
