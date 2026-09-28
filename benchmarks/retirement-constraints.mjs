// r4 — RETIREMENT ANALYSIS for the unimported constraints revisions (composition wave 3, W3-g).
//
// RETIREMENT_PREREG.md's questions, applied mechanically and printed with their evidence, so that
// "grep found no callers" is not the answer. R6 is the control: the scanner must report a REAL live
// dependency (constraints6 <- conformance.mjs) as LIVE, or a scanner that always says "unused" has
// produced a beautiful retirement and established nothing.
//
//     R1  no live authority-bearing consumer requires the file        static import scan, non-test
//     R2  removing it cannot reduce supported evidence                 the conformance audit imports rev 6
//     R3  historical artifacts stay interpretable                      PROVENANCE names implementations,
//                                                                       never these files
//     R4  no dynamic import or fallback routes to it                    string scan for the basename
//     R6  the scanner detects a real dependency                         constraints6, opfacts must read LIVE
import { readFileSync, readdirSync, statSync } from 'node:fs';

import { existsSync } from 'node:fs';

// The candidate list as it stood when the analysis was run. A candidate that has since been retired is
// reported as such rather than analysed as if it were still there - the scanner describes the tree,
// not the list.
const CANDIDATES_DECLARED = ['legasus/legacore/constraints.mjs', 'legasus/legacore/constraints2.mjs',
  'legasus/legacore/constraints4.mjs', 'legasus/legacore/constraints5.mjs',
  'legasus/legacore/opcontext2.mjs', 'legasus/legacore/score-constraints.mjs'];
const CANDIDATES = CANDIDATES_DECLARED.filter((c) => existsSync(c));
for (const c of CANDIDATES_DECLARED) {
  if (!existsSync(c)) console.log('  RETIRED already: ' + c + '  (retrievable in git history)');
}
const CONTROLS = ['legasus/legacore/constraints6.mjs', 'legasus/legacore/opfacts.mjs'];

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = d + '/' + f;
    if (statSync(p).isDirectory()) { if (!/node_modules|\.git|pristine|__pycache__/.test(f)) walk(p); }
    else if (/\.(mjs|js)$/.test(f)) files.push(p);
  }
};
walk('legasus'); walk('benchmarks');

// R4 IS ANSWERED BY A STRING SCAN, NOT AN IMPORT SCAN. The first version of this file scanned for
// `import(` and reported score-constraints.mjs as retirable; it loads its deriver from argv with
// './constraints.mjs' as the DEFAULT - a dynamic path through a variable that no import scan sees.
// Found by hand, after a disagreement with a plain grep. Any file that carries the basename as a
// string is now reported: a code file is a LIVE reference, a frozen record or document is a NAMING.
const walkAll = (d, into) => {
  for (const f of readdirSync(d)) {
    const p = d + '/' + f;
    if (statSync(p).isDirectory()) { if (!/node_modules|\.git|pristine|__pycache__/.test(f)) walkAll(p, into); }
    else into.push(p);
  }
};
const everything = [];
walkAll('legasus', everything); walkAll('benchmarks', everything);
try { walkAll('measurements', everything); } catch (e) { /* not every checkout has it */ }

const base = (p) => p.split('/').pop();
const importers = (target) => {
  const b = base(target);
  const out = { live: [], test: [], dynamic: [], named: [] };
  for (const f of files) {
    if (f === target) continue;
    const src = readFileSync(f, 'utf8');
    const staticRe = new RegExp("from\\s+['\"][^'\"]*/" + b.replace('.', '\\.') + "['\"]");
    if (staticRe.test(src)) (f.includes('.test.') ? out.test : out.live).push(f);
  }
  for (const f of everything) {
    if (f === target || f.endsWith('retirement-constraints.mjs') || /COMPOSITION_PREREG_3|RESULT\.composition-3/.test(f)) continue;
    let src; try { src = readFileSync(f, 'utf8'); } catch (e) { continue; }
    if (!src.includes(b)) continue;
    if (/\.(mjs|js)$/.test(f) && !out.live.includes(f) && !out.test.includes(f)) out.dynamic.push(f);
    else if (!/\.(mjs|js)$/.test(f)) out.named.push(f);
  }
  return out;
};

// Consumers of a candidate's importers matter too: score-constraints.mjs imports constraints.mjs, so
// constraints.mjs is only dead if score-constraints.mjs is dead. Closed transitively over the set.
const report = {};
for (const c of [...CANDIDATES, ...CONTROLS]) report[c] = importers(c);
const deadSet = new Set(CANDIDATES);
let changed = true;
while (changed) {
  changed = false;
  for (const c of CANDIDATES) {
    if (!deadSet.has(c)) continue;
    const liveOutsideSet = report[c].live.filter((f) => !deadSet.has(f));
    if (liveOutsideSet.length || report[c].dynamic.length) { deadSet.delete(c); changed = true; }
  }
}

const prov = readFileSync('benchmarks/PROVENANCE.json', 'utf8');
const say = (...a) => console.log(...a);
say('RETIREMENT ANALYSIS - constraints revisions');
say('');
let ok = true;
for (const c of CANDIDATES) {
  const r = report[c];
  const dead = deadSet.has(c);
  const named = prov.includes(base(c));
  say('  ' + (dead ? 'RETIRABLE ' : 'LIVE      ') + c);
  say('      R1 live importers   : ' + (r.live.length ? r.live.join(', ') : 'none'));
  say('      R4 code referencing it as a STRING (dynamic path): '
    + (r.dynamic.length ? r.dynamic.join(', ') : 'none'));
  say('      R3 named in PROVENANCE.json by file: ' + named);
  say('      named by records/docs: ' + (r.named.length ? r.named.join(', ') : 'none'));
  say('      test importers      : ' + (r.test.length ? r.test.join(', ') : 'none'));
  if (!dead || named) ok = false;
}
say('');
say('  R2 the conformance audit imports: '
  + (readFileSync('legasus/legalabs/conformance.mjs', 'utf8').includes('constraints6.mjs')
    ? 'constraints6.mjs (supported evidence does not depend on a candidate)' : 'NOT rev 6 - STOP'));
say('');
say('  R6 CONTROL - a real dependency must read LIVE:');
for (const c of CONTROLS) {
  const r = report[c];
  const live = r.live.length > 0;
  say('      ' + (live ? 'LIVE      ' : 'NOT DETECTED - the scanner is broken') + c + '  <- '
    + r.live.join(', '));
  if (!live) ok = false;
}
say('');
const retirable = CANDIDATES.filter((c) => deadSet.has(c) && !prov.includes(base(c)));
say(ok ? 'VERDICT: every candidate is RETIRABLE under R1-R4, and R6 shows the scanner can see a live dependency.'
  : 'VERDICT: NOT every candidate is retirable, or the control failed. Only the RETIRABLE lines above'
    + ' may be deleted, and only if R6 read LIVE for both controls.');
say('  retirable now: ' + (retirable.length ? retirable.map(base).join(', ') : 'none'));
process.exitCode = ok ? 0 : 1;
