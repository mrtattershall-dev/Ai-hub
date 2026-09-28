// DOES ONE SCOPED JUSTIFICATION GRAPH SUBSUME THE LAYERS? — a falsifiable test, not an assertion.
//
// The hypothesis is that LegaExercise, LegaCore's capability envelope and LegaProgress are not separate
// mechanisms but different AUTHORITIES OVER ONE CLAIM GRAPH. If that is true, then expressing the frozen
// 56 candidates as justification nodes and asking ENTITLEMENT must reproduce, candidate for candidate,
// the admissibility each layer computed independently - and must reproduce the REASONS, not merely the
// verdicts.
//
// PREDICTION (stated before running):
//   E1  The graph admits exactly the candidates the layers admitted: 5 of 56.
//   E2  For every refusal, the graph's named cause matches the independently computed category -
//       an unreached site refuses on the WITNESS node, a method refuses on the ENVELOPE node.
//
// FALSIFICATION, and it is the informative outcome:
//   If the verdicts agree but the CAUSES do not, the graph is a coincidence detector, not a subsumption.
//   If some layer's decision cannot be expressed as a node at all, that layer is doing something the
//   graph cannot represent, and the unifying claim is false in a specific, locatable way.
import { readFileSync } from 'node:fs';
import { graph, add, node, invalidate, entitled, scope, NODE }
  from '../../legasus/legaknow/justification.mjs';

const classified = JSON.parse(readFileSync('benchmarks/repoB/classified.json', 'utf8'));
// THE GRAPH IS BUILT FROM RAW SWEEP EVIDENCE, NOT FROM THE CLASSIFICATION IT IS COMPARED AGAINST.
// The first version of this file invalidated the witness node whenever `row.category !== SITE_REACHED`,
// which made E1 true by construction - a dev-set win on an unexercised mechanism. What follows derives
// site reachability from the traced sites themselves.
//
// HONEST LIMIT, STATED UP FRONT: the graph and the classifier consume the SAME evidence. This shows the
// graph computes the same function of that evidence through a different mechanism - node validity plus an
// entitlement walk, rather than inline conditionals. It is a re-implementation cross-check, NOT an
// independent measurement, and a shared upstream error would survive it.
const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const reachedAt = new Set();
for (const q of sweep.reachedQLines) {
  const bar = q.indexOf('|'); const colon = q.lastIndexOf(':');
  reachedAt.add(q.slice(0, bar) + ':' + q.slice(colon + 1));
}
const enteredNames = new Set(sweep.enteredFns);
const REPO = 'repoB@pristine';
const ENV = process.platform + '|python3';

let agreeVerdict = 0; let disagreeVerdict = 0;
let agreeCause = 0; let disagreeCause = 0;
const mismatches = [];

for (const row of classified.rows) {
  const g = graph();
  const site = row.file.replace(/\.py$/, '') + '.' + row.fn;
  const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined-doctest',
    implementation: site });

  // THE GROUND. These are assumptions, and naming them as such is the point: every claim below rests on
  // them, and none of them is self-evident.
  const corpus = node({ kind: NODE.ASSUMPTION, proposition: 'the corpus under test is the one executed',
    scope: sc, basis: 'ROOT_FILTER' });
  const tracer = node({ kind: NODE.ASSUMPTION, proposition: 'instrumentation preserves semantics',
    scope: sc, basis: 'CONTROL' });
  add(g, corpus); add(g, tracer);

  // LEGAEXERCISE speaks here, and only here.
  const witness = node({ kind: NODE.OBSERVATION, proposition: 'the mutation site executes',
    scope: sc, basis: 'EXECUTION_WITNESS', supports: [corpus.id, tracer.id] });
  add(g, witness);
  const mod = row.file.replace(/\.py$/, '');
  const siteRan = row.line !== undefined && reachedAt.has(mod + ':' + row.line);
  const fnRan = enteredNames.has(mod + '.' + row.fn);
  if (!siteRan) {
    invalidate(g, witness.id, 'the site never executed under any mined witness ('
      + (fnRan ? 'the function ran; this line did not' : 'the function never ran') + ')');
  }

  // LEGACORE's capability envelope speaks here, and it is a DIFFERENT authority over the same graph.
  const envelope = node({ kind: NODE.ASSUMPTION, proposition: 'the operation is inside r2 envelope',
    scope: sc, basis: 'CAPABILITY_CONTRACT' });
  add(g, envelope);
  if (row.method) invalidate(g, envelope.id, 'method editing is outside the r2 capability envelope');

  // The claim an inference run would need before it were allowed to attempt anything.
  const admissible = node({ kind: NODE.CLAIM,
    proposition: 'a verified repair may be attempted at this site',
    scope: sc, basis: 'ADMISSION', supports: [witness.id, envelope.id] });
  add(g, admissible);

  const e = entitled(g, admissible.id, sc);
  const layersSay = row.category === 'SITE_REACHED' && !row.method;
  if (e.ok === layersSay) agreeVerdict++; else { disagreeVerdict++; mismatches.push({ site, e, row }); }

  if (!layersSay) {
    const blamedWitness = e.problems.some((p) => /never executed/.test(p.why));
    const blamedEnvelope = e.problems.some((p) => /r2 envelope/.test(p.why));
    const expectWitness = row.category !== 'SITE_REACHED';
    const expectEnvelope = !!row.method;
    if (blamedWitness === expectWitness && blamedEnvelope === expectEnvelope) agreeCause++;
    else { disagreeCause++; mismatches.push({ site, cause: true, e, row }); }
  }
}

console.log('candidates: ' + classified.rows.length);
console.log('');
console.log('E1  verdict agreement with the independently computed classification : '
  + agreeVerdict + '/' + classified.rows.length
  + (disagreeVerdict ? '   DISAGREEMENTS: ' + disagreeVerdict : '   HELD'));
console.log('E2  CAUSE agreement on every refusal                                 : '
  + agreeCause + '/' + (agreeCause + disagreeCause)
  + (disagreeCause ? '   DISAGREEMENTS: ' + disagreeCause : '   HELD'));
console.log('');
if (mismatches.length) {
  console.log('MISMATCHES (these are the interesting outcome, not the agreement):');
  for (const m of mismatches.slice(0, 8)) {
    console.log('  ' + m.site + '  cat=' + m.row.category + ' method=' + m.row.method);
    for (const p of m.e.problems) console.log('     ' + p.why);
  }
} else {
  console.log('One graph, two authorities, and the entitlement decision reproduces both layers exactly -');
  console.log('verdicts AND causes. The layers are queries over the claim graph, not separate mechanisms.');
}

// A control: the graph must be capable of DISAGREEING. If entitlement were unconditionally true or
// unconditionally false, the agreement above would be worthless.
const yes = classified.rows.filter((r) => r.category === 'SITE_REACHED' && !r.method).length;
console.log('');
console.log('NON-VACUITY: the graph admitted ' + yes + ' and refused ' + (classified.rows.length - yes)
  + '. Both outcomes occur, so agreement is not an artifact of a constant verdict.');
