import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("KeAgentContext shows banner for decoded agent_ctx packet", () => {
  const sandbox = {
    window: {},
    document: {
      body: { firstChild: null, insertBefore: function (node) { this.firstChild = node; } },
      getElementById: function () { return null; },
      createElement: function () {
        return { innerHTML: "", hidden: true, setAttribute: function () {}, className: "", id: "" };
      },
      readyState: "complete",
      addEventListener: function () {},
    },
    console,
    location: { search: "" },
    URLSearchParams: global.URLSearchParams,
    btoa: (s) => Buffer.from(s, "utf8").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("utf8"),
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, "js/agent-handoff.js"), "utf8"), sandbox);
  const token = sandbox.AgentHandoff.encode(
    sandbox.AgentHandoff.buildPacket({
      product: "llm-benchmark",
      question: "How do I profile?",
      summary: "Use the profile tab.",
    })
  );
  sandbox.location.search = "?agent_ctx=" + token;
  const keAgentContext = fs.readFileSync(
    path.join(path.dirname(root), "knowledge-exchange/portal/agent-context.js"),
    "utf8"
  );
  vm.runInNewContext(keAgentContext, sandbox);
  sandbox.KeAgentContext.boot();
  assert.ok(sandbox.__keAgentContext);
  assert.equal(sandbox.__keAgentContext.product, "llm-benchmark");
});
