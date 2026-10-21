#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f .env ]]; then set -a; source .env; set +a; fi
source scripts/unattended-env.sh
export WATCHERS_DIR="$PWD/server/enoch"
case "${1:-}" in
  gather)
    export GATHER_OUT="$PWD/data/gather-memory-v1"
    exec node server/gather.mjs 1001 5 ;;
  fuzz) exec node server/fuzzForever.mjs 100084 1 ;;
  watchers) exec node server/watchersTick.mjs ;;
  hub) export HUB_NO_BROWSER=1 HUB_SERVER_ONLY=1; exec bash ./start-hub-governed.sh ;;
  *) echo 'Expected hub, gather, fuzz, or watchers'; exit 2 ;;
esac
