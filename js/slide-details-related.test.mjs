import test from "node:test";
import assert from "node:assert/strict";

import {
  renderDuplicatePathsHtml,
  renderDuplicatesSectionHtml,
  renderSimilarSectionHtml,
  sourceBasename,
} from "./slide-details-related.mjs";

test("sourceBasename returns file name only", () => {
  assert.equal(sourceBasename("/corpus/alpha/arch.pptx"), "arch.pptx");
});

test("renderDuplicatesSectionHtml lists clickable duplicate rows", () => {
  const html = renderDuplicatesSectionHtml(
    [
      { slide_uid: "a", title: "GPU", source_path: "/a.pptx", slide_number: 1, approval_status: "approved" },
      { slide_uid: "b", title: "GPU", source_path: "/b.pptx", slide_number: 2, approval_status: "draft" },
    ],
    "a",
    () => "/thumb.png",
  );
  assert.match(html, /Identical copies \(2\)/);
  assert.match(html, /data-slide-uid="a"/);
  assert.match(html, /data-slide-uid="b"/);
  assert.match(html, /sp-slide-related-row--active/);
});

test("renderDuplicatePathsHtml shows paths when only locations exist", () => {
  const html = renderDuplicatePathsHtml(["/a.pptx", "/b/copy.pptx"], "/a.pptx");
  assert.match(html, /\/a\.pptx/);
  assert.match(html, /\/b\/copy\.pptx/);
});

test("renderSimilarSectionHtml renders ranked rows", () => {
  const html = renderSimilarSectionHtml(
    [{ slide_uid: "s2", title: "Throughput", source_path: "/t.pptx", _hybrid: 0.71 }],
    () => "",
    "GPU throughput",
  );
  assert.match(html, /Similar slides \(1\)/);
  assert.match(html, /Throughput/);
});
