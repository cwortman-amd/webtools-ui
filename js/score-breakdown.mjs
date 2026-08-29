/** Score breakdown bars for slide Details panels. */

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

const APPROVAL_BOOST = {
  canonical: 0.05,
  approved: 0.02,
};

export function buildScoreRows(hit) {
  if (!hit) return [];
  const rows = [];
  if (hit._hybrid != null) {
    rows.push({ key: "hybrid", label: "Hybrid rank", value: Number(hit._hybrid) });
  }
  if (hit._visual != null) {
    rows.push({ key: "visual", label: "Visual similarity", value: Number(hit._visual) });
  }
  if (hit._lexical != null) {
    rows.push({ key: "lexical", label: "Lexical match", value: Number(hit._lexical) });
  }
  const boost = APPROVAL_BOOST[String(hit.approval_status || "").toLowerCase()];
  if (boost != null) {
    rows.push({ key: "approval", label: "Approval boost", value: boost });
  }
  return rows.filter((row) => Number.isFinite(row.value));
}

export function mergeExplainIntoHit(hit, explainData) {
  if (!hit) return hit;
  if (!explainData) return hit;
  return Object.assign({}, hit, {
    why: explainData.why || hit.why,
    family_size: explainData.family_size ?? hit.family_size,
    conflict: explainData.conflict ?? hit.conflict,
    newer_draft: explainData.newer_draft ?? hit.newer_draft,
  });
}

export function renderScoreBreakdownHtml(rows) {
  if (!rows || !rows.length) return "";
  const bars = rows
    .map(function (row) {
      const pct = Math.max(0, Math.min(100, Math.round(row.value * 100)));
      return (
        `<li class="sp-search-score-row sp-search-score-row--${escapeHtml(row.key)}">` +
        `<span class="sp-search-score-label">${escapeHtml(row.label)}</span>` +
        `<span class="sp-search-score-track" aria-hidden="true">` +
        `<span class="sp-search-score-fill" style="width:${pct}%"></span>` +
        `</span>` +
        `<span class="sp-search-score-value">${pct}%</span>` +
        `</li>`
      );
    })
    .join("");
  return `<ul class="sp-search-score-breakdown" aria-label="Score breakdown">${bars}</ul>`;
}
