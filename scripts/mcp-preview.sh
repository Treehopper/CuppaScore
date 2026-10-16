#!/usr/bin/env bash
# Serves a *copy* of apps/pwa/dist on :4174 for manual checks with the playwright MCP.
# A copy, because on the container's FUSE mount an open preview server blocks `vite build`
# from emptying dist/; a separate port, because e2e reuses whatever runs on :4173.
set -euo pipefail
cd "$(dirname "$0")/.."
pkill -f "vite preview --host 0.0.0.0 --port 4174" || true
rm -rf /tmp/cuplog-preview && cp -r apps/pwa/dist /tmp/cuplog-preview
cd apps/pwa
nohup pnpm exec vite preview --host 0.0.0.0 --port 4174 --strictPort --outDir /tmp/cuplog-preview > /tmp/mcp-preview.log 2>&1 &
for _ in $(seq 1 50); do curl -sf localhost:4174/ > /dev/null && { echo "preview on http://localhost:4174/"; exit 0; }; sleep 0.2; done
cat /tmp/mcp-preview.log; exit 1
