import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadModules() {
  const sandbox = {
    window: {},
    console,
    btoa: (s) => Buffer.from(s, "utf8").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("utf8"),
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
    location: { href: "http://localhost/pages/index.html" },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/agent-handoff.js"), "utf8"), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/ke-handoff.js"), "utf8"), sandbox);
  return sandbox;
}

test("AgentHandoff round-trips a packet", () => {
  const { AgentHandoff } = loadModules();
  const packet = AgentHandoff.buildPacket({
    product: "llm-benchmark",
    question: "How do I read MI355X metrics?",
    summary: "Use the profile tab ROCm counters.",
  });
  const token = AgentHandoff.encode(packet);
  assert.ok(token.length > 0);
  const decoded = AgentHandoff.decode(token);
  assert.equal(decoded.product, "llm-benchmark");
  assert.equal(decoded.question, packet.question);
});

test("KeHandoff enrich attaches agent_ctx to handoff href", () => {
  const sandbox = loadModules();
  const rules = [
    {
      pagePattern: "index\\.html$",
      href: "../knowledge-exchange/pages/index.html?topic=rocm",
      label: "KE curriculum",
      hint: "Deep dive in Knowledge Exchange",
    },
  ];
  const enriched = sandbox.KeHandoff.enrich(
    { reply: "Here is how ROCm profiling works.", kind: "text" },
    rules,
    { productId: "llm-benchmark", question: "How do I profile?", pathname: "/pages/index.html" }
  );
  assert.match(enriched.reply, /agent_ctx=/);
  assert.match(enriched.reply, /ke-orb-handoff/);
});
