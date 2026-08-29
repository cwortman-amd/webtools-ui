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
  var services = Object.create(null);
  var commands = Object.create(null);
  var contexts = Object.create(null);
  var failed = Object.create(null);

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn("[ExtensionHost] " + msg);
    }
  }

  function DisposableStore() {
    this._items = [];
    this._disposed = false;
  }
  DisposableStore.prototype.push = function (item) {
    if (this._disposed) {
      tryDispose(item);
      return item;
    }
    this._items.push(item);
    return item;
  };
  DisposableStore.prototype.dispose = function () {
    if (this._disposed) return;
    this._disposed = true;
    this._items.splice(0).forEach(tryDispose);
  };

  function tryDispose(item) {
    try {
      if (typeof item === "function") item();
      else if (item && typeof item.dispose === "function") item.dispose();
    } catch (err) {
      warn("dispose failed: " + (err && err.message ? err.message : err));
    }
  }

  function namespacedStorage(extId, area) {
    var prefix = "ext:" + extId + ":" + area + ":";
    function store() {
      try { return global.localStorage; } catch (_) { return null; }
    }
    return {
      get: function (key) {
        var ls = store();
        if (!ls) return null;
        try { return JSON.parse(ls.getItem(prefix + key)); } catch (_) { return ls.getItem(prefix + key); }
      },
      set: function (key, value) {
        var ls = store();
        if (!ls) return;
        ls.setItem(prefix + key, JSON.stringify(value));
      },
      remove: function (key) {
        var ls = store();
        if (ls) ls.removeItem(prefix + key);
      }
    };
  }

  function createContext(pack) {
    var store = new DisposableStore();
    var extId = pack.id;
    var ctx = {
      extensionId: extId,
      subscriptions: store,
      storage: {
        workspace: namespacedStorage(extId, "workspace"),
        global: namespacedStorage(extId, "global")
      },
      commands: {
        register: function (id, handler) {
          commands[id] = handler;
          return store.push(function () {
            if (commands[id] === handler) delete commands[id];
          });
        }
      },
      views: {
        register: function (viewId, mountFn) {
          return store.push(function () { /* view unmount owned by ShellModules */ });
        }
      },
      events: {
        on: function (name, handler) {
          if (!global.document) return store.push(function () {});
          var wrapped = function (ev) { handler(ev.detail, ev); };
          global.document.addEventListener(name, wrapped);
          return store.push(function () {
            global.document.removeEventListener(name, wrapped);
          });
        }
      },
      services: {
        get: function (id) {
          if (!services[id]) throw new Error("unknown service " + id);
          return services[id];
        },
        register: function (id, api) {
          services[id] = api;
          return store.push(function () {
            if (services[id] === api) delete services[id];
          });
        },
        tryGet: function (id) { return services[id] || null; }
      }
    };
    contexts[extId] = ctx;
    return ctx;
  }

  function semverSatisfies(version, range) {
    if (!range || range === "*" ) return true;
    var v = String(version || "0.0.0").replace(/^v/, "").split(".").map(Number);
    var m = String(range).match(/^\^?(\d+)\.(\d+)\.(\d+)/);
    if (!m) return true;
    if (range.charAt(0) === "^") return v[0] === Number(m[1]) && !(v[0] === Number(m[1]) && v[1] < Number(m[2]));
    return v[0] === Number(m[1]) && v[1] === Number(m[2]) && v[2] === Number(m[3]);
  }

  function validateManifest(manifest, options) {
    options = options || {};
    var errors = [];
    if (!manifest || !manifest.id) errors.push("missing id");
    if (!manifest.apiVersion && !options.legacyOk) errors.push("missing apiVersion");
    if (manifest.engines && manifest.engines.webtools && options.hostVersion) {
      if (!semverSatisfies(options.hostVersion, manifest.engines.webtools)) {
        errors.push("incompatible engines.webtools");
      }
    }
    var deps = (manifest.extensionDependencies && typeof manifest.extensionDependencies === "object")
      ? Object.keys(manifest.extensionDependencies)
      : [];
    return { ok: errors.length === 0, errors: errors, dependencies: deps };
  }

  function detectCycles(loaded) {
    var graph = Object.create(null);
    loaded.forEach(function (pack) {
      var deps = (pack.manifest && pack.manifest.extensionDependencies) || {};
      graph[pack.id] = Object.keys(deps);
    });
    var visiting = Object.create(null);
    var visited = Object.create(null);
    var cyclic = [];
    function dfs(id) {
      if (visiting[id]) { cyclic.push(id); return; }
      if (visited[id]) return;
      visiting[id] = true;
      (graph[id] || []).forEach(dfs);
      visiting[id] = false;
      visited[id] = true;
    }
    Object.keys(graph).forEach(dfs);
    return cyclic;
  }

  function topoOrder(loaded) {
    var byId = Object.create(null);
    loaded.forEach(function (p) { byId[p.id] = p; });
    var ordered = [];
    var seen = Object.create(null);
    function visit(pack) {
      if (!pack || seen[pack.id]) return;
      seen[pack.id] = true;
      var deps = (pack.manifest && pack.manifest.extensionDependencies) || {};
      Object.keys(deps).forEach(function (depId) {
        visit(byId[depId]);
      });
      ordered.push(pack);
    }
    loaded.forEach(visit);
    return ordered;
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
    if (c && c.shellModule) {
      if (typeof c.shellModule === "string") return c.shellModule;
      if (typeof c.shellModule === "object" && c.shellModule.id) return c.shellModule.id;
    }
    var sidebar = c && c.views && c.views.sidebar;
    if (sidebar && sidebar.id) return sidebar.id;
    return pack.id;
  }

  function toShellModule(manifest) {
    var c = manifest && manifest.contributes;
    var sidebar = c && c.views && c.views.sidebar;
    if (!sidebar || typeof sidebar !== "object" || !sidebar.id) return null;
    var panel = sidebar.panel || {
      type: "iframe",
      src: "../extensions/" + manifest.id + "/view.html",
      lazy: true,
    };
    if (sidebar.mount && !panel.mount) {
      panel = { type: "mount", mount: sidebar.mount };
    }
    return {
      id: sidebar.id || manifest.id,
      label: sidebar.label || manifest.displayName || manifest.name || manifest.id,
      icon: sidebar.icon || "widgets",
      mode: sidebar.mode || "standard",
      order: sidebar.order || 0,
      title: sidebar.title || "",
      provider: manifest.id,
      panel: panel,
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
        var check = validateManifest(manifest, { legacyOk: true, hostVersion: "1.0.0" });
        if (!check.ok) {
          warn("manifest rejected for " + (manifest.id || href) + ": " + check.errors.join(", "));
          failed[manifest.id || href] = check.errors;
          return null;
        }
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
      if (!btn.id) btn.id = "tab-" + tab;
      if (!btn.getAttribute("aria-controls")) {
        var legacy = global.ShellModules && global.ShellModules.legacyPanelId
          ? global.ShellModules.legacyPanelId(tab)
          : "panel-" + tab;
        btn.setAttribute("aria-controls", legacy);
      }
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

  function activatePack(pack) {
    if (failed[pack.id]) return;
    var api = global.WebtoolsExtensions && global.WebtoolsExtensions[pack.id];
    if (!api || typeof api.activate !== "function") return;
    try {
      var ctx = contexts[pack.id] || createContext(pack);
      api.activate(ctx);
    } catch (err) {
      failed[pack.id] = [String(err && err.message ? err.message : err)];
      warn("activate failed for " + pack.id + ": " + failed[pack.id][0]);
    }
  }

  function deactivatePack(id) {
    var ctx = contexts[id];
    if (ctx && ctx.subscriptions) ctx.subscriptions.dispose();
    var api = global.WebtoolsExtensions && global.WebtoolsExtensions[id];
    if (api && typeof api.deactivate === "function") {
      try { api.deactivate(); } catch (err) {
        warn("deactivate failed for " + id + ": " + (err && err.message ? err.message : err));
      }
    }
    delete contexts[id];
  }

  function runStartupActivations() {
    if (activatedStartup) return;
    activatedStartup = true;
    var cyclic = detectCycles(packs);
    if (cyclic.length) {
      warn("cyclic extensionDependencies: " + cyclic.join(", "));
      cyclic.forEach(function (id) { failed[id] = ["cyclic dependency"]; });
    }
    topoOrder(packs).forEach(function (pack) {
      var events = (pack.manifest && pack.manifest.activationEvents) || [];
      if (events.indexOf("onStartup") === -1 && events.length) return;
      activatePack(pack);
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
        var seen = Object.create(null);
        return Promise.all(entries.map(function (entry) {
          if (entry.id && seen[entry.id]) {
            warn("duplicate extension id " + entry.id);
            return Promise.resolve(null);
          }
          if (entry.id) seen[entry.id] = true;
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
          preserveDom: opts.preserveDom,
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
    validateManifest: validateManifest,
    DisposableStore: DisposableStore,
    createContext: createContext,
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
    executeCommand: function (id, args) {
      if (!commands[id]) return { error: "unknown command " + id };
      return commands[id](args);
    },
    getService: function (id) { return services[id] || null; },
    failedExtensions: function () { return Object.assign({}, failed); },
    deactivate: deactivatePack,
    attachShellModuleHooks: attachShellModuleHooks,
    afterShellModulesRender: afterShellModulesRender,
  };

  global.ExtensionHost = api;
})(typeof window !== "undefined" ? window : globalThis);
