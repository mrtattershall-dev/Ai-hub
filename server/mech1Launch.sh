#!/usr/bin/env bash
# mech1Launch.sh - the MECH-1 procedure, exactly as MECH-1_DEFINITION.md records it.
#
#   bash server/mech1Launch.sh stage1 <workdir>    deploy, watchdog, wait, seed probe
#   bash server/mech1Launch.sh stage2 <workdir>    the campaign
#
# Campaign parameters come from the environment so a frozen definition can name them
# exactly (defaults = MECH-1): CAMPAIGN_EXPERIMENT, CAMPAIGN_ARMS, CAMPAIGN_REPS, CAMPAIGN_SEEDS,
# CAMPAIGN_TOTAL_SEC, CAMPAIGN_TASK_IDS, CAMPAIGN_PER_TASK_SEC, CAMPAIGN_WATCHDOG_SEC,
# AGENT_MAX_STEPS, AUTODIAG_RECOVERY_POLICY.
#
# <workdir> holds: watchdog.log, DONE (the campaign's sentinel), probe.json, campaign.log.
# Nothing here retries a paid step. If a step fails the script exits non-zero and says so.
set -u
STAGE="${1:-}"; WORK="${2:-}"
[ -n "$STAGE" ] && [ -n "$WORK" ] || { echo "usage: mech1Launch.sh stage1|stage2 <workdir>"; exit 2; }
mkdir -p "$WORK"
export PYTHONIOENCODING=utf-8
APP=legasus-7b
URL="${CAMPAIGN_URL:-https://mr-tattershall--${APP}-server-web.modal.run}"
DONE="$WORK/DONE"
EXPERIMENT="${CAMPAIGN_EXPERIMENT:-MECH-1}"
ARMS="${CAMPAIGN_ARMS:-CONTROL,NOTIFY,AUTODIAG_ARM}"
REPS="${CAMPAIGN_REPS:-2}"
SEEDS="${CAMPAIGN_SEEDS:-101,202}"
TOTAL_SEC="${CAMPAIGN_TOTAL_SEC:-12600}"
PER_TASK_SEC="${CAMPAIGN_PER_TASK_SEC:-300}"
WATCHDOG_SEC="${CAMPAIGN_WATCHDOG_SEC:-13800}"
stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
# KEEP-AWAKE: an application-level request (SetThreadExecutionState), no power setting changed.
# OVERNIGHT-1 lost ~19 GPU-minutes and one unit's bound to the machine sleeping mid-campaign.
keepawake_start() {
  local secs="$1"
  cat > "$WORK/keepawake.ps1" <<'PS'
Add-Type -Namespace KA -Name P -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
$secs = [int]$args[0]; $until = [DateTime]::UtcNow.AddSeconds($secs)
"keepawake start $([DateTime]::UtcNow.ToString('o')) for ${secs}s"
while ([DateTime]::UtcNow -lt $until -and (Test-Path $env:KA_FLAG)) { [KA.P]::SetThreadExecutionState([uint32]2147483651) | Out-Null; Start-Sleep -Seconds 30 }
[KA.P]::SetThreadExecutionState([uint32]2147483648) | Out-Null
"keepawake end $([DateTime]::UtcNow.ToString('o'))"
PS
  touch "$WORK/keepawake.flag"
  KA_FLAG="$WORK/keepawake.flag" powershell -NoProfile -ExecutionPolicy Bypass -File "$WORK/keepawake.ps1" "$secs" > "$WORK/keepawake.log" 2>&1 &
  echo "[$(stamp)] keep-awake armed for ${secs}s (flag $WORK/keepawake.flag)"
}
keepawake_stop() { rm -f "$WORK/keepawake.flag"; echo "[$(stamp)] keep-awake released"; }

if [ "$STAGE" = "stage1" ]; then
  echo "[$(stamp)] STAGE1 start; HEAD $(git rev-parse --short HEAD)"
  git diff --quiet || { echo "[$(stamp)] REFUSING: uncommitted changes"; git status --short; exit 3; }
  keepawake_start "$WATCHDOG_SEC"
  echo "[$(stamp)] deploy"
  MYCODER_APP=$APP MYCODER_BASE=Qwen/Qwen2.5-Coder-7B-Instruct MYCODER_GPU=A10G \
  MYCODER_MIN_CONTAINERS=0 MYCODER_SCALEDOWN_S=900 MYCODER_MAXLEN=16384 \
    python -m modal deploy training-data/factory/modal_serve_vllm.py 2>&1 | tail -3 || { echo "[$(stamp)] DEPLOY FAILED"; exit 4; }
  echo "[$(stamp)] deployed; starting the watchdog (deadline ${WATCHDOG_SEC}s, sentinel $DONE)"
  node server/gpuWatchdog.mjs --app $APP --deadline-sec "$WATCHDOG_SEC" --sentinel "$DONE" --log "$WORK/watchdog.log" \
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
  [ "${CAMPAIGN_ALLOW_DIRTY:-0}" = "1" ] || git diff --quiet || { echo "[$(stamp)] REFUSING: uncommitted changes"; exit 3; }
  echo "[$(stamp)] experiment $EXPERIMENT arms $ARMS reps $REPS seeds $SEEDS total ${TOTAL_SEC}s per-task ${PER_TASK_SEC}s tasks ${CAMPAIGN_TASK_IDS:-all} max-steps ${AGENT_MAX_STEPS:-default} policy ${AUTODIAG_RECOVERY_POLICY:-default}"
  # SUPERVISED: if the runner exits without COMPLETE (no DONE file), relaunch it on the SAME
  # root up to CAMPAIGN_MAX_RELAUNCH times (default 2); it resumes past the recorded units. The
  # campaign wall clock is shared across relaunches through CAMPAIGN_DEADLINE_EPOCH.
  MAX_RELAUNCH="${CAMPAIGN_MAX_RELAUNCH:-2}"
  DEADLINE_EPOCH=$(( $(date +%s) + TOTAL_SEC ))
  ROOT_FILE="$WORK/root.txt"; rm -f "$ROOT_FILE"
  attempt=0; rc=1
  while :; do
    attempt=$((attempt+1))
    remaining=$(( DEADLINE_EPOCH - $(date +%s) ))
    [ "$remaining" -gt 200 ] || { echo "[$(stamp)] no campaign time left for attempt $attempt"; break; }
    root_env=""; [ -f "$ROOT_FILE" ] && root_env="$(cat "$ROOT_FILE")"
    echo "[$(stamp)] runner attempt $attempt (remaining ${remaining}s${root_env:+, resuming $root_env})"
    AUTODIAG_ROOT="$root_env" AUTODIAG_EXPERIMENT="$EXPERIMENT" AUTODIAG_ARMS="$ARMS" AUTODIAG_REPS="$REPS" AUTODIAG_SEEDS="$SEEDS" \
    AUTODIAG_TOTAL_SEC="$remaining" AUTODIAG_PER_TASK_SEC="$PER_TASK_SEC" AUTODIAG_TASK_IDS="${CAMPAIGN_TASK_IDS:-}" \
    AUTODIAG_DONE_FILE="$DONE" AUTODIAG_HUB_COMMIT=$(git rev-parse --short HEAD) AUTODIAG_ROOT_FILE="$ROOT_FILE" \
      node server/autodiag1.mjs "$URL" &
    runner_pid=$!
    # STALL DETECTION. A runner that is alive but making no progress (EVAL-1: two hours in an
    # unbounded docker wait) is killed BY PID and relaunched on its root. Progress = the summary
    # file changing; the allowance is one unit's bound plus CAMPAIGN_STALL_SLACK_SEC.
    stall_allow=$(( PER_TASK_SEC + ${CAMPAIGN_STALL_SLACK_SEC:-420} ))
    last_change=$(date +%s)
    last_size=-1
    while kill -0 "$runner_pid" 2>/dev/null; do
      sleep 15
      sf=""; [ -f "$ROOT_FILE" ] && sf="$(cat "$ROOT_FILE")/summary.jsonl"
      size=-1; [ -n "$sf" ] && [ -f "$sf" ] && size=$(stat -c %s "$sf" 2>/dev/null || echo -1)
      if [ "$size" != "$last_size" ]; then last_size=$size; last_change=$(date +%s); fi
      if [ $(( $(date +%s) - last_change )) -gt "$stall_allow" ]; then
        echo "[$(stamp)] STALL: no summary progress for ${stall_allow}s - killing runner pid $runner_pid"
        kill -9 "$runner_pid" 2>/dev/null
        break
      fi
    done
    wait "$runner_pid"; rc=$?
    echo "[$(stamp)] runner attempt $attempt exited $rc"
    [ -f "$DONE" ] && break
    [ "$attempt" -le "$MAX_RELAUNCH" ] || { echo "[$(stamp)] relaunch limit reached without COMPLETE"; break; }
    sleep 5
  done
  keepawake_stop
  echo "[$(stamp)] campaign process exited $rc"
  echo "[$(stamp)] app state now:"; python -m modal app list --json 2>&1 | grep -A3 "\"$APP\"" | head -6
  exit $rc
fi
echo "unknown stage $STAGE"; exit 2
