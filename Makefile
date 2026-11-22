PORT ?= 8000

.PHONY: run
run: ## Serve the game on all interfaces and print the URLs
	@ips=$$(hostname -I 2>/dev/null); \
	echo "Dice Poker is running. Open one of:"; \
	echo "  http://localhost:$(PORT)"; \
	for ip in $$ips; do case $$ip in *:*) ;; *) echo "  http://$$ip:$(PORT)  (local network)";; esac; done; \
	echo "Press Ctrl+C to stop."; \
	python3 -m http.server $(PORT) --bind 0.0.0.0 2>&1 | grep -v '"GET '

.PHONY: icons
icons: ## Render the PNG icons from icons/*.svg (needs rsvg-convert and ImageMagick)
	rsvg-convert -w 192 -h 192 icons/icon.svg -o icons/icon-192.png
	rsvg-convert -w 512 -h 512 icons/icon.svg -o icons/icon-512.png
	rsvg-convert -w 512 -h 512 icons/icon-maskable.svg | convert - -alpha off icons/icon-maskable-512.png
	rsvg-convert -w 180 -h 180 icons/icon-maskable.svg | convert - -alpha off icons/apple-touch-icon.png

.PHONY: version
version: ## Print the current app version
	@sed -n 's/^self.APP_VERSION = "\(.*\)";/\1/p' version.js

.PHONY: bump
bump: ## Release a new version: make bump VERSION=1.2.3
	@test -n "$(VERSION)" || { echo "Usage: make bump VERSION=x.y.z"; exit 1; }
	@sed -i 's/^self.APP_VERSION = ".*";/self.APP_VERSION = "$(VERSION)";/' version.js
	@sed -i 's/^const VERSION = ".*";/const VERSION = "$(VERSION)";/' sw.js
	@sed -i -E 's/(\.(js|css))\?v=[^"]*"/\1?v=$(VERSION)"/g' index.html
	@$(MAKE) --no-print-directory check
	@echo "Bumped to $(VERSION). Deploy all files to publish the update."

.PHONY: test
test: ## Run the unit tests (scoring, quest rules and translations)
	@node --test tests/*.test.js

.PHONY: check
check: ## Verify versions agree (incl. ?v= in index.html), precached files exist and every script is precached
	@v1=$$(sed -n 's/^self.APP_VERSION = "\(.*\)";/\1/p' version.js); \
	v2=$$(sed -n 's/^const VERSION = "\(.*\)";/\1/p' sw.js); \
	test -n "$$v1" && test "$$v1" = "$$v2" || { echo "Version mismatch: version.js=$$v1 sw.js=$$v2"; exit 1; }
	@for f in $$(sed -n '/^const SHELL = \[/,/^\];/s/^ *"\(.*\)",$$/\1/p' sw.js); do \
	  test "$$f" = "./" || test -f "$$f" || { echo "Precached file missing: $$f"; exit 1; }; \
	done
	@for f in $$(sed -n 's/.*<script src="\([^"?]*\).*/\1/p' index.html); do \
	  grep -qx " *\"$$f\"," sw.js || { echo "Script not precached in sw.js: $$f"; exit 1; }; \
	done
	@v=$$(sed -n 's/^self.APP_VERSION = "\(.*\)";/\1/p' version.js); \
	for f in $$(sed -n -E 's/.*<(script src|link rel="stylesheet" href)="([^"]*)".*/\2/p' index.html); do \
	  test "$${f#*\?v=}" = "$$v" || { echo "index.html must load $${f%%\?*}?v=$$v (found $$f)"; exit 1; }; \
	done
	@python3 -c "import json; json.load(open('manifest.webmanifest'))"
	@for f in *.js locales/*.js; do node --check "$$f" || exit 1; done
	@echo "OK"
