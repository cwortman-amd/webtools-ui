/*!
 * webtools-ui/js/shell-modules.js
 *
 * Shell module registry — snap product features onto the harmonized sidebar shell.
 * Contract: docs/SHELL_MODULES.md
 *
 * Load after shell.js is parsed (Shell may init after ShellModules.init).
 */
(function (global) {
  "use strict";

  if (global.ShellModules) return;

  var modules = [];
  var byId = Object.create(null);
  var activeTabId = null;
  var opts = { hooksOnly: false, preserveDom: false, features: Object.create(null), skipModeVisibility: false };

  var LEGACY_PANEL_IDS = {
    workload: "tabWorkload",
    gpu: "tabGpu",
    nic: "tabNic",
    switch: "tabSwitch",
    config: "tabConfig",
    bom: "tabBom",
    arch: "tabArch",
    rack: "tabRack",
    net: "tabNet",
    dc: "tabDc",
    power: "tabPower",
    tco: "tabTco"
  };

  function legacyPanelId(tabId) {
    return LEGACY_PANEL_IDS[tabId] || ("panel-" + tabId);
  }

  function resolvePanelElement(tabId) {
    if (!global.document) return null;
    var canonical = document.getElementById("panel-" + tabId);
    if (canonical) return canonical;
    return document.getElementById(legacyPanelId(tabId));
  }

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn("[ShellModules] " + msg);
    }
  }

  function modeClass(mode) {
    if (mode === "advanced") return "mode-advanced";
    if (mode === "expert") return "mode-expert";
    return "";
  }

  function sortedModules() {
    return modules.slice().sort(function (a, b) {
      return (a.order || 0) - (b.order || 0);
    }).filter(function (m) { return m.enabled !== false; });
  }

  function allModules() {
    return modules.slice();
  }

  function buildContext(tabId) {
    var body = document.body;
    return {
      tabId: tabId,
      userMode: body.getAttribute("data-user-mode") || "standard",
      skin: document.documentElement.getAttribute("data-skin") || "amd-gold",
      theme: body.getAttribute("data-theme") || "dark",
      collapsed: body.classList.contains("nav-collapsed"),
      platform: global.WebtoolsPlatform || null,
      features: opts.features,
    };
  }

  function isModuleVisible(mod, ctx) {
    if (mod.enabled === false) return false;
    if (typeof mod.visible === "function" && !mod.visible(ctx)) return false;
    var mode = mod.mode || "standard";
    if (mode === "advanced" && ctx.userMode === "standard") return false;
    if (mode === "expert" && ctx.userMode !== "expert") return false;
    return true;
  }

  function resolveTabId(tabId) {
    var mod = byId[tabId];
    if (!mod) return tabId;
    var ctx = buildContext(tabId);
    if (!isModuleVisible(mod, ctx)) {
      var fallback = opts.defaultTab || (modules[0] && modules[0].id);
      return fallback || tabId;
    }
    if (typeof mod.onBeforeActivate === "function") {
      try {
        var next = mod.onBeforeActivate(ctx);
        if (typeof next === "string" && next) return next;
      } catch (err) {
        warn("onBeforeActivate failed for " + tabId + ": " + (err && err.message ? err.message : err));
      }
    }
    return tabId;
  }

  function navSelector(tabId) {
    return '.sidebar-nav .nav-btn[data-tab="' + CSS.escape(tabId) + '"],' +
      '.sidebar-bottom .nav-btn[data-tab="' + CSS.escape(tabId) + '"],' +
      '.sidebar-bottom [data-tab="' + CSS.escape(tabId) + '"]';
  }

  function createNavButton(mod, isActive) {
    var btn = document.createElement("button");
    btn.className = "nav-btn" + (isActive ? " active" : "");
    var mc = modeClass(mod.mode);
    if (mc) btn.classList.add(mc);
    btn.setAttribute("role", "tab");
    btn.setAttribute("data-tab", mod.id);
    btn.setAttribute("aria-selected", String(!!isActive));
    if (mod.title) btn.title = mod.title;
    if (mod.placement === "bottom") btn.classList.add("util-btn-docs");

    var icon = document.createElement("span");
    icon.className = "material-symbols-outlined";
    icon.textContent = mod.icon;
    btn.appendChild(icon);

    var label = document.createElement("span");
    label.className = "nav-label";
    label.textContent = mod.label;
    btn.appendChild(label);

    return btn;
  }

  function createPanel(mod) {
    var panel = document.createElement("div");
    panel.id = "panel-" + mod.id;
    panel.className = "tab-panel hidden";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "tab-" + mod.id);

    var def = mod.panel || {};
    if (def.type === "iframe") {
      var frame = document.createElement("iframe");
      frame.className = "tab-frame";
      frame.id = "frame-" + mod.id;
      if (def.lazy !== false) {
        frame.setAttribute("data-src", def.src);
      } else {
        frame.src = def.src;
      }
      panel.appendChild(frame);
    } else if (def.type === "html" && def.html) {
      panel.innerHTML = def.html;
    } else if (def.type === "mount") {
      panel.setAttribute("data-mount", mod.id);
    }

    return panel;
  }

  function mountPanelModule(mod, panel) {
    if (!panel || mod.panel.type !== "mount" || typeof mod.panel.mount !== "function") return;
    try {
      var cleanup = mod.panel.mount(panel, buildContext(mod.id));
      if (typeof cleanup === "function") {
        panel._shellModuleCleanup = cleanup;
      }
    } catch (err) {
      warn("panel.mount failed for " + mod.id + ": " + (err && err.message ? err.message : err));
    }
  }

  function render(options) {
    options = options || {};
    if (opts.preserveDom || opts.hooksOnly) {
      wireNavClicks();
      return false;
    }
    var navRoot = options.nav || document.querySelector(".sidebar-nav");
    var bottomRoot = options.bottom || document.querySelector(".sidebar-bottom");
    var panelsRoot = options.panels || document.querySelector(".shell-body");
    if (!navRoot || !panelsRoot) {
      warn("render() requires .sidebar-nav and .shell-body (or explicit selectors)");
      return false;
    }

    navRoot.innerHTML = "";
    sortedModules().forEach(function (mod) {
      if (mod.placement === "bottom") {
        if (!bottomRoot) return;
        var utilWrap = bottomRoot.querySelector(".shell-modules-bottom-nav");
        if (!utilWrap) {
          utilWrap = document.createElement("div");
          utilWrap.className = "shell-modules-bottom-nav";
          bottomRoot.insertBefore(utilWrap, bottomRoot.firstChild);
        }
        if (!mod.navHidden) {
          utilWrap.appendChild(createNavButton(mod, mod.id === opts.defaultTab));
        }
      } else if (!mod.navHidden) {
        navRoot.appendChild(createNavButton(mod, mod.id === opts.defaultTab));
      }
      panelsRoot.appendChild(createPanel(mod));
    });

    wireNavClicks();
    return true;
  }

  function wireNavClicks() {
    document.querySelectorAll(".sidebar-nav .nav-btn, .sidebar-bottom [data-tab]").forEach(function (btn) {
      if (btn._shellModulesBound) return;
      btn._shellModulesBound = true;
      btn.addEventListener("click", function () {
        if (this.disabled) return;
        var shell = global.Shell;
        if (shell && typeof shell.switchTab === "function") {
          shell.switchTab(resolveTabId(this.getAttribute("data-tab")));
        }
      });
    });
  }

  function deactivateModule(tabId) {
    var mod = byId[tabId];
    var panel = resolvePanelElement(tabId);
    if (panel) cleanupPanel(panel);
    if (!mod || typeof mod.onDeactivate !== "function") return;
    try {
      mod.onDeactivate(panel, buildContext(tabId));
    } catch (err) {
      warn("onDeactivate failed for " + tabId + ": " + (err && err.message ? err.message : err));
    }
  }

  function activateModule(tabId) {
    var mod = byId[tabId];
    if (!mod) return;
    var panel = resolvePanelElement(tabId);
    if (mod.panel && mod.panel.type === "mount") mountPanelModule(mod, panel);
    if (typeof mod.onActivate === "function") {
      try {
        mod.onActivate(panel, buildContext(tabId));
      } catch (err) {
        warn("onActivate failed for " + tabId + ": " + (err && err.message ? err.message : err));
      }
    }
  }

  function onTabChanged(ev) {
    var tabId = ev.detail && ev.detail.tabId;
    if (!tabId) return;
    if (activeTabId && activeTabId !== tabId) deactivateModule(activeTabId);
    activeTabId = tabId;
    activateModule(tabId);
  }

  function applyModeVisibility() {
    var ctx = buildContext(activeTabId);
    sortedModules().forEach(function (mod) {
      var btn = document.querySelector(navSelector(mod.id));
      if (!btn) return;
      var show = isModuleVisible(mod, ctx);
      btn.hidden = !show;
      btn.disabled = !show;
    });
  }

  function cleanupPanel(panel) {
    if (!panel) return;
    if (typeof panel._shellModuleCleanup === "function") {
      try { panel._shellModuleCleanup(); } catch (err) {
        warn("module cleanup failed: " + (err && err.message ? err.message : err));
      }
      panel._shellModuleCleanup = null;
    }
  }

  function removeModuleDom(id) {
    if (opts.preserveDom || opts.hooksOnly) {
      cleanupPanel(resolvePanelElement(id));
      return;
    }
    var btn = document.querySelector(navSelector(id));
    if (btn) btn.remove();
    var panel = resolvePanelElement(id);
    if (panel) {
      cleanupPanel(panel);
      if (panel.id && panel.id.indexOf("panel-") === 0) panel.remove();
    }
  }

  function unregister(id) {
    var mod = byId[id];
    if (!mod) return false;
    if (activeTabId === id) deactivateModule(id);
    delete byId[id];
    modules = modules.filter(function (m) { return m.id !== id; });
    removeModuleDom(id);
    document.dispatchEvent(new CustomEvent("shellModule:unregistered", { detail: { id: id } }));
    if (activeTabId === id) activeTabId = null;
    return true;
  }

  function normalizeModule(def, options) {
    options = options || {};
    if (!def || !def.id) {
      warn("register() requires module.id");
      return null;
    }
    if (def.replaces) unregister(def.replaces);
    if (byId[def.id]) {
      if (options.force || def.force) {
        unregister(def.id);
      } else {
        warn("module already registered: " + def.id + " (pass force:true to replace)");
        return byId[def.id];
      }
    }
    var mod = {
      id: def.id,
      label: def.label || def.id,
      icon: def.icon || "widgets",
      mode: def.mode || "standard",
      order: def.order || 0,
      title: def.title || "",
      placement: def.placement || "nav",
      navHidden: def.navHidden === true,
      enabled: def.enabled !== false,
      provider: def.provider || "",
      replaces: def.replaces || "",
      panel: def.panel || { type: "iframe", src: def.id + ".html", lazy: true },
      visible: def.visible,
      onBeforeActivate: def.onBeforeActivate,
      onActivate: def.onActivate,
      onDeactivate: def.onDeactivate,
    };
    byId[mod.id] = mod;
    modules.push(mod);
    document.dispatchEvent(new CustomEvent("shellModule:registered", { detail: { module: mod } }));
    return mod;
  }

  function replaceModule(id, def) {
    def = def || {};
    def.id = def.id || id;
    def.force = true;
    if (!byId[id] && !def.replaces) def.replaces = id;
    var mod = normalizeModule(def, { force: true });
    if (opts.render && !opts.hooksOnly) render(opts.render);
    else applyModeVisibility();
    return mod;
  }

  function setEnabled(id, enabled) {
    var mod = byId[id];
    if (!mod) return false;
    mod.enabled = !!enabled;
    applyModeVisibility();
    if (!mod.enabled && activeTabId === id) {
      var fallback = opts.defaultTab;
      if (fallback && byId[fallback] && global.Shell && global.Shell.switchTab) {
        global.Shell.switchTab(fallback);
      }
    }
    document.dispatchEvent(new CustomEvent("shellModule:enabledChanged", {
      detail: { id: id, enabled: mod.enabled },
    }));
    return true;
  }

  function registerFromJson(data) {
    if (!data || !Array.isArray(data.modules)) {
      warn("invalid shell module JSON");
      return;
    }
    if (data.defaultTab) opts.defaultTab = data.defaultTab;
    data.modules.forEach(function (m) { normalizeModule(m); });
  }

  function loadJson(source) {
    return fetch(source)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        registerFromJson(data);
        if (opts.render && !opts.hooksOnly) render(opts.render);
        return data;
      })
      .catch(function (err) {
        warn("failed to load " + source + ": " + (err && err.message ? err.message : err));
      });
  }

  function patchShellSwitchTab() {
    var shell = global.Shell;
    if (!shell || shell._shellModulesPatched || typeof shell.switchTab !== "function") return;
    var original = shell.switchTab;
    shell.switchTab = function (tabId, switchOpts) {
      var resolved = resolveTabId(tabId);
      document.dispatchEvent(new CustomEvent("shellModule:beforeActivate", {
        detail: { tabId: tabId, resolvedTabId: resolved },
      }));
      return original.call(shell, resolved, switchOpts);
    };
    shell._shellModulesPatched = true;
  }

  function init(initOpts) {
    initOpts = initOpts || {};
    opts.hooksOnly = !!initOpts.hooksOnly;
    opts.preserveDom = !!initOpts.preserveDom || !!initOpts.hooksOnly;
    opts.skipModeVisibility = !!initOpts.skipModeVisibility;
    opts.render = initOpts.render === true ? {} : (initOpts.render || null);
    opts.features = initOpts.features || opts.features;
    if (initOpts.defaultTab) opts.defaultTab = initOpts.defaultTab;

    if (Array.isArray(initOpts.modules)) {
      initOpts.modules.forEach(function (m) { normalizeModule(m); });
    }

    patchShellSwitchTab();

    document.addEventListener("shell:tabChanged", onTabChanged);
    document.addEventListener("shell:modeChanged", applyModeVisibility);

    var done = Promise.resolve();
    if (initOpts.source) {
      done = loadJson(initOpts.source);
    } else if (opts.render && !opts.hooksOnly) {
      render(opts.render);
    } else {
      wireNavClicks();
    }

    return done.then(function () {
      if (opts.hooksOnly) wireNavClicks();
      if (!opts.skipModeVisibility) applyModeVisibility();
      return api;
    });
  }

  var api = {
    register: function (def) { return normalizeModule(def); },
    registerFromJson: registerFromJson,
    unregister: unregister,
    replace: replaceModule,
    setEnabled: setEnabled,
    list: function () { return allModules(); },
    listEnabled: sortedModules,
    get: function (id) { return byId[id] || null; },
    render: render,
    init: init,
    resolveTabId: resolveTabId,
    resolvePanelElement: resolvePanelElement,
    legacyPanelId: legacyPanelId,
    cleanupPanel: cleanupPanel,
    isModuleVisible: function (id) {
      var mod = byId[id];
      return mod ? isModuleVisible(mod, buildContext(id)) : true;
    },
  };

  global.ShellModules = api;
})(typeof window !== "undefined" ? window : globalThis);
