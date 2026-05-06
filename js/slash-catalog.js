/*!
 * shared-ui/js/slash-catalog.js
 *
 * Canonical catalog of every slash command shipped by any sibling consumer
 * (`llm-benchmark`, `gpu-planner`, `cluster-manager`). Used by the cross-repo
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
   *                command. Allowed values: "llm-benchmark", "gpu-planner",
   *                "cluster-manager".
   *   redirect:    optional URL — if present, the no-op variant becomes a
   *                redirect that points the user at the consumer that owns it.
   *   placeholder: optional string — overrides the default no-op reply.
   */
  var CATALOG = {
    // ── Built-in (registered automatically by chat-orb.js) ──────────
    "/help":  { description: "Show all available commands",
                native: ["llm-benchmark", "gpu-planner", "cluster-manager"] },
    "/clear": { description: "Clear the chat history",
                native: ["llm-benchmark", "gpu-planner", "cluster-manager"] },
    "/llm":   { description: "Configure or toggle the LLM agent",
                native: ["llm-benchmark", "gpu-planner", "cluster-manager"] },

    // ── Cross-repo navigation (every consumer should implement) ─────
    "/pitch":     { description: "Open the executive pitch deck (pitch.html)",
                    native: ["llm-benchmark", "gpu-planner", "cluster-manager"] },
    "/demo":      { description: "Start the narrated dashboard walkthrough",
                    native: ["llm-benchmark", "gpu-planner", "cluster-manager"] },
    "/dashboard": { description: "Return to the main dashboard",
                    native: ["llm-benchmark", "gpu-planner", "cluster-manager"] },

    // ── Cross-repo agent operations (gpu-planner + cluster-manager) ─
    "/journal":  { description: "Show or manage the agent journal",
                   native: ["gpu-planner", "cluster-manager"] },
    "/undo":     { description: "Undo the last agent action",
                   native: ["gpu-planner", "cluster-manager"] },
    "/redo":     { description: "Redo the last undone action",
                   native: ["gpu-planner", "cluster-manager"] },
    "/validate": { description: "Validate a workload or BOM payload",
                   native: ["gpu-planner", "cluster-manager"] },
    "/privacy":  { description: "Inspect or change the privacy tier",
                   native: ["gpu-planner", "cluster-manager"] },
    "/explain":  { description: "Explain a `[data-agent-context]` element",
                   native: ["gpu-planner", "cluster-manager"] },
    "/memory":   { description: "Inspect or toggle the agent memory layer",
                   native: ["gpu-planner", "cluster-manager"] },
    "/workshop": { description: "Open the workshop / scratchpad mode",
                   native: ["gpu-planner", "cluster-manager"] },
    "/voice":    { description: "Toggle voice output / speak last reply",
                   native: ["cluster-manager"] },

    // ── gpu-planner specific (planner / TCO domain) ─────────────────
    "/skills":   { description: "List skills in the agent registry",
                   native: ["gpu-planner"] },
    "/skill":    { description: "Run a registered skill by id",
                   native: ["gpu-planner"] },
    "/solve":    { description: "Run a constraint or TCO solver (gpu-planner only)",
                   native: ["gpu-planner"] },

    // ── cluster-manager specific (cluster ops domain) ───────────────
    "/copilot":      { description: "Open the cluster-manager copilot pane",
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
    "gpu-planner":     "(see https://github.com/cwortman-amd/gpu-planner)",
    "cluster-manager": "(see https://github.com/cwortman-amd/cluster-manager)"
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
