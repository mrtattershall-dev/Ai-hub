#!/bin/bash
# run-setK.sh <label> <served-model-name> <endpoint-url> <cap-minutes>
# Runs set K (the SAME 100 goals as set H, byte-identical file) for ONE model in a fresh isolated workspace
# (trialH.mjs), then scores the FINAL workspace with the same hidden checks (checks-H.mjs) and keeps a copy.
# No new goal starts within 8 minutes of the cap; the app itself is stopped by a separate stopApp.mjs watchdog.
#
# HUB_ENTRY IS THE WHOLE POINT OF THIS COPY. trialH.mjs defaults to
# C:/Users/tatte/Projects/ai-coding-hub/server/index.js - MAIN - which carries NONE of the fixes under test
# (verified: the message-count prune cap, the class-method outline and the refusal hand-back are all absent there).
# Running set K without this line would have spent the whole GPU window measuring the old hub while every record
# claimed otherwise. Set explicitly, never defaulted.
set -u
LABEL=$1; MODEL=$2; BASE=$3; CAP_MIN=$4
D=${SETK_DIR:-C:/Users/tatte/Projects/ai-coding-hub-setH/measurements/2026-09-13-setK}
HUB_ENTRY=${HUB_ENTRY:-C:/Users/tatte/Projects/ai-coding-hub-indent/server/index.js}
STOP=$(node -e "console.log(Date.now() + ($CAP_MIN - 8) * 60000)")
LOG="$D/$LABEL-setK.log"
echo "$LABEL start $(date +%H:%M:%S); no new goals after $(node -e "console.log(new Date($STOP).toTimeString().slice(0,8))")" > "$D/$LABEL.status"
echo "$LABEL set K start $(date +%H:%M:%S); hub entry $HUB_ENTRY" > "$LOG"
TRIAL_STOP_AT=$STOP GOALS_FILE="$D/goals-K.json" MODEL_BASE="$BASE" MODEL_NAME="$MODEL" HUB_ENTRY="$HUB_ENTRY" \
  RESULTS_JSON="$D/$LABEL-rows.json" LABEL="$LABEL-setK" node "$D/tools/trialH.mjs" >> "$LOG" 2>&1
echo "harness exit $? at $(date +%H:%M:%S)" >> "$LOG"
WS=$(grep -m1 '^workspace ' "$LOG" | sed 's/^workspace //')
if [ -n "$WS" ]; then
  mkdir -p "$D/data/$LABEL/workspace"
  (cd "$(cygpath -u "$WS")" && tar --exclude=.git --exclude=node_modules --exclude=__pycache__ -cf - .) | (cd "$D/data/$LABEL/workspace" && tar -xf -)
  node "$D/tools/checks-H.mjs" "$D/data/$LABEL/workspace" --out "$D/$LABEL-checks.json" > "$D/$LABEL-checks.txt" 2>&1
  tail -1 "$D/$LABEL-checks.txt" >> "$LOG"
  # The run records: run files, full transcripts, traces, run index and the workspace git (the checkpoints),
  # so every goal can be replayed later. hub.json (provider keys) is beside these, never copied.
  TD=$(dirname "$(cygpath -u "$WS")")
  mkdir -p "$D/runs/$LABEL"
  (cd "$TD" && tar -cf - runs traces index.jsonl) | (cd "$D/runs/$LABEL" && tar -xf -)
  (cd "$(cygpath -u "$WS")" && git bundle create "$D/runs/$LABEL/workspace.bundle" --all) >> "$LOG" 2>&1
  echo "records: $(ls "$D/runs/$LABEL/runs" | grep -c ".json$") run files, $(ls "$D/runs/$LABEL/runs" | grep -c "transcript") transcripts" >> "$LOG"
fi
echo "$LABEL ALL DONE $(date +%H:%M:%S)" >> "$D/$LABEL.status"
