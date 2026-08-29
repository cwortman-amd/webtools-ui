#!/usr/bin/env bash
# Shared bootstrap for webtools consumer one-line installers.
# Sourced by tools/install-<tool>.sh — not meant to be piped directly.
#
# Clones webtools-ui + the target consumer as siblings, verifies shared/css/base.css,
# then runs ./setup.sh or starts a static file server.

set -euo pipefail

WT_ORG="${WT_ORG:-${CM_ORG:-cwortman-amd}}"
WT_WORKSPACE="${WT_WORKSPACE:-${CM_WORKSPACE:-${HOME}/workspace}}"
# WT_PROTO is resolved in wt_resolve_proto (per-tool). Do not freeze it here.
WT_REF="${WT_REF:-${CM_REF:-}}"
WT_NO_SETUP="${WT_NO_SETUP:-${CM_NO_SETUP:-0}}"
WT_HOST="${WT_HOST:-127.0.0.1}"
WT_CLONE_SIBLINGS="${WT_CLONE_SIBLINGS:-0}"

C_OK=$'\033[92m'
C_WARN=$'\033[93m'
C_ERR=$'\033[91m'
C_OFF=$'\033[0m'

wt_say()  { echo "${C_OK}==>${C_OFF} $*"; }
wt_warn() { echo "${C_WARN}!${C_OFF} $*"; }
wt_die()  { echo "${C_ERR}x${C_OFF} $*" >&2; exit 1; }

wt_resolve_proto() {
  # Honor explicit WT_PROTO, then CM_PROTO, then per-tool default.
  # cluster-manager defaults to https so a first-time curl install works
  # without an SSH key; other tools keep the historic ssh default.
  local tool="${1:-}"
  if [ -n "${WT_PROTO:-}" ]; then
    return 0
  fi
  if [ -n "${CM_PROTO:-}" ]; then
    WT_PROTO="$CM_PROTO"
    return 0
  fi
  if [ "$tool" = "cluster-manager" ]; then
    WT_PROTO=https
  else
    WT_PROTO=ssh
  fi
}

wt_repo_url() {
  case "$WT_PROTO" in
    ssh)   echo "git@github.com:${WT_ORG}/$1.git" ;;
    https) echo "https://github.com/${WT_ORG}/$1.git" ;;
    *)     wt_die "WT_PROTO must be 'ssh' or 'https', got '${WT_PROTO}'" ;;
  esac
}

wt_require_git() {
  command -v git >/dev/null 2>&1 || wt_die "git is required but not installed."
}

wt_clone_repo() {
  local repo="$1"
  local url
  url="$(wt_repo_url "$repo")"
  if [ -d "${WT_WORKSPACE}/${repo}/.git" ]; then
    wt_say "${repo}: already present, fetching"
    git -C "${WT_WORKSPACE}/${repo}" fetch --all --prune --quiet \
      || wt_warn "${repo}: fetch failed; continuing with the checked-out revision."
  else
    wt_say "${repo}: cloning"
    if ! git clone --quiet "$url" "${WT_WORKSPACE}/${repo}"; then
      wt_die "could not clone ${url}
  Repositories live in a private org. Check that:
    - your SSH key is loaded (ssh -T git@github.com), or
    - WT_PROTO=https with a credential helper / token configured, and
    - your account has access to ${WT_ORG}/${repo}."
    fi
  fi
  if [ -n "$WT_REF" ]; then
    wt_say "${repo}: checking out ${WT_REF}"
    git -C "${WT_WORKSPACE}/${repo}" checkout --quiet "$WT_REF" \
      || wt_warn "${repo}: no ref '${WT_REF}'; staying on the default branch."
  fi
}

wt_verify_shared() {
  local tool_dir="$1"
  if [ -e "${tool_dir}/shared/css/base.css" ]; then
    wt_say "shared/ resolves to the sibling webtools-ui checkout"
    return 0
  fi
  if [ -e "${tool_dir}/css/base.css" ]; then
    wt_say "platform css/base.css present (webtools-ui root)"
    return 0
  fi
  wt_die "shared/ is still dangling after cloning.
  Expected ${WT_WORKSPACE}/webtools-ui/css/base.css via ${tool_dir}/shared/.
  The UI would start but render completely unstyled."
}

wt_start_static_server() {
  local tool_dir="$1"
  local port="$2"
  local pid_file="${tool_dir}/.wt-serve.pid"
  local log_file="${tool_dir}/.wt-serve.log"

  command -v python3 >/dev/null 2>&1 || wt_die "python3 is required for the static file server."

  if [ -f "$pid_file" ]; then
    local old_pid
    old_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [ -n "$old_pid" ] && kill -0 "$old_pid" 2>/dev/null; then
      wt_say "static server already running (pid ${old_pid})"
      return 0
    fi
  fi

  wt_say "starting static server on ${WT_HOST}:${port}"
  fuser -k "${port}/tcp" 2>/dev/null || true
  (
    cd "$tool_dir"
    nohup python3 -m http.server "$port" --bind "$WT_HOST" >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )
  sleep 0.5
}

wt_run_setup() {
  local tool_dir="$1"
  cd "$tool_dir"
  [ -x setup.sh ] || chmod +x setup.sh 2>/dev/null || true
  [ -f setup.sh ] || wt_die "setup.sh not found in ${tool_dir}"
  wt_say "handing off to ./setup.sh"
  echo
  if [ -n "${SETUP_PROFILE:-}" ]; then
    ./setup.sh --profile "$SETUP_PROFILE"
  else
    ./setup.sh
  fi
}

wt_tool_repos() {
  case "$1" in
    webtools-ui)         echo "webtools-ui" ;;
    dc-planner)          echo "webtools-ui dc-planner" ;;
    llm-benchmark)       echo "webtools-ui llm-benchmark" ;;
    cluster-manager)     echo "webtools-ui cluster-manager" ;;
    demo-portal)         echo "webtools-ui demo-portal" ;;
    knowledge-exchange)  echo "webtools-ui knowledge-exchange" ;;
    slide-presenter)     echo "webtools-ui slide-presenter" ;;
    all)
      echo "webtools-ui dc-planner llm-benchmark cluster-manager demo-portal knowledge-exchange slide-presenter"
      ;;
    *) wt_die "unknown tool '${1}'. Valid: webtools-ui dc-planner llm-benchmark cluster-manager demo-portal knowledge-exchange slide-presenter all" ;;
  esac
}

wt_tool_primary_dir() {
  case "$1" in
    webtools-ui) echo "webtools-ui" ;;
    *) echo "$1" ;;
  esac
}

wt_tool_mode() {
  case "$1" in
    dc-planner) echo "static" ;;
    *) echo "setup" ;;
  esac
}

wt_tool_port() {
  case "$1" in
    webtools-ui) echo "8090" ;;
    dc-planner) echo "8080" ;;
    llm-benchmark) echo "${DASHBOARD_PORT:-8787}" ;;
    cluster-manager) echo "${DASHBOARD_PORT:-8686}" ;;
    demo-portal) echo "${PORT:-8080}" ;;
    knowledge-exchange) echo "${STUDIO_PORT:-${PORTAL_PORT:-8765}}" ;;
    slide-presenter) echo "${DASHBOARD_PORT:-8788}" ;;
    *) echo "8080" ;;
  esac
}

wt_tool_url_path() {
  case "$1" in
    webtools-ui) echo "/pages/index.html" ;;
    dc-planner) echo "/pages/index.html" ;;
    llm-benchmark) echo "/dashboard" ;;
    cluster-manager) echo "/dashboard" ;;
    demo-portal) echo "/pages/index.html?tab=catalog" ;;
    knowledge-exchange|slide-presenter) echo "/pages/index.html" ;;
    *) echo "/pages/index.html" ;;
  esac
}

wt_tool_title() {
  case "$1" in
    webtools-ui) echo "webtools-ui (Tools Hub)" ;;
    dc-planner) echo "DC Planner" ;;
    llm-benchmark) echo "LLM Benchmark" ;;
    cluster-manager) echo "Cluster Manager" ;;
    demo-portal) echo "GPU Demo Portal" ;;
    knowledge-exchange) echo "Knowledge Exchange" ;;
    slide-presenter) echo "Slide Presenter" ;;
    all) echo "all webtools consumers" ;;
    *) echo "$1" ;;
  esac
}

wt_print_success() {
  local tool="$1"
  local tool_dir="$2"
  local port="$3"
  local path="$4"
  local url="http://${WT_HOST}:${port}${path}"

  cat <<EOF

========================================
Bootstrap complete: $(wt_tool_title "$tool")
========================================
  Workspace: ${WT_WORKSPACE}
  Directory: ${tool_dir}

EOF

  if [ "$tool" = "cluster-manager" ] && [ "${SETUP_PROFILE:-control-host}" = "tune" ]; then
    cat <<EOF
  CPU/GPU tune profile — dashboard was not started.
  cm tune --no-pdf
  cm tune --json --no-pdf
  cm tune --no-pdf --benchmark

EOF
  else
    cat <<EOF
  Open: ${url}

Useful commands:
EOF
  fi

  case "$tool" in
    webtools-ui)
      cat <<EOF
  cd ${tool_dir}
  source ./setup.sh
  # server pid: ${tool_dir}/.wt-serve.pid
  # logs: /tmp/webtools-ui-server.log
EOF
      ;;
    dc-planner)
      cat <<EOF
  cd ${tool_dir}
  # static server pid: ${tool_dir}/.wt-serve.pid
  # logs: ${tool_dir}/.wt-serve.log
EOF
      ;;
    cluster-manager)
      if [ "${SETUP_PROFILE:-control-host}" = "tune" ]; then
        cat <<EOF
  cd ${tool_dir}
  # cm is installed to ~/.local/bin when setup.sh finishes (tune → cm tune)
EOF
      else
        cat <<EOF
  cd ${tool_dir}
  source .cluster-manager-venv/bin/activate
  \$EDITOR config/inventory.ini    # add cluster hosts
  ansible node_servers -m ping
  cm version                       # on PATH if ~/.local/bin is configured
EOF
      fi
      ;;
    llm-benchmark)
      cat <<EOF
  cd ${tool_dir}
  source .llm-benchmark-*-venv/bin/activate
  # Real GPU benchmarks need Docker/ROCm and HF_TOKEN in .env
EOF
      ;;
    demo-portal)
      cat <<EOF
  cd ${tool_dir}
  source .demo-*-venv/bin/activate
  # Run-agent listens on \${AGENT_PORT:-8765} when enabled
EOF
      ;;
    knowledge-exchange)
      cat <<EOF
  cd ${tool_dir}
  source .ke-*-venv/bin/activate 2>/dev/null || true
  make portal                     # refresh catalog after content changes
  # Studio AI needs Ollama or an OpenAI-compatible endpoint (see .env)
EOF
      ;;
    slide-presenter)
      cat <<EOF
  cd ${tool_dir}
  source .slide-presenter-venv/bin/activate
EOF
      ;;
  esac
  echo
}

wt_install() {
  local tool="${1:?tool name required}"
  local repos primary mode tool_dir port path repo

  wt_require_git
  wt_resolve_proto "$tool"

  echo "========================================"
  echo "Install: $(wt_tool_title "$tool")"
  echo "========================================"
  wt_say "workspace: ${WT_WORKSPACE}  (protocol: ${WT_PROTO})"

  mkdir -p "$WT_WORKSPACE"
  cd "$WT_WORKSPACE"

  repos="$(wt_tool_repos "$tool")"
  for repo in $repos; do
    wt_clone_repo "$repo"
  done

  if [ "$WT_CLONE_SIBLINGS" = "1" ] && [ "$tool" = "demo-portal" ]; then
    for extra in cluster-manager dc-planner llm-benchmark knowledge-exchange slide-presenter; do
      wt_clone_repo "$extra" || wt_warn "optional sibling ${extra} not cloned"
    done
  fi

  if [ "$tool" = "all" ]; then
    wt_say "all repositories cloned. Start each tool with its own one-liner (see docs/INSTALL.md)."
    _adv="${WT_WORKSPACE}/webtools-ui/scripts/install_adversarial_workflow.sh"
    if [ -x "$_adv" ]; then
      "$_adv" --no-user || wt_warn "adversarial workflow install skipped"
    fi
    return 0
  fi

  primary="$(wt_tool_primary_dir "$tool")"
  tool_dir="${WT_WORKSPACE}/${primary}"
  mode="$(wt_tool_mode "$tool")"
  port="$(wt_tool_port "$tool")"
  path="$(wt_tool_url_path "$tool")"

  wt_verify_shared "$tool_dir"

  _adv="${WT_WORKSPACE}/webtools-ui/scripts/install_adversarial_workflow.sh"
  if [ -x "$_adv" ]; then
    "$_adv" --repo "$tool_dir" --no-user || wt_warn "adversarial workflow install skipped"
  fi

  if [ "$WT_NO_SETUP" = "1" ]; then
    wt_say "WT_NO_SETUP=1 — skipping setup/start."
    echo
    echo "Next: cd ${tool_dir} && ./setup.sh   # or see docs/INSTALL.md"
    return 0
  fi

  if [ "$mode" = "static" ]; then
    wt_start_static_server "$tool_dir" "$port"
  else
    wt_run_setup "$tool_dir"
  fi

  wt_print_success "$tool" "$tool_dir" "$port" "$path"
}
