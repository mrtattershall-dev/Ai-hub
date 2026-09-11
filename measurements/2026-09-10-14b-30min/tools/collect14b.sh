#!/bin/bash
# collect14b.sh - run AFTER the 14B window closes (both harness passes exited, app stopped).
# For each pass: copy its data into the measurement folder, build tagged corpus rows deduped
# against the CURRENT corpus (so a reply repeated across passes is stored once), append them
# (guarding the missing trailing newline), then rerun the corpus-reading tests once.
set -u
D=C:/Users/tatte/Projects/ai-coding-hub/measurements/2026-09-10-14b-30min
S=C:/Users/tatte/AppData/Local/Temp/claude/C--Users-tatte-OneDrive-Documents-ai-native-engine/a8160f8c-9099-46b5-8e59-75485c848e44/scratchpad
H=C:/Users/tatte/Projects/ai-coding-hub
C="$H/server/testdata/model-corpus.jsonl"

# A pass's temp folder is the parent of the "workspace <path>" line its own log printed.
trial_dir() {
  local w
  w=$(grep -m1 '^workspace ' "$1" | sed 's/^workspace //')
  [ -n "$w" ] || return 1
  dirname "$(cygpath -u "$w")"
}

collect_pass() {   # $1 = pass name, $2 = its log
  local name=$1 log=$2 T
  T=$(trial_dir "$log") || { echo "$name: no workspace line in $log - skipped"; return 0; }
  [ -d "$T/runs" ] || { echo "$name: $T has no runs/ - skipped"; return 0; }
  local out="$D/data/$name"
  mkdir -p "$out/workspace"
  cp -r "$T/runs" "$out/runs"
  [ -d "$T/traces" ] && cp -r "$T/traces" "$out/traces"
  [ -f "$T/index.jsonl" ] && cp "$T/index.jsonl" "$out/index.jsonl"
  (cd "$T/workspace" && tar --exclude=.git --exclude=node_modules -cf - .) | (cd "$out/workspace" && tar -xf -)
  echo "$name: from $T - $(ls "$out/runs" | wc -l) run files, $(ls "$out/workspace" | wc -l) workspace entries"

  node "$S/buildcorpus14b.mjs" "$T/runs" "$out/corpus-rows.jsonl" coder14b "trial-2026-09-10-14b-30min-$name" "$C" || return 1
  # The corpus was written with join('\n') and has NO trailing newline: a plain >> would glue
  # the first new row onto the last old one and corrupt both.
  [ -n "$(tail -c1 "$C")" ] && printf '\n' >> "$C"
  cat "$out/corpus-rows.jsonl" >> "$C"
}

BEFORE=$(grep -c '' "$C")
collect_pass pass1 "$D/run.log"
collect_pass pass2 "$D/run2.log"
AFTER=$(grep -c '' "$C")
echo "corpus lines: $BEFORE -> $AFTER"
node -e 'const L=require("fs").readFileSync(process.argv[1],"utf8").split("\n").filter(Boolean);let bad=0,tagged=0;for(const l of L){try{if(JSON.parse(l).model)tagged++}catch{bad++}}console.log("corpus rows",L.length,"| tagged with a model",tagged,"| unparseable",bad)' "$C"

cd "$H/server"
for t in parserCorpus parseActions lineNumberStrip mockLoop fuzzInvariants; do
  timeout 600 node $t.test.mjs > /tmp/c14_$t.out 2>&1
  echo "$t EXIT=$? | $(grep -E '[0-9]+ passed' /tmp/c14_$t.out | tail -1)"
done
