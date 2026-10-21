#!/usr/bin/env bash
# Desktop launcher: warm the local model, start the governed hub if it is not already up, open it.
cd "$(dirname "$0")"
# The first real request loads 4B through the shared memory guard. No competing warm-up.
if systemctl --user cat legasus-hub.service >/dev/null 2>&1; then
  systemctl --user start legasus-hub.service || exit 1
  xdg-open http://localhost:5173/ >/dev/null 2>&1
  exit 0
fi
if ss -ltn | grep -q ':5173 '; then
  echo "The hub is already running - opening it."
  xdg-open http://localhost:5173/ >/dev/null 2>&1
  sleep 3
else
  ./start-hub-governed.sh
fi
