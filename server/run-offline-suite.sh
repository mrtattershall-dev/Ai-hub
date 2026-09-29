#!/bin/bash
# The offline suite, with open bugs in the summary instead of hidden behind a green count.
#
#   bash run-suite.sh <worktree> <logfile>
#
# Every suite run this session reported "N green, 0 fail" - true, and quiet about the fact that some of those green
# files contain cases labelled "(known)" that are FAILING on purpose. A runner that cannot say that is the same silent
# failure the hub itself kept having: success reported over work that is not done. So this rolls up the KNOWN-OPEN:
# lines the tests now print, names the files carrying them, and still exits non-zero only on real failures.
#
# real* tests are skipped: they need a live GPU endpoint (MODEL_BASE) and this is the offline suite.
set -u
WT=${1:-/c/Users/tatte/Projects/ai-coding-hub-hfix}
LOG=${2:-/tmp/suite.log}
cd "$WT" || exit 1
: > "$LOG"
# Say WHICH TREE this is testing, in the log itself. WT defaults to a DIFFERENT worktree than the one you are
# standing in, so a suite run from the repo root silently tests somewhere else - and a green 84/84 from the wrong
# commit looks exactly like a green run of your own work. 2026-09-12: that nearly sent two paid GPU arms out on a
# suite that had never executed a line of the code in them.
echo "SUITE TREE: $WT @ $(git -C "$WT" rev-parse --short HEAD 2>/dev/null || echo unknown)" " ($(ls "$WT"/server/*.test.mjs 2>/dev/null | grep -v '/real' | wc -l) test files)" >> "$LOG"

# A Puppeteer "Navigation timeout of N ms exceeded" is the SAME class: 2026-09-12, verifierInfra failed in the suite
# with exit 1 while two paid GPU arms and another test run shared the machine, and passed 3/3 in isolation
# moments later on the same commit. A timeout inside a test that otherwise runs produces exit 1 WITH output, so
# it looked exactly like a genuine assertion failure and the 127 retry never fired.
# RETRY A 127 ONCE. Two files have now false-failed under load with exit 127 - shadowHint and teardownSettles - each
# dying before printing a single line and each passing cleanly when run alone. A suite that reports a phantom failure is
# a silent failure of its own: it sends you chasing a bug that is not there, and next time it might mask a real one. A
# single retry distinguishes "this file fails" from "the machine was busy", and the retry is logged either way.
for t in $(ls server/*.test.mjs | sed 's|server/||;s|\.test\.mjs||' | grep -v '^real'); do
  echo "=== $t" >> "$LOG"
  node "server/$t.test.mjs" >> "$LOG" 2>&1
  code=$?
  # RETRY THE TWO LOAD SIGNATURES, not just one. 127 is a file that died before printing anything. The other is a file
  # whose every case failed because the hub never came up: hostileModel failed all seven of its cases with "fetch
  # failed" under load and then passed 14/14 alone, with exit 1 - so keying only on 127 would have sent me chasing
  # seven phantom regressions. Retrying on "nothing could reach the hub" costs one re-run and removes a whole class of
  # phantom. A file that fails for a real reason fails the retry too.
  if [ "$code" -eq 127 ] || { [ "$code" -ne 0 ] && [ "$(tail -40 "$LOG" | grep -c 'fetch failed\|the hub did not start\|Navigation timeout of')" -gt 0 ]; }; then
    echo "--- exit $code ($t) - load-artefact signature (127, or nothing could reach the hub); retrying once" >> "$LOG"
    node "server/$t.test.mjs" >> "$LOG" 2>&1
    code=$?
    echo "--- retry exit $code ($t)" >> "$LOG"
  fi
  echo "--- exit $code ($t)" >> "$LOG"
done
echo "SUITE DONE" >> "$LOG"

green=$(grep -c '^--- exit 0' "$LOG")
fail=$(grep -c '^--- exit [^0]' "$LOG")
echo "files: $green green, $fail failed"
[ "$fail" -gt 0 ] && { echo "FAILED FILES:"; grep '^--- exit [^0]' "$LOG"; }

# Open-bug roll-up. A file that prints "KNOWN-OPEN: n of m expected" with n>0 is green AND carrying open bugs.
open_total=$(grep -o 'KNOWN-OPEN: [0-9]*' "$LOG" | awk '{s+=$2} END {print s+0}')
echo "open bugs documented by tests: $open_total"
if [ "$open_total" -gt 0 ]; then
  echo "WHERE (file: open cases):"
  awk '/^=== /{f=$2} /^KNOWN-OPEN: /{if ($2+0 > 0) print "  " f ": " $0} /^  still open: /{print "      " $0}' "$LOG"
fi
# A file using the convention but printing no marker is a test that silently lost its own check.
missing=$(comm -13 \
  <(grep -l 'KNOWN-OPEN' server/*.test.mjs 2>/dev/null | sed 's|server/||;s|\.test\.mjs||' | sort) \
  <(awk '/^=== /{f=$2} /^KNOWN-OPEN: /{print f}' "$LOG" | sort -u) 2>/dev/null)
[ -n "$missing" ] && echo "NOTE: printed a marker but not expected to: $missing"
exit "$fail"
