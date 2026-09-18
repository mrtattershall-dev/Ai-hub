// THE OPEN END, REVISION 2 — same experiment, repaired authority envelope.
//
// Revision 1 is untouched and its numbers stand, including the S_STRADDLE cells at 14B that it marked
// VOID. Those were void for one reason: the envelope accepted only `if`, the 14B writes `elif`, and
// after a returning branch those are equivalent - so CONSTRAIN was refusing a LEGAL realization and the
// result read as a catastrophic model failure that was entirely the apparatus.
//
// THE DECLARED DIFF, and nothing else: normalize, accept and conditionOf are replaced by
// legagate/envelope.mjs, which has ONE opinion about elif and an anti-oracle ADMIT list of ten legal
// realizations. contract-identity2.test.mjs compares the two files region by region and fails if
// anything else moved.
//
// ALL TWELVE CELLS ARE RE-RUN AT EVERY CAPACITY, not just the void ones. Widening an envelope can only
// move acceptance up, but it can move it up ANYWHERE, so a table half under the old envelope and half
// under the new one would not be a table. The old numbers stay as history; these are new.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { leakageScan } from '../legacore/assemble.mjs';
import { promptSufficiency } from './sufficiency.mjs';
import { contractProbes, checkProbes, containsPoint } from '../legaverify/probes.mjs';
import { authorize, guardConditionOf, normalizeFragment } from '../legagate/envelope.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const BASE = process.argv[2];
const SAMPLES = Number(process.argv[3] || 20);
const OUT = process.argv[4] || './RESULT.openend2.json';
const MODELS = (process.argv[5] || 'qwen2.5-coder:1.5b').split(',');
const TEMPERATURE = 0.6;
const CONTROL_ONLY = process.argv.includes('--control');
const MARKER = '    # >>> YOUR LINES GO HERE <<<';
const PARAM = 'n';

const SHAPES = {
  S_UPPER: {
    lines: ['def classify(n):', '    if n == 3:', '        return "three"',
      '    if n > 100000:', '        return "vast"', '    return "other"'],
    preservedCond: 'n == 3',
    domainPhrase: 'below 10', exclusionPhrase: 'n is not 3',
    result: '"small"',
    correct: 'if n < 10:', alt: 'if n < 10 and n != 3:',
  },
  S_LOWER: {
    lines: ['def classify(n):', '    if n == 200:', '        return "twohundred"',
      '    if n < 0:', '        return "negative"', '    return "other"'],
    preservedCond: 'n == 200',
    domainPhrase: 'above 100', exclusionPhrase: 'n is not 200',
    result: '"big"',
    correct: 'if n > 100:', alt: 'if n > 100 and n != 200:',
  },
  S_IVAL: {
    lines: ['def classify(n):', '    if n < 0:', '        return "negative"',
      '    if n > 100000:', '        return "vast"', '    return "other"'],
    preservedCond: 'n < 0',
    domainPhrase: 'below 10', exclusionPhrase: 'n is not below 0',
    result: '"small"',
    correct: 'if n < 10:', alt: 'if 0 <= n < 10:',
  },
  S_STRADDLE: {
    lines: ['def classify(n):', '    if n > 5:', '        return "big"', '    return "other"'],
    preservedCond: 'n > 5',
    domainPhrase: 'below 10', exclusionPhrase: 'n is not above 5',
    result: '"small"',
    correct: 'if n < 10:', alt: 'if n <= 5:',
  },
};

// The one variable. Everything outside these three strings is the shapes harness verbatim.
const OPEN_END = {
  S_UPPER: { negated: 'with no lower bound', extent: 'however small' },
  S_LOWER: { negated: 'with no upper bound', extent: 'however large' },
  S_IVAL: { negated: 'with no lower bound', extent: 'however small' },
  S_STRADDLE: { negated: 'with no lower bound', extent: 'however small' },
};
let CURRENT_SHAPE = null;
const RENDERINGS = {
  SILENT: (s) => 'For values ' + s.domainPhrase + ' where ' + s.exclusionPhrase
    + ', return ' + s.result + '.',
  NEGATED: (s) => 'For values ' + s.domainPhrase + ', ' + OPEN_END[CURRENT_SHAPE].negated
    + ', where ' + s.exclusionPhrase + ', return ' + s.result + '.',
  EXTENT: (s) => 'For every value ' + s.domainPhrase + ', ' + OPEN_END[CURRENT_SHAPE].extent
    + ', where ' + s.exclusionPhrase + ', return ' + s.result + '.',
};

const CELLS = [];
for (const shape of Object.keys(SHAPES)) for (const r of Object.keys(RENDERINGS)) CELLS.push({ shape, render: r });

function plan(shapeKey, renderKey) {
  CURRENT_SHAPE = shapeKey;
  const s = SHAPES[shapeKey];
  const src = s.lines.join(NL);
  const existing = existingBehaviours(src, 'classify');
  const preserved = existing.find((b) => b.condition === s.preservedCond);
  if (!preserved) throw new Error('preserved behaviour not found in ' + shapeKey);
  const delta = RENDERINGS[renderKey](s);
  const req = requestedBehaviour(delta, PARAM, { soleParameter: true });
  const ov = overlap(preserved.domain, req.domain);
  const prec = derivePrecedence({
    preservation_text: 'Preserve the existing special handling.', delta_text: delta,
    existing: { condition: preserved.condition, result: preserved.result },
    requested: { condition: req.condition, result: req.result } }, ov);
  const before = prec.winner === 'requested';
  return { s, src, lines: s.lines, existing, preserved, delta, req, ov, prec, before,
    insertAfter: before ? preserved.line - 1 : preserved.line + 1,
    fixed: new Set(s.lines.map((l) => l.trim())) };
}

function promptFor(p) {
  const shown = L(...p.lines.slice(0, p.insertAfter + 1), MARKER, ...p.lines.slice(p.insertAfter + 1));
  return L('Here is a Python function. Every line shown is FIXED: you may not change, repeat',
    'or remove any of it.', '', shown, '',
    'A new behaviour is requested:', '    ' + p.delta, '',
    'Write ONLY the lines that take the place of the marker. Keep the same indentation.',
    'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.');
}

// CONSTRAIN is no longer defined here. One module, one opinion, one place to fix it.
const normalize = (text) => normalizeFragment(text);
const accept = (text, p) => authorize(text, p.fixed);
const conditionOf = (text) => guardConditionOf(text);

const build = (code, p) => L(...p.lines.slice(0, p.insertAfter + 1), ...code.split(NL),
  ...p.lines.slice(p.insertAfter + 1));

// One python process answers every probe for one program.
function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'shape-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const map = new Map();
    inputs.forEach((v, i) => {
      const m = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
      map.set(v, m ? m[1].trim() : 'MISSING');
    });
    return map;
  } catch (e) { return null; }
}

// The contract, assembled from what DECIDE derived - never from a reference implementation.
function probesFor(p) {
  const originalCache = new Map();
  const original = (v) => {
    if (!originalCache.has(v)) {
      const m = runProgram(p.src, [v]);
      originalCache.set(v, m ? m.get(v) : 'ERROR');
    }
    return originalCache.get(v);
  };
  return contractProbes({
    requested: p.req.domain,
    requestedResult: p.req.result.replace(/"/g, ''),
    preserved: p.preserved.domain,
    preservedWins: p.prec.winner === 'existing',
    existing: p.existing,
  }, original);
}

// Is a candidate genuinely equivalent to the contract, or merely outside the probe set?
//
// The probe set is deliberately small - a handful of points chosen from the contract's structure. A
// candidate that passes it might be correct, or might differ somewhere nobody probed. This settles it
// by evaluating the contract's own expectation at every integer in a wide band plus the far points,
// which is far too expensive to use as the verifier and exactly right as a control ON the verifier.
function denseAgreement(p, code) {
  const inputs = [];
  for (let v = -300; v <= 300; v++) inputs.push(v);
  inputs.push(-1000000, -10000, 10000, 1000000);
  const orig = runProgram(p.src, inputs);
  const cand = runProgram(build(code, p), inputs);
  if (!orig || !cand) return { agrees: false, checked: 0, firstDiff: { input: 'n/a', expected: 'loaded', got: 'did not load' } };
  const wins = p.prec.winner === 'existing';
  for (const v of inputs) {
    const claimed = containsPoint(p.req.domain, v);
    const heldBack = wins && containsPoint(p.preserved.domain, v);
    const expected = claimed && !heldBack ? p.req.result.replace(/"/g, '') : orig.get(v);
    if (cand.get(v) !== expected) return { agrees: false, checked: inputs.length, firstDiff: { input: v, expected, got: cand.get(v) } };
  }
  return { agrees: true, checked: inputs.length };
}

function control() {
  let bad = 0;
  for (const cell of CELLS) {
    const tag = cell.shape + '/' + cell.render;
    let p;
    try { p = plan(cell.shape, cell.render); } catch (e) { console.log('  PLAN ERROR ' + tag + ': ' + e.message); bad++; continue; }
    const s = SHAPES[cell.shape];

    // Both renderings of a shape must plan IDENTICALLY, or this compares placements not wordings.
    const ref = plan(cell.shape, 'SILENT');
    if (p.req.condition !== ref.req.condition || p.req.result !== ref.req.result
      || p.prec.winner !== ref.prec.winner || p.insertAfter !== ref.insertAfter) {
      console.log('  PLAN DIVERGENCE ' + tag + ': ' + p.req.condition + ' / ' + p.prec.winner); bad++;
    }
    if (p.ov.result !== 'SATISFIABLE') { console.log('  NO OVERLAP ' + tag + ' - shape poses no precedence question'); bad++; }

    const prompt = promptFor(p);
    const hits = leakageScan(prompt.split(NL).filter((l) => l !== MARKER).join(NL));
    if (hits.length) { console.log('  LEAKAGE ' + tag + ': ' + hits.join('; ')); bad++; }
    const perfect = L('    ' + s.correct, '        return ' + s.result);
    if (!promptSufficiency(prompt, perfect).sufficient) { console.log('  SUFFICIENCY FAIL ' + tag); bad++; }

    let probes;
    try { probes = probesFor(p); } catch (e) { console.log('  PROBE SET REFUSED ' + tag + ': ' + e.message); bad++; continue; }

    // ADMITS: the canonical realization and a second legal one must both pass.
    for (const [label, guard] of [['canonical', s.correct], ['alternative', s.alt]]) {
      const a = accept(L(guard, '    return ' + s.result), p);
      if (!a.ok) { console.log('  ANTI-ORACLE FAIL ' + tag + ' ' + label + ' rejected: ' + a.reason); bad++; continue; }
      const res = runProgram(build(a.code, p), probes.map((x) => x.input));
      const r = res ? checkProbes(probes, (v) => res.get(v)) : { passed: false, failures: [{ why: 'did not load' }] };
      if (!r.passed) {
        console.log('  ANTI-ORACLE FAIL ' + tag + ' ' + label + ' (' + guard + ') rejected by probes: '
          + JSON.stringify(r.failures.slice(0, 2))); bad++;
      }
    }
    // KILLS: mutants chosen from the contract's own structure, not from observed model failures.
    const T = p.req.domain.hi !== undefined && Number.isFinite(p.req.domain.hi)
      ? p.req.domain.hi : p.req.domain.lo;
    const mutants = [
      // A two-step swap needs a placeholder. It must be ORDINARY TEXT: the first version used a raw
      // U+0001 as the sentinel, which is invisible, and escape-guard refused the file for it.
      ['inverted', s.correct.replace('<', '@@').replace('>', '<').replace('@@', '>')],
      ['invented lower bound', 'if 0 < n < ' + T + ':'],
      ['off by one', s.correct.replace('<', '<=').replace(/>(?!=)/, '>=')],
    ];
    for (const [label, guard] of mutants) {
      if (guard === s.correct) continue;
      const a = accept(L(guard, '    return ' + s.result), p);
      if (!a.ok) continue;
      const res = runProgram(build(a.code, p), probes.map((x) => x.input));
      const r = res ? checkProbes(probes, (v) => res.get(v)) : { passed: false };
      if (!r.passed) continue;
      // A SURVIVING MUTANT IS ONLY A FAILURE IF IT IS ACTUALLY WRONG.
      //
      // `n <= 10` survives on S_STRADDLE, and the probe set is not at fault: the preserved guard
      // `n > 5` already absorbs 6 through 10, so the off-by-one is UNREACHABLE and the realization is
      // genuinely correct. Counting it as a probe-set gap would have sent me hunting a defect that
      // does not exist - and, worse, might have driven a "fix" that rejects a legal realization.
      //
      // So equivalence is decided by a dense semantic sweep against the contract, not by assumption.
      const dense = denseAgreement(p, a.code);
      if (dense.agrees) {
        console.log('  ' + tag + ' NOTE: `' + guard + '` is a LEGAL realization here ('
          + dense.checked + ' inputs agree with the contract) - the preserved guard makes it'
          + ' unreachable, so it is not a mutant on this shape');
        continue;
      }
      console.log('  MUTANT SURVIVED ' + tag + ' ' + label + ': ' + guard
        + '   first disagreement at n = ' + dense.firstDiff.input
        + ' (contract ' + dense.firstDiff.expected + ', got ' + dense.firstDiff.got + ')'); bad++;
    }
    if (cell.render === 'SILENT') {
      console.log('  ' + cell.shape.padEnd(11) + ' req ' + p.req.condition.padEnd(9)
        + ' pres ' + p.preserved.condition.padEnd(8) + ' overlap ' + p.ov.result
        + ' winner ' + p.prec.winner + '   probes ' + probes.length);
    }
  }
  console.log(bad ? '  CONTROLS FAILED: ' + bad
    : '  controls ok: every shape poses a real precedence question, both renderings plan identically,'
      + ' two legal realizations pass the contract probes and three mutants die');
  return bad === 0;
}

if (process.argv.includes('--prompts')) {
  for (const c of CELLS) { console.log('===== ' + c.shape + ' / ' + c.render + ' ====='); console.log(promptFor(plan(c.shape, c.render))); console.log(''); }
  process.exit(0);
}
if (!control()) process.exit(1);
if (CONTROL_ONLY) process.exit(0);

async function generate(prompt, model) {
  const r = await fetch(BASE.replace(/\/$/, '') + '/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false,
      options: { temperature: TEMPERATURE, num_predict: 160 } }),
  });
  if (!r.ok) throw new Error('generate ' + r.status);
  return (await r.json()).response || '';
}

const tags = await (await fetch(BASE.replace(/\/$/, '') + '/api/tags')).json();
const served = (tags.models || []).map((m) => m.name);
for (const m of MODELS) if (!served.includes(m)) { console.log('  RULE 3 FAILED: ' + m); process.exit(1); }
console.log('  RULE 3 ok: ' + MODELS.join(', '));
console.log('  ' + CELLS.length + ' cells x ' + MODELS.length + ' models   samples ' + SAMPLES);
console.log('');

const results = { models: MODELS, samples: SAMPLES, temperature: TEMPERATURE, cells: {} };
for (const MODEL of MODELS) {
  for (const cell of CELLS) {
    const p = plan(cell.shape, cell.render);
    const probes = probesFor(p);
    const inputs = probes.map((x) => x.input);
    const prompt = promptFor(p);
    const rows = [];
    const t0 = Date.now();
    for (let i = 0; i < SAMPLES; i++) {
      let raw = '';
      try { raw = await generate(prompt, MODEL); } catch (e) { rows.push({ error: String(e.message) }); continue; }
      const cond = conditionOf(raw);
      const a = accept(raw, p);
      if (!a.ok) { rows.push({ authorized: false, reason: a.reason, condition: cond, raw: raw.slice(0, 140) }); continue; }
      const res = runProgram(build(a.code, p), inputs);
      const chk = res ? checkProbes(probes, (v) => res.get(v)) : { passed: false, failures: [{ why: 'did not load' }] };
      // The failure CLASS, read off the contract probes rather than judged. A failed probe INSIDE the
      // requested domain means the output declined an input the contract obliges it to claim, which is
      // exactly the shape an invented bound leaves behind.
      const inside = chk.failures.filter((f) => containsPoint(p.req.domain, f.input));
      rows.push({ authorized: true, condition: cond, code: a.code.replace(/\s+/g, ' ').trim(),
        verified: chk.passed,
        too_narrow: !chk.passed && inside.length > 0,
        too_wide: !chk.passed && inside.length === 0,
        failed_probes: chk.failures.slice(0, 3) });
    }
    const n = (f) => rows.filter(f).length;
    const authorized = n((r) => r.authorized === true);
    const verified = n((r) => r.verified);
    const key = MODEL + '|' + cell.shape + '/' + cell.render;
    results.cells[key] = { of: SAMPLES, model: MODEL, ...cell, probes: probes.length,
      seconds: (Date.now() - t0) / 1000, authorized, verified,
      repeated_fixed: n((r) => r.reason === 'repeated a fixed line'),
      whole_function: n((r) => r.reason === 'returned a function'),
      too_narrow: n((r) => r.too_narrow), too_wide: n((r) => r.too_wide),
      realizations: new Set(rows.filter((r) => r.condition).map((r) => r.condition)).size,
      commit_integrity: authorized ? verified / authorized : null, rows };
    const s = results.cells[key];
    console.log('  ' + MODEL.padEnd(21) + cell.shape.padEnd(11) + cell.render.padEnd(11)
      + ' authorized ' + String(authorized).padStart(2) + '/' + SAMPLES
      + '   verified ' + String(verified).padStart(2)
      + '   PRIMARY too-narrow ' + String(s.too_narrow).padStart(2)
      + '   too-wide ' + s.too_wide
      + '   P(c|auth) ' + (s.commit_integrity === null ? ' n/a' : s.commit_integrity.toFixed(2)));
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
for (const m of MODELS) {
  const ks = Object.keys(results.cells).filter((k) => k.startsWith(m + '|'));
  const S = (f) => ks.reduce((a, k) => a + f(results.cells[k]), 0);
  const nTot = SAMPLES * CELLS.length;
  console.log('  ' + m.padEnd(21) + ' proposal-yield ' + (S((x) => x.authorized) / nTot).toFixed(3)
    + '   authorization-precision ' + (S((x) => x.verified) / S((x) => x.authorized)).toFixed(3)
    + '   verification-rate ' + (S((x) => x.verified) / nTot).toFixed(3));
  for (const render of Object.keys(RENDERINGS)) {
    const rk = ks.filter((k) => k.endsWith('/' + render));
    const N = SAMPLES * Object.keys(SHAPES).length;
    console.log('      ' + render.padEnd(9)
      + ' PRIMARY too-narrow ' + String(rk.reduce((a, k) => a + results.cells[k].too_narrow, 0)).padStart(2) + '/' + N
      + '   too-wide ' + rk.reduce((a, k) => a + results.cells[k].too_wide, 0)
      + '   authorized ' + rk.reduce((a, k) => a + results.cells[k].authorized, 0)
      + '   verified ' + rk.reduce((a, k) => a + results.cells[k].verified, 0));
  }
}
console.log('');
console.log('  written -> ' + OUT);
