/*!
 * webtools-ui canonical asset: context-menu.js
 *
 * IIFE wrapper for script-tag consumers. ES module consumers should import
 * `context-menu.mjs` directly.
 */
(function () {
  "use strict";

  if (window.__wtContextMenuLoaded) return;
  window.__wtContextMenuLoaded = true;

  var MENU_CLASS = "wt-context-menu";

  function positionContextMenu(el, clientX, clientY, pad) {
    if (!el) return;
    var padding = pad == null ? 4 : pad;
    el.style.left = "0px";
    el.style.top = "0px";
    var rect = el.getBoundingClientRect();
    var left = clientX;
    var top = clientY;
    if (left + rect.width > window.innerWidth - padding) {
      left = clientX - rect.width;
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = clientY - rect.height;
    }
    el.style.left = Math.max(padding, left) + "px";
    el.style.top = Math.max(padding, top) + "px";
  }

  function createContextMenu(options) {
    var renderHtml = (options && options.renderHtml) || function () { return ""; };
    var onAction = (options && options.onAction) || function () {};
    var menuEl = null;
    var target = null;
    var listenersBound = false;

    function onMenuClick(ev) {
      var btn = ev.target.closest("[data-action]");
      if (!btn || btn.disabled || !target) return;
      ev.preventDefault();
      onAction(btn.getAttribute("data-action"), target);
      hide();
    }

    function bindGlobalListeners() {
      if (listenersBound) return;
      listenersBound = true;
      document.addEventListener(
        "pointerdown",
        function (ev) {
          if (!menuEl) return;
          if (menuEl.contains(ev.target)) return;
          hide();
        },
        true,
      );
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") hide();
      });
    }

    function show(clientX, clientY, ctx, menuOptions) {
      hide();
      target = ctx || null;
      bindGlobalListeners();
      var wrap = document.createElement("div");
      wrap.innerHTML = renderHtml(menuOptions || {}, target);
      menuEl = wrap.firstElementChild;
      if (!menuEl) return;
      document.body.appendChild(menuEl);
      menuEl.addEventListener("click", onMenuClick);
      positionContextMenu(menuEl, clientX, clientY);
    }

    function hide() {
      if (menuEl) {
        menuEl.removeEventListener("click", onMenuClick);
        menuEl.remove();
        menuEl = null;
      }
      target = null;
    }

    function destroy() {
      hide();
      listenersBound = false;
    }

    return { show: show, hide: hide, destroy: destroy, position: positionContextMenu };
  }

  function createAnchoredMenu(options) {
    var opts = options || {};
    var persistentMenu = opts.menuEl || null;
    var triggerEl = opts.triggerEl || null;
    var extraTriggers = opts.extraTriggers || [];
    var onSelect = opts.onSelect || function () {};
    var itemSelector = opts.itemSelector || ".wt-context-menu-item";
    var positionMode = opts.position || (persistentMenu ? "css" : "anchor");
    var closeOnSelect = opts.closeOnSelect !== false;
    var onToggle = opts.onToggle || function () {};
    var menuEl = persistentMenu;
    var open = false;
    var listenersBound = false;

    function triggerList() {
      return [triggerEl].concat(extraTriggers).filter(Boolean);
    }

    function isTriggerTarget(node) {
      return triggerList().some(function (el) {
        return el === node || (el.contains && el.contains(node));
      });
    }

    function bindMenuClicks(el) {
      if (!el || el.__wtAnchoredBound) return;
      el.__wtAnchoredBound = true;
      el.addEventListener("click", function (ev) {
        var item = ev.target.closest(itemSelector);
        if (!item || item.disabled) return;
        if (item.tagName !== "A") ev.preventDefault();
        onSelect(ev, item);
        if (closeOnSelect) hide();
      });
    }

    function bindGlobalListeners() {
      if (listenersBound) return;
      listenersBound = true;
      document.addEventListener(
        "pointerdown",
        function (ev) {
          if (!open || !menuEl) return;
          if (menuEl.contains(ev.target) || isTriggerTarget(ev.target)) return;
          hide();
        },
        true,
      );
      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") hide();
      });
    }

    function hide() {
      open = false;
      if (menuEl) {
        if (persistentMenu) menuEl.hidden = true;
        else {
          menuEl.remove();
          menuEl = null;
        }
      }
      triggerList().forEach(function (el) {
        el.setAttribute("aria-expanded", "false");
      });
      onToggle(false);
    }

    function show(showOpts) {
      showOpts = showOpts || {};
      bindGlobalListeners();
      if (showOpts.html) {
        if (menuEl && !persistentMenu) menuEl.remove();
        var wrap = document.createElement("div");
        wrap.innerHTML = showOpts.html;
        menuEl = wrap.firstElementChild;
        if (!menuEl) return;
        document.body.appendChild(menuEl);
        bindMenuClicks(menuEl);
      } else if (persistentMenu) {
        menuEl = persistentMenu;
        menuEl.hidden = false;
        bindMenuClicks(menuEl);
      }
      if (!menuEl) return;
      open = true;
      var anchor = showOpts.triggerEl || triggerEl;
      if (positionMode !== "css") {
        if (showOpts.clientX != null) positionContextMenu(menuEl, showOpts.clientX, showOpts.clientY);
        else if (anchor) {
          var rect = anchor.getBoundingClientRect();
          positionContextMenu(menuEl, rect.left, rect.bottom + 4);
        }
      }
      triggerList().forEach(function (el) {
        el.setAttribute("aria-expanded", el === anchor ? "true" : "false");
      });
      if (anchor) anchor.setAttribute("aria-expanded", "true");
      onToggle(true);
    }

    function toggle(showOpts) {
      if (open) hide();
      else show(showOpts);
    }

    if (persistentMenu) bindMenuClicks(persistentMenu);
    if (opts.bindTrigger !== false) {
      triggerList().forEach(function (el) {
        el.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          toggle({ triggerEl: el });
        });
      });
    }

    return { show: show, hide: hide, toggle: toggle, isOpen: function () { return open; }, destroy: hide };
  }

  window.WebtoolsContextMenu = {
    create: createContextMenu,
    createAnchored: createAnchoredMenu,
    position: positionContextMenu,
    MENU_CLASS: MENU_CLASS,
  };
})();
