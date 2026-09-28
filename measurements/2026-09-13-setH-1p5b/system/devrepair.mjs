// DEVELOPMENT-SET VALIDATION of the typed repair pipeline. Goals 1-20 ONLY.
//
// This is NOT an evaluation. These six failures were inspected and the repair architecture was
// designed around their shapes, so any uplift here measures how well their lessons were encoded -
// not generalization. Its job is only to prove the machinery runs end to end and that the metrics
// distinguish a real repair from one that merely satisfies the structural checker.
//
// The held-out evaluation is goals 21-40, whose generated outputs have NOT been looked at.
import { deriveContract } from './contract.mjs';
import { checkContract } from './contractCheck.mjs';
import { repairPipeline } from './repairPipeline.mjs';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const SRC = process.argv[2] || 'C:/Users/tatte/AppData/Local/Temp/baseline-3GWCKL/C';

const ws = mkdtempSync(join(tmpdir(), 'devrep-'));
writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');

// SEQUENTIAL, in goal order - the way the run actually produced them. Goals SHARE lead files
// (goals 1 and 11 both write s1_library.js, 3 and 13 both write s3_matrix.js, ...), so writing all
// twenty first and checking afterwards scores each goal against a LATER goal's artifact. That is
// how this harness first reported 9/20 where the run reported 14/20.
const contracts = [];
const first = [];
const recs = [];
for (let i = 0; i < 20; i++) {
  const c = deriveContract(GOALS[i]);
  contracts.push(c);
  const p = join(SRC, 'g' + String(i + 1).padStart(2, '0') + '.bytes');
  if (existsSync(p)) writeFileSync(join(ws, c.lead), readFileSync(p, 'utf8'), 'utf8');

  const r0 = checkContract(ws, c.lead, c);
  first.push({ goal: i + 1, pass: r0.ok, kinds: r0.reasons.map((x) => x.kind).join(',') });
  if (r0.ok) continue;

  const out = await repairPipeline(ws, c, GOALS[i]);
  const r = out.rounds[out.rounds.length - 1];
  recs.push({ goal: i + 1, ...out, rec: r });
  console.log('  [' + String(i + 1).padStart(2) + '] ' + c.lead.padEnd(16)
    + ' before=' + String(r.failure_kind_before || first[i].kinds).padEnd(16)
    + ' route=' + String(out.routes).padEnd(18)
    + ' calls=' + out.model_calls
    + '  ' + (out.contract_pass ? 'REPAIRED' : 'still failing'));
  console.log('        localization=' + (r.localization_method || '-')
    + '  prefix=' + r.prefix_chars + ' suffix=' + r.suffix_chars + ' out=' + r.fim_output_chars
    + '  changed=' + r.artifact_changed + '  loads_after=' + r.loads_after
    + '  orig_removed=' + r.original_failure_removed);
  if (r.note) console.log('        note: ' + r.note.slice(0, 150));
}
const firstPass = first.filter((x) => x.pass).length;
console.log('');
console.log('  FIRST TURN (no repair): ' + firstPass + '/20 contract pass');
first.filter((x) => !x.pass).forEach((x) => console.log('    [' + String(x.goal).padStart(2) + '] ' + x.kinds));

// Final state, and the regression check that matters: nothing that passed may have stopped passing.
const byGoal = new Map(recs.map((x) => [x.goal, x]));
const finalPass = first.map((f) => (f.pass ? true : !!(byGoal.get(f.goal) || {}).contract_pass));
// A pass is terminal and passing goals are never touched, so a regression could only come from a
// LATER goal's repair damaging an earlier artifact - checked explicitly rather than assumed.
let regressions = 0;
for (let i = 0; i < 20; i++) {
  if (!first[i].pass) continue;
  const r = checkContract(ws, contracts[i].lead, contracts[i]);
  if (!r.ok && contracts.slice(i + 1).every((c) => c.lead !== contracts[i].lead)) {
    regressions++; console.log('  REGRESSION on goal ' + (i + 1) + ': ' + r.msg.slice(0, 80));
  }
}

const repaired = recs.filter((x) => x.contract_pass).length;
const calls = recs.reduce((s, x) => s + x.model_calls, 0);
const byRoute = {};
recs.forEach((x) => { const k = x.routes; byRoute[k] = byRoute[k] || { n: 0, ok: 0 }; byRoute[k].n++; if (x.contract_pass) byRoute[k].ok++; });

console.log('\n===== DEVELOPMENT-SET PIPELINE CHECK (NOT an evaluation) =====');
console.log('  first-turn pass      ' + firstPass + '/20');
console.log('  after typed repair   ' + finalPass.filter(Boolean).length + '/20');
console.log('  repairs attempted    ' + recs.length + '   succeeded ' + repaired);
console.log('  model calls spent    ' + calls + '   (deterministic repairs cost zero)');
console.log('  REGRESSIONS on already-passing artifacts: ' + regressions + (regressions ? '   <-- VIOLATES THE SUCCESS CRITERION' : ''));
console.log('  by route:');
for (const [k, v] of Object.entries(byRoute)) console.log('    ' + k.padEnd(22) + ' ' + v.ok + '/' + v.n);
console.log('\n  ws ' + ws);
console.log('  Reminder: uplift here is not evidence. The rules were designed on these six failures.');
