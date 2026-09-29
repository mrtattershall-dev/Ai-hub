'use strict';
// RD-001 (finally MEASURED) — world representation vs the AI query workload.
//
// RD-001 has been "scene tree, provisional, only reasoned about" the whole
// time. This measures it. The load-bearing question isn't "what's prettiest to
// author" — it's "how much work does the AI's real query mix cost?" The AI
// asks RELATIONSHIP questions: all-of-type, children-of, who-references-Z.
//
// We build the SAME world two ways and count WORK DETERMINISTICALLY (nodes
// touched), not wall-clock — same anti-noise discipline as RD-008. Zero deps.

const N = 10000;

// Build a synthetic world: a shallow containment tree + cross references.
// ids 0..N-1; parent = id>>3 (8-way tree); type cycles; each refs one other.
function spec(id) {
  return {
    id,
    type: ['crop', 'fish', 'enemy', 'rock', 'npc'][id % 5],
    parent: id === 0 ? null : (id >> 3),
    refs: id % 7 === 0 ? [] : [(id * 2654435761 % N)], // pseudo-scatter, no RNG
  };
}

// --- Representation A: scene tree (nested nodes; relationships via traversal) -
function buildTree() {
  const nodes = new Map();
  for (let id = 0; id < N; id++) nodes.set(id, { ...spec(id), children: [] });
  for (const n of nodes.values()) if (n.parent != null) nodes.get(n.parent).children.push(n.id);
  return nodes;
}
function treeQueries(nodes) {
  let work = 0;
  // Q1 all of a type -> must visit every node
  const q1 = []; for (const n of nodes.values()) { work++; if (n.type === 'enemy') q1.push(n.id); }
  // Q2 children of a container -> direct (tree is GOOD at this)
  const container = 5; const q2 = nodes.get(container).children.slice(); work += q2.length;
  // Q3 who references node Z -> must scan every node's ref list
  const Z = 42; const q3 = []; for (const n of nodes.values()) { work++; if (n.refs.includes(Z)) { q3.push(n.id); } work += n.refs.length; }
  return { work, counts: [q1.length, q2.length, q3.length] };
}

// --- Representation B: flat store + maintained indexes ----------------------
function buildIndexed() {
  const objs = new Map();
  const byType = new Map();
  const childrenOf = new Map();
  const referrersOf = new Map();
  let indexWork = 0;
  for (let id = 0; id < N; id++) {
    const o = spec(id); objs.set(id, o);
    (byType.get(o.type) ?? byType.set(o.type, []).get(o.type)).push(id); indexWork++;
    if (o.parent != null) { (childrenOf.get(o.parent) ?? childrenOf.set(o.parent, []).get(o.parent)).push(id); indexWork++; }
    for (const r of o.refs) { (referrersOf.get(r) ?? referrersOf.set(r, []).get(r)).push(id); indexWork++; }
  }
  return { objs, byType, childrenOf, referrersOf, indexWork };
}
function indexedQueries(ix) {
  let work = 0;
  const q1 = ix.byType.get('enemy') ?? []; work += q1.length;        // direct
  const q2 = ix.childrenOf.get(5) ?? []; work += q2.length;          // direct
  const q3 = ix.referrersOf.get(42) ?? []; work += q3.length;        // direct (reverse index)
  return { work, counts: [q1.length, q2.length, q3.length] };
}

const nodes = buildTree();
const ix = buildIndexed();
const t = treeQueries(nodes);
const i = indexedQueries(ix);

console.log('=== RD-001 world representation: query-workload cost ===');
console.log(`world: ${N} objects\n`);
console.log(`scene tree   : query work = ${t.work.toLocaleString()} node-touches   result sizes ${JSON.stringify(t.counts)}`);
console.log(`indexed/graph: query work = ${i.work.toLocaleString()} node-touches   result sizes ${JSON.stringify(i.counts)}`);
console.log(`  (indexed pays a one-time build/maintenance cost: ${ix.indexWork.toLocaleString()} index writes across ${N} inserts)`);
console.log(`\nspeedup on the AI relationship-query mix: ~${(t.work / i.work).toFixed(0)}x fewer touches`);
console.log('sanity: both representations returned identical result sizes ->',
  JSON.stringify(t.counts) === JSON.stringify(i.counts));
console.log('\nreading: the scene tree pays O(N) per relationship query it lacks an index for');
console.log('(all-of-type, who-references-Z); it is only O(1) for containment (children-of).');
console.log('The indexed model is O(result-size) for all three, at the cost of index writes on mutation.');
