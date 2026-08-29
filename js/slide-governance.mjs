/** Project governance panel for slide Details sidebars. */

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

export function renderGovernancePanelHtml({
  projects,
  activeProjectUid,
  findingsCount,
  projectSelectId = "spSlideDetailsProject",
}) {
  const projectOptions = (projects || [])
    .map(function (project) {
      const selected = project.project_uid === activeProjectUid ? " selected" : "";
      const lifecycle = project.lifecycle ? ` (${project.lifecycle})` : "";
      return `<option value="${escapeHtml(project.project_uid)}"${selected}>${escapeHtml(project.name || project.project_uid)}${escapeHtml(lifecycle)}</option>`;
    })
    .join("");
  const count = Number(findingsCount) || 0;
  return (
    `<section class="sp-search-governance" aria-label="Project governance">` +
    `<h3 class="sp-kicker">Project</h3>` +
    `<select id="${escapeHtml(projectSelectId)}" class="sp-search-project-select" aria-label="Active project">` +
    `<option value="">No project</option>` +
    projectOptions +
    `</select>` +
    `<p class="sp-muted sp-search-findings-count">${count} finding${count === 1 ? "" : "s"} pinned</p>` +
    `<button type="button" class="sp-btn sp-search-pin-finding" data-action="pin-finding">` +
    `<span class="material-symbols-outlined" aria-hidden="true">push_pin</span> Pin finding` +
    `</button>` +
    `</section>`
  );
}
