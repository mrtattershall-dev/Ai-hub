// THE MIDDLE FAMILY — the family that can tell OBSERVE apart from "append near the bottom".
//
// The previous OBSERVE ablation produced 624 for the derivation and 624 for a structure-blind BOTTOM
// policy, identical in every shape. The cause was benchmark geometry, not a good heuristic: in all four
// shapes the preserved behaviour sat at the TOP, so appending at the end automatically satisfied "do
// not precede the preserved behaviour". The family could not tell the derivation apart from appending.
//
// THIS FAMILY CAN, because the only correct position is IN THE MIDDLE:
//
//     if n == 3:      return "special"      existing A - must stay reachable
//     if n < 10:      return "tiny"         the new behaviour BELONGS HERE
//     if n < 100:     return "ordinary"     existing B - must not shadow the new behaviour
//     return "large"
//
//   BLIND_TOP     puts the new guard before A  -> A is shadowed        PRESERVATION BROKEN
//   BLIND_BOTTOM  puts it after B              -> the new guard is dead  NEW BEHAVIOUR DEAD
//   DERIVED       puts it between them         -> neither
//
// The two blind policies fail for OPPOSITE reasons, which is the preregistered success criterion: it is
// not enough for the derivation to score higher, the failures must be of the two different kinds the
// geometry predicts. A blind policy that happened to score badly for the wrong reason would not
// establish anything.
//
// THIS MUST NOT ACCIDENTALLY RE-TEST DECIDE. The semantic order is derived ONCE and handed to all three
// arms identically:
//
//     DECIDE   A > NEW > B        from preservation, and from `n < 10` being strictly inside `n < 100`
//     OBSERVE  A is at line i, B is at line j, therefore the legal region is between them
//
// Only the second is varied. DECIDE's output is byte-identical across arms, and a control asserts it.
//
// THE NEGATIVE CASE EARNS ITS PLACE. In `C5_NO_UNIQUE_MIDDLE` the later behaviour is DISJOINT from the
// requested one, so nothing constrains the new guard to precede it and the legal region is open-ended.
// An OBSERVE implementation that always manufactures a unique middle boundary has to decline and label
// the choice within that region as an ENGINEERING CHOICE. The case is asserted in the controls.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { orderRequested } from '../legacore/ordering.mjs';
import { leakageScan } from '../legacore/assemble.mjs';
import { promptSufficiency } from './sufficiency.mjs';
import { authorize, guardConditionOf } from '../legagate/envelope.mjs';
import { contractProbes, checkProbes, containsPoint } from '../legaverify/probes.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);
const BASE = process.argv[2];
const SAMPLES = Number(process.argv[3] || 20);
const OUT = process.argv[4] || './RESULT.middle.json';
const MODELS = (process.argv[5] || 'qwen2.5-coder:1.5b').split(',');
const TEMPERATURE = 0.6;
const CONTROL_ONLY = process.argv.includes('--control');
const MARKER = '    # >>> YOUR LINES GO HERE <<<';

const CASES = {
  C1: {
    lines: ['def classify(n):', '    if n == 3:', '        return "special"',
      '    if n < 100:', '        return "ordinary"', '    return "large"'],
    preservedCond: 'n == 3', laterCond: 'n < 100',
    delta: 'For every value below 10, however small, where n is not 3, return "tiny".',
    result: 'tiny', correct: 'if n < 10:', alt: 'if n < 10 and n != 3:' },
  C2: {
    lines: ['def classify(n):', '    if n == 12:', '        return "special"',
      '    if n < 200:', '        return "ordinary"', '    return "large"'],
    preservedCond: 'n == 12', laterCond: 'n < 200',
    delta: 'For every value below 20, however small, where n is not 12, return "tiny".',
    result: 'tiny', correct: 'if n < 20:', alt: 'if n < 20 and n != 12:' },
  C3: {
    // The preserved behaviour is a RANGE, not a point, and it is the narrowest of the three.
    lines: ['def classify(n):', '    if n < 0:', '        return "special"',
      '    if n < 500:', '        return "ordinary"', '    return "large"'],
    preservedCond: 'n < 0', laterCond: 'n < 500',
    delta: 'For every value below 50, however small, where n is not below 0, return "tiny".',
    result: 'tiny', correct: 'if n < 50:', alt: 'if 0 <= n < 50:' },
  C4: {
    // Same semantic geometry as C1, different source shape: the preserved behaviour is NOT first.
    lines: ['def classify(n):', '    if n > 100000:', '        return "huge"',
      '    if n == 3:', '        return "special"',
      '    if n < 100:', '        return "ordinary"', '    return "large"'],
    preservedCond: 'n == 3', laterCond: 'n < 100',
    delta: 'For every value below 10, however small, where n is not 3, return "tiny".',
    result: 'tiny', correct: 'if n < 10:', alt: 'if n < 10 and n != 3:' },
  C5_NO_UNIQUE_MIDDLE: {
    // The later behaviour is DISJOINT from the requested one, so nothing forces the new guard to
    // precede it. The legal region is open-ended and no unique middle exists. NO GENERATION.
    lines: ['def classify(n):', '    if n == 3:', '        return "special"',
      '    if n > 100:', '        return "ordinary"', '    return "large"'],
    preservedCond: 'n == 3', laterCond: 'n > 100',
    delta: 'For every value below 10, however small, where n is not 3, return "tiny".',
    result: 'tiny', correct: 'if n < 10:', alt: 'if n < 10 and n != 3:',
    generate: false,
    why: 'the later behaviour is disjoint from the requested one, so nothing constrains the new guard'
      + ' to precede it; the legal region is open-ended and choosing a point inside it is an'
      + ' ENGINEERING CHOICE rather than a derivation' },
};

function planCase(key) {
  const c = CASES[key];
  const src = c.lines.join(NL);
  const ex = existingBehaviours(src, 'classify');
  const A = ex.find((b) => b.condition === c.preservedCond);
  const B = ex.find((b) => b.condition === c.laterCond);
  const req = requestedBehaviour(c.delta, 'n', { soleParameter: true });

  // DECIDE, part one: does the preserved behaviour win over the requested one?
  const precA = derivePrecedence({ preservation_text: 'Preserve the existing special handling.',
    delta_text: c.delta, existing: { condition: A.condition, result: A.result },
    requested: { condition: req.condition, result: req.result } }, overlap(A.domain, req.domain));
  // DECIDE, part two: must the requested behaviour precede the later existing one?
  const ordB = orderRequested({ id: 'new', domain: req.domain, result: c.result },
    { id: 'later', domain: B.domain, result: B.result });

  const mustFollowA = precA.winner === 'existing';
  const mustPrecedeB = ordB.status === 'ORDERED' && ordB.first === 'new';

  // OBSERVE: where are A and B in THIS source? That, with the order above, fixes the region.
  const regionLo = A.line + 1;                    // after A's guard and its return
  const regionHi = mustPrecedeB ? B.line - 1 : c.lines.length - 2;
  const unique = mustPrecedeB && regionHi === regionLo;

  return { c, src, lines: c.lines, A, B, req, precA, ordB, mustFollowA, mustPrecedeB,
    regionLo, regionHi, unique,
    derived: regionLo,
    blindTop: 0,
    blindBottom: c.lines.length - 2 };
}

function promptFor(p) {
  const shown = L(...p.lines.slice(0, p.derived + 1), MARKER, ...p.lines.slice(p.derived + 1));
  return L('Here is a Python function. Every line shown is FIXED: you may not change, repeat',
    'or remove any of it.', '', shown, '',
    'A new behaviour is requested:', '    ' + p.c.delta, '',
    'Write ONLY the lines that take the place of the marker. Keep the same indentation.',
    'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.');
}

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'mid-'));
  writeFileSync(join(ws, 'impl.py'), program + NL, 'utf8');
  writeFileSync(join(ws, 'p.py'), L('import impl',
    ...inputs.map((v, i) => 'print("r' + i + '=" + str(impl.classify(' + v + ')))')), 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'] });
    const m = new Map();
    inputs.forEach((v, i) => {
      const mm = out.match(new RegExp('^r' + i + '=(.*)$', 'm'));
      m.set(v, mm ? mm[1].trim() : 'MISSING');
    });
    return m;
  } catch (e) { return null; }
}

const origCache = new Map();
const originalFor = (p) => (v) => {
  const k = p.c.preservedCond + '|' + p.c.laterCond + '|' + v;
  if (!origCache.has(k)) {
    const m = runProgram(p.src, [v]);
    origCache.set(k, m ? m.get(v) : 'ERROR');
  }
  return origCache.get(k);
};

const probeCache = new Map();
function probesFor(key, p) {
  if (!probeCache.has(key)) {
    probeCache.set(key, contractProbes({ requested: p.req.domain, requestedResult: p.c.result,
      preserved: p.A.domain, preservedWins: p.mustFollowA,
      existing: existingBehaviours(p.src, 'classify') }, originalFor(p)));
  }
  return probeCache.get(key);
}

// THE FAILURE MODE, not just the failure. The criterion is that the two blind policies fail for
// OPPOSITE reasons, so a run that only counted failures could not establish it.
function classify(p, probes, res) {
  if (!res) return 'DID_NOT_LOAD';
  const failures = probes.filter((x) => res.get(x.input) !== x.expected);
  if (!failures.length) return 'OK';
  // Preservation broken: an input the preserved behaviour owns now returns the NEW result.
  const preservationBroken = failures.some((f) => containsPoint(p.A.domain, f.input)
    && res.get(f.input) === p.c.result);
  // New behaviour dead: no probe anywhere returns the new result.
  const newDead = !probes.some((x) => res.get(x.input) === p.c.result);
  if (preservationBroken) return 'PRESERVATION_BROKEN';
  if (newDead) return 'NEW_DEAD';
  return 'OTHER';
}

const POLICIES = ['derived', 'blindTop', 'blindBottom'];
const CELLS = Object.keys(CASES).filter((k) => CASES[k].generate !== false);

function control() {
  let bad = 0;
  for (const key of Object.keys(CASES)) {
    const p = planCase(key);
    const c = CASES[key];
    const probes = probesFor(key, p);
    console.log('  ' + key.padEnd(20) + ' A ' + p.A.condition.padEnd(9) + ' B ' + p.B.condition.padEnd(9)
      + ' req ' + String(p.req.condition).padEnd(9)
      + '  region ' + p.regionLo + '..' + p.regionHi + (p.unique ? ' UNIQUE' : ' OPEN')
      + '  top ' + p.blindTop + ' bottom ' + p.blindBottom);

    if (c.generate === false) {
      if (p.unique) { console.log('  NEGATIVE CASE FAIL ' + key + ': a unique middle was manufactured'); bad++; }
      if (p.mustPrecedeB) { console.log('  NEGATIVE CASE FAIL ' + key + ': B was treated as constraining'); bad++; }
      continue;
    }
    if (!p.mustFollowA) { console.log('  DECIDE FAIL ' + key + ': A does not win over the requested behaviour'); bad++; }
    if (!p.mustPrecedeB) { console.log('  DECIDE FAIL ' + key + ': the requested behaviour is not required to precede B'); bad++; }
    if (!p.unique) { console.log('  GEOMETRY FAIL ' + key + ': the legal region is not a unique boundary'); bad++; }
    if (p.derived === p.blindTop || p.derived === p.blindBottom) {
      console.log('  GEOMETRY FAIL ' + key + ': a blind policy coincides with the derivation'); bad++;
    }

    const prompt = promptFor(p);
    if (leakageScan(prompt.split(NL).filter((l) => l !== MARKER).join(NL)).length) { console.log('  LEAKAGE ' + key); bad++; }
    const perfect = L('    ' + c.correct, '        return "' + c.result + '"');
    if (!promptSufficiency(prompt, perfect).sufficient) { console.log('  SUFFICIENCY FAIL ' + key); bad++; }

    // ADMITS: both realizations verify at the derived position.
    for (const which of ['correct', 'alt']) {
      const a = authorize(L(c[which], '    return "' + c.result + '"'), new Set(p.lines.map((l) => l.trim())));
      if (!a.ok) { console.log('  ANTI-ORACLE FAIL ' + key + '/' + which + ': ' + a.reason); bad++; continue; }
      const prog = L(...p.lines.slice(0, p.derived + 1), a.code, ...p.lines.slice(p.derived + 1));
      const v = classify(p, probes, runProgram(prog, probes.map((x) => x.input)));
      if (v !== 'OK') { console.log('  ANTI-ORACLE FAIL ' + key + '/' + which + ' at the derived site: ' + v); bad++; }
    }

    // THE CRITERION: each blind policy must fail, and for its own predicted reason.
    const a = authorize(L(c.correct, '    return "' + c.result + '"'), new Set(p.lines.map((l) => l.trim())));
    for (const [pol, want] of [['blindTop', 'PRESERVATION_BROKEN'], ['blindBottom', 'NEW_DEAD']]) {
      const at = p[pol];
      const prog = L(...p.lines.slice(0, at + 1), a.code, ...p.lines.slice(at + 1));
      const got = classify(p, probes, runProgram(prog, probes.map((x) => x.input)));
      if (got !== want) {
        console.log('  CRITERION FAIL ' + key + ' ' + pol + ': expected ' + want + ', got ' + got); bad++;
      }
    }
  }
  console.log(bad ? '  CONTROLS FAILED: ' + bad
    : '  controls ok: DECIDE fixes A > NEW > B in every case, the legal region is a unique middle,'
      + ' neither blind policy coincides with it, both realizations verify there, and each blind policy'
      + ' fails for its own predicted and opposite reason');
  return bad === 0;
}

if (process.argv.includes('--prompts')) {
  for (const k of CELLS) { console.log('===== ' + k + ' ====='); console.log(promptFor(planCase(k))); console.log(''); }
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
console.log('  ' + CELLS.length + ' cases x ' + MODELS.length + ' models   samples ' + SAMPLES);
console.log('');

const results = { models: MODELS, samples: SAMPLES, temperature: TEMPERATURE,
  negative_case: CASES.C5_NO_UNIQUE_MIDDLE.why, cells: {} };
for (const MODEL of MODELS) {
  for (const key of CELLS) {
    const p = planCase(key);
    const probes = probesFor(key, p);
    const inputs = probes.map((x) => x.input);
    const prompt = promptFor(p);
    const fixed = new Set(p.lines.map((l) => l.trim()));
    const rows = [];
    for (let i = 0; i < SAMPLES; i++) {
      let raw = '';
      try { raw = await generate(prompt, MODEL); } catch (e) { raw = ''; }
      const a = authorize(raw, fixed);
      if (!a.ok) { rows.push({ authorized: false, reason: a.reason, condition: guardConditionOf(raw) }); continue; }
      const row = { authorized: true, condition: guardConditionOf(raw), code: a.code.replace(/\s+/g, ' ').trim() };
      for (const pol of POLICIES) {
        const at = p[pol];
        const prog = L(...p.lines.slice(0, at + 1), a.code, ...p.lines.slice(at + 1));
        row[pol] = classify(p, probes, runProgram(prog, inputs));
      }
      rows.push(row);
    }
    const n = (f) => rows.filter(f).length;
    const k = MODEL + '|' + key;
    results.cells[k] = { of: SAMPLES, model: MODEL, case: key, authorized: n((r) => r.authorized),
      derived_ok: n((r) => r.derived === 'OK'),
      top_ok: n((r) => r.blindTop === 'OK'), bottom_ok: n((r) => r.blindBottom === 'OK'),
      top_preservation_broken: n((r) => r.blindTop === 'PRESERVATION_BROKEN'),
      bottom_new_dead: n((r) => r.blindBottom === 'NEW_DEAD'),
      rows };
    const s = results.cells[k];
    console.log('  ' + MODEL.padEnd(21) + key.padEnd(5)
      + ' authorized ' + String(s.authorized).padStart(2) + '/' + SAMPLES
      + '   DERIVED ok ' + String(s.derived_ok).padStart(2)
      + '   TOP ok ' + String(s.top_ok).padStart(2) + ' (preservation-broken ' + s.top_preservation_broken + ')'
      + '   BOTTOM ok ' + String(s.bottom_ok).padStart(2) + ' (new-dead ' + s.bottom_new_dead + ')');
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
for (const m of MODELS) {
  const ks = Object.keys(results.cells).filter((x) => x.startsWith(m + '|'));
  const S = (f) => ks.reduce((a, x) => a + f(results.cells[x]), 0);
  console.log('  ' + m.padEnd(21) + ' authorized ' + S((x) => x.authorized)
    + '   DERIVED ' + S((x) => x.derived_ok)
    + '   BLIND_TOP ' + S((x) => x.top_ok) + ' (preservation-broken ' + S((x) => x.top_preservation_broken) + ')'
    + '   BLIND_BOTTOM ' + S((x) => x.bottom_ok) + ' (new-dead ' + S((x) => x.bottom_new_dead) + ')');
}
console.log('');
console.log('  written -> ' + OUT);
