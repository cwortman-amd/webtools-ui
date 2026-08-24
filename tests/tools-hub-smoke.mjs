#!/usr/bin/env node
/**
 * Tools Hub E2E smoke — platform landing page (not a shell consumer).
 *
 *   node tests/tools-hub-smoke.mjs
 *
 * Anchor: suite-registry-load
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPlaywright, loadStaticServerHelper } from "./lib/playwright-resolve.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const { chromium } = await loadPlaywright();
  const { startStaticServer } = await loadStaticServerHelper();
  const { server, port } = await startStaticServer(root);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const registryHits = [];
    page.on("request", (req) => {
      if (req.method() === "GET" && req.url().includes("/plugins.registry.json")) {
        registryHits.push(req.url());
      }
    });
    await page.goto(`http://127.0.0.1:${port}/pages/index.html`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("#suite-grid .suite-tool-card", { timeout: 15_000 });
    const cards = await page.locator("#suite-grid .suite-tool-card").count();
    if (cards < 6) {
      throw new Error(`expected at least 6 tool cards, got ${cards}`);
    }
    if (registryHits.length === 0) {
      throw new Error("expected GET /plugins.registry.json while Tools Hub booted");
    }
    console.log(`PASS tools-hub smoke (${cards} cards)`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error("FAIL tools-hub smoke:", err.message || err);
  process.exit(1);
});
