/* webtools-ui/js/suite.js — tab trio banner carousel + 1:1 tool cards */
(function (global) {
  "use strict";

  var REGISTRY_URL = "../plugins.registry.json";
  var INSTALL_TOOLS_BASE = "https://curt.wortman.ai/tools";
  var INSTALL_ARCHIVES_BASE = "https://curt.wortman.ai/archives";

  var installModal = null;

  var APP_META = {
    "cluster-manager": {
      tagline: "Monitor cluster health, GPU utilization, and job status in real time.",
      favicon: "../assets/suite/favicons/cluster-manager.svg",
      tabs: ["install", "network", "test"],
    },
    "dc-planner": {
      tagline: "Plan GPU data centers — workload sizing, BOM, rack layout, power, and TCO.",
      favicon: "../assets/suite/favicons/dc-planner.svg",
      tabs: ["workload", "gpu", "tco"],
    },
    "llm-benchmark": {
      tagline: "Run LLM inference benchmarks and compare GPU performance across models.",
      favicon: "../assets/suite/favicons/llm-benchmark.svg",
      tabs: ["plan", "queue", "view"],
    },
    "knowledge-exchange": {
      tagline: "Enable field teams with learning paths, modules, and measurable progress.",
      favicon: "../assets/suite/favicons/knowledge-exchange.svg",
      tabs: ["paths", "catalog", "resources"],
    },
    "demo-portal": {
      tagline: "Browse GPU demos and launch any dashboard tool from one catalog.",
      favicon: "../assets/suite/favicons/demo-portal.svg",
      tabs: ["catalog", "tools", "info"],
    },
    "slide-presenter": {
      tagline: "Deliver executive briefings with live slides, speaker notes, and export.",
      favicon: "../assets/suite/favicons/slide-presenter.svg",
      tabs: ["present", "notes", "export"],
    },
  };

  var SHOWCASE_ORDER = [
    "dc-planner",
    "cluster-manager",
    "llm-benchmark",
    "demo-portal",
    "slide-presenter",
    "knowledge-exchange",
  ];

  var state = { index: 0, plugins: [] };
  var autoplayTimer = null;
  var AUTOPLAY_MS = 10000;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function byId(id) { return document.getElementById(id); }

  function metaFor(plugin) {
    return APP_META[plugin.id] || {};
  }

  function tabsFor(plugin) {
    var tabs = metaFor(plugin).tabs;
    return tabs && tabs.length ? tabs : ["main"];
  }

  function appHref(plugin) {
    var local = plugin.localUrl || "";
    if (local === "./index.html") return "../demo-portal/pages/index.html";
    return local;
  }

  function pitchHref(plugin) {
    var local = plugin.localUrl || "";
    if (local === "./index.html") return "../demo-portal/pages/pitch.html";
    return local.replace(/index\.html(\?.*)?$/, "pitch.html");
  }

  function tabScreenshotSrc(plugin, tab) {
    return "../assets/suite/screenshots/" + plugin.id + "-" + tab + ".png";
  }

  function legacyScreenshotSrc(plugin) {
    return "../assets/suite/screenshots/" + plugin.id + ".png";
  }

  function fallbackArtSrc(plugin) {
    return "../assets/suite/" + plugin.id + ".svg";
  }

  function faviconSrc(plugin) {
    var meta = metaFor(plugin);
    return meta.favicon || "../assets/suite/favicons/" + plugin.id + ".svg";
  }

  function isLocalHost() {
    var host = global.location && global.location.hostname;
    return !host || host === "127.0.0.1" || host === "localhost";
  }

  function installScriptName(plugin) {
    var install = plugin.install || {};
    return install.script || ("install-" + plugin.id + ".sh");
  }

  function installOneLiner(plugin) {
    return "curl -fsSL " + INSTALL_TOOLS_BASE + "/" + installScriptName(plugin) + " | bash";
  }

  function installArchiveName(plugin) {
    var install = plugin.install || {};
    return install.archive || (plugin.id + "-source.zip");
  }

  function installArchiveUrl(plugin) {
    var name = installArchiveName(plugin);
    return isLocalHost() ? "../archives/" + name : INSTALL_ARCHIVES_BASE + "/" + name;
  }

  function copyText(text) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy") ? resolve() : reject(new Error("copy failed"));
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(ta);
      }
    });
  }

  function ensureInstallModal() {
    if (installModal && installModal.backdrop && document.body.contains(installModal.backdrop)) {
      return installModal;
    }
    var backdrop = document.createElement("div");
    backdrop.className = "suite-install-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    backdrop.innerHTML =
      '<div class="suite-install-modal" role="dialog" aria-modal="true" aria-labelledby="suiteInstallTitle">' +
      '  <header class="suite-install-modal__head">' +
      '    <div class="suite-install-modal__head-text">' +
      '      <p class="suite-install-modal__eyebrow">Install</p>' +
      '      <h2 class="suite-install-modal__title" id="suiteInstallTitle"></h2>' +
      "    </div>" +
      '    <button type="button" class="suite-install-modal__close" aria-label="Close install dialog">' +
      '      <span class="material-symbols-outlined" aria-hidden="true">close</span>' +
      "    </button>" +
      "  </header>" +
      '  <div class="suite-install-modal__body">' +
      '    <p class="suite-install-modal__lead">Run this one-liner on a Linux node with <code>git</code> and network access:</p>' +
      '    <div class="suite-install-command">' +
      '      <pre class="suite-install-command__code" id="suiteInstallCommand"></pre>' +
      '      <button type="button" class="suite-install-command__copy" id="suiteInstallCopy">Copy</button>' +
      "    </div>" +
      '    <p class="suite-install-modal__note">The installer clones <strong>webtools-ui</strong> and this tool as siblings under <code>~/workspace</code>, verifies shared UI assets, then runs <code>./setup.sh</code>.</p>' +
      "  </div>" +
      '  <footer class="suite-install-modal__foot">' +
      '    <a class="suite-install-download" id="suiteInstallDownload" href="#" download>' +
      '      <span class="material-symbols-outlined" aria-hidden="true">download</span>' +
      "      Download source archive (.zip)" +
      "    </a>" +
      '    <button type="button" class="suite-install-modal__done" id="suiteInstallDone">Done</button>' +
      "  </footer>" +
      "</div>";
    document.body.appendChild(backdrop);

    var closeBtn = backdrop.querySelector(".suite-install-modal__close");
    var doneBtn = backdrop.querySelector("#suiteInstallDone");
    var copyBtn = backdrop.querySelector("#suiteInstallCopy");

    function closeModal() {
      backdrop.classList.remove("is-open");
      backdrop.setAttribute("aria-hidden", "true");
      if (installModal && installModal.previousFocus && installModal.previousFocus.focus) {
        installModal.previousFocus.focus();
      }
      document.removeEventListener("keydown", onKeydown);
    }

    function onKeydown(e) {
      if (e.key === "Escape") closeModal();
    }

    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeModal();
    });
    closeBtn.addEventListener("click", closeModal);
    doneBtn.addEventListener("click", closeModal);
    copyBtn.addEventListener("click", function () {
      var cmd = backdrop.querySelector("#suiteInstallCommand");
      if (!cmd) return;
      copyText(cmd.textContent || "").then(function () {
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 1600);
      }).catch(function () {
        copyBtn.textContent = "Select & copy";
      });
    });

    installModal = {
      backdrop: backdrop,
      titleEl: backdrop.querySelector("#suiteInstallTitle"),
      commandEl: backdrop.querySelector("#suiteInstallCommand"),
      downloadEl: backdrop.querySelector("#suiteInstallDownload"),
      previousFocus: null,
      open: function (plugin) {
        this.previousFocus = document.activeElement;
        this.titleEl.textContent = plugin.name || plugin.id;
        var cmd = installOneLiner(plugin);
        this.commandEl.textContent = cmd;
        var archiveUrl = installArchiveUrl(plugin);
        this.downloadEl.href = archiveUrl;
        this.downloadEl.setAttribute("download", installArchiveName(plugin));
        backdrop.classList.add("is-open");
        backdrop.setAttribute("aria-hidden", "false");
        document.addEventListener("keydown", onKeydown);
        closeBtn.focus();
      },
      close: closeModal,
    };
    return installModal;
  }

  function openInstallModal(plugin) {
    ensureInstallModal().open(plugin);
  }

  function taglineFor(plugin) {
    var meta = metaFor(plugin);
    return meta.tagline || plugin.description || "";
  }

  function prefersReducedMotion() {
    return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function clearAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  function scheduleAutoplay() {
    clearAutoplay();
    if (prefersReducedMotion() || state.plugins.length <= 1) return;
    autoplayTimer = setInterval(function () {
      goTo(state.index + 1, { animate: true, syncHash: true, autoplay: true });
    }, AUTOPLAY_MS);
  }

  function sortPlugins(plugins) {
    var rank = Object.create(null);
    SHOWCASE_ORDER.forEach(function (id, i) { rank[id] = i; });
    return plugins.slice().sort(function (a, b) {
      var ra = rank[a.id];
      var rb = rank[b.id];
      if (ra == null && rb == null) return (a.name || a.id).localeCompare(b.name || b.id);
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    });
  }

  function wrapIndex(index, count) {
    return ((index % count) + count) % count;
  }

  function tabImageHtml(plugin, tab, opts) {
    opts = opts || {};
    var src = tabScreenshotSrc(plugin, tab);
    var legacy = legacyScreenshotSrc(plugin);
    var cls = "suite-banner-panel";
    if (opts.focus) cls += " suite-banner-focus";
    if (opts.center) cls += " is-center";
    if (opts.wing === "left") cls += " suite-banner-wing suite-banner-wing--left";
    if (opts.wing === "right") cls += " suite-banner-wing suite-banner-wing--right";
    var depthAttr = opts.depth != null ? ' data-depth="' + opts.depth + '"' : "";
    return (
      '<div class="' + cls + '"' + depthAttr + ' data-tool-id="' + esc(plugin.id) + '">' +
      '<img src="' + esc(src) + '" alt="' + esc(plugin.name + " — " + tab) + '" ' +
      'onerror="this.onerror=null;this.src=\'' + esc(legacy) + '\';" /></div>'
    );
  }

  function bannerHeadHtml(plugin) {
    var icon = faviconSrc(plugin);
    return (
      '<header class="suite-banner-head">' +
      '<img class="suite-banner-head__icon" src="' + esc(icon) + '" alt="" width="33" height="33" decoding="async" />' +
      '<h2 class="suite-banner-head__title">' + esc(plugin.name || plugin.id) + "</h2>" +
      "</header>"
    );
  }

  function wingTabFor(plugin) {
    return tabsFor(plugin)[0];
  }

  function bannerFocusTrioHtml(plugin) {
    var tabs = tabsFor(plugin);
    return (
      '<div class="suite-banner-trio">' +
      tabs.map(function (tab, i) {
        return tabImageHtml(plugin, tab, {
          focus: true,
          center: i === 1 || (tabs.length === 1 && i === 0),
        });
      }).join("") +
      "</div>"
    );
  }

  function bannerWingsHtml(idx, plugins, side, offsets) {
    var count = plugins.length;
    return offsets.map(function (offset) {
      var plugin = plugins[wrapIndex(idx + (side === "left" ? -offset : offset), count)];
      return tabImageHtml(plugin, wingTabFor(plugin), { wing: side, depth: offset });
    }).join("");
  }

  function bannerSlideHtml(plugin, idx, plugins) {
    var leftOffsets = [3, 2, 1];
    var rightOffsets = [1, 2, 3];
    return (
      '<figure class="suite-banner-slide" data-index="' + idx + '" data-id="' + esc(plugin.id) + '" aria-hidden="' +
      (idx === state.index ? "false" : "true") + '">' +
      '<div class="suite-banner-stage">' +
      bannerHeadHtml(plugin) +
      '<div class="suite-banner-wings suite-banner-wings--left">' +
      bannerWingsHtml(idx, plugins, "left", leftOffsets) +
      "</div>" +
      '<div class="suite-banner-core">' +
      bannerFocusTrioHtml(plugin) +
      "</div>" +
      '<div class="suite-banner-wings suite-banner-wings--right">' +
      bannerWingsHtml(idx, plugins, "right", rightOffsets) +
      "</div>" +
      "</div></figure>"
    );
  }

  function cardHtml(plugin, idx) {
    var tabs = tabsFor(plugin);
    var primaryTab = tabs[0];
    var shot = tabScreenshotSrc(plugin, primaryTab);
    var legacy = legacyScreenshotSrc(plugin);
    var fallback = fallbackArtSrc(plugin);
    var appUrl = appHref(plugin);
    var pitchUrl = pitchHref(plugin);
    var icon = faviconSrc(plugin);
    var tagline = taglineFor(plugin);
    var bgStyle =
      "background-image:url('" + shot.replace(/'/g, "%27") + "'),url('" +
      legacy.replace(/'/g, "%27") + "'),url('" + fallback.replace(/'/g, "%27") + "')";

    return (
      '<article class="suite-tool-card' + (idx === state.index ? " is-active" : "") + '" ' +
      'data-index="' + idx + '" data-id="' + esc(plugin.id) + '" data-app-href="' + esc(appUrl) + '" ' +
      'tabindex="0" role="group" aria-label="' + esc(plugin.name || plugin.id) + '">' +
      '<div class="suite-tool-card__bg" style="' + esc(bgStyle) + '"></div>' +
      '<div class="suite-tool-card__shade" aria-hidden="true"></div>' +
      '<div class="suite-tool-card__top">' +
      '<img class="suite-tool-card__icon" src="' + esc(icon) + '" alt="" width="20" height="20" decoding="async" />' +
      '<h2 class="suite-tool-card__title">' + esc(plugin.name || plugin.id) + "</h2>" +
      "</div>" +
      '<p class="suite-tool-card__desc">' + esc(tagline) + "</p>" +
      '<div class="suite-tool-card__pills">' +
      '<a class="suite-pill suite-pill--tool" href="' + esc(appUrl) + '" title="Tool" aria-label="Open tool">' +
      '<span class="material-symbols-outlined suite-pill__icon" aria-hidden="true">dashboard</span>' +
      '<span class="suite-pill__tip">Tool</span></a>' +
      '<a class="suite-pill suite-pill--overview" href="' + esc(pitchUrl) + '" title="Overview" aria-label="Open overview">' +
      '<span class="material-symbols-outlined suite-pill__icon" aria-hidden="true">slideshow</span>' +
      '<span class="suite-pill__tip">Overview</span></a>' +
      '<button type="button" class="suite-pill suite-pill--install" data-install-id="' + esc(plugin.id) + '" title="Install" aria-label="Install">' +
      '<span class="material-symbols-outlined suite-pill__icon" aria-hidden="true">download</span>' +
      '<span class="suite-pill__tip">Install</span></button>' +
      "</div></article>"
    );
  }

  function render(plugins) {
    state.plugins = plugins;
    var track = byId("suite-banner-track");
    var grid = byId("suite-grid");
    var dots = byId("suite-dots");
    if (!track || !grid || !dots) return;

    track.innerHTML = plugins.map(function (p, i) { return bannerSlideHtml(p, i, plugins); }).join("");
    grid.innerHTML = plugins.map(cardHtml).join("");
    dots.innerHTML = plugins.map(function (p, i) {
      return '<button type="button" class="suite-dot' + (i === state.index ? " is-active" : "") +
        '" data-index="' + i + '" aria-label="Show ' + esc(p.name || p.id) + '"></button>';
    }).join("");

    bindControls();
    requestAnimationFrame(function () {
      goTo(state.index, { animate: false });
    });
  }

  function bindControls() {
    document.querySelectorAll(".suite-dot").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-index"), 10);
        if (!isNaN(idx)) goTo(idx);
      });
    });

    document.querySelectorAll(".suite-tool-card").forEach(function (card) {
      card.addEventListener("mouseenter", function () {
        var idx = parseInt(card.getAttribute("data-index"), 10);
        if (!isNaN(idx)) goTo(idx, { animate: true, syncHash: false });
      });
      card.addEventListener("focus", function () {
        var idx = parseInt(card.getAttribute("data-index"), 10);
        if (!isNaN(idx)) goTo(idx, { animate: true, syncHash: false });
      });
      card.addEventListener("click", function (e) {
        if (e.target.closest(".suite-pill")) return;
        var href = card.getAttribute("data-app-href");
        if (href) global.location.href = href;
      });
      card.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target.closest(".suite-pill")) return;
        e.preventDefault();
        var href = card.getAttribute("data-app-href");
        if (href) global.location.href = href;
      });
    });

    document.querySelectorAll(".suite-pill--install").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = btn.getAttribute("data-install-id");
        var plugin = state.plugins.find(function (p) { return p.id === id; });
        if (plugin) openInstallModal(plugin);
      });
    });
  }

  function syncSlideWidths() {
    var viewport = byId("suite-banner-viewport");
    var track = byId("suite-banner-track");
    if (!viewport || !track) return 0;
    var width = viewport.clientWidth;
    Array.prototype.forEach.call(track.children, function (slide) {
      slide.style.flex = "0 0 " + width + "px";
      slide.style.width = width + "px";
      slide.style.maxWidth = width + "px";
    });
    return width;
  }

  function updateTrackPosition(animate) {
    var track = byId("suite-banner-track");
    if (!track) return;
    syncSlideWidths();
    var slide = track.children[state.index];
    if (!slide) return;
    var offset = slide.offsetLeft;
    if (!animate) track.style.transition = "none";
    track.style.transform = "translateX(-" + offset + "px)";
    if (!animate) {
      track.offsetHeight;
      track.style.transition = "";
    }
  }

  function goTo(index, opts) {
    var plugins = state.plugins;
    if (!plugins.length) return;
    var animate = !opts || opts.animate !== false;
    var syncHash = !opts || opts.syncHash !== false;
    var count = plugins.length;
    state.index = ((index % count) + count) % count;

    updateTrackPosition(animate);

    document.querySelectorAll(".suite-banner-slide").forEach(function (slide, i) {
      slide.setAttribute("aria-hidden", i === state.index ? "false" : "true");
    });
    document.querySelectorAll(".suite-dot").forEach(function (dot, i) {
      dot.classList.toggle("is-active", i === state.index);
    });
    document.querySelectorAll(".suite-tool-card").forEach(function (card, i) {
      card.classList.toggle("is-active", i === state.index);
    });

    if (syncHash && global.history && global.history.replaceState && plugins[state.index]) {
      global.history.replaceState(null, "", "#" + encodeURIComponent(plugins[state.index].id));
    }

    if (!opts || !opts.autoplay) scheduleAutoplay();
  }

  function showError(message) {
    var grid = byId("suite-grid");
    if (grid) grid.innerHTML = '<p class="suite-error">' + esc(message) + "</p>";
  }

  function wireNav() {
    var prev = byId("suite-prev");
    var next = byId("suite-next");
    var banner = byId("suite-banner-viewport");
    if (prev) prev.addEventListener("click", function () { goTo(state.index - 1); });
    if (next) next.addEventListener("click", function () { goTo(state.index + 1); });

    if (banner) {
      banner.addEventListener("mouseenter", clearAutoplay);
      banner.addEventListener("mouseleave", scheduleAutoplay);
      banner.addEventListener("focusin", clearAutoplay);
      banner.addEventListener("focusout", scheduleAutoplay);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) clearAutoplay();
      else scheduleAutoplay();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); goTo(state.index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); goTo(state.index + 1); }
      if (e.key === "Home") { e.preventDefault(); goTo(0); }
      if (e.key === "End") { e.preventDefault(); goTo(state.plugins.length - 1); }
    });

    global.addEventListener("resize", function () {
      updateTrackPosition(false);
    });
  }

  function initFromHash(plugins) {
    var hash = (global.location.hash || "").replace(/^#/, "");
    if (!hash || !plugins.length) return;
    try { hash = decodeURIComponent(hash); } catch (_) {}
    var idx = plugins.findIndex(function (p) { return p.id === hash; });
    if (idx >= 0) state.index = idx;
  }

  function boot() {
    wireNav();
    fetch(REGISTRY_URL)
      .then(function (r) {
        if (!r.ok) throw new Error(REGISTRY_URL + " " + r.status);
        return r.json();
      })
      .then(function (registry) {
        var plugins = sortPlugins((registry && registry.plugins) || []);
        if (!plugins.length) throw new Error("No plugins in registry");
        initFromHash(plugins);
        render(plugins);
      })
      .catch(function (err) {
        showError("Could not load the tools registry (" + err.message + "). Serve from the webtools-ui repo root.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
