#!/usr/bin/env bash
#
# One command to see Signed Off working.
#
# Starts the storefront under test and the handover site, then prints the two
# links that matter: the same milestone before and after the bug was fixed.
#
# Nothing here needs Kane credits or a TestMu AI account. The evidence was
# produced by real Kane runs during the build and is committed to the repo, so
# the pages render from sealed packs rather than from anything live.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STOREFRONT_PORT=4311
HANDOVER_PORT=4300

port_in_use() { ss -ltn 2>/dev/null | grep -q ":$1 "; }

free_port() {
  local port="$1"
  if port_in_use "$port"; then
    echo "  port $port is busy — freeing it"
    # Kill by port rather than by name: matching on a process name would also
    # match this script.
    for pid in $(ss -ltnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | sort -u); do
      kill "$pid" 2>/dev/null || true
    done
    sleep 2
  fi
}

wait_for() {
  local url="$1" name="$2"
  for _ in $(seq 1 40); do
    if curl -fsS -o /dev/null "$url" 2>/dev/null; then
      echo "  $name is up"
      return 0
    fi
    sleep 1
  done
  echo "  $name did not start — see /tmp/signedoff-$name.log" >&2
  return 1
}

echo
echo "Signed Off — demo"
echo

if [ ! -d node_modules ]; then
  echo "  installing dependencies"
  pnpm install --silent
fi

# Only build when there is no build to reuse. Judges are told this should be
# quick, and rebuilding two Next apps every time makes it a minute slower for
# no gain.
build_if_needed() {
  local dir="$1" name="$2"
  if [ -d "$dir/.next" ]; then
    echo "  $name already built"
    return 0
  fi
  echo "  building $name (first run only)"
  ( cd "$dir" && ./node_modules/.bin/next build ) >"/tmp/signedoff-build-$name.log" 2>&1
}

build_if_needed fixtures/bloom-vine storefront
build_if_needed packages/web handover

free_port "$STOREFRONT_PORT"
free_port "$HANDOVER_PORT"

echo "  starting"
( cd fixtures/bloom-vine && setsid nohup ./node_modules/.bin/next start --port "$STOREFRONT_PORT" \
    >/tmp/signedoff-storefront.log 2>&1 </dev/null & )
( cd packages/web && setsid nohup ./node_modules/.bin/next start --port "$HANDOVER_PORT" \
    >/tmp/signedoff-handover.log 2>&1 </dev/null & )

wait_for "http://localhost:$STOREFRONT_PORT/" storefront
wait_for "http://localhost:$HANDOVER_PORT/" handover

RED="$(node -e '
const { readdirSync, readFileSync } = require("node:fs");
const dir = "packages/web/data/bundles";
for (const f of readdirSync(dir)) {
  const b = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  if (b.summary.notProven > 0) { console.log(b.slug); break; }
}')"

GREEN="$(node -e '
const { readdirSync, readFileSync } = require("node:fs");
const dir = "packages/web/data/bundles";
for (const f of readdirSync(dir)) {
  const b = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  if (b.summary.notProven === 0) { console.log(b.slug); break; }
}')"

cat <<EOF

  ─────────────────────────────────────────────────────────────────────

  What Sarah saw when the work was NOT ready
    http://localhost:$HANDOVER_PORT/p/$RED

  What Sarah saw after the agent fixed it
    http://localhost:$HANDOVER_PORT/p/$GREEN

  The storefront being checked
    http://localhost:$STOREFRONT_PORT/

  ─────────────────────────────────────────────────────────────────────

  Open the first link. Two promises are marked "Not proven" — expand
  "Show me" on either one to see why.

EOF
