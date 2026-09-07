# LLM Wiki Index Manifest

User-editable catalog of **GitHub repositories** and **published documentation sites**
that feed the Knowledge Exchange LLM wiki raw layer.

**File:** [`data/llm-wiki-index-manifest.json`](../data/llm-wiki-index-manifest.json)  
**Schema:** [`schemas/llm-wiki-index-manifest.schema.json`](../schemas/llm-wiki-index-manifest.schema.json)

## Add a GitHub documentation repo

1. Edit `llm-wiki-index-manifest.json` — append a `githubRepos` entry:

```json
{
  "id": "my-new-docs",
  "corpusId": "amd-my-new-docs",
  "label": "My documentation",
  "github": "https://github.com/org/my-new-docs",
  "ref": "main",
  "sparse_paths": ["docs"],
  "include_globs": ["docs/**/*.md", "docs/**/*.rst"],
  "exclude_globs": ["docs/_static/**"],
  "published_base": "https://docs.example.com/latest/",
  "source_strip_prefix": "docs/"
}
```

2. From **knowledge-exchange**, sync registry entries and ingest:

```bash
python3 scripts/ke_llm_wiki_registry_sync.py --write
make amd-docs-ingest
```

3. Validate:

```bash
python3 scripts/check_llm_wiki_index_manifest.py   # webtools-ui
make llm-wiki-check                                 # knowledge-exchange alias
```

4. Update dashboard `plugin.manifest.json` `agent.corpora` / `registrations.knowledge`
   if the new corpus should appear in every product orb (or rely on `agent-knowledge-defaults.json`
   after sync).

## Add a live documentation site

Append a `siteUrls` entry:

```json
{
  "id": "example-docs-portal",
  "label": "Example docs portal",
  "url": "https://docs.example.com/latest/",
  "inventory_path": "wiki/docs-inventory/example-docs.json",
  "mapped_domain": "software-ecosystem",
  "crawl": true
}
```

Sites with `crawl: true` are included when Knowledge Exchange runs
`make docs-refresh REFRESH=1` (living inventory, not full-text federated index).

## Related files

| File | Role |
| --- | --- |
| `knowledge-registry.json` | Corpus transport (owner, HTTP paths) — synced from manifest |
| `agent-knowledge-defaults.json` | Shared corpora for all dashboard agents — synced from manifest |
| `knowledge-exchange/data/sources/amd-docs/search-index.json` | Compiled Git ingest output (KE hub) |

Override manifest path: `LLM_WIKI_INDEX_MANIFEST=/path/to/manifest.json`
