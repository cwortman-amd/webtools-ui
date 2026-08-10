/**
 * webtools-ui/tests/lib/shell-visual-contract.mjs
 *
 * Cross-consumer Playwright helpers for shell button/chip visual contracts:
 * accent-filled controls must use --ui-accent-contrast (or an override) and
 * meet a minimum WCAG contrast ratio against their computed fill.
 *
 * Consumers register tiers in a local spec or JSON contract; see
 * tests/BUTTON-VISUAL-CONTRACT.md.
 */

/** WCAG 2.x relative luminance contrast ratio. */
export function contrastRatio(fgRgb, bgRgb) {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(fgRgb);
  const l2 = lum(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Parse `rgb(r, g, b)` / `rgba(r, g, b, a)` from getComputedStyle(). */
export function parseCssRgb(cssColor) {
  const m = String(cssColor).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Resolve a CSS custom property on :root (computed).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} varName e.g. "--ui-accent-contrast"
 */
export async function readCssVar(page, varName) {
  return page.evaluate((name) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, varName);
}

/** Resolve any CSS color to rgb() via a probe element (handles color-mix, oklab, etc.). */
export async function resolveTokenColor(page, cssValue) {
  return page.evaluate((value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, cssValue);
}

/**
 * Evaluate all tiers in the browser where modern color() values resolve cleanly.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Array<object>} tiers
 */
export async function evaluateButtonVisualContract(page, tiers) {
  return page.evaluate((tierList) => {
    function parseRgb(cssColor) {
      const m = String(cssColor).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    }

    function resolveColor(value) {
      const probe = document.createElement("span");
      probe.style.color = value;
      document.body.appendChild(probe);
      const rgb = getComputedStyle(probe).color;
      probe.remove();
      return rgb;
    }

    function contrast(fg, bg) {
      const lum = (rgb) => {
        const [r, g, b] = rgb.map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const l1 = lum(fg);
      const l2 = lum(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    const root = getComputedStyle(document.documentElement);
    const accentContrastRaw = root.getPropertyValue("--ui-accent-contrast").trim() || "#ffffff";
    const accentContrast = resolveColor(accentContrastRaw);
    const headerColor = resolveColor(root.getPropertyValue("--ui-header").trim() || "var(--ui-header)");

    const violations = [];

    for (const tier of tierList) {
      const minContrast = tier.minContrast ?? 4.5;
      const requireToken = tier.requireAccentContrastToken !== false;
      const el = document.querySelector(tier.selector);
      if (!el) {
        if (!tier.optional) {
          violations.push({ role: tier.role, selector: tier.selector, reason: "not found" });
        }
        continue;
      }

      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        cs.display !== "none" &&
        cs.visibility !== "hidden" &&
        Number(cs.opacity || "1") > 0.05;

      if (!visible) {
        if (!tier.optional) {
          violations.push({ role: tier.role, selector: tier.selector, reason: "not visible" });
        }
        continue;
      }

      const fg = parseRgb(cs.color);
      const bg = parseRgb(cs.backgroundColor);

      if (tier.role.includes("accent")) {
        if (requireToken && cs.color !== accentContrast) {
          violations.push({
            role: tier.role,
            selector: tier.selector,
            reason: `color ${cs.color} !== --ui-accent-contrast (${accentContrast})`,
            text: (el.textContent || "").trim().slice(0, 48),
          });
        }
        if (fg && bg) {
          const ratio = contrast(fg, bg);
          if (ratio < minContrast) {
            violations.push({
              role: tier.role,
              selector: tier.selector,
              reason: `contrast ${ratio.toFixed(2)} < ${minContrast}`,
              color: cs.color,
              backgroundColor: cs.backgroundColor,
              text: (el.textContent || "").trim().slice(0, 48),
            });
          }
        }
        continue;
      }

      // Soft-surface tiers: only fail when the fill is a solid accent (mis-tiered primary).
      if (tier.role === "chip-selected" || tier.role === "nav-active") {
        const accentFill = resolveColor(root.getPropertyValue("--ui-accent").trim() || "var(--ui-accent)");
        if (parseRgb(cs.backgroundColor) && cs.backgroundColor === accentFill && cs.color !== accentContrast) {
          violations.push({
            role: tier.role,
            selector: tier.selector,
            reason: `accent fill ${cs.backgroundColor} without accent-contrast text`,
          });
        }
        continue;
      }

      // Optional explicit header token check (strict consumers only).
      if (tier.expectColorToken === "ui-header" && cs.color !== headerColor) {
        violations.push({
          role: tier.role,
          selector: tier.selector,
          reason: `color ${cs.color} !== --ui-header (${headerColor})`,
        });
      } else if (fg && bg && !tier.skipContrast) {
        const ratio = contrast(fg, bg);
        if (ratio < minContrast) {
          violations.push({
            role: tier.role,
            selector: tier.selector,
            reason: `contrast ${ratio.toFixed(2)} < ${minContrast}`,
            color: cs.color,
            backgroundColor: cs.backgroundColor,
          });
        }
      }
    }

    return violations;
  }, tiers);
}

/**
 * Assert every tier on the page meets contrast + optional token contract.
 *
 * @typedef {Object} ButtonVisualTier
 * @property {string} role human label (primary-accent, secondary, chip-selected, nav-active, …)
 * @property {string} selector CSS selector for one representative control
 * @property {number} [minContrast=4.5] WCAG AA for normal text; use 3 for large/bold CTAs
 * @property {boolean} [requireAccentContrastToken=true] when fill is accent-like, color must match --ui-accent-contrast
 * @property {boolean} [optional=false] skip when selector not found / not visible
 * @property {"ui-header"} [expectColorToken] for soft-surface tiers
 * @property {boolean} [skipContrast=false] skip ratio check (translucent surfaces)
 *
 * @param {import('@playwright/test').Page} page
 * @param {ButtonVisualTier[]} tiers
 * @param {typeof import('@playwright/test').expect} expect
 */
export async function assertButtonVisualContract(page, tiers, expect) {
  const violations = await evaluateButtonVisualContract(page, tiers);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

/** Default shell tiers — consumers extend or replace. */
export const DEFAULT_SHELL_BUTTON_TIERS = [
  {
    role: "primary-accent",
    selector: ".util-btn-agent",
    minContrast: 3,
  },
  {
    role: "nav-active",
    selector: ".sidebar-nav .nav-btn.active",
    skipContrast: true,
    requireAccentContrastToken: false,
  },
  {
    role: "chip-selected",
    selector: '.chip[aria-checked="true"]',
    skipContrast: true,
    requireAccentContrastToken: false,
    optional: true,
  },
];
