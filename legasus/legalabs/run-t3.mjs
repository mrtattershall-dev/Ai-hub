// T3 — THREE-OPERATION TRANSACTIONS. R4 passed at two operations with ZERO probe failures, and that is
// exactly why this exists.
//
// R4's honest limit: the transaction verifier had NO LIVE CATCH. Within a two-operation family the
// composition can only go wrong if the ORDERING goes wrong, and Legasus owns ordering, so it cannot. An
// individually authorized fragment can break a transaction only by having a DIFFERENT DOMAIN than the
// one requested - if `tiny` came back as `n < 100` instead of `n < 0` it would contain `small` and the
// derived order would make `small` dead. No model produced such a fragment: `tiny` was `n < 0` 175
// times out of 180.
//
// THREE NESTED DOMAINS RAISE THAT CHANCE ON PURPOSE, and not merely by being harder:
//
//   T3_NESTED        micro (n<0), low (n<10), mid (n<100)    fully nested -> one derivable order
//   T3_MIXED         micro (n<0), low (n<10), high (n>100)   partly ordered, one ENGINEERING CHOICE
//   T3_UNDETERMINED  micro (n<0), low (n<10), plus (n>0)     one intersecting pair -> NO GENERATION
//
// Three "below X" deltas with different thresholds is the first family where a model confusing two
// thresholds produces a fragment that is individually well-formed, individually authorized, and
// CHANGES THE CONTAINMENT RELATION - which is the only route by which an authorized proposal can break
// a transaction. If the transaction verifier is ever going to fire in anger, it is here.
//
// T3_UNDETERMINED is again a NO-GENERATION case: one ambiguous pair poisons the whole transaction,
// because shipping the determinable part would be a different change from the one requested.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existingBehaviours, requestedBehaviour } from '../legacore/predicates.mjs';
import { overlap } from '../legacore/overlap.mjs';
import { derivePrecedence } from '../legacore/precedence.mjs';
import { orderTransaction } from '../legacore/ordering.mjs';
import { leakageScan } from '../legacore/assemble.mjs';
import { promptSufficiency } from './sufficiency.mjs';
import { authorize, guardConditionOf } from '../legagate/envelope.mjs';
import { transactionProbes, reachability } from '../legaverify/transaction.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const BASE = process.argv[2];
const SAMPLES = Number(process.argv[3] || 20);
const OUT = process.argv[4] || './RESULT.t3.json';
const MODELS = (process.argv[5] || 'qwen2.5-coder:1.5b').split(',');
const TEMPERATURE = 0.6;
const CONTROL_ONLY = process.argv.includes('--control');
const MARKER = '    # >>> YOUR LINES GO HERE <<<';

const SRC_LINES = ['def classify(n):', '    if n == 3:', '        return "three"', '    return "other"'];
const SRC = SRC_LINES.join(NL);
const FIXED = new Set(SRC_LINES.map((l) => l.trim()));
const PRESERVED_COND = 'n == 3';

// EXTENT rendering throughout - the open end stated relationally, which three capacities have now shown
// is the strongest single lever available at RENDER.
// RESULT WORDS ARE CHOSEN SO THAT NONE IS A SUBSTRING OF ANOTHER, AND NONE APPEARS IN AN EXTENT
// PHRASE. The first draft used "small" and "tiny" with the extent phrase "however small", so the
// isolation control - which asserts a prompt never mentions the OTHER operation's result - fired on
// the adverb. That was a false positive in the control, but the collision was a real design smell:
// an experiment about whether the model is told about the other operation should not have to argue
// about whether an English adverb counts.
const OPS = {
  micro: { delta: 'For every value below 0, however small, return "micro".',
    result: 'micro', correct: 'if n < 0:', alt: 'if n <= -1:' },
  low: { delta: 'For every value below 10, however small, where n is not 3, return "low".',
    result: 'low', correct: 'if n < 10:', alt: 'if n < 10 and n != 3:' },
  mid: { delta: 'For every value below 100, however small, where n is not 3, return "mid".',
    result: 'mid', correct: 'if n < 100:', alt: 'if n < 100 and n != 3:' },
  high: { delta: 'For every value above 100, however large, return "high".',
    result: 'high', correct: 'if n > 100:', alt: 'if n >= 101:' },
  plus: { delta: 'For every value above 0, however large, where n is not 3, return "plus".',
    result: 'plus', correct: 'if n > 0:', alt: 'if n >= 1:' },
};

const CASES = {
  T3_NESTED: { ops: ['mid', 'micro', 'low'], expect: 'ORDERED', expectOrder: ['micro', 'low', 'mid'] },
  T3_MIXED: { ops: ['low', 'high', 'micro'], expect: 'ORDERED', expectOrder: null },
  T3_UNDETERMINED: { ops: ['micro', 'low', 'plus'], expect: 'UNDETERMINED', expectOrder: null,
    generate: false, why: 'low and plus intersect without containment, so no order over the'
      + ' transaction is derivable; committing the determinable part would be a different change from'
      + ' the one requested, chosen by the apparatus' },
};

const preserved = existingBehaviours(SRC, 'classify').find((b) => b.condition === PRESERVED_COND);
const INSERT_AFTER = preserved.line + 1;      // the preserved behaviour wins, so the new guards follow it

function planCase(key) {
  const c = CASES[key];
  const reqs = c.ops.map((id) => {
    const o = OPS[id];
    const r = requestedBehaviour(o.delta, 'n', { soleParameter: true });
    return { id, domain: r.domain, result: o.result, condition: r.condition, delta: o.delta };
  });
  // Precedence against the PRESERVED behaviour, per operation, exactly as the single-operation families
  // derived it. Ordering BETWEEN the two requested behaviours is a separate derivation.
  const prec = reqs.map((r) => derivePrecedence({
    preservation_text: 'Preserve the existing special handling of three.', delta_text: r.delta,
    existing: { condition: preserved.condition, result: preserved.result },
    requested: { condition: r.condition, result: r.result } }, overlap(preserved.domain, r.domain)));
  const ord = orderTransaction(reqs);
  return { key, c, reqs, prec, ord, order: ord.order, orderBasis: ord.orderBasis || null };
}

function promptFor(p, opId) {
  const shown = L(...SRC_LINES.slice(0, INSERT_AFTER + 1), MARKER, ...SRC_LINES.slice(INSERT_AFTER + 1));
  return L('Here is a Python function. Every line shown is FIXED: you may not change, repeat',
    'or remove any of it.', '', shown, '',
    'A new behaviour is requested:', '    ' + OPS[opId].delta, '',
    'Write ONLY the lines that take the place of the marker. Keep the same indentation.',
    'Do NOT repeat any fixed line. Do NOT write the whole function. Do NOT explain.');
}

// Assemble the transaction: the committed order decides which fragment goes first.
function build(p, codeById) {
  const body = p.order.flatMap((id) => codeById[id].split(NL));
  return L(...SRC_LINES.slice(0, INSERT_AFTER + 1), ...body, ...SRC_LINES.slice(INSERT_AFTER + 1));
}

function runProgram(program, inputs) {
  const ws = mkdtempSync(join(tmpdir(), 'r4-'));
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

const originalCache = new Map();
function original(v) {
  if (!originalCache.has(v)) {
    const m = runProgram(SRC, [v]);
    originalCache.set(v, m ? m.get(v) : 'ERROR');
  }
  return originalCache.get(v);
}

function probesFor(p) {
  return transactionProbes({ requested: p.reqs, order: p.order,
    preserved: preserved.domain, preservedWins: true,
    existing: [{ domain: preserved.domain }] }, original);
}

function verifyTransaction(p, codeById) {
  const probes = probesFor(p);
  const res = runProgram(build(p, codeById), probes.map((x) => x.input));
  if (!res) return { verified: false, loaded: false, failures: [{ why: 'did not load' }] };
  const failures = probes.filter((x) => res.get(x.input) !== x.expected);
  const reach = reachability({ requested: p.reqs, order: p.order,
    preserved: preserved.domain, preservedWins: true });
  return { verified: failures.length === 0 && reach.allReachable, loaded: true,
    failures: failures.slice(0, 3), dead: reach.dead, probes: probes.length };
}

const CELLS = Object.keys(CASES).filter((k) => CASES[k].generate !== false);

function control() {
  let bad = 0;
  for (const key of Object.keys(CASES)) {
    const p = planCase(key);
    const c = CASES[key];
    if (p.ord.status !== c.expect) {
      console.log('  ORDER STATUS ' + key + ': got ' + p.ord.status + ', expected ' + c.expect); bad++;
    }
    if (c.expectOrder && String(p.order) !== String(c.expectOrder)) {
      console.log('  ORDER ' + key + ': got ' + p.order + ', expected ' + c.expectOrder); bad++;
    }
    // Where the order is only PARTLY derived, assert the derived constraints rather than a full order:
    // demanding one particular total order would be asserting an ENGINEERING CHOICE as a derivation.
    if (p.order) {
      for (const pr of p.ord.pairs.filter((x) => x.status === 'ORDERED')) {
        const inner = pr.first; const outer = pr.a === inner ? pr.b : pr.a;
        if (p.order.indexOf(inner) > p.order.indexOf(outer)) {
          console.log('  ORDER CONSTRAINT ' + key + ': ' + inner + ' must precede ' + outer); bad++;
        }
      }
    }
    console.log('  ' + key.padEnd(15) + p.ord.status.padEnd(13)
      + (p.order ? 'order ' + p.order.join(' then ') + '   basis ' + p.orderBasis : 'NO GENERATION')
      + (p.ord.blocking ? '   blocked by ' + p.ord.blocking.a + '/' + p.ord.blocking.b
        + ' at n=' + p.ord.blocking.witness.input : ''));
    if (c.generate === false) continue;

    for (const id of c.ops) {
      const prompt = promptFor(p, id);
      const hits = leakageScan(prompt.split(NL).filter((l) => l !== MARKER).join(NL));
      if (hits.length) { console.log('  LEAKAGE ' + key + '/' + id + ': ' + hits.join('; ')); bad++; }
      const perfect = L('    ' + OPS[id].correct, '        return "' + OPS[id].result + '"');
      if (!promptSufficiency(prompt, perfect).sufficient) { console.log('  SUFFICIENCY FAIL ' + key + '/' + id); bad++; }
      // The prompt must not disclose the OTHER operation, or the composition is not Legasus's.
      for (const other of c.ops) {
        if (other === id) continue;
        // The QUOTED result literal, not the bare word: "however small" is an adverb and the
        // operation's result is `"low"`. Checking the bare word made the control fire on English.
        if (prompt.includes('"' + OPS[other].result + '"')) {
          console.log('  ISOLATION FAIL ' + key + '/' + id + ' mentions ' + other); bad++;
        }
      }
    }

    // ADMITS: canonical and alternative realizations must both verify, per operation.
    for (const which of ['correct', 'alt']) {
      const codeById = {};
      for (const id of c.ops) {
        const a = authorize(L(OPS[id][which], '    return "' + OPS[id].result + '"'), FIXED);
        if (!a.ok) { console.log('  ANTI-ORACLE FAIL ' + key + '/' + id + '/' + which + ': ' + a.reason); bad++; }
        codeById[id] = a.ok ? a.code : '';
      }
      const v = verifyTransaction(p, codeById);
      if (!v.verified) {
        console.log('  ANTI-ORACLE FAIL ' + key + ' ' + which + ' transaction rejected: '
          + JSON.stringify(v.failures) + ' dead=' + JSON.stringify(v.dead)); bad++;
      }
    }

    // THE R4 CONTROL: both fragments perfect, order reversed. Must fail where ordering matters and
    // must PASS where both orders are legal.
    const codeById = {};
    for (const id of c.ops) codeById[id] = authorize(L(OPS[id].correct, '    return "' + OPS[id].result + '"'), FIXED).code;
    const flipped = { ...p, order: p.order.slice().reverse() };
    const vf = verifyTransaction(flipped, codeById);
    if (p.ord.status === 'ORDERED' && p.ord.orderBasis === 'DERIVED' && vf.verified) {
      console.log('  R4 CONTROL FAIL ' + key + ': the reversed composition verified, so ordering is'
        + ' not being tested'); bad++;
    }
    // Where a tie was broken by ENGINEERING CHOICE the reversal may be legal or not depending on which
    // constraint it crosses, so it is not asserted either way - it is reported.
    if (p.ord.orderBasis === 'DERIVED_WITH_ENGINEERING_CHOICE') {
      console.log('  ' + key + ' NOTE: reversed order ' + (vf.verified ? 'verifies' : 'fails')
        + ', which is expected to depend on which constraint the reversal crosses');
    }
  }
  console.log(bad ? '  CONTROLS FAILED: ' + bad
    : '  controls ok: orders derived as expected, each prompt isolated from the other operation,'
      + ' both realizations verify, the reversed composition fails where ordering is derived and'
      + ' passes where both orders are legal');
  return bad === 0;
}

if (process.argv.includes('--prompts')) {
  for (const key of CELLS) { const p = planCase(key);
    for (const id of CASES[key].ops) { console.log('===== ' + key + ' / ' + id + ' ====='); console.log(promptFor(p, id)); console.log(''); } }
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
console.log('  ' + CELLS.length + ' transaction cases x ' + MODELS.length + ' models   samples ' + SAMPLES);
console.log('');

const results = { models: MODELS, samples: SAMPLES, temperature: TEMPERATURE,
  undetermined_not_generated: CASES.T_UNDETERMINED.why, cells: {} };
for (const MODEL of MODELS) {
  for (const key of CELLS) {
    const p = planCase(key);
    const rows = [];
    const t0 = Date.now();
    for (let i = 0; i < SAMPLES; i++) {
      const codeById = {}; const perOp = {};
      let allAuthorized = true;
      for (const id of CASES[key].ops) {
        let raw = '';
        try { raw = await generate(promptFor(p, id), MODEL); } catch (e) { raw = ''; }
        const a = authorize(raw, FIXED);
        perOp[id] = { authorized: a.ok, reason: a.reason || null, condition: guardConditionOf(raw) };
        if (!a.ok) { allAuthorized = false; continue; }
        codeById[id] = a.code;
      }
      if (!allAuthorized) { rows.push({ assembled: false, perOp }); continue; }
      const v = verifyTransaction(p, codeById);
      rows.push({ assembled: true, perOp, verified: v.verified, dead: v.dead,
        failures: v.failures, codes: Object.fromEntries(Object.entries(codeById).map(([k2, v2]) => [k2, v2.replace(/\s+/g, ' ').trim()])) });
    }
    const n = (f) => rows.filter(f).length;
    const assembled = n((r) => r.assembled);
    const verified = n((r) => r.verified);
    const opsTried = SAMPLES * CASES[key].ops.length;
    const opsAuth = rows.reduce((a, r) => a + Object.values(r.perOp).filter((o) => o.authorized).length, 0);
    results.cells[MODEL + '|' + key] = { of: SAMPLES, model: MODEL, case: key,
      order: p.order, orderBasis: p.orderBasis, seconds: (Date.now() - t0) / 1000,
      op_yield: opsAuth / opsTried, assembled, verified,
      transaction_precision: assembled ? verified / assembled : null,
      dead_ops: n((r) => r.dead && r.dead.length > 0),
      probe_failures: n((r) => r.assembled && !r.verified && (!r.dead || !r.dead.length)),
      rows };
    const s = results.cells[MODEL + '|' + key];
    console.log('  ' + MODEL.padEnd(21) + key.padEnd(13)
      + ' op-yield ' + s.op_yield.toFixed(3)
      + '   assembled ' + String(assembled).padStart(2) + '/' + SAMPLES
      + '   verified ' + String(verified).padStart(2)
      + '   P(correct|assembled) ' + (s.transaction_precision === null ? ' n/a' : s.transaction_precision.toFixed(3))
      + '   dead-op ' + s.dead_ops + '   probe-fail ' + s.probe_failures);
  }
}
writeFileSync(OUT, JSON.stringify(results, null, 1), 'utf8');
console.log('');
for (const m of MODELS) {
  const ks = Object.keys(results.cells).filter((k) => k.startsWith(m + '|'));
  const S = (f) => ks.reduce((a, k) => a + f(results.cells[k]), 0);
  const N = SAMPLES * CELLS.length;
  console.log('  ' + m.padEnd(21) + ' transaction yield ' + (S((x) => x.assembled) / N).toFixed(3)
    + '   P(correct|assembled) ' + (S((x) => x.verified) / S((x) => x.assembled)).toFixed(3)
    + '   verified end-to-end ' + (S((x) => x.verified) / N).toFixed(3)
    + '   sec/verified ' + (S((x) => x.verified) ? (S((x) => x.seconds) / S((x) => x.verified)).toFixed(1) : 'n/a'));
}
console.log('');
console.log('  written -> ' + OUT);
