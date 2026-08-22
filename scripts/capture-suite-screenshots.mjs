#!/usr/bin/env node
/**
 * Capture 16:9 tab screenshots for the webtools suite landing page.
 * Writes PNGs to assets/suite/screenshots/{plugin-id}-{tab}.png (1440×810).
 *
 * Usage (from webtools-ui repo root):
 *   node scripts/capture-suite-screenshots.mjs
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
const OUT_DIR = path.join(ROOT, "assets", "suite", "screenshots");
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

/** Three representative tabs per tool (carousel trio). */
const CAPTURES = [
  {
    id: "cluster-manager",
    repo: "cluster-manager",
    tabs: ["install", "network", "test"],
    tabQuery: true,
    initScript: `
      try {
        localStorage.setItem('cm-demo.welcome.shown', '1');
        localStorage.setItem('su-user-mode', 'expert');
      } catch (e) {}
    `,
    waitMs: 2200,
  },
  {
    id: "dc-planner",
    repo: "dc-planner",
    tabs: ["workload", "gpu", "tco"],
    tabQuery: true,
    initScript: `try { localStorage.setItem('dc-user-mode', 'expert'); } catch (e) {}`,
    waitMs: 2200,
  },
  {
    id: "llm-benchmark",
    repo: "llm-benchmark",
    tabs: ["plan", "queue", "view"],
    tabQuery: true,
    initScript: `try { localStorage.setItem('im-user-mode', 'expert'); } catch (e) {}`,
    waitMs: 2200,
  },
  {
    id: "knowledge-exchange",
    repo: "knowledge-exchange",
    tabs: ["paths", "catalog", "resources"],
    tabQuery: true,
    initScript: `
      try {
        localStorage.setItem('knowledge-exchange:portal-profile', 'developer');
        localStorage.setItem('app-user-mode', 'advanced');
      } catch (e) {}
    `,
    waitMs: 3500,
  },
  {
    id: "demo-portal",
    repo: "demo-portal",
    tabs: ["catalog", "tools", "info"],
    tabQuery: true,
    initScript: "",
    waitMs: 1800,
  },
  {
    id: "slide-presenter",
    repo: "slide-presenter",
    tabs: ["present", "notes", "export"],
    tabQuery: true,
    initScript: `try { localStorage.setItem('sp-user-mode', 'expert'); } catch (e) {}`,
    waitMs: 1800,
    waitUntil: "domcontentloaded",
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

function entryUrl(spec, tab) {
  return `/pages/index.html?tab=${encodeURIComponent(tab)}`;
}

async function captureApp(spec, port) {
  const repoRoot = path.join(WORKSPACE, spec.repo);
  if (!fs.existsSync(path.join(repoRoot, "pages", "index.html"))) {
    console.warn(`skip ${spec.id}: missing pages/index.html`);
    return;
  }

  let server;
  try {
    server = await startServer(repoRoot, port);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: VIEWPORT });
    if (spec.initScript) await page.addInitScript(spec.initScript);

    for (const tab of spec.tabs) {
      const url = `http://127.0.0.1:${port}${entryUrl(spec, tab)}`;
      await page.goto(url, { waitUntil: spec.waitUntil || "networkidle", timeout: 45_000 });
      await page.waitForTimeout(spec.waitMs);
      await page.evaluate(() => {
        const dlg = document.querySelector("#chatPanel.open, .chat-panel.open");
        if (dlg) dlg.classList.remove("open");
      }).catch(() => {});
      const out = path.join(OUT_DIR, `${spec.id}-${tab}.png`);
      await page.screenshot({ path: out, type: "png" });
      console.log(`wrote ${out}`);
    }

    await browser.close();
  } finally {
    stopServer(server);
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let port = 8810;
  for (const spec of CAPTURES) {
    await captureApp(spec, port++);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
