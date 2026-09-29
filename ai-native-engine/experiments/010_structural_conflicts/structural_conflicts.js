'use strict';
// RD-005.2 — Structural conflicts (extends RD-005 beyond flat fields + sets).
//
// RD-005 handled scalar/set fields. Trees add failure modes a flat merge can't
// see: concurrent reparenting, disjoint child insertions, reparent-to-a-deleted
// parent (orphan), and merges that would create a CYCLE. We test the invariants
// a structural merge must hold. Zero deps.
//
// Tree model: nodes keyed by id; each node has a `parent` (id|null). Children
// are derived from parent pointers, so "the tree" is just the parent function.

function tree(pairs) { const m = new Map(); for (const [id, parent] of pairs) m.set(id, { id, parent }); return m; }
function childrenOf(t, id) { return [...t.values()].filter(n => n.parent === id).map(n => n.id).sort(); }
function hasCycle(t) {
  for (const start of t.keys()) {
    let cur = start, hops = 0;
    while (cur != null && t.has(cur)) { cur = t.get(cur).parent; if (++hops > t.size) return true; }
  }
  return false;
}

// A structural 3-way merge that DETECTS rather than blindly resolves.
function mergeTree(base, a, b, deleted = new Set()) {
  const merged = new Map();
  const conflicts = [];
  const ids = new Set([...base.keys(), ...a.keys(), ...b.keys()]);
  for (const id of ids) {
    if (deleted.has(id)) continue; // node itself removed
    const bp = base.get(id)?.parent ?? null;
    const ap = a.get(id)?.parent ?? bp;
    const bbp = b.get(id)?.parent ?? bp;
    let parent;
    if (ap === bbp) parent = ap;                     // agree
    else if (ap !== bp && bbp === bp) parent = ap;   // only A moved it
    else if (bbp !== bp && ap === bp) parent = bbp;  // only B moved it
    else { conflicts.push({ id, field: 'parent', branchA: ap, branchB: bbp }); parent = { __CONFLICT__: [ap, bbp] }; }
    merged.set(id, { id, parent });
  }
  // orphan check: a live node whose parent id no longer exists (e.g. deleted)
  const orphans = [];
  for (const n of merged.values()) {
    if (typeof n.parent === 'object') continue; // conflict marker, handled above
    if (n.parent != null && !merged.has(n.parent)) orphans.push({ id: n.id, missingParent: n.parent });
  }
  // cycle check on the concretely-resolved (non-conflict) subset
  const concrete = new Map([...merged].filter(([, n]) => typeof n.parent !== 'object'));
  const cycle = hasCycle(concrete);
  return { merged, conflicts, orphans, cycle };
}

const checks = [];

// S1 — concurrent reparent to DIFFERENT parents -> must surface a conflict.
{
  const base = tree([['A', null], ['B', null], ['C', null], ['X', 'A']]);
  const a = tree([['A', null], ['B', null], ['C', null], ['X', 'B']]);
  const b = tree([['A', null], ['B', null], ['C', null], ['X', 'C']]);
  const m = mergeTree(base, a, b);
  checks.push(['S1 concurrent reparent -> conflict surfaced, not silently picked',
    m.conflicts.length === 1 && m.conflicts[0].id === 'X', JSON.stringify(m.conflicts)]);
}

// S2 — disjoint child additions to the same container -> union, no conflict.
{
  const base = tree([['K', null], ['x', 'K']]);
  const a = tree([['K', null], ['x', 'K'], ['y', 'K']]);        // A added y
  const b = tree([['K', null], ['x', 'K'], ['z', 'K']]);        // B added z
  const m = mergeTree(base, a, b);
  const kids = childrenOf(m.merged, 'K');
  checks.push(['S2 disjoint child adds -> both kept (union), no conflict',
    m.conflicts.length === 0 && kids.join(',') === 'x,y,z', 'children(K)=' + kids.join(',')]);
}

// S3 — reparent to a parent the other branch DELETED -> orphan surfaced.
{
  const base = tree([['A', null], ['B', null], ['X', 'A']]);
  const a = tree([['A', null], ['B', null], ['X', 'B']]);       // A moves X under B
  const b = tree([['A', null], ['X', 'A']]);                    // B deletes B(node)
  const m = mergeTree(base, a, b, new Set(['B']));
  checks.push(['S3 reparent-to-deleted-parent -> orphan surfaced (not silent)',
    m.orphans.length === 1 && m.orphans[0].id === 'X' && m.orphans[0].missingParent === 'B', JSON.stringify(m.orphans)]);
}

// S4 — each branch nests the other's node -> merge would CYCLE -> detected.
{
  const base = tree([['X', null], ['Y', null]]);
  const a = tree([['X', 'Y'], ['Y', null]]);                    // A: X under Y
  const b = tree([['X', null], ['Y', 'X']]);                    // B: Y under X
  const m = mergeTree(base, a, b);
  checks.push(['S4 cyclic merge -> detected and flagged, not committed', m.cycle === true, 'cycle=' + m.cycle]);
}

console.log('=== RD-005.2 structural conflicts ===');
for (const [name, pass, detail] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}  (${detail})`);
const allPass = checks.every(([, p]) => p);
console.log(allPass ? '\nALL PASS — structural merge detects reparent/orphan/cycle instead of silently resolving.' : '\nSOME FAILED');
if (!allPass) process.exitCode = 1;
