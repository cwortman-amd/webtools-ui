#!/usr/bin/env python3
"""Harmonize consumer pitch.html decks: generic branding + strategic emphasis."""

from __future__ import annotations

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

# Longer / more specific patterns first.
GLOBAL_REPLACEMENTS: list[tuple[str, str]] = [
    ("Executive Briefing (AMD)", "Executive Briefing"),
    ('aria-label="AMD"', 'aria-label="Brand accent"'),
    ("AMD brand palette", "Executive briefing palette"),
    ("AMD col-card style", "card style"),
    ("AMD .kpi pattern", "KPI pattern"),
    ("AMD .exec-list", "exec-list"),
    ("AMD style:", "deck style:"),
    ("AMD .exec-table", "exec-table"),
    ("AMD arrow on the left", "brand accent on the left"),
    ("AMD GPU Demo Portal", "GPU Demo Portal"),
    ("AMD Instinct LLM inference", "LLM inference at scale"),
    ("AMD Instinct LLM benchmarks", "LLM inference benchmarks"),
    ("AMD Instinct LLM benchmark", "LLM inference benchmark"),
    ("AMD Instinct deployments", "production GPU deployments"),
    ("AMD Instinct customer conversations", "customer conversations"),
    ("AMD Instinct demo discovery", "GPU demo discovery"),
    ("AMD Instinct stories repeatable", "platform stories repeatable"),
    ("AMD Instinct stories", "platform value stories"),
    ("AMD demo front door", "organization-wide demo front door"),
    ("AMD enablement track", "enablement track"),
    ("AMD vs NVIDIA evidence", "vendor-neutral head-to-head evidence"),
    ("AMD vs NVIDIA", "primary vs alternative platform"),
    ("AMD recommendation", "platform recommendation"),
    ("AMD deals", "strategic infrastructure engagements"),
    ("AMD red on black", "accent theme on dark"),
    ("Theme: AMD red", "Theme: accent red"),
    ("AMD AI stack", "full AI stack"),
    ("AMD AI customer", "AI infrastructure customer"),
    ("AMD cluster bring-up", "cluster bring-up"),
    (
        "AMD ROCm and Pollara cluster bring-up toolkit",
        "multi-vendor cluster bring-up toolkit",
    ),
    ("AMD's AI cluster moment", "The AI cluster deployment moment"),
    ("Every AMD Instinct LLM benchmark.", "Every defensible LLM benchmark."),
    ("Every AMD GPU demo should", "Every GPU demo should"),
    ("Every AMD cluster bring-up.", "Every cluster bring-up."),
    ("Every AMD enablement track.", "Every enablement track."),
    ("internal AMD tool", "internal planning tool"),
    ("Built for AMD AAC and customer-on-prem", "Built for enterprise compliance and on-prem"),
    ("Built for AMD AAC", "Built for enterprise compliance programs"),
    ("AMD · Pollara · NVIDIA-Mellanox · SONiC", "GPU · NIC · optics · switch OS"),
    ("Operationalizing the AMD AI cluster.", "Operationalizing the AI cluster lifecycle."),
    ("AMD GPU story", "platform value story"),
    ("AMD value", "platform value"),
    ("for AMD Instinct", "for accelerator infrastructure"),
    ("AMD Instinct", "accelerator platform"),
    (" on Instinct hardware", " on target accelerator hardware"),
    ("standard pre-sales evidence platform for AMD Instinct LLM inference",
     "standard pre-sales evidence platform for LLM inference"),
    ("canonical AMD ROCm + Pollara presales / bring-up / day-2 path",
     "canonical presales / bring-up / day-2 path for AI clusters"),
    ("Every GPU decision.", "Every infrastructure decision."),
    ("using AMD's case on technical merit", "using the platform on technical merit"),
    ("there is no AMD thumb on the scale", "there is no vendor thumb on the scale"),
    ("make AMD's case on technical merit", "make the case on technical merit"),
    ("Adopt, certify, and extend the portal as the AMD demo front door.",
     "Adopt, certify, and extend the portal as the organization-wide demo front door."),
    ("The portal cuts prep time, reduces demo risk, and makes AMD Instinct stories repeatable.",
     "The portal cuts prep time, reduces demo risk, and makes platform stories repeatable."),
    ("customers see clearer AMD value", "customers see clearer platform value"),
    ("MI355X with SGLang", "latest accelerator SKU with SGLang"),
    ("MI300X node", "target accelerator node"),
    ("MI300X for MI355X", "prior SKU for next SKU"),
    ("MI300X, MI325X, and MI355X", "current accelerator SKUs"),
    ("ROCm 7, Pollara AI-NIC, MI355X", "GPU runtime, AI-NIC, and latest accelerator SKUs"),
    ("ROCm install", "GPU runtime install"),
    ("ROCm &amp; CUDA", "GPU vendor runtimes"),
    ("ROCm and CUDA", "GPU vendor runtimes"),
    ("ROCm hang", "GPU runtime hang"),
    ("ROCm + Pollara", "GPU runtime + AI-NIC"),
    ("AMD on the GPUs", "GPU vendor"),
    ("Pollara on the AI-NIC", "NIC vendor on the AI-NIC"),
    ("Pollara AI-NIC", "AI-NIC platform"),
    ("Pollara fabric model", "AI-NIC fabric model"),
    ("Pollara firmware", "NIC firmware"),
    ("InferenceX nightly", "upstream CI nightly"),
    ("InferenceX CI matrix", "upstream CI matrix"),
    ("amd-master.yaml", "master CI config"),
    ("AMD-red default", "accent-red default"),
    ("AMD-red to their accent", "accent palette to their brand"),
    ("AMD thumb on the scale", "vendor thumb on the scale"),
    ("NVIDIA + AMD, current + roadmap", "multi-vendor, current + roadmap"),
    ("NVIDIA, AMD, Intel", "NVIDIA, primary platform, Intel"),
    ("on AMD.", "on the target platform."),
    ("on AMD ", "on the target platform "),
    ("AMD MI355X", "MI355X"),
    ("internally at AMD precisely", "internally precisely"),
    ("AMD ROCm and fabric awareness", "GPU runtime and fabric awareness"),
    ("no AMD ROCm awareness", "no GPU runtime awareness"),
    ("AMD ROCm release notes", "GPU runtime release notes"),
    ("Instinct-plus-Pollara engagement", "accelerator-plus-NIC engagement"),
    ("internal AMD AAC", "internal compliance program"),
    ("Generic automation lacking deep AMD ROCm", "Generic automation lacking deep GPU runtime"),
    ("mark-amd", "mark-brand"),
]

PER_FILE_REPLACEMENTS: dict[str, list[tuple[str, str]]] = {
    "llm-benchmark": [
        (
            "Deliver definitive, executive-ready procurement evidence for AMD Instinct deployments.",
            "Deliver definitive, executive-ready procurement evidence for production LLM deployments.",
        ),
        (
            "mirrors how solutions teams actually win AMD deals",
            "mirrors how solutions teams actually win strategic infrastructure deals",
        ),
        (
            "built to grow into the standard pre-sales evidence platform for AMD Instinct LLM inference.",
            "built to grow into the standard pre-sales evidence platform for LLM inference.",
        ),
    ],
    "dc-planner": [
        (
            "an internal AMD tool for designing and defending GPU infrastructure builds",
            "an internal tool for designing and defending GPU infrastructure builds",
        ),
    ],
    "cluster-manager": [
        (
            "of the complete AMD AI stack",
            "of the complete multi-vendor AI stack",
        ),
        (
            "Deploying the full AMD AI stack traditionally",
            "Deploying the full AI stack traditionally",
        ),
        (
            "Let's go to slide 2 &mdash; AMD's AI cluster moment, and where Cluster Manager fits.",
            "Let's go to slide 2 &mdash; the AI cluster deployment moment, and where Cluster Manager fits.",
        ),
    ],
    "demo-portal": [
        (
            "<p class=\"eyebrow\">AMD GPU Demo Portal</p>",
            "<p class=\"eyebrow\">Executive Briefing · GPU Demo Portal</p>",
        ),
    ],
    "knowledge-exchange": [
        (
            "<h1>One system. <span class=\"accent\">Every AMD enablement track.</span></h1>",
            "<h1>One system. <span class=\"accent\">Every enablement track.</span></h1>",
        ),
    ],
}

STRATEGIC_META = {
    "llm-benchmark": (
        '<div><b>Strategic impact</b>Repeatable competitive proof · faster deal velocity</div>',
        "Defensible AMD vs NVIDIA evidence in hours, not weeks",
        "Vendor-neutral head-to-head evidence in hours, not weeks",
    ),
    "dc-planner": (
        '<div><b>Strategic impact</b>Capital decisions defensible before procurement</div>',
        None,
        None,
    ),
    "cluster-manager": (
        '<div><b>Strategic impact</b>Time-to-production · audit-ready hand-off</div>',
        None,
        None,
    ),
    "demo-portal": (
        None,
        None,
        None,
    ),
    "knowledge-exchange": (
        '<div><b>Strategic impact</b>Governed readiness · measurable recall</div>',
        None,
        None,
    ),
}


def inject_strategic_meta(content: str, key: str) -> str:
    meta = STRATEGIC_META.get(key)
    if not meta or not meta[0]:
        return content
    strategic_line, old_outcome, new_outcome = meta
    if strategic_line in content:
        pass
    elif '<div class="meta">' in content and strategic_line not in content:
        content = content.replace(
            '<div class="meta">',
            f'<div class="meta">\n            {strategic_line}',
            1,
        )
    if old_outcome and new_outcome:
        content = content.replace(old_outcome, new_outcome)
    return content


def add_notes_panel_link(content: str) -> str:
    link = '<link rel="stylesheet" href="../shared/css/notes-panel.css" />'
    if link in content:
        return content
    if "<style>" in content and "notes-panel.css" not in content:
        return content.replace("<style>", f"{link}\n  <style>", 1)
    return content


def harmonize_slidenotes(content: str) -> str:
    """Normalize demo-portal <aside class=\"notes\"> to speaker-notes where easy."""
    return content.replace('<aside class="notes">', '<aside class="speaker-notes">')


def process_file(key: str, path: Path) -> bool:
    if not path.is_file():
        print(f"skip missing: {path}")
        return False
    original = path.read_text(encoding="utf-8")
    content = original
    for old, new in GLOBAL_REPLACEMENTS:
        content = content.replace(old, new)
    for old, new in PER_FILE_REPLACEMENTS.get(key, []):
        content = content.replace(old, new)
    content = inject_strategic_meta(content, key)
    if key in ("demo-portal", "knowledge-exchange"):
        content = add_notes_panel_link(content)
    content = harmonize_slidenotes(content)
    if content != original:
        path.write_text(content, encoding="utf-8")
        print(f"updated: {path}")
        return True
    print(f"unchanged: {path}")
    return False


def main() -> None:
    changed = 0
    for key, path in PITCH_FILES.items():
        if process_file(key, path):
            changed += 1
    print(f"done — {changed} file(s) updated")


if __name__ == "__main__":
    main()
