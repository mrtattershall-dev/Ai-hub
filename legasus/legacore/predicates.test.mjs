// WITNESSES for GATE 12A — behavioural predicate extraction, written before anything consumes it.
//
// The negatives are the load-bearing half. An extractor that normalises anything it is handed will
// invent domains, and every later overlap and precedence answer would rest on a fabricated interval.
// `unmodelled` must survive as an answer.
import { parseCondition, existingBehaviours, requestedBehaviour } from './predicates.mjs';

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

let fail = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + name);
  if (!ok) console.log('        got  ' + JSON.stringify(got) + NL + '        want ' + JSON.stringify(want));
};

// ---- conditions
check('POSITIVE  equality becomes a point',
  parseCondition('n == 0'), { kind: 'point', variable: 'n', value: 0 });
check('POSITIVE  strict less-than becomes an open interval',
  parseCondition('n < 10'), { kind: 'interval', variable: 'n', lo: -Infinity, hi: 10, loOpen: true, hiOpen: true });
check('POSITIVE  greater-or-equal becomes a closed lower bound',
  parseCondition('n >= 3'), { kind: 'interval', variable: 'n', lo: 3, hi: Infinity, loOpen: false, hiOpen: true });
check('NEGATIVE  a compound condition is NOT normalised',
  parseCondition('n < 10 and n != 0'), { kind: 'unmodelled', text: 'n < 10 and n != 0' });
check('NEGATIVE  a non-numeric condition is NOT normalised',
  parseCondition('name in COLORS'), { kind: 'unmodelled', text: 'name in COLORS' });

// ---- existing behaviours
const ex = existingBehaviours(SRC, 'classify');
check('POSITIVE  three behaviours read from the program',
  ex.map((b) => [b.condition, b.result]),
  [['n < 0', '"negative"'], ['n == 0', '"zero"'], [null, '"positive"']]);
check('POSITIVE  the fall-through is the universe, not a guard',
  ex[2].domain, { kind: 'universe' });

// ---- requested behaviour, from specification English
check('POSITIVE  a GENERIC subject binds to the sole parameter',
  (() => { const r = requestedBehaviour('For other values below 10, return "small".', 'n',
    { soleParameter: true });
    return [r.condition, r.result]; })(),
  ['n < 10', '"small"']);
check('NEGATIVE  a generic subject does NOT bind when the unit has several parameters',
  requestedBehaviour('For other values below 10, return "small".', 'n', { soleParameter: false }).condition,
  null);
check('POSITIVE  an explicit operator form is accepted',
  (() => { const r = requestedBehaviour('when n >= 100 the result is reported as "huge"', 'n');
    return [r.condition, r.result]; })(),
  ['n >= 100', '"huge"']);
check('NEGATIVE  prose with no expressible condition yields no condition',
  requestedBehaviour('Make the output nicer for small inputs.', 'n').condition, null);
check('NEGATIVE  a condition over a DIFFERENT variable is not adopted',
  requestedBehaviour('when k < 10 return "small"', 'n').condition, null);

const negs = 6;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all witnesses pass'));
console.log('  Non-vacuity: ' + negs + ' negatives must NOT normalise. An extractor that normalised');
console.log('  everything would invent domains, and every later overlap and precedence answer would');
console.log('  rest on a fabricated interval.');
if (fail) process.exitCode = 1;
