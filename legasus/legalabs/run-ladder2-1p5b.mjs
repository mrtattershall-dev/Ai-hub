// LADDER 2 — two questions the first ladder raised and could not answer.
//
// (1) IS THE BOUNDARY "INTEGRATION", OR SPECIFICALLY "AUTHORITY TO DELETE WHAT EXISTS"?
//     Ladder 1 found R3 (return the replacement for a region of real code) collapses to 10/20 with
//     the failures turning SEMANTIC: the model returned a correct fragment as the replacement for a
//     region CONTAINING the guard it was told to preserve, deleting it. The authorized region held
//     code that had to survive, so surviving was the model's job.
//       R3   region contains the preserved guard      deletion authority present   (within-window control)
//       R3P  region is a slot between FIXED lines     deletion authority removed
//     One variable: does the authorized region contain code that must survive? Everything else -
//     model, temperature, token budget, task, acceptance policy, scoring - is identical.
//
// (2) THE R1 INVERSION, WITHOUT THE FORMAT CONFOUND.
//     Ladder 1's R1 is VOID as a rung: its prompt was a data sheet while its neighbours were English,
//     so it varied surface as well as responsibility. Inside that void sat a real observation - given
//     `upper bound: 10 (exclusive)` the model produced `n > 10` about half the time. Here the layout
//     is held FIXED (same field sheet, same field names) and only the wording of ONE field changes:
//       FMT_BOUND  applies to: upper bound 10 (exclusive), no lower bound
//       FMT_ENG    applies to: values below 10, with no lower limit
//     Same information, same responsibility, same number of lines. Only the surface differs.
//
// NOT A RESCORE. Ladder 1's recorded numbers stand exactly as published. This run uses a deliberately
// more tolerant acceptance policy (declared before the window, below), so its arms are comparable to
// EACH OTHER and not to ladder 1's table. That is why R3 is re-run here as a within-window control
// rather than carried over.
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
const OUT = process.argv[4] || './RESULT.ladder2.json';
const TEMPERATURE = 0.6;
const ARMS = (process.argv[5] || 'R2,R3,R3P,FMT_BOUND,FMT_ENG').split(',');
const CONTROL_ONLY = process.argv.includes('--control');

// The frozen marker. It is the ONE thing in an R3P prompt that tells the model where its lines go,
// and it is an ENGINEERING CHOICE Legasus already owns: placement is derived from the precedence
// ruling, never from the reference. The leakage scan is run with this exact line removed, so the
// exemption is mechanical and narrow rather than an accident of which words the regexes catch.
const MARKER = '    # >>> YOUR LINES GO HERE <<<';

const SRC = L(
  'def classify(n):',
  '    if n < 0:',
  '        return "negative"',
  '    if n == 0:',
  '        return "zero"',
  '    return "positive"',
);
const SRC_LINES = SRC.split(NL);
const FIXED = new Set(SRC_LINES.map((l) => l.trim()));

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

// ---- PROMPTS
function promptFor(arm, c, p) {
  if (arm === 'R2') {
    // Verbatim from ladder 1. Re-run here rather than carried over: the acceptance policy changed,
    // and measuring an arm again costs ten generations while arguing that a policy change could only
    // have helped costs a claim nobody can check.
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
  if (arm === 'R3') {
    // Verbatim reconstruction of ladder 1's R3: the authorized region IS the zero guard.
    const lo = ZERO_LINE;
    const hi = ZERO_LINE + 1;
    const region = SRC_LINES.slice(lo, hi + 1).join(NL);
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
  if (arm === 'R3P') {
    // Same integration problem, same real surrounding code - but the model writes INTO a slot instead
    // of replacing lines. Nothing it can return can remove an existing behaviour. No preservation
    // sentence is given, because preservation is no longer something it could fail at.
    const shown = L(...SRC_LINES.slice(0, p.insertAfter + 1), MARKER,
      ...SRC_LINES.slice(p.insertAfter + 1));
    return L('Here is a Python function. Every line shown is FIXED: you may not change, repeat or',
      'remove any of it.',
      '',
      shown,
      '',
      'A new behaviour is requested:',
      '    ' + c.delta,
      '',
      'Write ONLY the lines that take the place of the marker. Keep the same indentation.',
      'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.');
  }
  if (arm === 'FMT_BOUND' || arm === 'FMT_ENG') {
    const d = p.req.domain;
    const applies = arm === 'FMT_BOUND'
      ? 'upper bound ' + d.hi + (d.hiOpen ? ' (exclusive)' : ' (inclusive)') + ', no lower bound'
      : 'values ' + (d.hiOpen ? 'below ' : 'up to and including ') + d.hi + ', with no lower limit';
    return L('Translate this specification into Python.',
      '',
      '  variable:    ' + d.variable,
      '  applies to:  ' + applies,
      '  result:      ' + p.req.result,
      '',
      'Write a guard and its return, and nothing else.',
      'Do NOT write a function. Do NOT add any other case. Do NOT explain.');
  }
  throw new Error('unknown arm ' + arm);
}

// ---- ACCEPTANCE POLICY, declared before the window and identical for every arm.
//
// Ladder 1 rejected `if n > 10: return "small"` for being on one line, which counted a FORMAT
// rejection as a failure and made roughly half of R1's zeros unreadable. Here a one-line `if` is
// split and a comment-only line is ignored - pure surface normalization. It reshapes whitespace and
// nothing else, and the apparatus control proves it: a semantically WRONG fragment must still be
// accepted and still fail verification. Tolerance that could rescue a wrong answer would be a
// scoring change, not a format fix.
function normalize(text) {
  const fence = text.match(/```(?:python)?\s*([\s\S]*?)```/);
  const body = (fence ? fence[1] : text).split(NL);
  const out = [];
  for (const raw of body) {
    if (!raw.trim()) continue;
    if (/^\s*#/.test(raw)) continue;
    const one = raw.match(/^(\s*)((?:if|elif)\b[^:]*:|else\s*:)\s*(\S.*)$/);
    if (one) { out.push(one[1] + one[2]); out.push(one[1] + '    ' + one[3]); continue; }
    out.push(raw);
  }
  return out;
}

function accept(arm, text) {
  const body = normalize(text);
  if (arm === 'R3') {
    const keep = [];
    for (const raw of body) {
      if (/^\s*def\s/.test(raw)) return { ok: false, reason: 'returned a function' };
      if (/^\s*(if|elif|else)\b.*:\s*$/.test(raw) || /^\s*return\s/.test(raw)) keep.push(raw.trim());
      else return { ok: false, reason: 'line outside the authorized shape: ' + raw.trim().slice(0, 40) };
    }
    if (!keep.length || keep.length > 8) return { ok: false, reason: 'region size out of bounds' };
    return { ok: true, code: keep.map((l) => (/^return\b/.test(l) ? '        ' + l : '    ' + l)).join(NL) };
  }
  // R3P, FMT_BOUND, FMT_ENG all authorize exactly one guard and its return.
  const got = [];
  for (const raw of body) {
    if (/^\s*def\s/.test(raw)) return { ok: false, reason: 'returned a function' };
    if (arm === 'R3P' && FIXED.has(raw.trim())) return { ok: false, reason: 'repeated a fixed line' };
    if (/^\s*if\s.*:\s*$/.test(raw) && got.length === 0) { got.push(raw.trim()); continue; }
    if (/^\s*return\s/.test(raw) && got.length === 1) { got.push(raw.trim()); break; }
  }
  if (got.length !== 2) return { ok: false, reason: 'not exactly one guard and one return' };
  return { ok: true, code: '    ' + got[0] + NL + '        ' + got[1] };
}

function build(arm, code, p) {
  if (arm === 'R3') {
    const lo = ZERO_LINE;
    const hi = ZERO_LINE + 1;
    return L(...SRC_LINES.slice(0, lo), ...code.split(NL), ...SRC_LINES.slice(hi + 1));
  }
  return L(...SRC_LINES.slice(0, p.insertAfter + 1), ...code.split(NL),
    ...SRC_LINES.slice(p.insertAfter + 1));
}

function evaluate(program, expectedContested) {
  const ws = mkdtempSync(join(tmpdir(), 'lad2-'));
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

// ---- APPARATUS CONTROL. Every arm must be able to reach 10/10 with a perfect model, and must still
// fail with a wrong one. Without the second half, a tolerant acceptor could be hiding the result.
const PERFECT = {
  R2: { A: L('if n < 10:', '    return "small"'), B: L('if n < 10:', '    return "small"') },
  R3: { A: L('if n == 0:', 'return "zero"', 'if n < 10:', 'return "small"'),
    B: L('if n < 10:', 'return "small"', 'if n == 0:', 'return "zero"') },
  R3P: { A: L('    if n < 10:', '        return "small"'), B: L('    if n < 10:', '        return "small"') },
  FMT_BOUND: { A: L('if n < 10:', '    return "small"'), B: L('if n < 10:', '    return "small"') },
  FMT_ENG: { A: L('if n < 10:', '    return "small"'), B: L('if n < 10:', '    return "small"') },
};
// The inversion ladder 1 observed, written as a ONE-LINE if: exercises the new tolerance and must
// still be scored wrong.
const WRONG = {
  R2: { A: 'if n > 10: return "small"', B: 'if n > 10: return "small"' },
  R3: { A: L('if n == 0: return "zero"', 'if n > 10: return "small"'), B: L('if n > 10: return "small"', 'if n == 0: return "zero"') },
  R3P: { A: 'if n > 10: return "small"', B: 'if n > 10: return "small"' },
  FMT_BOUND: { A: 'if n > 10: return "small"', B: 'if n > 10: return "small"' },
  FMT_ENG: { A: 'if n > 10: return "small"', B: 'if n > 10: return "small"' },
};

function control() {
  let bad = 0;
  for (const arm of ARMS) {
    for (const [id, c] of Object.entries(CASES)) {
      const p = plan(c);
      const prompt = promptFor(arm, c, p);
      const scanned = prompt.split(NL).filter((l) => l !== MARKER).join(NL);
      const hits = leakageScan(scanned);
      if (hits.length) { console.log('  LEAKAGE ' + arm + '/' + id + ': ' + hits.join('; ')); bad++; }

      const a = accept(arm, PERFECT[arm][id]);
      if (!a.ok) { console.log('  CONTROL FAIL ' + arm + '/' + id + ' perfect rejected: ' + a.reason); bad++; continue; }
      const r = evaluate(build(arm, a.code, p), c.contested);
      if (!r.verified) { console.log('  CONTROL FAIL ' + arm + '/' + id + ' perfect not verified: ' + JSON.stringify(r)); bad++; }

      const w = accept(arm, WRONG[arm][id]);
      if (!w.ok) { console.log('  CONTROL FAIL ' + arm + '/' + id + ' wrong was REFUSED, not scored: ' + w.reason); bad++; continue; }
      const rw = evaluate(build(arm, w.code, p), c.contested);
      if (rw.verified) { console.log('  CONTROL FAIL ' + arm + '/' + id + ' WRONG fragment VERIFIED - the acceptor is rescuing it'); bad++; }
    }
  }
  console.log(bad ? '  CONTROLS FAILED: ' + bad : '  controls ok: every arm reaches 10/10 with a perfect'
    + ' model, and still fails with a wrong one; no prompt leaks');
  return bad === 0;
}

if (process.argv.includes('--prompts')) {
  for (const arm of ARMS) {
    for (const [id, c] of Object.entries(CASES)) {
      console.log('===== ' + arm + ' / case ' + id + ' =====');
      console.log(promptFor(arm, c, plan(c)));
      console.log('');
    }
  }
  process.exit(0);
}

if (!control()) process.exit(1);
if (CONTROL_ONLY) process.exit(0);

async function generate(prompt) {
  const r = await fetch(BASE.replace(/\/$/, '') + '/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false,
      options: { temperature: TEMPERATURE, num_predict: 160 } }),
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  return (await r.json()).response || '';
}

const tags = await (await fetch(BASE.replace(/\/$/, '') + '/api/tags')).json();
if (!(tags.models || []).map((m) => m.name).includes(MODEL)) {
  console.log('  RULE 3 FAILED'); process.exit(1);
}
console.log('  RULE 3 ok: endpoint names ' + MODEL);
console.log('  arms ' + ARMS.join(', ') + '   samples ' + SAMPLES + '   temperature ' + TEMPERATURE);
console.log('');

const results = { model: MODEL, temperature: TEMPERATURE, samples: SAMPLES, arms: {} };
for (const arm of ARMS) {
  results.arms[arm] = {};
  for (const [id, c] of Object.entries(CASES)) {
    const p = plan(c);
    const prompt = promptFor(arm, c, p);
    const rows = [];
    for (let i = 0; i < SAMPLES; i++) {
      let raw = '';
      try { raw = await generate(prompt); } catch (e) { rows.push({ error: String(e.message) }); continue; }
      const a = accept(arm, raw);
      if (!a.ok) { rows.push({ authorized: false, reason: a.reason, raw: raw.slice(0, 120) }); continue; }
      rows.push({ authorized: true, code: a.code.replace(/\s+/g, ' ').trim(),
        ...evaluate(build(arm, a.code, p), c.contested) });
    }
    const n = (f) => rows.filter(f).length;
    const s = { of: SAMPLES, verified: n((r) => r.verified), unauthorized: n((r) => r.authorized === false),
      no_op: n((r) => r.no_op), scope_violation: n((r) => r.scope_violation),
      semantic_error: n((r) => r.semantic_error), load_error: n((r) => r.loaded === false),
      variance: new Set(rows.map((r) => r.code || 'X')).size, rows };
    results.arms[arm][id] = s;
    console.log('  ' + arm.padEnd(9) + ' case ' + id + '   verified ' + s.verified + '/' + SAMPLES
      + '   unauth ' + s.unauthorized + '   no-op ' + s.no_op + '   scope ' + s.scope_violation
      + '   semantic ' + s.semantic_error + '   loaderr ' + s.load_error + '   variance ' + s.variance);
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
console.log('  written -> ' + OUT);
