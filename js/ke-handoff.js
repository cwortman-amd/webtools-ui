/*!
 * webtools-ui/js/ke-handoff.js
 *
 * Reverse contextual handoffs: sister dashboards → Knowledge Exchange modules.
 * Knowledge Exchange uses portal/handoff.js for the forward direction
 * (wiki answers → live dashboards). This helper mirrors that contract on
 * dashboard agents — an explicit deep link, not shared agent memory.
 *
 * Usage (in chat-orb-mount.js after ChatOrb.mount):
 *   KeHandoff.install({
 *     rules: [ { pagePattern: "network\\.html$", href: "...", label: "...", hint: "..." } ]
 *   });
 */
(function (global) {
  "use strict";

  function esc(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pick(rules, ctx) {
    if (!rules || !rules.length) return null;
    var path = String((ctx && ctx.pathname) || global.location.pathname || "");
    var file = path.split("/").pop() || path;
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (rule.pagePattern) {
        try {
          if (new RegExp(rule.pagePattern, "i").test(path) ||
              new RegExp(rule.pagePattern, "i").test(file)) {
            return rule;
          }
        } catch (_) { /* skip invalid pattern */ }
      }
      if (rule.pageIncludes && path.indexOf(rule.pageIncludes) >= 0) return rule;
    }
    return null;
  }

  function cardHtml(rule) {
    if (!rule || !rule.href) return "";
    var href = String(rule.href);
    var label = String(rule.label || "Open related curriculum in Knowledge Exchange");
    var hint = String(rule.hint || "Wiki-grounded lessons · separate training agent");
    return (
      '<a class="ke-orb-handoff" href="' + esc(href) + '"' +
      ' target="_blank" rel="noopener noreferrer"' +
      ' aria-label="' + esc(label + ". " + hint) + '">' +
      '<span class="ke-orb-handoff__icon material-symbols-outlined" aria-hidden="true">school</span>' +
      '<span class="ke-orb-handoff__body">' +
      '<span class="ke-orb-handoff__label">' + esc(label) + "</span>" +
      '<span class="ke-orb-handoff__hint">' + esc(hint) + "</span>" +
      "</span></a>"
    );
  }

  function enrich(result, rules, ctx) {
    if (!result || !result.reply) return result;
    var rule = pick(rules, ctx);
    if (!rule) return result;
    var card = cardHtml(rule);
    if (!card) return result;
    if (result.html) {
      result.reply = String(result.reply) + card;
    } else {
      result.reply =
        '<div class="ke-handoff-prose">' +
        esc(result.reply).replace(/\n/g, "<br>") +
        "</div>" + card;
      result.html = true;
    }
    return result;
  }

  function install(opts) {
    opts = opts || {};
    var rules = opts.rules || [];
    var ctx = opts.context || null;
    var skipKinds = opts.skipKinds || { user: true };

    function wrap(fn) {
      return function () {
        var out = fn.apply(this, arguments);
        return Promise.resolve(out).then(function (result) {
          if (!result || skipKinds[result.kind]) return result;
          return enrich(result, rules, ctx);
        });
      };
    }

    if (!global.ChatOrb || typeof global.ChatOrb.register !== "function") return false;

    var orig = global.ChatOrb.register.bind(global.ChatOrb);
    global.ChatOrb.register = function (command, handler, meta) {
      if (typeof handler === "function" && command !== "/clear") {
        return orig(command, wrap(handler), meta);
      }
      return orig(command, handler, meta);
    };
    return true;
  }

  global.KeHandoff = {
    pick: pick,
    cardHtml: cardHtml,
    enrich: enrich,
    install: install,
  };
})(typeof window !== "undefined" ? window : globalThis);
