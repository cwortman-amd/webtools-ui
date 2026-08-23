#!/usr/bin/env node
/**
 * Refresh pitch-deck PNGs from live consumer UIs (1440×810).
 *
 * Usage (from webtools-ui repo root):
 *   node scripts/capture-pitch-screenshots.mjs
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKSPACE = path.resolve(ROOT, "..");
const VIEWPORT = { width: 1440, height: 810 };

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("@playwright/test"));
} catch {
  try {
    ({ chromium } = require(path.join(WORKSPACE, "knowledge-exchange/tests/ui/node_modules/@playwright/test")));
  } catch {
    console.error("Install @playwright/test in a consumer repo, then re-run.");
    process.exit(1);
  }
}

/** @typedef {{ file: string, url: string, outDir?: string, selector?: string, waitMs?: number, initScript?: string, beforeShot?: string, clipSelector?: string, userMode?: string, modeKey?: string, fullPage?: boolean }} Shot */

/** @type {{ repo: string, defaultOut: string, initScript?: string, waitUntil?: string, shots: Shot[] }[]} */
const SUITES = [
  {
    repo: "llm-benchmark",
    defaultOut: "pages/presentation-assets",
    initScript: `
      try {
        localStorage.setItem('im-user-mode', 'expert');
        localStorage.setItem('im-demo.welcome.shown', '1');
      } catch (e) {}
    `,
    shots: [
      { file: "01-plan.png", url: "/pages/index.html?tab=plan", selector: "#frame-plan", waitMs: 3500 },
      { file: "02-deploy.png", url: "/pages/index.html?tab=queue", selector: "#frame-queue", waitMs: 3500 },
      { file: "03-view.png", url: "/pages/index.html?tab=view", selector: "#frame-view", waitMs: 4000 },
      { file: "04-profile.png", url: "/pages/index.html?tab=profile", selector: "#frame-profile", waitMs: 3500 },
      { file: "05-report.png", url: "/pages/index.html?tab=report", selector: "#frame-report", waitMs: 3500 },
    ],
  },
  {
    repo: "dc-planner",
    defaultOut: "pages/presentation-assets",
    initScript: `try { localStorage.setItem('dc-user-mode', 'expert'); } catch (e) {}`,
    shots: [
      { file: "01-workload.png", url: "/pages/index.html?tab=workload", selector: "#tabWorkload", waitMs: 2500 },
      { file: "02-gpu.png", url: "/pages/index.html?tab=gpu", selector: "#tabGpu", waitMs: 2500 },
      { file: "03-tco-top.png", url: "/pages/index.html?tab=tco", selector: "#tabTco", waitMs: 2500 },
      {
        file: "03c-tco-mid.png",
        url: "/pages/index.html?tab=tco",
        selector: "#tabTco",
        waitMs: 2500,
        beforeShot: `() => {
          const panel = document.querySelector('#tabTco');
          const target = panel && (panel.querySelector('.tco-break-even, .tco-build-buy, [data-tco-section]') || panel);
          if (target) target.scrollIntoView({ block: 'start' });
        }`,
      },
      {
        file: "03b-tco-fullpage.png",
        url: "/pages/index.html?tab=tco",
        selector: "#tabTco",
        waitMs: 2500,
        fullPage: true,
      },
      { file: "04-rack.png", url: "/pages/index.html?tab=rack", selector: "#tabRack", waitMs: 3000 },
      {
        file: "04b-rack-top.png",
        url: "/pages/index.html?tab=rack",
        selector: "#tabRack",
        waitMs: 2500,
        beforeShot: `() => {
          const panel = document.querySelector('#tabRack');
          if (panel) panel.scrollTop = 0;
        }`,
      },
      { file: "05-networking.png", url: "/pages/index.html?tab=net", selector: "#tabNet", waitMs: 3000 },
      { file: "06-architecture.png", url: "/pages/index.html?tab=arch", selector: "#tabArch", waitMs: 3000 },
      { file: "08-datacenter.png", url: "/pages/index.html?tab=dc", selector: "#tabDc", waitMs: 3000 },
      {
        file: "09-standard-mode.png",
        url: "/pages/index.html?tab=workload",
        selector: "#tabWorkload",
        waitMs: 2500,
        initScript: `try { localStorage.setItem('dc-user-mode', 'standard'); } catch (e) {}`,
      },
      {
        file: "07-report.png",
        url: "/pages/present.html",
        selector: ".pres-slide.active, .pres-slide:first-child, .stage",
        waitMs: 2000,
        beforeShot: `async () => {
          try {
            if (!localStorage.getItem('dc-planner-present')) {
              localStorage.setItem('dc-planner-present', JSON.stringify({ slides: [{ title: 'Executive Report', body: 'Sample report preview' }] }));
            }
          } catch (e) {}
        }`,
      },
      {
        file: "report-toc.png",
        url: "/pages/present.html",
        waitMs: 2000,
        beforeShot: `() => {
          const slides = document.querySelectorAll('.pres-slide');
          if (slides.length) slides[0].scrollIntoView();
        }`,
        selector: ".pres-slide:first-child, .stage",
      },
      {
        file: "present-tco.png",
        url: "/pages/present.html",
        waitMs: 2000,
        beforeShot: `() => {
          const match = Array.from(document.querySelectorAll('.pres-slide')).find(s =>
            /tco|cost|token/i.test(s.textContent || '')
          );
          if (match) match.scrollIntoView();
          else {
            const slides = document.querySelectorAll('.pres-slide');
            if (slides[1]) slides[1].scrollIntoView();
          }
        }`,
        selector: ".pres-slide:nth-child(2), .stage",
      },
    ],
  },
  {
    repo: "cluster-manager",
    defaultOut: "docs/images",
    initScript: `
      try {
        localStorage.setItem('cm-demo.welcome.shown', '1');
        localStorage.setItem('su-user-mode', 'expert');
      } catch (e) {}
    `,
    shots: [
      {
        file: "dashboard_tabs_workflow.png",
        url: "/pages/index.html?tab=install",
        waitMs: 3500,
        selector: "body",
      },
      {
        file: "dashboard_present_workflow.png",
        url: "/pages/index.html?tab=report",
        waitMs: 4000,
        selector: "body",
      },
      { file: "slide03_from_baremetal_to_validated_ai_fabric_co.png", url: "/pages/fabric.html", selector: "body", waitMs: 3000 },
      { file: "slide09_reference_architecture__user_expectation.png", url: "/pages/network.html", selector: "body", waitMs: 3500 },
      { file: "slide29_fabric_topology_graph__detailed.png", url: "/pages/network.html", selector: "body", waitMs: 3500,
        beforeShot: `() => {
          const topo = document.querySelector('[class*="topolog"], svg, canvas, .fabric-graph, #topology');
          if (topo) topo.scrollIntoView({ block: 'center' });
        }` },
      { file: "slide26_fabric_analyzer.png", url: "/pages/fabric.html", selector: "body", waitMs: 3000 },
      { file: "slide26_fabric_analyzer_3.png", url: "/pages/fabric.html", selector: "body", waitMs: 3000,
        beforeShot: `() => {
          const rules = document.querySelector('pre, textarea, [class*="valid"], [class*="yaml"]');
          if (rules) rules.scrollIntoView({ block: 'center' });
        }` },
    ],
  },
  {
    repo: "demo-portal",
    defaultOut: "pages/presentation-assets",
    initScript: "",
    shots: [
      { file: "01-catalog.png", url: "/pages/index.html?tab=catalog", waitMs: 3500, selector: "#shell-body, .shell-body, body" },
      { file: "02-module.png", url: "/pages/module.html?id=agentic-rag", waitMs: 3500, selector: "body" },
      { file: "03-favorites.png", url: "/pages/index.html?tab=catalog", waitMs: 2500, selector: "#shell-body, .shell-body, body" },
    ],
  },
  {
    repo: "knowledge-exchange",
    defaultOut: "pages/presentation-assets",
    initScript: `
      try {
        localStorage.setItem('knowledge-exchange:portal-profile', 'developer');
        localStorage.setItem('app-user-mode', 'advanced');
      } catch (e) {}
    `,
    shots: [
      { file: "01-catalog.png", url: "/pages/index.html?tab=catalog", waitMs: 4000, selector: "#frame-catalog, #shell-body" },
      { file: "02-paths.png", url: "/pages/index.html?tab=paths", waitMs: 3500, selector: "#frame-paths, #shell-body" },
      { file: "03-create.png", url: "/pages/index.html?tab=create", waitMs: 4000, selector: "#frame-create, #shell-body" },
    ],
  },
  {
    repo: "slide-presenter",
    defaultOut: "pages/presentation-assets",
    initScript: `try { localStorage.setItem('sp-user-mode', 'expert'); } catch (e) {}`,
    waitUntil: "domcontentloaded",
    shots: [
      { file: "01-search.png", url: "/pages/index.html?tab=search", waitMs: 2500, selector: "#shell-body, .shell-body" },
      { file: "02-build.png", url: "/pages/index.html?tab=build", waitMs: 3500, selector: "#shell-body, .shell-body" },
      { file: "03-present.png", url: "/pages/index.html?tab=present", waitMs: 2500, selector: "#shell-body, .shell-body" },
    ],
  },
];

function startServer(cwd, port) {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
      cwd,
      stdio: "ignore",
    });
    proc.on("error", reject);
    const check = () => {
      http.get(`http://127.0.0.1:${port}/`, (res) => {
        res.resume();
        resolve(proc);
      }).on("error", () => setTimeout(check, 120));
    };
    setTimeout(check, 200);
  });
}

function stopServer(proc) {
  if (proc && !proc.killed) proc.kill("SIGTERM");
}

async function dismissChrome(page) {
  await page.evaluate(() => {
    document.querySelectorAll("#chatPanel.open, .chat-panel.open, .notes-panel.open").forEach((el) => {
      el.classList.remove("open");
    });
    document.querySelectorAll("[hidden]").forEach(() => {});
  }).catch(() => {});
}

async function resolveLocator(page, selector) {
  if (!selector) return page.locator("body");
  for (const sel of selector.split(",").map((s) => s.trim())) {
    const loc = page.locator(sel).first();
    if (await loc.count().catch(() => 0)) return loc;
  }
  return page.locator("body");
}

async function captureShot(page, baseUrl, shot, suiteInit) {
  if (shot.initScript) await page.addInitScript(shot.initScript);
  await page.goto(`${baseUrl}${shot.url}`, { waitUntil: "networkidle", timeout: 60_000 }).catch(async () => {
    await page.goto(`${baseUrl}${shot.url}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  });
  await page.waitForTimeout(shot.waitMs || 2000);
  await dismissChrome(page);

  if (shot.beforeShot) {
    await page.evaluate(shot.beforeShot).catch(() => {});
    await page.waitForTimeout(600);
  }

  const target = await resolveLocator(page, shot.selector || "body");
  const outPath = shot.outPath;
  if (shot.fullPage) {
    await page.screenshot({ path: outPath, type: "png", fullPage: true });
    return;
  }
  await target.screenshot({ path: outPath, type: "png" }).catch(async () => {
    await page.screenshot({ path: outPath, type: "png" });
  });
}

async function captureSuite(spec, port) {
  const repoRoot = path.join(WORKSPACE, spec.repo);
  if (!fs.existsSync(path.join(repoRoot, "pages", "index.html")) && spec.shots.every((s) => !s.url.includes("module.html"))) {
    console.warn(`skip ${spec.repo}: missing pages/index.html`);
    return;
  }

  let server;
  const browser = await chromium.launch();
  try {
    server = await startServer(repoRoot, port);
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    if (spec.initScript) await page.addInitScript(spec.initScript);
    const baseUrl = `http://127.0.0.1:${port}`;

    for (const shot of spec.shots) {
      const outDir = path.join(repoRoot, shot.outDir || spec.defaultOut);
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, shot.file);
      const page2 = shot.initScript ? await context.newPage() : page;
      if (shot.initScript) await page2.addInitScript(shot.initScript);
      if (spec.initScript && shot.initScript) await page2.addInitScript(spec.initScript);
      try {
        shot.outPath = outPath;
        await captureShot(page2, baseUrl, shot, spec.initScript);
        console.log(`wrote ${outPath}`);
      } catch (err) {
        console.warn(`failed ${spec.repo}/${shot.file}: ${err.message}`);
      } finally {
        if (shot.initScript) await page2.close();
      }
    }
    await context.close();
  } finally {
    await browser.close();
    stopServer(server);
  }
}

async function main() {
  let port = 8820;
  for (const spec of SUITES) {
    await captureSuite(spec, port++);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
