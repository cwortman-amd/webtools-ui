/**
 * webtools-ui/tests/lib/playwright-resolve.mjs
 *
 * Resolve @playwright/test and the static server helper from sibling consumers.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConsumerMatrix } from "./consumer-matrix.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHARED = path.resolve(HERE, "../..");

/**
 * @param {string} [workspace]
 * @returns {import('@playwright/test') | null}
 */
export function loadPlaywright(workspace) {
  const { consumers, workspace: ws } = loadConsumerMatrix({ workspace });
  for (const def of consumers) {
    const candidates = [
      path.join(ws, def.id, "package.json"),
      path.join(ws, def.id, "tests", "ui", "package.json"),
    ];
    for (const pkg of candidates) {
      if (!fs.existsSync(pkg)) continue;
      try {
        return createRequire(pkg)("@playwright/test");
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

/**
 * @returns {Promise<{ startStaticServer: (rootDir: string) => Promise<{ server: import('http').Server, port: number }> }>}
 */
export async function loadStaticServerHelper() {
  const mod = await import(path.join(SHARED, "scripts", "export-pitch-pdf.mjs"));
  if (typeof mod.startStaticServer !== "function") {
    throw new Error("export-pitch-pdf.mjs did not export startStaticServer");
  }
  return mod;
}

export function sharedRoot() {
  return SHARED;
}
