#!/bin/bash
# collect-h2h.sh - run AFTER both head-to-head runs finish and both apps are verified stopped.
# For each model x set log: copy its run folder into the measurement folder, build corpus rows
# tagged with the model and set (deduped against the CURRENT corpus, so a reply repeated across
# logs is stored once), append them (guarding the missing trailing newline), then rerun the
# corpus-reading tests once.
set -u
D=C:/Users/tatte/Projects/ai-coding-hub/measurements/2026-09-10-14b-vs-32b
S=C:/Users/tatte/AppData/Local/Temp/claude/C--Users-tatte-OneDrive-Documents-ai-native-engine/a8160f8c-9099-46b5-8e59-75485c848e44/scratchpad
H=C:/Users/tatte/Projects/ai-coding-hub
C="$H/server/testdata/model-corpus.jsonl"

trial_dir() {
  local w
  w=$(grep -m1 '^workspace ' "$1" | sed 's/^workspace //')
  [ -n "$w" ] || return 1
  dirname "$(cygpath -u "$w")"
}

collect() {   # $1 = app label, $2 = model tag, $3 = set letter
  local app=$1 tag=$2 set=$3 log="$D/$1-set$3.log" T out
  [ -f "$log" ] || { echo "$app set $set: no log - skipped"; return 0; }
  T=$(trial_dir "$log") || { echo "$app set $set: no workspace line - skipped"; return 0; }
  [ -d "$T/runs" ] || { echo "$app set $set: $T has no runs/ - skipped"; return 0; }
  out="$D/data/$app-set$set"
  mkdir -p "$out/workspace"
  cp -r "$T/runs" "$out/runs"
  [ -d "$T/traces" ] && cp -r "$T/traces" "$out/traces"
  [ -f "$T/index.jsonl" ] && cp "$T/index.jsonl" "$out/index.jsonl"
  (cd "$T/workspace" && tar --exclude=.git --exclude=node_modules -cf - .) | (cd "$out/workspace" && tar -xf -)
  echo "$app set $set: from $T - $(ls "$out/runs" | wc -l) runs, $(ls "$out/workspace" | wc -l) workspace entries"
  node "$S/buildcorpus14b.mjs" "$T/runs" "$out/corpus-rows.jsonl" "$tag" "h2h-2026-09-10-set$set" "$C" || return 1
  [ -n "$(tail -c1 "$C")" ] && printf '\n' >> "$C"
  cat "$out/corpus-rows.jsonl" >> "$C"
}

BEFORE=$(grep -c '' "$C")
collect coder14b-base coder14b A
collect coder14b-base coder14b B
collect coder32b-awq coder32b A
collect coder32b-awq coder32b B
AFTER=$(grep -c '' "$C")
echo "corpus lines: $BEFORE -> $AFTER"
node -e 'const L=require("fs").readFileSync(process.argv[1],"utf8").split("\n").filter(Boolean);const by={};let bad=0;for(const l of L){try{const m=JSON.parse(l).model||"(untagged)";by[m]=(by[m]||0)+1}catch{bad++}}console.log("corpus rows",L.length,"| by model",JSON.stringify(by),"| unparseable",bad)' "$C"

cd "$H/server"
for t in parserCorpus parseActions lineNumberStrip mockLoop fuzzInvariants; do
  timeout 600 node $t.test.mjs > /tmp/h2h_$t.out 2>&1
  echo "$t EXIT=$? | $(grep -E '[0-9]+ passed' /tmp/h2h_$t.out | tail -1)"
done
