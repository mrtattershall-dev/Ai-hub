// THE 61-80 PILOT. v2 (68ab72c) versus v3 (4be486d) from the frozen post-60 world (e76e14c).
//
// PROSPECTIVELY DESIGNATED A PILOT: the pre-inference audit found only three informative
// v3-treatment cases, so this can show the mechanism operating or failing but cannot estimate a
// treatment effect. No p-values for Predictions A or B.
//
// Same model, same decoding, same evaluator, same canonical seed, fresh verified workspace per goal.
// Only GENERATION and REPAIR differ between arms.
import { runGoal as runGoalV2 } from './arm.mjs';
import { runGoalV3 } from './arm3.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const ARMS = (process.env.ARMS || 'v2,v3').split(',');
const FIRST = Number(process.env.FIRST || 61);
const LAST = Number(process.env.LAST || 80);

// The canonical post-60 world = every post-40 file overlaid with its post-60 version.
const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const bundleHash = (m) => {
  const h = createHash('sha256');
  for (const f of names) h.update(f).update('\0').update(m.get(f));
  return h.digest('hex');
};
const CANONICAL_SHA = bundleHash(world);

// Same three invariants as the 41-60 runner, asserted per trial rather than assumed.
function freshWorkspace() {
  const ws = mkdtempSync(join(tmpdir(), 'g6180ws-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  const present = readdirSync(ws).filter((f) => statSync(join(ws, f)).isFile()).sort();
  const extra = present.filter((f) => f !== 'package.json' && !names.includes(f));
  if (extra.length) throw new Error('INSTRUMENT: residue in a fresh workspace: ' + extra.join(','));
  const got = bundleHash(new Map(names.map((f) => [f, readFileSync(join(ws, f))])));
  if (got !== CANONICAL_SHA) throw new Error('INSTRUMENT: workspace does not hash to the canonical post-60 seed');
  return { ws, startSha: got };
}

const OUT = mkdtempSync(join(tmpdir(), 'run6180-'));
console.log('  PILOT  arms ' + ARMS.join(' + ') + '   goals ' + FIRST + '-' + LAST);
console.log('  canonical post-60 seed ' + CANONICAL_SHA.slice(0, 16) + '  (asserted per trial)');
console.log('  out ' + OUT + '\n');

const all = {};
for (const arm of ARMS) {
  const dir = join(OUT, arm);
  mkdirSync(dir, { recursive: true });
  const rows = [];
  for (let g = FIRST; g <= LAST; g++) {
    const { ws, startSha } = freshWorkspace();
    let rec;
    try {
      rec = arm === 'v3'
        ? await runGoalV3({ ws, goalIndex: g - 1, goals: GOALS })
        : await runGoalV2({ arm: 'v2', ws, goalIndex: g - 1, goals: GOALS });
    } catch (e) {
      rec = { goal: g, arm, note: 'runner threw: ' + String(e.message).slice(0, 130), verified_goal_pass: false };
    }
    writeFileSync(join(dir, 'g' + g + '.reply.txt'), String(rec.raw_reply || ''), 'utf8');
    writeFileSync(join(dir, 'g' + g + '.bytes.txt'), String(rec.candidate_bytes || ''), 'utf8');
    const slim = { ...rec };
    delete slim.raw_reply;
    delete slim.candidate_bytes;
    slim.workspace = ws;
    slim.start_seed_bundle_sha = startSha;
    rows.push(slim);
    writeFileSync(join(dir, 'rows.json'), JSON.stringify(rows, null, 2), 'utf8');

    console.log('  [' + arm + ' ' + g + '] ' + String(rec.lead || '').padEnd(16)
      + String(rec.v3_route || rec.operation || '').padEnd(30)
      + ' calls=' + (rec.model_calls || 0)
      + '  contract=' + (rec.contract_pass ? 'PASS' : 'fail')
      + '  probe=' + (rec.behavioral_pass === null || rec.behavioral_pass === undefined ? '-' : (rec.behavioral_pass ? 'PASS' : 'fail'))
      + '  VERIFIED=' + (rec.verified_goal_pass ? 'YES' : 'no'));
    if (rec.members_requested) {
      console.log('        members ' + rec.members_completed + '/' + rec.members_requested
        + '  rollback=' + rec.rollback_triggered);
    }
    if (rec.old_regression_before !== null && rec.old_regression_before !== undefined) {
      console.log('        old regression before=' + rec.old_regression_before
        + ' after=' + rec.old_regression_after + '  delta=' + rec.new_delta_pass
        + '  rollback=' + rec.rollback_triggered);
    }
    if (rec.note) console.log('        ' + String(rec.note).slice(0, 140));
  }
  all[arm] = rows;
}

writeFileSync(join(OUT, 'all.json'), JSON.stringify(all, null, 2), 'utf8');
console.log('\n  RAW = ' + OUT);
