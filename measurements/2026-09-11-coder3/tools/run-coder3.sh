#!/bin/bash
# run-model.sh <label> <served-model-name> <endpoint-url> <cap-minutes>
# Runs Set A then Set B for ONE model, each in a fresh isolated workspace, logging to the
# head-to-head measurement folder. No new goal starts within 8 minutes of the app's cap; the
# app itself is stopped by a separate stopApp.mjs watchdog, never from here.
set -u
LABEL=$1; MODEL=$2; BASE=$3; CAP_MIN=$4
S=C:/Users/tatte/AppData/Local/Temp/claude/C--Users-tatte-OneDrive-Documents-ai-native-engine/a8160f8c-9099-46b5-8e59-75485c848e44/scratchpad
D=C:/Users/tatte/Projects/ai-coding-hub/measurements/2026-09-11-coder3
STOP=$(node -e "console.log(Date.now() + ($CAP_MIN - 8) * 60000)")
echo "$LABEL start $(date +%H:%M:%S); no new goals after $(node -e "console.log(new Date($STOP).toTimeString().slice(0,8))")" > "$D/$LABEL.status"
for SET in A B; do
  LOG="$D/$LABEL-set$SET.log"
  echo "$LABEL set $SET start $(date +%H:%M:%S)" > "$LOG"
  TRIAL_STOP_AT=$STOP GOALS_FILE="$D/goals-$SET.json" MODEL_BASE="$BASE" MODEL_NAME="$MODEL" \
    LABEL="$LABEL-set$SET" node "$S/trial35.mjs" >> "$LOG" 2>&1
  echo "harness exit $? at $(date +%H:%M:%S)" >> "$LOG"
  echo "$LABEL set $SET done $(date +%H:%M:%S)" >> "$D/$LABEL.status"
done
echo "$LABEL ALL DONE $(date +%H:%M:%S)" >> "$D/$LABEL.status"
