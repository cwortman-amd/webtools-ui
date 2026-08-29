/**
 * Shared slide Details sidebar — HTML rendering and controller for Search, Build, etc.
 */

import { buildScoreRows, mergeExplainIntoHit, renderScoreBreakdownHtml } from "./score-breakdown.mjs";
import { renderGovernancePanelHtml } from "./slide-governance.mjs";
import {
  renderDuplicatePathsHtml,
  renderDuplicatesSectionHtml,
  renderRelatedErrorHtml,
  renderRelatedLoadingHtml,
  renderSimilarSectionHtml,
} from "./slide-details-related.mjs";

export const SENSITIVITY_VALUES = ["Internal", "Confidential", "Public"];

export const EMPTY_DETAILS_HTML = '<p class="sp-muted">Select a result to view details.</p>';

export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

export function isValidSensitivity(value) {
  return SENSITIVITY_VALUES.includes(value);
}

export function normalizeSensitivity(value) {
  return isValidSensitivity(value) ? value : "Internal";
}

export function renderSensitivityOptionsHtml(selected = "Internal") {
  const current = normalizeSensitivity(selected);
  return SENSITIVITY_VALUES.map(
    (label) => `<option value="${label}"${label === current ? " selected" : ""}>${label}</option>`,
  ).join("");
}

export function whyFor(hit) {
  if (!hit) return "";
  if (hit.why) return hit.why;
  const parts = [];
  if (hit.duplicate_count > 1) {
    parts.push(
      `${hit.duplicate_count} identical copies collapsed; showing the preferred approved/newest member`,
    );
  } else {
    parts.push("Best lexical match in the local index");
  }
  if (hit.conflict) parts.push("potentially conflicting approved versions");
  if (hit.newer_draft) parts.push("newer draft exists");
  if (hit.approval_status) parts.push(`status ${hit.approval_status}`);
  return `${parts.join(". ")}.`;
}

/** Normalized speaker / presenter notes from a slide hit or API record. */
export function slideNotesText(hit) {
  if (!hit) return "";
  if (typeof hit.notes === "string") return hit.notes.trim();
  if (hit.notes && typeof hit.notes === "object") {
    return String(hit.notes.presenter_notes || hit.notes.speaker_notes || "").trim();
  }
  return String(hit.speaker_notes || hit.presenter_notes || "").trim();
}

export function renderSpeakNotesHtml(hit, options) {
  const opts = options || {};
  const notes = slideNotesText(hit);
  const openAttr = opts.speakNotesOpen ? " open" : "";
  const body = notes
    ? `<div class="sp-slide-speak-notes-text">${escapeHtml(notes)}</div>`
    : `<p class="sp-muted sp-slide-speak-notes-empty">No speaker notes on this slide.</p>`;
  return (
    `<details class="sp-slide-speak-notes"${openAttr}>` +
    `<summary class="sp-slide-speak-notes-summary">` +
    `<span class="sp-slide-speak-notes-title">Speak Notes</span>` +
    `<span class="material-symbols-outlined sp-slide-speak-notes-chevron" aria-hidden="true">expand_more</span>` +
    `</summary>` +
    `<div class="sp-slide-speak-notes-body">${body}</div>` +
    `</details>`
  );
}

export function renderSlideDetailsActionsHtml(hit, compact, options) {
  const opts = options || {};
  const cls = compact ? " sp-gallery-peek-actions" : "";
  const slideUid = hit && hit.slide_uid ? escapeHtml(hit.slide_uid) : "";
  const tagged = slideUid && opts.taggedIds && opts.taggedIds.has(hit.slide_uid);
  return (
    `<div class="sp-search-inspector-actions${cls}">` +
    `<button type="button" class="sp-btn sp-btn--filled sp-search-action-present" data-action="present">` +
    `<span class="material-symbols-outlined" aria-hidden="true">slideshow</span> Present` +
    `</button>` +
    `<button type="button" class="sp-btn sp-search-action-deck" data-action="deck-add">` +
    `<span class="material-symbols-outlined" aria-hidden="true">playlist_add</span> Add to deck` +
    `</button>` +
    `<button type="button" class="sp-btn sp-search-action-tag${tagged ? " sp-search-action-tag--active" : ""}" data-action="tag-slide" data-slide-uid="${slideUid}"` +
    ` title="${tagged ? "Manage tags" : "Add tag"}" aria-label="${tagged ? "Manage tags" : "Add tag"}">` +
    `<span class="material-symbols-outlined" aria-hidden="true">${tagged ? "label" : "new_label"}</span> ${tagged ? "Manage tags" : "Add tag"}` +
    `</button>` +
    `<button type="button" class="sp-btn sp-search-action-compare" data-action="compare">` +
    `<span class="material-symbols-outlined" aria-hidden="true">compare</span> Compare` +
    `</button>` +
    `<button type="button" class="sp-create-btn sp-create-btn--primary sp-search-create-btn" data-action="create-from-context">` +
    `<span class="material-symbols-outlined" aria-hidden="true">draw</span> Create from context` +
    `</button>` +
    `<p class="sp-muted sp-search-inspector-hint">Present opens the stage · Create binds this hit as evidence.</p>` +
    `</div>`
  );
}

export function renderSlideDetailsHtml(hit, index, renderUrl, governance, options) {
  const opts = options || {};
  const sensitivitySelectId = opts.sensitivitySelectId || "spSlideDetailsSensitivity";
  const projectSelectId = opts.projectSelectId || "spSlideDetailsProject";
  if (!hit) return EMPTY_DETAILS_HTML;
  const thumb = renderUrl && renderUrl(hit);
  const img = thumb
    ? `<img class="sp-search-inspector-img" src="${escapeHtml(thumb)}" alt="" />`
    : "";
  const scoreHtml = renderScoreBreakdownHtml(buildScoreRows(hit));
  const familyMeta = [];
  if (hit.family_size > 1) familyMeta.push(`Family size ${hit.family_size}`);
  if (hit.conflict) familyMeta.push("Potential conflict in family");
  if (hit.newer_draft) familyMeta.push("Newer draft exists");
  const titlePrefix = Number.isFinite(index) && index >= 0 ? `${index + 1}. ` : "";
  return (
    `<div class="sp-search-inspector-inner">` +
    `<h3 class="sp-kicker">${titlePrefix}${escapeHtml(hit.title || "(untitled)")}</h3>` +
    img +
    `<dl class="sp-search-inspector-meta">` +
    `<dt>Source</dt><dd>${escapeHtml(hit.source_path || "")}</dd>` +
    `<dt>UID</dt><dd><code>${escapeHtml(hit.slide_uid || "")}</code></dd>` +
    `<dt>Status</dt><dd>${escapeHtml(hit.approval_status || "unknown")}</dd>` +
    `<dt>Sensitivity</dt><dd>` +
    `<select id="${escapeHtml(sensitivitySelectId)}" class="sp-create-sensitivity-select sp-search-sensitivity-select" aria-label="Sensitivity">` +
    `${renderSensitivityOptionsHtml(hit.sensitivity)}</select></dd>` +
    (hit.layout ? `<dt>Layout</dt><dd>${escapeHtml(hit.layout)}</dd>` : "") +
    (hit.visual_tags && hit.visual_tags.length
      ? `<dt>Visual tags</dt><dd>${escapeHtml(hit.visual_tags.join(", "))}</dd>`
      : "") +
    (familyMeta.length ? `<dt>Family</dt><dd>${escapeHtml(familyMeta.join(" · "))}</dd>` : "") +
    `<dt>Why</dt><dd>${escapeHtml(whyFor(hit))}</dd>` +
    `</dl>` +
    renderSpeakNotesHtml(hit, opts) +
    scoreHtml +
    `<div class="sp-slide-details-related-host" data-related-host></div>` +
    (governance
      ? renderGovernancePanelHtml(Object.assign({}, governance, { projectSelectId }))
      : "") +
    renderSlideDetailsActionsHtml(hit, false, opts) +
    `</div>`
  );
}

export function createSlideDetailsPanel(config) {
  const bodyEl = config.bodyEl;
  const sensitivitySelectId = config.sensitivitySelectId || "spSlideDetailsSensitivity";
  const projectSelectId = config.projectSelectId || "spSlideDetailsProject";
  const renderUrl = config.renderUrl || function () {
    return "";
  };
  const getGovernance = config.getGovernance || function () {
    return null;
  };
  const getTaggedIds = config.getTaggedIds || function () {
    return new Set();
  };
  const getExplainQuery = config.getExplainQuery || function () {
    return "";
  };
  const isCurrentSelection =
    config.isCurrentSelection ||
    function (index, hit) {
      return currentIndex === index && currentHit && hit && currentHit.slide_uid === hit.slide_uid;
    };
  const onAction = config.onAction || function () {};
  const onSensitivityChange = config.onSensitivityChange || function () {};
  const onSensitivityError = config.onSensitivityError || function () {};
  const onProjectChange = config.onProjectChange || function () {};
  const onSelectRelatedSlide = config.onSelectRelatedSlide || function () {};
  const fetchRelated = config.fetchRelated !== false;

  let currentIndex = -1;
  let currentHit = null;
  let explainSeq = 0;
  let relatedSeq = 0;
  let speakNotesOpen = false;
  let speakNotesOpenUid = null;

  function relatedHostEl() {
    return bodyEl ? bodyEl.querySelector("[data-related-host]") : null;
  }

  function setRelatedHtml(html) {
    const host = relatedHostEl();
    if (host) host.innerHTML = html || "";
  }

  function fetchRelatedSlides(hit, index) {
    if (!fetchRelated || !hit || !hit.slide_uid) {
      setRelatedHtml("");
      return;
    }
    if (!globalThis.SlideAPI) {
      setRelatedHtml("");
      return;
    }
    const seq = ++relatedSeq;
    setRelatedHtml(renderRelatedLoadingHtml());
    const api = globalThis.SlideAPI;
    const tasks = [];
    if (typeof api.duplicates === "function") {
      tasks.push(api.duplicates(hit.slide_uid));
    } else {
      tasks.push(Promise.resolve(null));
    }
    if (typeof api.similar === "function") {
      tasks.push(api.similar(hit.slide_uid, 5));
    } else {
      tasks.push(Promise.resolve(null));
    }
    Promise.all(tasks)
      .then(function (pair) {
        if (seq !== relatedSeq || !isCurrentSelection(index, hit)) return;
        const dupData = pair[0];
        const simData = pair[1];
        let html = "";
        if (dupData && Array.isArray(dupData.members) && dupData.members.length > 1) {
          html += renderDuplicatesSectionHtml(dupData.members, hit.slide_uid, renderUrl);
        } else if (Array.isArray(hit.locations) && hit.locations.length > 1) {
          html += renderDuplicatePathsHtml(hit.locations, hit.source_path);
        }
        if (simData) {
          html += renderSimilarSectionHtml(simData.results || [], renderUrl, simData.query || "");
        }
        setRelatedHtml(html);
      })
      .catch(function () {
        if (seq !== relatedSeq || !isCurrentSelection(index, hit)) return;
        setRelatedHtml(renderRelatedErrorHtml("Could not load related slides."));
      });
  }

  function render(hit, index) {
    if (!bodyEl) return;
    if (!hit) {
      bodyEl.innerHTML = EMPTY_DETAILS_HTML;
      currentHit = null;
      currentIndex = -1;
      return;
    }
    currentHit = hit;
    currentIndex = index;
    const notesOpen = speakNotesOpen && hit.slide_uid && hit.slide_uid === speakNotesOpenUid;
    bodyEl.innerHTML = renderSlideDetailsHtml(hit, index, renderUrl, getGovernance(), {
      taggedIds: getTaggedIds(),
      sensitivitySelectId: sensitivitySelectId,
      projectSelectId: projectSelectId,
      speakNotesOpen: notesOpen,
    });
  }

  function fetchExplain(hit, index) {
    if (!hit || !hit.slide_uid) return;
    if (!globalThis.SlideAPI || !globalThis.SlideAPI.explain) return;
    const seq = ++explainSeq;
    const query = getExplainQuery();
    globalThis.SlideAPI.explain(hit.slide_uid, query)
      .then(function (data) {
        if (seq !== explainSeq || !isCurrentSelection(index, hit)) return;
        const merged = mergeExplainIntoHit(hit, data);
        render(merged, index);
        fetchRelatedSlides(merged, index);
      })
      .catch(function () {});
  }

  function show(hit, index, options) {
    const opts = options || {};
    if (!hit) {
      speakNotesOpen = false;
      speakNotesOpenUid = null;
      relatedSeq += 1;
      render(null, -1);
      return;
    }
    if (speakNotesOpenUid && hit.slide_uid !== speakNotesOpenUid) {
      speakNotesOpen = false;
      speakNotesOpenUid = null;
    }
    render(hit, index);
    fetchRelatedSlides(hit, index);
    if (opts.fetchExplain !== false) fetchExplain(hit, index);
  }

  function refresh() {
    if (currentHit) {
      render(currentHit, currentIndex);
      fetchRelatedSlides(currentHit, currentIndex);
    }
  }

  function bindEvents() {
    if (!bodyEl || bodyEl.dataset.slideDetailsBound === "1") return;
    bodyEl.dataset.slideDetailsBound = "1";
    bodyEl.addEventListener("toggle", function (ev) {
      const el = ev.target;
      if (!el || !el.classList || !el.classList.contains("sp-slide-speak-notes")) return;
      speakNotesOpen = !!el.open;
      speakNotesOpenUid = currentHit && currentHit.slide_uid ? currentHit.slide_uid : null;
    });
    bodyEl.addEventListener("click", function (ev) {
      const relatedBtn = ev.target.closest(".sp-slide-related-hit[data-slide-uid]");
      if (relatedBtn) {
        ev.preventDefault();
        const uid = relatedBtn.getAttribute("data-slide-uid");
        if (!uid || !globalThis.SlideAPI || !globalThis.SlideAPI.slide) return;
        globalThis.SlideAPI.slide(uid)
          .then(function (slide) {
            if (!slide) return;
            onSelectRelatedSlide(slide, currentIndex, relatedBtn.getAttribute("data-related-kind"));
          })
          .catch(function () {});
        return;
      }
      const btn = ev.target.closest("[data-action]");
      if (!btn || !currentHit) return;
      onAction(btn.getAttribute("data-action"), currentHit, currentIndex, btn);
    });
    bodyEl.addEventListener("change", function (ev) {
      const target = ev.target;
      if (!target || target.tagName !== "SELECT") return;
      if (target.id === projectSelectId) {
        onProjectChange(target.value || "");
        return;
      }
      if (target.id === sensitivitySelectId) {
        if (!currentHit || !currentHit.slide_uid || !globalThis.SlideAPI || !globalThis.SlideAPI.setSensitivity) return;
        const next = target.value;
        const slideUid = currentHit.slide_uid;
        globalThis.SlideAPI.setSensitivity(slideUid, next)
          .then(function (updated) {
            if (!currentHit || currentHit.slide_uid !== slideUid) return;
            onSensitivityChange(currentHit, (updated && updated.sensitivity) || next);
          })
          .catch(function (err) {
            onSensitivityError(currentHit, err);
            refresh();
          });
      }
    });
  }

  return {
    show: show,
    render: render,
    refresh: refresh,
    bindEvents: bindEvents,
    getCurrentHit: function () {
      return currentHit;
    },
    getCurrentIndex: function () {
      return currentIndex;
    },
  };
}

export { mergeExplainIntoHit };
