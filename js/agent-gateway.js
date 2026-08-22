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
  var ACT_RE = /\b(export|run|open|search|validate|solve|summarize|list|show)\b/i;

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn("[AgentGateway] " + msg);
    }
  }

  function classify(text) {
    if (!text) return "act";
    var learn = LEARN_RE.test(text);
    var actish = ACT_RE.test(text);
    if (learn && actish) return "hybrid";
    if (learn) return "learn";
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

  function listActTools() {
    if (global.WebtoolsMcp && typeof global.WebtoolsMcp.listTools === "function") {
      return global.WebtoolsMcp.listTools();
    }
    return [];
  }

  function pickTool(text, tools) {
    if (!tools || !tools.length) return null;
    var lower = String(text || "").toLowerCase();
    for (var i = 0; i < tools.length; i++) {
      var name = String(tools[i].name || "");
      if (!name) continue;
      var short = name.split(".").pop() || name;
      if (lower.indexOf(short.toLowerCase()) >= 0 || lower.indexOf(name.toLowerCase()) >= 0) {
        return name;
      }
    }
    return tools[0] && tools[0].name ? String(tools[0].name) : null;
  }

  function act(ctx) {
    ctx = ctx || {};
    var text = String(ctx.text || "");
    var tools = listActTools();
    var toolName = ctx.tool || pickTool(text, tools);
    if (!toolName) {
      return Promise.resolve({ intent: "act", handled: false, note: "No MCP tools registered." });
    }
    if (global.WebtoolsMcp && typeof global.WebtoolsMcp.callTool === "function") {
      return global.WebtoolsMcp.callTool(toolName, ctx.params || { query: text }).then(function (result) {
        return {
          intent: "act",
          handled: true,
          tool: toolName,
          reply: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          result: result,
        };
      }).catch(function (err) {
        return {
          intent: "act",
          handled: false,
          tool: toolName,
          note: err && err.message ? err.message : "MCP call failed",
        };
      });
    }
    return Promise.resolve({ intent: "act", handled: false, note: "WebtoolsMcp unavailable." });
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
    if (intent === "learn" || intent === "hybrid") {
      if (config.corpora.indexOf("ke-curriculum") >= 0) {
        return retrieveFromKe(text).then(function (payload) {
          if (payload && payload.answer) {
            return {
              intent: intent,
              handled: true,
              reply: payload.answer,
              sources: payload.sources || payload.citations || [],
              scope: payload.scope || "curriculum",
            };
          }
          if (intent === "hybrid") {
            return act(ctx);
          }
          return { intent: intent, handled: false, note: "KE unavailable — use local agent." };
        });
      }
    }
    if (intent === "act" || intent === "hybrid") {
      return act(ctx);
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
    act: act,
    listActTools: listActTools,
    installChatInterceptor: installChatInterceptor,
    isEnabled: function () { return !!config.enabled; },
  };

  global.AgentGateway = api;
})(typeof window !== "undefined" ? window : globalThis);
