/*!
 * webtools-ui/js/mobile-drawer.js
 *
 * Canonical off-canvas drawer wiring (Phase 9.8e P2, 2026-05-05).
 *
 * Replaces ~30 lines of nearly-identical IIFE that previously lived in
 * each sibling consumer's `pages/index.html`:
 *   - llm-benchmark   (lines 819-869 of index.html, pre-promotion)
 *   - cluster-manager (lines 1020-1061 of index.html, pre-promotion)
 *   - dc-planner      (lines ~16000-16040 of index.html, pre-promotion)
 *
 * Behavior (canonical, identical across all 3 consumers):
 *   - Tapping the hamburger toggles `body.nav-mobile-open`
 *   - Tapping the backdrop closes the drawer
 *   - `Esc` key closes the drawer when open
 *   - Resizing above the mobile breakpoint closes the drawer
 *   - Tapping any matching nav-item inside the drawer closes the drawer
 *   - `aria-expanded` on the menu button + `aria-hidden` on the drawer
 *     are kept in sync with the open state
 *
 * Per-repo divergence is exposed as config (no fork-of-canonical needed):
 *   - `closeOnTap`: list of selectors inside the drawer that should
 *     close it on tap (e.g. nav buttons / brand link). Selectors
 *     differ because the drawer-container markup differs:
 *       - `.sidebar` shells use `.nav-btn` / `.util-btn`
 *       - `.side-nav` shells use `.side-nav-tab` / `.side-nav-header`
 *   - `onOpen` / `onClose` hooks fire after the open/close — used by
 *     consumers that need to switch layout class (e.g. `nav-side`)
 *     when opening the drawer from a non-side-nav layout, or by
 *     llm-benchmark to remember + revert that switch on close via a
 *     `nav-mobile-temp` flag.
 *   - `mobileMQ`: the breakpoint media query (defaults to the canonical
 *     `(max-width: 640px)`)
 *
 * Usage:
 *
 *   <script src="../shared/js/mobile-drawer.js" defer></script>
 *   <script>
 *     window.addEventListener("DOMContentLoaded", function () {
 *       MobileDrawer.install({
 *         menuBtn:    "navMobileMenuBtn",
 *         backdrop:   "navBackdrop",
 *         drawer:     "sideNavDrawer",
 *         closeOnTap: [".nav-btn", ".util-btn"],
 *         onOpen:     function () {
 *           if (!document.body.classList.contains("nav-side")) {
 *             setLayout("side");
 *           }
 *         },
 *       });
 *     });
 *   </script>
 *
 * Returns a small handle exposing `{ open(), close(), isOpen() }` so
 * consumers can drive the drawer programmatically (e.g. a nested
 * component asking the shell to show the nav) without re-implementing
 * the toggle logic.
 */

(function (global) {
  "use strict";

  var INSTALLED = typeof WeakSet !== "undefined" ? new WeakSet() : null;

  function resolveEl(ref) {
    if (!ref) return null;
    if (typeof ref === "string") return document.getElementById(ref);
    if (ref.nodeType === 1) return ref;
    return null;
  }

  function install(cfg) {
    cfg = cfg || {};
    var menuBtn = resolveEl(cfg.menuBtn);
    var backdrop = resolveEl(cfg.backdrop);
    var drawer = resolveEl(cfg.drawer);
    if (!menuBtn || !backdrop || !drawer) {
      return null;
    }
    if (INSTALLED && INSTALLED.has(menuBtn)) {
      return null;
    }
    if (INSTALLED) INSTALLED.add(menuBtn);

    var mobileMQ = cfg.mobileMQ || "(max-width: 640px)";
    var closeOnTap = Array.isArray(cfg.closeOnTap) ? cfg.closeOnTap.slice() : [];
    var onOpen = typeof cfg.onOpen === "function" ? cfg.onOpen : null;
    var onClose = typeof cfg.onClose === "function" ? cfg.onClose : null;

    function isMobile() {
      return global.matchMedia(mobileMQ).matches;
    }

    function isOpen() {
      return document.body.classList.contains("nav-mobile-open");
    }

    function setOpen(open) {
      var nextOpen = !!open;
      if (nextOpen === isOpen()) return;
      document.body.classList.toggle("nav-mobile-open", nextOpen);
      menuBtn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      drawer.setAttribute("aria-hidden", nextOpen ? "false" : "true");
      if (nextOpen && onOpen) {
        try { onOpen(); } catch (e) { /* host hook errors should not break the drawer */ }
      } else if (!nextOpen && onClose) {
        try { onClose(); } catch (e) { /* see above */ }
      }
    }

    menuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!isOpen());
    });

    backdrop.addEventListener("click", function () {
      setOpen(false);
    });

    if (closeOnTap.length) {
      var sel = closeOnTap.join(",");
      drawer.addEventListener("click", function (e) {
        if (!isMobile()) return;
        if (e.target && e.target.closest && e.target.closest(sel)) {
          setTimeout(function () { setOpen(false); }, 80);
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) {
        setOpen(false);
      }
    });

    global.addEventListener("resize", function () {
      if (!isMobile() && isOpen()) {
        setOpen(false);
      }
    });

    return {
      open: function () { setOpen(true); },
      close: function () { setOpen(false); },
      isOpen: isOpen
    };
  }

  global.MobileDrawer = {
    install: install
  };
})(typeof window !== "undefined" ? window : this);
