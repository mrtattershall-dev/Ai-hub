// ARE THE v3 BEHAVIOURAL FAILURES BUDGET-BOUND TOO?
//
// Goal 75 established that a 600-token cap truncated a solution the model needed 629-632 tokens to
// finish. Goal 71's failures were 120-139 bytes, far under any cap, so those are genuine. For goals
// 64 and 74 the preserved pilot data cannot answer it: arm3 records fim_output_bytes only on the
// multi-insert route, and nothing recorded token counts or done_reason for safeReplace.
//
// This closes that gap. Same goal, same source, same prompt, same decoding, same seed - only the cap
// varies. If the v3 behavioural failures terminate on 'length', they are partly an environment
// constraint. If they terminate on 'stop' and still fail, they are genuine semantic failures and the
// v3 conclusion stands.
import { deriveContract } from './contract.mjs';
import { spanReplaceFunction } from './safeReplace.mjs';
import { regressionFor } from './regression.mjs';
import { checkContract } from './contractCheck.mjs';
import { probe60For } from './probes60.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const CASES = (process.env.CASES || '64,74').split(',').map(Number);
const SEEDS = (process.env.SEEDS || '1,2,3').split(',').map(Number);
const BUDGETS = (process.env.BUDGETS || '900,1800').split(',').map(Number);

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'bud2-'));
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
  return { text: String(j.response || ''), done_reason: j.done_reason, eval_count: j.eval_count };
}

const OUT = mkdtempSync(join(tmpdir(), 'budget2-'));
mkdirSync(OUT, { recursive: true });
console.log('  v3 safeReplace route - does the cap bite?\n');

const rows = [];
for (const goal of CASES) {
  const c = deriveContract(GOALS[goal - 1]);
  const probe = probe60For(goal);
  const suite = regressionFor(c.lead);
  for (const seed of SEEDS) {
    for (const npred of BUDGETS) {
      const ws = freshWs();
      const src = readFileSync(join(ws, c.lead), 'utf8');
      const span = spanReplaceFunction(src, c.lang, 'to_html');
      if (!span.ok) { console.log('  span refused: ' + span.why); continue; }

      let out;
      try { out = await fim(span.prefix, span.suffix, seed, npred); }
      catch (e) {
        console.log('  [' + goal + '/s' + seed + '/n' + npred + '] TRANSPORT ' + String(e.message).slice(0, 50));
        rows.push({ goal, seed, npred, transport_error: true });
        continue;
      }
      const candidate = span.prefix + out.text + span.suffix;
      writeFileSync(join(OUT, 'g' + goal + '.s' + seed + '.n' + npred + '.txt'), out.text, 'utf8');
      writeFileSync(join(ws, c.lead), candidate, 'utf8');

      const loadOnly = checkContract(ws, c.lead, { ...c, moduleExports: [], members: [] });
      const reg = loadOnly.loads ? suite(ws) : { pass: false, why: 'does not load' };
      const delta = (loadOnly.loads && reg.pass && probe) ? probe.run(ws) : { pass: false, why: 'not reached' };
      const row = {
        goal, seed, npred, bytes: out.text.length, eval_count: out.eval_count,
        done_reason: out.done_reason || null,
        hit_cap: out.eval_count !== null && out.eval_count >= npred,
        loads: loadOnly.loads, old_regression: reg.pass, new_delta: delta.pass,
        why: (!loadOnly.loads ? String(loadOnly.msg) : !reg.pass ? 'OLD BROKE: ' + reg.why : !delta.pass ? 'DELTA: ' + delta.why : '').slice(0, 76),
      };
      rows.push(row);
      console.log('  [' + goal + '/s' + seed + '/n' + String(npred).padEnd(4) + '] '
        + String(row.bytes).padStart(5) + 'B/' + String(row.eval_count).padStart(4) + 'tok'
        + ' stop=' + String(row.done_reason).padEnd(7) + (row.hit_cap ? 'CAP ' : '    ')
        + ' loads=' + String(row.loads).padEnd(5) + ' old=' + String(row.old_regression).padEnd(5)
        + ' delta=' + String(row.new_delta).padEnd(5) + ' ' + row.why);
    }
  }
  console.log('');
}

writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows, null, 2), 'utf8');
console.log('===== SUMMARY =====');
for (const goal of CASES) {
  for (const n of BUDGETS) {
    const r = rows.filter((x) => x.goal === goal && x.npred === n && !x.transport_error);
    if (!r.length) continue;
    console.log('  goal ' + goal + ' n=' + String(n).padEnd(5)
      + ' hit cap ' + r.filter((x) => x.hit_cap).length + '/' + r.length
      + '   loads ' + r.filter((x) => x.loads).length + '/' + r.length
      + '   old-regression green ' + r.filter((x) => x.old_regression).length + '/' + r.length
      + '   delta ' + r.filter((x) => x.new_delta).length + '/' + r.length);
  }
}
console.log('\n  RAW = ' + OUT);
