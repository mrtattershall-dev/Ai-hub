#!/usr/bin/env bash
# Live status of everything Legasus runs unattended. Spends nothing.
cd "$(dirname "$0")" && node server/watchersTick.mjs --health && echo
node server/unattendedStatus.mjs
systemctl --user --no-pager --plain list-units 'legasus-*.service' --all 2>/dev/null
echo
# A fix counts as IN when its own patch reverses cleanly against the current code - i.e. the change is there.
# Fixes are applied as patches or cherry-picks, so git's own "merged" test cannot see them, and comparing whole
# files fails once the file has moved on (agent.js changes daily).
waiting=0
for b in $(git branch --list 'watchers/*' --format='%(refname:short)'); do
  if grep -q "^$b " server/watchersApplied.txt 2>/dev/null || git diff "$(git merge-base HEAD "$b")" "$b" | git apply -R --check 2>/dev/null; then echo "  in your code:     $b"; else echo "  WAITING FOR YOU:  $b"; waiting=$((waiting+1)); fi
done
echo "fixes waiting for you to merge: $waiting"
