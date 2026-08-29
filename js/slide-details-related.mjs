/** Duplicate locations + similar slides sections for Details sidebar. */

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

export function sourceBasename(path) {
  if (!path) return "";
  const norm = String(path).replace(/\\/g, "/");
  const parts = norm.split("/");
  return parts[parts.length - 1] || norm;
}

function relatedRowHtml(slide, renderUrl, options) {
  const opts = options || {};
  const uid = escapeHtml(slide.slide_uid || "");
  const title = escapeHtml(slide.title || "(untitled)");
  const file = escapeHtml(sourceBasename(slide.source_path || ""));
  const slideNum =
    slide.slide_number != null ? `<span class="sp-slide-related-num">Slide ${slide.slide_number}</span>` : "";
  const thumbUrl = renderUrl ? renderUrl(slide) : "";
  const thumb = thumbUrl
    ? `<img class="sp-slide-related-thumb" src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" />`
    : `<span class="sp-slide-related-thumb sp-slide-related-thumb--empty material-symbols-outlined" aria-hidden="true">image</span>`;
  const active =
    opts.activeUid && slide.slide_uid === opts.activeUid ? " sp-slide-related-row--active" : "";
  const badge =
    opts.showApproval && slide.approval_status
      ? `<span class="sp-slide-related-badge sp-slide-related-badge--${escapeHtml(slide.approval_status)}">${escapeHtml(slide.approval_status)}</span>`
      : "";
  const score =
    opts.showScore && slide._visual != null
      ? `<span class="sp-slide-related-score">${Math.round(Number(slide._visual) * 100)}%</span>`
      : opts.showScore && slide._hybrid != null
        ? `<span class="sp-slide-related-score">${Math.round(Number(slide._hybrid) * 100)}%</span>`
        : "";
  return (
    `<li class="sp-slide-related-row${active}">` +
    `<button type="button" class="sp-slide-related-hit" data-slide-uid="${uid}" data-related-kind="${escapeHtml(opts.kind || "slide")}">` +
    thumb +
    `<span class="sp-slide-related-text">` +
    `<span class="sp-slide-related-title">${title}</span>` +
    `<span class="sp-slide-related-meta">${file}${slideNum ? " · " + slideNum : ""}${badge}${score}</span>` +
    `</span>` +
    `</button></li>`
  );
}

export function renderDuplicatePathsHtml(locations, currentPath) {
  const list = (locations || []).filter(Boolean);
  if (list.length <= 1) return "";
  const rows = list
    .map(function (path) {
      const active = path === currentPath ? " sp-slide-related-path--active" : "";
      return `<li class="sp-slide-related-path${active}"><code>${escapeHtml(path)}</code></li>`;
    })
    .join("");
  return (
    `<section class="sp-slide-details-related sp-slide-details-related--duplicates" aria-label="Identical copies">` +
    `<h4 class="sp-slide-details-related-title">Identical copies (${list.length})</h4>` +
    `<p class="sp-muted sp-slide-details-related-hint">Same slide content in multiple source files.</p>` +
    `<ul class="sp-slide-related-path-list">${rows}</ul>` +
    `</section>`
  );
}

export function renderDuplicatesSectionHtml(members, currentUid, renderUrl) {
  const list = (members || []).filter(Boolean);
  if (list.length <= 1) {
    return "";
  }
  const rows = list
    .map(function (slide) {
      return relatedRowHtml(slide, renderUrl, {
        activeUid: currentUid,
        kind: "duplicate",
        showApproval: true,
      });
    })
    .join("");
  return (
    `<section class="sp-slide-details-related sp-slide-details-related--duplicates" aria-label="Identical copies">` +
    `<h4 class="sp-slide-details-related-title">Identical copies (${list.length})</h4>` +
    `<p class="sp-muted sp-slide-details-related-hint">Same slide content in multiple source files.</p>` +
    `<ul class="sp-slide-related-list">${rows}</ul>` +
    `</section>`
  );
}

export function renderSimilarSectionHtml(results, renderUrl, query) {
  const list = (results || []).filter(Boolean);
  if (!list.length) {
    return (
      `<section class="sp-slide-details-related sp-slide-details-related--similar" aria-label="Similar slides">` +
      `<h4 class="sp-slide-details-related-title">Similar slides</h4>` +
      `<p class="sp-muted sp-slide-details-related-hint">No close matches found in the indexed corpus.</p>` +
      `</section>`
    );
  }
  const rows = list
    .map(function (slide) {
      return relatedRowHtml(slide, renderUrl, {
        kind: "similar",
        showScore: true,
      });
    })
    .join("");
  const hint = query
    ? `<p class="sp-muted sp-slide-details-related-hint">Ranked by hybrid and visual similarity to this slide.</p>`
    : "";
  return (
    `<section class="sp-slide-details-related sp-slide-details-related--similar" aria-label="Similar slides">` +
    `<h4 class="sp-slide-details-related-title">Similar slides (${list.length})</h4>` +
    hint +
    `<ul class="sp-slide-related-list">${rows}</ul>` +
    `</section>`
  );
}

export function renderRelatedLoadingHtml() {
  return (
    `<section class="sp-slide-details-related sp-slide-details-related--loading" aria-busy="true">` +
    `<p class="sp-muted">Loading duplicates and similar slides…</p>` +
    `</section>`
  );
}

export function renderRelatedErrorHtml(message) {
  return (
    `<section class="sp-slide-details-related sp-slide-details-related--error">` +
    `<p class="sp-muted">${escapeHtml(message || "Could not load related slides.")}</p>` +
    `</section>`
  );
}
