/*!
 * webtools-ui/js/platform.js
 *
 * WebtoolsPlatform — formal App object for community plugins (sibling consumer repos).
 * Wraps existing canonical modules (ChatOrb, SlashRouter, Shell, etc.) without
 * changing their behavior. Load after shared primitives, before plugin mount scripts.
 *
 * Contract: docs/PLUGIN_CONTRACT.md
 */
(function (global) {
  "use strict";

  if (global.WebtoolsPlatform) return;

  var plugins = [];
  var pluginById = Object.create(null);
  var serviceOverrides = Object.create(null);
  var eventHandlers = Object.create(null);
  var activeContributions = Object.create(null);

  var DEFAULT_SERVICES = {
    chat: true,
    demo: true,
    voice: true,
  };

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn("[WebtoolsPlatform] " + msg);
    }
  }

  function getShell() {
    return global.Shell || null;
  }

  function getShellModules() {
    return global.ShellModules || null;
  }

  function getChrome() {
    return global.WebtoolsChrome || global.Chrome || null;
  }

  function getCommands() {
    return global.SlashRouter || null;
  }

  function getChat() {
    return global.ChatOrb || null;
  }

  function getDemo() {
    return global.DcDemo || global.DemoEngine || null;
  }

  function getVoice() {
    return global.voiceBridge || global.LocalVoice || null;
  }

  function getMobile() {
    return global.MobileDrawer || null;
  }

  function getErrors() {
    return global.ErrorPopup || global.showError || null;
  }

  function normalizeContributions(contributes) {
    contributes = contributes || {};
    var services = contributes.services || {};
    var normalizedServices = {};
    Object.keys(DEFAULT_SERVICES).forEach(function (key) {
      var entry = services[key];
      if (entry && typeof entry === "object") {
        normalizedServices[key] = entry.enabled !== false;
      } else if (typeof entry === "boolean") {
        normalizedServices[key] = entry;
      } else {
        normalizedServices[key] = DEFAULT_SERVICES[key];
      }
    });
    return {
      views: contributes.views || {},
      commands: contributes.commands || {},
      services: normalizedServices,
      activationEvents: Array.isArray(contributes.activationEvents)
        ? contributes.activationEvents.slice()
        : [],
    };
  }

  function bindEventHandlers(events) {
    events.forEach(function (ev) {
      if (ev.indexOf("onTab:") === 0) {
        var tabId = ev.slice(6);
        document.addEventListener("shell:tabChanged", function handler(e) {
          if (e.detail && e.detail.tabId === tabId) fireActivation(ev);
        });
      } else if (ev.indexOf("onUserMode:") === 0) {
        var mode = ev.slice(11);
        document.addEventListener("shell:modeChanged", function handler(e) {
          if (e.detail && e.detail.mode === mode) fireActivation(ev);
        });
      } else if (ev === "onStartup") {
        /* deferred until after plugin.onload — handlers register there */
      }
    });
  }

  function hasActivationEvent(name) {
    return activeContributions.activationEvents &&
      activeContributions.activationEvents.indexOf(name) >= 0;
  }

  function fireDeferredStartup() {
    if (hasActivationEvent("onStartup")) fireActivation("onStartup");
  }

  function fireActivation(eventName) {
    var list = eventHandlers[eventName];
    if (!list) return;
    list.slice().forEach(function (fn) {
      try { fn(platform); } catch (err) {
        warn("activation handler failed for " + eventName + ": " + (err && err.message ? err.message : err));
      }
    });
  }

  var contributionsApi = {
    /** Load contributes block from plugin manifest (call before register onload). */
    load: function (pluginId, contributes) {
      activeContributions = normalizeContributions(contributes);
      activeContributions.pluginId = pluginId || "";
      bindEventHandlers(activeContributions.activationEvents);
      return activeContributions;
    },
    get: function () {
      return activeContributions;
    },
    isServiceEnabled: function (name) {
      if (!activeContributions.services) return DEFAULT_SERVICES[name] !== false;
      if (activeContributions.services[name] === undefined) {
        return DEFAULT_SERVICES[name] !== false;
      }
      return !!activeContributions.services[name];
    },
    viewPath: function (slot) {
      var views = activeContributions.views || {};
      return views[slot] || null;
    },
    on: function (activationEvent, handler) {
      if (typeof handler !== "function") return;
      if (!eventHandlers[activationEvent]) eventHandlers[activationEvent] = [];
      eventHandlers[activationEvent].push(handler);
    },
  };

  var platform = {
    version: "0.9.0",

    /** Canonical module facades (read-only references). */
    shell: getShell(),
    shellModules: getShellModules(),
    chrome: getChrome(),
    commands: getCommands(),
    chat: getChat(),
    demo: getDemo(),
    voice: getVoice(),
    mobile: getMobile(),
    errors: getErrors(),
    contributions: contributionsApi,

    /** Replace a platform service facade (swap pattern for demo/voice/etc.). */
    registerService: function (name, impl) {
      serviceOverrides[name] = impl;
      if (name === "demo") platform.demo = impl;
      if (name === "voice") platform.voice = impl;
      if (name === "chat") platform.chat = impl;
      if (name === "commands") platform.commands = impl;
    },

    getService: function (name) {
      return serviceOverrides[name] || null;
    },

    /** Refresh facade references after late-loaded scripts. */
    refresh: function () {
      platform.shell = getShell();
      platform.shellModules = getShellModules();
      platform.chrome = getChrome();
      platform.commands = getCommands();
      platform.chat = getChat();
      platform.demo = getDemo();
      platform.voice = getVoice();
      platform.mobile = getMobile();
      platform.errors = getErrors();
    },

    /**
     * Register a community plugin object.
     * @param {{ id: string, onload?: Function, onunload?: Function }} plugin
     */
    register: function (plugin) {
      if (!plugin || !plugin.id) {
        warn("register() requires plugin.id");
        return;
      }
      if (pluginById[plugin.id]) {
        warn("plugin already registered: " + plugin.id);
        return;
      }
      pluginById[plugin.id] = plugin;
      plugins.push(plugin);
      if (plugin.contributes) {
        contributionsApi.load(plugin.id, plugin.contributes);
      }
      if (typeof plugin.onload === "function") {
        try {
          plugin.onload(platform);
        } catch (err) {
          warn("onload failed for " + plugin.id + ": " + (err && err.message ? err.message : err));
        }
      }
      fireDeferredStartup();
    },

    unregister: function (id) {
      var plugin = pluginById[id];
      if (!plugin) return;
      if (typeof plugin.onunload === "function") {
        try {
          plugin.onunload();
        } catch (err) {
          warn("onunload failed for " + id + ": " + (err && err.message ? err.message : err));
        }
      }
      delete pluginById[id];
      plugins = plugins.filter(function (p) { return p.id !== id; });
    },

    get: function (id) {
      return pluginById[id] || null;
    },

    list: function () {
      return plugins.slice();
    },
  };

  global.WebtoolsPlatform = platform;
})(typeof window !== "undefined" ? window : globalThis);
