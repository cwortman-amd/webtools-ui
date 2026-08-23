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

  function activeTab(ctx) {
    if (ctx && ctx.tab) return String(ctx.tab);
    try {
      var q = new URLSearchParams(global.location.search).get("tab");
      if (q) return String(q);
    } catch (_) { /* ignore */ }
    return "search";
  }

  function pageMatchesRule(rule, path, file) {
    if (rule.pagePattern) {
      try {
        return new RegExp(rule.pagePattern, "i").test(path) ||
          new RegExp(rule.pagePattern, "i").test(file);
      } catch (_) { return false; }
    }
    if (rule.pageIncludes) return path.indexOf(rule.pageIncludes) >= 0;
    return false;
  }

  function pick(rules, ctx) {
    if (!rules || !rules.length) return null;
    var path = String((ctx && ctx.pathname) || global.location.pathname || "");
    var file = path.split("/").pop() || path;
    var tab = activeTab(ctx);
    var fallback = null;
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (!pageMatchesRule(rule, path, file)) continue;
      if (rule.tabQuery) {
        if (String(rule.tabQuery) === tab) return rule;
        continue;
      }
      if (!fallback) fallback = rule;
    }
    return fallback;
  }

  function cardHtml(rule, packet) {
    if (!rule || !rule.href) return "";
    var href = String(rule.href);
    if (packet && global.AgentHandoff && typeof global.AgentHandoff.attachToUrl === "function") {
      href = global.AgentHandoff.attachToUrl(href, packet);
    }
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
    var packet = null;
    if (global.AgentHandoff && typeof global.AgentHandoff.buildPacket === "function") {
      packet = global.AgentHandoff.buildPacket({
        product: (ctx && ctx.productId) || "",
        question: ctx && ctx.question,
        summary: String(result.reply || "").slice(0, 800),
        intent: "learn",
      });
    }
    var card = cardHtml(rule, packet);
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
          var context = ctx || {
            pathname: global.location && global.location.pathname,
            productId: global.WebtoolsPlatform && global.WebtoolsPlatform.id,
            tab: global.SlideShell && global.SlideShell.getContextState &&
              global.SlideShell.getContextState().tab,
          };
          return enrich(result, rules, context);
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
