#!/bin/bash
# run-setD-cont.sh <label> <served-model-name> <endpoint-url> <cap-minutes> <seed-dir> <goals-file>
# Continues set D from a saved start state: trial35 seeds its fresh workspace from <seed-dir> and runs <goals-file>
# (e.g. goals 72-100). Then the final workspace is scored with checks-D.mjs, like run-setD.sh.
set -u
LABEL=$1; MODEL=$2; BASE=$3; CAP_MIN=$4; SEED=$5; GOALS=$6
D=C:/Users/tatte/Projects/ai-coding-hub/measurements/2026-09-11-setD
STOP=$(node -e "console.log(Date.now() + ($CAP_MIN - 8) * 60000)")
LOG="$D/$LABEL-setD.log"
echo "$LABEL start $(date +%H:%M:%S); no new goals after $(node -e "console.log(new Date($STOP).toTimeString().slice(0,8))")" > "$D/$LABEL.status"
echo "$LABEL set D continuation start $(date +%H:%M:%S) seed $SEED goals $GOALS" > "$LOG"
SEED_DIR="$SEED" TRIAL_STOP_AT=$STOP GOALS_FILE="$GOALS" MODEL_BASE="$BASE" MODEL_NAME="$MODEL" \
  LABEL="$LABEL-setD" node "$D/tools/trial35.mjs" >> "$LOG" 2>&1
echo "harness exit $? at $(date +%H:%M:%S)" >> "$LOG"
WS=$(grep -m1 '^workspace ' "$LOG" | sed 's/^workspace //')
if [ -n "$WS" ]; then
  mkdir -p "$D/data/$LABEL/workspace"
  (cd "$(cygpath -u "$WS")" && tar --exclude=.git --exclude=node_modules --exclude=__pycache__ -cf - .) | (cd "$D/data/$LABEL/workspace" && tar -xf -)
  node "$D/tools/checks-D.mjs" "$D/data/$LABEL/workspace" --out "$D/$LABEL-checks.json" > "$D/$LABEL-checks.txt" 2>&1
  tail -1 "$D/$LABEL-checks.txt" >> "$LOG"
fi
echo "$LABEL ALL DONE $(date +%H:%M:%S)" >> "$D/$LABEL.status"
