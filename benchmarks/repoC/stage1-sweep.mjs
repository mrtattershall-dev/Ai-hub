// REPO C, STAGE 1 — establish what frozen r3 can observe about pyparsing.
//
// Uses ONLY frozen r3 code. If r3 turns out to be unable to represent something pyparsing legitimately
// requires, that is a CAPABILITY or COVERAGE failure and is reported as such. It is NOT apparatus
// invalidity, which is reserved for the measurement machinery preventing the frozen question from being
// asked at all.
import { writeFileSync, readFileSync } from 'node:fs';
import { mineDoctests } from '../../legasus/legaexercise/mine.mjs';
import { observe } from '../../legasus/legaexercise/witness.mjs';

const ROOT = 'benchmarks/repoC/pristine';
const PKG = 'pyparsing';
const OUT = 'benchmarks/repoC/sweep.json';

const t0 = Date.now();
let mined;
try {
  mined = mineDoctests({ rootDir: ROOT, packageName: PKG });
} catch (e) {
  console.log('MINING FAILED: ' + String(e.message).slice(0, 200));
  process.exit(2);
}
console.log('mined ' + mined.length + ' authored doctest examples from ' + PKG);

// What the EXTERNAL verifier can see, for comparison. r3's miner reads the top-level package directory;
// anything it cannot reach is recorded as coverage, not repaired.
const byModule = {};
for (const m of mined) byModule[m.module] = (byModule[m.module] || 0) + 1;
console.log('modules reached by the r3 miner: ' + Object.keys(byModule).length);
for (const [m, n] of Object.entries(byModule).sort((a, b) => b[1] - a[1])) {
  console.log('   ' + m.padEnd(24) + n);
}

const runs = [];
let failedSetup = 0; let unobservable = 0;
for (const ex of mined) {
  const r = observe({ rootDir: ROOT, packageName: PKG, setup: ex.setup, invocation: ex.invocation,
    namespaceModule: ex.dotted });
  if (r === null) {
    unobservable++;
    runs.push({ ex, lines: [], qlines: [], entered: [], enteredq: [], status: 'UNOBSERVABLE' });
    continue;
  }
  if (String(r.status).startsWith('SETUP_FAILED')) failedSetup++;
  runs.push({ ex, lines: r.lines || [], qlines: r.qlines || [], entered: r.entered || [],
    enteredq: r.enteredq || [], status: r.status, foreign: (r.foreignSources || []).length > 0 });
}

const reachedLines = new Set(); const reachedQLines = new Set();
const enteredFns = new Set(); const enteredIds = new Set();
for (const r of runs) {
  for (const l of r.lines) reachedLines.add(l);
  for (const l of (r.qlines || [])) reachedQLines.add(l);
  for (const e of r.entered) enteredFns.add(e);
  for (const e of (r.enteredq || [])) enteredIds.add(e);
}

console.log('');
console.log('ran ' + runs.length + ' examples in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('  setup failures            : ' + failedSetup);
console.log('  unobservable              : ' + unobservable);
console.log('  distinct sites reached    : ' + reachedQLines.size);
console.log('  distinct code objects hit : ' + enteredIds.size
  + '   (name-keyed would have been ' + enteredFns.size + ')');

writeFileSync(OUT, JSON.stringify({
  corpus: PKG, minedCount: mined.length, failedSetup, unobservable,
  reachedLines: [...reachedLines].sort(), reachedQLines: [...reachedQLines].sort(),
  enteredFns: [...enteredFns].sort(), enteredIds: [...enteredIds].sort(),
  runs: runs.map((r) => ({ module: r.ex.module, dotted: r.ex.dotted, owner: r.ex.owner,
    setup: r.ex.setup, invocation: r.ex.invocation, wants: r.ex.wants, status: r.status,
    lines: r.lines, qlines: r.qlines || [], entered: r.entered, enteredq: r.enteredq || [],
    foreign: !!r.foreign })),
}, null, 1), 'utf8');
console.log('wrote ' + OUT);
void readFileSync;
