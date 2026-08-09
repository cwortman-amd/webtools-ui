# webtools-ui — shared UI platform Makefile
.PHONY: check-plugins check-plugins-strict sync-plugin-registry ci enhanced-validation enhanced-validation-quick help

help:
	@echo "Targets:"
	@echo "  make ci                         CI gate: strict manifests + consumer mounts"
	@echo "  make enhanced-validation        L0-L3 cross-repo validation (includes quick self-checks)"
	@echo "  make enhanced-validation-quick  L0-L1 + syntax probes only"
	@echo "  make check-plugins         validate community plugin manifests"
	@echo "  make check-plugins-strict  fail on missing sibling manifests"
	@echo "  make sync-plugin-registry  copy plugins.registry.json to demo-portal/data/"

ci:
	@bash scripts/ci_plugin_gate.sh

enhanced-validation:
	@bash scripts/enhanced_validation.sh

enhanced-validation-quick:
	@bash scripts/enhanced_validation.sh --skip-slow

check-plugins:
	@python3 scripts/check_plugin_manifests.py

check-plugins-strict:
	@python3 scripts/check_plugin_manifests.py --strict

sync-plugin-registry:
	@python3 scripts/sync_plugin_registry_snapshot.py
