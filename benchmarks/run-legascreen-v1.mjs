// LEGASCREEN v1 — one harness, three probes, pointed at any tree.
//
//     node benchmarks/run-legascreen-v1.mjs [targetDir]
//
// The harness does enumeration, exercise, coverage accounting and the UNSCREENED report. The probes
// state invariants. Nothing here names a defect, a file to suspect, or a commit.
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { probeAlias, probeComposition, probeErasureOver } from '../legasus/legascreen/probes.mjs';

const target = resolve(process.argv[2] || '.');
const say = (...a) => console.log(...a);
const results = [];

// ---- P-ERASURE. The driver composes stopping.mjs the way quiesce-check does, and knows nothing else.
try {
  const stopping = await import(pathToFileURL(join(target, 'legasus/legaknow/stopping.mjs')).href);
  const seeds = {};
  const put = (n, v) => { if (v && typeof v === 'object') seeds[n] = () => v; };
  const closed = stopping.evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] });
  put('frontier.closed', closed);
  const quiescent = stopping.contestState({ frontier: closed, investigations: [] });
  put('contest.quiescent', quiescent);
  put('contest.withObjective', stopping.contestState({ frontier: closed, investigations: [
    { name: 'x', authorized: true, executable: true, targetsDistinction: true,
      canChangeEntitlement: true }] }));
  put('objectives', stopping.objectivesFromContest(quiescent));
  results.push({ name: 'P-ERASURE  (stopping.mjs)',
    ...probeErasureOver({ exports: stopping, seeds, moduleName: 'stopping' }) });
} catch (e) {
  results.push({ name: 'P-ERASURE  (stopping.mjs)', positives: [], examined: 0,
    unscreened: [{ fn: 'stopping.mjs', why: 'not usable in this tree: ' + e.message }] });
}

// ---- P-ALIAS and P-COMPOSITION, over whatever the tree contains.
results.push({ name: 'P-ALIAS    (legaknow state words)', ...probeAlias({ target }) });
results.push({ name: 'P-COMPOSITION (generated 3-node chains)', ...await probeComposition({ target }) });

say('LEGASCREEN v1');
say('  target : ' + target);
say('');
let total = 0;
for (const r of results) {
  total += r.positives.length;
  say(r.name);
  say('  positives : ' + r.positives.length + '   examined : ' + r.examined
    + '   unscreened : ' + r.unscreened.length);
  for (const p of r.positives) {
    say('    * ' + (p.subject || p.fn) + (p.lost ? '   lost: ' + p.lost.join(', ') : '')
      + (p.owners ? '   owners: ' + p.owners.join(', ') : ''));
  }
  for (const u of r.unscreened) say('    UNSCREENED  ' + u.fn + ' - ' + u.why);
  say('');
}
say('TOTAL SCREEN POSITIVES: ' + total);
say('  Positives are SUSPICIONS for a diagnostic, never verdicts. UNSCREENED is the part of the');
say('  surface a probe never examined, and a clean list says nothing about it.');
