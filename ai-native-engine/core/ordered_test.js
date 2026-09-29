'use strict';
// =============================================================================
// ORDERED LISTS in the core (RD-005.3 integrated). Proves the order-key merge
// policy composes with the real pipeline: conflict-resolution, staging (RD-017),
// undo (RD-020), persistence (RD-019), and the protocol wire (RD-018).
// `node core/ordered_test.js`
// =============================================================================
const { Engine, TYPE } = require('./engine.js');
const P = require('./persistence.js');
const IR = require('./protocol.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// world: a zone with 4 named crops A,B,C,D (spawn order = initial order)
function build(history = false) {
  const g = new Engine(64); if (history) g.enableHistory();
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const ids = {};
  for (const n of ['A', 'B', 'C', 'D']) ids[n] = g.spawn(TYPE.CROP, { name: n, parent: zone }).uuid;
  return { g, zone, ids };
}
const names = (g, order) => order.map(u => g.w.name[g.w.liveEntity(u)]);

console.log('=== ordered lists integrated into the core (RD-005.3) ===\n');

// --- O1 initial order = spawn order ----------------------------------------
{
  const { g, zone } = build();
  ok(eq(names(g, g.orderedChildren(zone)), ['A','B','C','D']), 'O1 orderedChildren reflects spawn order: A B C D');
}

// --- O2 a single move reorders, through the full pipeline -------------------
{
  const { g, zone, ids } = build();
  const r = g.submit([{ actor: 'u', ops: [{ kind: 'move', target: ids.C, after: null }] }]); // C to front
  ok(r.results[0].status === 'committed', 'O2 move committed');
  ok(eq(names(g, g.orderedChildren(zone)), ['C','A','B','D']), 'O2 C moved to front: C A B D');
  ok(g.indexesConsistent(), 'O2 childrenOf index still consistent (order is a field, not an index)');
}

// --- O3 concurrent moves of DIFFERENT items MERGE (RD-005.3) ----------------
{
  const { g, zone, ids } = build();
  const last = g.orderedChildren(zone).slice(-1)[0]; // D
  const r = g.submit([
    { actor: 'P1', ops: [{ kind: 'move', target: ids.D, after: null }] },   // D to front
    { actor: 'P2', ops: [{ kind: 'move', target: ids.A, after: last }] },   // A to end
  ]);
  ok(r.results.every(x => x.status === 'committed'), 'O3 both moves committed (different items -> merge)');
  ok(r.deferrals.length === 0, 'O3 no deferral for disjoint moves');
  const ord = names(g, g.orderedChildren(zone));
  ok(ord[0] === 'D' && ord[ord.length-1] === 'A', `O3 both intents preserved: ${ord.join(' ')} (D first, A last)`);
}

// --- O4 concurrent moves of the SAME item DEFER (RD-005.3) ------------------
{
  const { g, zone, ids } = build();
  const last = g.orderedChildren(zone).slice(-1)[0];
  const before = names(g, g.orderedChildren(zone));
  const r = g.submit([
    { actor: 'P1', ops: [{ kind: 'move', target: ids.C, after: null }] },   // C to front
    { actor: 'P2', ops: [{ kind: 'move', target: ids.C, after: last }] },   // C to end
  ]);
  ok(r.deferrals.length === 1, 'O4 same-item reorder is DEFERRED (surfaced), not silently picked');
  ok(eq(names(g, g.orderedChildren(zone)), before), 'O4 C held at its prior position (no LWW arbitration)');
  ok(r.results.every(x => /deferred/.test(x.reasons.join())), 'O4 both actors told the reorder is contested');
}

// --- O5 undo of a move restores prior order (RD-020) ------------------------
{
  const { g, zone, ids } = build(true);
  g.submit([{ actor: 'u', ops: [{ kind: 'move', target: ids.D, after: null }] }]); // D to front
  ok(eq(names(g, g.orderedChildren(zone)), ['D','A','B','C']), 'O5 after move: D A B C');
  g.undo();
  ok(eq(names(g, g.orderedChildren(zone)), ['A','B','C','D']), 'O5 undo restored original order');
  g.redo();
  ok(eq(names(g, g.orderedChildren(zone)), ['D','A','B','C']), 'O5 redo re-applied the move');
}

// --- O6 persistence round-trips order (RD-019) ------------------------------
{
  const { g, zone, ids } = build();
  g.submit([{ actor: 'u', ops: [{ kind: 'move', target: ids.C, after: null }] }]);
  const g2 = P.loadText(P.saveText(g));
  const z2 = g2.orderedChildren(zone);
  ok(eq(names(g2, z2), ['C','A','B','D']), 'O6 reload preserves the reordered list: C A B D');
  ok(g2.indexesConsistent(), 'O6 reloaded engine consistent');
}

// --- O7 invalid move (after = non-sibling) rejected -------------------------
{
  const { g, zone, ids } = build();
  const otherZone = g.spawn(TYPE.ZONE, { name: 'other' }).uuid; // not a sibling of the crops
  const r = g.submit([{ actor: 'u', ops: [{ kind: 'move', target: ids.A, after: otherZone }] }]);
  ok(r.results[0].status === 'rejected' && /not a live sibling/.test(r.results[0].reasons.join()),
     'O7 move after a non-sibling is rejected');
  ok(eq(names(g, g.orderedChildren(zone)), ['A','B','C','D']), 'O7 order unchanged after the rejected move');
}

// --- O8 protocol wire: a model can emit a move op (RD-018) ------------------
{
  const { g, zone, ids } = build();
  const r = IR.apply(g, JSON.stringify({ actor: 'ai', ops: [{ op: 'move', target: ids.D, after: null }] }));
  ok(r.accepted && r.result.results[0].status === 'committed', 'O8 structured-IR move parsed + committed');
  ok(eq(names(g, g.orderedChildren(zone)), ['D','A','B','C']), 'O8 IR move reordered: D A B C');
  const bad = IR.apply(g, JSON.stringify({ actor: 'ai', ops: [{ op: 'move', target: ids.A, after: 'u-ghost' }] }));
  ok(!bad.accepted && bad.errors[0].code === 'unknown_after', 'O8 IR rejects move with a hallucinated "after" at the protocol phase');
}

console.log(`\n=============================================`);
console.log(`${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed) — ordered lists`);
console.log(`=============================================`);
if (FAIL) process.exitCode = 1;
