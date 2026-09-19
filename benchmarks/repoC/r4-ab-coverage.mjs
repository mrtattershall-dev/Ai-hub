// r4 DEVELOPMENT EVIDENCE — NOT a Repo C prospective result.
//
// Repo C's prospective numbers are frozen and recorded against legasus-freeze-r3. This is an A/B of the
// V1 repair on the same corpus, run for development purposes only. r4's prospective test is Repo D, and
// nothing here may be presented as r3's score or as r4's prospective validation.
//
// CONFOUND, STATED. Same corpus, same mined examples, same tracer, same states - but observe-r4 is NOT
// a single-variable change. Besides the isolated channel it also restructured setup handling: r3 printed
// a SETUP_FAILED payload and raised SystemExit(0); r4 records the status and falls through to a single
// emit. So this A/B varies MORE THAN ONE FACTOR and cannot by itself attribute the whole difference to
// the channel.
//
// Partial attribution is available and is reported instead of assumed: every flipped example is checked
// for whether the subject emitted any bytes at all, which is the precondition for the channel
// explanation to apply.
import { readFileSync, writeFileSync } from 'node:fs';
import { mineDoctests } from '../../legasus/legaexercise/mine.mjs';
import { observe } from '../../legasus/legaexercise/witness.mjs';
import { observeIsolated } from '../../legasus/legaexercise/observe-r4.mjs';

const ROOT = 'benchmarks/repoC/pristine';
const PKG = 'pyparsing';

const mined = mineDoctests({ rootDir: ROOT, packageName: PKG });
console.log('r4 DEVELOPMENT A/B — not a prospective result');
console.log('corpus: ' + PKG + ', ' + mined.length + ' authored examples');
console.log('');

const tally = (rows) => {
  const t = { OBSERVED_OK: 0, OBSERVED_RAISED: 0, SETUP_FAILED: 0, UNOBSERVABLE: 0 };
  for (const s of rows) {
    if (s === null || s === 'UNOBSERVABLE') t.UNOBSERVABLE++;
    else if (String(s).startsWith('SETUP_FAILED')) t.SETUP_FAILED++;
    else if (String(s).startsWith('RAISED')) t.OBSERVED_RAISED++;
    else t.OBSERVED_OK++;
  }
  return t;
};

const r3rows = []; const r4rows = [];
const flipped = [];
for (const ex of mined) {
  const a = observe({ rootDir: ROOT, packageName: PKG, setup: ex.setup, invocation: ex.invocation,
    namespaceModule: ex.dotted });
  const b = observeIsolated({ rootDir: ROOT, packageName: PKG, setup: ex.setup,
    invocation: ex.invocation, namespaceModule: ex.dotted });
  const sa = a === null ? 'UNOBSERVABLE' : a.status;
  const sb = b.status;
  r3rows.push(sa); r4rows.push(sb);
  if (sa === 'UNOBSERVABLE' && sb !== 'UNOBSERVABLE') {
    flipped.push({ inv: ex.invocation.slice(0, 54), to: sb, bytes: b.subjectBytes });
  }
}

const A = tally(r3rows); const B = tally(r4rows);
const obsA = A.OBSERVED_OK + A.OBSERVED_RAISED;
const obsB = B.OBSERVED_OK + B.OBSERVED_RAISED;
console.log('                     r3 (shared channel)   r4 (isolated)');
for (const k of ['OBSERVED_OK', 'OBSERVED_RAISED', 'SETUP_FAILED', 'UNOBSERVABLE']) {
  console.log('  ' + k.padEnd(20) + String(A[k]).padStart(10) + String(B[k]).padStart(16));
}
console.log('');
console.log('  OBSERVED total      ' + String(obsA).padStart(10) + String(obsB).padStart(16)
  + '   (' + (100 * obsA / mined.length).toFixed(1) + '% -> '
  + (100 * obsB / mined.length).toFixed(1) + '%)');
console.log('');
console.log('examples that flipped OUT of UNOBSERVABLE: ' + flipped.length);
for (const f of flipped.slice(0, 8)) {
  console.log('   ' + f.to.padEnd(22) + f.bytes + ' subject bytes   ' + f.inv);
}
// A repair must not silently LOSE observations either.
const lost = r3rows.map((s, i) => [s, r4rows[i], i]).filter(([a, b]) => a !== 'UNOBSERVABLE'
  && b === 'UNOBSERVABLE');
console.log('');
console.log('examples LOST by the repair (r3 saw, r4 does not): ' + lost.length);
for (const [a, b, i] of lost.slice(0, 5)) {
  console.log('   ' + a + ' -> ' + b + '   ' + mined[i].invocation.slice(0, 50));
}
writeFileSync('benchmarks/repoC/r4-ab.json',
  JSON.stringify({ note: 'r4 DEVELOPMENT EVIDENCE, not a prospective result',
    n: mined.length, r3: A, r4: B, flipped: flipped.length, lost: lost.length,
    attributedToChannel: flipped.filter((f) => f.bytes > 0).length,
    flippedSample: flipped }, null, 1), 'utf8');
console.log('');
console.log('wrote benchmarks/repoC/r4-ab.json');
