/*!
 * webtools-ui/js/extension-host.js
 *
 * Canonical VS Code-style extension host for sidebar packs.
 * Supports demo-portal (manifest + panel preload + WebtoolsExtensions hooks)
 * and slide-presenter (extension.json → ShellModule render) catalog shapes.
 */
(function (global) {
  "use strict";

  var packs = [];
  var panelHtmlById = Object.create(null);
  var activatedStartup = false;

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn("[ExtensionHost] " + msg);
    }
  }

  function resolveUrl(base, rel) {
    try {
      var docHref = (global.document && global.document.location) || global.location;
      var absoluteBase = new URL(base, docHref.href).href;
      if (!/\/$/.test(absoluteBase)) absoluteBase += "/";
      var u = new URL(rel, absoluteBase);
      return u.pathname + (u.search || "");
    } catch (_) {
      return rel;
    }
  }

  function manifestBaseUrl(manifestHref) {
    try {
      var docHref = (global.document && global.document.location) || global.location;
      return new URL(manifestHref, docHref.href).href.replace(/[^/]+$/, "");
    } catch (_) {
      return manifestHref.replace(/[^/]+$/, "");
    }
  }

  function extensionManifestUrl(entry) {
    if (entry.manifest) return entry.manifest;
    if (entry.path) {
      var path = String(entry.path).replace(/^\/+/, "");
      if (/\/extension\.json$/.test(path)) return "../" + path;
      return "../" + path + "/extension.json";
    }
    return null;
  }

  function resolveCatalogHref(catalogSource, href) {
    try {
      var docHref = (global.document && global.document.location) || global.location;
      var base = new URL(catalogSource, docHref.href).href.replace(/[^/]+$/, "");
      var u = new URL(href, base);
      return u.pathname + (u.search || "");
    } catch (_) {
      return href;
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!global.document) {
        resolve();
        return;
      }
      if (document.querySelector('script[data-extension-host-src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.setAttribute("data-extension-host-src", src);
      s.onload = function () { resolve(); };
      s.onerror = function () {
        reject(new Error("extension script failed: " + src));
      };
      document.head.appendChild(s);
    });
  }

  function loadPackScripts(pack) {
    var entry = pack.manifest && pack.manifest.entry;
    var scripts = (entry && entry.scripts) || [];
    if (!scripts.length && pack.manifest && pack.manifest.main) {
      scripts = [pack.manifest.main];
    }
    if (!scripts.length) return Promise.resolve();
    return scripts.reduce(function (chain, rel) {
      return chain.then(function () {
        return loadScript(resolveUrl(pack.baseUrl, rel));
      });
    }, Promise.resolve());
  }

  function shellModuleId(pack) {
    var c = pack.manifest && pack.manifest.contributes;
    if (c && c.shellModule) return c.shellModule;
    var sidebar = c && c.views && c.views.sidebar;
    if (sidebar && sidebar.id) return sidebar.id;
    return pack.id;
  }

  function toShellModule(manifest) {
    var c = manifest && manifest.contributes;
    var sidebar = c && c.views && c.views.sidebar;
    if (!sidebar || typeof sidebar !== "object" || !sidebar.id) return null;
    return {
      id: sidebar.id || manifest.id,
      label: sidebar.label || manifest.displayName || manifest.name || manifest.id,
      icon: sidebar.icon || "widgets",
      mode: sidebar.mode || "standard",
      order: sidebar.order || 0,
      title: sidebar.title || "",
      provider: manifest.id,
      panel: sidebar.panel || {
        type: "iframe",
        src: "../extensions/" + manifest.id + "/view.html",
        lazy: true,
      },
    };
  }

  function collectMcpTools(loaded) {
    return loaded.reduce(function (acc, pack) {
      var mcp = pack.manifest && pack.manifest.contributes && pack.manifest.contributes.mcp;
      var tools = (mcp && mcp.tools) || [];
      tools.forEach(function (tool) {
        acc.push(Object.assign({ extension: pack.manifest.id || pack.id }, tool));
      });
      return acc;
    }, []);
  }

  function loadManifestEntry(entry, catalogSource) {
    if (entry.enabled === false) return Promise.resolve(null);
    var href = extensionManifestUrl(entry);
    if (!href) return Promise.resolve(null);
    if (catalogSource) {
      href = resolveCatalogHref(catalogSource, href);
    }
    return fetch(href)
      .then(function (r) {
        if (!r.ok) throw new Error(href + " HTTP " + r.status);
        return r.json();
      })
      .then(function (manifest) {
        var base = manifestBaseUrl(href);
        return {
          id: entry.id || manifest.id,
          manifest: manifest,
          baseUrl: base,
          panelUrl: manifest.panel ? resolveUrl(base, manifest.panel) : null,
        };
      });
  }

  function preloadPanel(pack) {
    if (!pack.panelUrl) return Promise.resolve();
    return fetch(pack.panelUrl)
      .then(function (r) {
        if (!r.ok) throw new Error(pack.panelUrl + " HTTP " + r.status);
        return r.text();
      })
      .then(function (html) {
        panelHtmlById[pack.id] = html;
      })
      .catch(function (err) {
        warn("panel preload failed for " + pack.id + ": " + (err && err.message ? err.message : err));
      });
  }

  function finalizeRenderedNav() {
    if (!global.document) return;
    document.querySelectorAll(".sidebar-nav .nav-btn[data-tab]").forEach(function (btn) {
      var tab = btn.getAttribute("data-tab");
      if (!tab) return;
      btn.id = "tab-" + tab;
      btn.setAttribute("aria-controls", "panel-" + tab);
    });
    document.querySelectorAll(".tab-panel[role='tabpanel']").forEach(function (panel) {
      var tab = panel.id && panel.id.indexOf("panel-") === 0 ? panel.id.slice(6) : "";
      if (tab) panel.setAttribute("aria-labelledby", "tab-" + tab);
    });
  }

  function attachShellModuleHooks() {
    if (!global.ShellModules) return;
    packs.forEach(function (pack) {
      var api = global.WebtoolsExtensions && global.WebtoolsExtensions[pack.id];
      if (!api) return;
      var modId = shellModuleId(pack);
      var mod = global.ShellModules.get(modId);
      if (!mod) {
        warn("no shell module registered for extension " + pack.id + " (" + modId + ")");
        return;
      }
      if (api.mount) {
        mod.panel = {
          type: "mount",
          mount: function (panel, ctx) {
            return api.mount(panel, ctx);
          },
        };
      }
      if (typeof api.onActivate === "function") {
        mod.onActivate = function (panel, ctx) {
          return api.onActivate(panel, ctx);
        };
      }
      if (typeof api.onDeactivate === "function") {
        mod.onDeactivate = function (panel, ctx) {
          return api.onDeactivate(panel, ctx);
        };
      }
      mod.provider = pack.id;
    });
  }

  function runStartupActivations() {
    if (activatedStartup) return;
    activatedStartup = true;
    packs.forEach(function (pack) {
      var events = (pack.manifest && pack.manifest.activationEvents) || [];
      if (events.indexOf("onStartup") === -1) return;
      var api = global.WebtoolsExtensions && global.WebtoolsExtensions[pack.id];
      if (api && typeof api.activate === "function") {
        try {
          api.activate();
        } catch (err) {
          warn("onStartup failed for " + pack.id + ": " + (err && err.message ? err.message : err));
        }
      }
    });
  }

  function loadCatalog(source) {
    return fetch(source)
      .then(function (r) {
        if (!r.ok) throw new Error(source + " HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var entries = (data && data.extensions) || [];
        return Promise.all(entries.map(function (entry) {
          return loadManifestEntry(entry, source);
        })).then(function (loaded) {
          return { loaded: loaded.filter(Boolean), defaultTab: data.defaultTab };
        });
      });
  }

  function publishWorkbenchMeta(loaded) {
    global.__workbenchExtensions = loaded.map(function (p) { return p.manifest; });
    global.__workbenchMcp = { tools: collectMcpTools(loaded) };
  }

  function init(options) {
    options = options || {};
    var source = options.source || "../data/extensions.json";
    return loadCatalog(source)
      .then(function (result) {
        packs = result.loaded;
        publishWorkbenchMeta(packs);
        return Promise.all(packs.map(preloadPanel))
          .then(function () {
            return packs.reduce(function (chain, pack) {
              return chain.then(function () { return loadPackScripts(pack); });
            }, Promise.resolve());
          })
          .then(function () { return api; });
      })
      .catch(function (err) {
        warn("init failed: " + (err && err.message ? err.message : err));
        return api;
      });
  }

  function boot(opts) {
    opts = opts || {};
    if (!global.ShellModules) {
      warn("ShellModules missing; cannot boot extensions.");
      return Promise.resolve([]);
    }
    var source = opts.catalog || opts.source || "../data/extensions.json";
    return loadCatalog(source)
      .then(function (result) {
        packs = result.loaded;
        publishWorkbenchMeta(packs);
        var modules = [];
        packs.forEach(function (pack) {
          var mod = toShellModule(pack.manifest);
          if (mod) modules.push(mod);
        });
        return global.ShellModules.init({
          modules: modules,
          defaultTab: opts.defaultTab || result.defaultTab || (modules[0] && modules[0].id),
          render: opts.render !== false,
          hooksOnly: opts.render === false,
        }).then(function () {
          if (opts.render !== false) {
            attachShellModuleHooks();
            finalizeRenderedNav();
            runStartupActivations();
          }
          return packs.map(function (p) { return p.manifest; });
        });
      })
      .catch(function (err) {
        warn("boot failed: " + (err && err.message ? err.message : err));
        return [];
      });
  }

  function afterShellModulesRender() {
    attachShellModuleHooks();
    finalizeRenderedNav();
    runStartupActivations();
  }

  var api = {
    init: init,
    boot: boot,
    toShellModule: toShellModule,
    list: function () { return packs.slice(); },
    get: function (id) {
      for (var i = 0; i < packs.length; i++) {
        if (packs[i].id === id) return packs[i];
      }
      return null;
    },
    getPanelHtml: function (id) {
      return panelHtmlById[id] || "";
    },
    attachShellModuleHooks: attachShellModuleHooks,
    afterShellModulesRender: afterShellModulesRender,
  };

  global.ExtensionHost = api;
})(typeof window !== "undefined" ? window : globalThis);
