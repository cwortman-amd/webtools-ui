#!/bin/bash
# Setup webtools-ui (Tools Hub): start a static file server for pages/index.html.
#
# Designed to be `source`d, including in a shell that already sourced a sibling
# project's setup.sh. Project-scoped variables are assigned, never inherited.
export PROJECT="webtools-ui"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
cd "$SCRIPT_DIR"

# `source setup.sh` must not kill the caller's shell when a step fails.
if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
  SETUP_EXIT="return"
else
  SETUP_EXIT="exit"
fi

have_cmd() { command -v "$1" >/dev/null 2>&1; }

export WORKSPACE="${WORKSPACE:-$HOME/workspace}"
export WORKDIR="$PWD"

echo "========================================"
echo "Setup: ${PROJECT}"
echo "========================================"

if [[ ! -f css/base.css ]]; then
  echo "WARN: css/base.css missing — Tools Hub will render unstyled."
fi

have_cmd python3 || { echo "ERROR: python3 is required for the static file server."; $SETUP_EXIT 1; }

echo "========================================"
echo "Start Tools Hub Server..."
DASHBOARD_PORT="${DASHBOARD_PORT:-8090}"
DASHBOARD_HOST="${DASHBOARD_HOST:-${WT_HOST:-127.0.0.1}}"
DASHBOARD_LOG="${DASHBOARD_LOG:-/tmp/${PROJECT}-server.log}"
DASHBOARD_URL="http://${DASHBOARD_HOST}:${DASHBOARD_PORT}/pages/index.html"

echo "Stopping any existing server on port ${DASHBOARD_PORT}..."
fuser -k "${DASHBOARD_PORT}/tcp" 2>/dev/null || true
sleep 1
if [[ -f .wt-serve.pid ]]; then
  old_pid="$(cat .wt-serve.pid 2>/dev/null || true)"
  [[ -n "$old_pid" ]] && kill "$old_pid" 2>/dev/null || true
  rm -f .wt-serve.pid
fi

ORIGINAL_PORT="$DASHBOARD_PORT"
while ! python3 -c "import socket; s = socket.socket(); s.bind(('${DASHBOARD_HOST}', ${DASHBOARD_PORT}))" 2>/dev/null; do
  echo "Port ${DASHBOARD_PORT} is in use. Trying next port..."
  DASHBOARD_PORT=$((DASHBOARD_PORT + 1))
done
if [[ "$DASHBOARD_PORT" != "$ORIGINAL_PORT" ]]; then
  echo "Note: Port ${ORIGINAL_PORT} was occupied. Using port ${DASHBOARD_PORT} instead."
  DASHBOARD_URL="http://${DASHBOARD_HOST}:${DASHBOARD_PORT}/pages/index.html"
fi

echo "Starting HTTP server (${DASHBOARD_HOST}:${DASHBOARD_PORT}) in background..."
nohup python3 -m http.server "$DASHBOARD_PORT" --bind "$DASHBOARD_HOST" \
  > "$DASHBOARD_LOG" 2>&1 &
DASHBOARD_PID=$!
echo "$DASHBOARD_PID" > .wt-serve.pid

echo "Waiting for server to initialize..."
MAX_RETRIES=10
COUNT=0
while [[ $COUNT -lt $MAX_RETRIES ]]; do
  if curl -s --max-time 2 -o /dev/null -w "%{http_code}" "${DASHBOARD_URL}" | grep -q 200; then
    echo -e "\033[92m✔ Tools Hub is UP at ${DASHBOARD_URL}\033[0m"
    break
  fi
  sleep 1
  COUNT=$((COUNT + 1))
done

if [[ $COUNT -eq $MAX_RETRIES ]]; then
  echo -e "\033[91m✖ Server failed to start. Check ${DASHBOARD_LOG}\033[0m"
  echo "  pid: ${DASHBOARD_PID}"
  tail -n 40 "$DASHBOARD_LOG" 2>/dev/null || true
fi

echo ""
echo "Tools Hub URL (open manually, or hard refresh Ctrl+Shift+R in an existing tab):"
echo "  ${DASHBOARD_URL}?v=$(date +%s)"
echo "Server PID: ${DASHBOARD_PID}"
echo "Server log: ${DASHBOARD_LOG}"
if [[ -d "${WORKSPACE}" ]]; then
  missing=()
  for sibling in cluster-manager dc-planner llm-benchmark demo-portal knowledge-exchange slide-presenter; do
    [[ -d "${WORKSPACE}/${sibling}" ]] || missing+=("$sibling")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo ""
    echo "Note: card links need sibling repos in ${WORKSPACE}. Missing:"
    printf '  - %s\n' "${missing[@]}"
  fi
fi
echo "========================================"
echo "Environment setup completed."
echo "========================================"
