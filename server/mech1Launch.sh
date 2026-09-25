#!/usr/bin/env bash
# mech1Launch.sh - the MECH-1 procedure, exactly as MECH-1_DEFINITION.md records it.
#
#   bash server/mech1Launch.sh stage1 <workdir>    deploy, watchdog, wait, seed probe
#   bash server/mech1Launch.sh stage2 <workdir>    the campaign
#
# <workdir> holds: watchdog.log, DONE (the campaign's sentinel), probe.json, campaign.log.
# Nothing here retries a paid step. If a step fails the script exits non-zero and says so.
set -u
STAGE="${1:-}"; WORK="${2:-}"
[ -n "$STAGE" ] && [ -n "$WORK" ] || { echo "usage: mech1Launch.sh stage1|stage2 <workdir>"; exit 2; }
mkdir -p "$WORK"
export PYTHONIOENCODING=utf-8
APP=legasus-7b
URL="https://mr-tattershall--${APP}-server-web.modal.run"
DONE="$WORK/DONE"
stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

if [ "$STAGE" = "stage1" ]; then
  echo "[$(stamp)] STAGE1 start; HEAD $(git rev-parse --short HEAD)"
  git diff --quiet || { echo "[$(stamp)] REFUSING: uncommitted changes"; git status --short; exit 3; }
  echo "[$(stamp)] deploy"
  MYCODER_APP=$APP MYCODER_BASE=Qwen/Qwen2.5-Coder-7B-Instruct MYCODER_GPU=A10G \
  MYCODER_MIN_CONTAINERS=0 MYCODER_SCALEDOWN_S=900 MYCODER_MAXLEN=16384 \
    python -m modal deploy training-data/factory/modal_serve_vllm.py 2>&1 | tail -3 || { echo "[$(stamp)] DEPLOY FAILED"; exit 4; }
  echo "[$(stamp)] deployed; starting the watchdog (deadline 13800s, sentinel $DONE)"
  node server/gpuWatchdog.mjs --app $APP --deadline-sec 13800 --sentinel "$DONE" --log "$WORK/watchdog.log" \
    --poll-sec 15 --verify-sec 600 --stop-retries 3 --detach || { echo "[$(stamp)] WATCHDOG DID NOT START"; exit 5; }
  echo "[$(stamp)] waiting for $URL/api/tags"
  ok=0
  for i in $(seq 1 40); do
    s=$(curl -s -m 20 -o /dev/null -w '%{http_code}' "$URL/api/tags")
    if [ "$s" = "200" ]; then ok=1; break; fi
    sleep 15
  done
  [ "$ok" = "1" ] || { echo "[$(stamp)] MODEL NEVER ANSWERED /api/tags - the watchdog will stop it at its deadline; stop it now by hand"; exit 6; }
  echo "[$(stamp)] model up; seed probe"
  node server/seedProbe.mjs "$URL" 101 | tee "$WORK/probe.json"
  echo "[$(stamp)] STAGE1 done. Check the gate, then run stage2 WITHOUT idling 15 min (scaledown)."
  exit 0
fi

if [ "$STAGE" = "stage2" ]; then
  echo "[$(stamp)] STAGE2 start; HEAD $(git rev-parse --short HEAD)"
  git diff --quiet || { echo "[$(stamp)] REFUSING: uncommitted changes"; exit 3; }
  AUTODIAG_EXPERIMENT=MECH-1 AUTODIAG_ARMS=CONTROL,NOTIFY,AUTODIAG_ARM AUTODIAG_REPS=2 AUTODIAG_SEEDS=101,202 \
  AUTODIAG_TOTAL_SEC=12600 AUTODIAG_DONE_FILE="$DONE" AUTODIAG_HUB_COMMIT=$(git rev-parse --short HEAD) \
    node server/autodiag1.mjs "$URL"
  rc=$?
  echo "[$(stamp)] campaign process exited $rc"
  echo "[$(stamp)] app state now:"; python -m modal app list --json 2>&1 | grep -A3 "\"$APP\"" | head -6
  exit $rc
fi
echo "unknown stage $STAGE"; exit 2
