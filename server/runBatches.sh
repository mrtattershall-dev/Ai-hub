#!/bin/sh
# Sequential, in ONE shell. No process-name polling: `pgrep -f` does not match Windows
# node processes, so the previous chain's wait loops exited instantly and all four batches
# ran AT ONCE against a single GPU whose generation is serialised behind a lock. They
# starved each other - tok/s fell from ~130 to 50 and runs "stopped" with zero errors,
# which looked like a product deadlock and was contention.
cd "C:/Users/tatte/Projects/ai-coding-hub/server"
B=https://mr-tattershall--qwen-serve-vllm-server-web.modal.run
run() {
  echo "===== BATCH: $1 ($(date +%H:%M:%S)) ====="
  TRIAL_INDEX="$PWD/$2" MODEL_BASE=$B MODEL_NAME=mycoder node "$1" "$3"
  echo "===== DONE: $1 ($(date +%H:%M:%S)) ====="
}
run fullAgent.mjs     trials-index.jsonl   75
run yoloAgent.mjs     yolo-index.jsonl     75
run varianceAgent.mjs variance-index.jsonl 75
run gameAgent.mjs     game-index.jsonl     75
echo "===== ALL BATCHES COMPLETE ====="
