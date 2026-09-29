/**
 * featureGraph.test.mjs — the coverage map must discriminate, or it is a second model judging vibes.
 *
 *   node server/featureGraph.test.mjs
 *
 * Four candidates whose node coverage should differ in known ways. The INERT one is the important case:
 * it satisfies C and must fail W, which is the distinction no code-reading checker can make.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { derive, verify } from './featureGraph.mjs';

const NL = String.fromCharCode(10);
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const { playCheck } = await import('./playCheck.js');
const { topLevelFunctions, referencedElsewhere } = await import('./editPlanner.mjs');
const { observeBaseline } = await import('./behaviorModel.mjs');

const DIR = 'legasus/bench/suppression1/s01';
const page = readFileSync(join(DIR, 'baseline-as-delivered.html'), 'utf8');
const task = JSON.parse(readFileSync(join(DIR, 'task.json'), 'utf8'));
const spec = task.diagnostic.spec;
const at = page.lastIndexOf('</script>');
const splice = (code) => page.slice(0, at) + NL + code + NL + page.slice(at);

// ══ SAFEGUARD 1: the graph is derived from the baseline alone ═══════════════════════════════════
console.log('\nsafeguard 1 - derived before any candidate exists');
const observation = await observeBaseline(page, task, { playCheck });
const graph = derive(page, task, { topLevelFunctions, referencedElsewhere, observation });
say(derive.length === 3, 'derive() takes (page, task, deps) - there is no candidate parameter to pass');
say(!!observation.perturbation, `the baseline was observed: ${JSON.stringify(observation.perturbation && observation.perturbation.action)} leaves the claim's target state`);
console.log('  nodes: ' + graph.nodes.map((n) => `${n.id}(${n.kind})`).join(' '));
say(graph.missingAtBaseline.join(',') === 'C,W', `missing at baseline: ${graph.missingAtBaseline.join(',')}`);
say(graph.nodes.some((n) => n.id === 'U' && n.need.includes('filterRows')), 'the existing update route was found by analysis');

// ══ SAFEGUARD 2: every node settled by running the page ════════════════════════════════════════
console.log('\nsafeguard 2 - coverage settled by observation');

const WORKS = `const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', function () { field.value = ''; filterRows(); });`;
const INERT = `const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', function () { const intended = ''; });`;
const HANDLER_ONLY = `document.getElementById('clear-filter').addEventListener('click', function () { field.value = ''; filterRows(); });`;
const COMMENTS = `// I would createElement a button with id="clear-filter" and addEventListener on it`;

const results = {};
for (const [name, code] of [['works', WORKS], ['inert', INERT], ['handlerOnly', HANDLER_ONLY], ['comments', COMMENTS]]) {
  results[name] = await verify(splice(code), { task, spec, graph, deps: { playCheck } });
  console.log(`  ${name.padEnd(12)} covered [${results[name].covered.join(',')}]  missing [${results[name].missing.join(',')}]`);
}

say(results.works.complete, 'a WORKING candidate covers every node');
say(results.inert.satisfied.C === true, 'an INERT control satisfies C - the control really does exist');
say(results.inert.satisfied.W === false, 'and fails W - clicking it changes nothing. This is the distinction reading code cannot make.');
say(results.handlerOnly.satisfied.C === false, 'a HANDLER bound to a control never created fails C');
say(results.comments.satisfied.C === false && results.comments.satisfied.W === false, 'a COMMENTS-ONLY candidate covers neither C nor W');
say(results.comments.covered.length < results.works.covered.length, 'and covers strictly fewer nodes than a working one');
say(results.inert.covered.length > results.comments.covered.length
  && results.inert.covered.length < results.works.covered.length,
  `the map ORDERS them: comments ${results.comments.covered.length} < inert ${results.inert.covered.length} < works ${results.works.covered.length}`);

console.log(`\n  feature-graph checker: ${passed} passed, ${failed} failed -> ${failed ? 'IT DOES NOT DISCRIMINATE' : 'node coverage separates working, inert, handler-only and prose'}`);
process.exit(failed ? 1 : 0);
