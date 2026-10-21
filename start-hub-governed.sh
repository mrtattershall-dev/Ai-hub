#!/usr/bin/env bash
# start-hub-governed.sh - Linux port of start-hub-governed.bat (product-path-1).
# Same contract: owner token, commands in the isolated Docker worker, bounded routes, governed writes.
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi

# The owner token. Kept OUTSIDE the repo, created once, never printed.
TOKEN_FILE="$HOME/.ai-hub/owner-token"
if [ ! -f "$TOKEN_FILE" ]; then
  mkdir -p "$HOME/.ai-hub" && chmod 700 "$HOME/.ai-hub"
  node -e "require('fs').writeFileSync(process.argv[1], require('crypto').randomBytes(24).toString('hex'), {mode: 0o600})" "$TOKEN_FILE"
fi
export HUB_TOKEN="$(cat "$TOKEN_FILE")"

# The worker image. worker.js pins the image ID built on the Windows machine; a Linux build gets a
# different ID, so build it here once and pin THIS machine's ID explicitly.
if ! docker image inspect legasus-worker:1 >/dev/null 2>&1; then
  echo "Building the worker image (first run only)..."
  docker build -t legasus-worker:1 -f docker/worker.Dockerfile docker || { echo "worker image build failed"; exit 1; }
fi
export AGENT_WORKER_IMAGE="$(docker image inspect legasus-worker:1 --format '{{.Id}}')"

export AGENT_WORKER_EXEC=1
export AGENT_BOUND_ROUTES=1
export AGENT_GOVERNED_WRITES=1
# LegaVerify: no finish while the agent's own last test is failing (server/finishEvidence.mjs).
export AGENT_FINISH_EVIDENCE=1
# LegaGate: a ceiling on the command worker. 1g because the local 7b already uses most of this laptop's RAM.
export AGENT_WORKER_MEMORY="${AGENT_WORKER_MEMORY:-1g}"
export AGENT_WORKER_CPUS="${AGENT_WORKER_CPUS:-2}"

echo "=================================================="
echo "   AI Coding Hub - governed (product-path-1)"
echo "   Starting server (:3001) + client (:5173)..."
echo "   Owner token: ~/.ai-hub/owner-token"
echo "   Worker image: $AGENT_WORKER_IMAGE"
echo "   Close this window (or Ctrl+C) to stop the hub."
echo "=================================================="

[ -z "$HUB_NO_BROWSER" ] && ( sleep 8; xdg-open http://localhost:5173/ >/dev/null 2>&1 ) &
npm start
