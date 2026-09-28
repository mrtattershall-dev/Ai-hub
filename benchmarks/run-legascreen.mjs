// LEGASCREEN v0 — the runner. Points the erasure screen at a target tree and prints what it found,
// what it examined, and what it never looked at, in that order.
//
//     node benchmarks/run-legascreen.mjs [targetDir]
//
// THE HAND-AUTHORED PART IS THE DRIVER, AND ONLY THE DRIVER. It composes the module the way
// quiesce-check composes it - frontier, then contest, then objectives - and knows nothing about any
// defect. Which functions get screened is mechanical (every export), and the invariant is declared in
// erasure.mjs from the laws. That split is the whole claim: if the screen only finds what its author
// aimed it at, it is not a screen.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { screen } from '../legasus/legascreen/erasure.mjs';

const target = resolve(process.argv[2] || '.');
const url = (rel) => pathToFileURL(resolve(target, rel)).href;

const stopping = await import(url('legasus/legaknow/stopping.mjs'));

// A NORMAL WORKLOAD. Exactly the composition a caller performs, with nothing defect-shaped in it.
const corpus = {};
const add = (name, v) => { if (v && typeof v === 'object') corpus[name] = () => v; };

const closedFrontier = stopping.evidenceFrontier({ requiredProducers: ['t'], attempted: ['t'] });
const openFrontier = stopping.evidenceFrontier({ requiredProducers: ['t', 'u'], attempted: ['t'] });
add('frontier.closed', closedFrontier);
add('frontier.open', openFrontier);

const quiescent = stopping.contestState({ frontier: closedFrontier, investigations: [] });
const contested = stopping.contestState({ frontier: closedFrontier, investigations: [
  { name: 'typecheck', authorized: true, executable: true, targetsDistinction: true,
    canChangeEntitlement: true }] });
add('contest.quiescent', quiescent);
add('contest.withObjective', contested);

add('objectives.fromQuiescent', stopping.objectivesFromContest(quiescent));
add('action.none', stopping.nextAction({ candidates: [{ name: 'a', justified: false }] }));
add('investigation.verdict', stopping.investigationJustified({ name: 'x', authorized: true,
  executable: true, targetsDistinction: true, canChangeEntitlement: true }));

const result = await screen({
  modules: [{ name: 'stopping', url: url('legasus/legaknow/stopping.mjs') }],
  seeds: corpus,
});

const say = (...a) => console.log(...a);
say('LEGASCREEN v0 - erasure');
say('  target : ' + target);
say('');
say('SCREEN POSITIVES (suspicions for a diagnostic, never verdicts): ' + result.positives.length);
for (const p of result.positives) {
  say('  ' + p.fn + '   lost: ' + p.lost.join(', '));
  say('      via seed(s): ' + p.seeds.join(', '));
  say('      ' + p.why);
}
if (!result.positives.length) say('  none');
say('');
say('COVERAGE');
say('  exported functions     : ' + result.coverage.functions);
say('  reached by the corpus  : ' + result.coverage.screened);
say('  NEVER CALLED           : ' + result.coverage.neverCalled);
say('  (function, seed) calls : ' + result.coverage.exercisedCalls);
say('');
say('UNSCREENED - not flagged here means NOT EXAMINED');
for (const u of result.unscreened) say('  ' + u.fn);
say('');
say('  ' + result.why);
