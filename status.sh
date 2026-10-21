#!/usr/bin/env bash
# Live status of everything Legasus runs unattended. Spends nothing.
cd "$(dirname "$0")" && node server/watchersTick.mjs --health && echo && echo "fix branches waiting for you:" && git branch --list 'watchers/*' | sed 's/^/ /'
