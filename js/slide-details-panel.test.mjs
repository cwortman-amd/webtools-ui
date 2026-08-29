import test from "node:test";
import assert from "node:assert/strict";

import {
  createSlideDetailsPanel,
  renderSlideDetailsHtml,
  renderSpeakNotesHtml,
  slideNotesText,
  whyFor,
} from "./slide-details-panel.mjs";

test("renderSlideDetailsHtml empty state and configurable select ids", () => {
  assert.match(renderSlideDetailsHtml(null, 0, () => ""), /Select a result to view details/);
  const html = renderSlideDetailsHtml(
    {
      title: "MI300X",
      slide_uid: "slide_1",
      source_path: "/tmp/a.pptx",
      approval_status: "approved",
      sensitivity: "Confidential",
      _hybrid: 0.82,
    },
    2,
    () => "/thumb.png",
    null,
    { sensitivitySelectId: "spBuildDetailsSensitivity", projectSelectId: "spBuildDetailsProject" },
  );
  assert.match(html, /3\. MI300X/);
  assert.match(html, /id="spBuildDetailsSensitivity"/);
  assert.match(html, /value="Confidential" selected/);
  assert.match(html, /data-action="present"/);
});

test("renderSpeakNotesHtml collapses by default and shows PPTX notes", () => {
  const html = renderSpeakNotesHtml(
    { notes: "Emphasize MI300X memory bandwidth.\nSecond bullet." },
    {},
  );
  assert.match(html, /Speak Notes/);
  assert.match(html, /sp-slide-speak-notes/);
  assert.doesNotMatch(html, /\sopen[=>]/);
  assert.match(html, /Emphasize MI300X memory bandwidth/);
  assert.match(html, /Second bullet/);
  const openHtml = renderSpeakNotesHtml({ notes: "Cue" }, { speakNotesOpen: true });
  assert.match(openHtml, /<details class="sp-slide-speak-notes" open>/);
});

test("slideNotesText reads string and deck note objects", () => {
  assert.equal(slideNotesText({ notes: "  Hello  " }), "Hello");
  assert.equal(
    slideNotesText({ notes: { presenter_notes: "Deck note" } }),
    "Deck note",
  );
  assert.equal(slideNotesText({ title: "X" }), "");
});

test("renderSlideDetailsHtml includes speak notes section", () => {
  const html = renderSlideDetailsHtml(
    { title: "Slide", slide_uid: "s1", notes: "Say this aloud." },
    0,
    () => "",
  );
  assert.match(html, /Speak Notes/);
  assert.match(html, /Say this aloud/);
});

test("whyFor explains duplicate collapse", () => {
  assert.match(whyFor({ duplicate_count: 3, approval_status: "approved" }), /3 identical copies/);
});

test("createSlideDetailsPanel renders into body element", () => {
  const body = { innerHTML: "", dataset: {}, addEventListener: function () {} };
  const panel = createSlideDetailsPanel({
    bodyEl: body,
    sensitivitySelectId: "spTestSensitivity",
    renderUrl: () => "",
    getTaggedIds: () => new Set(),
  });
  panel.show({ title: "Deck slide", slide_uid: "slide_x", approval_status: "approved" }, 0, {
    fetchExplain: false,
  });
  assert.match(body.innerHTML, /Deck slide/);
  assert.match(body.innerHTML, /slide_x/);
});
