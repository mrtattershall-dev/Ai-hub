#!/bin/bash
# watchdog.sh <app> <status-file> <log> <cap-min>
# Stops <app> ONLY through stopApp.mjs (Rule 7a) when the status file says ALL DONE, or when
# <cap-min> minutes have passed since the harness started - whichever comes first.
APP=$1; STATUS=$2; LOG=$3; CAP_MIN=$4
H=C:/Users/tatte/Projects/ai-coding-hub
until [ -f "$STATUS" ]; do sleep 10; done
DEADLINE=$(( $(date +%s) + CAP_MIN * 60 ))
echo "armed $(date +%H:%M:%S): stop $APP on ALL DONE or at $CAP_MIN min" >> "$LOG"
while :; do
  if grep -q "ALL DONE" "$STATUS" 2>/dev/null; then WHY="ALL DONE"; break; fi
  if [ "$(date +%s)" -ge "$DEADLINE" ]; then WHY="CAP $CAP_MIN min"; break; fi
  sleep 20
done
echo "$(date +%H:%M:%S) $WHY -> node training-data/factory/stopApp.mjs $APP" >> "$LOG"
( cd "$H" && node training-data/factory/stopApp.mjs "$APP" ) >> "$LOG" 2>&1
RC=$?
echo "$(date +%H:%M:%S) stopApp exit $RC" >> "$LOG"
exit $RC
