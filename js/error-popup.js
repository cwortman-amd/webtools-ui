/**
 * webtools-ui canonical asset: persistent error popup.
 *
 * A dependency-free modal for runtime and explicit application errors. Stays
 * visible until dismissed, offers copy-to-clipboard, and installs global
 * handlers for `window.onerror`, unhandled promise rejections, and legacy
 * `alert()`. Styling uses shared `--ui-*` theme tokens with hard fallbacks, so
 * it works in any consumer dashboard.
 *
 * Public API:
 *   window.ErrorPopup / window.CMErrorPopup  — { show, hide, copy, isOpen, installGlobalHandlers }
 *   window.showError   / window.showErrorPopup — shorthand for show(title, message, detail)
 *
 * (The `CMErrorPopup` / `showErrorPopup` names are retained for backward
 * compatibility with existing cluster-manager callers; new code should prefer
 * the neutral `ErrorPopup` / `showError`.)
 */
(function () {
  "use strict";

  if (window.__cmErrorPopupLoaded) return;
  window.__cmErrorPopupLoaded = true;

  var modalEl = null;
  var titleEl = null;
  var messageEl = null;
  var detailWrapEl = null;
  var detailEl = null;
  var copyBtnEl = null;
  var dismissBtnEl = null;
  var statusEl = null;
  var isOpen = false;
  var lastPayload = null;

  function ensureDom() {
    if (modalEl) return;

    var style = document.createElement("style");
    style.setAttribute("data-cm-error-popup", "true");
    style.textContent = [
      ".cm-error-backdrop {",
      "  position: fixed; inset: 0; z-index: 99999;",
      "  background: rgba(0,0,0,0.55);",
      "  display: none; align-items: center; justify-content: center;",
      // Inset past the notch / home indicator so the modal isn't clipped
      // on an iPhone, especially in landscape where the notch takes a side.
      "  padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))",
      "          max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));",
      "  box-sizing: border-box;",
      "}",
      ".cm-error-backdrop.cm-open { display: flex; }",
      ".cm-error-modal {",
      "  width: min(920px, calc(100vw - 32px));",
      // dvh follows iOS Safari's collapsing toolbars; vh is the static
      // largest viewport, so a vh-sized modal overflowed off-screen.
      "  max-height: calc(100vh - 32px);",
      "  max-height: calc(100dvh - 32px);",
      "  overflow: hidden;",
      "  border-radius: 12px;",
      "  border: 1px solid var(--ui-line, #243244);",
      "  background: var(--skin-panel-bg, var(--ui-panel, #111923));",
      "  color: var(--ui-text, #e5e7eb);",
      "  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.45);",
      "  display: flex; flex-direction: column;",
      "}",
      ".cm-error-header {",
      "  padding: 12px 14px;",
      "  border-bottom: 1px solid var(--ui-line, #243244);",
      "  display: flex; align-items: center; gap: 8px;",
      "  color: var(--ui-header, var(--ui-text, #e5e7eb));",
      "  font-size: 14px; font-weight: 700;",
      "}",
      ".cm-error-badge {",
      "  display: inline-flex; align-items: center; justify-content: center;",
      "  width: 22px; height: 22px; border-radius: 50%;",
      "  background: rgba(239,68,68,0.22); color: #ef4444;",
      "  font-size: 14px; font-weight: 800;",
      "}",
      ".cm-error-body { padding: 14px; display: grid; gap: 10px; }",
      ".cm-error-title { margin: 0; font-size: 15px; font-weight: 700; }",
      ".cm-error-message { margin: 0; font-size: 13px; line-height: 1.45; color: var(--ui-text, #e5e7eb); }",
      ".cm-error-detail-wrap {",
      "  border: 1px solid var(--ui-line, #243244);",
      "  border-radius: 8px; background: var(--ui-bg-soft, #172231);",
      "  overflow: hidden;",
      "}",
      ".cm-error-detail-label {",
      "  padding: 8px 10px;",
      "  border-bottom: 1px solid var(--ui-line, #243244);",
      "  font-size: 11px; color: var(--ui-muted, #94a3b8);",
      "  text-transform: uppercase; letter-spacing: 0.04em;",
      "}",
      ".cm-error-detail {",
      "  margin: 0; padding: 10px;",
      "  max-height: min(42vh, 360px); overflow: auto;",
      "  max-height: min(42dvh, 360px);",
      "  overscroll-behavior: contain; -webkit-overflow-scrolling: touch;",
      "  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;",
      "  font-size: 11px; line-height: 1.45; white-space: pre-wrap; word-break: break-word;",
      "  color: var(--ui-text, #e5e7eb);",
      "}",
      ".cm-error-footer {",
      "  padding: 12px 14px;",
      "  border-top: 1px solid var(--ui-line, #243244);",
      "  display: flex; align-items: center; justify-content: space-between; gap: 8px;",
      "}",
      ".cm-error-status { color: var(--ui-muted, #94a3b8); font-size: 11px; min-height: 16px; }",
      ".cm-error-actions { display: flex; gap: 8px; }",
      ".cm-error-btn {",
      "  border-radius: 8px; border: 1px solid var(--ui-line, #243244);",
      "  background: transparent; color: var(--ui-text, #e5e7eb);",
      "  padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer;",
      "}",
      ".cm-error-btn:hover { border-color: var(--ui-accent, #38bdf8); }",
      ".cm-error-btn.primary {",
      "  background: var(--ui-accent, #38bdf8); color: #000;",
      "  border-color: color-mix(in srgb, var(--ui-accent, #38bdf8) 78%, #000);",
      "}",
      ".cm-error-btn.primary:hover { opacity: 0.92; }",
      ".cm-error-btn:focus-visible { outline: 2px solid var(--ui-accent, #38bdf8); outline-offset: 1px; }",
    ].join("\n");
    document.head.appendChild(style);

    modalEl = document.createElement("div");
    modalEl.className = "cm-error-backdrop";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-modal", "true");
    modalEl.setAttribute("aria-label", "Application error");
    modalEl.innerHTML =
      '<div class="cm-error-modal" id="cmErrorModalPanel">' +
      '  <div class="cm-error-header"><span class="cm-error-badge">!</span><span>Error</span></div>' +
      '  <div class="cm-error-body">' +
      '    <h3 class="cm-error-title" id="cmErrorTitle"></h3>' +
      '    <p class="cm-error-message" id="cmErrorMessage"></p>' +
      '    <div class="cm-error-detail-wrap" id="cmErrorDetailWrap" style="display:none">' +
      '      <div class="cm-error-detail-label">Detail</div>' +
      '      <pre class="cm-error-detail" id="cmErrorDetail"></pre>' +
      "    </div>" +
      "  </div>" +
      '  <div class="cm-error-footer">' +
      '    <div class="cm-error-status" id="cmErrorStatus">Copy details before dismissing.</div>' +
      '    <div class="cm-error-actions">' +
      '      <button type="button" class="cm-error-btn" id="cmErrorCopyBtn">Copy Error</button>' +
      '      <button type="button" class="cm-error-btn primary" id="cmErrorDismissBtn">Dismiss</button>' +
      "    </div>" +
      "  </div>" +
      "</div>";
    document.body.appendChild(modalEl);

    titleEl = document.getElementById("cmErrorTitle");
    messageEl = document.getElementById("cmErrorMessage");
    detailWrapEl = document.getElementById("cmErrorDetailWrap");
    detailEl = document.getElementById("cmErrorDetail");
    copyBtnEl = document.getElementById("cmErrorCopyBtn");
    dismissBtnEl = document.getElementById("cmErrorDismissBtn");
    statusEl = document.getElementById("cmErrorStatus");

    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) hide();
    });
    dismissBtnEl.addEventListener("click", hide);
    copyBtnEl.addEventListener("click", copy);
    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;
      if ((e.key || "") === "Escape") {
        e.preventDefault();
        hide();
      }
    });
  }

  function toText(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack || value.message || String(value);
    try {
      return JSON.stringify(value, null, 2);
    } catch (_) {
      return String(value);
    }
  }

  function render(title, message, detail) {
    ensureDom();
    var t = title || "Unexpected Error";
    var m = message || "An unexpected error occurred.";
    var d = toText(detail).trim();

    lastPayload = { title: t, message: m, detail: d };
    titleEl.textContent = t;
    messageEl.textContent = m;
    if (d) {
      detailWrapEl.style.display = "";
      detailEl.textContent = d;
    } else {
      detailWrapEl.style.display = "none";
      detailEl.textContent = "";
    }
    statusEl.textContent = "Copy details before dismissing.";
  }

  function show(title, message, detail) {
    render(title, message, detail);
    modalEl.classList.add("cm-open");
    isOpen = true;
    setTimeout(function () {
      if (copyBtnEl) copyBtnEl.focus();
    }, 0);
  }

  function hide() {
    if (!modalEl) return;
    modalEl.classList.remove("cm-open");
    isOpen = false;
  }

  async function copy() {
    if (!lastPayload) return;
    var text = [
      "Title: " + (lastPayload.title || ""),
      "Message: " + (lastPayload.message || ""),
      lastPayload.detail ? "\nDetail:\n" + lastPayload.detail : "",
    ].join("\n");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "readonly");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      statusEl.textContent = "Copied to clipboard.";
    } catch (err) {
      statusEl.textContent = "Copy failed. Select detail and copy manually.";
      console.error("[ErrorPopup] clipboard copy failed:", err);
    }
  }

  function normalizeErrorPayload(errorOrMessage, source, lineno, colno, errorObj) {
    if (typeof errorOrMessage === "string") {
      var detail = "";
      if (errorObj && errorObj.stack) detail = errorObj.stack;
      else if (source) detail = source + ":" + (lineno || 0) + ":" + (colno || 0);
      return {
        title: "Runtime Error",
        message: errorOrMessage,
        detail: detail,
      };
    }
    if (errorOrMessage instanceof Error) {
      return {
        title: errorOrMessage.name || "Runtime Error",
        message: errorOrMessage.message || "An unexpected error occurred.",
        detail: errorOrMessage.stack || "",
      };
    }
    return {
      title: "Unexpected Error",
      message: toText(errorOrMessage) || "An unexpected error occurred.",
      detail: toText(errorObj || ""),
    };
  }

  function onWindowError(message, source, lineno, colno, error) {
    var payload = normalizeErrorPayload(message, source, lineno, colno, error);
    show(payload.title, payload.message, payload.detail);
  }

  function onUnhandledRejection(event) {
    var reason = event && event.reason;
    var title = "Unhandled Promise Rejection";
    var message = "";
    var detail = "";

    if (reason instanceof Error) {
      message = reason.message || "Promise rejected.";
      detail = reason.stack || "";
    } else {
      message = toText(reason) || "Promise rejected.";
      detail = toText(reason);
    }
    show(title, message, detail);
  }

  function installGlobalHandlers() {
    window.addEventListener("error", function (event) {
      if (!event) return;
      onWindowError(event.message, event.filename, event.lineno, event.colno, event.error);
    });
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    // Route legacy alert() errors through the shared modal.
    var originalAlert = window.alert;
    window.alert = function (msg) {
      show("Alert", toText(msg), "");
      if (typeof originalAlert === "function" && String(msg || "").trim() === "") {
        originalAlert(msg);
      }
    };
  }

  var api = {
    show: show,
    hide: hide,
    copy: copy,
    isOpen: function () { return isOpen; },
    installGlobalHandlers: installGlobalHandlers,
  };

  // Neutral canonical globals + backward-compatible cluster-manager aliases.
  window.ErrorPopup = api;
  window.CMErrorPopup = api;
  window.showError = show;
  window.showErrorPopup = show;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      ensureDom();
      installGlobalHandlers();
    });
  } else {
    ensureDom();
    installGlobalHandlers();
  }
})();
