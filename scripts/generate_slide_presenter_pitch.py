#!/usr/bin/env python3
"""Generate slide-presenter/pages/pitch.html from harmonized KE template."""

from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / "knowledge-exchange/pages/pitch.html"
DST = Path(__file__).resolve().parents[2] / "slide-presenter/pages/pitch.html"

text = SRC.read_text(encoding="utf-8")

replacements = [
    ("Knowledge Exchange — Executive Briefing", "Slide Presenter — Executive Briefing"),
    ('aria-label="Knowledge Exchange"', 'aria-label="Slide Presenter"'),
    ("Knowledge<span class=\"accent\"> Exchange</span>", "Slide<span class=\"accent\"> Presenter</span>"),
    ("Knowledge Exchange · Executive Briefing", "Slide Presenter · Executive Briefing"),
    ("ke.pitch.notesOpen", "sp.pitch.notesOpen"),
    ("Knowledge Exchange", "Slide Presenter"),
    (
        "<h1>Turn technical readiness into a <span class=\"accent\">repeatable system.</span></h1>",
        "<h1>Turn scattered decks into a <span class=\"accent\">strategic narrative system.</span></h1>",
    ),
    (
        """          <p class="lead">
            One platform that authors, reviews, publishes, and reinforces technical enablement content —
            so field and sales teams learn faster, deliver consistently, and retain what matters.
          </p>
          <div class="meta">
            <div><b>Strategic impact</b>Governed readiness · measurable recall</div>
            <div><b>Audience</b>Enablement · presales · field engineering · leadership</div>
            <div><b>Outcome</b>Faster readiness, higher retention, lower delivery variance</div>
            <div><b>Format</b>Authoring studio · approval gates · learner portal</div>
          </div>""",
        """          <p class="lead">
            A local-first presentation workbench — search an approved corpus, assemble storyboards,
            deliver with a private presenter console, and export board-ready artifacts on demand.
          </p>
          <div class="meta">
            <div><b>Strategic impact</b>Faster executive alignment · repeatable storytelling</div>
            <div><b>Audience</b>Executives · solutions leaders · program owners · investors</div>
            <div><b>Outcome</b>Find, assemble, and present with defensible artifacts in hours</div>
            <div><b>Format</b>Corpus search · storyboards · notes · export · co-brand ready</div>
          </div>""",
    ),
    (
        """          <li>This is Slide Presenter — the system that standardizes how field and sales teams learn, validate, and retain technical knowledge at scale.</li>
          <li>Format: ten main slides, roughly ten minutes, plus backup slides reachable by typing the slide number. Slide 2 is the whole story on one page; slides 3–6 unpack problem, solution, workflow, and differentiation; slide 7 is the AI-native advantage; slide 8 is proof; slides 9 and 10 are the business case and the ask.</li>
          <li>The line to repeat at the close: <em>turn technical readiness into a repeatable system — not a one-off content push.</em></li>""",
        """          <li>This briefing is on <strong>Slide Presenter</strong> — a customer-neutral presentation workbench. The strategic bet: executive and investor conversations fail when narrative assembly is manual, fragmented, and ungoverned.</li>
          <li>Format: ten main slides, roughly ten minutes, plus backup slides on demand. Slide 2 is the whole story. Slides 3–6 cover problem, solution, workflow, and differentiation. Slide 7 is AI-native velocity. Slide 8 is proof. Slides 9 and 10 are ROI and the ask.</li>
          <li>Close with: <em>find the right visual, assemble the narrative, present with audience-safe delivery</em> — skins, logos, and copy are editable for any customer or investor audience.</li>""",
    ),
    (
        "<h2 class=\"title\">The bottleneck isn't content. It's <span class=\"accent\">consistency, recall, and speed.</span></h2>",
        "<h2 class=\"title\">The bottleneck isn't slides. It's <span class=\"accent\">findability, assembly, and strategic clarity.</span></h2>",
    ),
    (
        "Great technical material already exists — but it is fragmented, unevenly delivered, and quickly forgotten. Slide Presenter turns scattered authoring into one governed lifecycle from creation to measurable learner outcomes.",
        "Approved visuals and narratives already exist — but they live in repos, drives, and one-off exports. Slide Presenter turns scattered deck assets into one governed path from discovery to executive delivery.",
    ),
    (
        """              <li>Enablement content is <b>fragmented</b> across docs, decks, and tribal knowledge.</li>
              <li>Delivery quality <b>varies</b> by author and team.</li>
              <li>Knowledge <b>decays</b> quickly after initial training.</li>""",
        """              <li>Deck assets are <b>fragmented</b> across repos, exports, and presenter notes.</li>
              <li>Story quality <b>varies</b> by author and last-minute assembly.</li>
              <li>Executive messaging <b>drifts</b> between teams and funding conversations.</li>""",
    ),
    (
        """              <li>One platform: <b>create → review → publish → learn → recall</b>.</li>
              <li>Approval-gated <b>consumer / developer</b> views.</li>
              <li>Quizzes and spaced <b>recall</b> built into the learner flow.</li>""",
        """              <li>One workbench: <b>search → assemble → rehearse → present → export</b>.</li>
              <li>Governed <b>corpus + storyboards</b> with presenter-safe views.</li>
              <li>Speaker notes and <b>private console</b> built into delivery.</li>""",
    ),
    (
        """              <li><b>Faster readiness</b> — publish quality modules in a governed flow.</li>
              <li><b>Better retention</b> — reinforcement, not one-time exposure.</li>
              <li><b>Lower variance</b> — consistent, auditable delivery.</li>""",
        """              <li><b>Faster alignment</b> — assemble board-ready narratives in hours.</li>
              <li><b>Stronger impact</b> — strategic emphasis, not slide clutter.</li>
              <li><b>Lower risk</b> — consistent, co-brandable, auditable delivery.</li>""",
    ),
    (
        "<b>One governed lifecycle.</b> Authoring, review, publishing, learning, and recall share a single source of truth — offline-safe by default, with optional live services.",
        "<b>One narrative system.</b> Corpus, storyboards, presenter console, and export share a single source of truth — offline-safe by default, co-brand ready.",
    ),
    (
        "<h2 class=\"title\">Technical knowledge is hard to <span class=\"accent\">operationalize at scale.</span></h2>",
        "<h2 class=\"title\">Executive narratives are hard to <span class=\"accent\">assemble under pressure.</span></h2>",
    ),
    (
        "Content creation is only half the job. Consistency, publishing governance, and long-term retention are where enablement actually breaks down.",
        "Finding a slide is only half the job. Assembly, strategic emphasis, and presenter confidence are where executive briefings actually break down.",
    ),
    (
        """            <div class="stat warn"><div class="num">Weeks</div><div class="label">Concept → publishable quality module</div></div>
            <div class="stat bad"><div class="num">High</div><div class="label">Quality variance across teams</div></div>
            <div class="stat warn"><div class="num">Lag</div><div class="label">Release → real field adoption</div></div>
            <div class="stat bad"><div class="num">Decay</div><div class="label">Retention after initial training</div></div>""",
        """            <div class="stat warn"><div class="num">Days</div><div class="label">Idea → board-ready deck assembly</div></div>
            <div class="stat bad"><div class="num">High</div><div class="label">Narrative variance across presenters</div></div>
            <div class="stat warn"><div class="num">Lag</div><div class="label">Strategy shift → updated story</div></div>
            <div class="stat bad"><div class="num">Risk</div><div class="label">Wrong slide in the wrong room</div></div>""",
    ),
    (
        "<h3>Three questions every enablement owner asks</h3>",
        "<h3>Three questions every executive sponsor asks</h3>",
    ),
    (
        """              <li><b>Is it approved?</b> — who signed off, and is it safe to ship to the field?</li>
              <li><b>Is it consistent?</b> — same quality bar regardless of author.</li>
              <li><b>Did it stick?</b> — can learners recall it weeks later?</li>""",
        """              <li><b>Is it current?</b> — does the story match today's strategic bet?</li>
              <li><b>Is it coherent?</b> — same narrative arc regardless of presenter?</li>
              <li><b>Is it defensible?</b> — can we answer hard questions from backup?</li>""",
    ),
    (
        """              <li>Modules live in scattered docs, decks, and drives.</li>
              <li>No shared quality bar or approval gate before content reaches learners.</li>
              <li>Draft and finished content look identical to the audience.</li>
              <li>Assessment is ad hoc; recall is left to chance.</li>
              <li>No feedback loop from learner back to author.</li>""",
        """              <li>Decks live in scattered repos, exports, and presenter laptops.</li>
              <li>No shared storyboard or approval gate before executive delivery.</li>
              <li>Draft and approved slides look identical in the room.</li>
              <li>Speaker notes are ad hoc; rehearsal is left to chance.</li>
              <li>No feedback loop from the room back to the corpus.</li>""",
    ),
    (
        "<span class=\"eyebrow\">Introducing Slide Presenter</span>",
        "<span class=\"eyebrow\">Introducing Slide Presenter</span>",
    ),
    (
        "<h2 class=\"title\">One platform, from authoring to <span class=\"accent\">learner recall.</span></h2>",
        "<h2 class=\"title\">One workbench, from corpus to <span class=\"accent\">executive delivery.</span></h2>",
    ),
    (
        "A full lifecycle system — not a static content repository — that turns objectives into governed, measurable enablement.",
        "A full presentation system — not a static slide export — that turns strategic objectives into governed, repeatable executive narratives.",
    ),
    (
        """              <span class="pill accent">Create Studio</span>
              <span class="pill accent">Review &amp; Approval</span>
              <span class="pill accent">Learner Portal</span>
              <span class="pill accent">Pathways</span>
              <span class="pill accent">Quiz &amp; Recall</span>
              <span class="pill">Artifacts &amp; Reports</span>""",
        """              <span class="pill accent">Corpus Search</span>
              <span class="pill accent">Storyboards</span>
              <span class="pill accent">Presenter Console</span>
              <span class="pill accent">Speaker Notes</span>
              <span class="pill accent">Live Delivery</span>
              <span class="pill">PDF / Export</span>""",
    ),
    (
        """            <li><b>Create Studio:</b> define objectives, ground with sources, generate lesson / slide / script artifacts.</li>
            <li><b>Review gates:</b> stage-gated approval before content reaches learners.</li>
            <li><b>Learner portal:</b> catalog, pathways, and content grouped for discovery.</li>
            <li><b>Reinforcement:</b> per-module quizzes plus spaced recall in Progress.</li>
            <li><b>Offline-safe:</b> works from static files; live services are optional.</li>""",
        """            <li><b>Corpus search:</b> find approved slides, visuals, and narrative blocks fast.</li>
            <li><b>Storyboards:</b> assemble executive arcs with strategic emphasis built in.</li>
            <li><b>Presenter console:</b> private notes, pacing, and audience-safe delivery.</li>
            <li><b>Export:</b> PDF and deck artifacts for follow-up and governance.</li>
            <li><b>Offline-safe:</b> works from static files; co-brand skins are editable.</li>""",
    ),
    (
        "<h3>Two audiences, one system</h3>",
        "<h3>Two modes, one system</h3>",
    ),
    (
        """              <li><b>Consumer (learner):</b> sees only approved, ready-to-ship material.</li>
              <li><b>Developer (author):</b> sees approved + in-development, with studio and pipeline tools.</li>""",
        """              <li><b>Presenter mode:</b> audience-safe delivery with private speaker notes.</li>
              <li><b>Curator mode:</b> assemble, approve, and maintain the governed corpus.</li>""",
    ),
    (
        "<b>Same source of truth.</b> Both audiences read the same manifest; visibility is governed by approval status, not by duplicated content.",
        "<b>Same source of truth.</b> Storyboards reference the governed corpus — no duplicate slide libraries or divergent narratives.",
    ),
    (
        "<h2 class=\"title\">Define · Ground · Generate · Review · Publish · <span class=\"accent\">Reinforce.</span></h2>",
        "<h2 class=\"title\">Search · Assemble · Rehearse · Present · Export · <span class=\"accent\">Improve.</span></h2>",
    ),
    (
        "One connected flow that mirrors how enablement is actually produced — and closes the loop with measurable learner recall.",
        "One connected flow that mirrors how executive narratives are actually built — and closes the loop with room feedback into the corpus.",
    ),
    (
        """          <div class="card"><h3>1 · Define</h3><p>Set the module objective, audience, level, and target formats.</p></div>
          <div class="card"><h3>2 · Ground</h3><p>Add source material so generation is anchored in real evidence.</p></div>
          <div class="card"><h3>3 · Generate</h3><p>Produce lesson plan, slides, script, and quiz artifacts.</p></div>
          <div class="card"><h3>4 · Review</h3><p>Run stage-gated review and approval before anything ships.</p></div>
          <div class="card"><h3>5 · Publish</h3><p>Approved modules become visible to learners in the portal.</p></div>
          <div class="card"><h3>6 · Reinforce</h3><p>Capture quiz and recall signals to drive continuous improvement.</p></div>""",
        """          <div class="card"><h3>1 · Search</h3><p>Find approved slides and narrative blocks in the governed corpus.</p></div>
          <div class="card"><h3>2 · Assemble</h3><p>Build a storyboard with strategic emphasis and executive arc.</p></div>
          <div class="card"><h3>3 · Rehearse</h3><p>Walk speaker notes and backup paths before the room.</p></div>
          <div class="card"><h3>4 · Present</h3><p>Deliver with private console, pacing, and audience-safe views.</p></div>
          <div class="card"><h3>5 · Export</h3><p>Ship PDF or deck artifacts for follow-up and governance.</p></div>
          <div class="card"><h3>6 · Improve</h3><p>Feed room feedback back into corpus and storyboard priorities.</p></div>""",
    ),
    (
        "<b>The loop closes.</b> Recall and quiz signals feed back into authoring priorities — enablement becomes a system that improves, not a one-time release.",
        "<b>The loop closes.</b> Room feedback feeds back into corpus curation — executive narrative becomes a system that improves, not a one-off deck build.",
    ),
    (
        "<h2 class=\"title\">Not just an LMS. A governed <span class=\"accent\">enablement operating model.</span></h2>",
        "<h2 class=\"title\">Not just a slide viewer. A governed <span class=\"accent\">narrative operating model.</span></h2>",
    ),
    (
        "Content hosting is the easy part. The advantage is governance, generated-and-auditable artifacts, and built-in retention.",
        "Slide rendering is the easy part. The advantage is corpus governance, strategic storyboards, and presenter-ready delivery.",
    ),
    (
        "<h4>Traditional LMS / doc host</h4>",
        "<h4>Traditional deck tools</h4>",
    ),
    (
        """              <li>Static content hosting</li>
              <li>No authoring-to-approval governance</li>
              <li>Uniform visibility regardless of readiness</li>
              <li>Assessment bolted on, if present</li>
              <li>Retention left to the learner</li>""",
        """              <li>Static file export and manual assembly</li>
              <li>No corpus governance or approval gates</li>
              <li>Presenter notes scattered across tools</li>
              <li>Strategic emphasis left to last-minute edits</li>
              <li>No feedback loop after the room</li>""",
    ),
    (
        """              <li><b>Full lifecycle</b> from objective to recall</li>
              <li><b>Approval-gated</b> consumer / developer views</li>
              <li><b>Generated + auditable</b> artifacts</li>
              <li><b>Quiz + spaced recall</b> built in</li>
              <li><b>Offline-safe</b>, with optional live integrations</li>""",
        """              <li><b>Full lifecycle</b> from corpus to export</li>
              <li><b>Governed storyboards</b> with presenter / curator modes</li>
              <li><b>Strategic emphasis</b> built into assembly</li>
              <li><b>Private presenter console</b> built in</li>
              <li><b>Offline-safe</b>, co-brand ready</li>""",
    ),
    (
        "<div class=\"label\">Governed lifecycle</div>",
        "<div class=\"label\">Governed narrative lifecycle</div>",
    ),
    (
        "<h2 class=\"title\">Already a working system — <span class=\"accent\">not a concept.</span></h2>",
        "<h2 class=\"title\">Already a working workbench — <span class=\"accent\">not a concept.</span></h2>",
    ),
    (
        "Concrete, reproducible workflows are shipping today: a full module catalog, generated artifacts, approval gating, and built-in recall.",
        "Concrete, reproducible workflows ship today: harmonized pitch decks, shared shell, presenter navigation, notes panel, and export paths across sibling tools.",
    ),
    (
        """          <div class="stat"><div class="num">39<span class="unit">modules</span></div><div class="label">Across 6 domains</div></div>
          <div class="stat"><div class="num">Per-module<span class="unit">quiz</span></div><div class="label">Key-takeaway checks</div></div>
          <div class="stat"><div class="num">2<span class="unit">profiles</span></div><div class="label">Approval-gated views</div></div>
          <div class="stat good"><div class="num">100%<span class="unit">offline</span></div><div class="label">Static-safe, no SaaS required</div></div>""",
        """          <div class="stat"><div class="num">6<span class="unit">tools</span></div><div class="label">Harmonized pitch decks</div></div>
          <div class="stat"><div class="num">10<span class="unit">slides</span></div><div class="label">Canonical executive arc</div></div>
          <div class="stat"><div class="num">1<span class="unit">shell</span></div><div class="label">Shared webtools-ui chrome</div></div>
          <div class="stat good"><div class="num">100%<span class="unit">offline</span></div><div class="label">Static-safe, co-brand ready</div></div>""",
    ),
    (
        """              <li>End-to-end module artifact generation.</li>
              <li>Per-module quizzes wired into Progress and Recall.</li>
              <li>Consumer / developer approval gating across the portal.</li>""",
        """              <li>Harmonized executive pitch decks across consumer tools.</li>
              <li>Shared notes panel, navigation, and export conventions.</li>
              <li>Customer-neutral positioning and co-brand skins.</li>""",
    ),
    (
        """              <li>Reproducible manifest and quiz-bank generation.</li>
              <li>Freshness checks guard against stale artifacts.</li>
              <li>Shared component layer with standardized APIs.</li>""",
        """              <li>Reproducible deck structure via canonical pitch skeleton.</li>
              <li>Strategic-impact meta blocks on every title slide.</li>
              <li>Shared component layer with standardized APIs.</li>""",
    ),
    (
        "Impact is cross-functional — enablement, field, program, and leadership all gain from one governed system.",
        "Impact is cross-functional — executives, program owners, solutions leaders, and investors all gain from one governed narrative system.",
    ),
    (
        """            <tr><th>Persona</th><th>Today</th><th>With Slide Presenter</th><th>Gain</th></tr>
          </thead>
          <tbody>
            <tr><td><b>Enablement lead</b></td><td>Inconsistent, manual publishing</td><td>Governed authoring + approval</td><td class="good">Standardized quality</td></tr>
            <tr><td><b>Solutions architect</b></td><td>Rebuilds narrative per engagement</td><td>Consistent, reusable modules</td><td class="good">Faster delivery</td></tr>
            <tr><td><b>Field engineer</b></td><td>Forgets after one-time training</td><td>Quiz + spaced recall</td><td class="good">Better retention</td></tr>
            <tr><td><b>Program owner</b></td><td>No adoption signal</td><td>Progress + recall analytics</td><td class="good">Measurable adoption</td></tr>
            <tr><td><b>Leadership</b></td><td>Unpredictable ramp</td><td>Repeatable readiness system</td><td class="good">Lower ramp time</td></tr>""",
        """            <tr><th>Persona</th><th>Today</th><th>With Slide Presenter</th><th>Gain</th></tr>
          </thead>
          <tbody>
            <tr><td><b>Executive sponsor</b></td><td>Last-minute deck assembly</td><td>Governed storyboards + backup pack</td><td class="good">Confident delivery</td></tr>
            <tr><td><b>Solutions leader</b></td><td>Rebuilds narrative per engagement</td><td>Reusable executive arcs</td><td class="good">Faster alignment</td></tr>
            <tr><td><b>Program owner</b></td><td>No corpus governance</td><td>Approved slide corpus</td><td class="good">Lower narrative drift</td></tr>
            <tr><td><b>Investor / board</b></td><td>Inconsistent strategic emphasis</td><td>Repeatable funding narrative</td><td class="good">Clearer ask</td></tr>
            <tr><td><b>Curator</b></td><td>Scattered assets</td><td>One workbench for corpus + export</td><td class="good">Operational leverage</td></tr>""",
    ),
    (
        "<div class=\"label\">Platform, whole lifecycle</div>",
        "<div class=\"label\">Workbench, whole lifecycle</div>",
    ),
    (
        "<div class=\"label\">Approved content is governed</div>",
        "<div class=\"label\">Approved narratives are governed</div>",
    ),
    (
        "<h1>One system. <span class=\"accent\">Every enablement track.</span></h1>",
        "<h1>One workbench. <span class=\"accent\">Every executive narrative.</span></h1>",
    ),
    (
        "<p class=\"subtitle\">Start small, prove fast, then institutionalize the operating model.</p>",
        "<p class=\"subtitle\">Start with one strategic narrative, prove impact fast, then institutionalize the operating model.</p>",
    ),
    (
        """        <div class="card"><h3>Pilot · 30 days</h3><p>Roll out one domain with explicit success criteria and an approved module set.</p></div>
        <div class="card"><h3>Expand · 90 days</h3><p>Scale approved modules and turn on recall-driven adoption analytics.</p></div>
        <div class="card"><h3>Standardize · 2H</h3><p>Make Slide Presenter the default enablement operating model.</p></div>""",
        """        <div class="card"><h3>Pilot · 30 days</h3><p>Stand up one executive narrative with explicit success criteria and a governed storyboard.</p></div>
        <div class="card"><h3>Expand · 90 days</h3><p>Harmonize pitch decks across tools and scale the approved corpus.</p></div>
        <div class="card"><h3>Standardize · 2H</h3><p>Make Slide Presenter the default executive and investor briefing workbench.</p></div>""",
    ),
    (
        "<h2 class=\"title\">Architecture &amp; <span class=\"accent\">component model</span></h2>",
        "<h2 class=\"title\">Workbench &amp; <span class=\"accent\">integration model</span></h2>",
    ),
    (
        "<h2 class=\"title\">Governance &amp; <span class=\"accent\">approval workflow</span></h2>",
        "<h2 class=\"title\">Corpus &amp; <span class=\"accent\">storyboard governance</span></h2>",
    ),
    (
        "Approval status controls what learners can see — enforced consistently across the portal.",
        "Approval status controls what presenters can ship — enforced consistently across storyboards and export.",
    ),
    (
        "<h2 class=\"title\">Content operations &amp; <span class=\"accent\">reproducibility</span></h2>",
        "<h2 class=\"title\">Export &amp; <span class=\"accent\">reproducibility</span></h2>",
    ),
]

for old, new in replacements:
    if old not in text:
        continue
    text = text.replace(old, new)

DST.write_text(text, encoding="utf-8")
print(f"wrote {DST}")
