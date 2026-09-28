// THE RESPONSIBILITY LADDER. One responsibility revealed per rung; everything else identical.
//
//   R0  transcription        condition and result appear in the prompt          measured, 20/20
//   R1  syntax               normalized domain and result as DATA -> code
//   R2  local semantics      the intent contract -> derive the guard yourself
//   R3  bounded integration  a small authorized REGION of real code -> edited region
//   R4  multi-operation      deferred: this task has one operation, and running it here would
//                            confound rung with task - the one thing the ladder separates
//   R5  whole function       measured, 5/20 and 3/20
//
// The point is the SHAPE, not whether a rung is still perfect. A cliff and a slope mean different
// things: a cliff locates a boundary in what this model can reliably own, a slope means responsibility
// trades off continuously.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { leakageScan } from '../legacore/assemble.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const BASE = process.argv[2];
const MODEL = 'qwen2.5-coder:1.5b';
const SAMPLES = Number(process.argv[3] || 10);
const OUT = process.argv[4] || './RESULT.ladder.json';
const TEMPERATURE = 0.6;
const RUNGS = (process.argv[5] || 'R1,R2,R3').split(',');

const SRC = L(
  'def classify(n):',
  '    if n < 0:',
  '        return "negative"',
  '    if n == 0:',
  '        return "zero"',
  '    return "positive"',
);

const CASES = {
  A: { delta: 'For other values below 10, return "small".',
    preservation: 'Preserve the existing special handling of zero.', contested: 'zero' },
  B: { delta: 'Values below 10 should now return "small", including values that previously returned "zero".',
    preservation: null, contested: 'small' },
};

const zero = existingBehaviours(SRC, 'classify').find((b) => b.condition === 'n == 0');
const ZERO_LINE = zero.line;

function plan(c) {
  const req = requestedBehaviour(c.delta, 'n', { soleParameter: true });
  const ov = overlap(zero.domain, req.domain);
  const prec = derivePrecedence({ preservation_text: c.preservation, delta_text: c.delta,
    existing: { condition: zero.condition, result: zero.result },
    requested: { condition: req.condition, result: req.result } }, ov);
  const before = prec.winner === 'requested';
  return { req, ov, prec, before, insertAfter: before ? ZERO_LINE - 1 : ZERO_LINE + 1 };
}

// ---- PROMPTS. Each rung hands over exactly one more responsibility than the one below.
function promptFor(rung, c, p) {
  if (rung === 'R1') {
    // The domain is given as DATA. The model must render it as code - syntax, not semantics.
    const d = p.req.domain;
    return L('Translate this specification into exactly two lines of Python.',
      '',
      '  variable:    ' + d.variable,
      '  upper bound: ' + d.hi + (d.hiOpen ? ' (exclusive)' : ' (inclusive)'),
      '  lower bound: none',
      '  result:      ' + p.req.result,
      '',
      'Write exactly:',
      '    if <condition>:',
      '        return <value>',
      '',
      'Do NOT write a function. Do NOT add any other case. Do NOT explain.');
  }
  if (rung === 'R2') {
    // The CONTRACT, not the condition. The model must derive the guard from the stated behaviour.
    return L('A function currently has this behaviour:',
      '    when ' + zero.condition + ', the result is ' + zero.result,
      '',
      'A new behaviour is requested:',
      '    ' + c.delta,
      '',
      'Write ONLY the new behaviour, as exactly two lines of Python:',
      '    if <condition>:',
      '        return <value>',
      '',
      'Do NOT write a function. Do NOT restate the existing behaviour. Do NOT explain.');
  }
  if (rung === 'R3') {
    // A REGION of real code. The model must return the edited region - integration authority returns.
    const lines = SRC.split(NL);
    const lo = p.before ? ZERO_LINE : ZERO_LINE;
    const hi = p.before ? ZERO_LINE + 1 : ZERO_LINE + 1;
    const region = lines.slice(lo, hi + 1).join(NL);
    return L('Here is a REGION of a Python function. You may only change this region.',
      '',
      region,
      '',
      'A new behaviour is requested:',
      '    ' + c.delta,
      '',
      p.before
        ? 'The new behaviour must apply BEFORE the behaviour shown above.'
        : 'The behaviour shown above must keep applying; the new behaviour is for the other inputs.',
      '',
      'Reply with the replacement for that region and nothing else. Keep the same indentation.',
      'Do NOT write the whole function. Do NOT explain.');
  }
  throw new Error('unknown rung ' + rung);
}

async function generate(prompt) {
  const r = await fetch(BASE.replace(/\/$/, '') + '/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false,
      options: { temperature: TEMPERATURE, num_predict: 160 } }),
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  return (await r.json()).response || '';
}

const strip = (t) => { const f = t.match(/```(?:python)?\s*([\s\S]*?)```/); return f ? f[1] : t; };

// R1/R2 authorize exactly one guard and one return. R3 authorizes a region of guard/return pairs.
function accept(rung, text) {
  const body = strip(text).split(NL);
  if (rung === 'R3') {
    const keep = [];
    for (const raw of body) {
      if (!raw.trim()) continue;
      if (/^\s*def\s/.test(raw)) return { ok: false, reason: 'returned a function' };
      if (/^\s*(if|elif|else)\b.*:\s*$/.test(raw) || /^\s*return\s/.test(raw)) keep.push(raw.replace(/^\s*/, ''));
      else return { ok: false, reason: 'line outside the authorized shape: ' + raw.trim().slice(0, 40) };
    }
    if (!keep.length || keep.length > 8) return { ok: false, reason: 'region size out of bounds' };
    // re-indent: guards at 4, returns at 8
    const out = keep.map((l) => (/^return\b/.test(l) ? '        ' + l : '    ' + l));
    return { ok: true, code: out.join(NL) };
  }
  const got = [];
  for (const raw of body) {
    if (!raw.trim()) continue;
    if (/^\s*def\s/.test(raw)) return { ok: false, reason: 'returned a function' };
    if (/^\s*if\s.*:\s*$/.test(raw) && got.length === 0) { got.push(raw.trim()); continue; }
    if (/^\s*return\s/.test(raw) && got.length === 1) { got.push(raw.trim()); break; }
  }
  if (got.length !== 2) return { ok: false, reason: 'not exactly one guard and one return' };
  return { ok: true, code: '    ' + got[0] + NL + '        ' + got[1] };
}

function build(rung, code, p) {
  const lines = SRC.split(NL);
  if (rung === 'R3') {
    const lo = ZERO_LINE;
    const hi = ZERO_LINE + 1;
    return L(...lines.slice(0, lo), ...code.split(NL), ...lines.slice(hi + 1));
  }
  return L(...lines.slice(0, p.insertAfter + 1), ...code.split(NL), ...lines.slice(p.insertAfter + 1));
}

function evaluate(program, expectedContested) {
  const ws = mkdtempSync(join(tmpdir(), 'lad-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    'print("C=" + str(impl.classify(0)))', 'print("S=" + str(impl.classify(5)))',
    'print("N=" + str(impl.classify(-3)))', 'print("P=" + str(impl.classify(50)))'), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const g = (k) => (out.match(new RegExp(k + '=(.*)')) || [])[1].trim();
    const r = { loaded: true, contested: g('C'), small: g('S'), neg: g('N'), pos: g('P') };
    r.delta_made = r.small === 'small';
    r.no_op = !r.delta_made;
    r.preservation_kept = r.neg === 'negative' && r.pos === 'positive';
    r.scope_violation = !['negative', 'zero', 'positive', 'small'].includes(r.pos)
      || !['negative', 'zero', 'positive', 'small'].includes(r.neg);
    r.semantic_error = r.contested !== expectedContested;
    r.verified = r.delta_made && r.preservation_kept && !r.semantic_error;
    return r;
  } catch (e) { return { loaded: false, verified: false, load_error: String(e.message).slice(0, 60) }; }
}

const tags = await (await fetch(BASE.replace(/\/$/, '') + '/api/tags')).json();
if (!(tags.models || []).map((m) => m.name).includes(MODEL)) {
  console.log('  RULE 3 FAILED'); process.exit(1);
}
console.log('  RULE 3 ok: endpoint names ' + MODEL);
console.log('  rungs ' + RUNGS.join(', ') + '   samples ' + SAMPLES + '   temperature ' + TEMPERATURE);
console.log('');

const results = { model: MODEL, temperature: TEMPERATURE, samples: SAMPLES, rungs: {} };
for (const rung of RUNGS) {
  results.rungs[rung] = {};
  for (const [id, c] of Object.entries(CASES)) {
    const p = plan(c);
    const prompt = promptFor(rung, c, p);
    const hits = leakageScan(prompt);
    if (hits.length) { console.log('  LEAKAGE ' + rung + '/' + id + ': ' + hits.join('; ')); process.exit(1); }
    const rows = [];
    for (let i = 0; i < SAMPLES; i++) {
      let raw = '';
      try { raw = await generate(prompt); } catch (e) { rows.push({ error: String(e.message) }); continue; }
      const a = accept(rung, raw);
      if (!a.ok) { rows.push({ authorized: false, reason: a.reason, raw: raw.slice(0, 100) }); continue; }
      rows.push({ authorized: true, code: a.code.replace(/\s+/g, ' ').trim(),
        ...evaluate(build(rung, a.code, p), c.contested) });
    }
    const n = (f) => rows.filter(f).length;
    const s = { of: SAMPLES, verified: n((r) => r.verified), unauthorized: n((r) => r.authorized === false),
      no_op: n((r) => r.no_op), scope_violation: n((r) => r.scope_violation),
      semantic_error: n((r) => r.semantic_error), load_error: n((r) => r.loaded === false),
      variance: new Set(rows.map((r) => r.code || 'X')).size, rows };
    results.rungs[rung][id] = s;
    console.log('  ' + rung + ' case ' + id + '   verified ' + s.verified + '/' + SAMPLES
      + '   unauth ' + s.unauthorized + '   no-op ' + s.no_op + '   scope ' + s.scope_violation
      + '   semantic ' + s.semantic_error + '   loaderr ' + s.load_error + '   variance ' + s.variance);
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
console.log('  written -> ' + OUT);
