PORT ?= 8000

.PHONY: run
run: ## Serve the game on all interfaces and print the URLs
	@ips=$$(hostname -I 2>/dev/null); \
	echo "Dice Poker is running. Open one of:"; \
	echo "  http://localhost:$(PORT)"; \
	for ip in $$ips; do case $$ip in *:*) ;; *) echo "  http://$$ip:$(PORT)  (local network)";; esac; done; \
	echo "Press Ctrl+C to stop."; \
	python3 -m http.server $(PORT) --bind 0.0.0.0 2>&1 | grep -v '"GET '
