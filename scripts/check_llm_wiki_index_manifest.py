#!/usr/bin/env python3
"""Validate shared/data/llm-wiki-index-manifest.json."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data" / "llm-wiki-index-manifest.json"
REGISTRY = ROOT / "data" / "knowledge-registry.json"
DEFAULTS = ROOT / "data" / "agent-knowledge-defaults.json"

_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
_GITHUB_RE = re.compile(r"^https://github\.com/[^/]+/[^/]+/?$")


def _load(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def check_manifest(data: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    repos = data.get("githubRepos") or []
    sites = data.get("siteUrls") or []
    if not isinstance(repos, list):
        return ["githubRepos must be an array"]
    if not isinstance(sites, list):
        return ["siteUrls must be an array"]

    seen_repo: set[str] = set()
    seen_corpus: set[str] = set()
    for i, repo in enumerate(repos):
        if not isinstance(repo, dict):
            errors.append(f"githubRepos[{i}]: must be an object")
            continue
        rid = str(repo.get("id") or "")
        cid = str(repo.get("corpusId") or "")
        gh = str(repo.get("github") or repo.get("url") or "")
        if not _ID_RE.match(rid):
            errors.append(f"githubRepos[{i}]: invalid id {rid!r}")
        if rid in seen_repo:
            errors.append(f"duplicate githubRepos id: {rid}")
        seen_repo.add(rid)
        if not _ID_RE.match(cid):
            errors.append(f"githubRepos[{i}]: invalid corpusId {cid!r}")
        if cid in seen_corpus:
            errors.append(f"duplicate corpusId: {cid}")
        seen_corpus.add(cid)
        if not _GITHUB_RE.match(gh):
            errors.append(f"githubRepos[{i}]: github URL must be https://github.com/org/repo")

    seen_site: set[str] = set()
    for i, site in enumerate(sites):
        if not isinstance(site, dict):
            errors.append(f"siteUrls[{i}]: must be an object")
            continue
        sid = str(site.get("id") or "")
        url = str(site.get("url") or "")
        if not _ID_RE.match(sid):
            errors.append(f"siteUrls[{i}]: invalid id {sid!r}")
        if sid in seen_site:
            errors.append(f"duplicate siteUrls id: {sid}")
        seen_site.add(sid)
        if not url.startswith("https://"):
            errors.append(f"siteUrls[{i}]: url must be https")

    return errors


def check_alignment(manifest: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    if not REGISTRY.is_file() or not DEFAULTS.is_file():
        return errors
    registry = _load(REGISTRY)
    defaults = _load(DEFAULTS)
    corpora = registry.get("corpora") or {}
    shared = set(defaults.get("sharedCorpora") or [])
    for repo in manifest.get("githubRepos") or []:
        cid = str(repo.get("corpusId") or "")
        if cid and cid not in corpora:
            errors.append(f"knowledge-registry missing corpus {cid!r} (run ke_llm_wiki_registry_sync.py --write)")
        if cid and cid not in shared:
            errors.append(f"agent-knowledge-defaults missing sharedCorpora entry {cid!r}")
    return errors


def main() -> int:
    if not MANIFEST.is_file():
        print(f"ERROR: missing manifest {MANIFEST}", file=sys.stderr)
        return 1
    data = _load(MANIFEST)
    errors = check_manifest(data) + check_alignment(data)
    for err in errors:
        print(f"ERROR: {err}", file=sys.stderr)
    if errors:
        return 1
    n_repo = len(data.get("githubRepos") or [])
    n_site = len(data.get("siteUrls") or [])
    print(f"OK: llm-wiki-index-manifest ({n_repo} github repos, {n_site} site urls)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
