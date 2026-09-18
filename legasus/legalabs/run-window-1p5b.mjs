// THE VISIBILITY LADDER — how much program surface can the model be shown before reliable local
// execution collapses?
//
// Ladder 2 killed the capability claim: removing deletion authority left the verified rate exactly
// where it was (8/20 both arms). What it DID change was commit integrity - R3 committed twelve wrong
// programs, R3P committed none and refused twelve instead. And the refusals were not uniform: case B,
// with three fixed lines below the marker, refused 8/10 and FOUR of those returned the whole function,
// against 4 refusals in case A with one line below.
//
// TWO MECHANISMS ARE BUNDLED IN THAT OBSERVATION AND THIS LADDER DOES NOT SEPARATE THEM:
//
//   1  VISIBLE-SOURCE LOAD      more program state for the model to coordinate
//   2  COMPLETION AFFORDANCE    showing an entire function invites answering with an entire function
//
// So the preregistered claim is deliberately narrow: holding authority and semantics fixed, reducing
// the visible source surface is predicted to reduce refusals while preserving commit precision. If it
// does, source visibility matters. It will NOT yet say why. Splitting visibility from affordance is
// the experiment after this one.
//
// TWO MEASUREMENTS INSTEAD OF ONE. A pass rate cannot express what ladder 2 found, because 8 correct
// with 12 corruptions and 8 correct with 12 refusals score identically and are not remotely the same
// system. Every arm therefore reports both:
//
//   GENERATION CAPABILITY   P(correct attempt)      verified / samples
//   COMMIT INTEGRITY        P(correct | committed)  verified / authorized
//
// TWO REPAIRS CARRIED FORWARD FROM LADDER 2, PROSPECTIVELY - nothing historical is rescored:
//
//   n == 10 joins the probe set, so `if n <= 10` can no longer verify. Ladder 2's published 6/20 for
//   FMT_BOUND stands with its annotation; this family simply cannot repeat the hole.
//
//   `scope_violation` is superseded rather than repaired. What it actually measured is a result
//   outside the declared vocabulary, so it is named `vocabulary_violation`, and the case it could not
//   see - a preserved input returning another LEGAL value, 50 -> "zero" - is `preservation_broken`,
//   which is a separate column that always could see it.
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
const OUT = process.argv[4] || './RESULT.window.json';
const TEMPERATURE = 0.6;
const ARMS = (process.argv[5] || 'W0,W1,W2,FULL').split(',');
const CONTROL_ONLY = process.argv.includes('--control');

const MARKER = '    # >>> YOUR LINES GO HERE <<<';
const ELISION = '    ...';

// A LONGER FUNCTION THAN LADDER 2's, and the reason is recorded rather than glossed. A six-line
// function cannot carry a visibility ladder: at the case-B marker, a window of three lines either side
// IS the whole function, so two rungs would be the same condition wearing different names. Absolute
// rates here are therefore NOT comparable to ladder 2's 8/20 - the ladder is internally comparable,
// which is what a dose-response curve requires and all it requires.
const SRC = L(
  'def classify(n):',                 //  0
  '    if n < -1000:',                //  1
  '        return "very negative"',   //  2
  '    if n < -100:',                 //  3
  '        return "quite negative"',  //  4
  '    if n < 0:',                    //  5
  '        return "negative"',        //  6
  '    if n == 0:',                   //  7
  '        return "zero"',            //  8
  '    if n > 10000:',                //  9
  '        return "enormous"',        // 10
  '    if n > 1000:',                 // 11
  '        return "huge"',            // 12
  '    if n > 100:',                  // 13
  '        return "large"',           // 14
  '    return "positive"',            // 15
);
const SRC_LINES = SRC.split(NL);
const FIXED = new Set(SRC_LINES.map((l) => l.trim()));

// THE ENCLOSING-BLOCK RUNG IS OMITTED, AND THE REASON IS RECORDED RATHER THAN THE ARM SILENTLY
// DROPPED. `classify`'s body is a flat sequence of return guards, so its enclosing local block IS the
// function body and a BLOCK rung would differ from FULL by the `def` line alone. Adding a nested block
// would mean a behaviour shape gate 12A does not extract, which confounds rung with extraction path -
// the one thing a ladder exists to separate. It needs its own family, like R4.
const OMITTED = { BLOCK: 'enclosing block == function body for a flat guard sequence; differs from FULL by one line' };

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

// ---- THE ONE VARIABLE: how much fixed source is visible either side of the marker.
//
// MEASURED IN STATEMENTS, NOT LINES, and that is not a cosmetic choice. A fixed line radius cuts a
// guard away from its return - the first draft of this file showed `if n > 10000:` with no body below
// the marker - and a truncated block is itself an invitation to complete it. That would put completion
// affordance INSIDE the variable meant to isolate visible-source load, which is the confound this
// ladder exists to avoid. A unit is a guard and its return, the `def` line, or the fall-through return,
// so a window edge never lands mid-statement.
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

const RADIUS = { W0: 0, W1: 1, W2: 2, FULL: Infinity };

function windowFor(arm, p) {
  const r = RADIUS[arm];
  const k = unitAfter(p.insertAfter);          // the marker sits immediately after this unit
  const lo = Math.max(0, k + 1 - r);
  const hi = Math.min(UNITS.length - 1, k + r);
  const above = UNITS.slice(lo, k + 1).flatMap(([a, b]) => SRC_LINES.slice(a, b + 1));
  const below = UNITS.slice(k + 1, hi + 1).flatMap(([a, b]) => SRC_LINES.slice(a, b + 1));
  const parts = [];
  if (lo > 0) parts.push(ELISION);
  parts.push(...above, MARKER, ...below);
  if (hi < UNITS.length - 1) parts.push(ELISION);
  return { text: parts.join(NL), units: (k + 1 - lo) + (hi - k), visible: above.length + below.length };
}

// Every byte outside the window block is identical across arms. That is the whole design.
function promptFor(arm, c, p) {
  return L('Here is part of a Python function. Every line shown is FIXED: you may not change, repeat',
    'or remove any of it.',
    '',
    windowFor(arm, p).text,
    '',
    'A new behaviour is requested:',
    '    ' + c.delta,
    '',
    'Write ONLY the lines that take the place of the marker. Keep the same indentation.',
    'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.');
}

// ---- Acceptance policy, identical to ladder 2's and identical across arms.
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

// The declared result vocabulary. A value outside it is a vocabulary violation - which is what the old
// `scope_violation` column actually measured.
const VOCAB = ['very negative', 'quite negative', 'negative', 'zero', 'positive', 'small',
  'enormous', 'huge', 'large'];

// n == 10 is here BECAUSE ladder 2 found the hole: without it `if n <= 10` verifies. The rest probe
// behaviours nobody asked to change.
const PROBES = { contested: 0, delta: 5, boundary: 10, neg: -3, plain: 50,
  deepneg: -500, big: 5000, mid: 200 };
const PRESERVED = { neg: 'negative', plain: 'positive', deepneg: 'quite negative',
  big: 'huge', mid: 'large' };

function evaluate(program, expectedContested) {
  const ws = mkdtempSync(join(tmpdir(), 'win-'));
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
    // 10 is outside `below 10` on both readings, so it must land wherever it landed before.
    r.boundary_error = r.boundary !== 'positive';
    r.verified = r.delta_made && !r.preservation_broken && !r.semantic_error && !r.boundary_error;
    return r;
  } catch (e) { return { loaded: false, verified: false, load_error: String(e.message).slice(0, 60) }; }
}

// ---- APPARATUS CONTROL. Three halves, not two: perfect must verify, the ladder-1 inversion must be
// accepted and still fail, and `n <= 10` must be accepted and still fail - that last one is the
// POSITIVE CONTROL for the new boundary probe. Without it the probe could be present and toothless,
// which is this project's "control that could not fire" hazard.
const PERFECT = L('if n < 10:', '    return "small"');
const WRONG = 'if n > 10: return "small"';
const OFF_BY_ONE = 'if n <= 10: return "small"';

function control() {
  let bad = 0;
  for (const arm of ARMS) {
    for (const [id, c] of Object.entries(CASES)) {
      const p = plan(c);
      const prompt = promptFor(arm, c, p);
      const scanned = prompt.split(NL).filter((l) => l !== MARKER && l !== ELISION).join(NL);
      const hits = leakageScan(scanned);
      if (hits.length) { console.log('  LEAKAGE ' + arm + '/' + id + ': ' + hits.join('; ')); bad++; }

      const a = accept(PERFECT);
      if (!a.ok) { console.log('  CONTROL FAIL ' + arm + '/' + id + ' perfect rejected: ' + a.reason); bad++; continue; }
      const r = evaluate(build(a.code, p), c.contested);
      if (!r.verified) { console.log('  CONTROL FAIL ' + arm + '/' + id + ' perfect not verified: ' + JSON.stringify(r)); bad++; }

      for (const [label, src] of [['inversion', WRONG], ['off-by-one', OFF_BY_ONE]]) {
        const w = accept(src);
        if (!w.ok) { console.log('  CONTROL FAIL ' + arm + '/' + id + ' ' + label + ' REFUSED, not scored: ' + w.reason); bad++; continue; }
        const rw = evaluate(build(w.code, p), c.contested);
        if (rw.verified) { console.log('  CONTROL FAIL ' + arm + '/' + id + ' ' + label + ' VERIFIED - the scorer cannot see it'); bad++; }
      }
    }
  }
  for (const [k, why] of Object.entries(OMITTED)) console.log('  omitted rung ' + k + ': ' + why);
  console.log(bad ? '  CONTROLS FAILED: ' + bad
    : '  controls ok: every arm verifies a perfect fragment, and accepts-but-fails both the inversion'
      + ' and the off-by-one; no prompt leaks');
  return bad === 0;
}

if (process.argv.includes('--prompts')) {
  for (const arm of ARMS) for (const [id, c] of Object.entries(CASES)) {
    const p = plan(c);
    const w = windowFor(arm, p);
    console.log('===== ' + arm + ' / case ' + id + '   units ' + w.units + '  lines ' + w.visible + ' =====');
    console.log(promptFor(arm, c, p)); console.log('');
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

const results = { model: MODEL, temperature: TEMPERATURE, samples: SAMPLES, omitted: OMITTED, arms: {} };
for (const arm of ARMS) {
  results.arms[arm] = {};
  for (const [id, c] of Object.entries(CASES)) {
    const p = plan(c);
    const prompt = promptFor(arm, c, p);
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
    const w = windowFor(arm, p);
    const s = { of: SAMPLES, visible_units: w.units, visible_lines: w.visible,
      verified, authorized, refused: n((r) => r.authorized === false),
      whole_function: n((r) => r.reason === 'returned a function'),
      repeated_fixed: n((r) => r.reason === 'repeated a fixed line'),
      no_op: n((r) => r.no_op), preservation_broken: n((r) => r.preservation_broken),
      vocabulary_violation: n((r) => r.vocabulary_violation),
      semantic_error: n((r) => r.semantic_error), boundary_error: n((r) => r.boundary_error),
      load_error: n((r) => r.loaded === false),
      generation_capability: verified / SAMPLES,
      commit_integrity: authorized ? verified / authorized : null,
      variance: new Set(rows.map((r) => r.code || 'X')).size, rows };
    results.arms[arm][id] = s;
    console.log('  ' + arm.padEnd(5) + ' case ' + id + '  units ' + s.visible_units
      + ' lines ' + String(s.visible_lines).padStart(2)
      + '   verified ' + String(s.verified).padStart(2) + '/' + SAMPLES
      + '   refused ' + String(s.refused).padStart(2) + ' (whole-fn ' + s.whole_function + ')'
      + '   P(correct) ' + s.generation_capability.toFixed(2)
      + '   P(correct|committed) ' + (s.commit_integrity === null ? ' n/a' : s.commit_integrity.toFixed(2))
      + '   semantic ' + s.semantic_error + '   boundary ' + s.boundary_error
      + '   preserv ' + s.preservation_broken + '   var ' + s.variance);
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
console.log('  written -> ' + OUT);
