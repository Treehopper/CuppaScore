#!/bin/bash
# Runs as `node` on every container start (devcontainer postStartCommand / sandbox.sh up).
set -euo pipefail

sudo /usr/local/bin/init-firewall.sh

# Keep CDN IPs fresh during long autonomous runs
if ! pgrep -f "init-firewall.sh --refresh-loop" >/dev/null; then
    nohup sudo /usr/local/bin/init-firewall.sh --refresh-loop >/dev/null 2>&1 &
fi

# Optional git identity / GitHub auth from .devcontainer/.env
if [ -n "${GIT_AUTHOR_NAME:-}" ]; then git config --global user.name "$GIT_AUTHOR_NAME"; fi
if [ -n "${GIT_AUTHOR_EMAIL:-}" ]; then git config --global user.email "$GIT_AUTHOR_EMAIL"; fi
if [ -n "${GH_TOKEN:-}" ]; then gh auth setup-git >/dev/null 2>&1 || true; fi

# MCP servers at user scope (no per-project trust prompt, so headless autopilot gets them too)
claude mcp get svelte >/dev/null 2>&1 ||
    claude mcp add --scope user --transport http svelte https://mcp.svelte.dev/mcp >/dev/null
claude mcp get playwright >/dev/null 2>&1 ||
    claude mcp add --scope user playwright -- playwright-mcp --headless --browser chromium --isolated --no-sandbox >/dev/null

echo "Sandbox ready."
