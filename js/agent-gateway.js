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
  var DEFAULTS_URL = "../shared/data/agent-knowledge-defaults.json";
  var WIKI_INDEX_MANIFEST_URL = "../shared/data/llm-wiki-index-manifest.json";
  var FALLBACK_SHARED_CORPORA = [
    "ke-curriculum",
    "amd-rocm-docs",
    "amd-instinct-docs",
    "amd-rocm-blogs",
  ];
  var config = {
    enabled: false,
    productId: "",
    corpora: [],
    keAskUrl: "",
    keHubUrl: "",
    federatedRetrieveUrl: "",
    federatedHost: false,
    registry: null,
    knowledgeDefaults: null,
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

  function keHubBase() {
    var base = config.keHubUrl || (global.WT_KE_HUB_URL || "http://127.0.0.1:8765");
    return String(base).replace(/\/$/, "");
  }

  function loadKnowledgeDefaults(url) {
    url = url || DEFAULTS_URL;
    if (config.knowledgeDefaults) {
      return Promise.resolve(config.knowledgeDefaults);
    }
    return fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("defaults HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        config.knowledgeDefaults = data;
        return data;
      })
      .catch(function (err) {
        warn("agent knowledge defaults unavailable: " + (err && err.message ? err.message : err));
        return {
          sharedCorpora: FALLBACK_SHARED_CORPORA,
          keHubUrl: "http://127.0.0.1:8765",
          keAskPath: "/api/ask",
          federatedRetrievePath: "/api/federated/retrieve",
          productCorpora: {},
        };
      });
  }

  function loadWikiIndexManifest(url) {
    url = url || WIKI_INDEX_MANIFEST_URL;
    return fetch(url, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("wiki index manifest HTTP " + r.status);
        return r.json();
      })
      .catch(function (err) {
        warn("llm-wiki index manifest unavailable: " + (err && err.message ? err.message : err));
        return { githubRepos: [], siteUrls: [] };
      });
  }

  function wikiCorpusIds(manifest) {
    var ids = [];
    (manifest.githubRepos || []).forEach(function (repo) {
      if (repo && repo.corpusId) ids.push(repo.corpusId);
    });
    return ids;
  }

  function mergeCorpora(manifestCorpora, productId, defaults, wikiManifest) {
    var shared = (defaults && defaults.sharedCorpora) || FALLBACK_SHARED_CORPORA;
    var wikiIds = wikiCorpusIds(wikiManifest || {});
    var product = (defaults && defaults.productCorpora && defaults.productCorpora[productId]) || [];
    var out = [];
    var seen = {};
    function add(id) {
      if (!id || seen[id]) return;
      seen[id] = true;
      out.push(id);
    }
    shared.forEach(add);
    wikiIds.forEach(add);
    product.forEach(add);
    (manifestCorpora || []).forEach(add);
    return out;
  }

  function resolveKeAskUrl(defaults) {
    var url = config.keAskUrl || "";
    if (url && url.indexOf("http") === 0) return url;
    var path = (defaults && defaults.keAskPath) || "/api/ask";
    if (url && url.indexOf("/") === 0) path = url;
    return keHubBase() + path;
  }

  function applyHarmonizedAgentConfig(manifest, svc, federatedHost, defaults, wikiManifest) {
    var corpora = mergeCorpora(svc && svc.corpora, manifest.id, defaults, wikiManifest);
    if (!federatedHost) {
      if (!config.keHubUrl) {
        config.keHubUrl = (defaults && defaults.keHubUrl) || keHubBase();
      }
      if (corpora.indexOf("ke-curriculum") >= 0 && !config.keAskUrl) {
        config.keAskUrl = resolveKeAskUrl(defaults);
      }
    }
    config.corpora = corpora;
  }

  function retrieveFromKeHub(corpusId, text) {
    if (!global.fetch) return Promise.resolve(null);
    var corpus = resolveCorpus(corpusId) || {};
    var path = corpus.httpFederated || "/api/federated/retrieve";
    var url = path.indexOf("http") === 0 ? path : keHubBase() + path;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, corpora: [corpusId], limit: 3 }),
    }).then(function (r) {
      if (!r.ok) return null;
      return r.json();
    }).then(function (payload) {
      if (!payload || !payload.hits || !payload.hits.length) return null;
      return {
        corpus: corpusId,
        hits: payload.hits,
        answer: payload.hits.map(function (h) {
          return (h.title || h.path) + ": " + (h.excerpt || "");
        }).join("\n"),
      };
    }).catch(function () {
      return null;
    });
  }

  function retrieveCorpus(corpusId, text) {
    if (corpusId === "ke-curriculum" && config.keAskUrl) {
      return retrieveFromKe(text);
    }
    if (!config.federatedHost && corpusId.indexOf("amd-") === 0) {
      return retrieveFromKeHub(corpusId, text);
    }
    var corpus = resolveCorpus(corpusId);
    if (!corpus && config.federatedRetrieveUrl && global.fetch) {
      return fetch(config.federatedRetrieveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, corpora: [corpusId], limit: 3 }),
      }).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function (payload) {
        if (!payload || !payload.hits || !payload.hits.length) return null;
        return {
          corpus: corpusId,
          hits: payload.hits,
          answer: payload.hits.map(function (h) {
            return (h.title || h.path) + ": " + (h.excerpt || "");
          }).join("\n"),
        };
      }).catch(function () {
        return null;
      });
    }
    if (!corpus) return Promise.resolve(null);
    if (config.federatedRetrieveUrl && global.fetch) {
      return fetch(config.federatedRetrieveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, corpora: [corpusId], limit: 3 }),
      }).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).then(function (payload) {
        if (!payload || !payload.hits || !payload.hits.length) return null;
        return {
          corpus: corpusId,
          hits: payload.hits,
          answer: payload.hits.map(function (h) {
            return (h.title || h.path) + ": " + (h.excerpt || "");
          }).join("\n"),
        };
      }).catch(function () {
        return null;
      });
    }
    if (corpus.mcpTool && global.WebtoolsMcp && typeof global.WebtoolsMcp.callTool === "function") {
      return global.WebtoolsMcp.callTool(corpus.mcpTool, {
        q: text,
        query: text,
        question: text,
      }).then(function (result) {
        return { corpus: corpusId, result: result };
      }).catch(function () {
        return null;
      });
    }
    if (corpus.httpAsk && global.fetch) {
      return fetch(corpus.httpAsk, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, mode: "answer" }),
      }).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).catch(function () {
        return null;
      });
    }
    return Promise.resolve(null);
  }

  function mergeRetrieveResults(results) {
    var replies = [];
    var sources = [];
    (results || []).forEach(function (item) {
      if (!item) return;
      if (item.answer) replies.push(String(item.answer));
      if (item.reply) replies.push(String(item.reply));
      if (item.hits && item.hits.length) {
        item.hits.forEach(function (h) { sources.push(h); });
      }
      if (item.sources) {
        item.sources.forEach(function (s) { sources.push(s); });
      }
      if (item.citations) {
        item.citations.forEach(function (c) { sources.push(c); });
      }
    });
    if (!replies.length) return null;
    return {
      answer: replies.join("\n\n"),
      sources: sources,
      scope: "federated",
    };
  }

  function retrieve(text) {
    var ids = config.corpora && config.corpora.length
      ? config.corpora.slice()
      : ["ke-curriculum"];
    if (ids.length === 1) {
      return retrieveCorpus(ids[0], text);
    }
    return Promise.all(ids.map(function (id) {
      return retrieveCorpus(id, text);
    })).then(mergeRetrieveResults);
  }

  function retrieveFromKe(text) {
    var askUrl = resolveKeAskUrl(config.knowledgeDefaults);
    if (!askUrl || !global.fetch) {
      return Promise.resolve(null);
    }
    return fetch(askUrl, {
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
    config.keHubUrl = opts.keHubUrl || config.keHubUrl || "";
    config.federatedRetrieveUrl = opts.federatedRetrieveUrl || config.federatedRetrieveUrl || "";
    config.federatedHost = !!opts.federatedHost;
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
      if (svc.keHubUrl) config.keHubUrl = svc.keHubUrl;
      if (svc.federatedRetrieveUrl) config.federatedRetrieveUrl = svc.federatedRetrieveUrl;
    }
    var federatedHost = false;
    if (manifest.id === "knowledge-exchange") {
      if (svc && typeof svc === "object" && svc.federated) {
        federatedHost = true;
        enabled = svc.enabled !== false;
        if (!config.federatedRetrieveUrl) {
          config.federatedRetrieveUrl = "/api/federated/retrieve";
        }
      } else {
        enabled = false;
      }
    }
    configure({
      productId: manifest.id,
      enabled: enabled,
      corpora: corpora,
      federatedHost: federatedHost,
    });
    return loadKnowledgeDefaults().then(function (defaults) {
      return loadWikiIndexManifest().then(function (wikiManifest) {
        applyHarmonizedAgentConfig(manifest, svc, federatedHost, defaults, wikiManifest);
        return loadRegistry().then(function () {
          if (!config.keAskUrl && corpora.indexOf("ke-curriculum") >= 0 && federatedHost) {
            var ke = resolveCorpus("ke-curriculum");
            if (ke && ke.httpAsk) {
              config.keAskUrl = ke.httpAsk;
            }
          }
          return config;
        });
      });
    });
  }

  function route(ctx) {
    ctx = ctx || {};
    var text = String(ctx.text || "");
    var intent = classify(text);
    if (!config.enabled) {
      return Promise.resolve({ intent: intent, handled: false });
    }
    if (config.federatedHost && (intent === "learn" || intent === "hybrid")) {
      return Promise.resolve({
        intent: intent,
        handled: false,
        note: "KE native /api/ask (federated server-side)",
      });
    }
    if (intent === "learn" || intent === "hybrid") {
      var corpora = config.corpora && config.corpora.length
        ? config.corpora
        : ["ke-curriculum"];
      return retrieve(text).then(function (payload) {
        if (payload && payload.answer) {
          return {
            intent: intent,
            handled: true,
            reply: payload.answer,
            sources: payload.sources || payload.citations || payload.hits || [],
            scope: payload.scope || "federated",
          };
        }
        if (corpora.indexOf("ke-curriculum") >= 0) {
          return retrieveFromKe(text).then(function (kePayload) {
            if (kePayload && kePayload.answer) {
              return {
                intent: intent,
                handled: true,
                reply: kePayload.answer,
                sources: kePayload.sources || kePayload.citations || [],
                scope: kePayload.scope || "curriculum",
              };
            }
            if (intent === "hybrid") {
              return act(ctx);
            }
            return { intent: intent, handled: false, note: "KE unavailable — use local agent." };
          });
        }
        if (intent === "hybrid") {
          return act(ctx);
        }
        return { intent: intent, handled: false, note: "No federated corpora matched." };
      });
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
    retrieve: retrieve,
    retrieveCorpus: retrieveCorpus,
    retrieveFromKe: retrieveFromKe,
    route: route,
    act: act,
    listActTools: listActTools,
    installChatInterceptor: installChatInterceptor,
    isEnabled: function () { return !!config.enabled; },
  };

  global.AgentGateway = api;
})(typeof window !== "undefined" ? window : globalThis);
