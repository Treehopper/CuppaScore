#!/usr/bin/env bash
# Run the CupLog Claude sandbox with plain Docker Compose (no VS Code needed).
#
#   .devcontainer/sandbox.sh up              build (if needed), start, apply firewall
#   .devcontainer/sandbox.sh claude [args]   interactive Claude, permissions bypassed
#   .devcontainer/sandbox.sh auto [N]        headless autopilot: up to N sessions (default 20)
#   .devcontainer/sandbox.sh shell           zsh inside the container
#   .devcontainer/sandbox.sh status          container + firewall state
#   .devcontainer/sandbox.sh down            stop (volumes with Claude login/pnpm store kept)
#   .devcontainer/sandbox.sh rebuild         rebuild image without cache and restart
#
# Autopilot stops early when PROGRESS.md contains "STATUS: DONE" or a file named STOP
# exists in the repo root (touch STOP to end after the current session).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$DIR")"
COMPOSE=(docker compose -f "$DIR/compose.yaml")
EXEC=("${COMPOSE[@]}" exec)

running() { [ -n "$("${COMPOSE[@]}" ps -q --status running dev 2>/dev/null)" ]; }

up() {
    if running; then return 0; fi
    "${COMPOSE[@]}" up -d --build
    "${EXEC[@]}" dev /usr/local/bin/post-start.sh
}

case "${1:-help}" in
    up)
        up
        ;;
    claude)
        shift
        up
        exec "${EXEC[@]}" dev claude --dangerously-skip-permissions "$@"
        ;;
    shell)
        up
        exec "${EXEC[@]}" dev zsh
        ;;
    auto)
        max=${2:-20}
        up
        mkdir -p "$ROOT/.autopilot/logs"
        for i in $(seq 1 "$max"); do
            if [ -f "$ROOT/STOP" ]; then echo "STOP file found, ending."; break; fi
            if grep -qs "STATUS: DONE" "$ROOT/PROGRESS.md"; then echo "PROGRESS.md says DONE."; break; fi
            log=".autopilot/logs/$(date +%Y%m%d-%H%M%S)-session-$i.jsonl"
            echo "=== autopilot session $i/$max → $log ==="
            # Full stream-json goes to the log; the terminal shows assistant text + tool names.
            "${EXEC[@]}" -T dev bash -c '
                set -o pipefail
                claude -p "$(cat .claude/autopilot-prompt.md)" \
                    --dangerously-skip-permissions \
                    --output-format stream-json --verbose \
                | tee "$1" \
                | jq -r --unbuffered '\''
                    select(.type == "assistant") | .message.content[]?
                    | if .type == "text" then .text
                      elif .type == "tool_use" then "  → \(.name) \(.input.command // .input.file_path // .input.url // "" | tostring | .[0:120])"
                      else empty end'\''
            ' _ "$log" || echo "session $i exited non-zero (see $log); continuing"
        done
        ;;
    status)
        "${COMPOSE[@]}" ps
        if running; then
            "${EXEC[@]}" -u root dev bash -c 'iptables -S OUTPUT; echo "allowlisted entries: $(ipset list allowed-domains 2>/dev/null | grep -c "^[0-9]")"'
            "${EXEC[@]}" dev bash -c 'curl -s -o /dev/null --connect-timeout 3 https://example.com && echo "WARNING: example.com reachable" || echo "egress blocked for non-allowlisted hosts ✓"'
        fi
        ;;
    down)
        "${COMPOSE[@]}" down
        ;;
    rebuild)
        "${COMPOSE[@]}" down
        "${COMPOSE[@]}" build --no-cache
        up
        ;;
    help|-h|--help|*)
        sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'
        ;;
esac
