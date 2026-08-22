/* webtools-ui/js/suite.js — tab trio banner carousel + 1:1 tool cards */
(function (global) {
  "use strict";

  var REGISTRY_URL = "../plugins.registry.json";

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
      '<a class="suite-pill suite-pill--tool" href="' + esc(appUrl) + '">Tool</a>' +
      '<a class="suite-pill suite-pill--overview" href="' + esc(pitchUrl) + '">Overview</a>' +
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
