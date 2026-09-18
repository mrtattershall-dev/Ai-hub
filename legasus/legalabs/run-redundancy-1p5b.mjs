// THE REDUNDANT SENTENCE — does adding wording that carries no new information change what the model
// emits?
//
// WHERE THIS COMES FROM, AND WHY IT IS NOT YET A FINDING. Visibility-ladder revisions 1 and 2 differ by
// exactly one sentence: a rendered parameter-name fact, redundant at every arm whose window already
// shows the source. On the three shared arms, refusals for REPEATING A FIXED LINE went 6/60 to 23/60.
// That comparison CROSSES RUNS, so it is hypothesis-generating and nothing more. This is the controlled
// version: one window, one prompt, one sentence varied, everything else byte-identical.
//
// THE PRIMARY ENDPOINT IS NOT THE PASS RATE. It is the specific failure mode observed:
//
//     does redundant obligation wording increase reproduction of fixed surrounding code?
//
// measured as the repeated-a-fixed-line refusal rate. Overall verified rate is secondary, because a
// wording change that leaves the pass rate alone while doubling one failure mode is exactly the kind of
// effect a pass rate cannot see - the same reason this project now reports two quantities instead of one.
//
// THREE ARMS, BECAUSE TWO CANNOT SEPARATE "REDUNDANCY" FROM "THIS PARTICULAR SENTENCE":
//
//   OFF       no extra sentence                     revision 1's condition
//   FACT      names the parameter                   revision 2's condition; redundant where the
//                                                   window already shows the def line
//   NEUTRAL   an equally inert program fact that    controls for "one more sentence of any kind"
//             carries zero planning content
//
// If FACT and NEUTRAL move together against OFF, the effect is sentence COUNT. If FACT moves and
// NEUTRAL does not, it is something about obligation-shaped wording specifically.
//
// W0 IS EXCLUDED BY DESIGN. Without a visible window there are no fixed lines to repeat, so the primary
// endpoint is undefined there, and OFF would fail the sufficiency control besides.
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
const SAMPLES = Number(process.argv[3] || 20);
const OUT = process.argv[4] || './RESULT.redundancy.json';
const TEMPERATURE = 0.6;
const ARMS = (process.argv[5] || 'OFF,FACT,NEUTRAL').split(',');
const WINDOWS = ['W1', 'FULL'];
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

const PARAM = (SRC_LINES[0].match(/def\s+\w+\(\s*(\w+)\s*\)/) || [])[1];
if (!PARAM) throw new Error('parameter name could not be derived from the source - refusing to render');

// Both sentences are TRUE statements about the program, of comparable length and identical grammatical
// shape. Only one of them names something the model's output must contain.
const SENTENCE = {
  OFF: null,
  FACT: 'The function takes one parameter, named ' + PARAM + '.',
  NEUTRAL: 'The function is defined at the top level of its module.',
};

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
  return { text: parts.join(NL), visible: above.length + below.length,
    fixedShown: [...above, ...below].map((l) => l.trim()) };
}

// Every byte is identical across arms except the one sentence and the blank line carrying it.
function promptFor(arm, win, c, p) {
  const extra = SENTENCE[arm] ? [SENTENCE[arm], ''] : [];
  return L('Here is part of a Python function. Every line shown is FIXED: you may not change, repeat',
    'or remove any of it.',
    '',
    windowFor(win, p).text,
    '',
    ...extra,
    'A new behaviour is requested:',
    '    ' + c.delta,
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

function evaluate(program, expectedContested) {
  const ws = mkdtempSync(join(tmpdir(), 'red-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...Object.entries(PROBES).map(([k, v]) => 'print("' + k + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000 });
    const g = (k) => ((out.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1] || '').trim();
    const r = { loaded: true };
    for (const k of Object.keys(PROBES)) r[k] = g(k);
    r.delta_made = r.delta === 'small';
    r.no_op = !r.delta_made;
    r.preservation_broken = Object.entries(PRESERVED).some(([k, want]) => r[k] !== want);
    r.vocabulary_violation = Object.keys(PROBES).some((k) => !VOCAB.includes(r[k]));
    r.semantic_error = r.contested !== expectedContested;
    r.boundary_error = r.boundary !== 'positive';
    r.verified = r.delta_made && !r.preservation_broken && !r.semantic_error && !r.boundary_error;
    return r;
  } catch (e) { return { loaded: false, verified: false, load_error: String(e.message).slice(0, 60) }; }
}

const PERFECT = L('if n < 10:', '    return "small"');
const WRONG = 'if n > 10: return "small"';
const OFF_BY_ONE = 'if n <= 10: return "small"';

function control() {
  let bad = 0;
  for (const arm of ARMS) {
    for (const win of WINDOWS) {
      for (const [id, c] of Object.entries(CASES)) {
        const p = plan(c);
        const prompt = promptFor(arm, win, c, p);
        const tag = arm + '/' + win + '/' + id;
        const scanned = prompt.split(NL).filter((l) => l !== MARKER && l !== ELISION).join(NL);
        const hits = leakageScan(scanned);
        if (hits.length) { console.log('  LEAKAGE ' + tag + ': ' + hits.join('; ')); bad++; }

        const suf = promptSufficiency(prompt, PERFECT);
        if (!suf.sufficient) { console.log('  SUFFICIENCY FAIL ' + tag + ': missing ' + suf.missing.join(', ')); bad++; }

        // The primary endpoint must be REACHABLE: if no fixed line is visible, "repeated a fixed line"
        // can never fire and the arm would report a clean zero for the wrong reason.
        if (!windowFor(win, p).fixedShown.length) { console.log('  ENDPOINT UNREACHABLE ' + tag); bad++; }

        const a = accept(PERFECT);
        if (!a.ok) { console.log('  CONTROL FAIL ' + tag + ' perfect rejected: ' + a.reason); bad++; continue; }
        if (!evaluate(build(a.code, p), c.contested).verified) {
          console.log('  CONTROL FAIL ' + tag + ' perfect not verified'); bad++;
        }
        for (const [label, src] of [['inversion', WRONG], ['off-by-one', OFF_BY_ONE]]) {
          const w = accept(src);
          if (!w.ok) { console.log('  CONTROL FAIL ' + tag + ' ' + label + ' REFUSED, not scored'); bad++; continue; }
          if (evaluate(build(w.code, p), c.contested).verified) {
            console.log('  CONTROL FAIL ' + tag + ' ' + label + ' VERIFIED'); bad++;
          }
        }
      }
    }
  }
  // The arms must differ by EXACTLY the sentence. Anything else and the contrast is not what it says.
  for (const win of WINDOWS) {
    const p = plan(CASES.A);
    const base = promptFor('OFF', win, CASES.A, p).split(NL);
    for (const arm of ARMS.filter((a) => a !== 'OFF')) {
      const other = promptFor(arm, win, CASES.A, p).split(NL);
      const diff = other.filter((l) => !base.includes(l));
      if (diff.length !== 1 || diff[0] !== SENTENCE[arm]) {
        console.log('  ARM DIFF FAIL ' + arm + '/' + win + ': ' + JSON.stringify(diff)); bad++;
      }
      if (other.length !== base.length + 2) {
        console.log('  ARM LENGTH FAIL ' + arm + '/' + win); bad++;
      }
    }
  }
  console.log(bad ? '  CONTROLS FAILED: ' + bad
    : '  controls ok: sufficiency holds, the endpoint is reachable, perfect verifies, inversion and'
      + ' off-by-one are accepted and still fail, and the arms differ by exactly one sentence');
  return bad === 0;
}

if (process.argv.includes('--prompts')) {
  for (const arm of ARMS) for (const win of WINDOWS) {
    console.log('===== ' + arm + ' / ' + win + ' / case A =====');
    console.log(promptFor(arm, win, CASES.A, plan(CASES.A))); console.log('');
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
console.log('  arms ' + ARMS.join(', ') + '   windows ' + WINDOWS.join(', ')
  + '   samples ' + SAMPLES + '   temperature ' + TEMPERATURE);
console.log('');

const results = { model: MODEL, temperature: TEMPERATURE, samples: SAMPLES, sentence: SENTENCE, cells: {} };
for (const win of WINDOWS) {
  for (const arm of ARMS) {
    for (const [id, c] of Object.entries(CASES)) {
      const p = plan(c);
      const prompt = promptFor(arm, win, c, p);
      const rows = [];
      for (let i = 0; i < SAMPLES; i++) {
        let raw = '';
        try { raw = await generate(prompt); } catch (e) { rows.push({ error: String(e.message) }); continue; }
        const a = accept(raw);
        if (!a.ok) { rows.push({ authorized: false, reason: a.reason, raw: raw.slice(0, 140) }); continue; }
        rows.push({ authorized: true, code: a.code.replace(/\s+/g, ' ').trim(),
          ...evaluate(build(a.code, p), c.contested) });
      }
      const n = (f) => rows.filter(f).length;
      const authorized = n((r) => r.authorized === true);
      const verified = n((r) => r.verified);
      const s = { of: SAMPLES, verified, authorized,
        repeated_fixed: n((r) => r.reason === 'repeated a fixed line'),
        whole_function: n((r) => r.reason === 'returned a function'),
        shape_other: n((r) => r.reason === 'not exactly one guard and one return'),
        semantic_error: n((r) => r.semantic_error), boundary_error: n((r) => r.boundary_error),
        preservation_broken: n((r) => r.preservation_broken),
        commit_integrity: authorized ? verified / authorized : null,
        variance: new Set(rows.map((r) => r.code || 'X')).size, rows };
      results.cells[win + '/' + arm + '/' + id] = s;
      console.log('  ' + win.padEnd(4) + ' ' + arm.padEnd(7) + ' case ' + id
        + '   PRIMARY repeated-fixed ' + String(s.repeated_fixed).padStart(2) + '/' + SAMPLES
        + '   verified ' + String(s.verified).padStart(2) + '/' + SAMPLES
        + '   whole-fn ' + s.whole_function + '   other-shape ' + s.shape_other
        + '   P(correct|committed) ' + (s.commit_integrity === null ? ' n/a' : s.commit_integrity.toFixed(2)));
    }
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
for (const win of WINDOWS) {
  for (const arm of ARMS) {
    const a = results.cells[win + '/' + arm + '/A'];
    const b = results.cells[win + '/' + arm + '/B'];
    console.log('  POOLED ' + win.padEnd(4) + ' ' + arm.padEnd(7)
      + ' repeated-fixed ' + String(a.repeated_fixed + b.repeated_fixed).padStart(2) + '/' + (SAMPLES * 2)
      + '   verified ' + String(a.verified + b.verified).padStart(2) + '/' + (SAMPLES * 2));
  }
}
console.log('');
console.log('  written -> ' + OUT);
