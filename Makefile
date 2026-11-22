PORT ?= 8000

.PHONY: run
run: ## Serve the game on all interfaces and print the URLs
	@ips=$$(hostname -I 2>/dev/null); \
	echo "Dice Poker is running. Open one of:"; \
	echo "  http://localhost:$(PORT)"; \
	for ip in $$ips; do case $$ip in *:*) ;; *) echo "  http://$$ip:$(PORT)  (local network)";; esac; done; \
	echo "Press Ctrl+C to stop."; \
	python3 -m http.server $(PORT) --bind 0.0.0.0 2>&1 | grep -v '"GET '

.PHONY: version
version: ## Print the current app version
	@sed -n 's/^self.APP_VERSION = "\(.*\)";/\1/p' version.js

.PHONY: bump
bump: ## Release a new version: make bump VERSION=1.2.3
	@test -n "$(VERSION)" || { echo "Usage: make bump VERSION=x.y.z"; exit 1; }
	@sed -i 's/^self.APP_VERSION = ".*";/self.APP_VERSION = "$(VERSION)";/' version.js
	@sed -i 's/^const VERSION = ".*";/const VERSION = "$(VERSION)";/' sw.js
	@$(MAKE) --no-print-directory check
	@echo "Bumped to $(VERSION). Deploy all files to publish the update."

.PHONY: test
test: ## Run the unit tests (scoring and quest rules)
	@node --test tests/*.test.js

.PHONY: check
check: ## Verify version.js and sw.js agree and every precached file exists
	@v1=$$(sed -n 's/^self.APP_VERSION = "\(.*\)";/\1/p' version.js); \
	v2=$$(sed -n 's/^const VERSION = "\(.*\)";/\1/p' sw.js); \
	test -n "$$v1" && test "$$v1" = "$$v2" || { echo "Version mismatch: version.js=$$v1 sw.js=$$v2"; exit 1; }
	@for f in $$(sed -n '/^const SHELL = \[/,/^\];/s/^ *"\(.*\)",$$/\1/p' sw.js); do \
	  test "$$f" = "./" || test -f "$$f" || { echo "Precached file missing: $$f"; exit 1; }; \
	done
	@python3 -c "import json; json.load(open('manifest.webmanifest'))"
	@node --check sw.js && node --check pwa.js && node --check game.js
	@echo "OK"
