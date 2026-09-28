// BOUNDED AUTHORITY arm. The model writes ONE guard and its return. Legasus does the rest.
//
//     Legasus   scope, placement, preservation, precedence, authority boundary
//     1.5B      one bounded semantic fragment
//
// PLACEMENT IS DERIVED FROM THE RULING, NOT FROM THE REFERENCE. 12C derived precedence from the
// specification; this converts that ruling into a position mechanically:
//
//     existing behaviour wins the overlap   ->  the new guard must NOT precede the existing guard
//     requested behaviour wins the overlap  ->  it MUST precede it
//
// Choosing one of the legal realizations is an ENGINEERING_CHOICE and is labelled as one. The model is
// not asked to make it and never sees the assembled function.
//
// WHY THIS IS THE RIGHT NEXT EXPERIMENT: the previous run showed intent was represented correctly and
// not converted into action - scope creep, no-op, source-order inertia. So the intervention is not a
// better prompt. It is less authority.
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
const TEMPERATURE = 0.6;              // identical to the previous run; a contrast cannot be biased by it
const NUM_PREDICT = 120;              // a fragment, not a function
const OUT = process.argv[4] || './RESULT.bounded.json';

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
    preservation: 'Preserve the existing special handling of zero.',
    contested_expected: 'zero' },
  B: { delta: 'Values below 10 should now return "small", including values that previously returned "zero".',
    preservation: null, contested_expected: 'small' },
};

const zero = existingBehaviours(SRC, 'classify').find((b) => b.condition === 'n == 0');
const ZERO_GUARD_LINE = zero.line;                       // where `if n == 0:` sits in SRC

// ---- the derived plan for one case: ruling -> position.
function plan(c) {
  const req = requestedBehaviour(c.delta, 'n', { soleParameter: true });
  const ov = overlap(zero.domain, req.domain);
  const prec = derivePrecedence({ preservation_text: c.preservation, delta_text: c.delta,
    existing: { condition: zero.condition, result: zero.result },
    requested: { condition: req.condition, result: req.result } }, ov);
  if (prec.outcome !== 'PRECEDENCE') return { ok: false, prec };
  // The ruling fixes the side; the exact boundary within that side is a canonical realization.
  const before = prec.winner === 'requested';
  const insertAfterLine = before ? ZERO_GUARD_LINE - 1 : ZERO_GUARD_LINE + 1;
  return { ok: true, req, ov, prec, before, insertAfterLine,
    realization: before
      ? 'ENGINEERING_CHOICE: immediately before the guard whose behaviour it outranks'
      : 'ENGINEERING_CHOICE: immediately after the guard that outranks it' };
}

// ---- the prompt. It describes ONE fragment and forbids everything else.
function boundedPrompt(c, p) {
  const t = L(
    'Write ONE guarded return, and nothing else.',
    '',
    'It must produce ' + p.req.result + ' when ' + p.req.condition + '.',
    '',
    'Write exactly two lines, indented by four spaces, in this form:',
    '    if <condition>:',
    '        return <value>',
    '',
    'Do NOT write a function. Do NOT write any other case. Do NOT explain.',
  );
  return t;
}

async function generate(prompt) {
  const r = await fetch(BASE.replace(/\/$/, '') + '/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false,
      options: { temperature: TEMPERATURE, num_predict: NUM_PREDICT } }),
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  return (await r.json()).response || '';
}

// ---- ACCEPT ONLY WHAT WAS AUTHORIZED. A fragment that is not one guard and one return is refused
// rather than repaired: repairing it would move authority back to the apparatus and make the arm
// unreadable. A refusal is recorded as `unauthorized`, which is a distinct failure from a wrong guard.
function extractFragment(text) {
  const fenced = text.match(/```(?:python)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).split(NL);
  const out = [];
  for (const raw of body) {
    if (!raw.trim()) continue;
    if (/^\s*def\s/.test(raw)) return { fragment: null, reason: 'returned a function' };
    if (/^\s*if\s.*:\s*$/.test(raw) && out.length === 0) { out.push(raw.trim()); continue; }
    if (/^\s*return\s/.test(raw) && out.length === 1) { out.push(raw.trim()); break; }
  }
  if (out.length !== 2) return { fragment: null, reason: 'not exactly one guard and one return' };
  return { fragment: '    ' + out[0] + NL + '        ' + out[1] };
}

// ---- Legasus assembles. The model's fragment goes at the derived position, nowhere else.
function assembleProgram(fragment, insertAfterLine) {
  const lines = SRC.split(NL);
  return L(...lines.slice(0, insertAfterLine + 1), ...fragment.split(NL),
    ...lines.slice(insertAfterLine + 1));
}

function evaluate(program, expectedContested) {
  const ws = mkdtempSync(join(tmpdir(), 'bnd-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    'print("C=" + str(impl.classify(0)))', 'print("S=" + str(impl.classify(5)))',
    'print("N=" + str(impl.classify(-3)))', 'print("P=" + str(impl.classify(50)))'), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const g = (k) => (out.match(new RegExp(k + '=(.*)')) || [])[1].trim();
    const r = { loaded: true, contested: g('C'), small: g('S'), neg: g('N'), pos: g('P') };
    r.delta_made = r.small === 'small';
    r.preservation_kept = r.neg === 'negative' && r.pos === 'positive';
    r.scope_violation = !['negative', 'zero', 'positive', 'small'].includes(r.pos)
      || !['negative', 'zero', 'positive', 'small'].includes(r.neg);
    r.precedence_correct = r.contested === expectedContested;
    r.conforms = r.delta_made && r.preservation_kept && r.precedence_correct;
    return r;
  } catch (e) { return { loaded: false, conforms: false, error: String(e.message).slice(0, 80) }; }
}

// ---- Rule 3
const tags = await (await fetch(BASE.replace(/\/$/, '') + '/api/tags')).json();
const names = (tags.models || []).map((m) => m.name);
if (!names.includes(MODEL)) {
  console.log('  RULE 3 FAILED: endpoint does not name ' + MODEL); process.exit(1);
}
console.log('  RULE 3 ok: endpoint names ' + MODEL);

const results = { arm: 'BOUNDED', model: MODEL, temperature: TEMPERATURE, samples: SAMPLES, cases: {} };
for (const [id, c] of Object.entries(CASES)) {
  const p = plan(c);
  if (!p.ok) { console.log('  case ' + id + ': no ruling derived, skipping'); continue; }
  const prompt = boundedPrompt(c, p);
  const hits = leakageScan(prompt);
  if (hits.length) { console.log('  LEAKAGE in case ' + id + ': ' + hits.join('; ')); process.exit(1); }
  console.log('  case ' + id + '  ruling: ' + p.prec.statement + '   ' + p.realization);

  const rows = [];
  for (let i = 0; i < SAMPLES; i++) {
    let raw = '';
    try { raw = await generate(prompt); } catch (e) { rows.push({ error: String(e.message) }); continue; }
    const ex = extractFragment(raw);
    if (!ex.fragment) { rows.push({ authorized: false, reason: ex.reason, raw: raw.slice(0, 120) }); continue; }
    const prog = assembleProgram(ex.fragment, p.insertAfterLine);
    rows.push({ authorized: true, fragment: ex.fragment.replace(/\s+/g, ' ').trim(), ...evaluate(prog, c.contested_expected) });
  }
  const tally = (f) => rows.filter(f).length;
  results.cases[id] = { ruling: p.prec.statement, rows,
    conforms: tally((r) => r.conforms), authorized: tally((r) => r.authorized),
    delta_made: tally((r) => r.delta_made), preservation_kept: tally((r) => r.preservation_kept),
    precedence_correct: tally((r) => r.precedence_correct),
    scope_violation: tally((r) => r.scope_violation), of: SAMPLES };
  const s = results.cases[id];
  console.log('    conforms ' + s.conforms + '/' + SAMPLES
    + '   authorized ' + s.authorized + '   delta ' + s.delta_made
    + '   preserved ' + s.preservation_kept + '   precedence ' + s.precedence_correct
    + '   scope-violation ' + s.scope_violation);
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
console.log('  written -> ' + OUT);
