#!/bin/sh
# Continuous cycles until told to stop. Sequential WITHIN a cycle - the endpoint scales to
# four containers and three other sessions share it, so one batch at a time from here is
# the neighbourly amount.
#
# No process-name polling anywhere: `pgrep -f` matches no Windows node process, so an
# earlier version's wait loops exited instantly and ran four batches AT ONCE against a
# single container. Shell sequencing is the whole mechanism.
cd "C:/Users/tatte/Projects/ai-coding-hub/server"
B=https://mr-tattershall--qwen-serve-vllm-server-web.modal.run
CYCLE=1
while [ ! -f STOP ]; do
  echo "################ CYCLE $CYCLE  $(date +%H:%M:%S) ################"
  for spec in "fullAgent.mjs mixed" "yoloAgent.mjs yolo" "varianceAgent.mjs variance" "gameAgent.mjs games"; do
    [ -f STOP ] && break
    f=$(echo "$spec" | cut -d' ' -f1); tag=$(echo "$spec" | cut -d' ' -f2)
    idx="cycle${CYCLE}-${tag}-index.jsonl"
    echo "===== $tag (cycle $CYCLE) $(date +%H:%M:%S) -> $idx ====="
    TRIAL_INDEX="$PWD/$idx" MODEL_BASE=$B MODEL_NAME=mycoder node "$f" 60 2>&1 | tail -25
    echo "===== $tag done $(date +%H:%M:%S) ====="
  done
  CYCLE=$((CYCLE+1))
done
echo "################ STOPPED (STOP file present) ################"
