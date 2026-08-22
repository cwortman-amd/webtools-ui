/*!
 * webtools-ui/js/plugin-bootstrap.js
 *
 * Unified manifest-driven bootstrap (WS-3): MCP + Agent Gateway + ExtensionHost.
 * Consumers call bootstrapFromManifest() once from plugin-mount.js.
 */
(function (global) {
  "use strict";

  function resolveExtensionsSource(manifest) {
    var reg = manifest.registrations || {};
    var ext = reg.extensions;
    if (typeof ext === "string") {
      return ext.indexOf("/") >= 0 ? ext : "../data/" + ext;
    }
    var contrib = (manifest.contributes || {}).extensions;
    if (typeof contrib === "string") {
      return contrib.indexOf("/") >= 0 ? contrib : "../data/" + contrib;
    }
    if (Array.isArray(contrib) && contrib.length === 1 && typeof contrib[0] === "string") {
      return contrib[0];
    }
    return "";
  }

  function bootstrapFromManifest(manifestUrl, opts) {
    opts = opts || {};
    manifestUrl = manifestUrl || "../plugin.manifest.json";

    var chain = global.PluginServices && typeof global.PluginServices.loadManifest === "function"
      ? global.PluginServices.loadManifest(manifestUrl)
      : fetch(manifestUrl, { cache: "no-cache" }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });

    if (global.PluginServices && typeof global.PluginServices.bootFromManifest === "function") {
      chain = global.PluginServices.bootFromManifest(manifestUrl, opts);
    }

    return chain.then(function (manifest) {
      if (opts.extensions === false || !global.ExtensionHost) {
        return manifest;
      }
      var source = opts.extensionsSource || resolveExtensionsSource(manifest);
      if (!source) return manifest;
      return global.ExtensionHost.init({ source: source }).then(function () {
        return manifest;
      });
    });
  }

  global.PluginBootstrap = {
    bootstrapFromManifest: bootstrapFromManifest,
    resolveExtensionsSource: resolveExtensionsSource,
  };

  if (global.WebtoolsPlatform) {
    global.WebtoolsPlatform.bootstrapFromManifest = bootstrapFromManifest;
  }
})(typeof window !== "undefined" ? window : globalThis);
