#!/bin/bash
# run-setJ.sh <label> <served-model-name> <endpoint-url> <cap-minutes>
# Runs the 20-goal slice (goals 1-20 of the interleaved set) for ONE model in a fresh isolated workspace (trialJ.mjs), then scores
# the FINAL workspace with the hidden checks (checks-J.mjs) and keeps a copy of it. No new goal
# starts within 8 minutes of the cap; the app itself is stopped by a separate stopApp.mjs watchdog.
set -u
LABEL=$1; MODEL=$2; BASE=$3; CAP_MIN=$4
D=${SETI_DIR:-C:/Users/tatte/Projects/ai-coding-hub-setH/measurements/2026-09-12-setJ}   # SETG_DIR: dry runs only

# THE TREE THAT SERVES MUST BE THE TREE THAT IS MEASURED, AND IT MUST CARRY THE FIXES.
# trialJ.mjs used to spawn the MAIN checkout while the provenance line reported HUB_TREE, so a run could serve the
# UNPATCHED hub and label itself patched - then report that the fixes changed nothing. Refuse to start instead.
HUB_TREE=${HUB_TREE:-C:/Users/tatte/Projects/ai-coding-hub-indent}
AGENT_JS="$HUB_TREE/server/agent.js"
for sym in reindentTo regionAnchor noChangeAt; do
  grep -q "$sym" "$AGENT_JS" || { echo "REFUSING TO START: $AGENT_JS has no $sym - that is not the patched hub"; exit 3; }
done
HUB_SHA=$(git -C "$HUB_TREE" rev-parse --short HEAD 2>/dev/null || echo '?')
AGENT_MD5=$(md5sum "$AGENT_JS" | cut -c1-12)
echo "serving $HUB_TREE @ $HUB_SHA | agent.js md5 $AGENT_MD5"
STOP=$(node -e "console.log(Date.now() + ($CAP_MIN - 8) * 60000)")
LOG="$D/$LABEL-setJ.log"
echo "$LABEL start $(date +%H:%M:%S); no new goals after $(node -e "console.log(new Date($STOP).toTimeString().slice(0,8))")" > "$D/$LABEL.status"
echo "$LABEL set J start $(date +%H:%M:%S)" > "$LOG"
echo "serving $HUB_TREE @ $HUB_SHA | agent.js md5 $AGENT_MD5" >> "$LOG"
# HUB_TREE is an INLINE PREFIX on the node command, not a bare assignment above: a plain assignment is not exported
# to a child process, and trialJ.mjs reads process.env.HUB_TREE - whose own default is the MAIN checkout, i.e. the
# UNPATCHED hub. So without this prefix the run would serve the wrong tree while the guard above printed the right one.
HUB_TREE="$HUB_TREE" TRIAL_STOP_AT=$STOP GOALS_FILE="$D/goals-J20.json" MODEL_BASE="$BASE" MODEL_NAME="$MODEL" \
  RESULTS_JSON="$D/$LABEL-rows.json" LABEL="$LABEL-setJ" node "$D/tools/trialJ.mjs" >> "$LOG" 2>&1
echo "harness exit $? at $(date +%H:%M:%S)" >> "$LOG"
WS=$(grep -m1 '^workspace ' "$LOG" | sed 's/^workspace //')
if [ -n "$WS" ]; then
  mkdir -p "$D/data/$LABEL/workspace"
  (cd "$(cygpath -u "$WS")" && tar --exclude=.git --exclude=node_modules --exclude=__pycache__ -cf - .) | (cd "$D/data/$LABEL/workspace" && tar -xf -)
  node "$D/tools/checks-J.mjs" "$D/data/$LABEL/workspace" --out "$D/$LABEL-checks.json" > "$D/$LABEL-checks.txt" 2>&1
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
