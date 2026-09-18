// WITNESSES for GATE 12D — the intent contract.
//
// THE ANTI-ORACLE TEST is the important one. The same contract is handed to three deliberately
// different programs:
//
//   A  precedence by ORDER            zero checked first, then small
//   B  precedence by PREDICATE        small guarded with `and n != 0`, checked first
//   C  precedence REVERSED            small checked first, unguarded
//
// A and B must both conform; C must fail, and must fail specifically at the overlap witness. A
// contract that only A satisfied would have encoded one implementation; a contract C also satisfied
// would not constrain meaning at all.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCondition, existingBehaviours, requestedBehaviour } from './predicates.mjs';
import { overlap, satisfies } from './overlap.mjs';
import { derivePrecedence } from './precedence.mjs';
import { emitContract, encodeDomain, decodeDomain, semanticRoundTrip, leakageScan, PROBE_INPUTS }
  from './contract.mjs';

const NL = String.fromCharCode(10);
const L = (...xs) => xs.join(NL);

const SRC = L(
  'def classify(n):',
  '    if n < 0:',
  '        return "negative"',
  '    if n == 0:',
  '        return "zero"',
  '    return "positive"',
);

const zero = existingBehaviours(SRC, 'classify').find((b) => b.condition === 'n == 0');
const requested = requestedBehaviour('For other values below 10, return "small".', 'n',
  { soleParameter: true });
const ov = overlap(zero.domain, requested.domain);
const prec = derivePrecedence({
  preservation_text: 'Preserve the existing special handling of zero.',
  delta_text: 'For other values below 10, return "small".',
  existing: { condition: zero.condition, result: zero.result },
  requested: { condition: requested.condition, result: requested.result },
}, ov);
const contract = emitContract({ existing: zero, requested, overlapResult: ov, precedence: prec });

let fail = 0;
const check = (name, cond, detail) => {
  if (!cond) fail++;
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + name + (detail ? '   ' + detail : ''));
};

// ---- tagged bounds survive JSON with their MEANING intact
const unbounded = parseCondition('n < 10');
const naive = JSON.parse(JSON.stringify(unbounded));
check('HAZARD  a RAW domain inverts through JSON, which is why bounds are tagged',
  satisfies(unbounded, -5) === true && satisfies(naive, -5) === false,
  'raw lo becomes ' + JSON.stringify(naive.lo));

const rt = semanticRoundTrip(unbounded, satisfies);
check('ROUND TRIP  the tagged domain answers identically at every probe input',
  rt.identical, rt.identical ? PROBE_INPUTS.length + ' inputs agree'
    : JSON.stringify(rt.diffs.slice(0, 3)));

const rtJson = decodeDomain(JSON.parse(JSON.stringify(encodeDomain(unbounded))));
const jsonDiffs = PROBE_INPUTS.filter((v) => satisfies(unbounded, v) !== satisfies(rtJson, v));
check('ROUND TRIP  through actual JSON text, not just the encoder', jsonDiffs.length === 0,
  jsonDiffs.length ? 'differs at ' + JSON.stringify(jsonDiffs) : 'all agree');

for (const d of [parseCondition('n == 0'), parseCondition('n >= 3'), parseCondition('n != 0'),
  { kind: 'universe' }]) {
  const r = semanticRoundTrip(d, satisfies);
  check('ROUND TRIP  ' + d.kind + ' survives', r.identical);
}

// ---- the contract must not describe an implementation
const leaks = leakageScan(contract);
check('NO LEAKAGE  the emitted contract names no site, order or branch shape',
  leaks.length === 0, leaks.length ? leaks.join(', ') : JSON.stringify(contract.precedence));

check('SHAPE  precedence is scoped to the overlap only',
  contract.precedence.winner === 'existing' && contract.precedence.scope === 'overlap');
check('SHAPE  the overlap witness travels with the contract', contract.overlap.witness === 0);

// ---- ANTI-ORACLE: three implementations, one contract
const IMPLS = {
  A: L('def classify(n):', '    if n < 0:', '        return "negative"',
    '    if n == 0:', '        return "zero"', '    if n < 10:', '        return "small"',
    '    return "positive"'),
  B: L('def classify(n):', '    if n < 0:', '        return "negative"',
    '    if n < 10 and n != 0:', '        return "small"',
    '    if n == 0:', '        return "zero"', '    return "positive"'),
  C: L('def classify(n):', '    if n < 0:', '        return "negative"',
    '    if n < 10:', '        return "small"',
    '    if n == 0:', '        return "zero"', '    return "positive"'),
};

// Conformance: on the contested input the WINNER's result must be produced; on an uncontested input of
// the loser's domain the loser's result must be produced. Nothing about shape is checked.
function conforms(source) {
  const ws = mkdtempSync(join(tmpdir(), 'contract-'));
  writeFileSync(join(ws, 'impl.py'), source, 'utf8');
  const winnerResult = contract.precedence.winner === 'existing'
    ? contract.behaviors.existing.result : contract.behaviors.requested.result;
  const loserResult = contract.precedence.winner === 'existing'
    ? contract.behaviors.requested.result : contract.behaviors.existing.result;
  const probe = L('import impl',
    'w = impl.classify(' + contract.overlap.witness + ')',
    'u = impl.classify(5)',
    'print("WITNESS=" + str(w))',
    'print("UNCONTESTED=" + str(u))');
  writeFileSync(join(ws, 'p.py'), probe, 'utf8');
  try {
    const out = execFileSync('python', ['p.py'], { cwd: ws, encoding: 'utf8', timeout: 20000 });
    const w = (out.match(/WITNESS=(.*)/) || [])[1].trim();
    const u = (out.match(/UNCONTESTED=(.*)/) || [])[1].trim();
    return { ok: w === winnerResult.replace(/"/g, '') && u === loserResult.replace(/"/g, ''),
      witnessGot: w, uncontestedGot: u };
  } catch (e) { return { ok: false, error: String(e.message).slice(0, 60) }; }
}

const rA = conforms(IMPLS.A);
const rB = conforms(IMPLS.B);
const rC = conforms(IMPLS.C);
check('ANTI-ORACLE  implementation A (precedence by ORDER) conforms', rA.ok,
  'witness -> ' + rA.witnessGot);
check('ANTI-ORACLE  implementation B (precedence by PREDICATE) conforms', rB.ok,
  'witness -> ' + rB.witnessGot);
check('ANTI-ORACLE  implementation C (precedence REVERSED) does NOT conform', !rC.ok,
  'witness -> ' + rC.witnessGot + ', expected ' + contract.behaviors.existing.result);
check('ANTI-ORACLE  C fails specifically AT THE OVERLAP WITNESS',
  rC.witnessGot !== 'zero' && rC.uncontestedGot === 'small');
check('UNDERDETERMINED  the contract admits MORE THAN ONE implementation',
  rA.ok && rB.ok && IMPLS.A !== IMPLS.B);

console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all witnesses pass'));
console.log('  Non-vacuity: two structurally different programs must BOTH conform and a third must');
console.log('  fail at the contested input. A contract only A satisfied would have encoded one');
console.log('  implementation; one C also satisfied would not constrain meaning at all.');
if (fail) process.exitCode = 1;
