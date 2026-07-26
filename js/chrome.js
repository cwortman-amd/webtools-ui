/*!
 * webtools-ui canonical asset: chrome.js
 *
 * Configurable top-bar tools for sibling web tools. Provides shared skin/mode
 * switching, info/help link, and an optional browser-local secret/profile panel.
 */
(function () {
  "use strict";

  var DEFAULT_SKINS = [
    { id: "amd-gold", label: "AMD Gold" },
    { id: "amd", label: "AMD Red" },
    { id: "amd-teal", label: "AMD Teal" },
    { id: "matte-dark", label: "Matte Dark" }
  ];

  function lsGet(k, fb) { try { return localStorage.getItem(k) || fb; } catch (e) { return fb; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function init(options) {
    var cfg = options || {};
    var namespace = cfg.namespace || "webtools";
    var skinKey = cfg.skinKey || (namespace + ":skin");
    var modeKey = cfg.modeKey || (namespace + ":mode");
    var secret = cfg.secret || {};
    var secretKey = secret.storageKey || (namespace + ":secret");
    var skins = cfg.skins || DEFAULT_SKINS;
    var defaultSkin = cfg.defaultSkin || (skins[0] && skins[0].id) || "amd-gold";
    var defaultMode = cfg.defaultMode || "dark";
    var skinIds = skins.map(function (s) { return s.id; });
    var host = document.getElementById(cfg.hostId || "topbar-tools-slot");

    function currentSkin() { return lsGet(skinKey, defaultSkin); }
    function currentMode() { return lsGet(modeKey, defaultMode); }
    function getSecret() { return lsGet(secretKey, ""); }
    function hasSecret() { return !!getSecret(); }

    function applySkin(skin) {
      if (skinIds.indexOf(skin) === -1) skin = defaultSkin;
      document.documentElement.setAttribute("data-skin", skin);
      if (document.body) document.body.setAttribute("data-skin", skin);
      var link = document.getElementById(cfg.skinStylesheetId || "skinStylesheet");
      var prefix = cfg.skinPathPrefix || "../shared/css/skins/";
      if (link) link.setAttribute("href", prefix + skin + ".css");
      lsSet(skinKey, skin);
    }

    function applyMode(mode) {
      if (mode !== "light") mode = "dark";
      document.documentElement.setAttribute("data-theme", mode);
      if (document.body) document.body.setAttribute("data-theme", mode);
      lsSet(modeKey, mode);
    }

    function markup() {
      var skinRows = skins.map(function (s) {
        return '<button type="button" class="tool-opt" role="menuitemradio" data-skin-pick="' +
          esc(s.id) + '"><span class="tool-opt__dot" data-skin="' + esc(s.id) +
          '"></span><span class="tool-opt__label">' + esc(s.label) +
          '</span><span class="material-symbols-outlined tool-opt__check" aria-hidden="true">check</span></button>';
      }).join("");

      var infoHref = cfg.infoHref || "";
      var info = infoHref ? (
        '  <div class="tool-wrap" data-tool="info">' +
        '    <a class="tool-btn" id="info-btn" href="' + esc(infoHref) + '" aria-label="' + esc(cfg.infoLabel || "Info and help") + '" title="' + esc(cfg.infoTitle || "Info") + '">' +
        '      <span class="material-symbols-outlined" aria-hidden="true">' + esc(cfg.infoIcon || "info") + '</span>' +
        '    </a>' +
        '  </div>'
      ) : "";

      var profile = secret.enabled === false ? "" : (
        '  <div class="tool-wrap" data-tool="profile">' +
        '    <button type="button" class="tool-btn" id="profile-btn" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(secret.buttonLabel || "Profile") + '" title="' + esc(secret.buttonTitle || "Profile") + '">' +
        '      <span class="material-symbols-outlined" aria-hidden="true">' + esc(secret.buttonIcon || "account_circle") + '</span>' +
        '      <span class="tool-btn__dot" id="profile-dot" hidden></span>' +
        '    </button>' +
        '    <div class="tool-pop tool-pop--wide" id="profile-pop" role="dialog" aria-label="' + esc(secret.title || "Profile secret") + '" hidden>' +
        '      <p class="tool-pop__title">' + esc(secret.title || "Token") + '</p>' +
        '      <p class="tool-pop__hint">' + (secret.hintHtml || esc(secret.hint || "Stored only in this browser.")) + '</p>' +
        '      <div class="tool-field">' +
        '        <input type="password" id="secret-input" class="tool-input" placeholder="' + esc(secret.placeholder || "") + '" autocomplete="off" spellcheck="false" />' +
        '        <button type="button" class="tool-eye" id="secret-eye" aria-label="Show value"><span class="material-symbols-outlined" aria-hidden="true">visibility</span></button>' +
        '      </div>' +
        '      <p class="tool-status" id="secret-status" aria-live="polite"></p>' +
        '      <div class="tool-actions">' +
        '        <button type="button" class="tool-act" id="secret-save">' + esc(secret.saveLabel || "Save") + '</button>' +
        '        <button type="button" class="tool-act tool-act--ghost" id="secret-clear">' + esc(secret.clearLabel || "Clear") + '</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>'
      );

      return '' +
        '<div class="topbar-tools" id="topbar-tools">' +
        info +
        '  <div class="tool-wrap" data-tool="settings">' +
        '    <button type="button" class="tool-btn" id="settings-btn" aria-haspopup="true" aria-expanded="false" aria-label="' + esc(cfg.settingsLabel || "Appearance settings") + '" title="' + esc(cfg.settingsTitle || "Appearance") + '">' +
        '      <span class="material-symbols-outlined" aria-hidden="true">settings</span>' +
        '    </button>' +
        '    <div class="tool-pop" id="settings-pop" role="menu" aria-label="Appearance" hidden>' +
        '      <p class="tool-pop__title">Skin</p>' +
        '      <div class="tool-pop__group" id="skin-options">' + skinRows + '</div>' +
        '      <p class="tool-pop__title">Mode</p>' +
        '      <div class="tool-seg" id="mode-toggle" role="group" aria-label="Color mode">' +
        '        <button type="button" class="tool-seg__btn" data-mode="dark"><span class="material-symbols-outlined" aria-hidden="true">dark_mode</span>Dark</button>' +
        '        <button type="button" class="tool-seg__btn" data-mode="light"><span class="material-symbols-outlined" aria-hidden="true">light_mode</span>Light</button>' +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        profile +
        '</div>';
    }

    function closeAllPops(except) {
      ["settings", "profile"].forEach(function (name) {
        var pop = document.getElementById(name + "-pop");
        var btn = document.getElementById(name + "-btn");
        if (!pop || pop === except) return;
        pop.hidden = true;
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
    }

    function togglePop(name) {
      var pop = document.getElementById(name + "-pop");
      var btn = document.getElementById(name + "-btn");
      if (!pop || !btn) return;
      var willOpen = pop.hidden;
      closeAllPops(willOpen ? pop : null);
      pop.hidden = !willOpen;
      btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
    }

    function syncSkinUI() {
      var skin = currentSkin();
      document.querySelectorAll("[data-skin-pick]").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-skin-pick") === skin);
      });
    }

    function syncModeUI() {
      var mode = currentMode();
      document.querySelectorAll("#mode-toggle .tool-seg__btn").forEach(function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-mode") === mode);
      });
    }

    function syncSecretUI() {
      var dot = document.getElementById("profile-dot");
      var status = document.getElementById("secret-status");
      var input = document.getElementById("secret-input");
      var has = hasSecret();
      if (dot) dot.hidden = !has;
      if (status) status.textContent = has ? (secret.savedText || "Saved on this device.") : (secret.emptyText || "No value saved.");
      if (input && has && !input.value) input.value = getSecret();
    }

    function wire() {
      var settingsBtn = document.getElementById("settings-btn");
      var profileBtn = document.getElementById("profile-btn");
      if (settingsBtn) settingsBtn.addEventListener("click", function (e) { e.stopPropagation(); togglePop("settings"); });
      if (profileBtn) profileBtn.addEventListener("click", function (e) { e.stopPropagation(); togglePop("profile"); syncSecretUI(); });

      document.querySelectorAll("[data-skin-pick]").forEach(function (b) {
        b.addEventListener("click", function () { applySkin(b.getAttribute("data-skin-pick")); syncSkinUI(); });
      });
      document.querySelectorAll("#mode-toggle .tool-seg__btn").forEach(function (b) {
        b.addEventListener("click", function () { applyMode(b.getAttribute("data-mode")); syncModeUI(); });
      });

      var input = document.getElementById("secret-input");
      var eye = document.getElementById("secret-eye");
      var save = document.getElementById("secret-save");
      var clear = document.getElementById("secret-clear");
      if (eye && input) eye.addEventListener("click", function () {
        var show = input.type === "password";
        input.type = show ? "text" : "password";
        eye.querySelector(".material-symbols-outlined").textContent = show ? "visibility_off" : "visibility";
      });
      if (save && input) save.addEventListener("click", function () {
        var v = input.value.trim();
        if (v) { lsSet(secretKey, v); } else { lsDel(secretKey); }
        syncSecretUI();
        var status = document.getElementById("secret-status");
        if (status && v) status.textContent = secret.savedText || "Saved on this device.";
      });
      if (clear && input) clear.addEventListener("click", function () {
        lsDel(secretKey); input.value = ""; input.type = "password";
        var icon = eye && eye.querySelector(".material-symbols-outlined");
        if (icon) icon.textContent = "visibility";
        syncSecretUI();
      });

      document.addEventListener("click", function (e) {
        if (!e.target.closest || !e.target.closest(".tool-wrap")) closeAllPops(null);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeAllPops(null);
      });
    }

    applySkin(currentSkin());
    applyMode(currentMode());
    if (host) {
      host.innerHTML = markup();
      syncSkinUI();
      syncModeUI();
      syncSecretUI();
      wire();
    }

    return {
      applySkin: applySkin,
      applyMode: applyMode,
      currentSkin: currentSkin,
      currentMode: currentMode,
      getSecret: getSecret,
      hasSecret: hasSecret
    };
  }

  window.WebtoolsChrome = window.WebtoolsChrome || {};
  window.WebtoolsChrome.init = init;
})();
