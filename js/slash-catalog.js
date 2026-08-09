/*!
 * webtools-ui/js/slash-catalog.js
 *
 * Canonical catalog of every slash command shipped by any sibling consumer
 * (`llm-benchmark`, `dc-planner`, `cluster-manager`, `demo-portal`). Used by the cross-repo
 * "every command everywhere" coverage system (harmonization Phase 4):
 *
 *   - Each consumer's chat-orb-mount.js registers its NATIVE commands first.
 *   - Then it calls `SlashRouter.coverAll()`, which iterates this catalog
 *     and registers any catalog command NOT already in the orb as a
 *     friendly out-of-domain "not applicable here" no-op. Result: every
 *     consumer's `/help` lists the same complete command surface, and no
 *     cross-repo user types `/skills` and gets a useless "Unknown command"
 *     error.
 *
 * To add a new command to a consumer:
 *   1. Add it to the catalog below with its canonical description and the
 *      list of consumers that own it natively.
 *   2. Each native consumer registers a real handler in its mount file.
 *   3. Other consumers automatically pick it up as a no-op via coverAll().
 *
 * The catalog is the shared source of truth for what commands exist
 * cross-repo.
 */

(function (global) {
  "use strict";

  /**
   * Each entry maps `command` → metadata.
   *
   *   description: human-readable summary, shown in /help
   *   native:      array of consumer ids that natively implement this
   *                command. Allowed values: "llm-benchmark", "dc-planner",
   *                "cluster-manager", "demo-portal", "knowledge-exchange".
   *   redirect:    optional URL — if present, the no-op variant becomes a
   *                redirect that points the user at the consumer that owns it.
   *   placeholder: optional string — overrides the default no-op reply.
   */
  var CATALOG = {
    // ── Built-in (registered automatically by chat-orb.js) ──────────
    "/help":  { description: "Show all available commands",
                native: ["llm-benchmark", "dc-planner", "cluster-manager", "demo-portal"] },
    // knowledge-exchange overrides the built-in handler so a clear also stops
    // whatever is still streaming into the log it is about to empty. The
    // built-in `builtinClear` is unchanged and is still what the other four
    // consumers get.
    "/clear": { description: "Clear the chat history (knowledge-exchange: also stops an in-flight answer first)",
                native: ["llm-benchmark", "dc-planner", "cluster-manager", "demo-portal"] },
    // knowledge-exchange overrides the built-in handler so `/llm <question>`
    // forces model synthesis for one question; `/llm settings` still opens the
    // configuration card, and so does the header gear. Everywhere else this is
    // the settings shortcut chat-orb.js registers.
    "/llm":   { description: "Configure or toggle the LLM agent (knowledge-exchange: force a model-written answer for one question)",
                native: ["llm-benchmark", "dc-planner", "cluster-manager", "demo-portal"] },

    // ── Cross-repo navigation (every consumer should implement) ─────
    "/pitch":     { description: "Open the executive pitch deck (pitch.html)",
                    native: ["llm-benchmark", "dc-planner", "cluster-manager"] },
    "/demo":      { description: "Open or start a demo experience",
                    native: ["llm-benchmark", "dc-planner", "cluster-manager", "demo-portal"] },
    "/demo-shared": { description: "Start a canonical narrated demo track (shared demo engine)",
                      native: ["llm-benchmark", "dc-planner", "cluster-manager"] },
    "/dashboard": { description: "Return to the main dashboard",
                    native: ["llm-benchmark", "dc-planner", "cluster-manager"] },

    // ── knowledge-exchange: choosing where an answer comes from ────
    // Paired with `/llm` above. The two exist because the answers are not
    // substitutes: `/wiki` is deterministic retrieval that completes in well
    // under a second, `/llm` spends roughly ten seconds of model prefill to
    // rewrite the same retrieved passages. Only the person asking knows which
    // one they need, so neither is hidden behind server configuration.
    "/wiki":  { description: "Answer from the compiled wiki only — cited, deterministic, never the model",
                native: ["knowledge-exchange"],
                placeholder: "`/wiki` answers from the Knowledge Exchange compiled wiki." },

    // ── knowledge-exchange: taking the answer back ─────────────────
    // Both are about an answer already in flight, so both are catalogued
    // rather than left as consumer-local commands: any orb that streams needs
    // a way to stop the stream and a way to get out of the way, and a consumer
    // without one should say so rather than answer "Unknown command".
    "/stop":  { description: "Stop the answer that is streaming right now, keeping whatever text already arrived",
                native: ["knowledge-exchange"],
                placeholder: "`/stop` aborts an in-flight answer in the Knowledge Exchange orb." },
    "/exit":  { description: "Minimize the chat orb to its icon, leaving the transcript intact",
                native: ["knowledge-exchange"],
                placeholder: "`/exit` minimizes the Knowledge Exchange orb (Escape does the same)." },

    // ── demo-portal specific (manifest-driven catalog) ─────────────
    "/search":    { description: "Search the demo catalog",
                    native: ["demo-portal"] },
    "/runbook":   { description: "Show a demo runbook or source URL",
                    native: ["demo-portal"] },
    "/favorites": { description: "List locally saved demo favorites",
                    native: ["demo-portal"] },
    "/newdemo":   { description: "Create a draft demo manifest entry",
                    native: ["demo-portal"] },

    // ── Cross-repo agent operations (dc-planner + cluster-manager) ──
    "/journal":  { description: "Show or manage the agent journal",
                   native: ["dc-planner", "cluster-manager"] },
    "/undo":     { description: "Undo the last agent action",
                   native: ["dc-planner", "cluster-manager"] },
    "/redo":     { description: "Redo the last undone action",
                   native: ["dc-planner", "cluster-manager"] },
    "/validate": { description: "Validate a workload or BOM payload",
                   native: ["dc-planner", "cluster-manager"] },
    "/privacy":  { description: "Inspect or change the privacy tier",
                   native: ["dc-planner", "cluster-manager"] },
    "/explain":  { description: "Explain a `[data-agent-context]` element",
                   native: ["dc-planner", "cluster-manager"] },
    "/memory":   { description: "Inspect or toggle the agent memory layer",
                   native: ["dc-planner", "cluster-manager"] },
    "/workshop": { description: "Open the workshop / scratchpad mode",
                   native: ["dc-planner", "cluster-manager"] },
    "/voice":    { description: "Toggle voice input/output or speak text",
                   native: ["cluster-manager", "demo-portal"] },

    // ── dc-planner specific (planner / TCO domain) ──────────────────
    "/skills":   { description: "List skills in the agent registry",
                   native: ["dc-planner"] },
    "/skill":    { description: "Run a registered skill by id",
                   native: ["dc-planner"] },
    "/solve":    { description: "Run a constraint or TCO solver (dc-planner only)",
                   native: ["dc-planner"] },

    // ── cluster-manager specific (cluster ops domain) ───────────────
    "/agent":      { description: "Open the cluster-manager agent pane",
                       native: ["cluster-manager"] },
    "/remediate":    { description: "Run a remediation playbook",
                       native: ["cluster-manager"] },
    "/orchestrate":  { description: "Run an orchestration script",
                       native: ["cluster-manager"] },
    "/multimodal":   { description: "Open the multimodal input mode",
                       native: ["cluster-manager"] },
    "/wizard":       { description: "Launch the configuration wizard",
                       native: ["cluster-manager"] },
    "/replay":       { description: "Replay a recorded session",
                       native: ["cluster-manager"] },
    "/tools":        { description: "List available agent tools",
                       native: ["cluster-manager"] }
  };

  // Map each consumer to a canonical landing URL — used when generating a
  // "try this in <other consumer>" hint inside no-op replies.
  var CONSUMER_URLS = {
    "llm-benchmark":   "(see https://github.com/cwortman-amd/llm-benchmark)",
    "dc-planner":      "(see https://github.com/cwortman-amd/dc-planner)",
    "cluster-manager": "(see https://github.com/cwortman-amd/cluster-manager)",
    "demo-portal":     "(see https://github.com/cwortman-amd/demo-portal)",
    "knowledge-exchange": "(see https://github.com/cwortman-amd/knowledge-exchange)"
  };

  function listCommands() { return Object.keys(CATALOG).sort(); }
  function describe(cmd) { return CATALOG[cmd] || null; }
  function consumerHint(consumerIds) {
    if (!consumerIds || !consumerIds.length) return "";
    var list = consumerIds.map(function (c) { return "`" + c + "`"; }).join(" or ");
    var urls = consumerIds.map(function (c) { return CONSUMER_URLS[c] || ""; }).filter(Boolean);
    return list + (urls.length ? " " + urls[0] : "");
  }

  global.SlashCatalog = {
    CATALOG:        CATALOG,
    CONSUMER_URLS:  CONSUMER_URLS,
    listCommands:   listCommands,
    describe:       describe,
    consumerHint:   consumerHint
  };
})(typeof window !== "undefined" ? window : this);
