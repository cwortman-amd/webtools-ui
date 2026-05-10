/* eslint-disable */
/* ─────────────────────────────────────────────────────────────────
 * webtools-ui · Demo Audience Catalog (canonical)
 *
 * Exposes `window.DemoAudiences` — a reusable array of audience
 * presets that the demo audience-picker modal (currently rendered by
 * llm-benchmark/js/dashboard-tutor.js) can iterate over.
 *
 * The titles + ids are stable across all 3 sibling consumers so the
 * same modal markup, /demo slash routing, and demo-track filenames
 * (data/demo-tracks/{onboarding,advanced,expert}.json) stay aligned.
 *
 * Descriptions intentionally avoid naming repo-specific tabs (Plan,
 * Deploy, View, Profile, Report, Install, Network, Workload, GPU, …)
 * so cluster-manager and dc-planner can drop this catalog in without
 * paraphrasing.
 *
 * If a consumer wants to override or extend a single description, set
 *   window.DemoAudienceOverrides = { onboarding: "…", advanced: "…" };
 * BEFORE this script loads. The overrides merge per-id at runtime.
 *
 * Bootstrap order in the host page:
 *   1. (optional) inline override:  <script>window.DemoAudienceOverrides = {…}</script>
 *   2. <script src="../shared/js/demo-audiences.js"></script>
 *   3. <script src="…/dashboard-tutor.js"></script>  ← reads window.DemoAudiences
 *
 * Phase 9.8e (2026-05-05): introduced.
 * ─────────────────────────────────────────────────────────────── */
(function (global) {
  "use strict";

  var DEFAULT_AUDIENCES = [
    {
      id: "onboarding",
      name: "Standard Onboarding",
      time: "~5 min",
      desc: "Standard-view walkthrough of each section's purpose and day-one usage."
    },
    {
      id: "advanced",
      name: "Advanced Usage",
      time: "~10 min",
      desc: "Power-user tour of advanced features and options for deeper understanding."
    },
    {
      id: "expert",
      name: "Expert Training",
      time: "~15 min",
      desc: "Technical deep-dive into advanced configuration options for expert analysis."
    }
  ];

  function applyOverrides(list) {
    var overrides = (global.DemoAudienceOverrides && typeof global.DemoAudienceOverrides === "object")
      ? global.DemoAudienceOverrides
      : null;
    if (!overrides) return list;
    return list.map(function (entry) {
      var ov = overrides[entry.id];
      if (!ov) return entry;
      // Allow either a plain string (treat as desc override) or an object.
      if (typeof ov === "string") return Object.assign({}, entry, { desc: ov });
      return Object.assign({}, entry, ov);
    });
  }

  global.DemoAudiences = applyOverrides(DEFAULT_AUDIENCES);

  // Helper for late-binding consumers: returns a fresh, override-merged copy.
  global.getDemoAudiences = function () {
    return applyOverrides(DEFAULT_AUDIENCES);
  };
})(typeof window !== "undefined" ? window : this);
