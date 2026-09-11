// compare-h2h.mjs - side-by-side table from the four head-to-head logs.
//
//   node compare-h2h.mjs [measurementDir]
//
// Written BEFORE the results existed, so it cannot be shaped to them. Reads each harness log's
// per-goal lines ("  N  status  steps calls err grd  secs  ON DISK") and prints, per set, the
// 14B and 32B verdicts next to each other, plus totals. "worked" uses the harness's own rule:
// every verdict token ends in :runs / :ok / :parses (so FN-MISSING, THROWS, MISSING fail).
// This is the SCORER's view; the hand verification afterwards is what the write-up reports.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const D = process.argv[2] || 'C:/Users/tatte/Projects/ai-coding-hub/measurements/2026-09-10-14b-vs-32b';
const MODELS = [['coder14b-base', '14B'], ['coder32b-awq', '32B']];

function parse(log) {
  if (!existsSync(log)) return null;
  const rows = new Map();
  for (const line of readFileSync(log, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s+(\d+)\s+([a-z_]+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    const disk = m[8].trim();
    const toks = disk.split(/\s+/).filter(Boolean);
    const worked = toks.length > 0 && toks.every((t) => /:runs$|:ok$|:parses$/.test(t));
    rows.set(Number(m[1]), { status: m[2], steps: +m[3], calls: m[4], err: +m[5], secs: +m[7], disk, worked });
  }
  return rows;
}

const short = (r) => r ? `${r.worked ? 'WORK' : 'fail'} ${r.status === 'done' ? 'done' : r.status.slice(0, 4)}` : '-';
for (const set of ['A', 'B']) {
  const goals = JSON.parse(readFileSync(join(D, `goals-${set}.json`), 'utf8'));
  const got = MODELS.map(([app]) => parse(join(D, `${app}-set${set}.log`)));
  console.log(`\n=== Set ${set} (${goals.length} goals) ===`);
  console.log(' #   14B        32B        goal');
  for (let i = 1; i <= goals.length; i++) {
    const [a, b] = got.map((g) => g && g.get(i));
    const flag = a && b && a.worked !== b.worked ? (a.worked ? '  <- 14B only' : '  <- 32B only') : '';
    console.log(`${String(i).padStart(2)}   ${short(a).padEnd(10)} ${short(b).padEnd(10)} ${goals[i - 1].slice(0, 58)}${flag}`);
  }
  for (const [k, [, name]] of MODELS.entries()) {
    const g = got[k];
    if (!g) { console.log(`${name}: no log`); continue; }
    const rs = [...g.values()];
    console.log(`${name}: ran ${rs.length}/${goals.length} | work ${rs.filter((r) => r.worked).length} | done ${rs.filter((r) => r.status === 'done').length} | tool errors ${rs.reduce((s, r) => s + r.err, 0)} | ${(rs.reduce((s, r) => s + r.secs, 0) / 60).toFixed(1)} min`);
  }
}
