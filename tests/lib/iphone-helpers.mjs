/**
 * webtools-ui/tests/lib/iphone-helpers.mjs
 *
 * iPhone emulation helpers — safe-area CDP overrides, coarse-pointer probes,
 * layout settle. Upstreamed from knowledge-exchange tests/ui/helpers.js.
 */

/** Documented iOS safe-area inset profiles paired with Playwright descriptors. */
export const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * @param {Record<string, import('@playwright/test').DeviceDescriptor>} devices
 * @param {Array<{ name: string, descriptor: string, insets: object }>} deviceCases
 */
export function validateDeviceCases(devices, deviceCases) {
  for (const c of deviceCases) {
    if (!devices[c.descriptor]) {
      throw new Error(
        `Playwright has no device descriptor "${c.descriptor}". ` +
          `Available iPhone descriptors: ${Object.keys(devices)
            .filter((k) => k.startsWith("iPhone"))
            .join(", ")}`
      );
    }
  }
}

/**
 * Pushes real safe-area insets into Blink so env(safe-area-inset-*) resolves.
 *
 * @param {import('@playwright/test').CDPSession} cdp
 * @param {{ top?: number, right?: number, bottom?: number, left?: number }} insets
 */
export async function applyInsets(cdp, insets) {
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
}

/** Waits for layout/paint to quiesce after navigation or interaction. */
export async function settle(page, frames = 3, extraMs = 450) {
  await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let left = n;
        const tick = () => (left-- <= 0 ? resolve() : requestAnimationFrame(tick));
        tick();
      }),
    frames
  );
  await page.waitForTimeout(extraMs);
}

/**
 * Opens a page under full iPhone emulation with safe-area overrides.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').DeviceDescriptor} deviceDescriptor
 * @param {{ top?: number, right?: number, bottom?: number, left?: number }} insets
 * @param {string} url full URL
 * @param {{ seedLocalStorage?: Record<string, unknown> }} [opts]
 */
export async function openPortalPage(browser, deviceDescriptor, insets, url, opts = {}) {
  const context = await browser.newContext({ ...deviceDescriptor });
  const page = await context.newPage();

  if (opts.seedLocalStorage) {
    await page.addInitScript((entries) => {
      for (const [k, v] of Object.entries(entries)) {
        try {
          window.localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        } catch {
          /* storage disabled */
        }
      }
    }, opts.seedLocalStorage);
  }

  const cdp = await context.newCDPSession(page);
  await applyInsets(cdp, insets);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await applyInsets(cdp, insets);
  await settle(page);

  return { context, page, cdp };
}

/**
 * Lightweight expect shim for standalone runners (no @playwright/test import).
 */
function makeExpect() {
  return {
    toBe(value) {
      return {
        message: () => `expected ${value}`,
        pass: (actual) => actual === value,
      };
    },
  };
}

/**
 * Proves the coarse-pointer touch block in shared/css/base.css is live.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} label
 * @param {typeof import('@playwright/test').expect} [expect]
 */
export async function assertCoarsePointerBlockIsLive(page, label, expect = null) {
  const probe = await page.evaluate(() => {
    const el = document.createElement("input");
    el.type = "text";
    el.style.cssText = "font-size:9px;position:absolute;left:-9999px;top:0";
    document.body.appendChild(el);
    const computed = getComputedStyle(el).fontSize;
    el.remove();
    return {
      coarseAndNoHover: window.matchMedia("(hover: none) and (pointer: coarse)").matches,
      probeFontSize: computed,
    };
  });

  const assertEq = (actual, expected, msg) => {
    if (expect) {
      expect(actual, msg).toBe(expected);
      return;
    }
    if (actual !== expected) throw new Error(msg);
  };

  assertEq(
    probe.coarseAndNoHover,
    true,
    `[${label}] "(hover: none) and (pointer: coarse)" did not match — touch block not exercised`
  );
  assertEq(
    probe.probeFontSize,
    "16px",
    `[${label}] probe input computed ${probe.probeFontSize}, not 16px — touch block not live`
  );
  return probe;
}

/** Compact element label for assertion messages. */
export function describeEl(el) {
  const cls = el.className ? "." + String(el.className).trim().split(/\s+/).join(".") : "";
  return `${el.tag}${el.id ? "#" + el.id : ""}${cls}`;
}

/** Default expect for standalone callers. */
export const standaloneExpect = makeExpect();
