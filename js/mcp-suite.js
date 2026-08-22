/*!
 * webtools-ui/js/mcp-suite.js
 *
 * T4 MCP client surface for browser dashboards. Reads plugin.manifest.json
 * registrations.mcp and exposes browser bridge + HTTP path + extension tools.
 */
(function (global) {
  "use strict";

  var config = {
    productId: "",
    enabled: false,
    browserBridge: null,
    httpPath: "/mcp",
    stdio: "",
    toolManifest: "",
    extensionTools: [],
  };

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn("[WebtoolsMcp] " + msg);
    }
  }

  function normalizeMcpRegistration(raw) {
    if (!raw) return {};
    if (typeof raw === "string") {
      return { stdio: raw };
    }
    return raw;
  }

  function bridge() {
    return config.browserBridge ||
      global.agentBridge ||
      global.mcpBridge ||
      null;
  }

  function listTools() {
    var out = [];
    if (config.extensionTools && config.extensionTools.length) {
      config.extensionTools.forEach(function (t) { out.push(t); });
    }
    var wb = global.__workbenchMcp && global.__workbenchMcp.tools;
    if (wb && wb.length) {
      wb.forEach(function (t) { out.push(t); });
    }
    var b = bridge();
    if (b && typeof b.getMap === "function") {
      try {
        var map = b.getMap();
        if (map && map.mcp_tools) {
          map.mcp_tools.forEach(function (name) {
            out.push({ name: name, source: "browser-bridge" });
          });
        }
      } catch (_) { /* ignore */ }
    }
    return out;
  }

  function call(method, params) {
    params = params || {};
    var b = bridge();
    if (b && typeof b.call === "function") {
      return Promise.resolve(b.call(method, params));
    }
    if (config.httpPath && global.fetch) {
      return fetch(config.httpPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: method, params: params }),
      }).then(function (r) {
        if (!r.ok) throw new Error("MCP HTTP " + r.status);
        return r.json();
      }).then(function (payload) {
        if (payload.error) throw new Error(payload.error.message || "MCP error");
        return payload.result;
      });
    }
    return Promise.reject(new Error("No MCP transport available for " + method));
  }

  function configure(opts) {
    opts = opts || {};
    config.productId = opts.productId || config.productId;
    config.enabled = opts.enabled !== false;
    var reg = normalizeMcpRegistration(opts.registration);
    config.httpPath = reg.http || reg.httpPath || config.httpPath;
    config.stdio = reg.stdio || config.stdio;
    config.toolManifest = reg.toolManifest || config.toolManifest;
    if (reg.browserBridge) {
      config.browserBridge = global.agentBridge || global.mcpBridge || null;
    }
    if (global.__workbenchMcp && global.__workbenchMcp.tools) {
      config.extensionTools = global.__workbenchMcp.tools.slice();
    }
    return config;
  }

  function loadFromManifest(manifest) {
    if (!manifest) return configure({ enabled: false });
    var services = manifest.contributes && manifest.contributes.services;
    var mcpSvc = services && services.mcp;
    var enabled = false;
    if (typeof mcpSvc === "boolean") enabled = mcpSvc;
    else if (mcpSvc && typeof mcpSvc === "object") enabled = mcpSvc.enabled !== false;
    return configure({
      productId: manifest.id,
      enabled: enabled,
      registration: manifest.registrations && manifest.registrations.mcp,
    });
  }

  var api = {
    configure: configure,
    loadFromManifest: loadFromManifest,
    listTools: listTools,
    call: call,
    getConfig: function () {
      return Object.assign({}, config);
    },
    isEnabled: function () {
      return !!config.enabled;
    },
  };

  global.WebtoolsMcp = api;
})(typeof window !== "undefined" ? window : globalThis);
