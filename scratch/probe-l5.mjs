import { graph, add, node, entitled, scope, NODE, EDGE } from '../legasus/legaknow/justification.mjs';
const g = graph();
// Two individually valid premises, established under DIFFERENT execution histories.
const e1 = node({ kind: NODE.OBSERVATION, proposition: 'A holds',
  scope: scope({ repository: 'S1', history: 'H1' }), basis: 'EXECUTION_WITNESS' });
const e2 = node({ kind: NODE.OBSERVATION, proposition: 'A implies B',
  scope: scope({ repository: 'S1', history: 'H2' }), basis: 'EXECUTION_WITNESS' });
add(g, e1); add(g, e2);
const c = node({ kind: NODE.CLAIM, proposition: 'therefore B',
  scope: scope({ repository: 'S1' }), basis: 'DERIVATION',
  supports: [{ id: e1.id, edge: EDGE.REQUIRES }, { id: e2.id, edge: EDGE.REQUIRES }] });
add(g, c);

// The consumer does not care about history, so it leaves it unpinned.
const ask = scope({ repository: 'S1' });
const r = entitled(g, c.id, ask);
console.log('query leaves `history` unpinned');
console.log('  premise 1 history: H1');
console.log('  premise 2 history: H2   (no bridge between them)');
console.log('  entitled(therefore B) =', r.ok);
console.log('');
console.log(r.ok
  ? 'L5 HOLE CONFIRMED: authority appeared BETWEEN the edges. Neither premise was invalid, nothing was'
    + '\n  destroyed, no referent moved, nobody self-ratified - and the composite was never true in any'
    + '\n  single world.'
  : 'no hole: the join was refused.');
// Control: pin the history and it must refuse.
console.log('');
console.log('same graph, query pins history=H1 :', entitled(g, c.id, scope({repository:'S1',history:'H1'})).ok);
