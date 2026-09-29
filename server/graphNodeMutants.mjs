#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// graphNodeMutants.mjs — is each graph NODE independently falsifiable, on HELD-OUT shapes?
//
//   node server/graphNodeMutants.mjs
//
// Derivation validity is established: the graph adapts across g1/g2/g3 and REFUSES where the page does
// not support a node. DISCRIMINATION is established only on s01. This is the bridge, and Stage 2
// (graph-as-feedback) stays closed until it passes.
//
// THE RULE, unchanged from obligationMutants.mjs: a mutant must FAIL ITS OWNER node, and must leave the
// DECLARED SENTINELS intact. Sentinels are every node not downstream of the owner in the graph's OWN
// `dependsOn` edges - W rests on C, every effect rests on W, and a re-exercise rests on the assertion
// it repeats. Breaking C is EXPECTED to take W and the effects with it; that is recorded as expected
// collateral, not counted against the mutant.
//
// SENSITIVITY FIRST. A hand-written working candidate must cover EVERY node on the shape. Without that,
// no mutant result on that shape means anything: a node nothing can satisfy will "fail" for every
// mutant and look like perfect discrimination.
//
// OWNERS ARE DECLARED BY STEP NUMBER, not by node id. The graph assigns each node its evidence step at
// derivation time; naming the step pins the mutant to the OBSERVATION it is supposed to break, and
// survives the node being renumbered. A mutant whose owner step no node claims is an error, not a pass.
//
// THE SHAPES ARE DELIBERATELY NOT ALL FILTER BUTTONS:
//   g1  a filter button, with a DISTRACTOR #clear-filter already on the page that is not the required
//       control and is wired to nothing
//   g2  a KEYBOARD trigger with no selector at all - derivation refuses C and W, so this shape tests
//       whether the remaining nodes can still be told apart with no surface node in play
//   g3  a filter button on a page whose update path is an ANONYMOUS handler - derivation refuses U
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const NL = String.fromCharCode(10);
const { derive, verify } = await import('./featureGraph.mjs');
const { playCheck } = await import('./playCheck.js');
const { topLevelFunctions, referencedElsewhere } = await import('./editPlanner.mjs');

let passed = 0, failed = 0;
const limits = [];
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

/** Everything transitively downstream of `owner`, from the graph's own edges. */
function dependentsOf(graph, owner) {
  const out = new Set();
  for (let grew = true; grew;) {
    grew = false;
    for (const n of graph.nodes) {
      if (out.has(n.id) || n.id === owner) continue;
      if ((n.dependsOn || []).some((d) => d === owner || out.has(d))) { out.add(n.id); grew = true; }
    }
  }
  return out;
}

// ══ THE CANDIDATES ════════════════════════════════════════════════════════════════════════════════
// Written against each page's own symbol names, which differ per shape by design. `at` is the spec step
// whose observation the mutant is aimed at, declared here before the run.

const SHAPES = [
  {
    name: 'g1', dir: 'legasus/bench/graphvalid/g1',
    working: `const b = document.createElement('button');
b.id = 'reset-filter'; b.textContent = 'Reset';
document.body.appendChild(b);
b.addEventListener('click', function () { field.value = ''; refresh(); });`,
    mutants: [
      { at: 'C', why: 'binds a handler to a control it never creates', code:
`document.getElementById('reset-filter').addEventListener('click', function () { field.value = ''; refresh(); });` },
      { at: 'W', why: 'creates the control and leaves it inert', code:
`const b = document.createElement('button');
b.id = 'reset-filter'; b.textContent = 'Reset';
document.body.appendChild(b);` },
      { at: 3, why: 'empties the field but never re-renders, so the rows stay hidden', code:
`const b = document.createElement('button');
b.id = 'reset-filter'; b.textContent = 'Reset';
document.body.appendChild(b);
b.addEventListener('click', function () { field.value = ''; });` },
      { at: 4, why: 'restores the typed text after clearing: the list comes back, the field is not empty', code:
`const b = document.createElement('button');
b.id = 'reset-filter'; b.textContent = 'Reset';
document.body.appendChild(b);
b.addEventListener('click', function () { const keep = field.value; field.value = ''; refresh(); field.value = keep; });` },
      { at: 6, why: 'works exactly once - the repeat step is the only thing that can catch this', code:
`const b = document.createElement('button');
b.id = 'reset-filter'; b.textContent = 'Reset';
document.body.appendChild(b);
b.addEventListener('click', function once() { field.value = ''; refresh(); b.onclick = null; b.replaceWith(b.cloneNode(true)); });` },
      { at: 2, why: 'the new control is correct, but the page’s own filtering is destroyed outright', code:
`const b = document.createElement('button');
b.id = 'reset-filter'; b.textContent = 'Reset';
document.body.appendChild(b);
b.addEventListener('click', function () { field.value = ''; refresh(); });
field.addEventListener('input', function () { rows.forEach(function (el) { el.style.display = ''; }); });` },
      { at: 5, why: 'filtering works until the new control is used, then the addition detaches it', code:
`const b = document.createElement('button');
b.id = 'reset-filter'; b.textContent = 'Reset';
document.body.appendChild(b);
b.addEventListener('click', function () { field.value = ''; refresh(); field.removeEventListener('input', refresh); });` },
    ],
  },
  {
    name: 'g2', dir: 'legasus/bench/graphvalid/g2',
    working: `document.addEventListener('keydown', function (e) { if (e.key === '0') { at = 0; paint(); } });`,
    mutants: [
      { at: 3, why: 'listens for the key and does nothing observable', code:
`document.addEventListener('keydown', function (e) { if (e.key === '0') { const intended = 0; } });` },
      { at: 4, why: 'the second press moves the page instead of leaving it where it is', code:
`let seen = 0;
document.addEventListener('keydown', function (e) { if (e.key === '0') { seen++; at = seen > 1 ? 1 : 0; paint(); } });` },
      // A PRE-DECLARED LIMIT, not a moved goalpost. On the KEY shape the emitter presses the trigger
      // twice with NOTHING IN BETWEEN, so at step 4 the page is already in the starting state and a
      // handler that has stopped responding is observationally identical to a correct one. This mutant
      // is declared to ESCAPE; it fails this file the day it stops escaping, which would mean the step
      // changed shape. The filter shapes do not have this gap - g1/g3 type text between the two clicks,
      // which is why their `works exactly once` mutants are CAUGHT. NAMED FUTURE WORK: the KEY branch
      // of emitTaskAuto should perturb state between the two presses. Not changed here - g2 is already
      // emitted and under validation, and editing the emitter mid-validation would make this run
      // incomparable with the derivation results it is meant to extend.
      { at: 4, expectEscape: true, why: 'BLIND SPOT: resets once and then stops responding - indistinguishable at this step', code:
`let used = false;
document.addEventListener('keydown', function (e) { if (e.key === '0' && !used) { used = true; at = 0; paint(); } });` },
      { at: 2, why: 'the reset is correct, but the page’s own ArrowRight route is destroyed', code:
`document.addEventListener('keydown', function (e) { if (e.key === '0') { at = 0; paint(); } });
document.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { at = 0; paint(); } });` },
    ],
  },
  {
    name: 'g3', dir: 'legasus/bench/graphvalid/g3',
    working: `const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', function () { box.value = ''; items.forEach(function (el) { el.hidden = false; }); });`,
    mutants: [
      { at: 'C', why: 'binds a handler to a control it never creates', code:
`document.getElementById('clear-filter').addEventListener('click', function () { box.value = ''; });` },
      { at: 'W', why: 'creates the control and leaves it inert', code:
`const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);` },
      { at: 3, why: 'empties the field but never unhides, so the items stay hidden', code:
`const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', function () { box.value = ''; });` },
      { at: 4, why: 'restores the typed text after unhiding: the list comes back, the field is not empty', code:
`const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', function () { const keep = box.value; box.value = ''; items.forEach(function (el) { el.hidden = false; }); box.value = keep; });` },
      { at: 6, why: 'works exactly once - the repeat step is the only thing that can catch this', code:
`const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', function () { box.value = ''; items.forEach(function (el) { el.hidden = false; }); b.replaceWith(b.cloneNode(true)); });` },
      { at: 5, why: 'the new control is correct, but the page’s own filtering is destroyed', code:
`const b = document.createElement('button');
b.id = 'clear-filter'; b.textContent = 'Clear';
document.body.appendChild(b);
b.addEventListener('click', function () { box.value = ''; items.forEach(function (el) { el.hidden = false; }); });
box.addEventListener('input', function () { items.forEach(function (el) { el.hidden = false; }); });` },
    ],
  },
];

for (const shape of SHAPES) {
  if (!existsSync(join(shape.dir, 'task.json'))) { console.log(`${NL}${shape.name}: no task record`); continue; }
  const page = readFileSync(join(shape.dir, 'baseline-as-delivered.html'), 'utf8');
  const task = JSON.parse(readFileSync(join(shape.dir, 'task.json'), 'utf8'));
  const spec = task.diagnostic.spec;
  const graph = derive(page, task, { topLevelFunctions, referencedElsewhere });
  const at = page.lastIndexOf('</script>');
  const splice = (code) => page.slice(0, at) + NL + code + NL + page.slice(at);

  console.log(`${NL}${shape.name}`);
  for (const n of graph.nodes) {
    console.log(`    ${n.id.padEnd(3)} ${n.step !== undefined ? `step ${n.step}` : 'direct '}  ${n.need}`
      + (n.reExerciseOf ? `   [re-exercise of ${n.reExerciseOf}]` : '')
      + ((n.dependsOn || []).length && !n.reExerciseOf ? `   [rests on ${n.dependsOn.join(',')}]` : ''));
  }
  for (const r of graph.refusals) console.log(`    -   REFUSED ${r.id}: ${r.why}`);

  // ── SENSITIVITY. Nothing below means anything without this. ──────────────────────────────────
  const base = await verify(splice(shape.working), { task, spec, graph, deps: { playCheck } });
  say(base.complete, `SENSITIVITY: a working candidate covers every node [${base.covered.join(',')}]`
    + (base.complete ? '' : `  UNREACHABLE: ${base.missing.join(',')}`));
  if (!base.complete) { console.log('    no mutant result on this shape can be trusted; skipping its mutants'); continue; }

  // ── SPECIFICITY, one mutant per node. ────────────────────────────────────────────────────────
  for (const m of shape.mutants) {
    const owner = graph.nodes.find((n) => (typeof m.at === 'number' ? n.step === m.at : n.id === m.at));
    if (!owner) { say(false, `aimed at ${m.at}: NO SUCH NODE - this graph claims no node for that observation`); continue; }
    const v = await verify(splice(m.code), { task, spec, graph, deps: { playCheck } });
    const downstream = dependentsOf(graph, owner.id);
    const sentinels = graph.nodes.filter((n) => n.id !== owner.id && !downstream.has(n.id)).map((n) => n.id);
    const brokenSentinels = sentinels.filter((s) => !v.satisfied[s]);
    const collateral = [...downstream].filter((d) => !v.satisfied[d]);
    const verdict = v.satisfied[owner.id] ? 'ESCAPED' : brokenSentinels.length ? 'OVER-BROAD' : 'CAUGHT';
    if (m.expectEscape) {
      say(verdict === 'ESCAPED', `${owner.id.padEnd(3)} ${verdict === 'ESCAPED' ? 'LIMIT HELD' : 'LIMIT MOVED'} ${m.why}`);
      limits.push(`${shape.name} ${owner.id} (step ${owner.step}): ${m.why.replace(/^BLIND SPOT: /, '')}`);
      continue;
    }
    say(verdict === 'CAUGHT', `${owner.id.padEnd(3)} ${verdict.padEnd(10)} ${m.why}`);
    console.log(`         sentinels [${sentinels.join(',')}]`
      + (brokenSentinels.length ? `  BROKEN ${brokenSentinels.join(',')}` : ' all intact')
      + (collateral.length ? `  + expected collateral ${collateral.join(',')}` : ''));
  }
}

for (const l of limits) console.log(`${NL}  DECLARED LIMIT  ${l}`);
console.log(`${NL}  graph node discrimination: ${passed} passed, ${failed} failed -> ${failed
  ? 'NODES ARE NOT INDEPENDENTLY FALSIFIABLE ON THESE SHAPES; STAGE 2 STAYS CLOSED'
  : 'on three held-out shapes every node fails for its own reason'}`);
process.exit(failed ? 1 : 0);
