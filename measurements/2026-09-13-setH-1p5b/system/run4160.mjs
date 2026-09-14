// THE 41-60 HELD-OUT ARCHITECTURE EXPERIMENT.
//
//   v1  frozen a09e649 architecture: whole-file generation + deterministic repair
//   v2  frozen 68ab72c architecture: operation-specific FIM-first where PROVEN safe,
//       + dependency firewall + typed repair
//
// Identical model, identical canonical seed (77eed90), identical evaluator, identical decoding.
// Only GENERATION and REPAIR differ.
//
// PER-GOAL ISOLATION. Every goal starts from a fresh copy of the pristine canonical seed. Goals 41
// and 51 both edit s1_library.js, so running 41-60 sequentially would make the planner see state the
// FROZEN STRATA never described - the localization_preconditions were computed against the pristine
// seed. This experiment measures architecture efficacy on the edit itself; sequential survival under
// accumulated self-inflicted damage is a separate future experiment.
//
// PRESERVE FIRST, SCORE SECOND. Raw replies and written bytes hit disk before any aggregate is
// computed. Failures are preserved exactly as they happen - a v2 arm that writes nonsense into a FIM
// hole is a v2 failure, a v1 arm that imports networkx is a v1 failure. The experiment is not
// repaired while it runs.
import { runGoal } from './arm.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const SEED = join(HERE, 'seed');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const ARMS = (process.env.ARMS || 'v1,v2').split(',');
const FIRST = Number(process.env.FIRST || 41);
const LAST = Number(process.env.LAST || 60);

const OUT = mkdtempSync(join(tmpdir(), 'run4160-'));
const seedFiles = readdirSync(SEED).filter((f) => statSync(join(SEED, f)).isFile()).sort();

function freshWorkspace() {
  const ws = mkdtempSync(join(tmpdir(), 'goalws-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of seedFiles) copyFileSync(join(SEED, f), join(ws, f));
  return ws;
}

console.log('  arms ' + ARMS.join(' + ') + '   goals ' + FIRST + '-' + LAST);
console.log('  per-goal isolation: each goal starts from a fresh pristine canonical seed');
console.log('  out ' + OUT + '\n');

const all = {};
for (const arm of ARMS) {
  const dir = join(OUT, arm);
  mkdirSync(dir, { recursive: true });
  const rows = [];
  for (let g = FIRST; g <= LAST; g++) {
    const ws = freshWorkspace();
    let rec;
    try {
      rec = await runGoal({ arm, ws, goalIndex: g - 1, goals: GOALS });
    } catch (e) {
      rec = { goal: g, arm, note: 'runner threw: ' + String(e.message).slice(0, 120), verified_goal_pass: false };
    }
    // PRESERVE BEFORE SCORING
    writeFileSync(join(dir, 'g' + g + '.reply.txt'), String(rec.raw_reply || ''), 'utf8');
    writeFileSync(join(dir, 'g' + g + '.bytes.txt'), String(rec.candidate_bytes || ''), 'utf8');
    const slim = { ...rec };
    delete slim.raw_reply;
    delete slim.candidate_bytes;
    slim.workspace = ws;
    rows.push(slim);
    writeFileSync(join(dir, 'rows.json'), JSON.stringify(rows, null, 2), 'utf8');

    console.log('  [' + arm + ' ' + g + '] ' + String(rec.lead || '').padEnd(16)
      + String(rec.stratum || '').padEnd(21)
      + String(rec.operation || '').padEnd(14)
      + ' calls=' + (rec.model_calls || 0)
      + '  contract=' + (rec.contract_pass ? 'PASS' : 'fail')
      + '  probe=' + (rec.behavioral_pass === null || rec.behavioral_pass === undefined ? '-' : (rec.behavioral_pass ? 'PASS' : 'fail'))
      + '  VERIFIED=' + (rec.verified_goal_pass ? 'YES' : 'no'));
    if (rec.failure_kind) console.log('        kind: ' + rec.failure_kind);
    if (rec.note) console.log('        ' + String(rec.note).slice(0, 150));
  }
  all[arm] = rows;
}

writeFileSync(join(OUT, 'all.json'), JSON.stringify(all, null, 2), 'utf8');
console.log('\n  RAW = ' + OUT);
console.log('  rows preserved per arm; aggregates are computed by analyse4160.mjs, not here.');
