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

  function warn(msg) {
    if (global.console && global.console.warn) {
      global.console.warn("[WebtoolsPlatform] " + msg);
    }
  }

  function getShell() {
    return global.Shell || null;
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

  var platform = {
    version: "0.9.0",

    /** Canonical module facades (read-only references). */
    shell: getShell(),
    chrome: getChrome(),
    commands: getCommands(),
    chat: getChat(),
    demo: getDemo(),
    voice: getVoice(),
    mobile: getMobile(),
    errors: getErrors(),

    /** Refresh facade references after late-loaded scripts. */
    refresh: function () {
      platform.shell = getShell();
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
      if (typeof plugin.onload === "function") {
        try {
          plugin.onload(platform);
        } catch (err) {
          warn("onload failed for " + plugin.id + ": " + (err && err.message ? err.message : err));
        }
      }
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
