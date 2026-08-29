/**
 * Shared right-side panel resize — drag the left edge to change width.
 */

export const SIDE_PANEL_RESIZE_BODY_CLASS = "sp-side-panel-resizing";

function clampWidth(px, min, max) {
  return Math.max(min, Math.min(max, px));
}

export function loadSidePanelWidth(storageKey, legacyKeys, defaultWidth, min, max) {
  var keys = [storageKey].concat(legacyKeys || []);
  for (var i = 0; i < keys.length; i += 1) {
    try {
      var stored = parseInt(localStorage.getItem(keys[i]) || "", 10);
      if (!isNaN(stored) && stored > 0) return clampWidth(stored, min, max);
    } catch (e) {}
  }
  return defaultWidth;
}

export function applySidePanelWidth(options) {
  var widthPx = options.widthPx;
  var min = options.min;
  var max = options.max;
  var shellEl = options.shellEl;
  var panelEl = options.panelEl;
  var cssVar = options.cssVar || "--sp-side-panel-width";
  var persist = options.persist;
  var storageKey = options.storageKey;

  var width = clampWidth(widthPx, min, max);
  if (shellEl) shellEl.style.setProperty(cssVar, width + "px");
  if (panelEl) {
    panelEl.style.flexBasis = width + "px";
    panelEl.style.width = width + "px";
  }
  if (persist !== false && storageKey) {
    try {
      localStorage.setItem(storageKey, String(width));
    } catch (e) {}
  }
  return width;
}

/**
 * @param {object} options
 * @param {HTMLElement} options.resizerEl
 * @param {HTMLElement} options.panelEl
 * @param {HTMLElement} [options.shellEl]
 * @param {string} options.storageKey
 * @param {string[]} [options.legacyStorageKeys]
 * @param {number} [options.defaultWidth=300]
 * @param {number} [options.min=220]
 * @param {number} [options.max=560]
 * @param {string} [options.cssVar="--sp-side-panel-width"]
 * @param {() => boolean} [options.enabled]
 * @param {number} [options.step=12]
 */
export function initSidePanelResizer(options) {
  var resizerEl = options.resizerEl;
  var panelEl = options.panelEl;
  var shellEl = options.shellEl;
  var storageKey = options.storageKey;
  var legacyStorageKeys = options.legacyStorageKeys || [];
  var defaultWidth = options.defaultWidth != null ? options.defaultWidth : 300;
  var min = options.min != null ? options.min : 220;
  var max = options.max != null ? options.max : 560;
  var cssVar = options.cssVar || "--sp-side-panel-width";
  var enabled = options.enabled || function () {
    return true;
  };
  var step = options.step != null ? options.step : 12;
  var bodyClass = options.bodyClass || SIDE_PANEL_RESIZE_BODY_CLASS;
  var activeClass = options.activeClass || "sp-side-panel__resizer--active";

  var width = defaultWidth;

  if (!resizerEl || !panelEl) {
    return {
      getWidth: function () {
        return width;
      },
      setWidth: function () {
        return width;
      },
    };
  }

  function setWidth(px, persist) {
    width = applySidePanelWidth({
      widthPx: px,
      min: min,
      max: max,
      shellEl: shellEl,
      panelEl: panelEl,
      cssVar: cssVar,
      persist: persist,
      storageKey: storageKey,
    });
    return width;
  }

  width = loadSidePanelWidth(storageKey, legacyStorageKeys, defaultWidth, min, max);
  setWidth(width, false);

  function onPointerMove(ev) {
    if (!resizerEl.classList.contains(activeClass)) return;
    var start = Number(resizerEl.dataset.startX || 0);
    var base = Number(resizerEl.dataset.startWidth || defaultWidth);
    setWidth(base + (start - ev.clientX), false);
  }

  function endResize() {
    if (!resizerEl.classList.contains(activeClass)) return;
    resizerEl.classList.remove(activeClass);
    document.body.classList.remove(bodyClass);
    setWidth(width, true);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endResize);
    window.removeEventListener("pointercancel", endResize);
  }

  resizerEl.addEventListener("pointerdown", function (ev) {
    if (!enabled()) return;
    ev.preventDefault();
    resizerEl.classList.add(activeClass);
    document.body.classList.add(bodyClass);
    resizerEl.dataset.startX = String(ev.clientX);
    resizerEl.dataset.startWidth = String(width);
    if (resizerEl.setPointerCapture) resizerEl.setPointerCapture(ev.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endResize);
    window.addEventListener("pointercancel", endResize);
  });

  resizerEl.addEventListener("keydown", function (ev) {
    if (!enabled()) return;
    if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      setWidth(width + step, true);
    } else if (ev.key === "ArrowRight") {
      ev.preventDefault();
      setWidth(width - step, true);
    }
  });

  return {
    getWidth: function () {
      return width;
    },
    setWidth: setWidth,
  };
}
