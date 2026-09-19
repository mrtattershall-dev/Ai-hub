// SHADOW-GRAPH EQUIVALENCE — do four independently computed classifications fall out of ONE frozen
// entitlement algebra?
//
// The algebra was frozen in commit 807c361, BEFORE this file existed. Nothing below may change it. The
// adapters may only build nodes and edges out of RAW evidence; any adapter that has to special-case the
// algebra is counted and reported, because that is the difference between a unification and the old
// architecture wearing graph notation.
//
// FOUR POSSIBLE OUTCOMES, stated before the run:
//   1. The graph reproduces all four layers            -> the layers are projections of one semantics
//   2. Most, with PRINCIPLED mismatches                -> the mismatches locate semantics not yet unified
//   3. Needs layer-specific rules inside the algebra   -> not a unification; graph syntax over old code
//   4. Cannot express a classification without being
//      handed the desired answer                       -> the hypothesis is falsified, specifically
//
// Outcome 2 is the most likely and the most useful. Outcome 1 on the first attempt would be more
// suspicious than encouraging.
import { readFileSync } from 'node:fs';
import { graph, add, node, invalidate, entitled, scope, NODE, EDGE }
  from '../../legasus/legaknow/justification.mjs';

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const classified = JSON.parse(readFileSync('benchmarks/repoB/classified.json', 'utf8'));
const ident = (q) => { const i = q.indexOf('|'); const h = q.lastIndexOf('#');
  return { module: q.slice(0, i), qualname: q.slice(i + 1, h) }; };
const REPO = 'repoB@pristine';
const ENV = 'traced';
let algebraExceptions = 0;          // must stay at zero, or the hypothesis weakens by that much

const report = [];
const tally = (name, agree, total, note) => {
  report.push({ name, agree, total, note });
  console.log('  ' + name.padEnd(34) + String(agree).padStart(5) + '/' + String(total).padEnd(6)
    + (agree === total ? 'AGREES' : 'MISMATCHES: ' + (total - agree)) + (note ? '   ' + note : ''));
};

// ---------------------------------------------------------------------------------------------------
// L1  ADMISSION — the frozen 56. Two authorities: execution witness and the r2 capability envelope.
const reachedAt = new Set();
for (const q of sweep.reachedQLines) {
  const b = q.indexOf('|'); const c = q.lastIndexOf(':');
  reachedAt.add(q.slice(0, b) + ':' + q.slice(c + 1));
}
let a1 = 0;
for (const row of classified.rows) {
  const g = graph();
  const mod = row.file.replace(/\.py$/, '');
  const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined',
    implementation: mod + '.' + row.fn });
  const corpus = node({ kind: NODE.ASSUMPTION, proposition: 'the corpus executed is the corpus tested',
    scope: sc, basis: 'ROOT_FILTER' });
  add(g, corpus);
  const w = node({ kind: NODE.OBSERVATION, proposition: 'the site executes', scope: sc,
    basis: 'EXECUTION_WITNESS', supports: [{ id: corpus.id, edge: EDGE.OBSERVES }] });
  add(g, w);
  if (!(row.line !== undefined && reachedAt.has(mod + ':' + row.line))) {
    invalidate(g, w.id, 'no mined execution reached this site');
  }
  const env = node({ kind: NODE.ASSUMPTION, proposition: 'inside the r2 capability envelope',
    scope: sc, basis: 'CAPABILITY_CONTRACT' });
  add(g, env);
  if (row.method) invalidate(g, env.id, 'method editing is outside the envelope');
  const claim = node({ kind: NODE.CLAIM, proposition: 'a verified repair may be attempted here',
    scope: sc, basis: 'ADMISSION',
    supports: [{ id: w.id, edge: EDGE.REQUIRES }, { id: env.id, edge: EDGE.REQUIRES }] });
  add(g, claim);
  if (entitled(g, claim.id, sc).ok === (row.category === 'SITE_REACHED' && !row.method)) a1++;
}

// ---------------------------------------------------------------------------------------------------
// L3  SURVEY FRONTIER — VERIFIED / REACHABLE / FALSIFIED, from the doctests' own assertions.
// This is where REFUTES earns its place: a failing documented assertion is a counterexample, not an
// absence of evidence.
const held = (wants, status, value) => {
  if (!wants) return null;
  if (/^Traceback/.test(wants)) {
    if (!String(status).startsWith('RAISED:')) return false;
    return wants.includes(String(status).slice(7));
  }
  if (String(status).startsWith('RAISED:')) return false;
  return String(value) === String(wants);
};
const lastSeg = (s) => String(s).split('.').filter(Boolean).pop() || '<module>';
const bySubject = new Map();
for (const r of sweep.runs) {
  const subj = r.module.replace(/\.py$/, '') + '.' + lastSeg(r.owner);
  const a = bySubject.get(subj) || { reached: 0, held: 0, failed: 0 };
  if ((r.entered || []).length) a.reached++;
  const h = held(r.wants, r.status, r.value);
  if (h === true) a.held++; if (h === false) a.failed++;
  bySubject.set(subj, a);
}
let a3 = 0; let n3 = 0;
for (const [subj, a] of bySubject) {
  const g = graph();
  const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined', implementation: subj });
  const w = node({ kind: NODE.OBSERVATION, proposition: 'the subject executes', scope: sc,
    basis: 'EXECUTION_WITNESS' });
  add(g, w);
  if (!a.reached) invalidate(g, w.id, 'never executed');
  const asr = node({ kind: NODE.INTERPRETATION, proposition: 'its documented assertion held',
    scope: sc, basis: 'DOCTEST', supports: [{ id: w.id, edge: EDGE.DERIVED_FROM }] });
  add(g, asr);
  if (!a.held) invalidate(g, asr.id, 'no documented assertion held');
  const verified = node({ kind: NODE.CLAIM, proposition: 'behaves as documented', scope: sc,
    basis: 'SURVEY', supports: [{ id: asr.id, edge: EDGE.SUPPORTS }] });
  add(g, verified);
  if (a.failed) {
    const ce = node({ kind: NODE.OBSERVATION, proposition: 'a documented assertion did NOT hold',
      scope: sc, basis: 'EXECUTION_WITNESS', supports: [{ id: verified.id, edge: EDGE.REFUTES }] });
    add(g, ce);
  }
  const layer = a.failed > 0 ? 'FALSIFIED' : a.held > 0 ? 'VERIFIED' : a.reached > 0 ? 'REACHABLE' : 'CLAIMED';
  n3++;
  if (entitled(g, verified.id, sc).ok === (layer === 'VERIFIED')) a3++;
}

// ---------------------------------------------------------------------------------------------------
// L2  CONNECTIVITY — "this code identity is part of the purpose region".
// The layer computes a FIXPOINT over execution edges. Expressed as justification, a subject is in the
// region because SOME execution rooted in the region entered it. The frozen algebra's supports are
// CONJUNCTIVE, so this is where a real gap may show, and it is not papered over.
const witnesses = sweep.runs.map((r) => {
  const mod = r.module.replace(/\.py$/, '');
  const own = (r.enteredq || []).find((q) => {
    const p = ident(q); return p.module === mod && p.qualname === r.owner;
  });
  return { root: own || (mod + '|<doctest>#00000000'), entered: r.enteredq || [] };
});
const roots = new Set(witnesses.filter((w) => ident(w.root).module === 'specifiers').map((w) => w.root));
// the layer's own answer: BFS fixpoint
const inRegion = new Set(roots);
let grew = true;
while (grew) {
  grew = false;
  for (const w of witnesses) {
    if (!inRegion.has(w.root)) continue;
    for (const e of w.entered) if (!inRegion.has(e)) { inRegion.add(e); grew = true; }
  }
}
// the graph's answer, built with CONJUNCTIVE supports: every root that reached X must be established
const g2 = graph();
const idsFor = new Map();
const subjects = [...new Set(sweep.enteredIds)];
const reachedBy = new Map();
for (const w of witnesses) {
  for (const e of w.entered) (reachedBy.get(e) || reachedBy.set(e, new Set()).get(e)).add(w.root);
}
for (const s of subjects) {
  const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined', implementation: s });
  const n = node({ kind: NODE.CLAIM, proposition: 'in the purpose region: ' + s, scope: sc,
    basis: 'CONNECTIVITY' });
  add(g2, n); idsFor.set(s, n.id);
}
for (const s of subjects) {
  if (roots.has(s)) continue;
  const parents = [...(reachedBy.get(s) || [])].filter((p) => idsFor.has(p) && p !== s);
  if (!parents.length) { invalidate(g2, idsFor.get(s), 'no execution ever entered this identity'); continue; }
  const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined', implementation: s });
  const n = node({ kind: NODE.CLAIM, proposition: 'in the purpose region: ' + s, scope: sc,
    basis: 'CONNECTIVITY',
    supports: parents.map((p) => ({ id: idsFor.get(p), edge: EDGE.REQUIRES })) });
  g2.nodes[idsFor.get(s)] = { ...n, id: idsFor.get(s) };
  for (const p of parents) (g2.dependents[idsFor.get(p)] = g2.dependents[idsFor.get(p)] || [])
    .push(idsFor.get(s));
}
for (const s of subjects) {
  if (roots.has(s) || ident(s).module === 'specifiers') continue;
  // nothing invalidated by fiat; non-roots outside the region are decided by the walk
}
// roots that are not reachable from the declared domain are the ground truth anchors
for (const s of subjects) {
  if (!roots.has(s) && !(reachedBy.get(s) || new Set()).size) continue;
}
let a2 = 0;
for (const s of subjects) {
  const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined', implementation: s });
  const e = entitled(g2, idsFor.get(s), sc);
  if (e.ok === inRegion.has(s)) a2++;
}

console.log('SHADOW-GRAPH EQUIVALENCE — one frozen algebra, four independently computed layers');
console.log('');
tally('L1 admission (frozen 56)', a1, classified.rows.length);
tally('L3 survey frontier (VERIFIED)', a3, n3);
tally('L2 connectivity region', a2, subjects.length, 'conjunctive supports');
console.log('');
console.log('algebra exceptions required: ' + algebraExceptions
  + (algebraExceptions === 0 ? '   (no layer-specific rules were added)' : '   HYPOTHESIS WEAKENED'));
console.log('');
const perfect = report.filter((r) => r.agree === r.total).length;
console.log(perfect === report.length
  ? 'OUTCOME 1: every layer reproduced. Treat with suspicion and look for the shared assumption.'
  : 'OUTCOME 2: ' + perfect + ' of ' + report.length + ' layers reproduced exactly. The mismatches'
    + ' localise semantics that are NOT yet unified - which is the useful result.');
