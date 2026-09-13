/* webtools-ui/js/suite.js — tab trio banner carousel + 1:1 tool cards */
(function (global) {
  "use strict";

  var REGISTRY_URL = "/plugins.registry.json";
  var INSTALL_TOOLS_BASE = "https://curt.wortman.ai/tools";
  var INSTALL_ARCHIVES_BASE = "https://curt.wortman.ai/archives";

  var installModal = null;
  var cmdPaletteModal = null;

  var APP_META = {
    "dc-planner": {
      name: "Data Center Planner",
      stage: "01 — Plan",
      stageNum: "01",
      tagline: "Design, size, and communicate data-center or AI infrastructure requirements",
      favicon: "/assets/suite/favicons/dc-planner.svg",
      tabs: ["workload", "gpu", "tco"],
      stack: ["AMD MI300X/MI325X", "NVIDIA Hopper/Blackwell", "800G Leaf-Spine", "TCO Model"],
      prompts: "Sizing & power footprint for 64x MI300X cluster",
      dataflowArtifact: "BOM & Topology JSON",
    },
    "cluster-manager": {
      name: "Cluster Manager",
      stage: "02 — Deploy",
      stageNum: "02",
      tagline: "Configure, manage, validate, or operationalize AI/HPC clusters",
      favicon: "/assets/suite/favicons/cluster-manager.svg",
      tabs: ["install", "network", "test"],
      stack: ["ROCm 6.x", "Pollara 400G AI-NIC", "Ansible", "RoCEv2 / IB"],
      prompts: "Configure RoCEv2 priority flow control",
      dataflowArtifact: "Ansible & Fabric Playbooks",
    },
    "llm-benchmark": {
      name: "LLM Benchmark",
      stage: "03 — Validate",
      stageNum: "03",
      tagline: "Measure model-serving, hardware, latency, throughput, or cost-performance outcomes",
      favicon: "/assets/suite/favicons/llm-benchmark.svg",
      tabs: ["plan", "queue", "view"],
      stack: ["vLLM / SGLang", "Triton Server", "Prometheus", "SLO Metrics"],
      prompts: "Compare TTFT & latency for vLLM vs SGLang",
      dataflowArtifact: "Telemetry & SLO Profiles",
    },
    "demo-portal": {
      name: "Demo Portal",
      stage: "04 — Demonstrate",
      stageNum: "04",
      tagline: "Deliver reusable technical demos and guided customer experiences",
      favicon: "/assets/suite/favicons/demo-portal.svg",
      tabs: ["catalog", "tools", "info"],
      stack: ["Docker / Podman", "JupyterLab", "Gradio / Streamlit", "Live Shell"],
      prompts: "Launch AMD GPU live container walkthrough",
      dataflowArtifact: "Runnable Solution Manifest",
    },
    "slide-presenter": {
      name: "Slide Presenter",
      stage: "05 — Communicate",
      stageNum: "05",
      tagline: "Turn technical material into engaging interactive presentation experiences",
      favicon: "/assets/suite/favicons/slide-presenter.svg",
      tabs: ["present", "notes", "export"],
      stack: ["PPTX / PDF Parser", "Markdown Decks", "Dual-Screen Console"],
      prompts: "Generate customer executive deck for AI cluster",
      dataflowArtifact: "Visual Virtual Decks",
    },
    "knowledge-exchange": {
      name: "Knowledge Exchange",
      stage: "06 — Learn",
      stageNum: "06",
      tagline: "Capture, retrieve, exchange, and operationalize technical knowledge",
      favicon: "/assets/suite/favicons/knowledge-exchange.svg",
      tabs: ["paths", "catalog", "resources"],
      stack: ["LLM Wiki Graph", "Interactive SVG", "Curriculum Engine"],
      prompts: "Open ROCm memory management training module",
      dataflowArtifact: "Operational Wiki & Runbooks",
    },
  };

  var WORKFLOW_PRESETS = [
    {
      id: "all",
      label: "All Workflows",
      desc: "Full 6-stage end-to-end AI infrastructure lifecycle",
      stages: ["dc-planner", "cluster-manager", "llm-benchmark", "demo-portal", "slide-presenter", "knowledge-exchange"],
    },
    {
      id: "cluster-sizing",
      label: "Cluster Sizing & Architecture",
      desc: "Design, BOM sizing, power modeling, and bare-metal orchestration",
      stages: ["dc-planner", "cluster-manager"],
    },
    {
      id: "inference-bench",
      label: "Inference & Benchmarking",
      desc: "Workload sizing, serving optimization, and latency/SLO verification",
      stages: ["dc-planner", "llm-benchmark"],
    },
    {
      id: "demos-briefing",
      label: "Executive Demos & Presentation",
      desc: "Live runnable demos and dual-screen customer presentation decks",
      stages: ["demo-portal", "slide-presenter"],
    },
    {
      id: "knowledge-enable",
      label: "Knowledge & Team Enablement",
      desc: "Curriculum modules, technical wiki, and presentation authoring",
      stages: ["slide-presenter", "knowledge-exchange"],
    },
  ];

  var SHOWCASE_ORDER = [
    "dc-planner",
    "cluster-manager",
    "llm-benchmark",
    "demo-portal",
    "slide-presenter",
    "knowledge-exchange",
  ];

  var state = { index: 0, plugins: [], activeWorkflow: "all" };
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
    if (local === "./index.html") return "/demo-portal/pages/index.html";
    if (local.startsWith("../")) return "/" + local.replace(/^\.\.\//, "");
    if (local.startsWith("./")) return "/" + local.replace(/^\.\//, "");
    return local;
  }

  function pitchHref(plugin) {
    var local = plugin.localUrl || "";
    if (local === "./index.html") return "/demo-portal/pages/pitch.html";
    if (local.startsWith("../")) local = "/" + local.replace(/^\.\.\//, "");
    return local.replace(/index\.html(\?.*)?$/, "pitch.html");
  }

  function tabScreenshotSrc(plugin, tab) {
    return "/assets/suite/screenshots/" + plugin.id + "-" + tab + ".png";
  }

  function legacyScreenshotSrc(plugin) {
    return "/assets/suite/screenshots/" + plugin.id + ".png";
  }

  function fallbackArtSrc(plugin) {
    return "/assets/suite/" + plugin.id + ".svg";
  }

  function faviconSrc(plugin) {
    var meta = metaFor(plugin);
    return meta.favicon || "/assets/suite/favicons/" + plugin.id + ".svg";
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
    var appUrl = appHref(plugin);
    var cls = "suite-banner-panel";
    if (opts.focus) cls += " suite-banner-focus";
    if (opts.center) cls += " is-center";
    if (opts.wing === "left") cls += " suite-banner-wing suite-banner-wing--left";
    if (opts.wing === "right") cls += " suite-banner-wing suite-banner-wing--right";
    var depthAttr = opts.depth != null ? ' data-depth="' + opts.depth + '"' : "";
    var roleAttr = opts.focus
      ? ' role="link" tabindex="0" title="Open ' + esc(plugin.name || plugin.id) + '" aria-label="Open ' + esc(plugin.name || plugin.id) + '"'
      : ' role="button" aria-label="Show ' + esc(plugin.name || plugin.id) + '"';
    return (
      '<div class="' + cls + '"' + depthAttr + ' data-tool-id="' + esc(plugin.id) + '" data-app-href="' + esc(appUrl) + '"' + roleAttr + '>' +
      '<img src="' + esc(src) + '" alt="' + esc(plugin.name + " — " + tab) + '" ' +
      'onerror="this.onerror=null;this.src=\'' + esc(legacy) + '\';" /></div>'
    );
  }

  function nameFor(plugin) {
    var meta = metaFor(plugin);
    return meta.name || plugin.name || plugin.id;
  }

  function bannerHeadHtml(plugin) {
    var icon = faviconSrc(plugin);
    var name = nameFor(plugin);
    return (
      '<header class="suite-banner-head">' +
      '<img class="suite-banner-head__icon" src="' + esc(icon) + '" alt="" width="33" height="33" decoding="async" />' +
      '<h2 class="suite-banner-head__title">' + esc(name) + "</h2>" +
      "</header>"
    );
  }

  function bannerFootHtml(plugin) {
    var meta = metaFor(plugin);
    var desc = meta.tagline || (plugin.description ? (plugin.description.short || plugin.description) : "") || plugin.tagline || "";
    return (
      '<footer class="suite-banner-foot">' +
      '<p class="suite-banner-desc">' + esc(desc) + "</p>" +
      "</footer>"
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
      bannerFootHtml(plugin) +
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
    var name = nameFor(plugin);
    var tagline = taglineFor(plugin);
    var meta = metaFor(plugin);
    var stack = meta.stack || [];
    var prompt = meta.prompts || ("Ask about " + name);
    var bgStyle =
      "background-image:url('" + shot.replace(/'/g, "%27") + "'),url('" +
      legacy.replace(/'/g, "%27") + "'),url('" + fallback.replace(/'/g, "%27") + "')";

    var stackBadgesHtml = stack.map(function (tech) {
      return '<span class="suite-stack-badge">' + esc(tech) + "</span>";
    }).join("");

    return (
      '<article class="suite-tool-card' + (idx === state.index ? " is-active" : "") + '" ' +
      'id="card-' + esc(plugin.id) + '" ' +
      'data-index="' + idx + '" data-id="' + esc(plugin.id) + '" data-app-href="' + esc(appUrl) + '" ' +
      'tabindex="0" role="group" aria-label="' + esc(name) + '">' +
      '<div class="suite-tool-card__bg" style="' + esc(bgStyle) + '"></div>' +
      '<div class="suite-tool-card__shade" aria-hidden="true"></div>' +
      '<div class="suite-tool-card__top">' +
      '<img class="suite-tool-card__icon" src="' + esc(icon) + '" alt="" width="20" height="20" decoding="async" />' +
      '<h2 class="suite-tool-card__title">' + esc(name) + "</h2>" +
      "</div>" +
      (stackBadgesHtml ? '<div class="suite-card-stack" aria-label="Technology stack">' + stackBadgesHtml + "</div>" : "") +
      '<div class="suite-tool-card__prompts">' +
      '<button type="button" class="suite-prompt-pill" data-prompt="' + esc(prompt) + '" title="Ask ViXCi AI Assistant">' +
      '<span class="material-symbols-outlined suite-prompt-pill__icon" aria-hidden="true">smart_toy</span>' +
      '<span class="suite-prompt-pill__text">' + esc(prompt) + "</span>" +
      "</button>" +
      "</div>" +
      '<div class="suite-tool-card__pills">' +
      '<a class="suite-pill suite-pill--tool" href="' + esc(appUrl) + '" title="Launch ' + esc(name) + '" aria-label="Launch ' + esc(name) + '">' +
      '<span class="material-symbols-outlined suite-pill__icon" aria-hidden="true">open_in_new</span>' +
      '<span class="suite-pill__tip">Launch Tool</span></a>' +
      '<a class="suite-pill suite-pill--overview" href="' + esc(pitchUrl) + '" title="Overview & Pitch" aria-label="Open overview">' +
      '<span class="material-symbols-outlined suite-pill__icon" aria-hidden="true">slideshow</span>' +
      '<span class="suite-pill__tip">Overview</span></a>' +
      '<button type="button" class="suite-pill suite-pill--install" data-install-id="' + esc(plugin.id) + '" title="Download & Install" aria-label="Download or Install">' +
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
    initWorkflowFinder();
    initDataflow();
    initPromptPills();
    initCommandPalette();

    requestAnimationFrame(function () {
      goTo(state.index, { animate: false });
    });
  }

  function initWorkflowFinder() {
    var container = byId("suite-workflows");
    if (!container) return;

    container.querySelectorAll(".suite-workflow-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var workflowId = chip.getAttribute("data-workflow");
        if (!workflowId) return;

        state.activeWorkflow = workflowId;
        container.querySelectorAll(".suite-workflow-chip").forEach(function (c) {
          c.classList.toggle("is-active", c === chip);
          c.setAttribute("aria-selected", c === chip ? "true" : "false");
        });

        var preset = WORKFLOW_PRESETS.find(function (w) { return w.id === workflowId; });
        var targetStages = preset ? preset.stages : SHOWCASE_ORDER;

        document.querySelectorAll(".suite-tool-card").forEach(function (card) {
          var cardId = card.getAttribute("data-id");
          var isMatch = targetStages.indexOf(cardId) >= 0;
          card.classList.toggle("is-dimmed", !isMatch);
          card.classList.toggle("is-highlighted", isMatch);
        });

        document.querySelectorAll(".suite-flow-step").forEach(function (step) {
          var stepId = step.getAttribute("data-id");
          var isMatch = targetStages.indexOf(stepId) >= 0;
          step.classList.toggle("is-dimmed", !isMatch);
        });

        document.querySelectorAll(".suite-dataflow-node").forEach(function (node) {
          var nodeId = node.getAttribute("data-id");
          var isMatch = targetStages.indexOf(nodeId) >= 0;
          node.classList.toggle("is-dimmed", !isMatch);
        });

        // Jump to first matching stage
        var firstMatch = targetStages[0];
        var firstIdx = state.plugins.findIndex(function (p) { return p.id === firstMatch; });
        if (firstIdx >= 0) goTo(firstIdx, { animate: true });
      });
    });
  }

  function initDataflow() {
    var dataflow = byId("suite-dataflow");
    if (!dataflow) return;

    dataflow.querySelectorAll(".suite-dataflow-node").forEach(function (node) {
      function triggerNode() {
        var stageId = node.getAttribute("data-id");
        var idx = state.plugins.findIndex(function (p) { return p.id === stageId; });
        if (idx >= 0) {
          goTo(idx);
          var card = byId("card-" + stageId);
          if (card) {
            card.focus();
            if (card.scrollIntoView && (window.innerHeight < 700 || window.innerWidth < 800)) {
              card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }
        }
      }

      node.addEventListener("click", triggerNode);
      node.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          triggerNode();
        }
      });
    });
  }

  function initPromptPills() {
    document.querySelectorAll(".suite-prompt-pill").forEach(function (pill) {
      pill.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var promptText = pill.getAttribute("data-prompt");
        if (!promptText) return;

        // If ViXCi chat widget or input exists in DOM, populate and open it
        var chatInput = document.querySelector("#chat-input, .vixci-input, textarea[name='message']");
        var chatTrigger = document.querySelector("#chat-toggle, .vixci-orb, [data-chat-toggle]");
        if (chatInput) {
          chatInput.value = promptText;
          if (chatTrigger && !document.querySelector(".vixci-chat-drawer.is-open")) {
            chatTrigger.click();
          }
          chatInput.focus();
        } else {
          // Fallback: copy prompt to clipboard with visual feedback
          var textSpan = pill.querySelector(".suite-prompt-pill__text");
          var origText = textSpan ? textSpan.textContent : "";
          copyText(promptText).then(function () {
            if (textSpan) {
              textSpan.textContent = "Copied to clipboard!";
              setTimeout(function () { textSpan.textContent = origText; }, 1800);
            }
          });
        }
      });
    });
  }

  var SEARCH_ITEMS = [
    { title: "Data Center Planner", sub: "01 Plan · GPU & Workload Sizing", url: "/dc-planner/pages/index.html", icon: "architecture", tag: "Plan" },
    { title: "BOM & TCO Analysis", sub: "01 Plan · Build vs Buy Model", url: "/dc-planner/pages/index.html#tco", icon: "calculate", tag: "Plan" },
    { title: "Rack & Switch Visualization", sub: "01 Plan · 400G/800G Leaf-Spine", url: "/dc-planner/pages/index.html#rack", icon: "lan", tag: "Plan" },
    { title: "Cluster Manager", sub: "02 Deploy · Provisioning & Telemetry", url: "/cluster-manager/pages/index.html", icon: "hub", tag: "Deploy" },
    { title: "Fabric Diagnostics & RoCEv2", sub: "02 Deploy · Pollara AI-NIC Network", url: "/cluster-manager/pages/network.html", icon: "settings_ethernet", tag: "Deploy" },
    { title: "Node Provisioning & Ansible", sub: "02 Deploy · Bare-metal playbooks", url: "/cluster-manager/pages/install.html", icon: "terminal", tag: "Deploy" },
    { title: "LLM Benchmark", sub: "03 Validate · Inference Latency & SLOs", url: "/llm-benchmark/pages/index.html", icon: "speed", tag: "Validate" },
    { title: "vLLM / SGLang Profiler", sub: "03 Validate · TTFT & Throughput", url: "/llm-benchmark/pages/profile.html", icon: "query_stats", tag: "Validate" },
    { title: "Benchmark Job Queue", sub: "03 Validate · Run & Compare Jobs", url: "/llm-benchmark/pages/view.html", icon: "queue", tag: "Validate" },
    { title: "Demo Portal", sub: "04 Demonstrate · Reusable Solutions", url: "/demo-portal/pages/index.html", icon: "play_circle", tag: "Demonstrate" },
    { title: "Interactive Solution Runner", sub: "04 Demonstrate · Live Container Workflows", url: "/demo-portal/pages/module.html", icon: "smart_display", tag: "Demonstrate" },
    { title: "Slide Presenter", sub: "05 Communicate · Visual Knowledge Workbench", url: "/slide-presenter/pages/index.html", icon: "slideshow", tag: "Communicate" },
    { title: "Dual-Screen Presenter Console", sub: "05 Communicate · Notes & Timer", url: "/slide-presenter/pages/present.html", icon: "present_to_all", tag: "Communicate" },
    { title: "Knowledge Exchange", sub: "06 Learn · LLM Wiki & Learning Catalog", url: "/knowledge-exchange/pages/index.html", icon: "school", tag: "Learn" },
    { title: "Curriculum Module Reader", sub: "06 Learn · Guided AI Engineering Tracks", url: "/knowledge-exchange/pages/module.html", icon: "menu_book", tag: "Learn" },
  ];

  function initCommandPalette() {
    var palette = byId("suite-cmd-palette");
    if (!palette) {
      palette = document.createElement("div");
      palette.className = "suite-cmd-palette";
      palette.id = "suite-cmd-palette";
      palette.setAttribute("aria-hidden", "true");
      palette.innerHTML =
        '<div class="suite-cmd-palette-backdrop"></div>' +
        '<div class="suite-cmd-palette-dialog" role="dialog" aria-modal="true" aria-label="Command Palette">' +
        '  <div class="suite-cmd-palette-search">' +
        '    <span class="material-symbols-outlined suite-cmd-palette-icon" aria-hidden="true">search</span>' +
        '    <input type="text" class="suite-cmd-palette-input" placeholder="Type a tool, stage, or feature... (e.g. Plan, RoCEv2, vLLM)" autocomplete="off" />' +
        '    <kbd class="suite-cmd-palette-kbd">ESC</kbd>' +
        "  </div>" +
        '  <div class="suite-cmd-palette-results" role="listbox"></div>' +
        '  <div class="suite-cmd-palette-foot">' +
        "    <span>Navigation: <strong>&uarr;&darr;</strong></span>" +
        "    <span>Open: <strong>&crarr;</strong></span>" +
        "    <span>Close: <strong>ESC</strong></span>" +
        "  </div>" +
        "</div>";
      document.body.appendChild(palette);
    }

    var input = palette.querySelector(".suite-cmd-palette-input");
    var resultsEl = palette.querySelector(".suite-cmd-palette-results");
    var backdrop = palette.querySelector(".suite-cmd-palette-backdrop");

    function renderResults(query) {
      query = (query || "").trim().toLowerCase();
      var matches = SEARCH_ITEMS.filter(function (item) {
        if (!query) return true;
        return (
          item.title.toLowerCase().indexOf(query) >= 0 ||
          item.sub.toLowerCase().indexOf(query) >= 0 ||
          item.tag.toLowerCase().indexOf(query) >= 0
        );
      });

      if (!matches.length) {
        resultsEl.innerHTML = '<div class="suite-cmd-palette-empty">No matching tools or views found.</div>';
        return;
      }

      resultsEl.innerHTML = matches.map(function (item, i) {
        return (
          '<a href="' + esc(item.url) + '" class="suite-cmd-palette-item' + (i === 0 ? " is-selected" : "") + '" role="option" data-url="' + esc(item.url) + '">' +
          '<span class="material-symbols-outlined suite-cmd-palette-item-icon" aria-hidden="true">' + esc(item.icon) + '</span>' +
          '<div class="suite-cmd-palette-item-text">' +
          '  <span class="suite-cmd-palette-item-title">' + esc(item.title) + '</span>' +
          '  <span class="suite-cmd-palette-item-sub">' + esc(item.sub) + '</span>' +
          '</div>' +
          '<span class="suite-cmd-palette-item-tag">' + esc(item.tag) + '</span>' +
          '</a>'
        );
      }).join("");

      bindItemClicks();
    }

    function bindItemClicks() {
      resultsEl.querySelectorAll(".suite-cmd-palette-item").forEach(function (item) {
        item.addEventListener("mouseenter", function () {
          resultsEl.querySelectorAll(".suite-cmd-palette-item").forEach(function (el) { el.classList.remove("is-selected"); });
          item.classList.add("is-selected");
        });
      });
    }

    function openPalette() {
      palette.classList.add("is-open");
      palette.setAttribute("aria-hidden", "false");
      input.value = "";
      renderResults("");
      input.focus();
      document.addEventListener("keydown", onPaletteKeydown);
    }

    function closePalette() {
      palette.classList.remove("is-open");
      palette.setAttribute("aria-hidden", "true");
      document.removeEventListener("keydown", onPaletteKeydown);
    }

    function onPaletteKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
        return;
      }

      var items = resultsEl.querySelectorAll(".suite-cmd-palette-item");
      if (!items.length) return;

      var currentIdx = -1;
      items.forEach(function (item, i) {
        if (item.classList.contains("is-selected")) currentIdx = i;
      });

      if (e.key === "ArrowDown") {
        e.preventDefault();
        var nextIdx = (currentIdx + 1) % items.length;
        items.forEach(function (item, i) { item.classList.toggle("is-selected", i === nextIdx); });
        items[nextIdx].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        var prevIdx = (currentIdx - 1 + items.length) % items.length;
        items.forEach(function (item, i) { item.classList.toggle("is-selected", i === prevIdx); });
        items[prevIdx].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentIdx >= 0 && items[currentIdx]) {
          var url = items[currentIdx].getAttribute("data-url");
          if (url) global.location.href = url;
        }
      }
    }

    input.addEventListener("input", function () {
      renderResults(input.value);
    });

    backdrop.addEventListener("click", closePalette);

    // Global shortcut listener: Cmd+K / Ctrl+K / '/'
    global.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (palette.classList.contains("is-open")) closePalette();
        else openPalette();
      }
    });

    var triggerBtn = byId("suite-cmd-trigger");
    if (triggerBtn) {
      triggerBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openPalette();
      });
    }

    cmdPaletteModal = { open: openPalette, close: closePalette };
  }

  function bindControls() {
    document.querySelectorAll(".suite-dot").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-index"), 10);
        if (!isNaN(idx)) goTo(idx);
      });
    });

    document.querySelectorAll(".suite-flow-step").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-index"), 10);
        if (!isNaN(idx)) {
          goTo(idx);
          var toolId = btn.getAttribute("data-id");
          var card = byId("card-" + toolId);
          if (card) {
            card.focus();
            if (card.scrollIntoView && (window.innerHeight < 700 || window.innerWidth < 800)) {
              card.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }
          }
        }
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
        if (e.target.closest(".suite-pill") || e.target.closest(".suite-prompt-pill")) return;
        var href = card.getAttribute("data-app-href");
        if (href) global.location.href = href;
      });
      card.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (e.target.closest(".suite-pill") || e.target.closest(".suite-prompt-pill")) return;
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

    document.querySelectorAll(".suite-banner-panel").forEach(function (panel) {
      panel.addEventListener("click", function (e) {
        var isWing = panel.classList.contains("suite-banner-wing");
        var toolId = panel.getAttribute("data-tool-id");
        if (isWing && toolId) {
          var targetIdx = state.plugins.findIndex(function (p) { return p.id === toolId; });
          if (targetIdx >= 0) {
            goTo(targetIdx);
            return;
          }
        }
        var href = panel.getAttribute("data-app-href");
        if (!href && state.plugins[state.index]) {
          href = appHref(state.plugins[state.index]);
        }
        if (href) global.location.href = href;
      });
      panel.addEventListener("keydown", function (e) {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        panel.click();
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
    document.querySelectorAll(".suite-flow-step").forEach(function (step, i) {
      step.classList.toggle("is-active", i === state.index);
      step.setAttribute("aria-selected", i === state.index ? "true" : "false");
    });
    document.querySelectorAll(".suite-dataflow-node").forEach(function (node, i) {
      node.classList.toggle("is-active", i === state.index);
    });
    document.querySelectorAll(".suite-tool-card").forEach(function (card, i) {
      card.classList.toggle("is-active", i === state.index);
    });

    var captionTextEl = byId("suite-banner-caption-text");
    if (captionTextEl && plugins[state.index]) {
      var activePlugin = plugins[state.index];
      var activeMeta = metaFor(activePlugin);
      var newDesc = activeMeta.tagline || (activePlugin.description ? (activePlugin.description.short || activePlugin.description) : "") || activePlugin.tagline || "";
      if (captionTextEl.textContent !== newDesc) {
        captionTextEl.classList.add("is-updating");
        setTimeout(function () {
          captionTextEl.textContent = newDesc;
          captionTextEl.classList.remove("is-updating");
        }, 120);
      }
    }

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

  var FALLBACK_REGISTRY = {
    plugins: [
      { id: "dc-planner", name: "Data Center Planner", localUrl: "/dc-planner/pages/index.html", description: "Design, size, and communicate data-center or AI infrastructure requirements" },
      { id: "cluster-manager", name: "Cluster Manager", localUrl: "/cluster-manager/pages/index.html", description: "Configure, manage, validate, or operationalize AI/HPC clusters" },
      { id: "llm-benchmark", name: "LLM Benchmark", localUrl: "/llm-benchmark/pages/index.html", description: "Measure model-serving, hardware, latency, throughput, or cost-performance outcomes" },
      { id: "demo-portal", name: "Demo Portal", localUrl: "/demo-portal/pages/index.html", description: "Deliver reusable technical demos and guided customer experiences" },
      { id: "slide-presenter", name: "Slide Presenter", localUrl: "/slide-presenter/pages/index.html", description: "Turn technical material into engaging interactive presentation experiences" },
      { id: "knowledge-exchange", name: "Knowledge Exchange", localUrl: "/knowledge-exchange/pages/index.html", description: "Capture, retrieve, exchange, and operationalize technical knowledge" },
    ]
  };

  function boot() {
    wireNav();

    function loadPlugins(registry) {
      var plugins = sortPlugins((registry && registry.plugins) || []);
      if (!plugins.length) plugins = sortPlugins(FALLBACK_REGISTRY.plugins);
      initFromHash(plugins);
      render(plugins);
    }

    fetch(REGISTRY_URL)
      .then(function (r) {
        if (!r.ok) return fetch("/plugins.registry.json");
        return r;
      })
      .then(function (r) {
        if (!r.ok) return fetch("../plugins.registry.json");
        return r;
      })
      .then(function (r) {
        if (!r.ok) throw new Error("Registry not found");
        return r.json();
      })
      .then(loadPlugins)
      .catch(function () {
        // Fallback gracefully to built-in registry so layout & graphics always render perfectly
        loadPlugins(FALLBACK_REGISTRY);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
