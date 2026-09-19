// HISTORICAL — NON-RUNNABLE. The replay implementation this script exercised was RETIRED in the r4
// replay retirement (benchmarks/RETIREMENT.md). The script is kept because its RESULT is part of the
// record and the reasoning that produced it must remain auditable; it is not kept because it still runs.
// The evidence it produced is preserved and provenance-stamped in benchmarks/PROVENANCE.json.
//
// r4 / V2b — does delegated assertion evaluation close the W2 gap?
//
// r4 DEVELOPMENT EVIDENCE. Repo C's prospective numbers are unchanged.
//
// PREDICTIONS, FROZEN BEFORE THE RUN:
//   X1  W2 rises to 49/49 - every case where both r3 and the external verifier reported failure is now
//       detected as a failure, INCLUDING the 5 OUTPUT_MISMATCH cases an execution-only model cannot see.
//   X2  W1 stays 8/8 - the cases the model was built to recover are not lost again.
//   X3  W3 stays 75/75 - nothing observable becomes unobservable.
//
// WHAT IS DELIBERATELY NOT MEASURED: overall agreement with doctest. This model now borrows doctest's own
// OutputChecker, so agreement is expected BY CONSTRUCTION and would be evidence of nothing. The claim
// under test is narrow - that the witness can DETECT an output mismatch at all, which it previously
// could not.
import { readFileSync, writeFileSync } from 'node:fs';
import { observeSequentialChecked } from '../../legasus/legaexercise/observe-r4.mjs';

const ROOT = 'benchmarks/repoC/pristine';
const PKG = 'pyparsing';
const sweep = JSON.parse(readFileSync('benchmarks/repoC/sweep.json', 'utf8'));
const extRaw = JSON.parse(readFileSync('benchmarks/repoC/external.json', 'utf8'));
const extBy = new Map();
for (const x of extRaw) if (x.source) extBy.set(x.module.split('.').pop() + '|' + String(x.source).trim(), x.outcome);
const keyOf = (r) => r.module.replace(/\.py$/, '') + '|' + r.invocation.trim();

const groups = new Map();
for (const r of sweep.runs) {
  const g = r.dotted + '|' + String(r.owner);
  if (!groups.has(g)) groups.set(g, { dotted: r.dotted, rows: [] });
  groups.get(g).rows.push(r);
}
const outcome = new Map();
for (const [, g] of groups) {
  const examples = g.rows.map((r) => ({ invocation: r.invocation, wants: r.wants }));
  const out = observeSequentialChecked({ rootDir: ROOT, packageName: PKG, dotted: g.dotted, examples });
  if (out.unobservable || out.importFailed) {
    for (const r of g.rows) outcome.set(keyOf(r), 'UNOBSERVABLE');
    continue;
  }
  for (let i = 0; i < g.rows.length; i++) {
    outcome.set(keyOf(g.rows[i]), out.results[i] ? out.results[i].outcome : 'UNOBSERVABLE');
  }
}

const isFailure = (o) => o === 'OUTPUT_MISMATCH' || o === 'UNEXPECTED_EXCEPTION' || o === 'UNOBSERVABLE';
const w1 = sweep.runs.filter((r) => String(r.status).startsWith('SETUP_FAILED') && extBy.get(keyOf(r)) === 'PASS');
const w2 = sweep.runs.filter((r) => String(r.status).startsWith('SETUP_FAILED')
  && ['UNEXPECTED_EXCEPTION', 'OUTPUT_MISMATCH'].includes(extBy.get(keyOf(r))));
const w3 = sweep.runs.filter((r) => !String(r.status).startsWith('SETUP_FAILED') && r.status !== 'UNOBSERVABLE');

const x1 = w2.filter((r) => isFailure(outcome.get(keyOf(r))));
const x2 = w1.filter((r) => outcome.get(keyOf(r)) === 'PASS');
const x3 = w3.filter((r) => outcome.get(keyOf(r)) !== 'UNOBSERVABLE');
const mismatchDetected = w2.filter((r) => extBy.get(keyOf(r)) === 'OUTPUT_MISMATCH'
  && outcome.get(keyOf(r)) === 'OUTPUT_MISMATCH');

console.log('r4 / V2b — delegated assertion evaluation (development evidence)');
console.log('');
console.log('X1  both reported failure, now detected : ' + x1.length + ' / ' + w2.length
  + '   ' + (x1.length === w2.length ? 'HELD' : 'FAILED'));
console.log('    of which OUTPUT_MISMATCH correctly named: ' + mismatchDetected.length
  + ' / ' + w2.filter((r) => extBy.get(keyOf(r)) === 'OUTPUT_MISMATCH').length);
console.log('X2  W1 recoveries retained             : ' + x2.length + ' / ' + w1.length
  + '   ' + (x2.length === w1.length ? 'HELD' : 'FAILED'));
console.log('X3  nothing became unobservable        : ' + x3.length + ' / ' + w3.length
  + '   ' + (x3.length === w3.length ? 'HELD' : 'FAILED'));
writeFileSync('benchmarks/repoC/r4-v2b.json', JSON.stringify({
  note: 'r4 DEVELOPMENT EVIDENCE, not a prospective result; agreement with doctest is expected by construction and is NOT a finding',
  x1: { n: w2.length, detected: x1.length }, x2: { n: w1.length, retained: x2.length },
  x3: { n: w3.length, kept: x3.length }, mismatchDetected: mismatchDetected.length,
}, null, 1), 'utf8');
console.log('');
console.log('wrote benchmarks/repoC/r4-v2b.json');
