// TWO PREREGISTERED ENDPOINTS IN ONE WINDOW.
//
// E1 - DOES THE WORD "OTHER" GET READ AS "THE REMAINING POSITIVE ONES"?
//
// Two of the three authorization leaks observed so far are the same fragment, `if n > 0: return
// "small"`, both in case A, whose delta reads "For OTHER values below 10, return small." The bound
// vanishes and a lower bound appears in its place. Three deltas that encode the SAME residual
// behaviour, differing only in how the exclusion is phrased:
//
//   OTHER       For other values below 10, return "small".
//   EXPLICIT    For values below 10 except zero, return "small".
//   RELATIONAL  For values less than 10 that are not zero, return "small".
//
// All three must produce an identical plan - same requested condition, same result, same precedence
// winner, same insertion point - or the comparison is not about wording. A control asserts it.
//
// PRIMARY: the rate of ZERO_LOWER conditions - `n > 0`, `n >= 0`, `n > -1` - where the bound named in
// the delta has vanished and a bound at the EXCLUDED SPECIAL CASE has taken its place. Classified from
// the emitted guard on every sample, authorized or not, so the denominator does not move with the
// refusal rate. `n > 10` is deliberately a different family (INVERTED_UPPER): it still uses the
// delta's own number, and conflating the two is the defect the classifier control caught before this
// window opened.
//
// E2 - THE INTERACTION, TESTED DIRECTLY AND PROSPECTIVELY THIS TIME.
//
// Windows 7 and 8 reported an interaction between window size and added wording on the strength of
// "significant at FULL, not significant at W1". THAT IS NOT A TEST OF AN INTERACTION, and a direct one
// on window 8's own cells returns p = 0.16 to 0.18 - the same "read a null too hard" error window 8
// had just corrected in window 7. Pooled over both windows it reaches p = 0.005 for FACT, but that is
// retrospective. Here it is a declared primary endpoint with its own test, `interaction.mjs`, whose
// negative control is large main effects and no interaction.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { leakageScan } from '../legacore/assemble.mjs';
import { promptSufficiency } from './sufficiency.mjs';
import { interactionTest } from './interaction.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const BASE = process.argv[2];
const MODEL = 'qwen2.5-coder:1.5b';
const SAMPLES = Number(process.argv[3] || 40);
const OUT = process.argv[4] || './RESULT.deltawording.json';
const TEMPERATURE = 0.6;
const CONTROL_ONLY = process.argv.includes('--control');

const MARKER = '    # >>> YOUR LINES GO HERE <<<';
const ELISION = '    ...';

const SRC = L(
  'def classify(n):',
  '    if n < -1000:',
  '        return "very negative"',
  '    if n < -100:',
  '        return "quite negative"',
  '    if n < 0:',
  '        return "negative"',
  '    if n == 0:',
  '        return "zero"',
  '    if n > 10000:',
  '        return "enormous"',
  '    if n > 1000:',
  '        return "huge"',
  '    if n > 100:',
  '        return "large"',
  '    return "positive"',
);
const SRC_LINES = SRC.split(NL);
const FIXED = new Set(SRC_LINES.map((l) => l.trim()));
const DEF = SRC_LINES[0].match(/def\s+(\w+)\(\s*(\w+)\s*\)/);
if (!DEF) throw new Error('could not derive the function and parameter names - refusing to render');
const FUNC = DEF[1];
const PARAM = DEF[2];

const DELTAS = {
  OTHER: 'For other values below 10, return "small".',
  EXPLICIT: 'For values below 10 except zero, return "small".',
  RELATIONAL: 'For values less than 10 that are not zero, return "small".',
};
const SENTENCE = {
  NONE: null,
  NEUTRAL: 'The function is defined at the top level of its module.',
  FACT: 'The function takes one parameter, named ' + PARAM + '.',
};
const PRESERVATION = 'Preserve the existing special handling of zero.';
const CONTESTED = 'zero';                       // case A throughout: the preserved behaviour wins

// The ten cells. Sentence arms all carry the OTHER delta; delta arms all carry no sentence, so the
// OTHER/NONE cells are shared between the two experiments rather than run twice.
const CELLS = [];
for (const win of ['W1', 'FULL']) {
  for (const s of ['NONE', 'NEUTRAL', 'FACT']) CELLS.push({ win, sentence: s, delta: 'OTHER' });
  for (const d of ['EXPLICIT', 'RELATIONAL']) CELLS.push({ win, sentence: 'NONE', delta: d });
}

const zero = existingBehaviours(SRC, FUNC).find((b) => b.condition === 'n == 0');
const ZERO_LINE = zero.line;

function plan(deltaKey) {
  const delta = DELTAS[deltaKey];
  const req = requestedBehaviour(delta, PARAM, { soleParameter: true });
  const ov = overlap(zero.domain, req.domain);
  const prec = derivePrecedence({ preservation_text: PRESERVATION, delta_text: delta,
    existing: { condition: zero.condition, result: zero.result },
    requested: { condition: req.condition, result: req.result } }, ov);
  const before = prec.winner === 'requested';
  return { req, prec, before, insertAfter: before ? ZERO_LINE - 1 : ZERO_LINE + 1 };
}

const UNITS = (() => {
  const u = [];
  for (let i = 0; i < SRC_LINES.length; i++) {
    if (/^\s*(?:def|if|elif|else)\b.*:\s*$/.test(SRC_LINES[i]) && /^\s*return\b/.test(SRC_LINES[i + 1] || '')) {
      u.push([i, i + 1]); i++;
    } else u.push([i, i]);
  }
  return u;
})();
const unitAfter = (line) => UNITS.findIndex(([, hi]) => hi === line);
const RADIUS = { W1: 1, FULL: Infinity };

function windowFor(win, p) {
  const r = RADIUS[win];
  const k = unitAfter(p.insertAfter);
  const lo = Math.max(0, k + 1 - r);
  const hi = Math.min(UNITS.length - 1, k + r);
  const above = UNITS.slice(lo, k + 1).flatMap(([a, b]) => SRC_LINES.slice(a, b + 1));
  const below = UNITS.slice(k + 1, hi + 1).flatMap(([a, b]) => SRC_LINES.slice(a, b + 1));
  const parts = [];
  if (lo > 0) parts.push(ELISION);
  parts.push(...above, MARKER, ...below);
  if (hi < UNITS.length - 1) parts.push(ELISION);
  return { text: parts.join(NL), fixedShown: [...above, ...below] };
}

function promptFor(cell, p) {
  const extra = SENTENCE[cell.sentence] ? [SENTENCE[cell.sentence], ''] : [];
  return L('Here is part of a Python function. Every line shown is FIXED: you may not change, repeat',
    'or remove any of it.',
    '',
    windowFor(cell.win, p).text,
    '',
    ...extra,
    'A new behaviour is requested:',
    '    ' + DELTAS[cell.delta],
    '',
    'Write ONLY the lines that take the place of the marker. Keep the same indentation.',
    'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.');
}

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

function accept(text) {
  const body = normalize(text);
  const got = [];
  for (const raw of body) {
    if (/^\s*def\s/.test(raw)) return { ok: false, reason: 'returned a function' };
    if (FIXED.has(raw.trim())) return { ok: false, reason: 'repeated a fixed line' };
    if (/^\s*if\s.*:\s*$/.test(raw) && got.length === 0) { got.push(raw.trim()); continue; }
    if (/^\s*return\s/.test(raw) && got.length === 1) { got.push(raw.trim()); break; }
  }
  if (got.length !== 2) return { ok: false, reason: 'not exactly one guard and one return' };
  return { ok: true, code: '    ' + got[0] + NL + '        ' + got[1] };
}

// The emitted guard, taken from EVERY sample including refused ones, so the primary endpoint's
// denominator does not move with the refusal rate.
export function conditionOf(text) {
  for (const line of normalize(text)) {
    const m = line.match(/^\s*(?:el)?if\s+(.+?)\s*:\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

// Families, declared before the run. The primary endpoint is ZERO_LOWER - the `n > 0` shape, where the
// bound named in the delta has vanished and a bound at ZERO has taken its place.
//
// The first draft of this classifier put `n > 10` in that family, because it tested "has a > and no <"
// and an inverted upper bound satisfies both. The classifier control caught it before the window
// opened. The distinction that matters is not the operator: it is WHICH THRESHOLD the model compared
// against. `n > 10` still uses the delta's own number; `n > 0` has replaced it with the excluded
// special case.
export function conditionFamily(cond) {
  if (!cond) return 'none';
  const c = cond.replace(/\s+/g, ' ').trim();
  const comparisons = [...c.matchAll(/(<=|>=|<|>)\s*(-?\d+)/g)].map((m) => ({ op: m[1], val: Number(m[2]) }));
  if (/^n < 10$/.test(c)) return 'CORRECT';
  if (/^n <= 10$/.test(c)) return 'OFF_BY_ONE';
  if (comparisons.length === 1) {
    const { op, val } = comparisons[0];
    const up = op === '<' || op === '<=';
    if (!up && (val === 0 || val === -1)) return 'ZERO_LOWER';
    if (!up && val === 10) return 'INVERTED_UPPER';
    return up ? 'OTHER_UPPER' : 'OTHER_LOWER';
  }
  if (comparisons.length > 1) return 'BOUNDED_COMPOUND';
  return 'UNCLASSIFIED';
}

function build(code, p) {
  return L(...SRC_LINES.slice(0, p.insertAfter + 1), ...code.split(NL),
    ...SRC_LINES.slice(p.insertAfter + 1));
}

const VOCAB = ['very negative', 'quite negative', 'negative', 'zero', 'positive', 'small',
  'enormous', 'huge', 'large'];
const PROBES = { contested: 0, delta: 5, boundary: 10, neg: -3, plain: 50,
  deepneg: -500, big: 5000, mid: 200 };
const PRESERVED = { neg: 'negative', plain: 'positive', deepneg: 'quite negative',
  big: 'huge', mid: 'large' };

function evaluate(program) {
  const ws = mkdtempSync(join(tmpdir(), 'dw-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...Object.entries(PROBES).map(([k, v]) => 'print("' + k + '=" + str(impl.' + FUNC + '(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const g = (k) => ((out.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || '').trim();
    const r = { loaded: true };
    for (const k of Object.keys(PROBES)) r[k] = g(k);
    r.delta_made = r.delta === 'small';
    r.preservation_broken = Object.entries(PRESERVED).some(([k, want]) => r[k] !== want);
    r.vocabulary_violation = Object.keys(PROBES).some((k) => !VOCAB.includes(r[k]));
    r.semantic_error = r.contested !== CONTESTED;
    r.boundary_error = r.boundary !== 'positive';
    r.verified = r.delta_made && !r.preservation_broken && !r.semantic_error && !r.boundary_error;
    return r;
  } catch (e) { return { loaded: false, verified: false, load_error: String(e.message).slice(0, 60) }; }
}

const PERFECT = L('if ' + PARAM + ' < 10:', '    return "small"');
const WRONG = 'if ' + PARAM + ' > 10: return "small"';
const OFF_BY_ONE = 'if ' + PARAM + ' <= 10: return "small"';
const LOWER_ONLY = 'if ' + PARAM + ' > 0: return "small"';

function control() {
  let bad = 0;
  // THE LOAD-BEARING CONTROL FOR E1: the three deltas must produce the SAME plan, or this experiment
  // is comparing placements rather than wordings.
  const ps = Object.keys(DELTAS).map((d) => ({ d, p: plan(d) }));
  const ref = ps[0].p;
  for (const { d, p } of ps) {
    if (p.req.condition !== ref.req.condition || p.req.result !== ref.req.result
      || p.prec.winner !== ref.prec.winner || p.insertAfter !== ref.insertAfter) {
      console.log('  PLAN DIVERGENCE ' + d + ': ' + JSON.stringify({ cond: p.req.condition,
        res: p.req.result, winner: p.prec.winner, at: p.insertAfter })); bad++;
    }
  }
  console.log('  all three deltas plan identically: condition ' + ref.req.condition
    + ', result ' + ref.req.result + ', winner ' + ref.prec.winner + ', insert after line ' + ref.insertAfter);

  for (const cell of CELLS) {
    const p = plan(cell.delta);
    const prompt = promptFor(cell, p);
    const tag = cell.win + '/' + cell.sentence + '/' + cell.delta;
    const scanned = prompt.split(NL).filter((l) => l !== MARKER && l !== ELISION).join(NL);
    const hits = leakageScan(scanned);
    if (hits.length) { console.log('  LEAKAGE ' + tag + ': ' + hits.join('; ')); bad++; }
    if (!promptSufficiency(prompt, PERFECT).sufficient) { console.log('  SUFFICIENCY FAIL ' + tag); bad++; }
    if (!windowFor(cell.win, p).fixedShown.length) { console.log('  ENDPOINT UNREACHABLE ' + tag); bad++; }
    const a = accept(PERFECT);
    if (!a.ok || !evaluate(build(a.code, p)).verified) { console.log('  CONTROL FAIL ' + tag + ' perfect'); bad++; }
    for (const [label, src] of [['inversion', WRONG], ['off-by-one', OFF_BY_ONE], ['lower-only', LOWER_ONLY]]) {
      const w = accept(src);
      if (!w.ok) { console.log('  CONTROL FAIL ' + tag + ' ' + label + ' REFUSED'); bad++; continue; }
      if (evaluate(build(w.code, p)).verified) { console.log('  CONTROL FAIL ' + tag + ' ' + label + ' VERIFIED'); bad++; }
    }
  }
  // The classifier must separate the families it is about to be believed on.
  const expect = { 'n < 10': 'CORRECT', 'n > 0': 'ZERO_LOWER', 'n >= 0': 'ZERO_LOWER',
    'n > -1': 'ZERO_LOWER', 'n > 10': 'INVERTED_UPPER', 'n >= 10': 'INVERTED_UPPER',
    'n <= 10': 'OFF_BY_ONE', 'n < 100': 'OTHER_UPPER', 'n > 100': 'OTHER_LOWER',
    'n > 0 and n < 10': 'BOUNDED_COMPOUND', 'n != 0 and n < 10': 'OTHER_UPPER' };
  for (const [c, want] of Object.entries(expect)) {
    const got = conditionFamily(c);
    if (got !== want) { console.log('  CLASSIFIER FAIL ' + c + ' -> ' + got + ', expected ' + want); bad++; }
  }
  if (conditionOf('if n > 0: return "small"') !== 'n > 0') { console.log('  EXTRACTOR FAIL on a one-line if'); bad++; }
  if (conditionOf('sorry, I cannot') !== null) { console.log('  EXTRACTOR FAIL on prose'); bad++; }

  console.log(bad ? '  CONTROLS FAILED: ' + bad
    : '  controls ok: identical plans, sufficiency, reachable endpoint, perfect verifies, three wrong'
      + ' fragments accepted-but-failing, classifier and extractor separate the declared families');
  return bad === 0;
}

if (process.argv.includes('--prompts')) {
  for (const cell of CELLS) {
    console.log('===== ' + cell.win + ' / ' + cell.sentence + ' / ' + cell.delta + ' =====');
    console.log(promptFor(cell, plan(cell.delta))); console.log('');
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
if (!(tags.models || []).map((m) => m.name).includes(MODEL)) { console.log('  RULE 3 FAILED'); process.exit(1); }
console.log('  RULE 3 ok: endpoint names ' + MODEL);
console.log('  ' + CELLS.length + ' cells   samples ' + SAMPLES + '   temperature ' + TEMPERATURE);
console.log('');

const results = { model: MODEL, temperature: TEMPERATURE, samples: SAMPLES,
  deltas: DELTAS, sentences: SENTENCE, cells: {} };
for (const cell of CELLS) {
  const p = plan(cell.delta);
  const prompt = promptFor(cell, p);
  const key = cell.win + '/' + cell.sentence + '/' + cell.delta;
  const rows = [];
  for (let i = 0; i < SAMPLES; i++) {
    let raw = '';
    try { raw = await generate(prompt); } catch (e) { rows.push({ error: String(e.message) }); continue; }
    const cond = conditionOf(raw);
    const fam = conditionFamily(cond);
    const a = accept(raw);
    if (!a.ok) { rows.push({ authorized: false, reason: a.reason, condition: cond, family: fam, raw: raw.slice(0, 140) }); continue; }
    rows.push({ authorized: true, condition: cond, family: fam,
      code: a.code.replace(/\s+/g, ' ').trim(), ...evaluate(build(a.code, p)) });
  }
  const n = (f) => rows.filter(f).length;
  const authorized = n((r) => r.authorized === true);
  const verified = n((r) => r.verified);
  results.cells[key] = { of: SAMPLES, ...cell, verified, authorized,
    zero_lower: n((r) => r.family === 'ZERO_LOWER'),
    inverted_upper: n((r) => r.family === 'INVERTED_UPPER'),
    correct_condition: n((r) => r.family === 'CORRECT'),
    families: rows.reduce((m, r) => { m[r.family || 'error'] = (m[r.family || 'error'] || 0) + 1; return m; }, {}),
    repeated_fixed: n((r) => r.reason === 'repeated a fixed line'),
    whole_function: n((r) => r.reason === 'returned a function'),
    commit_integrity: authorized ? verified / authorized : null, rows };
  const s = results.cells[key];
  console.log('  ' + cell.win.padEnd(4) + ' ' + cell.sentence.padEnd(7) + ' ' + cell.delta.padEnd(10)
    + '  PRIMARY zero-lower ' + String(s.zero_lower).padStart(2) + '/' + SAMPLES
    + '   correct-cond ' + String(s.correct_condition).padStart(2)
    + '   verified ' + String(s.verified).padStart(2)
    + '   repeated-fixed ' + String(s.repeated_fixed).padStart(2)
    + '   P(c|auth) ' + (s.commit_integrity === null ? ' n/a' : s.commit_integrity.toFixed(2)));
}

const c = (k) => results.cells[k];
const sum = (keys, f) => keys.reduce((t, k) => t + f(c(k)), 0);
console.log('');
console.log('  E1 - ZERO_LOWER by delta wording, pooled over windows, per ' + (SAMPLES * 2) + ':');
for (const d of ['OTHER', 'EXPLICIT', 'RELATIONAL']) {
  const keys = ['W1/NONE/' + d, 'FULL/NONE/' + d];
  console.log('     ' + d.padEnd(11) + ' zero-lower ' + String(sum(keys, (x) => x.zero_lower)).padStart(3)
    + '    correct ' + String(sum(keys, (x) => x.correct_condition)).padStart(3)
    + '    verified ' + String(sum(keys, (x) => x.verified)).padStart(3));
}
console.log('');
console.log('  E2 - window x sentence interaction on repeated-a-fixed-line, tested directly:');
for (const arm of ['NEUTRAL', 'FACT']) {
  const r = interactionTest({
    a00: c('W1/NONE/OTHER').repeated_fixed, n00: SAMPLES,
    a01: c('W1/' + arm + '/OTHER').repeated_fixed, n01: SAMPLES,
    a10: c('FULL/NONE/OTHER').repeated_fixed, n10: SAMPLES,
    a11: c('FULL/' + arm + '/OTHER').repeated_fixed, n11: SAMPLES });
  console.log('     NONE vs ' + arm.padEnd(8) + ' DiD ' + r.difference_in_differences.toFixed(3)
    + '   chi2(1) ' + r.statistic.toFixed(2) + '   p = ' + r.p.toExponential(2));
  results.cells['INTERACTION/' + arm] = r;
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
console.log('  written -> ' + OUT);
