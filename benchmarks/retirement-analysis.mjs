// r4 — retirement analysis for the replay path. Predictions frozen in 95bcd70.
//
// This must distinguish UNUSED CODE from OBSOLETE AUTHORITY, so it asks what each symbol PRODUCES and
// whether any live authority-bearing consumer still needs that product - not merely whether a name
// appears somewhere.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['legasus', 'benchmarks'];
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) { if (f !== 'pristine' && f !== 'node_modules') walk(p); }
    else if (p.endsWith('.mjs')) files.push(p);
  }
};
for (const r of ROOTS) walk(r);

// THE CANDIDATES, and what each one PRODUCES. Retirement is judged on the product, not the symbol.
const CANDIDATES = {
  'assertionHeld': {
    produces: 'a hand-rolled reimplementation of doctest output comparison',
    duplicates: 'CPython doctest.OutputChecker',
  },
  'surveyFrontier': {
    produces: 'a capability frontier built from replayed doctests and assertionHeld',
    duplicates: 'the external producer plus adapter',
  },
  'observeSequential': {
    produces: 'sequential execution WITHOUT assertion evaluation',
    duplicates: 'superseded by observeSequentialChecked',
  },
  'observeSequentialChecked': {
    produces: 'sequential execution WITH delegated comparison',
    duplicates: 'doctest discovery and sequencing (comparison itself is delegated)',
  },
};

// NOT candidates, and the reason is the point: these produce something the external producer DOES NOT.
const KEEP = {
  'observeIsolated': 'traced execution SITES. doctest reports verdicts, never which code objects ran.',
  'observe': 'r3\'s witness, retained so the frozen architecture stays reproducible and A/B-comparable.',
  'mineDoctests': 'source-level discovery used to build execution witnesses, not to judge assertions.',
};

const isTest = (p) => p.endsWith('.test.mjs');
const isBenchmark = (p) => p.startsWith('benchmarks');
// An AUTHORITY-BEARING consumer is production code that would lose a capability. Tests and benchmark
// scripts exercise or measure; they do not hold authority.
const authorityBearing = (p) => !isTest(p) && !isBenchmark(p);

const report = {};
for (const [sym, meta] of Object.entries(CANDIDATES)) {
  const users = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // a USE is an import or a call, not a mention in prose
    const imported = new RegExp('import[^;]*\\b' + sym + '\\b[^;]*from').test(src);
    const called = new RegExp('\\b' + sym + '\\s*\\(').test(src);
    const defined = new RegExp('(export\\s+)?(function|const)\\s+' + sym + '\\b').test(src);
    if ((imported || called) && !defined) users.push(f.replace(/\\/g, '/'));
  }
  report[sym] = { ...meta, users,
    authorityBearingUsers: users.filter(authorityBearing),
    testUsers: users.filter(isTest), benchmarkUsers: users.filter(isBenchmark) };
}

console.log('RETIREMENT ANALYSIS — replay path');
console.log('files scanned: ' + files.length);
console.log('');
for (const [sym, r] of Object.entries(report)) {
  console.log(sym);
  console.log('   produces   : ' + r.produces);
  console.log('   duplicates : ' + r.duplicates);
  console.log('   AUTHORITY-BEARING users : ' + (r.authorityBearingUsers.length
    ? r.authorityBearingUsers.join(', ') : 'NONE'));
  console.log('   tests ' + r.testUsers.length + ', benchmarks ' + r.benchmarkUsers.length);
  console.log('');
}

// ---- R6 CONTROL. The analysis must be able to FIND a dependency, or its silence means nothing.
const control = {};
for (const [sym, why] of Object.entries(KEEP)) {
  const users = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const imported = new RegExp('import[^;]*\\b' + sym + '\\b[^;]*from').test(src);
    const called = new RegExp('\\b' + sym + '\\s*\\(').test(src);
    const defined = new RegExp('(export\\s+)?(function|const)\\s+' + sym + '\\b').test(src);
    if ((imported || called) && !defined) users.push(f.replace(/\\/g, '/'));
  }
  control[sym] = { why, users: users.length, authorityBearing: users.filter(authorityBearing).length };
}
console.log('R6 CONTROL — symbols that MUST show dependencies');
for (const [sym, c] of Object.entries(control)) {
  console.log('   ' + sym.padEnd(24) + c.users + ' users   ' + (c.users > 0 ? 'DETECTED' : 'MISSED'));
}
const r6 = Object.values(control).every((c) => c.users > 0);
console.log('   R6 ' + (r6 ? 'HELD - the analysis can see a live dependency'
  : 'FAILED - the analysis is blind and its silence proves nothing'));

// ---- R4. Search for any fallback from producer failure into replay.
// The crude first pass reported R4 FAILED on two hits, and BOTH were inspected before being dismissed.
// external-doctest.mjs:73 is `catch (e) { return null; }` inside the PRODUCER - explicit non-knowledge,
// routed through mustObserve which REFUSES to score - with an `assertionHeld` mention ten lines later in
// a COMMENT. The two classifiers there run side by side deliberately; neither is reached by the other's
// failure. The second hit was this file matching its own source. Comments are now stripped and
// self-matching excluded; the crude result stands in the record.
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .split(/\r?\n/).map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const fallbackHits = [];
for (const f of files) {
  if (isTest(f)) continue;
  if (f.replace(/\\/g, '/').endsWith('benchmarks/retirement-analysis.mjs')) continue;
  const src = stripComments(readFileSync(f, 'utf8'));
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/producerFailed|!\s*\w+\.ok|ok\s*!==\s*true|catch\s*\(/.test(lines[i])) continue;
    const window = lines.slice(i, i + 12).join(' ');
    if (/observeSequential|surveyFrontier|assertionHeld|replay/i.test(window)) {
      fallbackHits.push(f.replace(/\\/g, '/') + ':' + (i + 1));
    }
  }
}
console.log('');
console.log('R4 — fallback from producer failure into replay: '
  + (fallbackHits.length ? 'FOUND ' + fallbackHits.join(', ') : 'NONE FOUND'));

const r1 = Object.values(report).every((r) => r.authorityBearingUsers.length === 0);
console.log('');
console.log('R1 ' + (r1 ? 'HELD - no authority-bearing consumer requires replay evidence'
  : 'FAILED - a live consumer exists and becomes the finding'));
console.log('R4 ' + (fallbackHits.length === 0 ? 'HELD' : 'FAILED'));
console.log('R6 ' + (r6 ? 'HELD' : 'FAILED'));
