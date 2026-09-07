# webtools-ui — shared UI platform Makefile
.PHONY: check-plugins check-plugins-strict sync-plugin-registry ci test-shared test-playwright cross-consumer-smoke enhanced-validation enhanced-validation-quick check-mcp check-extensions check-agent check-linkage adversarial-preflight coverage-snapshot coverage coverage-node html-audit help

help:
	@echo "Targets:"
	@echo "  make ci                         CI gate: strict manifests + consumer mounts + shared tests"
	@echo "  make test-shared                node --test for tests/lib/*.test.mjs + mobile-api-contract"
	@echo "  make test-playwright            cross-consumer shell + iPhone Playwright regression"
	@echo "  make cross-consumer-smoke       L0 node + L2 Playwright smoke (all consumers)"
	@echo "  make enhanced-validation        L0-L3 cross-repo validation (includes quick self-checks)"
	@echo "  make enhanced-validation-quick  L0-L1 + syntax probes only"
	@echo "  make coverage                   Python boundary tests with pytest-cov"
	@echo "  make coverage-node              Node unit tests with c8 line coverage"
	@echo "  make html-audit                 HTML consistency audit (iOS safe-area, skeleton)"
	@echo "  make check-mcp                 validate MCP registrations (all plugins)"
	@echo "  make check-extensions          validate extension pack catalogs"
	@echo "  make check-agent               validate agent gateway manifest wiring"
	@echo "  make check-linkage             validate FE→BE linkage inventory + exclusions"
	@echo "  make adversarial-preflight     linkage gate + verify registered test files exist"
	@echo "  make coverage-snapshot         statement/branch/condition table by core module (80% loop floor)"
	@echo "  make check-plugins         validate community plugin manifests"
	@echo "  make check-plugins-strict  fail on missing sibling manifests"
	@echo "  make sync-plugin-registry  sync registry from manifests + demo-portal snapshot"
	@echo "  make sync-registry-from-manifests  refresh plugins.registry.json from consumer manifests"

test-shared:
	@node --test tests/lib/*.test.mjs
	@node tests/mobile-api-contract.mjs

coverage:
	@python3 -m pip install -q pytest-cov 2>/dev/null || true
	@python3 -m pytest tests/python/ -q --cov=python --cov=scripts --cov-report=term-missing --cov-fail-under=15

coverage-node:
	@npm run test:coverage

html-audit:
	@python3 scripts/html_consistency_audit.py --workspace "$(abspath ..)"

test-playwright:
	@node tests/cross-consumer-shell.mjs
	@node tests/iphone-ui.mjs
	@node tests/tools-hub-smoke.mjs

cross-consumer-smoke:
	@bash scripts/run_cross_consumer_smoke.sh

ci: test-shared coverage html-audit check-extensions check-mcp check-agent adversarial-preflight
	@bash scripts/ci_plugin_gate.sh

include makefiles/adversarial-testing.mk

check-mcp:
	@python3 scripts/check_mcp_registration.py --strict --workspace "$(abspath ..)"

check-extensions:
	@python3 scripts/check_extensions.py --workspace "$(abspath ..)"

check-agent:
	@python3 scripts/check_agent_gateway.py --workspace "$(abspath ..)"

enhanced-validation:
	@bash scripts/enhanced_validation.sh

enhanced-validation-quick:
	@bash scripts/enhanced_validation.sh --skip-slow

check-plugins:
	@python3 scripts/check_plugin_manifests.py

check-plugins-strict:
	@python3 scripts/check_plugin_manifests.py --strict

sync-registry-from-manifests:
	@python3 scripts/sync_registry_from_manifests.py

sync-plugin-registry: sync-registry-from-manifests
	@python3 scripts/sync_plugin_registry_snapshot.py --workspace "$(abspath ..)"
