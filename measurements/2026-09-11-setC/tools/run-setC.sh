#!/bin/bash
# run-setC.sh <label> <served-model-name> <endpoint-url> <cap-minutes>
# Runs the 40 chained set-C goals for ONE model in a fresh isolated workspace (trial35), then scores
# the FINAL workspace with the hidden checks (checks-C.mjs) and keeps a copy of it. No new goal
# starts within 8 minutes of the cap; the app itself is stopped by a separate stopApp.mjs watchdog.
set -u
LABEL=$1; MODEL=$2; BASE=$3; CAP_MIN=$4
D=C:/Users/tatte/Projects/ai-coding-hub/measurements/2026-09-11-setC
STOP=$(node -e "console.log(Date.now() + ($CAP_MIN - 8) * 60000)")
LOG="$D/$LABEL-setC.log"
echo "$LABEL start $(date +%H:%M:%S); no new goals after $(node -e "console.log(new Date($STOP).toTimeString().slice(0,8))")" > "$D/$LABEL.status"
echo "$LABEL set C start $(date +%H:%M:%S)" > "$LOG"
TRIAL_STOP_AT=$STOP GOALS_FILE="$D/goals-C.json" MODEL_BASE="$BASE" MODEL_NAME="$MODEL" \
  LABEL="$LABEL-setC" node "$D/tools/trial35.mjs" >> "$LOG" 2>&1
echo "harness exit $? at $(date +%H:%M:%S)" >> "$LOG"
WS=$(grep -m1 '^workspace ' "$LOG" | sed 's/^workspace //')
if [ -n "$WS" ]; then
  mkdir -p "$D/data/$LABEL/workspace"
  (cd "$(cygpath -u "$WS")" && tar --exclude=.git --exclude=node_modules --exclude=__pycache__ -cf - .) | (cd "$D/data/$LABEL/workspace" && tar -xf -)
  node "$D/tools/checks-C.mjs" "$D/data/$LABEL/workspace" --out "$D/$LABEL-checks.json" > "$D/$LABEL-checks.txt" 2>&1
  tail -1 "$D/$LABEL-checks.txt" >> "$LOG"
fi
echo "$LABEL ALL DONE $(date +%H:%M:%S)" >> "$D/$LABEL.status"
