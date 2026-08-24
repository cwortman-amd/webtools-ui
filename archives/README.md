# Source archives for Tools Hub install modal

Each `{tool}-source.zip` bundles **webtools-ui** and the target consumer as siblings under `workspace/` — the same layout the curl installers create.

Build locally:

```bash
cd ~/workspace/webtools-ui
chmod +x scripts/build-source-archives.sh
./scripts/build-source-archives.sh
```

Host for production (alongside `curt.wortman.ai/tools/`):

```caddy
handle_path /archives/* {
  root * /var/www/webtools-ui/archives
  file_server
}
```

The Tools Hub page links to `https://curt.wortman.ai/archives/<tool>-source.zip` (or `../archives/` when served on localhost).
