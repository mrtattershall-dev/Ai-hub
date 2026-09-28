// WITNESSES for GATE 12B — overlap only, no precedence anywhere.
//
// The boundary cases carry the weight. `n == 10` against `n <= 10` must overlap at exactly the closed
// endpoint; against `n < 10` it must not. `n <= 3` against `n > 3` is the adjacent-but-disjoint case a
// sloppy comparison gets wrong.
//
// The UNKNOWN cases are the ones that protect the architecture: an unmodelled domain must propagate
// uncertainty and must NEVER be read as no-overlap, because that would declare precedence unnecessary
// exactly when the system cannot tell.
import { parseCondition } from './predicates.mjs';
import { overlap, satisfies } from './overlap.mjs';

const D = (s) => parseCondition(s);
const UNMODELLED = { kind: 'unmodelled', text: 'name in COLORS' };

const cases = [
  // ---- SATISFIABLE, with the witness the algebra must find
  { name: 'SATISFIABLE  a point inside an open interval', a: D('n == 0'), b: D('n < 10'),
    result: 'SATISFIABLE', witness: 0 },
  { name: 'SATISFIABLE  a point ON a closed bound', a: D('n == 10'), b: D('n <= 10'),
    result: 'SATISFIABLE', witness: 10 },
  { name: 'SATISFIABLE  two open intervals that genuinely overlap', a: D('n > 3'), b: D('n < 5'),
    result: 'SATISFIABLE' },
  { name: 'SATISFIABLE  an interval against the universe', a: D('n < 10'), b: { kind: 'universe' },
    result: 'SATISFIABLE' },

  // ---- DISJOINT, each for a different reason
  { name: 'DISJOINT  intervals far apart', a: D('n < 0'), b: D('n > 10'), result: 'DISJOINT' },
  { name: 'DISJOINT  a point just outside an open bound', a: D('n == 10'), b: D('n < 10'),
    result: 'DISJOINT' },
  { name: 'DISJOINT  adjacent intervals sharing only an excluded endpoint',
    a: D('n <= 3'), b: D('n > 3'), result: 'DISJOINT' },
  { name: 'DISJOINT  a point against its own complement', a: D('n == 0'), b: D('n != 0'),
    result: 'DISJOINT' },

  // ---- UNKNOWN, which must never collapse into DISJOINT
  { name: 'UNKNOWN  an unmodelled domain on the left', a: UNMODELLED, b: D('n < 10'), result: 'UNKNOWN' },
  { name: 'UNKNOWN  an unmodelled domain on the right', a: D('n == 0'), b: UNMODELLED, result: 'UNKNOWN' },
  { name: 'UNKNOWN  domains over different variables', a: D('n == 0'), b: D('k < 10'), result: 'UNKNOWN' },
];

let fail = 0;
for (const c of cases) {
  const r = overlap(c.a, c.b);
  let ok = r.result === c.result;
  if (ok && c.witness !== undefined) ok = r.witness === c.witness;
  // Every SATISFIABLE must carry a witness that really satisfies both, checked here too.
  if (ok && r.result === 'SATISFIABLE') {
    ok = satisfies(c.a, r.witness) === true && satisfies(c.b, r.witness) === true;
  }
  if (!ok) fail++;
  console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + c.name
    + '   -> ' + r.result + (r.witness !== undefined ? ' witness ' + r.witness : ''));
  if (!ok) console.log('        ' + (r.reason || '').slice(0, 100));
}

// The must-distinguish pair's shared half: identical domains must give identical overlap output no
// matter what the surrounding task says. This module has no way to know, and that is the point.
const A = overlap(D('n == 0'), D('n < 10'));
const B = overlap(D('n == 0'), D('n < 10'));
const identical = JSON.stringify(A) === JSON.stringify(B);
console.log('  ' + (identical ? 'ok  ' : 'FAIL') + '  INVARIANT  identical domains give byte-identical'
  + ' overlap output - 12B cannot see intent');
if (!identical) fail++;

const sat = cases.filter((c) => c.result === 'SATISFIABLE').length;
const dis = cases.filter((c) => c.result === 'DISJOINT').length;
const unk = cases.filter((c) => c.result === 'UNKNOWN').length;
console.log('');
console.log('  ' + (fail ? fail + ' WITNESS FAILURE(S)' : 'all ' + (cases.length + 1) + ' witnesses pass'));
console.log('  Non-vacuity: ' + sat + ' SATISFIABLE, ' + dis + ' DISJOINT, ' + unk + ' UNKNOWN.');
console.log('  A checker answering SATISFIABLE always fails the disjoint cases; one answering DISJOINT');
console.log('  always fails the satisfiable ones; one collapsing UNKNOWN into DISJOINT fails the three');
console.log('  that must stay undecided.');
if (fail) process.exitCode = 1;
