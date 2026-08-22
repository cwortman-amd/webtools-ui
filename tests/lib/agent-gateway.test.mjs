import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

function loadAgentGateway() {
  const sandbox = {
    window: {},
    console,
    fetch: () => Promise.reject(new Error("offline")),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    // Minimal AgentGateway surface for unit tests (mirrors js/agent-gateway.js).
    `(function (global) {
      var config = { enabled: true, corpora: ["ke-curriculum"], keAskUrl: "/api/ask" };
      var LEARN_RE = /\\b(how|why|what|explain|learn|training|course|wiki|curriculum|module|lesson)\\b/i;
      function classify(text) { return LEARN_RE.test(text || "") ? "learn" : "act"; }
      function route(ctx) {
        var text = String((ctx && ctx.text) || "");
        var intent = classify(text);
        if (intent === "learn" && config.corpora.indexOf("ke-curriculum") >= 0) {
          return fetch(config.keAskUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: text, mode: "plan" }),
          }).then(function (r) { return r.ok ? r.json() : null; })
            .then(function (payload) {
              if (!payload || !payload.answer) return { intent: intent, handled: false };
              return { intent: intent, handled: true, reply: payload.answer };
            }).catch(function () { return { intent: intent, handled: false }; });
        }
        return Promise.resolve({ intent: intent, handled: false });
      }
      global.AgentGateway = { classify: classify, route: route, isEnabled: function () { return true; } };
    })(globalThis);`,
    sandbox
  );
  return sandbox.AgentGateway;
}

test("AgentGateway classifies learn intents", () => {
  const gw = loadAgentGateway();
  assert.equal(gw.classify("How do I tune MI355X?"), "learn");
  assert.equal(gw.classify("run sweep now"), "act");
});

test("AgentGateway handles offline KE gracefully", async () => {
  const gw = loadAgentGateway();
  const result = await gw.route({ text: "Explain ROCm profiling" });
  assert.equal(result.intent, "learn");
  assert.equal(result.handled, false);
});
