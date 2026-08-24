# Adversarial documentation-driven testing — include from a consumer Makefile:
#   -include shared/makefiles/adversarial-testing.mk
#
# When included from webtools-ui itself:
#   include makefiles/adversarial-testing.mk
#
# Targets always run against the platform checkout (this file's parent).

PLATFORM_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/..)

.PHONY: check-linkage adversarial-preflight coverage-snapshot

check-linkage: ## Validate FE→BE linkage inventory + exclusions
	@python3 "$(PLATFORM_ROOT)/scripts/check_linkage_inventory.py"

adversarial-preflight: check-linkage ## Linkage gate + verify registered test files exist
	@python3 "$(PLATFORM_ROOT)/scripts/adversarial_test_preflight.py"

coverage-snapshot: ## Print statement/branch/condition table by core module (80% loop floor; writes artifacts/coverage-report.md)
	@python3 "$(PLATFORM_ROOT)/scripts/coverage_snapshot.py"
