// HISTORICAL — NON-RUNNABLE. The replay implementation this script exercised was RETIRED in the r4
// replay retirement (benchmarks/RETIREMENT.md). The script is kept because its RESULT is part of the
// record and the reasoning that produced it must remain auditable; it is not kept because it still runs.
// The evidence it produced is preserved and provenance-stamped in benchmarks/PROVENANCE.json.
//
// r4 / V2 — does making the execution model explicit recover the 8 wrong entailments?
//
// r4 DEVELOPMENT EVIDENCE. Repo C's prospective numbers against legasus-freeze-r3 are unchanged.
//
// Repo C isolated the defect exactly: r3's stated reason was right 57/57 (a preceding example really did
// fail) while the ENTAILMENT was wrong 8 times - r3 concluded the example could not become an experiment,
// and doctest ran those 8 successfully.
//
// PREDICTIONS, FROZEN BEFORE THE RUN:
//   W1  the 8 cases r3 called SETUP_FAILED while the external verifier PASSED become OBSERVED under
//       SEQUENTIAL_SHARED. If they do not, the execution model is not the cause and the V2 diagnosis is
//       wrong.
//   W2  the 44 cases where BOTH r3 and the external verifier reported failure STILL fail under
//       SEQUENTIAL_SHARED. If the new model rescues those too it is not modelling doctest, it is just
//       more permissive - which would be a worse defect than the one being repaired.
//   W3  NO example observable under RECONSTRUCTED_PREFIX becomes unobservable under SEQUENTIAL_SHARED.
//
// W2 is the control that matters. A model that turns every failure into a success would satisfy W1
// perfectly and be useless.
import { readFileSync, writeFileSync } from 'node:fs';
import { observeSequential, MODEL } from '../../legasus/legaexercise/observe-r4.mjs';

const ROOT = 'benchmarks/repoC/pristine';
const PKG = 'pyparsing';

const sweep = JSON.parse(readFileSync('benchmarks/repoC/sweep.json', 'utf8'));
const extRaw = JSON.parse(readFileSync('benchmarks/repoC/external.json', 'utf8'));
const extBy = new Map();
for (const x of extRaw) {
  if (x.source) extBy.set(x.module.split('.').pop() + '|' + String(x.source).trim(), x.outcome);
}
const keyOf = (r) => r.module.replace(/\.py$/, '') + '|' + r.invocation.trim();

// Group the corpus into docstrings, which is the unit SEQUENTIAL_SHARED operates on.
const groups = new Map();
for (const r of sweep.runs) {
  const g = r.dotted + '|' + String(r.owner);
  if (!groups.has(g)) groups.set(g, { dotted: r.dotted, rows: [] });
  groups.get(g).rows.push(r);
}
console.log('docstring groups: ' + groups.size + ' over ' + sweep.runs.length + ' examples');

const seqStatus = new Map();
for (const [, g] of groups) {
  const examples = g.rows.map((r) => r.invocation);
  const out = observeSequential({ rootDir: ROOT, packageName: PKG, dotted: g.dotted, examples });
  if (out.unobservable || out.importFailed) {
    for (const r of g.rows) seqStatus.set(keyOf(r), 'UNOBSERVABLE');
    continue;
  }
  for (let i = 0; i < g.rows.length; i++) {
    const res = out.results[i];
    seqStatus.set(keyOf(g.rows[i]), res ? res.status : 'UNOBSERVABLE');
  }
}

const observedUnderSeq = (s) => s !== undefined && s !== 'UNOBSERVABLE';

// The three cohorts, recomputed from the frozen artifacts rather than hand-listed.
const cohort = { w1: [], w2: [], w3: [] };
for (const r of sweep.runs) {
  const k = keyOf(r);
  const ext = extBy.get(k);
  const r3Setup = String(r.status).startsWith('SETUP_FAILED');
  const r3Observed = !r3Setup && r.status !== 'UNOBSERVABLE';
  if (r3Setup && ext === 'PASS') cohort.w1.push(r);
  if (r3Setup && (ext === 'UNEXPECTED_EXCEPTION' || ext === 'OUTPUT_MISMATCH')) cohort.w2.push(r);
  if (r3Observed) cohort.w3.push(r);
}

const w1ok = cohort.w1.filter((r) => observedUnderSeq(seqStatus.get(keyOf(r))));
const w1clean = w1ok.filter((r) => seqStatus.get(keyOf(r)) === 'OK');
const w2stillFails = cohort.w2.filter((r) => {
  const s = seqStatus.get(keyOf(r));
  return s === undefined || s === 'UNOBSERVABLE' || String(s).startsWith('RAISED');
});
const w3kept = cohort.w3.filter((r) => observedUnderSeq(seqStatus.get(keyOf(r))));

console.log('');
console.log('W1  r3 SETUP_FAILED while external PASSED : ' + cohort.w1.length);
console.log('    now OBSERVED under SEQUENTIAL_SHARED  : ' + w1ok.length
  + '   (of which status OK: ' + w1clean.length + ')');
console.log('    ' + (w1ok.length === cohort.w1.length ? 'HELD' : 'FAILED'));
console.log('');
console.log('W2  both r3 and external reported failure : ' + cohort.w2.length);
console.log('    STILL failing under SEQUENTIAL_SHARED : ' + w2stillFails.length);
console.log('    ' + (w2stillFails.length === cohort.w2.length ? 'HELD'
  : 'FAILED - the new model is more permissive, not more faithful'));
console.log('');
console.log('W3  observable under RECONSTRUCTED_PREFIX : ' + cohort.w3.length);
console.log('    still observable under the new model  : ' + w3kept.length);
console.log('    ' + (w3kept.length === cohort.w3.length ? 'HELD' : 'FAILED - the repair lost evidence'));

writeFileSync('benchmarks/repoC/r4-v2.json', JSON.stringify({
  note: 'r4 DEVELOPMENT EVIDENCE, not a prospective result',
  models: MODEL,
  w1: { n: cohort.w1.length, observed: w1ok.length, ok: w1clean.length },
  w2: { n: cohort.w2.length, stillFails: w2stillFails.length },
  w3: { n: cohort.w3.length, kept: w3kept.length },
  w1cases: cohort.w1.map((r) => ({ inv: r.invocation.slice(0, 70),
    seq: seqStatus.get(keyOf(r)) })),
}, null, 1), 'utf8');
console.log('');
console.log('wrote benchmarks/repoC/r4-v2.json');
