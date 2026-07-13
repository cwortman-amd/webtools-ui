#!/usr/bin/env node
/**
 * webtools-ui canonical asset: deterministic pitch-deck PDF exporter.
 *
 * Renders a consumer's pitch deck (default `pages/pitch.html`) into a US
 * Letter landscape PDF that mirrors the on-screen render. Shared verbatim by
 * cluster-manager, dc-planner, and llm-benchmark — the previous per-repo
 * copies differed only in comment prose.
 *
 * Why this exists:
 *   The in-app print button calls window.print(), which depends on the user's
 *   choices in Chrome's print dialog. Even with the page's @page rule and
 *   print-color-adjust hints in place, dialog defaults (Margins, Paper size,
 *   Scale) can override those rules. This script bypasses the dialog and
 *   renders deterministically against the page's own @media print + @page
 *   rules.
 *
 * Strategy:
 *   - Spin up a tiny static HTTP server rooted at the consumer repo so
 *     relative asset paths (presentation-assets/*, ../css/*, ../shared/*)
 *     resolve naturally.
 *   - Drive Playwright's Chromium at a 1440×810 CSS viewport (the deck's
 *     16:9 design canvas). The page's @media print CSS then scales each slide
 *     to fit @page { size: 11in 8.5in } US Letter landscape.
 *   - Emit a PDF with the CSS page size respected, zero margins, backgrounds on.
 *
 * Usage (run from the consumer repo root so cwd is the repo):
 *   node shared/scripts/export-pitch-pdf.mjs [--repo DIR] [--deck REL] [--out REL]
 *
 * Defaults: --repo <cwd>  --deck pages/pitch.html  --out pages/pitch.pdf
 *
 * Playwright resolution: `@playwright/test` is resolved from the consumer's
 * working directory (createRequire on cwd), because this file lives in the
 * symlinked shared/ mount whose realpath is the webtools-ui repo — which has
 * no node_modules of its own.
 */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") out.repo = argv[++i];
    else if (a === "--deck") out.deck = argv[++i];
    else if (a === "--out") out.out = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const REPO_ROOT = path.resolve(args.repo || process.cwd());
const DECK_REL = args.deck || "pages/pitch.html";
const OUT_PATH = path.resolve(REPO_ROOT, args.out || "pages/pitch.pdf");

// Resolve Playwright from the consumer repo (see header note). Prefer the
// test package, fall back to the base `playwright` package — both export
// `chromium`, and consumers vary in which one they install.
const require = createRequire(path.join(REPO_ROOT, "package.json"));
function loadChromium() {
  for (const spec of ["@playwright/test", "playwright"]) {
    try {
      const mod = require(spec);
      if (mod && mod.chromium) return mod.chromium;
    } catch (_) { /* try next */ }
  }
  throw new Error(
    "Playwright not found in the consumer repo. Install it with " +
    "`npm i -D @playwright/test` (or `playwright`) and `npx playwright install chromium`.",
  );
}
const chromium = loadChromium();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

// Exported for reuse by other shared tooling (e.g. demo smoke harnesses).
export function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost");
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith("/")) pathname += "index.html";
        const filePath = path.join(rootDir, pathname);
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403);
          return res.end("Forbidden");
        }
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          "Content-Type": MIME[ext] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(data);
      } catch (err) {
        res.writeHead(err.code === "ENOENT" ? 404 : 500);
        res.end(String(err.message || err));
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function main() {
  const t0 = Date.now();
  const { server, port } = await startStaticServer(REPO_ROOT);
  const url = `http://127.0.0.1:${port}/${DECK_REL}`;
  console.log(`[export-pitch-pdf] serving ${REPO_ROOT} on :${port}`);
  console.log(`[export-pitch-pdf] loading ${url}`);

  const browser = await chromium.launch();
  let exitCode = 0;
  try {
    // Match the deck's design canvas exactly. The page's runtime fitDeck()
    // sets transform: scale(1) when innerWidth/Height matches 1440×810, so
    // the render here is identical to a fresh viewport at 1440×810.
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 810 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    const consoleErrs = [];
    page.on("pageerror", (err) => consoleErrs.push(`pageerror: ${err.message}`));
    page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });

    await page.goto(url, { waitUntil: "networkidle" });

    const slideCount = await page.evaluate(() => document.querySelectorAll(".slide").length);
    if (!slideCount) throw new Error("No .slide elements found on the page");

    // Switch to print emulation so the @page rule and @media print branches engage.
    await page.emulateMedia({ media: "print" });

    // preferCSSPageSize honors the page's @page { size: 11in 8.5in } rule;
    // printBackground keeps the dark theme + branding intact regardless of the
    // user's "Background graphics" preference.
    await page.pdf({
      path: OUT_PATH,
      preferCSSPageSize: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const stat = await fs.stat(OUT_PATH);
    console.log(`[export-pitch-pdf] wrote ${OUT_PATH} (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${slideCount} slides) in ${Date.now() - t0}ms`);

    if (consoleErrs.length) {
      console.warn(`[export-pitch-pdf] page console errors: ${consoleErrs.length}`);
      consoleErrs.forEach((e) => console.warn(`  - ${e}`));
    }
  } catch (err) {
    console.error("[export-pitch-pdf] failed:", err);
    exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
  process.exit(exitCode);
}

main();
