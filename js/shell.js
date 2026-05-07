(function(global) {
  "use strict";
  
  var PREFIX = window.SHELL_PREFIX || "app";

  var SKIN_LABELS = {
    amd: "AMD Red",
    "amd-gold": "AMD Gold",
    "amd-teal": "AMD Teal",
    "glass-dark": "Glass Dark",
    "matte-dark": "Matte Dark",
    "minimal-monochrome": "Monochrome",
    "soft-neutral-light": "Soft Neutral"
  };

  /* ── Skin / Theme ── */
  function setSkin(skin) {
    if (!SKIN_LABELS[skin]) skin = "matte-dark";
    document.documentElement.setAttribute("data-skin", skin);
    document.body.setAttribute("data-skin", skin);
    var link = document.getElementById("skinStylesheet");
    if (link) link.href = "../shared/css/skins/" + skin + ".css";
    try { localStorage.setItem(PREFIX + "-skin", skin); } catch (_) { }
    document.querySelectorAll(".hero-skin-option").forEach(function (opt) {
      opt.classList.toggle("active", opt.getAttribute("data-skin") === skin);
    });
    document.querySelectorAll(".side-nav-skin-option").forEach(function (opt) {
      opt.classList.toggle("active", opt.getAttribute("data-skin") === skin);
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    try { localStorage.setItem(PREFIX + "-theme", theme); } catch (_) { }
    document.querySelectorAll("#themeToggleTop .material-symbols-outlined, #themeToggleSide .material-symbols-outlined").forEach(function (i) {
      i.textContent = theme === "dark" ? "dark_mode" : "light_mode";
    });
    var sideLabel = document.querySelector("#themeToggleSide .util-label");
    if (sideLabel) sideLabel.textContent = theme === "dark" ? "Dark" : "Light";
    var tTop = document.getElementById("themeToggleTop");
    if (tTop) tTop.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    var tSide = document.getElementById("themeToggleSide");
    if (tSide) tSide.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }

  function toggleTheme() {
    var current = document.body.getAttribute("data-theme") || "dark";
    setTheme(current === "dark" ? "light" : "dark");
  }

  var MODE_LABELS = { standard: "Standard", advanced: "Advanced", expert: "Expert" };

  function setUserMode(mode) {
    if (!MODE_LABELS[mode]) mode = "standard";
    document.body.setAttribute("data-user-mode", mode);
    try { localStorage.setItem(PREFIX + "-user-mode", mode); } catch (_) { }
    document.querySelectorAll(".hero-mode-option").forEach(function (opt) {
      opt.classList.toggle("active", opt.getAttribute("data-mode") === mode);
    });
    document.querySelectorAll(".side-nav-mode-option").forEach(function (opt) {
      opt.classList.toggle("active", opt.getAttribute("data-mode") === mode);
    });
    var sideLabel = document.getElementById("modeLabelSide");
    if (sideLabel) sideLabel.textContent = MODE_LABELS[mode];
    document.dispatchEvent(new CustomEvent("shell:modeChanged", { detail: { mode: mode } }));
  }

  /* ── Layout: top-bar vs side-bar ── */
  function setLayout(layout) {
    if (layout === "side") {
      document.body.classList.add("nav-side");
    } else {
      document.body.classList.remove("nav-side");
      document.body.classList.remove("nav-collapsed");
    }
    try { localStorage.setItem(PREFIX + "-nav-layout", layout); } catch (_) { }
    syncSideSkinList();
  }

  function setCollapsed(collapsed) {
    if (collapsed) {
      document.body.classList.add("nav-collapsed");
      var tCollapse = document.getElementById("collapseToggle");
      if (tCollapse) {
        tCollapse.title = "Expand sidebar";
        var icon = tCollapse.querySelector(".material-symbols-outlined");
        if (icon) icon.textContent = "left_panel_open";
      }
    } else {
      document.body.classList.remove("nav-collapsed");
      var tCollapse = document.getElementById("collapseToggle");
      if (tCollapse) {
        tCollapse.title = "Collapse sidebar";
        var icon = tCollapse.querySelector(".material-symbols-outlined");
        if (icon) icon.textContent = "left_panel_close";
      }
    }
    try { localStorage.setItem(PREFIX + "-nav-collapsed", collapsed ? "1" : "0"); } catch (_) { }
    syncSideSkinList();
  }

  /* ── Tab switching (shared between both nav modes) ── */
  function switchTab(tabId) {
    document.querySelectorAll(".hero-tabs .tab-btn, .sidebar-nav .nav-btn").forEach(function (t) {
      var isTarget = t.getAttribute("data-tab") === tabId;
      t.classList.toggle("active", isTarget);
      t.setAttribute("aria-selected", String(isTarget));
    });
    document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.add("hidden"); });
    var panel = document.getElementById("panel-" + tabId);
    if (panel) {
      panel.classList.remove("hidden");
      var frame = panel.querySelector("iframe[data-src]");
      if (frame) {
        frame.src = frame.getAttribute("data-src");
        frame.removeAttribute("data-src");
      }
    }
    document.dispatchEvent(new CustomEvent("shell:tabChanged", { detail: { tabId: tabId } }));
  }

  /* ── Skin menu helpers ── */
  function isSideExpanded() {
    return document.body.classList.contains("nav-side") && !document.body.classList.contains("nav-collapsed");
  }

  function toggleTopSkinMenu() {
    var menu = document.getElementById("skinMenuTop");
    if (!menu) return;
    menu.hidden = !menu.hidden;
    var btn = document.getElementById("skinMenuBtnTop");
    if (btn) btn.setAttribute("aria-expanded", String(!menu.hidden));
  }
  
  function closeTopSkinMenu() {
    var m = document.getElementById("skinMenuTop");
    if (m) m.hidden = true;
    var b = document.getElementById("skinMenuBtnTop");
    if (b) b.setAttribute("aria-expanded", "false");
  }
  
  function syncSideSkinList() {
    var list = document.getElementById("sideNavSkinList");
    var btn = document.getElementById("skinToggleSide");
    if (list && btn && !isSideExpanded()) {
      list.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    var modeList = document.getElementById("sideNavModeList");
    if (modeList && !isSideExpanded()) modeList.hidden = true;
  }

  function init() {
    /* ── Rehydrate from localStorage ── */
    var savedLayout = "side";
    var savedCollapsed = false;
    try { savedLayout = localStorage.getItem(PREFIX + "-nav-layout") || "side"; } catch (_) { }
    try { savedCollapsed = localStorage.getItem(PREFIX + "-nav-collapsed") === "1"; } catch (_) { }

    setLayout(savedLayout);
    setCollapsed(savedCollapsed);
    setSkin(localStorage.getItem(PREFIX + "-skin") || "matte-dark");
    setTheme(localStorage.getItem(PREFIX + "-theme") || "dark");
    setUserMode(localStorage.getItem(PREFIX + "-user-mode") || "standard");

    /* ── Event bindings ── */

    var tTop = document.getElementById("themeToggleTop");
    if (tTop) tTop.addEventListener("click", toggleTheme);
    var tSide = document.getElementById("themeToggleSide");
    if (tSide) tSide.addEventListener("click", toggleTheme);

    var lTop = document.getElementById("layoutToggleTop");
    if (lTop) lTop.addEventListener("click", function () { setLayout("side"); });
    var lSide = document.getElementById("layoutToggleSide");
    if (lSide) lSide.addEventListener("click", function () { setLayout("top"); });

    if (window.MobileDrawer && typeof window.MobileDrawer.install === "function") {
      window.MobileDrawer.install({
        menuBtn:    "navMobileMenuBtn",
        backdrop:   "navBackdrop",
        drawer:     "sideNavDrawer",
        closeOnTap: [".nav-btn", ".util-btn"],
        onOpen: function () {
          if (!document.body.classList.contains("nav-side")) {
            document.body.classList.add("nav-side", "nav-mobile-temp");
          }
        },
        onClose: function () {
          if (document.body.classList.contains("nav-mobile-temp")) {
            document.body.classList.remove("nav-side", "nav-mobile-temp");
          }
        }
      });
    }

    var cToggle = document.getElementById("collapseToggle");
    if (cToggle) cToggle.addEventListener("click", function () {
      setCollapsed(!document.body.classList.contains("nav-collapsed"));
    });

    var sTop = document.getElementById("skinMenuBtnTop");
    if (sTop) sTop.addEventListener("click", function () {
      toggleTopSkinMenu();
    });
    document.querySelectorAll(".hero-skin-option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        setSkin(this.getAttribute("data-skin"));
        closeTopSkinMenu();
      });
    });
    document.addEventListener("click", function (e) {
      var wrap = document.querySelector(".hero-toolbar .hero-skin-wrap");
      if (wrap && !wrap.contains(e.target)) closeTopSkinMenu();
    });

    var sSide = document.getElementById("skinToggleSide");
    if (sSide) sSide.addEventListener("click", function () {
      if (document.body.classList.contains("nav-collapsed")) {
        setCollapsed(false);
        var list = document.getElementById("sideNavSkinList");
        if (list) list.hidden = false;
        this.setAttribute("aria-expanded", "true");
        return;
      }
      var list = document.getElementById("sideNavSkinList");
      if (list) {
        list.hidden = !list.hidden;
        this.setAttribute("aria-expanded", String(!list.hidden));
      }
    });
    document.querySelectorAll(".side-nav-skin-option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        setSkin(this.getAttribute("data-skin"));
      });
    });

    document.querySelectorAll(".hero-mode-option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        setUserMode(this.getAttribute("data-mode"));
      });
    });

    var mSide = document.getElementById("modeToggleSide");
    if (mSide) mSide.addEventListener("click", function () {
      if (document.body.classList.contains("nav-collapsed")) {
        setCollapsed(false);
        var list = document.getElementById("sideNavModeList");
        if (list) list.hidden = false;
        return;
      }
      var list = document.getElementById("sideNavModeList");
      if (list) list.hidden = !list.hidden;
    });
    document.querySelectorAll(".side-nav-mode-option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        setUserMode(this.getAttribute("data-mode"));
      });
    });

    document.querySelectorAll(".hero-tabs .tab-btn").forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (!this.disabled) switchTab(this.getAttribute("data-tab"));
      });
    });

    document.querySelectorAll(".sidebar-nav .nav-btn").forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (!this.disabled) switchTab(this.getAttribute("data-tab"));
      });
    });

    var sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      sidebar.addEventListener("click", function (e) {
        if (e.target === this || e.target === document.querySelector(".sidebar-nav")) {
          setCollapsed(!document.body.classList.contains("nav-collapsed"));
        }
      });
    }
  }

  global.Shell = {
    setSkin: setSkin,
    setTheme: setTheme,
    setUserMode: setUserMode,
    setLayout: setLayout,
    setCollapsed: setCollapsed,
    switchTab: switchTab,
    init: init
  };

})(window);
