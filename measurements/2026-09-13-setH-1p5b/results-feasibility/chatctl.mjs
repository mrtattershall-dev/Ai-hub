// GENERAL vs CODER at 7B, on the one route both support.
//
// qwen2.5:7b has capabilities ["completion","tools"] - no `insert`. ollama refuses a FIM request
// outright ("does not support insert"), so conditions A and B are unavailable to it: they are both
// /api/generate with a suffix. That is an architectural fact, not a score.
//
// The route both models DO support is whole-file generation over /api/chat, which is what v2 already
// does for goals 64 and 74 (the prompt audit showed both route to content_edit). So this compares the
// two 7Bs on that route, with the 1.5B's own numbers available for the same route.
//
// It is NOT comparable to conditions A or B. Different route, different prompt, whole file rather than
// a span. Reported on its own.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { regressionFor } from './regression.mjs';
import { probe60For } from './probes60.mjs';
import { checkContract } from './contractCheck.mjs';
import { deriveContract } from './contract.mjs';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODELS = (process.env.MODELS || 'qwen2.5-coder:7b,qwen2.5:7b').split(',');
const CASES = (process.env.CASES || '64,74').split(',').map(Number);
const SEEDS = (process.env.SEEDS || '1,2,3').split(',').map(Number);
const FENCE = String.fromCharCode(96, 96, 96);

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'chatctl-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

const OUT = mkdtempSync(join(tmpdir(), 'chatctl-out-'));
const rows = [];

async function chat(model, prompt, seed) {
  const r = await fetch(BASE + '/api/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, stream: false,
      options: { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, num_predict: 2500, seed },
      messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(1800000),
  });
  const j = await r.json();
  return { text: String((j.message && j.message.content) || ''), done_reason: j.done_reason, eval_count: j.eval_count, error: j.error };
}

const extract = (reply) => {
  const m = reply.match(new RegExp(FENCE + '[a-zA-Z]*\\n([\\s\\S]*?)' + FENCE));
  return m ? m[1] : '';
};

console.log('  GENERAL vs CODER at 7B, whole-file chat route (NOT comparable to A or B)');
console.log('  base ' + BASE + '   models [' + MODELS + ']   seeds [' + SEEDS + ']\n');

for (const model of MODELS) {
  for (const goal of CASES) {
    const c = deriveContract(GOALS[goal - 1]);
    const suite = regressionFor(c.lead);
    const probe = probe60For(goal);
    for (const seed of SEEDS) {
      const ws = freshWs();
      const path = join(ws, c.lead);
      const before = readFileSync(path, 'utf8');
      const prompt = GOALS[goal - 1] + '\n\nHere is the current file ' + c.lead + ':\n\n'
        + FENCE + 'python\n' + before + '\n' + FENCE
        + '\n\nWrite the WHOLE updated file. It must keep every existing behaviour AND add the requested change.'
        + ' Reply with one ' + FENCE + 'python code block and nothing else.';
      let out;
      try { out = await chat(model, prompt, seed); } catch (e) { out = { text: '', error: String(e.message).slice(0, 80) }; }
      const body = extract(out.text);
      writeFileSync(join(OUT, model.replace(/[:.]/g, '_') + '.g' + goal + '.s' + seed + '.txt'), out.text, 'utf8');

      let loads = false; let reg = false; let delta = false; let why = '';
      if (!body.trim()) { why = out.error ? 'ERROR ' + out.error : 'no code block in reply'; }
      else {
        writeFileSync(path, body, 'utf8');
        const lo = checkContract(ws, c.lead, { ...c, moduleExports: [], members: [] });
        loads = lo.loads;
        if (!loads) why = 'LOAD: ' + String(lo.msg).slice(0, 60);
        else {
          reg = suite(ws).pass;
          delta = probe.run(ws).pass;
          if (!reg) why = 'OLD BROKE'; else if (!delta) why = 'DELTA';
        }
      }
      const verified = loads && reg && delta;
      rows.push({ model, goal, seed, bytes: body.length, tok: out.eval_count, loads, reg, delta, verified, why });
      console.log('  [' + model.padEnd(18) + ' g' + goal + ' s' + seed + '] '
        + String(body.length).padStart(5) + 'B/' + String(out.eval_count).padStart(4) + 'tok'
        + '  loads=' + String(loads).padEnd(5) + ' old=' + String(reg).padEnd(5) + ' delta=' + String(delta).padEnd(5)
        + (verified ? ' VERIFIED' : '  ' + why));
    }
  }
  console.log('');
}

writeFileSync(join(OUT, 'rows.json'), JSON.stringify(rows, null, 2), 'utf8');
console.log('===== WHOLE-FILE CHAT ROUTE =====');
for (const model of MODELS) {
  for (const goal of CASES) {
    const r = rows.filter((x) => x.model === model && x.goal === goal);
    if (!r.length) continue;
    console.log('  ' + model.padEnd(18) + ' goal ' + goal
      + '  loads ' + r.filter((x) => x.loads).length + '/' + r.length
      + '   OLD KEPT ' + r.filter((x) => x.reg).length + '/' + r.length
      + '   DELTA ' + r.filter((x) => x.delta).length + '/' + r.length
      + '   VERIFIED ' + r.filter((x) => x.verified).length + '/' + r.length);
  }
}
console.log('\n  RAW = ' + OUT);
