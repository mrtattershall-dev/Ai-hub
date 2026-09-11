#!/bin/bash
# launch-F.sh <app> <hf-model> <gpu> <served-name>
# Deploys <app>, proves identity (Rule 3: /api/health must name <hf-model>), then runs set F.
# The status file is written FIRST so the watchdog (stopApp.mjs only, Rule 7a) is armed before any
# GPU time; a failed deploy or identity check marks ALL DONE so the watchdog still stops the app.
set -u
APP=$1; HF=$2; GPU=$3; NAME=$4
H=C:/Users/tatte/Projects/ai-coding-hub; D=$H/measurements/2026-09-11-setF
LOG=$D/$APP-deploy-and-identity.log; STATUS=$D/$APP.status
URL=https://mr-tattershall--$APP-server-web.modal.run
echo "$APP launching $(date +%H:%M:%S)" > "$STATUS"
echo "deploy start $(date +%H:%M:%S)" > "$LOG"
cd "$H" && MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8 MYCODER_BASE=$HF MYCODER_GPU=$GPU MYCODER_NAME=$NAME \
  MYCODER_APP=$APP MYCODER_MIN_CONTAINERS=0 MYCODER_MAX_CONTAINERS=1 MYCODER_SCALEDOWN_S=120 \
  timeout 600 python -m modal deploy training-data/factory/modal_serve_vllm.py >> "$LOG" 2>&1 \
  || { echo "DEPLOY FAILED $(date +%H:%M:%S)" >> "$LOG"; echo "$APP ALL DONE deploy-failed" >> "$STATUS"; exit 1; }
OK=
for i in $(seq 1 12); do
  R=$(curl -s -m 150 "$URL/api/health")
  echo "health try $i $(date +%H:%M:%S): $R" >> "$LOG"
  if echo "$R" | grep -q "\"model\":\"$HF\""; then OK=1; break; fi
  sleep 15
done
[ -n "$OK" ] || { echo "IDENTITY NOT CONFIRMED - not running" >> "$LOG"; echo "$APP ALL DONE identity-failed" >> "$STATUS"; exit 1; }
bash "$D/tools/run-setF.sh" "$APP" "$NAME" "$URL" "${CAP_MIN:-95}"
