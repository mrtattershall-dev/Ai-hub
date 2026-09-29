/**
 * verifierFailClosed.test.mjs — A VERIFIER THAT COULD NOT RUN MUST NOT PRODUCE A VERDICT.
 *
 *   node server/verifierFailClosed.test.mjs
 *
 * Found by reading SWE-bench's harness, not by reading my own. Its grading code carries this comment:
 *
 *     "No parsed results *and* no sign the suite ran: the run is invalid, not a pass ... without this
 *      a suite that never started (e.g. A BROWSER THAT FAILS TO LAUNCH) scores every F2P test as
 *      resolved."
 *
 * That names this apparatus exactly. `playCheck` returns `status: 'UNAVAILABLE'` with EMPTY
 * passing/failing sets when no browser can be found or launched - and nothing downstream read that
 * status. So every node came back unsatisfied and the candidate was REJECTED.
 *
 * That is fail-CLOSED on safety, which is better than the case SWE-bench had to harden against. It is
 * still wrong, and in a way this project has a name for: it BLAMES THE MODEL FOR AN APPARATUS FAILURE.
 * A paid run against a broken browser would have recorded a column of model failures that were mine.
 *
 * The three things pinned here:
 *   1. an unavailable verifier NEVER yields `complete: true`  - no false accept
 *   2. it is DISTINGUISHABLE from a real rejection            - `ran: false`, not just missing nodes
 *   3. a working verifier still says so                       - the positive control, without which
 *                                                               a function returning `ran:false` always
 *                                                               would pass tests 1 and 2
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derive, verify } from './featureGraph.mjs';

const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const { playCheck } = await import('./playCheck.js');
const { observeBaseline } = await import('./behaviorModel.mjs');
const { topLevelFunctions, referencedElsewhere } = await import('./editPlanner.mjs');

const DIR = 'legasus/bench/suppression1/s01';
const page = readFileSync(join(DIR, 'baseline-as-delivered.html'), 'utf8');
const task = JSON.parse(readFileSync(join(DIR, 'task.json'), 'utf8'));
const spec = task.diagnostic.spec;
const at = page.lastIndexOf('</script>');
const WORKS = `const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', function () { field.value = ''; filterRows(); });`;
const candidate = page.slice(0, at) + NL + WORKS + NL + page.slice(at);

/** Exactly what playCheck returns when it cannot find or launch a browser. */
const UNAVAILABLE = async () => ({
  status: 'UNAVAILABLE', reason: 'no Chrome/Edge executable found (PLAYCHECK_BROWSER unset)',
  passing: new Set(), failing: new Set(), total: null, cases: [], log: '',
});

const observation = await observeBaseline(page, task, { playCheck });
const graph = derive(page, task, { topLevelFunctions, referencedElsewhere, observation });

// ══ POSITIVE CONTROL FIRST ════════════════════════════════════════════════════════════════════════
// Without it, a verify() that always reported `ran: false` would pass every other test in this file.
console.log('\npositive control - a real verifier reports that it ran');
{
  const r = await verify(candidate, { task, spec, graph, deps: { playCheck } });
  say(r.ran === true, 'a working browser gives ran: true');
  say(r.complete === true, 'and the working candidate is accepted, so the verifier is genuinely working');
}

console.log('\nan unavailable verifier is not a rejection');
{
  const r = await verify(candidate, { task, spec, graph, deps: { playCheck: UNAVAILABLE } });
  say(r.complete !== true,
    'a KNOWN-GOOD candidate is never accepted when the verifier could not run - no false pass');
  say(r.ran === false,
    'and the caller can TELL: ran is false, rather than the candidate merely looking bad');
  say(typeof r.why === 'string' && r.why.length > 0,
    `with the reason carried, not discarded: ${JSON.stringify(String(r.why).slice(0, 48))}`);
  say(r.missing.length === graph.nodes.length,
    'every node reads as missing, which is exactly why `ran` has to exist - the shape is identical to a total failure');
}

console.log('\nthe two cases are distinguishable, which is the whole point');
{
  const INERT = page.slice(0, at) + NL
    + `const b = document.createElement('button');${NL}b.id = 'clear-filter'; document.body.appendChild(b);` + NL + page.slice(at);
  const real = await verify(INERT, { task, spec, graph, deps: { playCheck } });
  const broken = await verify(candidate, { task, spec, graph, deps: { playCheck: UNAVAILABLE } });
  say(real.ran === true && real.complete === false,
    'a genuinely inert candidate: ran true, complete false - the model did something wrong');
  say(broken.ran === false && broken.complete === false,
    'a broken verifier: ran false, complete false - the apparatus did something wrong');
  say(real.ran !== broken.ran,
    'and nothing but `ran` separates them: both report missing nodes, both report complete false');
}

console.log(`${NL}  verifier fail-closed: ${passed} passed, ${failed} failed -> ${failed
  ? 'AN APPARATUS FAILURE CAN STILL BE RECORDED AS A MODEL FAILURE'
  : 'a verifier that could not run says so, and is never read as a verdict'}`);
process.exit(failed ? 1 : 0);
