// WHAT SYNTACTIC STRUCTURES ACTUALLY BREAK?
//
// The calibration found that 12 of 12 observed v2 failures were LOAD ERRORS - the failure mass on
// the localized-addition lane never reached the semantic evaluator at all. But it recorded failure
// KINDS and not bytes, so it cannot say what the malformed output looks like. That is my own
// preserve-first rule broken in the one run whose purpose was diagnosis.
//
// This probe re-runs the densest failure sources with EVERY reply preserved, and classifies the
// break mechanically rather than by eye:
//
//     unbalanced_delimiters   counts of ( ) { } [ ] do not match
//     unterminated_string     odd number of quotes on some line
//     stray_fence             a markdown fence leaked into the code
//     bad_indent              python indentation error
//     truncated               output stops mid-token / hit the budget
//     duplicate_member        the same member emitted twice
//     other                   anything the above does not explain
//
// If seven failures share one or two mechanical forms, the next fix may be deterministic scaffolding
// rather than another agent redesign.
import { deriveContract } from './contract.mjs';
import { planOperation } from './operation.mjs';
import { spanAddMethod, spanAddFunction } from './fimspan.mjs';
import { checkContract } from './contractCheck.mjs';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const GOALS = JSON.parse(readFileSync('C:/Users/tatte/Projects/ai-coding-hub-indent/measurements/2026-09-12-setH/goals-H.json', 'utf8'));
const BASE = process.env.GATE_BASE || 'http://127.0.0.1:11434';
const MODEL = process.env.GATE_MODEL || 'qwen2.5-coder:1.5b';
const CASES = (process.env.CASES || '75:8,63:6').split(',').map((s) => {
  const [g, n] = s.split(':');
  return { goal: Number(g), n: Number(n) };
});

const world = new Map();
for (const d of ['seed', 'seed60']) {
  for (const f of readdirSync(join(HERE, d))) {
    const p = join(HERE, d, f);
    if (statSync(p).isFile()) world.set(f, readFileSync(p));
  }
}
const names = [...world.keys()].sort();
const freshWs = () => {
  const ws = mkdtempSync(join(tmpdir(), 'syn-'));
  writeFileSync(join(ws, 'package.json'), JSON.stringify({ name: 'ws', version: '1.0.0', type: 'commonjs' }, null, 2), 'utf8');
  for (const f of names) writeFileSync(join(ws, f), world.get(f));
  return ws;
};

// Seeds ARE used here: this probe is new code, not the frozen arm, so the diagnosis is reproducible.
async function fim(prefix, suffix, seed) {
  const r = await fetch(BASE + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: prefix, suffix, stream: false,
      options: { temperature: 0.7, top_p: 0.8, top_k: 20, repeat_penalty: 1.1, repeat_last_n: 64, num_predict: 900, seed } }),
    signal: AbortSignal.timeout(600000),
  });
  const j = await r.json();
  return { text: String(j.response || ''), done_reason: j.done_reason || null, eval_count: j.eval_count || null };
}

const FENCE = String.fromCharCode(96, 96, 96);

function classify(mid, lang, err) {
  const tags = [];
  const count = (s, ch) => (s.split(ch).length - 1);
  if (count(mid, '(') !== count(mid, ')')) tags.push('unbalanced_parens');
  if (lang !== 'py' && count(mid, '{') !== count(mid, '}')) tags.push('unbalanced_braces');
  if (count(mid, '[') !== count(mid, ']')) tags.push('unbalanced_brackets');
  if (mid.includes(FENCE)) tags.push('stray_fence');
  for (const line of mid.split('\n')) {
    const dq = count(line, '"') - count(line, '\\"');
    const sq = count(line, "'") - count(line, "\\'");
    if (dq % 2 === 1 || sq % 2 === 1) { tags.push('unterminated_string'); break; }
  }
  if (/IndentationError|unexpected indent|unindent/.test(String(err))) tags.push('bad_indent');
  if (/f-string/.test(String(err))) tags.push('fstring');
  if (/Unexpected end|Unexpected token '\}'|EOF/.test(String(err))) tags.push('truncated_shape');
  if (!tags.length) tags.push('other');
  return tags;
}

const OUT = mkdtempSync(join(tmpdir(), 'syntax-'));
mkdirSync(OUT, { recursive: true });
console.log('  syntax probe - every reply preserved, seeds explicit\n');

const all = [];
for (const { goal, n } of CASES) {
  const c = deriveContract(GOALS[goal - 1]);
  for (let seed = 1; seed <= n; seed++) {
    const ws = freshWs();
    const plan = planOperation(c, ws, GOALS[goal - 1]);
    const src = readFileSync(join(ws, c.lead), 'utf8');
    const span = plan.op === 'add_method'
      ? spanAddMethod(src, c.lang, plan.owner, plan.members[0].name)
      : spanAddFunction(src, c.lang, plan.fn);
    if (!span.ok) { console.log('  [' + goal + '/' + seed + '] span refused'); continue; }

    const out = await fim(span.prefix, span.suffix, seed);
    const candidate = span.prefix + out.text + span.suffix;
    writeFileSync(join(OUT, 'g' + goal + '.s' + seed + '.mid.txt'), out.text, 'utf8');
    writeFileSync(join(OUT, 'g' + goal + '.s' + seed + '.file.txt'), candidate, 'utf8');
    writeFileSync(join(ws, c.lead), candidate, 'utf8');
    const chk = checkContract(ws, c.lead, c);
    const err = chk.ok ? '' : (chk.reasons.find((r) => r.kind === 'load_error') || { items: [''] }).items[0] || chk.msg;
    const tags = chk.ok ? [] : classify(out.text, c.lang, err);
    all.push({ goal, seed, pass: chk.ok, bytes: out.text.length, done: out.done_reason,
      eval_count: out.eval_count, err: String(err).slice(0, 90), tags });
    console.log('  [' + goal + '/' + seed + '] ' + (chk.ok ? 'PASS' : 'fail')
      + '  mid=' + String(out.text.length).padStart(5) + 'B  done=' + String(out.done).padEnd(6)
      + '  ' + (chk.ok ? '' : tags.join('+') + '  ' + String(err).slice(0, 60)));
  }
}

writeFileSync(join(OUT, 'rows.json'), JSON.stringify(all, null, 2), 'utf8');
console.log('\n===== WHAT BREAKS =====');
const tally = {};
for (const r of all.filter((x) => !x.pass)) for (const t of r.tags) tally[t] = (tally[t] || 0) + 1;
const fails = all.filter((x) => !x.pass).length;
console.log('  failures ' + fails + '/' + all.length);
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log('    ' + k.padEnd(22) + v + '/' + fails);
}
const doneReasons = {};
for (const r of all) doneReasons[r.done] = (doneReasons[r.done] || 0) + 1;
console.log('  done_reason: ' + JSON.stringify(doneReasons));
const passBytes = all.filter((x) => x.pass).map((x) => x.bytes);
const failBytes = all.filter((x) => !x.pass).map((x) => x.bytes);
const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
console.log('  mean emitted bytes: pass ' + avg(passBytes) + '  fail ' + avg(failBytes));
console.log('\n  RAW = ' + OUT);
