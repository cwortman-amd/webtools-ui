/**
 * webtools-ui/tests/lib/consumer-matrix.mjs
 *
 * Loads and validates the cross-consumer Playwright matrix contract.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MATRIX_PATH = path.resolve(HERE, "../contracts/consumer-matrix.json");
const SHARED_ROOT = path.resolve(HERE, "../..");
const DEFAULT_WORKSPACE = path.resolve(SHARED_ROOT, "..");

/** @typedef {{ id: string, entryPath: string, shellNavSelector?: string, panelSelector?: string, portalViewAttr?: string, profileKey?: string, demoBannerKeys?: string[], userModeKey?: string, requiresPlaywright?: boolean }} ConsumerDef */

let cached = null;
let cachedEnv = null;

/**
 * @param {{ workspace?: string, envKey?: string }} [opts]
 * @returns {{ consumers: ConsumerDef[], iphoneDevices: object[], workspace: string }}
 */
export function loadConsumerMatrix(opts = {}) {
  const envFilter = opts.envKey ?? process.env.WEBTOOLS_UI_CONSUMERS ?? "";
  if (cached && !opts.workspace && cachedEnv === envFilter) return cached;

  const raw = JSON.parse(fs.readFileSync(MATRIX_PATH, "utf8"));
  const workspace = opts.workspace
    ?? (process.env.WORKSPACE
      ? path.resolve(process.env.WORKSPACE)
      : DEFAULT_WORKSPACE);

  let consumers = raw.consumers;
  if (envFilter) {
    const allow = new Set(
      envFilter.split(",").map((s) => s.trim()).filter(Boolean)
    );
    consumers = consumers.filter((c) => allow.has(c.id));
  }

  const matrix = {
    consumers,
    iphoneDevices: raw.iphoneDevices ?? [],
    workspace,
  };
  if (!opts.workspace) {
    cached = matrix;
    cachedEnv = envFilter;
  }
  return matrix;
}

/**
 * Resolve consumer defs that exist on disk with a reachable entry file.
 *
 * @param {{ workspace?: string, repoFilter?: string|null }} [opts]
 * @returns {Array<ConsumerDef & { repoPath: string, entryFile: string }>}
 */
export function resolveReachableConsumers(opts = {}) {
  const { consumers, workspace } = loadConsumerMatrix({ workspace: opts.workspace });
  const out = [];
  for (const def of consumers) {
    if (opts.repoFilter && def.id !== opts.repoFilter) continue;
    const repoPath = path.join(workspace, def.id);
    const entryFile = path.join(repoPath, def.entryPath.replace(/^\//, ""));
    if (!fs.existsSync(entryFile)) continue;
    out.push({ ...def, repoPath, entryFile });
  }
  return out;
}

export function matrixPath() {
  return MATRIX_PATH;
}
