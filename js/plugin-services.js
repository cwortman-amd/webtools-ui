/*!
 * webtools-ui/js/plugin-services.js
 *
 * Manifest-driven T4 service bootstrap: MCP suite + Agent Gateway.
 * Call from each consumer plugin-mount.js after platform.js loads.
 */
(function (global) {
  "use strict";

  function loadManifest(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function bootFromManifest(manifestUrl, opts) {
    opts = opts || {};
    manifestUrl = manifestUrl || "../plugin.manifest.json";
    return loadManifest(manifestUrl).then(function (manifest) {
      var chain = Promise.resolve(manifest);
      if (global.WebtoolsMcp && typeof global.WebtoolsMcp.loadFromManifest === "function") {
        global.WebtoolsMcp.loadFromManifest(manifest);
      }
      if (global.AgentGateway && typeof global.AgentGateway.loadFromManifest === "function") {
        chain = chain.then(function (m) {
          return global.AgentGateway.loadFromManifest(m).then(function () { return m; });
        });
      }
      return chain.then(function (m) {
        return m;
      });
    });
  }

  global.PluginServices = {
    bootFromManifest: bootFromManifest,
    loadManifest: loadManifest,
  };
})(typeof window !== "undefined" ? window : globalThis);
