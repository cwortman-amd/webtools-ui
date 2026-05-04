/*!
 * shared-ui/js/slash-router.js
 *
 * Helper module for batch-registering slash-command handlers from a
 * declarative manifest. The actual dispatch logic lives in chat-orb.js;
 * this is a thin convenience wrapper that lets each consumer ship a
 * single `slash-handlers.js` (or per-feature handler files) and bulk-
 * register them at startup.
 *
 * USAGE:
 *
 *   <script src="../shared/js/chat-orb.js"></script>
 *   <script src="../shared/js/slash-router.js"></script>
 *   <script>
 *     ChatOrb.mount({ title: "LLM Benchmark", initials: "LB" });
 *     SlashRouter.registerAll({
 *       "/pitch": {
 *         handler:     function () { window.open("pitch.html", "_self"); },
 *         description: "Open the executive pitch deck"
 *       },
 *       "/demo": {
 *         handler:     function (args) { return startDemo(args); },
 *         description: "Start the narrated demo walkthrough"
 *       }
 *     });
 *   </script>
 *
 * NOOP HELPER: For commands that don't apply to this consumer (e.g.
 * dc-planner's `/solve dc_tco` doesn't make sense in cluster-manager),
 * use `SlashRouter.noop()` to register a friendly out-of-domain reply:
 *
 *   SlashRouter.registerAll({
 *     "/solve":  SlashRouter.noop("Not applicable in this app — try dc-planner."),
 *     "/skills": SlashRouter.noop("Skills registry is dc-planner-specific.")
 *   });
 *
 * The cross-repo "every slash command everywhere" parity goal (per
 * `shared/docs/PLAN.md` Phase 4) uses this helper to keep out-of-domain
 * commands gracefully advertised in `/help` rather than tossed as
 * "Unknown command".
 */

(function (global) {
  "use strict";

  function ensureChatOrb() {
    if (!global.ChatOrb || typeof global.ChatOrb.register !== "function") {
      throw new Error("SlashRouter: window.ChatOrb is not loaded. Include chat-orb.js first.");
    }
  }

  function registerAll(manifest) {
    ensureChatOrb();
    if (!manifest || typeof manifest !== "object") return;
    Object.keys(manifest).forEach(function (cmd) {
      var entry = manifest[cmd];
      if (!entry || typeof entry.handler !== "function") {
        console.warn("[SlashRouter] skipping '" + cmd + "' — handler is not a function");
        return;
      }
      global.ChatOrb.register(cmd, entry.handler, {
        description: entry.description || ""
      });
    });
  }

  function noop(reply) {
    var msg = reply || "This command is not available in this app.";
    return {
      handler: function () { return { reply: msg, kind: "system" }; },
      description: "(not applicable here — see other consumer apps) " + msg
    };
  }

  function redirect(targetUrl, label) {
    return {
      handler: function () {
        try { window.open(targetUrl, "_self"); } catch (e) {}
        return { reply: "Opening " + (label || targetUrl) + "…", kind: "system" };
      },
      description: "Open " + (label || targetUrl)
    };
  }

  /**
   * Cross-repo "every command everywhere" coverage. Reads the canonical
   * catalog (shared/js/slash-catalog.js — must be loaded first) and
   * registers any catalog command NOT already in this orb as a friendly
   * out-of-domain no-op. Result: every consumer's `/help` lists the same
   * complete command surface; users typing `/skills` in `llm-benchmark`
   * get a helpful "this lives in dc-planner" reply instead of "Unknown
   * command".
   *
   * Pass `{ self: "<consumer-id>" }` so this consumer is excluded from
   * the "where to find it" hint (we'd otherwise tell the user to go to
   * the consumer they're already in).
   *
   * Example (called from each consumer's chat-orb-mount.js, AFTER the
   * native commands are registered):
   *
   *   SlashRouter.coverAll({ self: "llm-benchmark" });
   *
   * Optional: pass `{ skip: ["/foo", "/bar"] }` to suppress catalog
   * entries this consumer doesn't want to advertise at all.
   */
  function coverAll(opts) {
    ensureChatOrb();
    if (!global.SlashCatalog) {
      console.warn("[SlashRouter] coverAll: window.SlashCatalog is missing — load shared/js/slash-catalog.js first");
      return;
    }
    opts = opts || {};
    var self = opts.self || null;
    var skip = (opts.skip || []).reduce(function (acc, c) { acc[c.toLowerCase()] = true; return acc; }, {});
    var existing = global.ChatOrb.listCommands().reduce(function (acc, c) { acc[c.toLowerCase()] = true; return acc; }, {});

    var registered = 0;
    global.SlashCatalog.listCommands().forEach(function (cmd) {
      var key = cmd.toLowerCase();
      if (existing[key] || skip[key]) return;
      var entry = global.SlashCatalog.describe(cmd);
      if (!entry) return;
      var native = (entry.native || []).filter(function (c) { return c !== self; });
      var hint = native.length
        ? " Available in " + global.SlashCatalog.consumerHint(native) + "."
        : "";
      var msg = (entry.placeholder || ("`" + cmd + "` is not implemented in this app.")) + hint;
      global.ChatOrb.register(cmd, function () {
        return { reply: msg, kind: "system" };
      }, {
        description: entry.description + (native.length ? "  (lives in " + native.join("/") + ")" : "  (not in any consumer yet)")
      });
      registered++;
    });

    if (registered) {
      console.info("[SlashRouter] coverAll: registered " + registered + " out-of-domain no-op handlers");
    }
  }

  global.SlashRouter = {
    registerAll: registerAll,
    noop:        noop,
    redirect:    redirect,
    coverAll:    coverAll
  };
})(typeof window !== "undefined" ? window : this);
