#!/usr/bin/env bash
# Runs the official svelte-autofixer (same as the svelte MCP tool) on .svelte / .svelte.ts files.
# Fails on issues; prints suggestions (review them, some are advisory).
# Usage: scripts/svelte-autofix.sh [files…]  (default: all under apps/pwa/src)
cd "$(dirname "$0")/.."
files=("$@")
[ ${#files[@]} -eq 0 ] && mapfile -t files < <(find apps/pwa/src -name '*.svelte' -o -name '*.svelte.ts' | sort)
status=0
for f in "${files[@]}"; do
  out=$(pnpm exec svelte-mcp svelte-autofixer "$f" 2>&1)
  if ! echo "$out" | grep -qE '^\s*issues: \[\],?$'; then
    echo "FAIL $f"; echo "$out" | sed 's/^/     /'; status=1
  elif ! echo "$out" | grep -qE '^\s*suggestions: \[\],?$'; then
    echo "hint $f"; echo "$out" | grep -E '^\s+["\x27]' | sed 's/^\s*/     /'
  else
    echo "ok   $f"
  fi
done
exit $status
