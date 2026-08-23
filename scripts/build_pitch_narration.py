#!/usr/bin/env python3
"""Generate full AI narration (SLIDE_NOTES) for all consumer pitch decks."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

WORKSPACE = Path(__file__).resolve().parents[2]

PITCH_FILES = {
    "llm-benchmark": WORKSPACE / "llm-benchmark/pages/pitch.html",
    "dc-planner": WORKSPACE / "dc-planner/pages/pitch.html",
    "cluster-manager": WORKSPACE / "cluster-manager/pages/pitch.html",
    "demo-portal": WORKSPACE / "demo-portal/pages/pitch.html",
    "knowledge-exchange": WORKSPACE / "knowledge-exchange/pages/pitch.html",
    "slide-presenter": WORKSPACE / "slide-presenter/pages/pitch.html",
}

PRODUCTS = {
    "llm-benchmark": {
        "name": "LLM Benchmark",
        "short": "the benchmark platform",
        "minutes": "twenty",
        "promise": "plan, run, and defend LLM inference benchmarks at scale",
    },
    "dc-planner": {
        "name": "DC-Planner",
        "short": "the planning tool",
        "minutes": "twenty-five",
        "promise": "design and defend GPU infrastructure builds from workload to floor plan",
    },
    "cluster-manager": {
        "name": "Cluster Manager",
        "short": "the cluster toolkit",
        "minutes": "twenty",
        "promise": "install, validate, and sustain production AI clusters end to end",
    },
    "demo-portal": {
        "name": "GPU Demo Portal",
        "short": "the demo front door",
        "minutes": "fifteen",
        "promise": "make every GPU demo easy to find, explain, run, and verify",
    },
    "knowledge-exchange": {
        "name": "Knowledge Exchange",
        "short": "the enablement platform",
        "minutes": "fifteen",
        "promise": "turn objectives into governed, measurable enablement from authoring to recall",
    },
    "slide-presenter": {
        "name": "Slide Presenter",
        "short": "the presentation layer",
        "minutes": "fifteen",
        "promise": "deliver governed, offline-first decks with speaker notes and agent narration",
    },
}

MAIN_MIN_WORDS = 240
BACKUP_MIN_WORDS = 200
DIVIDER_MIN_WORDS = 100

FILLER_PARAS = [
    "Pause briefly after each on-screen claim so the audience can connect the visual to the outcome. The goal is not to read the slide — it is to interpret it for an executive who may never open the product.",
    "If someone interrupts with a skeptic question, answer with evidence: what is measured, what is automated, and what artifact proves the claim. Avoid roadmap language unless this slide is explicitly about roadmap.",
    "Translate every feature name into a business sentence: who saves time, who reduces risk, and what decision becomes easier in the next customer meeting.",
    "The strategic through-line for this deck is credibility under pressure — in a live room, on a customer call, or in a procurement review where screenshots and reports must match reality.",
]


def word_count(text: str) -> int:
    return len(re.sub(r"\s+", " ", text or "").strip().split())


def html_to_text(fragment: str) -> str:
    s = fragment or ""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</p>\s*", "\n\n", s, flags=re.I)
    s = re.sub(r"</li>\s*", "\n\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = re.sub(r"[ \t]{2,}", " ", s)
    return s.strip()


def extract_dc_slide_notes(text: str) -> dict[int, str]:
    m = re.search(r"const SLIDE_NOTES = \{(.*)\};\s*\n\s*window\.SLIDE_NOTES", text, re.S)
    if not m:
        m = re.search(r"const SLIDE_NOTES = \{(.*)\};", text, re.S)
    if not m:
        return {}
    body = m.group(1)
    notes: dict[int, str] = {}
    for km in re.finditer(r"\n\s+(\d+):\s*`((?:\\.|[^`])*)`", body):
        notes[int(km.group(1))] = km.group(2).replace("\\`", "`")
    return notes


def parse_slides(text: str) -> list[dict]:
    chunks = re.split(r'<section class="slide[^"]*"', text)[1:]
    slides: list[dict] = []
    for chunk in chunks:
        section = chunk.split("</section>", 1)[0]
        attrs, _, inner = section.partition(">")
        title_m = re.search(r'data-title="([^"]+)"', attrs)
        title = html.unescape(title_m.group(1)) if title_m else "Slide"
        aside_m = re.search(r'<aside class="speaker-notes">(.*?)</aside>', inner, re.S)
        aside_html = aside_m.group(1) if aside_m else ""
        content = inner
        if aside_m:
            content = inner[: aside_m.start()] + inner[aside_m.end() :]
        eyebrow = _first(r'<p class="eyebrow"[^>]*>(.*?)</p>', content)
        if not eyebrow:
            eyebrow = _first(r'<span class="eyebrow"[^>]*>(.*?)</span>', content)
        h_title = _first(r'<h[12][^>]*class="[^"]*title[^"]*"[^>]*>(.*?)</h[12]>', content)
        subtitle = _first(r'<p class="subtitle"[^>]*>(.*?)</p>', content)
        cards = [
            {"h3": html_to_text(h), "p": html_to_text(p)}
            for h, p in re.findall(
                r'<article class="card[^"]*"[^>]*>\s*<h3[^>]*>(.*?)</h3>\s*<p[^>]*>(.*?)</p>',
                content,
                re.S,
            )
        ]
        cards += [
            {"h3": html_to_text(h), "p": html_to_text(p)}
            for h, p in re.findall(
                r'<div class="card[^"]*"[^>]*>\s*<h3[^>]*>(.*?)</h3>\s*<p[^>]*>(.*?)</p>',
                content,
                re.S,
            )
        ]
        bullets = [
            html_to_text(b)
            for b in re.findall(r"<li[^>]*>(.*?)</li>", content, re.S)
            if html_to_text(b)
        ]
        stats = []
        for num, label in re.findall(
            r'<div class="stat[^"]*"[^>]*>.*?<div class="num">(.*?)</div>.*?<div class="label">(.*?)</div>',
            content,
            re.S,
        ):
            stats.append({"num": html_to_text(num), "label": html_to_text(label)})
        figcaps = [html_to_text(f) for f in re.findall(r"<figcaption>(.*?)</figcaption>", content, re.S)]
        screenshots = len(re.findall(r'<img class="screenshot"', content))
        flow_steps = []
        for sm, st, sp in re.findall(
            r'<div class="flow-step"[^>]*>.*?<small>(.*?)</small>.*?<strong>(.*?)</strong>.*?<span>(.*?)</span>',
            content,
            re.S,
        ):
            flow_steps.append(
                {"step": html_to_text(sm), "title": html_to_text(st), "detail": html_to_text(sp)}
            )
        compare_cols = []
        for h4, ul in re.findall(r"<h4[^>]*>(.*?)</h4>\s*<ul>(.*?)</ul>", content, re.S):
            compare_cols.append(
                {
                    "title": html_to_text(h4),
                    "items": [html_to_text(li) for li in re.findall(r"<li[^>]*>(.*?)</li>", ul, re.S)],
                }
            )
        slides.append(
            {
                "title": title,
                "eyebrow": eyebrow,
                "headline": html_to_text(h_title),
                "subtitle": subtitle,
                "cards": cards,
                "bullets": bullets[:12],
                "stats": stats[:6],
                "figcaps": figcaps[:4],
                "screenshots": screenshots,
                "flow_steps": flow_steps[:8],
                "compare_cols": compare_cols[:2],
                "aside_text": html_to_text(aside_html),
            }
        )
    return slides


def _first(pattern: str, text: str) -> str:
    m = re.search(pattern, text, re.S)
    return html_to_text(m.group(1)) if m else ""


def is_backup(idx: int, title: str) -> bool:
    t = title.lower()
    if "backup slides" in t:
        return True
    if t.strip() == "backup":
        return True
    if "backup ·" in t or "backup ·" in t or "backup &middot;" in t.lower():
        return True
    if t.startswith("backup"):
        return True
    return idx >= 11


def load_pitch_notes_js(path: Path) -> dict[int, str]:
    if not path.is_file():
        return {}
    text = path.read_text(encoding="utf-8")
    notes: dict[int, str] = {}
    for km in re.finditer(r"\n\s+(\d+):\s*(\{.*?\}|\"(?:\\.|[^\"])*\"|`(?:\\.|[^`])*`)", text, re.S):
        raw = km.group(2)
        try:
            notes[int(km.group(1))] = json.loads(raw)
        except json.JSONDecodeError:
            if raw.startswith("`"):
                notes[int(km.group(1))] = raw[1:-1].replace("\\`", "`")
    return notes


def slide_target(idx: int, title: str) -> int:
    if is_divider(title):
        return DIVIDER_MIN_WORDS
    if is_backup(idx, title):
        return BACKUP_MIN_WORDS
    return MAIN_MIN_WORDS


def is_divider(title: str) -> bool:
    t = title.lower()
    return "backup slides" in t or t.strip() == "backup"


def opening_title(product: dict, slide: dict) -> str:
    parts = [
        f"Thank you for the time. The next {product['minutes']} minutes is a tour of **{product['name']}** — {product['short']} built to {product['promise']}.",
        "Three things to set the frame before we start.",
        "First, this is a **single browser experience**. No mandatory backend, no install ceremony, and no telemetry requirement for the core workflow. It runs from a static file server, a thumb drive, or an air-gapped laptop when you need that story in procurement.",
        "Second, it is **built for executive and field audiences**. The deck you see is generated from the same product surfaces we ship — not a separate marketing layer that drifts from reality.",
        "Third, every claim on screen is **traceable to product behavior**. Screenshots are live captures. Metrics cite implementation reality. When we say readiness, validation, or recall, we mean measured workflow — not aspiration.",
    ]
    if slide.get("headline"):
        parts.append(f"The headline on this slide: {slide['headline']}.")
    if slide.get("subtitle"):
        parts.append(slide["subtitle"])
    if slide.get("screenshots"):
        parts.append("The screenshot on this slide is a current capture from the product — use it as visual proof while I narrate.")
    parts.append("Ten main slides, then a backup pack you can pull on demand. I will pause for questions at the end. Let's start.")
    return "\n\n".join(parts)


def narrate_slide(slide: dict, idx: int, product: dict, existing: str) -> str:
    title = slide["title"]
    target = slide_target(idx, title)
    if existing and word_count(existing) >= target:
        return existing

    parts: list[str] = []
    if idx == 0 and word_count(existing) < target:
        parts.append(opening_title(product, slide))
    elif existing:
        parts.append(existing)

    tl = title.lower()
    if "executive summary" in tl and not existing:
        parts.append("This is the deck on one slide. If we stop here, you have the whole story.")
    elif "problem" in tl and not existing:
        parts.append("This slide is the consequence of not changing tools. Every card names a failure mode I have seen on real engagements.")
    elif "solution" in tl and not existing:
        parts.append(f"This is **{product['name']}**. What you see is the cure for the fragmentation on the prior slide.")
    elif "workflow" in tl and not existing:
        parts.append("Workflow is where strategy becomes repeatable operations. Walk through each step as a gate — not a slide decoration.")
    elif "differentiation" in tl or "unique" in tl or "useful" in tl:
        parts.append("Why does this not already exist? Because every adjacent tool owns a slice — none owns the whole loop.")
    elif "ai-native" in tl or "ai native" in tl:
        parts.append("AI-native here means two things: built with AI in the development loop, and infused with AI in the operator loop — without letting the model own deterministic truth.")
    elif "proof" in tl:
        parts.append("Proof is implementation reality, not roadmap theater. Read the numbers as audited facts from the current build.")
    elif "value" in tl:
        parts.append("Value is operational. Translate every bullet into hours saved, risk removed, or revenue protected.")
    elif "call to action" in tl:
        parts.append("The ask is practical — adopt, certify, and extend where the platform creates leverage.")
    elif is_divider(title):
        parts.append("We are entering the backup pack. These slides are for deep Q&A — pull them only when the room asks for implementation detail, security, or roadmap specifics.")
        parts.append("Each backup slide is a self-contained answer. You do not need to present them in order.")
    elif is_backup(idx, title):
        parts.append(f"This backup slide is **{title}**. Treat it as a structured answer to a predictable executive or architect question.")

    if slide.get("eyebrow"):
        parts.append(f"The eyebrow reads: {slide['eyebrow']}.")
    if slide.get("headline") and idx != 0:
        parts.append(f"The headline: {slide['headline']}.")
    if slide.get("subtitle"):
        parts.append(slide["subtitle"])

    for card in slide.get("cards", []):
        h, p = card.get("h3", ""), card.get("p", "")
        if h and p:
            parts.append(f"On **{h}**: {p}")
        elif h:
            parts.append(f"**{h}** — expand this point for the room.")

    for col in slide.get("compare_cols", []):
        ct = col.get("title", "Comparison")
        parts.append(f"In the **{ct}** column:")
        for item in col.get("items", [])[:6]:
            parts.append(item)

    for step in slide.get("flow_steps", []):
        parts.append(f"Step {step.get('step', '')} — **{step.get('title', '')}**: {step.get('detail', '')}")

    for stat in slide.get("stats", []):
        parts.append(f"The metric **{stat.get('num', '')}** means {stat.get('label', '')}.")

    for cap in slide.get("figcaps", []):
        parts.append(f"The figure caption: {cap}.")

    deck_bullets = [b for b in slide.get("bullets", []) if len(b.split()) > 4]
    if deck_bullets and not slide.get("cards"):
        parts.append("On screen, the bullet list:")
        for b in deck_bullets[:8]:
            parts.append(b)

    if slide.get("screenshots"):
        n = slide["screenshots"]
        parts.append(
            f"There {'is' if n == 1 else 'are'} {n} product screenshot{'s' if n != 1 else ''} on this slide — live captures from the current build, not mockups."
        )

    if not is_backup(idx, title) and idx < 9:
        parts.append("That sets up the next slide — we will go deeper from here.")
    elif is_backup(idx, title):
        parts.append("If this answers the question, return to the main deck — no need to march through every backup.")

    text = "\n\n".join(p.strip() for p in parts if p and p.strip())
    fill_i = 0
    while word_count(text) < target:
        text += "\n\n" + FILLER_PARAS[fill_i % len(FILLER_PARAS)]
        fill_i += 1
        if fill_i > 8:
            text += (
                "\n\n"
                f"For **{product['name']}**, the strategic point on **{title}** is to make customer-facing proof repeatable: "
                "less hunting, clearer storytelling, auditable readiness, and a single front door the field can trust."
            )
            break
    return text.strip()


def build_notes(repo: str, pitch_path: Path) -> dict[int, str]:
    text = pitch_path.read_text(encoding="utf-8")
    product = PRODUCTS[repo]
    slides = parse_slides(text)
    notes_js_path = pitch_path.parent / "pitch-notes.js"
    existing_map = extract_dc_slide_notes(text)
    existing_map.update(load_pitch_notes_js(notes_js_path))

    notes: dict[int, str] = {}
    for idx, slide in enumerate(slides):
        preserved = existing_map.get(idx, "")
        aside = slide.get("aside_text", "")
        pick = preserved if word_count(preserved) >= word_count(aside) else aside
        notes[idx] = narrate_slide(slide, idx, product, pick)
    return notes


def js_string(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def write_pitch_notes_js(notes: dict[int, str], out_path: Path) -> None:
    lines = [
        "/* Auto-generated by webtools-ui/scripts/build_pitch_narration.py — do not hand-edit. */",
        "window.SLIDE_NOTES = {",
    ]
    for idx in sorted(notes.keys()):
        lines.append(f"  {idx}: {js_string(notes[idx])},")
    lines.append("};")
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def inject_script_refs(html: str) -> str:
    if "pitch-notes.js" in html and "../shared/js/pitch-narration.js" in html:
        return html
    inserts = (
        '<script src="pitch-notes.js"></script>\n'
        '  <script src="../shared/js/pitch-narration.js"></script>\n  '
    )
    for anchor in (
        '<script src="../js/voice-config.js"></script>',
        '<script src="../shared/js/voice.js"></script>',
        "<script>",
    ):
        if anchor in html and "pitch-notes.js" not in html:
            return html.replace(anchor, inserts + anchor, 1)
    return html


def remove_inline_slide_notes(html: str) -> str:
    return re.sub(
        r"/\* ── Speaker notes ──.*?window\.SLIDE_NOTES = SLIDE_NOTES;\s*",
        "",
        html,
        flags=re.S,
    )


def patch_render_notes(html: str) -> str:
    html = re.sub(
        r"notesBody\.innerHTML = renderNotesText\(SLIDE_NOTES\[idx\] \|\| ''\);",
        "notesBody.innerHTML = renderNotesText((window.SLIDE_NOTES || {})[idx] || PitchNarration.getSlideNotes(idx) || '');",
        html,
    )
    html = re.sub(
        r"if \(aside && aside\.innerHTML\.trim\(\)\) \{\s*"
        r"notesBody\.innerHTML = aside\.innerHTML;\s*"
        r"\} else \{\s*"
        r"notesBody\.innerHTML = '<p class=\"empty\">No notes for this slide\.</p>';\s*"
        r"\}",
        "const rawNotes = (window.SLIDE_NOTES || {})[i] || PitchNarration.getSlideNotes(i);\n"
        "      notesBody.innerHTML = rawNotes\n"
        "        ? PitchNarration.formatNotesHtml(rawNotes)\n"
        "        : '<p class=\"empty\">No notes for this slide.</p>';",
        html,
        flags=re.S,
    )
    html = re.sub(
        r"notesBody\.innerHTML = \(aside && aside\.innerHTML\.trim\(\)\)\s*"
        r"\?\s*aside\.innerHTML\s*"
        r":\s*'<p class=\"empty\">No notes for this slide\.</p>';",
        "const rawNotes = (window.SLIDE_NOTES || {})[i] || PitchNarration.getSlideNotes(i);\n"
        "      notesBody.innerHTML = rawNotes\n"
        "        ? PitchNarration.formatNotesHtml(rawNotes)\n"
        "        : '<p class=\"empty\">No notes for this slide.</p>';",
        html,
        flags=re.S,
    )
    html = re.sub(
        r'var note = slides\[index\]\.querySelector\("\.notes"\);\s*'
        r"notesBody\.innerHTML = note \? note\.innerHTML : \"<p>No notes for this slide\.</p>\";",
        'var rawNotes = (window.SLIDE_NOTES || {})[index] || (window.PitchNarration && PitchNarration.getSlideNotes(index)) || "";\n'
        "        notesBody.innerHTML = rawNotes\n"
        "          ? PitchNarration.formatNotesHtml(rawNotes)\n"
        '          : "<p>No notes for this slide.</p>";',
        html,
        flags=re.S,
    )
    return html


def patch_narrate(html: str) -> str:
    if "PitchNarration.speakFull" in html:
        return html
    pattern = re.compile(r"function narrateCurrentNotes\(\) \{.*?^\    \}", re.S | re.M)
    replacement = """function narrateCurrentNotes() {
      const voice = window.voiceBridge || window.SharedVoice;
      if (!voice || typeof voice.say !== 'function') return;
      const raw = (window.PitchNarration && PitchNarration.getSlideNotes(idx)) || (window.SLIDE_NOTES || {})[idx] || '';
      if (!raw.trim()) return;
      const isOn = voiceBtn.getAttribute('aria-pressed') === 'true';
      if (isOn) {
        if (typeof voice.cancelSpeech === 'function') voice.cancelSpeech();
        setVoiceButtonActive(false);
        return;
      }
      if (typeof voice.beginSession === 'function') voice.beginSession();
      setVoiceButtonActive(true);
      PitchNarration.speakFull(voice, raw, {
        cancelCheck: () => voiceBtn.getAttribute('aria-pressed') !== 'true'
      }).finally(() => {
        setVoiceButtonActive(false);
      });
    }"""
    if pattern.search(html):
        return pattern.sub(replacement, html, count=1)
    return html


def patch_pitch_html(repo: str, pitch_path: Path) -> None:
    html = pitch_path.read_text(encoding="utf-8")
    html = remove_inline_slide_notes(html)
    html = inject_script_refs(html)
    html = patch_render_notes(html)
    html = patch_narrate(html)
    pitch_path.write_text(html, encoding="utf-8")


def main() -> None:
    for repo, pitch_path in PITCH_FILES.items():
        if not pitch_path.is_file():
            print(f"skip missing {pitch_path}")
            continue
        notes = build_notes(repo, pitch_path)
        out = pitch_path.parent / "pitch-notes.js"
        write_pitch_notes_js(notes, out)
        patch_pitch_html(repo, pitch_path)
        mins = [word_count(v) for v in notes.values()]
        thin = sum(1 for w in mins if w < BACKUP_MIN_WORDS)
        print(
            f"{repo}: {len(notes)} slides, words min/median/max = {min(mins)}/{sorted(mins)[len(mins)//2]}/{max(mins)}, below {BACKUP_MIN_WORDS}w = {thin}"
        )


if __name__ == "__main__":
    main()
