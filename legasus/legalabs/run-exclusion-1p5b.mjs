// DOES NAMING THE EXCLUDED VALUE MAKE THE MODEL WRITE AN EXCLUSION PREDICATE?
//
// Window 9 killed the "other"-ellipsis hypothesis and left a weak seed behind: all four `n > 0`
// conditions came from the arm whose delta said "except zero", and `RELATIONAL` made the model write
// `n < 10 and n != 0` in 46 of 80 samples. Both observations involve ZERO, and zero is exactly the
// value a language model has the most special-cased associations with.
//
// SO THE EXCLUDED VALUE IS VARIED. Four tasks, each with a different threshold and a different
// preserved value, so a learned association with zero cannot masquerade as a general effect:
//
//     threshold 10, preserve  0        threshold 10, preserve  3
//     threshold 20, preserve  5        threshold  0, preserve -2
//
// and within each task, three renderings of the SAME residual behaviour:
//
//     IMPLICIT          For the remaining values below T, return "small".
//     NAMED_EXCLUSION   For values below T except P, return "small".
//     RELATIONAL        For values below T where n is not P, return "small".
//
// PRIMARY ENDPOINT IS A MECHANISM, NOT A PASS RATE: does the generated guard contain an exclusion
// predicate naming the preserved value? Excluding the WRONG value is a separate family, because
// "wrote an exclusion" and "wrote the right exclusion" are different claims.
//
// If `except 3` yields `n != 3`, `except 5` yields `n != 5` and `except -2` yields `n != -2` while the
// implicit form does not, the effect is general:
//
//     model-facing wording controls REALIZATION STRATEGY even when the deterministic plan and the
//     required behaviour are unchanged
//
// If only zero does it, that is a narrower and different finding, and this design can tell them apart.
//
// BOTH REALIZATIONS ARE CORRECT AND A CONTROL PROVES IT. `n < T` and `n < T and n != P`, placed after
// the preserved guard, both satisfy the contract. An endpoint that called the second one wrong would be
// scoring reference-form similarity instead of semantic correctness - the exact failure window 9
// exposed. So the control asserts BOTH verify, for every task, before the window opens.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { leakageScan } from '../legacore/assemble.mjs';
import { promptSufficiency } from './sufficiency.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const BASE = process.argv[2];
const MODEL = 'qwen2.5-coder:1.5b';
const SAMPLES = Number(process.argv[3] || 40);
const OUT = process.argv[4] || './RESULT.exclusion.json';
const TEMPERATURE = 0.6;
const CONTROL_ONLY = process.argv.includes('--control');

const MARKER = '    # >>> YOUR LINES GO HERE <<<';
const PARAM = 'n';

// One template, four instantiations. The preserved guard is the only thing that differs, so a
// difference between tasks is a difference in the VALUE, not in the program's shape.
const TASKS = {
  T10_0: { threshold: 10, preserved: 0, label: 'zero', deltaProbe: 5, otherProbe: 50 },
  T10_3: { threshold: 10, preserved: 3, label: 'three', deltaProbe: 7, otherProbe: 50 },
  T20_5: { threshold: 20, preserved: 5, label: 'five', deltaProbe: 12, otherProbe: 50 },
  T0_N2: { threshold: 0, preserved: -2, label: 'minus two', deltaProbe: -5, otherProbe: 50 },
};

const RENDERINGS = {
  IMPLICIT: (t) => 'For the remaining values below ' + t.threshold + ', return "small".',
  NAMED_EXCLUSION: (t) => 'For values below ' + t.threshold + ' except ' + t.preserved + ', return "small".',
  RELATIONAL: (t) => 'For values below ' + t.threshold + ' where ' + PARAM + ' is not '
    + t.preserved + ', return "small".',
};

function sourceFor(t) {
  return L(
    'def classify(n):',
    '    if n == ' + t.preserved + ':',
    '        return "' + t.label + '"',
    '    if n > 10000:',
    '        return "enormous"',
    '    if n > 1000:',
    '        return "huge"',
    '    if n > 100:',
    '        return "large"',
    '    return "other"',
  );
}

const PRESERVATION = (t) => 'Preserve the existing special handling of ' + t.label + '.';
const VOCAB = ['enormous', 'huge', 'large', 'other', 'small', 'zero', 'three', 'five', 'minus two'];

function plan(taskKey, renderKey) {
  const t = TASKS[taskKey];
  const src = sourceFor(t);
  const lines = src.split(NL);
  const existing = existingBehaviours(src, 'classify')
    .find((b) => b.condition === 'n == ' + t.preserved);
  const delta = RENDERINGS[renderKey](t);
  const req = requestedBehaviour(delta, PARAM, { soleParameter: true });
  const ov = overlap(existing.domain, req.domain);
  const prec = derivePrecedence({ preservation_text: PRESERVATION(t), delta_text: delta,
    existing: { condition: existing.condition, result: existing.result },
    requested: { condition: req.condition, result: req.result } }, ov);
  const before = prec.winner === 'requested';
  return { t, src, lines, existing, delta, req, prec, before,
    insertAfter: before ? existing.line - 1 : existing.line + 1,
    fixed: new Set(lines.map((l) => l.trim())) };
}

function promptFor(p) {
  const shown = L(...p.lines.slice(0, p.insertAfter + 1), MARKER, ...p.lines.slice(p.insertAfter + 1));
  return L('Here is a Python function. Every line shown is FIXED: you may not change, repeat',
    'or remove any of it.',
    '',
    shown,
    '',
    'A new behaviour is requested:',
    '    ' + p.delta,
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

function accept(text, p) {
  const body = normalize(text);
  const got = [];
  for (const raw of body) {
    if (/^\s*def\s/.test(raw)) return { ok: false, reason: 'returned a function' };
    if (p.fixed.has(raw.trim())) return { ok: false, reason: 'repeated a fixed line' };
    if (/^\s*if\s.*:\s*$/.test(raw) && got.length === 0) { got.push(raw.trim()); continue; }
    if (/^\s*return\s/.test(raw) && got.length === 1) { got.push(raw.trim()); break; }
  }
  if (got.length !== 2) return { ok: false, reason: 'not exactly one guard and one return' };
  return { ok: true, code: '    ' + got[0] + NL + '        ' + got[1] };
}

export function conditionOf(text) {
  for (const line of normalize(text)) {
    const m = line.match(/^\s*(?:el)?if\s+(.+?)\s*:\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

// THE PRIMARY MEASUREMENT. Does the guard exclude a value, and is it the preserved one?
export function exclusionFamily(cond, preserved) {
  if (!cond) return 'NONE';
  const c = cond.replace(/\s+/g, ' ').trim();
  const excluded = [...c.matchAll(/!=\s*(-?\d+)/g)].map((m) => Number(m[1]));
  for (const m of c.matchAll(/not\s*\(?\s*\w+\s*==\s*(-?\d+)/g)) excluded.push(Number(m[1]));
  if (!excluded.length) return 'NO_EXCLUSION';
  if (excluded.includes(preserved)) return 'EXCLUDES_PRESERVED';
  return 'EXCLUDES_OTHER_VALUE';
}

function build(code, p) {
  return L(...p.lines.slice(0, p.insertAfter + 1), ...code.split(NL),
    ...p.lines.slice(p.insertAfter + 1));
}

function evaluate(program, p) {
  const t = p.t;
  // NEIGHBOUR PROBES, added because the control caught their absence before the window opened.
  // `n < T and n != P+1` verified without them: it excludes the WRONG value, which is a real semantic
  // error, and no probe touched P+1 so nothing saw it. Same shape as the missing `n == 10` probe that
  // let `n <= 10` pass in window 7 - a probe set is only as good as the errors it can distinguish.
  const probes = { contested: t.preserved, delta: t.deltaProbe, boundary: t.threshold,
    neighbour_up: t.preserved + 1, neighbour_down: t.preserved - 1,
    other: t.otherProbe, big: 5000, huge2: 50000, mid: 200 };
  const ws = mkdtempSync(join(tmpdir(), 'exc-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...Object.entries(probes).map(([k, v]) => 'print("' + k + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const g = (k) => ((out.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || '').trim();
    const r = { loaded: true };
    for (const k of Object.keys(probes)) r[k] = g(k);
    r.delta_made = r.delta === 'small';
    r.preservation_broken = r.other !== 'other' || r.big !== 'huge' || r.huge2 !== 'enormous'
      || r.mid !== 'large';
    r.vocabulary_violation = Object.keys(probes).some((k) => !VOCAB.includes(r[k]));
    r.semantic_error = r.contested !== t.label;
    r.boundary_error = r.boundary !== 'other';
    // Both neighbours of the preserved value are below the threshold and are not the preserved value,
    // so the contract says both return "small". This is what catches an exclusion of the WRONG value.
    r.neighbour_error = r.neighbour_up !== 'small' || r.neighbour_down !== 'small';
    r.verified = r.delta_made && !r.preservation_broken && !r.semantic_error && !r.boundary_error
      && !r.neighbour_error;
    return r;
  } catch (e) { return { loaded: false, verified: false, load_error: String(e.message).slice(0, 60) }; }
}

const CELLS = [];
for (const task of Object.keys(TASKS)) for (const r of Object.keys(RENDERINGS)) CELLS.push({ task, render: r });

function control() {
  let bad = 0;
  for (const task of Object.keys(TASKS)) {
    const t = TASKS[task];
    const ps = Object.keys(RENDERINGS).map((r) => ({ r, p: plan(task, r) }));
    const ref = ps[0].p;
    for (const { r, p } of ps) {
      if (p.req.condition !== ref.req.condition || p.req.result !== ref.req.result
        || p.prec.winner !== ref.prec.winner || p.insertAfter !== ref.insertAfter) {
        console.log('  PLAN DIVERGENCE ' + task + '/' + r + ': ' + JSON.stringify({
          cond: p.req.condition, res: p.req.result, winner: p.prec.winner, at: p.insertAfter })); bad++;
      }
      const prompt = promptFor(p);
      const scanned = prompt.split(NL).filter((l) => l !== MARKER).join(NL);
      const hits = leakageScan(scanned);
      if (hits.length) { console.log('  LEAKAGE ' + task + '/' + r + ': ' + hits.join('; ')); bad++; }
      const PERFECT = L('if n < ' + t.threshold + ':', '    return "small"');
      if (!promptSufficiency(prompt, PERFECT).sufficient) { console.log('  SUFFICIENCY FAIL ' + task + '/' + r); bad++; }
    }

    // THE ANTI-ORACLE CONTROL. Both realizations must verify. An endpoint that rewarded one of them
    // would be scoring reference-form similarity, which window 9 showed is not semantic correctness.
    const p = ref;
    const both = [
      ['plain', L('if n < ' + t.threshold + ':', '    return "small"')],
      ['with exclusion', L('if n < ' + t.threshold + ' and n != ' + t.preserved + ':', '    return "small"')],
    ];
    for (const [label, frag] of both) {
      const a = accept(frag, p);
      if (!a.ok) { console.log('  ANTI-ORACLE FAIL ' + task + ' ' + label + ' rejected: ' + a.reason); bad++; continue; }
      const e = evaluate(build(a.code, p), p);
      if (!e.verified) { console.log('  ANTI-ORACLE FAIL ' + task + ' ' + label + ' not verified: ' + JSON.stringify(e)); bad++; }
    }
    // And wrong ones must be accepted and still fail, or the verifier is not watching.
    for (const [label, frag] of [
      ['inversion', 'if n > ' + t.threshold + ': return "small"'],
      ['off-by-one', 'if n <= ' + t.threshold + ': return "small"'],
      ['excludes the wrong value', 'if n < ' + t.threshold + ' and n != ' + (t.preserved + 1) + ': return "small"'],
    ]) {
      const w = accept(frag, p);
      if (!w.ok) { console.log('  CONTROL FAIL ' + task + ' ' + label + ' REFUSED'); bad++; continue; }
      if (evaluate(build(w.code, p), p).verified) {
        console.log('  CONTROL FAIL ' + task + ' ' + label + ' VERIFIED'); bad++;
      }
    }
  }
  const cls = [
    ['n < 10', 0, 'NO_EXCLUSION'], ['n < 10 and n != 0', 0, 'EXCLUDES_PRESERVED'],
    ['n < 10 and n != 3', 0, 'EXCLUDES_OTHER_VALUE'], ['n < 10 and n != 3', 3, 'EXCLUDES_PRESERVED'],
    ['n < 0 and n != -2', -2, 'EXCLUDES_PRESERVED'], ['n < 20 and not (n == 5)', 5, 'EXCLUDES_PRESERVED'],
    [null, 0, 'NONE'],
  ];
  for (const [c, pv, want] of cls) {
    const got = exclusionFamily(c, pv);
    if (got !== want) { console.log('  CLASSIFIER FAIL ' + c + ' (preserved ' + pv + ') -> ' + got + ', expected ' + want); bad++; }
  }
  console.log('  four tasks: ' + Object.entries(TASKS).map(([k, t]) => k + ' (below ' + t.threshold
    + ', preserve ' + t.preserved + ')').join('   '));
  console.log(bad ? '  CONTROLS FAILED: ' + bad
    : '  controls ok: identical plans per task, no leakage, sufficiency, BOTH realizations verify,'
      + ' three wrong fragments accepted-but-failing, classifier separates the three families');
  return bad === 0;
}

if (process.argv.includes('--prompts')) {
  for (const c of CELLS.filter((x) => x.task === 'T0_N2' || x.task === 'T10_3')) {
    console.log('===== ' + c.task + ' / ' + c.render + ' =====');
    console.log(promptFor(plan(c.task, c.render))); console.log('');
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

const results = { model: MODEL, temperature: TEMPERATURE, samples: SAMPLES, tasks: TASKS, cells: {} };
for (const cell of CELLS) {
  const p = plan(cell.task, cell.render);
  const prompt = promptFor(p);
  const rows = [];
  for (let i = 0; i < SAMPLES; i++) {
    let raw = '';
    try { raw = await generate(prompt); } catch (e) { rows.push({ error: String(e.message) }); continue; }
    const cond = conditionOf(raw);
    const fam = exclusionFamily(cond, p.t.preserved);
    const a = accept(raw, p);
    if (!a.ok) { rows.push({ authorized: false, reason: a.reason, condition: cond, family: fam, raw: raw.slice(0, 140) }); continue; }
    rows.push({ authorized: true, condition: cond, family: fam,
      code: a.code.replace(/\s+/g, ' ').trim(), ...evaluate(build(a.code, p), p) });
  }
  const n = (f) => rows.filter(f).length;
  const authorized = n((r) => r.authorized === true);
  const verified = n((r) => r.verified);
  const key = cell.task + '/' + cell.render;
  results.cells[key] = { of: SAMPLES, ...cell, preserved: p.t.preserved, threshold: p.t.threshold,
    excludes_preserved: n((r) => r.family === 'EXCLUDES_PRESERVED'),
    excludes_other: n((r) => r.family === 'EXCLUDES_OTHER_VALUE'),
    no_exclusion: n((r) => r.family === 'NO_EXCLUSION'),
    authorized, verified, repeated_fixed: n((r) => r.reason === 'repeated a fixed line'),
    commit_integrity: authorized ? verified / authorized : null, rows };
  const s = results.cells[key];
  console.log('  ' + cell.task.padEnd(6) + ' ' + cell.render.padEnd(16)
    + ' PRIMARY excludes-preserved ' + String(s.excludes_preserved).padStart(2) + '/' + SAMPLES
    + '   excludes-other ' + String(s.excludes_other).padStart(2)
    + '   no-exclusion ' + String(s.no_exclusion).padStart(2)
    + '   verified ' + String(s.verified).padStart(2)
    + '   P(c|auth) ' + (s.commit_integrity === null ? ' n/a' : s.commit_integrity.toFixed(2)));
}

writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
console.log('  PRIMARY - excludes-preserved by rendering, pooled over the four tasks, per '
  + (SAMPLES * 4) + ':');
for (const r of Object.keys(RENDERINGS)) {
  const keys = Object.keys(TASKS).map((t) => t + '/' + r);
  const ex = keys.reduce((a, k) => a + results.cells[k].excludes_preserved, 0);
  const ve = keys.reduce((a, k) => a + results.cells[k].verified, 0);
  console.log('     ' + r.padEnd(16) + ' excludes-preserved ' + String(ex).padStart(3)
    + '   verified ' + String(ve).padStart(3)
    + '   per task ' + keys.map((k) => results.cells[k].excludes_preserved).join('/'));
}
console.log('');
console.log('  written -> ' + OUT);
