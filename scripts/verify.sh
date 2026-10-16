#!/usr/bin/env bash
# Full verification from CLAUDE.md; exits non-zero on the first failure.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm run check > /tmp/verify-check.log 2>&1 || { tail -40 /tmp/verify-check.log; echo "FAIL: check"; exit 1; }
pnpm test > /tmp/verify-test.log 2>&1 || { grep -E "FAIL|×|Error|Expected|Received" /tmp/verify-test.log | head -40; echo "FAIL: test"; exit 1; }
grep -E "Tests " /tmp/verify-test.log
pnpm run build > /tmp/verify-build.log 2>&1 || { tail -30 /tmp/verify-build.log; echo "FAIL: build"; exit 1; }
pnpm run test:e2e > /tmp/verify-e2e.log 2>&1 || { tail -60 /tmp/verify-e2e.log; echo "FAIL: e2e"; exit 1; }
tail -2 /tmp/verify-e2e.log
echo "VERIFY OK"
