#!/usr/bin/env bash
# install-cluster-manager.sh — Cluster Manager — Ansible dashboard
#
#   curl -fsSL https://curt.wortman.ai/tools/install-cluster-manager.sh | bash
#
# Environment: WT_WORKSPACE WT_ORG WT_PROTO WT_REF WT_NO_SETUP WT_HOST WT_CLONE_SIBLINGS
#              SETUP_FAST=1  CM_* aliases work on cluster-manager
set -euo pipefail
WT_TOOL=cluster-manager
INSTALL_BASE="${INSTALL_BASE:-https://curt.wortman.ai/tools}"
_script_dir="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo "")"
if [ -n "$_script_dir" ] && [ -f "${_script_dir}/install-lib.sh" ]; then
  # shellcheck source=tools/install-lib.sh
  source "${_script_dir}/install-lib.sh"
else
  # shellcheck disable=SC1090
  source <(curl -fsSL "${INSTALL_BASE}/install-lib.sh")
fi
wt_install "$WT_TOOL"
