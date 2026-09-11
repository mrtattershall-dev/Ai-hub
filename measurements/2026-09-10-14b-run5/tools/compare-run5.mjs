// compare-run5.mjs - base 14B vs the run5 adapter, same hub, same 40 goals. before=base after=run5.
//
//   node compare-rerun.mjs
//
// Written BEFORE the rerun produced anything, so it cannot be shaped to the answer.
// Baseline: the 14B's set A/B logs from the head-to-head (hub 725bf46).
// Rerun:    the same goals on hub 6854d73 (measurements/2026-09-10-14b-rerun).
// "worked" is the harness's own rule (every verdict token ends :runs / :ok / :parses), the same
// scorer both times. This is the SCORER's view; a flip is only credited to a fix after the
// per-goal check the rerun README records - run-to-run variance alone moved 10 goals by 3
// earlier tonight.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const M = 'C:/Users/tatte/Projects/ai-coding-hub/measurements';
const BASE = join(M, '2026-09-10-14b-rerun');
const RERUN = join(M, '2026-09-10-14b-run5');

function parse(log) {
  if (!existsSync(log)) return null;
  const rows = new Map();
  for (const line of readFileSync(log, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s+(\d+)\s+([a-z_]+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    if (!m) continue;
    const toks = m[8].trim().split(/\s+/).filter(Boolean);
    rows.set(Number(m[1]), { status: m[2], err: +m[5], secs: +m[7], disk: m[8].trim(),
      worked: toks.length > 0 && toks.every((t) => /:runs$|:ok$|:parses$/.test(t)) });
  }
  return rows;
}
const cell = (r) => (r ? `${r.worked ? 'WORK' : 'fail'} ${r.status === 'done' ? 'done' : r.status.slice(0, 4)}` : '-');

let flipsUp = 0, flipsDown = 0;
for (const set of ['A', 'B']) {
  const goals = JSON.parse(readFileSync(join(RERUN, `goals-${set}.json`), 'utf8'));
  const before = parse(join(BASE, `coder14b-base-set${set}.log`));
  const after = parse(join(RERUN, `coder14b-run5-set${set}.log`));
  console.log(`\n=== Set ${set} (${goals.length} goals) ===`);
  console.log(' #   before     after      goal');
  for (let i = 1; i <= goals.length; i++) {
    const b = before && before.get(i), a = after && after.get(i);
    let flag = '';
    if (b && a && b.worked !== a.worked) { flag = a.worked ? '  <- now works' : '  <- REGRESSED'; a.worked ? flipsUp++ : flipsDown++; }
    console.log(`${String(i).padStart(2)}   ${cell(b).padEnd(10)} ${cell(a).padEnd(10)} ${goals[i - 1].slice(0, 56)}${flag}`);
  }
  for (const [name, g] of [['before', before], ['after', after]]) {
    if (!g) { console.log(`${name}: no log`); continue; }
    const rs = [...g.values()];
    console.log(`${name.padEnd(6)}: ran ${rs.length}/${goals.length} | work ${rs.filter((r) => r.worked).length} | done ${rs.filter((r) => r.status === 'done').length} | tool errors ${rs.reduce((s, r) => s + r.err, 0)} | ${(rs.reduce((s, r) => s + r.secs, 0) / 60).toFixed(1)} min`);
  }
}
console.log(`\nflips: ${flipsUp} goal(s) now work, ${flipsDown} regressed (scorer view - check each before crediting a fix)`);
