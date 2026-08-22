/*!
 * webtools-ui/js/agent-gateway.js
 *
 * Federated agent orchestrator: routes learn/hybrid intents to registered
 * corpora (KE curriculum) while keeping product MCP tools scoped to the
 * active dashboard. Does not merge chat transcripts across products.
 */
(function (global) {
  "use strict";

  var REGISTRY_URL = "../shared/data/knowledge-registry.json";
  var config = {
    enabled: false,
    productId: "",
    corpora: [],
    keAskUrl: "",
    registry: null,
  };

  var LEARN_RE = /\b(how|why|what|explain|learn|training|course|wiki|curriculum|module|lesson)\b/i;

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn("[AgentGateway] " + msg);
    }
  }

  function classify(text) {
    if (!text) return "act";
    if (LEARN_RE.test(text)) return "learn";
    return "act";
  }

  function loadRegistry(url) {
    url = url || REGISTRY_URL;
    return fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("registry HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        config.registry = data;
        return data;
      })
      .catch(function (err) {
        warn("knowledge registry unavailable: " + (err && err.message ? err.message : err));
        return null;
      });
  }

  function resolveCorpus(id) {
    if (!config.registry || !config.registry.corpora) return null;
    return config.registry.corpora[id] || null;
  }

  function retrieveFromKe(text) {
    if (!config.keAskUrl || !global.fetch) {
      return Promise.resolve(null);
    }
    return fetch(config.keAskUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, mode: "plan" }),
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).catch(function () {
      return null;
    });
  }

  function configure(opts) {
    opts = opts || {};
    config.enabled = opts.enabled !== false;
    config.productId = opts.productId || config.productId;
    config.corpora = Array.isArray(opts.corpora) ? opts.corpora.slice() : config.corpora;
    config.keAskUrl = opts.keAskUrl || config.keAskUrl || "";
    if (opts.registry) config.registry = opts.registry;
    return config;
  }

  function loadFromManifest(manifest) {
    if (!manifest) return configure({ enabled: false });
    var svc = manifest.contributes && manifest.contributes.services &&
      manifest.contributes.services.agent;
    var enabled = false;
    var corpora = [];
    if (typeof svc === "boolean") enabled = svc;
    else if (svc && typeof svc === "object") {
      enabled = svc.enabled !== false;
      corpora = svc.corpora || [];
      if (svc.keAskUrl) config.keAskUrl = svc.keAskUrl;
    }
    if (manifest.id === "knowledge-exchange") {
      enabled = false;
    }
    configure({ productId: manifest.id, enabled: enabled, corpora: corpora });
    return loadRegistry().then(function () {
      if (!config.keAskUrl && corpora.indexOf("ke-curriculum") >= 0) {
        var ke = resolveCorpus("ke-curriculum");
        if (ke && ke.httpAsk) {
          config.keAskUrl = ke.httpAsk;
        }
      }
      return config;
    });
  }

  function route(ctx) {
    ctx = ctx || {};
    var text = String(ctx.text || "");
    var intent = classify(text);
    if (!config.enabled) {
      return Promise.resolve({ intent: intent, handled: false });
    }
    if (intent === "learn" && config.corpora.indexOf("ke-curriculum") >= 0) {
      return retrieveFromKe(text).then(function (payload) {
        if (!payload || !payload.answer) {
          return { intent: intent, handled: false, note: "KE unavailable — use local agent." };
        }
        return {
          intent: intent,
          handled: true,
          reply: payload.answer,
          sources: payload.sources || payload.citations || [],
          scope: payload.scope || "curriculum",
        };
      });
    }
    return Promise.resolve({ intent: intent, handled: false });
  }

  function installChatInterceptor() {
    if (!global.ChatOrb || global.ChatOrb._agentGatewayInstalled) return;
    var originalRun = global.ChatOrb.run;
    if (typeof originalRun !== "function") return;
    global.ChatOrb.run = function (text) {
      return route({ text: text, productId: config.productId }).then(function (result) {
        if (result && result.handled && result.reply) {
          return { reply: result.reply, html: false };
        }
        return originalRun.call(global.ChatOrb, text);
      });
    };
    global.ChatOrb._agentGatewayInstalled = true;
  }

  var api = {
    configure: configure,
    loadFromManifest: loadFromManifest,
    classify: classify,
    route: route,
    installChatInterceptor: installChatInterceptor,
    isEnabled: function () { return !!config.enabled; },
  };

  global.AgentGateway = api;
})(typeof window !== "undefined" ? window : globalThis);
