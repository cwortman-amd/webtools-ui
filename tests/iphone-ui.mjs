#!/usr/bin/env node
/**
 * webtools-ui/tests/iphone-ui.mjs
 *
 * Live iPhone validation for the shared UI. Loads each consumer's real
 * pages under Playwright's iPhone device profiles and asserts the things
 * that actually break on a phone and are invisible on a desktop browser.
 *
 *   node tests/iphone-ui.mjs                 # full matrix
 *   node tests/iphone-ui.mjs --repo dc-planner
 *   node tests/iphone-ui.mjs --device "iPhone SE"
 *   node tests/iphone-ui.mjs --json
 *
 * Exit codes: 0 all passed · 1 one or more failures · 2 could not run.
 *
 * Playwright is not vendored here (this repo ships no package.json), so it
 * is resolved from whichever sibling consumer has it installed. If none
 * does, the suite exits 2 rather than reporting a false pass.
 *
 * Safe-area insets. Headless Chromium resolves env(safe-area-inset-*) to 0
 * unless overridden via CDP. This runner applies matrix insets through
 * tests/lib/iphone-helpers.mjs (applyInsets). Whether stylesheets reference
 * those insets is still enforced statically by check_ios_safe_area() in
 * scripts/html_consistency_audit.py — the two checks complement each other.
 */

import path from "node:path";
import fs from "node:fs";
import { loadPlaywright, loadStaticServerHelper } from "./lib/playwright-resolve.mjs";
import { loadConsumerMatrix } from "./lib/consumer-matrix.mjs";
import {
  applyInsets,
  assertCoarsePointerBlockIsLive,
  settle,
  validateDeviceCases,
} from "./lib/iphone-helpers.mjs";

// Device spread from consumer-matrix.json — override via --device (name).
const { iphoneDevices: DEVICE_CASES, workspace: WORKSPACE } = loadConsumerMatrix();

// Apple's Human Interface Guidelines put the comfortable tap target at
// 44x44pt. base.css deliberately settles on 40px instead — see the
// "Touch ergonomics" block there, which trades the last 4px for toolbar
// density and matches the floor the <=640px layout block already used.
//
// The check honours that decision rather than overriding it: falling below
// 40px means a rule has defeated the shared floor and is a failure, while
// 40-43px is the documented compromise and is reported without failing.
// Asserting a flat 44 would have flagged every consumer on every device and
// taught everyone to ignore the check.
const TAP_FLOOR_PX = 40;
const TAP_HIG_PX = 44;

// ── Playwright resolution ────────────────────────────────────────────────
// (see tests/lib/playwright-resolve.mjs)

// ── Result plumbing ──────────────────────────────────────────────────────

const results = [];
let currentScope = "";

function record(status, name, detail) {
  results.push({ scope: currentScope, status, name, detail });
}
const pass = (name, detail) => record("PASS", name, detail);
const fail = (name, detail) => record("FAIL", name, detail);
const skip = (name, detail) => record("SKIP", name, detail);

// ── Checks ───────────────────────────────────────────────────────────────

/**
 * Horizontal overflow. The single most common phone-layout defect: one
 * over-wide element makes the whole document pan sideways, and every
 * fixed-position overlay then sits misaligned. A few px of slack absorbs
 * sub-pixel rounding in the emulated device scale factor.
 */
async function checkNoHorizontalOverflow(page, viewport) {
  const r = await page.evaluate((limit) => {
    const de = document.documentElement;
    const over = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      // Fixed/absolute overlays parked off-screen are a normal idle state.
      if (cs.position === "fixed" || cs.position === "absolute") {
        if (cs.opacity === "0" || cs.pointerEvents === "none") continue;
      }
      if (rect.right > limit + 2) {
        over.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && el.className.toString().slice(0, 40)) || "",
          right: Math.round(rect.right),
        });
      }
    }
    return { scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, over: over.slice(0, 5) };
  }, viewport.width);

  const docPans = r.scrollWidth > r.clientWidth + 2;
  if (!docPans && r.over.length === 0) {
    pass("no horizontal overflow", `scrollWidth=${r.scrollWidth} <= ${r.clientWidth}`);
    return;
  }
  const worst = r.over.map((o) => `${o.tag}.${o.cls}@${o.right}px`).join(", ");
  fail(
    "no horizontal overflow",
    `scrollWidth=${r.scrollWidth} vs clientWidth=${r.clientWidth}` +
      (worst ? ` · widest: ${worst}` : "")
  );
}

/**
 * Tap-target sizing against the 44x44 HIG minimum. Scoped to controls that
 * are actually visible and hit-testable, since off-screen drawer contents
 * and collapsed menus legitimately measure zero.
 */
async function checkTapTargets(page) {
  const measured = await page.evaluate((min) => {
    const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [tabindex]:not([tabindex="-1"])';
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;
      if (cs.pointerEvents === "none") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // Off-screen (drawer closed, panel parked) — not currently tappable.
      if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
      // Inline links inside running prose are not tap targets in the HIG sense.
      if (el.tagName === "A" && cs.display.startsWith("inline") && el.closest("p, li, td, .ai-msg")) continue;
      if (r.width < min || r.height < min) {
        out.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || "",
          cls: (el.className && el.className.toString().slice(0, 36)) || "",
          w: Math.round(r.width), h: Math.round(r.height),
        });
      }
    }
    return out;
  }, TAP_HIG_PX);

  const label = (s) => `${s.tag}${s.id ? "#" + s.id : "." + s.cls}(${s.w}x${s.h})`;
  const belowFloor = measured.filter((s) => s.w < TAP_FLOOR_PX || s.h < TAP_FLOOR_PX);
  const betweenFloorAndHig = measured.filter((s) => !(s.w < TAP_FLOOR_PX || s.h < TAP_FLOOR_PX));

  belowFloor.length === 0
    ? pass(`tap targets >= ${TAP_FLOOR_PX}px floor`)
    : fail(
        `tap targets >= ${TAP_FLOOR_PX}px floor`,
        `${belowFloor.length} below the shared touch floor · ${belowFloor.slice(0, 6).map(label).join(", ")}`
      );

  if (betweenFloorAndHig.length) {
    skip(
      `tap targets >= ${TAP_HIG_PX}px (HIG)`,
      `${betweenFloorAndHig.length} at the documented ${TAP_FLOOR_PX}px compromise · ${betweenFloorAndHig.slice(0, 4).map(label).join(", ")}`
    );
  } else {
    pass(`tap targets >= ${TAP_HIG_PX}px (HIG)`);
  }
}

/**
 * The viewport meta must opt into the full screen with viewport-fit=cover,
 * and must not disable pinch-zoom. user-scalable=no / maximum-scale=1 is an
 * accessibility failure for low-vision users; iOS has ignored it since 10,
 * so it buys nothing and signals intent to break zoom.
 */
async function checkViewportMeta(page) {
  const content = await page.evaluate(() => {
    const m = document.querySelector('meta[name="viewport"]');
    return m ? m.getAttribute("content") || "" : null;
  });
  if (content === null) { fail("viewport meta present"); return; }
  pass("viewport meta present");

  if (/viewport-fit\s*=\s*cover/.test(content)) pass("viewport-fit=cover");
  else fail("viewport-fit=cover", `content="${content}"`);

  if (/user-scalable\s*=\s*no/.test(content) || /maximum-scale\s*=\s*1(\.0)?\b/.test(content)) {
    fail("pinch-zoom not disabled", `content="${content}"`);
  } else {
    pass("pinch-zoom not disabled");
  }
}

/**
 * iOS inflates font sizes in landscape unless text-size-adjust is pinned.
 * The effect is that a layout tuned in portrait silently reflows on
 * rotation, which is exactly the case a desktop browser never shows.
 */
async function checkTextSizeAdjust(page) {
  const v = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return cs.webkitTextSizeAdjust || cs.textSizeAdjust || "";
  });
  if (/100%|none/.test(v)) pass("text-size-adjust pinned", v);
  else fail("text-size-adjust pinned", `resolved to "${v || "(unset)"}"`);
}

/**
 * The chat orb panel is the one shared surface on every consumer, and it is
 * fixed-position, so it is the most likely thing to end up off-screen or
 * under the home indicator on a narrow viewport.
 *
 * The panel is opened through ChatOrb.open() rather than by tapping a
 * launcher, because the launcher is deliberately not the same everywhere:
 * dc-planner hides the floating .ai-orb button in its own stylesheet and
 * opens the panel from a sidebar utility button instead. Driving the public
 * API keeps this check about whether the panel fits, which is shared, and
 * not about how it is opened, which is not.
 */
async function checkChatOrbFits(page, viewport) {
  const state = await page.evaluate(() => {
    const orb = document.querySelector(".ai-orb");
    if (!orb) return { present: false };
    const cs = getComputedStyle(orb);
    const r = orb.getBoundingClientRect();
    return {
      present: true,
      visible: cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0",
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
    };
  });

  if (!state.present) {
    skip("chat orb button", "no .ai-orb in the DOM");
  } else if (!state.visible) {
    // A consumer may route the panel through its own launcher; that is a
    // product decision, not a phone-layout defect.
    skip("chat orb button", "hidden by this consumer (custom launcher)");
  } else {
    const { x, y, w, h } = state.rect;
    const inside = x >= -1 && y >= -1 && x + w <= viewport.width + 1 && y + h <= viewport.height + 1;
    inside
      ? pass("chat orb button within viewport")
      : fail("chat orb button within viewport", `at (${Math.round(x)},${Math.round(y)}) ${Math.round(w)}x${Math.round(h)} in ${viewport.width}x${viewport.height}`);

    (w >= TAP_FLOOR_PX && h >= TAP_FLOOR_PX)
      ? pass(`chat orb button >= ${TAP_FLOOR_PX}px`)
      : fail(`chat orb button >= ${TAP_FLOOR_PX}px`, `${Math.round(w)}x${Math.round(h)}`);
  }

  const opened = await page.evaluate(() => {
    if (!window.ChatOrb || typeof window.ChatOrb.open !== "function") return "no-api";
    try { window.ChatOrb.open(); return "ok"; } catch (e) { return "threw: " + e.message; }
  });
  if (opened !== "ok") { skip("chat orb panel fits viewport", `ChatOrb.open() unavailable (${opened})`); return; }
  await page.waitForTimeout(600);

  const panel = await page.evaluate((vp) => {
    const p = document.querySelector(".ai-panel");
    if (!p) return null;
    const cs = getComputedStyle(p);
    if (cs.opacity === "0" || cs.display === "none" || cs.visibility === "hidden") return { open: false };
    const r = p.getBoundingClientRect();
    return {
      open: true,
      overflowsLeft: r.left < -1,
      overflowsRight: r.right > vp.width + 1,
      overflowsBottom: r.bottom > vp.height + 1,
      overflowsTop: r.top < -1,
      rect: { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) },
    };
  }, viewport);

  if (!panel) { skip("chat orb panel fits viewport", "no .ai-panel in the DOM"); return; }
  if (!panel.open) { skip("chat orb panel fits viewport", "panel stayed closed after ChatOrb.open()"); return; }

  const bad = ["overflowsLeft", "overflowsRight", "overflowsTop", "overflowsBottom"].filter((k) => panel[k]);
  bad.length === 0
    ? pass("chat orb panel fits viewport", `rect=${JSON.stringify(panel.rect)}`)
    : fail("chat orb panel fits viewport", `${bad.join(", ")} · rect=${JSON.stringify(panel.rect)} viewport=${viewport.width}x${viewport.height}`);
}

/**
 * The keyboard-inset custom property must exist and parse as a length.
 * chat-orb.css translates the panel by it, and an unset or malformed value
 * makes that transform collapse to no lift at all — the panel then sits
 * behind the software keyboard, which is the defect the property exists to
 * prevent. The keyboard itself cannot be raised headlessly, so this asserts
 * the plumbing rather than the lift.
 */
async function checkKeyboardInsetPlumbing(page) {
  const v = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--ai-kb-inset").trim()
  );
  if (!v) { skip("--ai-kb-inset published", "property unset (chat orb may not be mounted)"); return; }
  /^-?\d+(\.\d+)?px$/.test(v)
    ? pass("--ai-kb-inset published", v)
    : fail("--ai-kb-inset published", `unparseable: "${v}"`);
}

// ── Runner ───────────────────────────────────────────────────────────────

async function runMatrix({ chromium, devices, repos, deviceCases, startStaticServer }) {
  const browser = await chromium.launch();

  for (const repo of repos) {
    const repoPath = path.join(WORKSPACE, repo);
    const def = loadConsumerMatrix().consumers.find((c) => c.id === repo);
    const entryRel = def?.entryPath ?? "/pages/index.html";
    const indexPath = path.join(repoPath, entryRel.replace(/^\//, ""));
    if (!fs.existsSync(indexPath)) {
      currentScope = `${repo}`;
      skip("repo reachable", `no pages/index.html at ${repoPath}`);
      continue;
    }

    const { server, port } = await startStaticServer(repoPath);
    try {
      for (const deviceCase of deviceCases) {
        const { name: deviceName, descriptor, insets } = deviceCase;
        const device = devices[descriptor];
        currentScope = `${repo} · ${deviceName}`;
        if (!device) { skip("device profile known", deviceName); continue; }

        const context = await browser.newContext({ ...device });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        try {
          await applyInsets(cdp, insets);
          await page.goto(`http://127.0.0.1:${port}${entryRel}`, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await applyInsets(cdp, insets);
          await settle(page);

          const viewport = page.viewportSize();
          await checkViewportMeta(page);
          await checkTextSizeAdjust(page);
          await checkNoHorizontalOverflow(page, viewport);
          await checkTapTargets(page);
          await checkKeyboardInsetPlumbing(page);
          await checkChatOrbFits(page, viewport);

          // Coarse-pointer touch block — required on iPhone SE; run on all profiles.
          try {
            await assertCoarsePointerBlockIsLive(page, currentScope);
            pass("coarse-pointer touch block live");
          } catch (err) {
            fail(
              "coarse-pointer touch block live",
              String(err && err.message ? err.message : err).slice(0, 160)
            );
          }
        } catch (err) {
          fail("page loaded", String(err && err.message ? err.message : err).slice(0, 160));
        } finally {
          await context.close();
        }
      }
    } finally {
      server.close();
    }
  }

  await browser.close();
}

// ── Entry ────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const arg = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
  };
  const asJson = argv.includes("--json");

  const pw = loadPlaywright();
  if (!pw) {
    const ids = loadConsumerMatrix().consumers.map((c) => c.id);
    console.error("iphone-ui: @playwright/test not resolvable from any sibling consumer.");
    console.error("  Install it in one of: " + ids.join(", "));
    process.exit(2);
  }

  const { startStaticServer } = await loadStaticServerHelper();

  validateDeviceCases(pw.devices, DEVICE_CASES);

  const repoArg = arg("--repo");
  const deviceArg = arg("--device");
  const defaultRepos = loadConsumerMatrix().consumers.map((c) => c.id);
  const repos = repoArg ? [repoArg] : defaultRepos;
  const deviceCases = deviceArg
    ? DEVICE_CASES.filter((d) => d.name === deviceArg)
    : DEVICE_CASES;
  if (deviceArg && deviceCases.length === 0) {
    console.error(
      `iphone-ui: unknown device "${deviceArg}". ` +
        `Known: ${DEVICE_CASES.map((d) => d.name).join(", ")}`
    );
    process.exit(2);
  }

  await runMatrix({ chromium: pw.chromium, devices: pw.devices, repos, deviceCases, startStaticServer });

  const failed = results.filter((r) => r.status === "FAIL");
  const passed = results.filter((r) => r.status === "PASS");
  const skipped = results.filter((r) => r.status === "SKIP");

  if (asJson) {
    console.log(JSON.stringify({
      total: results.length, passed: passed.length,
      failed: failed.length, skipped: skipped.length, results,
    }, null, 2));
  } else {
    let scope = null;
    for (const r of results) {
      if (r.scope !== scope) { scope = r.scope; console.log(`\n  ── ${scope} ──`); }
      const mark = r.status === "PASS" ? "\x1b[92mPASS\x1b[0m"
                 : r.status === "FAIL" ? "\x1b[91mFAIL\x1b[0m"
                 : "\x1b[2mSKIP\x1b[0m";
      console.log(`    ${mark}  ${r.name}${r.detail ? `  \x1b[2m${r.detail}\x1b[0m` : ""}`);
    }
    console.log(`\n  ${passed.length} passed · ${failed.length} failed · ${skipped.length} skipped`);
    if (failed.length) {
      console.log("\n  Failures:");
      for (const f of failed) console.log(`    [${f.scope}] ${f.name} — ${f.detail || ""}`);
    }
  }

  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("iphone-ui: unexpected error:", err);
  process.exit(2);
});
