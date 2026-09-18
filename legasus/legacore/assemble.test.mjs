// WITNESSES for GATE 12E — the assembled package.
//
// This is the only artefact the model sees, so the leakage check is the load-bearing one. A package
// that names a site, an ordering or a branch shape would let a good score mean the apparatus wrote the
// answer and the model transcribed it.
//
// The NEGATIVE controls prove the scanner can fire: each is a package deliberately containing one
// forbidden form. A scanner that passed those would certify anything.
import { assemble, leakageScan } from './assemble.mjs';
import { parseCondition, existingBehaviours, requestedBehaviour } from './predicates.mjs';
import { overlap } from './overlap.mjs';
import { derivePrecedence } from './precedence.mjs';

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

function build(delta, preservation) {
  const req = requestedBehaviour(delta, 'n', { soleParameter: true });
  const ov = overlap(zero.domain, req.domain);
  const prec = derivePrecedence({ preservation_text: preservation, delta_text: delta,
    existing: { condition: zero.condition, result: zero.result },
    requested: { condition: req.condition, result: req.result } }, ov);
  return assemble({
    unit: 'classify',
    structural: { scope: 'the body of `classify`',
      must_not_change: ['the result for negative inputs', 'the result for inputs of 10 or more'] },
    transaction: { requirements: [] },
    semantic: {
      behaviors: { existing: { domain: zero.domain, result: zero.result },
        requested: { domain: req.domain, result: req.result } },
      overlap: ov.result === 'SATISFIABLE' ? { status: 'SATISFIABLE', witness: ov.witness }
        : { status: ov.result },
      precedence: prec.outcome === 'PRECEDENCE' ? { winner: prec.winner } : null,
    },
  });
}

const A = build('For other values below 10, return "small".',
  'Preserve the existing special handling of zero.');
const B = build('Values below 10 should now return "small", including values that previously returned "zero".',
  null);
const AMB = build('Add small handling for values below 10.', null);

let fail = 0;
const check = (name, cond, detail) => {
  if (!cond) fail++;
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + '  ' + name + (detail ? '   ' + detail : ''));
};

check('NO LEAKAGE  case A package names no site, ordering or branch shape',
  leakageScan(A).length === 0, leakageScan(A).join('; '));
check('NO LEAKAGE  case B package names no site, ordering or branch shape',
  leakageScan(B).length === 0, leakageScan(B).join('; '));
check('NO LEAKAGE  the ambiguous package leaks nothing either',
  leakageScan(AMB).length === 0, leakageScan(AMB).join('; '));

// The scanner must be able to fire, or "no leakage" means nothing.
const SEEDED = [
  ['a line number', 'Put the new guard at line 4.'],
  ['an insertion point', 'Try inserting after the zero check.'],
  ['a branch keyword', 'Use an elif for the new case.'],
  ['a placement instruction', 'Place it before the fall-through.'],
  ['a check ordering', 'You should check it first.'],
  ['the reference', 'Match the reference implementation.'],
];
for (const [what, text] of SEEDED) {
  check('SCANNER FIRES  on ' + what, leakageScan(text).length > 0, JSON.stringify(text));
}

// The two halves must differ in exactly one sentence: the ruling on the contested input.
const diffA = A.split(NL).filter((l) => !B.includes(l));
const diffB = B.split(NL).filter((l) => !A.includes(l));
check('MUST DISTINGUISH  the packages differ only in the precedence ruling',
  diffA.length === 1 && diffB.length === 1,
  JSON.stringify(diffA) + ' vs ' + JSON.stringify(diffB));
check('CASE A  rules the contested input to the existing result',
  A.includes('the result must be "zero"'));
check('CASE B  rules the contested input to the requested result',
  B.includes('the result must be "small"'));
check('AMBIGUOUS  says so rather than ruling',
  AMB.includes('not fully determined') && !AMB.includes('the result must be'));

console.log('');
console.log('  --- case A package as the model would receive it');
console.log(A.split(NL).map((l) => '      ' + l).join(NL));
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all witnesses pass'));
console.log('  Non-vacuity: ' + SEEDED.length + ' seeded packages must be CAUGHT. A scanner that passed');
console.log('  those would certify anything, and "no leakage" would be worth nothing.');
if (fail) process.exitCode = 1;
