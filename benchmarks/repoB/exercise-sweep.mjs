// REPO B, ATTEMPT 1 APPARATUS PASS — development validation of LegaExercise against the FROZEN 56.
//
// NO INFERENCE RUNS HERE. Attempt 0 admitted zero of 56 candidates and classified 55 of them
// APPARATUS_INVALID, which is not a result about r2 - it is a result about the measuring instrument. The
// question this pass answers is narrower and prior to any model question:
//
//     OF THE BEHAVIOURAL SITES THIS BENCHMARK WANTS TO MUTATE, HOW MANY CAN BE MADE TO EXECUTE AT ALL,
//     USING ONLY EVIDENCE THE REPOSITORY ITSELF AUTHORED?
//
// That number is load-bearing far beyond Repo B. A project ledger that says a capability is VERIFIED can
// only be as honest as the fraction of the project that can be witnessed executing.
import { writeFileSync, readFileSync } from 'node:fs';
import { mineDoctests } from '../../legasus/legaexercise/mine.mjs';
import { observe } from '../../legasus/legaexercise/witness.mjs';

const ROOT = 'benchmarks/repoB/pristine';
const PKG = 'packaging';
const OUT = 'benchmarks/repoB/sweep.json';

const t0 = Date.now();
const mined = mineDoctests({ rootDir: ROOT, packageName: PKG });
console.log('mined ' + mined.length + ' authored doctest examples from ' + PKG);

// THE SWEEP. Every mined example is run under the line tracer. An example that raises is not discarded:
// raising is still reality touching the code, and the lines it executed before raising are real.
const runs = [];
let failedSetup = 0;
let unobservable = 0;
for (const ex of mined) {
  const r = observe({ rootDir: ROOT, packageName: PKG, setup: ex.setup, invocation: ex.invocation,
    namespaceModule: ex.dotted });
  if (r === null) { unobservable++; runs.push({ ex, lines: [], entered: [], status: 'UNOBSERVABLE' }); continue; }
  if (String(r.status).startsWith('SETUP_FAILED')) { failedSetup++; }
  runs.push({ ex, lines: r.lines || [], entered: r.entered || [], status: r.status,
    foreign: (r.foreignSources || []).length > 0 });
}

const reachedLines = new Set();
const enteredFns = new Set();
for (const r of runs) {
  for (const l of r.lines) reachedLines.add(l);
  for (const e of r.entered) enteredFns.add(e);
}

console.log('ran ' + runs.length + ' examples in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('  setup failures : ' + failedSetup);
console.log('  unobservable   : ' + unobservable);
console.log('  distinct lines reached   : ' + reachedLines.size);
console.log('  distinct functions entered: ' + enteredFns.size);

writeFileSync(OUT, JSON.stringify({
  minedCount: mined.length,
  failedSetup, unobservable,
  reachedLines: [...reachedLines].sort(),
  enteredFns: [...enteredFns].sort(),
  runs: runs.map((r) => ({ module: r.ex.module, dotted: r.ex.dotted, owner: r.ex.owner,
    setup: r.ex.setup, invocation: r.ex.invocation, status: r.status,
    lines: r.lines, entered: r.entered, foreign: !!r.foreign })),
}, null, 1), 'utf8');
console.log('wrote ' + OUT);
void readFileSync;
