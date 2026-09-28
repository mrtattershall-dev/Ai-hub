// THE CONTROL THAT OUTCOME 1 DEMANDS — does the shadow graph track the layers, or merely encode their
// answers once?
//
// Agreement on a single evidence set is weak. I wrote both the layers and the adapters, and an adapter
// expressive enough to reproduce a decision procedure is usually expressive enough to reproduce a
// different one. EXPRESSIVENESS IS NOT UNIFICATION.
//
// So: hold the adapters and the algebra FIXED, and vary the EVIDENCE. Drop a random fraction of the mined
// witnesses, recompute the layer's own answer on that reduced evidence, recompute the graph's answer on
// the same reduced evidence, and compare. If the adapter had encoded the answer rather than the function,
// the two would drift apart as soon as the evidence moved.
//
// PREDICTION, frozen before the run:
//   Q1  Agreement stays 100% at every perturbation level for all three layers.
//   Q2  The underlying ANSWERS move substantially - the region shrinks as witnesses are removed. If the
//       answers do NOT move, the perturbation is not exercising anything and Q1 is vacuous.
//
// Q2 is the non-vacuity half, and it is the one that makes Q1 worth anything.
import { readFileSync } from 'node:fs';
import { graph, add, node, invalidate, entitled, scope, NODE, EDGE }
  from '../../legasus/legaknow/justification.mjs';

const sweep = JSON.parse(readFileSync('benchmarks/repoB/sweep.json', 'utf8'));
const classified = JSON.parse(readFileSync('benchmarks/repoB/classified.json', 'utf8'));
const ident = (q) => { const i = q.indexOf('|'); const h = q.lastIndexOf('#');
  return { module: q.slice(0, i), qualname: q.slice(i + 1, h) }; };
const REPO = 'repoB@pristine'; const ENV = 'traced';

// A deterministic PRNG, so a surprising result can be reproduced exactly.
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function runAt(keepFraction, seed) {
  const rand = rng(seed);
  const runs = sweep.runs.filter(() => rand() < keepFraction);

  // ---- L1 admission, on the reduced evidence
  const reachedAt = new Set();
  for (const r of runs) {
    for (const q of (r.qlines || [])) {
      const b = q.indexOf('|'); const c = q.lastIndexOf(':');
      reachedAt.add(q.slice(0, b) + ':' + q.slice(c + 1));
    }
  }
  let a1 = 0; let admitted1 = 0;
  for (const row of classified.rows) {
    const mod = row.file.replace(/\.py$/, '');
    const layerSays = row.line !== undefined && reachedAt.has(mod + ':' + row.line) && !row.method;
    const g = graph();
    const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined',
      implementation: mod + '.' + row.fn });
    const w = node({ kind: NODE.OBSERVATION, proposition: 'the site executes', scope: sc,
      basis: 'EXECUTION_WITNESS' });
    add(g, w);
    if (!(row.line !== undefined && reachedAt.has(mod + ':' + row.line))) {
      invalidate(g, w.id, 'no execution reached this site');
    }
    const env = node({ kind: NODE.ASSUMPTION, proposition: 'inside the r2 envelope', scope: sc,
      basis: 'CAPABILITY_CONTRACT' });
    add(g, env);
    if (row.method) invalidate(g, env.id, 'method editing is outside the envelope');
    const claim = node({ kind: NODE.CLAIM, proposition: 'a repair may be attempted here', scope: sc,
      basis: 'ADMISSION',
      supports: [{ id: w.id, edge: EDGE.REQUIRES }, { id: env.id, edge: EDGE.REQUIRES }] });
    add(g, claim);
    const ok = entitled(g, claim.id, sc).ok;
    if (ok === layerSays) a1++;
    if (layerSays) admitted1++;
  }

  // ---- L2 connectivity, on the reduced evidence
  const ws = runs.map((r) => {
    const mod = r.module.replace(/\.py$/, '');
    const own = (r.enteredq || []).find((q) => {
      const p = ident(q); return p.module === mod && p.qualname === r.owner;
    });
    return { root: own || (mod + '|<doctest>#00000000'), entered: r.enteredq || [] };
  });
  const roots = new Set(ws.filter((w) => ident(w.root).module === 'specifiers').map((w) => w.root));
  const inRegion = new Set(roots);
  let grew = true;
  while (grew) {
    grew = false;
    for (const w of ws) {
      if (!inRegion.has(w.root)) continue;
      for (const e of w.entered) if (!inRegion.has(e)) { inRegion.add(e); grew = true; }
    }
  }
  const subjects = [...new Set(ws.flatMap((w) => w.entered))];
  const reachedBy = new Map();
  for (const w of ws) for (const e of w.entered) {
    if (!reachedBy.has(e)) reachedBy.set(e, new Set());
    reachedBy.get(e).add(w.root);
  }
  const g2 = graph(); const idsFor = new Map();
  for (const s of subjects) {
    const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined', implementation: s });
    const n = node({ kind: NODE.CLAIM, proposition: 'in region: ' + s, scope: sc, basis: 'CONNECTIVITY' });
    add(g2, n); idsFor.set(s, n.id);
  }
  for (const s of subjects) {
    if (roots.has(s)) continue;
    const parents = [...(reachedBy.get(s) || [])].filter((p) => idsFor.has(p) && p !== s);
    if (!parents.length) { invalidate(g2, idsFor.get(s), 'nothing entered it'); continue; }
    const sc = scope({ repository: REPO, environment: ENV, invocation: 'mined', implementation: s });
    const n = node({ kind: NODE.CLAIM, proposition: 'in region: ' + s, scope: sc, basis: 'CONNECTIVITY',
      supports: parents.map((p) => ({ id: idsFor.get(p), edge: EDGE.ANY_OF })) });
    g2.nodes[idsFor.get(s)] = { ...n, id: idsFor.get(s) };
    for (const p of parents) (g2.dependents[idsFor.get(p)] = g2.dependents[idsFor.get(p)] || [])
      .push(idsFor.get(s));
  }
  let a2 = 0; let inRegionCount = 0;
  const ask = scope({ repository: REPO, environment: ENV, invocation: 'mined' });
  for (const s of subjects) {
    const ok = entitled(g2, idsFor.get(s), ask).ok;
    if (ok === inRegion.has(s)) a2++;
    if (inRegion.has(s)) inRegionCount++;
  }

  return { kept: runs.length, a1, n1: classified.rows.length, admitted1,
    a2, n2: subjects.length, inRegionCount };
}

console.log('adapters and algebra held FIXED; the EVIDENCE is varied');
console.log('');
console.log('  keep   runs   L1 agree    L1 admits   L2 agree      region size');
const sizes = [];
for (const [frac, seed] of [[1.0, 1], [0.8, 7], [0.6, 13], [0.4, 29], [0.2, 41], [0.1, 97]]) {
  const r = runAt(frac, seed);
  sizes.push(r.inRegionCount);
  const ok1 = r.a1 === r.n1; const ok2 = r.a2 === r.n2;
  console.log('  ' + String(frac).padEnd(6) + String(r.kept).padStart(5)
    + ('  ' + r.a1 + '/' + r.n1).padEnd(12) + String(r.admitted1).padStart(9)
    + ('    ' + r.a2 + '/' + r.n2).padEnd(14) + String(r.inRegionCount).padStart(8)
    + (ok1 && ok2 ? '' : '   <-- DISAGREEMENT'));
}
console.log('');
const moved = Math.max(...sizes) - Math.min(...sizes);
console.log('Q2 NON-VACUITY: the region size moved from ' + Math.max(...sizes) + ' down to '
  + Math.min(...sizes) + ' (span ' + moved + ').');
console.log(moved > 10
  ? '  The answers genuinely move, so tracking them is a real constraint on the adapter.'
  : '  WARNING: the answers barely moved, so Q1 agreement is close to vacuous.');
