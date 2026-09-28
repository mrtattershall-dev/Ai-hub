// IS THE GENERATION BUDGET THE LIMITING MECHANISM?
//
// Everything is held constant except num_predict: same goal, same canonical source, same prompt,
// same decoding, same model, same route, SAME SEED. Only the output cap varies.
//
// The decisive pattern would be:
//     600  termination = length cap, reply ends mid-function, load FAIL
//     900  termination = natural stop, complete function, load PASS,
//          missing_export -> deterministic repair -> contract PASS
//
// If that holds, a failure attributed to model capability is actually an environment constraint:
// the harness capped a generation before the model finished expressing a solution it had already
// chosen.
//
// NOTE ON THE OLD CALIBRATION: its 1/8 for goal 75 stands. That is the measured performance of the
// frozen num_predict=600 configuration, and nothing here changes it. This is a NEW development
// experiment about WHY.
import { deriveContract } from './contract.mjs';
import { planOperation } from './operation.mjs';
import { spanAddMethod, spanAddFunction } from './fimspan.mjs';
import { checkContract } from './contractCheck.mjs';
import { classifyFailure, repairMissingExport, repairMissingRequire } from './repairGates.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const GOAL = Number(process.env.GOAL || 75);
const SEEDS = (process.env.SEEDS || '1,2,3,4,5,6').split(',').map(Number);
const BUDGETS = (process.env.BUDGETS || '600,900,1200').split(',').map(Number);

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'bud-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

async function fim(prefix, suffix, seed, npred) {
  const r = await fetch(BASE + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: false,
      options: { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64, num_predict: npred, seed } }),
    signal: AbortSignal.timeout(900000),
  });
  const j = await r.json();
  return { text: String(j.response || ''), done: j.done, done_reason: j.done_reason, eval_count: j.eval_count };
}

const OUT = mkdtempSync(join(tmpdir(), 'budget-'));
mkdirSync(OUT, { recursive: true });
const c = deriveContract(GOALS[GOAL - 1]);
console.log('  goal ' + GOAL + '  ' + c.lead + '   seeds [' + SEEDS + ']   budgets [' + BUDGETS + ']');
console.log('  everything else held constant\n');

const rows = [];
for (const seed of SEEDS) {
  for (const npred of BUDGETS) {
    const ws = freshWs();
    const plan = planOperation(c, ws, GOALS[GOAL - 1]);
    const src = readFileSync(join(ws, c.lead), 'utf8');
    const span = plan.op === 'add_method'
      ? spanAddMethod(src, c.lang, plan.owner, plan.members[0].name)
      : spanAddFunction(src, c.lang, plan.fn);
    if (!span.ok) { console.log('  span refused'); continue; }

    let out;
    try { out = await fim(span.prefix, span.suffix, seed, npred); }
    catch (e) {
      // A transport timeout is an environment event, not a model result - record and continue
      // rather than letting one hiccup destroy the rest of the run.
      console.log('  seed ' + seed + '  n=' + npred + '  TRANSPORT ERROR: ' + String(e.message).slice(0, 60));
      rows.push({ seed, npred, transport_error: String(e.message).slice(0, 80) });
      continue;
    }
    const candidate = span.prefix + out.text + span.suffix;
    writeFileSync(join(OUT, 'g' + GOAL + '.s' + seed + '.n' + npred + '.txt'), out.text, 'utf8');
    writeFileSync(join(ws, c.lead), candidate, 'utf8');

    const pre = checkContract(ws, c.lead, c);
    let repairAction = 'none';
    let post = pre;
    if (!pre.ok) {
      const cls = classifyFailure(pre, c, candidate);
      if (cls.route === 'deterministic') {
        const r = cls.kind === 'missing_export'
          ? repairMissingExport(candidate, c, cls.items)
          : repairMissingRequire(candidate, c, cls.items);
        if (r.ok) {
          writeFileSync(join(ws, c.lead), r.src, 'utf8');
          post = checkContract(ws, c.lead, c);
          repairAction = r.how;
        } else repairAction = 'refused: ' + r.why;
      } else repairAction = 'no deterministic route (' + cls.kind + ')';
    }
    const row = {
      seed, npred, bytes: out.text.length, eval_count: out.eval_count,
      done_reason: out.done_reason || null,
      hit_cap: out.eval_count !== null && out.eval_count >= npred,
      tail: out.text.slice(-60).replace(/\n/g, '\\n'),
      loads_before_repair: pre.loads,
      contract_before_repair: pre.ok ? 'PASS' : pre.reasons.map((x) => x.kind).join(','),
      repair: repairAction,
      contract_after_repair: post.ok ? 'PASS' : post.reasons.map((x) => x.kind).join(','),
      final: post.ok,
    };
    rows.push(row);
    console.log('  seed ' + seed + '  n=' + String(npred).padEnd(5)
      + ' emitted ' + String(row.bytes).padStart(5) + 'B/' + String(row.eval_count).padStart(4) + 'tok'
      + '  stop=' + String(row.done_reason).padEnd(7)
      + (row.hit_cap ? ' CAP' : '    ')
      + '  loads=' + String(row.loads_before_repair).padEnd(5)
      + '  ' + String(row.contract_before_repair).padEnd(16)
      + ' -> ' + (row.final ? 'PASS' : row.contract_after_repair));
  }
  console.log('');
}

writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows, null, 2), 'utf8');
console.log('===== BY BUDGET =====');
for (const n of BUDGETS) {
  const r = rows.filter((x) => x.npred === n);
  console.log('  n=' + String(n).padEnd(5)
    + ' final PASS ' + r.filter((x) => x.final).length + '/' + r.length
    + '   hit cap ' + r.filter((x) => x.hit_cap).length + '/' + r.length
    + '   loaded before repair ' + r.filter((x) => x.loads_before_repair).length + '/' + r.length
    + '   mean ' + Math.round(r.reduce((s, x) => s + x.bytes, 0) / r.length) + 'B');
}
console.log('\n  RAW = ' + OUT);
