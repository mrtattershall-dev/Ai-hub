#!/usr/bin/env bash
# narrow7b.sh - the hosted-7B cells of NARROW-1/2, on the identical frozen chain.
#
#   bash server/narrow7b.sh <workdir>
#
# Assumes stage1 of mech1Launch.sh has already deployed the app, armed the GPU watchdog and
# passed the seed probe. Runs three cells against the hosted model and writes the watchdog's
# sentinel the moment the last one finishes, so the GPU stops without waiting on this shell:
#
#   A  narrow v2 (seam verbatim), farm-i1, seeds 1-5   the strongest cell of the 2x2
#   B  narrow v1 (seam in prose), farm-i1, seeds 1-5   is the instruction-FORM effect
#                                                      size-dependent, or general?
#   C  narrow v2 chain i1 -> i2 -> i3 -> i4, seed 2    the milestone shape: each increment
#                                                      seeded from the previous ACCEPTED page,
#                                                      every earlier step protected
#
# Nothing about the play, the evaluator or the acceptance policy differs from the $0 cells.
set -u
WORK="${1:-}"
[ -n "$WORK" ] || { echo "usage: narrow7b.sh <workdir>"; exit 2; }
mkdir -p "$WORK"
APP=legasus-7b
URL="${NARROW_URL:-https://mr-tattershall--${APP}-server-web.modal.run}"
MODEL="${NARROW_MODEL:-mycoder}"
DEADLINE="${NARROW_DEADLINE_SEC:-300}"
stamp() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
run() { node server/narrowArtifact.mjs --model-url "$URL" --model "$MODEL" --deadline-sec "$DEADLINE" --max-tokens 4000 "$@"; }

echo "[$(stamp)] 7B cells start; url $URL model $MODEL"

echo "[$(stamp)] === CELL A: narrow v2 (seam verbatim), farm-i1, seeds 1-5 ==="
for s in 1 2 3 4 5; do run --task farm-i1 --protocol v2 --seed "$s" --out "$WORK/A-v2-seed$s.json"; done

echo "[$(stamp)] === CELL B: narrow v1 (seam in prose), farm-i1, seeds 1-5 ==="
for s in 1 2 3 4 5; do run --task farm-i1 --protocol v1 --seed "$s" --out "$WORK/B-v1-seed$s.json"; done

echo "[$(stamp)] === CELL C: narrow v2 chain i1 -> i4, seed 2 ==="
prev=""
for t in farm-i1 farm-i2 farm-i3 farm-i4; do
  ws_arg=""
  [ -n "$prev" ] && ws_arg="--workspace $prev"
  # --keep so the accepted workspace survives to seed the next increment.
  run --task "$t" --protocol v2 --seed 2 --keep $ws_arg --out "$WORK/C-$t.json" || true
  acc=$(node -e 'const r=require(process.argv[1]);process.stdout.write(r.boundaries&&r.boundaries.accepted?String(r.workspace):"")' "$WORK/C-$t.json" 2>/dev/null || true)
  if [ -z "$acc" ]; then echo "[$(stamp)] chain stops at $t: not accepted, so the next increment would start from an unverified state"; break; fi
  echo "[$(stamp)] chain: $t accepted, its workspace seeds the next increment"
  prev="$acc"
done

echo "[$(stamp)] 7B cells done; writing the watchdog sentinel"
echo "{\"done\":\"$(stamp)\"}" > "$WORK/DONE"
