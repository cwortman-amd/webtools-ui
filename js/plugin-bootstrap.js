/*!
 * webtools-ui/js/plugin-bootstrap.js
 *
 * Unified manifest-driven bootstrap (WS-3): MCP + Agent Gateway + ExtensionHost
 * + deferred chat-orb-mount (registrations.slashCommands).
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

  function resolveScriptPath(scriptPath) {
    if (!scriptPath) return "";
    if (/^https?:\/\//.test(scriptPath)) return scriptPath;
    if (scriptPath.indexOf("/") >= 0) {
      return scriptPath.indexOf("../") === 0 ? scriptPath : "../" + scriptPath.replace(/^\/+/, "");
    }
    return "../" + scriptPath;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!global.document) {
        resolve();
        return;
      }
      if (document.querySelector('script[data-plugin-bootstrap-src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.setAttribute("data-plugin-bootstrap-src", src);
      s.onload = function () { resolve(); };
      s.onerror = function () {
        reject(new Error("bootstrap script failed: " + src));
      };
      document.head.appendChild(s);
    });
  }

  function loadDeferredScripts(manifest, opts) {
    if (opts.chatMount === false) return Promise.resolve();
    var reg = manifest.registrations || {};
    var scripts = [];
    if (reg.slashCommands) scripts.push(resolveScriptPath(reg.slashCommands));
    var entry = manifest.entry || {};
    if (entry.voice && entry.voice !== reg.voicePersonas) {
      scripts.push(resolveScriptPath(entry.voice));
    }
    return scripts.reduce(function (chain, src) {
      return chain.then(function () { return loadScript(src); });
    }, Promise.resolve());
  }

  function bootstrapFromManifest(manifestUrl, opts) {
    opts = opts || {};
    manifestUrl = manifestUrl || "../plugin.manifest.json";

    var chain = global.PluginServices && typeof global.PluginServices.bootFromManifest === "function"
      ? global.PluginServices.bootFromManifest(manifestUrl, opts)
      : fetch(manifestUrl, { cache: "no-cache" }).then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        });

    return chain.then(function (manifest) {
      var extChain = Promise.resolve(manifest);
      if (opts.extensions !== false && global.ExtensionHost) {
        var source = opts.extensionsSource || resolveExtensionsSource(manifest);
        if (source) {
          extChain = extChain.then(function () {
            return global.ExtensionHost.init({ source: source }).then(function () { return manifest; });
          });
        }
      }
      return extChain.then(function () {
        var adapters = Promise.resolve();
        if (global.WebtoolsMcp && typeof global.WebtoolsMcp.loadFromManifest === "function") {
          adapters = adapters.then(function () {
            return Promise.resolve(global.WebtoolsMcp.loadFromManifest(manifest));
          });
        }
        if (global.AgentGateway && typeof global.AgentGateway.loadFromManifest === "function") {
          adapters = adapters.then(function () {
            return Promise.resolve(global.AgentGateway.loadFromManifest(manifest));
          });
        }
        return adapters.then(function () {
          return loadDeferredScripts(manifest, opts).then(function () { return manifest; });
        });
      });
    });
  }

  global.PluginBootstrap = {
    bootstrapFromManifest: bootstrapFromManifest,
    resolveExtensionsSource: resolveExtensionsSource,
    loadDeferredScripts: loadDeferredScripts,
  };

  if (global.WebtoolsPlatform) {
    global.WebtoolsPlatform.bootstrapFromManifest = bootstrapFromManifest;
  }
})(typeof window !== "undefined" ? window : globalThis);
