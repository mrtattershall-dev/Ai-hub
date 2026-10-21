#!/usr/bin/env bash
# Start the AI Coding Hub: server :3001 + client :5173, then open the browser.
cd "$(dirname "$0")"
# Optional settings (e.g. AGENT_PROVIDER=claude) live in .env next to this script.
if [ -f .env ]; then set -a; . ./.env; set +a; fi
( sleep 8; xdg-open http://localhost:5173/ >/dev/null 2>&1 ) &
npm start
