/*!
 * webtools-ui/js/settings.js
 *
 * Canonical workspace Settings window. Appearance uses a Shell adapter so
 * consumers can preserve existing storage keys; Agent fields delegate to
 * ChatOrb, which remains the only owner of LLM configuration persistence.
 */
(function (global) {
  "use strict";

  var SKINS = [
    ["amd-gold", "AMD Gold"],
    ["amd", "AMD Red"],
    ["amd-teal", "AMD Teal"],
    ["glass-dark", "Glass Dark"],
    ["matte-dark", "Matte Dark"],
    ["minimal-monochrome", "Monochrome"],
    ["soft-neutral-light", "Soft Neutral"]
  ];
  var state = {
    mounted: false,
    open: false,
    overlay: null,
    modal: null,
    activePane: "appearance",
    lastPane: "appearance",
    returnFocus: null,
    keyDirty: false,
    extraPanes: []
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function shellAdapter() {
    if (global.Shell && typeof global.Shell.getSettingsAdapter === "function") {
      return global.Shell.getSettingsAdapter();
    }
    return {
      defaults: { skin: "amd-gold", theme: "dark", userMode: "standard", navCollapsed: false },
      read: function (key) {
        if (key === "skin") return document.body.getAttribute("data-skin") || "amd-gold";
        if (key === "theme") return document.body.getAttribute("data-theme") || "dark";
        if (key === "user-mode") return document.body.getAttribute("data-user-mode") || "standard";
        if (key === "nav-collapsed") return document.body.classList.contains("nav-collapsed");
        return null;
      },
      apply: function () {},
      reset: function () {}
    };
  }

  function skinOptions() {
    return SKINS.map(function (skin) {
      return '<option value="' + esc(skin[0]) + '">' + esc(skin[1]) + "</option>";
    }).join("");
  }

  function row(key, title, description, control) {
    return '<div class="settings-row" data-setting-key="' + esc(key) + '">' +
      '<div class="settings-row-info"><h4>' + esc(title) + '</h4><p>' + esc(description) + '</p></div>' +
      '<div class="settings-row-control">' + control + '</div></div>';
  }

  function navButton(id, label, icon, section) {
    return '<button type="button" class="settings-nav-item" data-settings-pane="' + esc(id) +
      '" data-settings-section="' + esc(section) + '">' +
      '<span class="material-symbols-outlined" aria-hidden="true">' + esc(icon) + '</span>' +
      '<span>' + esc(label) + '</span></button>';
  }

  function extensionNavHtml() {
    if (!state.extraPanes.length) return "";
    return '<div class="settings-section-heading" data-settings-extension-heading>Extensions</div>' +
      state.extraPanes.map(function (pane) {
        return navButton(pane.id, pane.title, pane.icon || "extension", "extensions");
      }).join("");
  }

  function build() {
    var overlay = document.createElement("div");
    overlay.className = "settings-overlay";
    overlay.id = "settingsModal";
    overlay.setAttribute("data-component", "settings-modal");
    overlay.hidden = true;
    overlay.innerHTML =
      '<section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settingsWindowTitle">' +
      '<div class="settings-window-titlebar" id="settingsWindowTitlebar">' +
      '<h2 id="settingsWindowTitle">Settings</h2>' +
      '<div class="settings-window-controls">' +
      '<button type="button" class="settings-win-btn" data-settings-action="minimize" aria-label="Minimize settings"><span class="material-symbols-outlined" aria-hidden="true">remove</span></button>' +
      '<button type="button" class="settings-win-btn" data-settings-action="maximize" aria-label="Maximize settings"><span class="material-symbols-outlined" aria-hidden="true">crop_square</span></button>' +
      '<button type="button" class="settings-win-btn settings-win-btn--close" data-settings-action="close" aria-label="Close settings"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>' +
      '</div></div>' +
      '<div class="settings-window-body">' +
      '<aside class="settings-sidebar">' +
      '<label class="settings-search"><span class="material-symbols-outlined" aria-hidden="true">search</span>' +
      '<span class="sr-only">Search settings</span><input id="settingsSearchInput" type="search" placeholder="Search settings…" autocomplete="off" /></label>' +
      '<nav class="settings-nav" aria-label="Settings categories">' +
      '<div class="settings-section-heading">Shell</div>' +
      navButton("appearance", "Appearance", "palette", "shell") +
      navButton("user-mode", "User mode", "tune", "shell") +
      navButton("layout", "Layout", "view_sidebar", "shell") +
      '<div class="settings-section-heading">Tools</div>' +
      navButton("keyboard", "Hotkeys", "keyboard", "tools") +
      navButton("agent", "AI Agent", "auto_awesome", "tools") +
      extensionNavHtml() +
      '</nav></aside>' +
      '<main class="settings-content">' +
      '<section class="settings-pane" id="pane-appearance" data-pane="appearance">' +
      '<header class="settings-pane-header"><h3>Appearance</h3><p>Choose the visual theme and light or dark surfaces.</p></header>' +
      '<div class="settings-section-label">Theme</div>' +
      row("skin", "Theme", "Controls chrome, surfaces, and the accent color.",
        '<select class="settings-select" id="settingsSkin" aria-label="Theme">' + skinOptions() + '</select>') +
      row("theme", "Base color scheme", "Switch between dark and light appearance.",
        '<select class="settings-select" id="settingsTheme" aria-label="Base color scheme"><option value="dark">Dark</option><option value="light">Light</option></select>') +
      '<div class="settings-section-label">Defaults</div>' +
      row("shell-reset", "Reset shell settings", "Restore this product’s theme, appearance, mode, and layout defaults.",
        '<button type="button" class="settings-action-btn settings-action-btn--danger" id="settingsResetShell">Reset</button>') +
      '</section>' +
      '<section class="settings-pane" id="pane-user-mode" data-pane="user-mode">' +
      '<header class="settings-pane-header"><h3>User mode</h3><p>Control how much advanced product functionality is visible.</p></header>' +
      row("user-mode", "User mode", "Standard hides advanced and expert controls; Expert shows all supported controls.",
        '<select class="settings-select" id="settingsUserMode" aria-label="User mode"><option value="standard">Standard</option><option value="advanced">Advanced</option><option value="expert">Expert</option></select>') +
      '</section>' +
      '<section class="settings-pane" id="pane-layout" data-pane="layout">' +
      '<header class="settings-pane-header"><h3>Layout</h3><p>Configure the product navigation rail.</p></header>' +
      row("nav-collapsed", "Collapse navigation", "Use the icon-only product navigation rail.",
        '<label class="settings-switch"><input type="checkbox" id="settingsNavCollapsed" /><span aria-hidden="true"></span><span class="sr-only">Collapse navigation</span></label>') +
      '</section>' +
      '<section class="settings-pane" id="pane-keyboard" data-pane="keyboard">' +
      '<header class="settings-pane-header"><h3>Hotkeys</h3><p>Keyboard shortcuts registered by this product and the shared shell.</p></header>' +
      '<div id="settingsHotkeys" class="settings-hotkeys"></div>' +
      '<div class="settings-pane-actions"><button type="button" class="settings-action-btn" id="settingsOpenShortcuts">Open shortcut sheet</button></div>' +
      '</section>' +
      '<section class="settings-pane" id="pane-agent" data-pane="agent">' +
      '<header class="settings-pane-header"><h3>AI Agent</h3><p>Configure the OpenAI-compatible endpoint used by this product’s chat agent.</p></header>' +
      '<div class="settings-section-label">Connection</div>' +
      row("agent-host", "Host", "Hostname and optional port, for example 10.0.0.5:11434.",
        '<input class="settings-text-input" id="settingsAgentHost" type="text" autocomplete="off" />') +
      row("agent-model", "Model", "Model identifier exposed by the configured host.",
        '<input class="settings-text-input" id="settingsAgentModel" type="text" autocomplete="off" />') +
      row("agent-path", "API Path", "OpenAI-compatible chat completions path.",
        '<input class="settings-text-input" id="settingsAgentPath" type="text" placeholder="/v1/chat/completions" autocomplete="off" />') +
      row("agent-key", "API Key", "Optional bearer token. Saved locally for this product only.",
        '<div class="settings-key-control"><input class="settings-text-input" id="settingsAgentKey" type="password" autocomplete="off" /><button type="button" class="settings-action-btn" id="settingsClearAgentKey">Clear</button></div>') +
      '<div class="settings-section-label">Behavior</div>' +
      row("agent-mode", "Mode", "Fallback tries local rules first; Primary asks the model first.",
        '<select class="settings-select" id="settingsAgentMode" aria-label="Agent mode"><option value="fallback">Fallback (rules first)</option><option value="primary">Primary (LLM first)</option></select>') +
      row("agent-enabled", "Enable LLM agent", "Allow free-text prompts to use the configured endpoint.",
        '<label class="settings-switch"><input type="checkbox" id="settingsAgentEnabled" /><span aria-hidden="true"></span><span class="sr-only">Enable LLM agent</span></label>') +
      row("agent-orb", "Show floating agent orb", "Display the collapsed AI Agent launcher at the bottom right. When disabled, open the agent from the left sidebar.",
        '<label class="settings-switch"><input type="checkbox" id="settingsAgentOrbVisible" /><span aria-hidden="true"></span><span class="sr-only">Show floating agent orb</span></label>') +
      '<div class="settings-agent-meta"><span id="settingsAgentGatewayStatus"></span><span id="settingsAgentStorage"></span></div>' +
      '<div class="settings-pane-actions"><button type="button" class="settings-action-btn" id="settingsOpenAgent">Open agent chat</button><button type="button" class="settings-action-btn settings-action-btn--danger" id="settingsResetAgent">Reset agent defaults</button></div>' +
      '</section>' +
      '<div id="settingsExtensionPanes"></div>' +
      '<p class="settings-no-results" id="settingsNoResults" hidden>No settings match this search.</p>' +
      '</main></div>' +
      '<span class="settings-resize settings-resize--n" data-resize="n"></span>' +
      '<span class="settings-resize settings-resize--e" data-resize="e"></span>' +
      '<span class="settings-resize settings-resize--s" data-resize="s"></span>' +
      '<span class="settings-resize settings-resize--w" data-resize="w"></span>' +
      '<span class="settings-resize settings-resize--nw" data-resize="nw"></span>' +
      '<span class="settings-resize settings-resize--ne" data-resize="ne"></span>' +
      '<span class="settings-resize settings-resize--sw" data-resize="sw"></span>' +
      '<span class="settings-resize settings-resize--se" data-resize="se"></span>' +
      '</section>';
    document.body.appendChild(overlay);
    state.overlay = overlay;
    state.modal = overlay.querySelector(".settings-modal");
    renderExtensionPanes();
    wire();
    return overlay;
  }

  function renderExtensionPanes() {
    var host = state.overlay && state.overlay.querySelector("#settingsExtensionPanes");
    if (!host) return;
    host.innerHTML = "";
    state.extraPanes.forEach(function (pane) {
      var section = document.createElement("section");
      section.className = "settings-pane";
      section.id = "pane-" + pane.id;
      section.setAttribute("data-pane", pane.id);
      section.innerHTML = '<header class="settings-pane-header"><h3>' + esc(pane.title) +
        '</h3><p>' + esc(pane.description || "") + '</p></header>';
      host.appendChild(section);
      try { pane.render(section); } catch (err) {
        var p = document.createElement("p");
        p.className = "settings-inline-error";
        p.textContent = "Could not load these settings: " + (err && err.message ? err.message : err);
        section.appendChild(p);
      }
    });
  }

  function readSetting(key, fallback) {
    try {
      var value = shellAdapter().read(key);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function applySetting(key, value) {
    try { shellAdapter().apply(key, value); } catch (err) {
      if (global.console && console.warn) console.warn("[Settings] apply failed:", err);
    }
  }

  function hydrateShell() {
    var skin = state.overlay.querySelector("#settingsSkin");
    var theme = state.overlay.querySelector("#settingsTheme");
    var mode = state.overlay.querySelector("#settingsUserMode");
    var collapsed = state.overlay.querySelector("#settingsNavCollapsed");
    if (skin) skin.value = readSetting("skin", "amd-gold");
    if (theme) theme.value = readSetting("theme", "dark");
    if (mode) mode.value = readSetting("user-mode", "standard");
    if (collapsed) collapsed.checked = !!readSetting("nav-collapsed", false);
  }

  function hydrateAgent() {
    var form = global.ChatOrb && typeof global.ChatOrb.getLLMForm === "function"
      ? global.ChatOrb.getLLMForm()
      : (global.ChatOrb && typeof global.ChatOrb.getLLM === "function" ? global.ChatOrb.getLLM() : null);
    var pane = state.overlay.querySelector("#pane-agent");
    if (!form) {
      pane.classList.add("is-unavailable");
      return;
    }
    pane.classList.remove("is-unavailable");
    state.overlay.querySelector("#settingsAgentHost").value = form.host || "";
    state.overlay.querySelector("#settingsAgentModel").value = form.model || "";
    state.overlay.querySelector("#settingsAgentPath").value = form.path || "/v1/chat/completions";
    state.overlay.querySelector("#settingsAgentMode").value = form.mode === "primary" ? "primary" : "fallback";
    state.overlay.querySelector("#settingsAgentEnabled").checked = !!form.enabled;
    state.overlay.querySelector("#settingsAgentOrbVisible").checked =
      !!(global.ChatOrb && typeof global.ChatOrb.isOrbVisible === "function" && global.ChatOrb.isOrbVisible());
    var key = state.overlay.querySelector("#settingsAgentKey");
    key.value = "";
    key.placeholder = form.keyConfigured || form.key ? "Saved — enter a new key to replace" : "Optional bearer token";
    state.keyDirty = false;
    var prefix = global.ChatOrb.getStoragePrefix ? global.ChatOrb.getStoragePrefix() : "";
    state.overlay.querySelector("#settingsAgentStorage").textContent =
      "Storage: " + (prefix ? prefix + ":chat-orb:llm:v1" : "shared-ui:chat-orb:llm:v1");
    var enabled = global.AgentGateway && typeof global.AgentGateway.isEnabled === "function"
      ? global.AgentGateway.isEnabled() : false;
    state.overlay.querySelector("#settingsAgentGatewayStatus").textContent =
      "Agent Gateway: " + (enabled ? "enabled" : "not enabled");
  }

  function saveAgent(key, value) {
    if (!global.ChatOrb || typeof global.ChatOrb.setLLM !== "function") return;
    var patch = {};
    patch[key] = value;
    global.ChatOrb.setLLM(patch);
  }

  function renderHotkeys() {
    var host = state.overlay.querySelector("#settingsHotkeys");
    host.innerHTML = "";
    var groups = global.Shortcuts && typeof global.Shortcuts.list === "function"
      ? global.Shortcuts.list() : [];
    groups.forEach(function (entry) {
      var title = document.createElement("div");
      title.className = "settings-hotkey-group";
      title.textContent = entry.group;
      host.appendChild(title);
      entry.rows.forEach(function (item) {
        var line = document.createElement("div");
        line.className = "settings-hotkey-row";
        var label = document.createElement("span");
        label.textContent = item.label;
        var keys = document.createElement("kbd");
        keys.textContent = Array.isArray(item.keys) ? item.keys.join(" + ") : item.keys;
        line.appendChild(label);
        line.appendChild(keys);
        host.appendChild(line);
      });
    });
    if (!groups.length) host.textContent = "No shortcuts are registered yet.";
  }

  function selectPane(id, remember) {
    var target = state.overlay.querySelector('[data-pane="' + id + '"]');
    if (!target) id = "appearance";
    state.activePane = id;
    if (remember !== false) state.lastPane = id;
    state.overlay.querySelectorAll(".settings-pane").forEach(function (pane) {
      pane.classList.toggle("active", pane.getAttribute("data-pane") === id);
    });
    state.overlay.querySelectorAll(".settings-nav-item").forEach(function (button) {
      var active = button.getAttribute("data-settings-pane") === id;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    if (id === "agent") hydrateAgent();
    if (id === "keyboard") renderHotkeys();
  }

  function filter(query) {
    var q = String(query || "").toLowerCase().trim();
    var any = false;
    var firstPane = "";
    state.overlay.querySelectorAll(".settings-section-heading").forEach(function (heading) {
      heading.hidden = !!q;
    });
    state.overlay.querySelectorAll(".settings-pane").forEach(function (pane) {
      var paneId = pane.getAttribute("data-pane");
      var navButton = state.overlay.querySelector('[data-settings-section="' + paneId + '"]');
      var paneMatches = !!(q && navButton && navButton.textContent.toLowerCase().indexOf(q) >= 0);
      pane.querySelectorAll(".settings-row").forEach(function (settingRow) {
        settingRow.hidden = !!q && !paneMatches && settingRow.textContent.toLowerCase().indexOf(q) < 0;
      });
    });
    state.overlay.querySelectorAll(".settings-nav-item").forEach(function (button) {
      var paneId = button.getAttribute("data-settings-pane");
      var pane = state.overlay.querySelector('[data-pane="' + paneId + '"]');
      var paneText = pane ? pane.textContent.toLowerCase() : "";
      var matches = !q || button.textContent.toLowerCase().indexOf(q) >= 0 || paneText.indexOf(q) >= 0;
      button.hidden = !matches;
      if (matches) {
        any = true;
        if (!firstPane) firstPane = paneId;
      }
    });
    state.overlay.querySelector("#settingsNoResults").hidden = any;
    if (q && firstPane) selectPane(firstPane, false);
    else if (!q) selectPane(state.lastPane, false);
  }

  function focusables() {
    return [].slice.call(state.modal.querySelectorAll(
      "button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), [tabindex]:not([tabindex='-1'])"
    )).filter(function (el) { return !el.closest("[hidden]") && el.offsetParent !== null; });
  }

  function onModalKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    var items = focusables();
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  function startPointerGeometry(event, direction) {
    if (state.modal.classList.contains("maximized")) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    var rect = state.modal.getBoundingClientRect();
    var startX = event.clientX, startY = event.clientY;
    var moving = direction === "move";
    state.modal.classList.add(moving ? "dragging" : "resizing");

    function move(ev) {
      ev.preventDefault();
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      var left = rect.left, top = rect.top, width = rect.width, height = rect.height;
      if (moving) {
        left = Math.max(-(width - 80), Math.min(global.innerWidth - 80, left + dx));
        top = Math.max(0, Math.min(global.innerHeight - 40, top + dy));
      } else {
        if (direction.indexOf("e") >= 0) width = rect.width + dx;
        if (direction.indexOf("s") >= 0) height = rect.height + dy;
        if (direction.indexOf("w") >= 0) { width = rect.width - dx; left = rect.left + dx; }
        if (direction.indexOf("n") >= 0) { height = rect.height - dy; top = rect.top + dy; }
        var maxW = global.innerWidth - 20, maxH = global.innerHeight - 20;
        var nextW = Math.max(480, Math.min(maxW, width));
        var nextH = Math.max(360, Math.min(maxH, height));
        if (direction.indexOf("w") >= 0) left += width - nextW;
        if (direction.indexOf("n") >= 0) top += height - nextH;
        width = nextW; height = nextH;
      }
      state.modal.style.position = "fixed";
      state.modal.style.margin = "0";
      state.modal.style.left = left + "px";
      state.modal.style.top = top + "px";
      if (!moving) {
        state.modal.style.width = width + "px";
        state.modal.style.height = height + "px";
      }
    }
    function stop() {
      state.modal.classList.remove("dragging", "resizing");
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", stop);
    }
    document.addEventListener("pointermove", move, { passive: false });
    document.addEventListener("pointerup", stop);
    document.addEventListener("pointercancel", stop);
  }

  function toggleMaximize() {
    var icon = state.overlay.querySelector('[data-settings-action="maximize"] .material-symbols-outlined');
    if (!state.modal.classList.contains("maximized")) {
      state.modal._preMaxPosition = {
        left: state.modal.style.left, top: state.modal.style.top,
        width: state.modal.style.width, height: state.modal.style.height,
        position: state.modal.style.position
      };
      state.modal.classList.add("maximized");
      state.modal.removeAttribute("style");
      if (icon) icon.textContent = "filter_none";
    } else {
      state.modal.classList.remove("maximized");
      var previous = state.modal._preMaxPosition || {};
      Object.keys(previous).forEach(function (key) { state.modal.style[key] = previous[key] || ""; });
      if (icon) icon.textContent = "crop_square";
    }
  }

  function wire() {
    state.overlay.addEventListener("click", function (event) {
      if (event.target === state.overlay) close();
      var nav = event.target.closest && event.target.closest(".settings-nav-item");
      if (nav) selectPane(nav.getAttribute("data-settings-pane"));
      var action = event.target.closest && event.target.closest("[data-settings-action]");
      if (action) {
        var name = action.getAttribute("data-settings-action");
        if (name === "maximize") toggleMaximize();
        else close();
      }
    });
    state.overlay.addEventListener("keydown", onModalKeydown);
    state.overlay.querySelector("#settingsSearchInput").addEventListener("input", function () { filter(this.value); });
    state.overlay.querySelector("#settingsSkin").addEventListener("change", function () { applySetting("skin", this.value); });
    state.overlay.querySelector("#settingsTheme").addEventListener("change", function () { applySetting("theme", this.value); });
    state.overlay.querySelector("#settingsUserMode").addEventListener("change", function () { applySetting("user-mode", this.value); });
    state.overlay.querySelector("#settingsNavCollapsed").addEventListener("change", function () { applySetting("nav-collapsed", this.checked); });
    state.overlay.querySelector("#settingsResetShell").addEventListener("click", function () {
      try { shellAdapter().reset(); } catch (_) {}
      hydrateShell();
    });
    [["Host", "host"], ["Model", "model"], ["Path", "path"]].forEach(function (entry) {
      state.overlay.querySelector("#settingsAgent" + entry[0]).addEventListener("blur", function () {
        saveAgent(entry[1], this.value);
      });
    });
    var key = state.overlay.querySelector("#settingsAgentKey");
    key.addEventListener("input", function () { state.keyDirty = true; });
    key.addEventListener("blur", function () {
      if (!state.keyDirty) return;
      saveAgent("key", this.value);
      hydrateAgent();
    });
    state.overlay.querySelector("#settingsClearAgentKey").addEventListener("click", function () {
      saveAgent("key", "");
      hydrateAgent();
    });
    state.overlay.querySelector("#settingsAgentMode").addEventListener("change", function () { saveAgent("mode", this.value); });
    state.overlay.querySelector("#settingsAgentEnabled").addEventListener("change", function () { saveAgent("enabled", this.checked); });
    state.overlay.querySelector("#settingsAgentOrbVisible").addEventListener("change", function () {
      if (global.ChatOrb && typeof global.ChatOrb.setOrbVisible === "function") {
        global.ChatOrb.setOrbVisible(this.checked);
      }
    });
    state.overlay.querySelector("#settingsResetAgent").addEventListener("click", function () {
      if (global.ChatOrb && typeof global.ChatOrb.resetLLM === "function") global.ChatOrb.resetLLM();
      if (global.ChatOrb && typeof global.ChatOrb.setOrbVisible === "function") global.ChatOrb.setOrbVisible(false);
      hydrateAgent();
    });
    state.overlay.querySelector("#settingsOpenAgent").addEventListener("click", function () {
      close();
      if (global.ChatOrb && typeof global.ChatOrb.open === "function") global.ChatOrb.open();
    });
    state.overlay.querySelector("#settingsOpenShortcuts").addEventListener("click", function () {
      if (global.Shortcuts && typeof global.Shortcuts.open === "function") global.Shortcuts.open();
    });
    state.overlay.querySelector("#settingsWindowTitlebar").addEventListener("pointerdown", function (event) {
      if (event.target.closest && event.target.closest("button")) return;
      startPointerGeometry(event, "move");
    });
    state.overlay.querySelectorAll("[data-resize]").forEach(function (handle) {
      handle.addEventListener("pointerdown", function (event) {
        startPointerGeometry(event, handle.getAttribute("data-resize"));
      });
    });
    document.addEventListener("chat-orb:llmChanged", function () {
      if (state.open && state.activePane === "agent") hydrateAgent();
    });
    document.addEventListener("chat-orb:launcherChanged", function () {
      if (state.open && state.activePane === "agent") hydrateAgent();
    });
  }

  function mount() {
    if (state.mounted) return state.overlay;
    build();
    state.mounted = true;
    if (global.Shortcuts && typeof global.Shortcuts.register === "function") {
      global.Shortcuts.register("General", "Ctrl+,", "Open settings");
    }
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest && event.target.closest("[data-open-settings], #settingsToggleSide");
      if (!trigger) return;
      event.preventDefault();
      open({ pane: trigger.getAttribute("data-settings-pane") || undefined, returnFocus: trigger });
    });
    document.addEventListener("keydown", function (event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key !== ",") return;
      event.preventDefault();
      open({ returnFocus: document.activeElement });
    });
    return state.overlay;
  }

  function open(opts) {
    opts = opts || {};
    mount();
    state.returnFocus = opts.returnFocus || document.activeElement;
    state.overlay.hidden = false;
    state.overlay.classList.add("active");
    state.open = true;
    hydrateShell();
    selectPane(opts.pane || state.lastPane || "appearance");
    renderHotkeys();
    var search = state.overlay.querySelector("#settingsSearchInput");
    search.value = "";
    filter("");
    global.setTimeout(function () { search.focus(); }, 0);
  }

  function close() {
    if (!state.open) return;
    state.overlay.classList.remove("active");
    state.overlay.hidden = true;
    state.open = false;
    var target = state.returnFocus;
    state.returnFocus = null;
    if (target && typeof target.focus === "function") target.focus();
  }

  function registerPane(definition) {
    if (!definition || !definition.id || !definition.title || typeof definition.render !== "function") return false;
    var exists = state.extraPanes.some(function (pane) { return pane.id === definition.id; });
    if (exists) return false;
    state.extraPanes.push(definition);
    if (state.mounted) {
      var nav = state.overlay.querySelector(".settings-nav");
      nav.querySelectorAll('[data-settings-section="extensions"], [data-settings-extension-heading]').forEach(function (item) {
        if (item.parentNode) item.parentNode.removeChild(item);
      });
      nav.insertAdjacentHTML("beforeend", extensionNavHtml());
      renderExtensionPanes();
    }
    return true;
  }

  global.WebtoolsSettings = {
    mount: mount,
    open: open,
    close: close,
    registerPane: registerPane,
    selectPane: selectPane,
    isOpen: function () { return state.open; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})(typeof window !== "undefined" ? window : globalThis);
