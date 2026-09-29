'use strict';
// RD-005.3 — ORDERED-LIST conflicts (the gap RD-005.2 flagged and left open).
//
// RD-005.2 resolved STRUCTURAL conflicts only for UNORDERED (set-like) children:
// disjoint child-adds union, reparent-divergence defers, acyclicity + no-orphan
// enforced. It explicitly punted on ORDERED children — concurrent REORDERS —
// noting they "likely need defer or an ordering CRDT". This measures that.
//
// Anchoring scenario (the ordered analogue of Crop #142): a list [A,B,C,D];
// Player 1 moves D to the front, Player 2 moves A to the end, SAME tick, each
// acting on the base. What should the merged order be, and does the policy
//   (a) converge regardless of arrival order,          (determinism)
//   (b) keep BOTH players' moves,                       (intent preservation)
//   (c) never drop or duplicate an item,                (integrity)
//   (d) defer ONLY genuine conflicts, not spurious ones (minimal blocking)?
//
// Three rival policies, measured against those properties. Zero deps, `node`.
// The philosophy under test is RD-005's own: resolve where a lossless merge
// exists (here: moves of DIFFERENT items commute), defer only the true clash
// (moves of the SAME item to different places). LWW is the disproof baseline —
// it is the Crop #142 bug in list form.

// ---------------------------------------------------------------------------
// Order model: each item carries a FRACTIONAL order key. The visible list is
// items sorted by (key, id). A "move" assigns a new key between two neighbours;
// concurrent moves of different items are independent key writes that merge.
// ---------------------------------------------------------------------------
const BASE = [['A',1],['B',2],['C',3],['D',4]]; // [id, key]
const listOf = (keyMap) => [...keyMap.entries()].sort((a,b)=> a[1]-b[1] || (a[0]<b[0]?-1:1)).map(([id])=>id);
const baseKeys = () => new Map(BASE);

// compute the key that places `id` at a target slot in the BASE ordering.
const K = Object.fromEntries(BASE);
const beforeAll = () => Math.min(...BASE.map(([,k])=>k)) - 1;                  // to the front
const afterAll  = () => Math.max(...BASE.map(([,k])=>k)) + 1;                  // to the end
const between   = (a,b) => (K[a]+K[b])/2;                                       // between two base items

// A move = { actor, id, key }.  An edit = a list of moves by one actor.
const P1 = [{ actor:'P1', id:'D', key: beforeAll() }];   // "move D to the front"
const P2 = [{ actor:'P2', id:'A', key: afterAll() }];    // "move A to the end"

// ===========================================================================
// POLICY 1 — LWW on the whole list (STEELMAN): the winning editor's moves win,
// the other's are discarded wholesale. We pick the winner by a DETERMINISTIC
// tiebreak (highest actor id), NOT arrival order — otherwise LWW doesn't even
// converge (that's the raw Crop #142 bug). So this is the strongest LWW: it
// converges, and STILL silently loses one player's move. That residual loss is
// the point.
// ===========================================================================
function mergeLWW(edits) {
  const nonEmpty = edits.filter(e => e.length);
  const winner = nonEmpty.length ? nonEmpty.reduce((a,b)=> (b[0].actor > a[0].actor ? b : a)) : [];
  const keys = baseKeys();
  for (const m of winner) keys.set(m.id, m.key);
  return { list: listOf(keys), deferred: [] };
}

// ===========================================================================
// POLICY 2 — blanket DEFER: any concurrent reorder is surfaced, base kept.
// Safe, never wrong, but blocks even non-conflicting moves.
// ===========================================================================
function mergeDefer(edits) {
  const touched = edits.some(e => e.length);
  const multiple = edits.filter(e => e.length).length > 1;
  return multiple ? { list: listOf(baseKeys()), deferred: ['reorder contested'] }
                  : { list: (()=>{ const k=baseKeys(); for(const e of edits) for(const m of e) k.set(m.id,m.key); return listOf(k); })(), deferred: [] };
}

// ===========================================================================
// POLICY 3 — order-key CRDT (RD-005 philosophy): each move is a key write.
// Moves of DIFFERENT items are disjoint -> union, lossless, commutes. Moves of
// the SAME item to DIFFERENT keys are a true conflict on that item -> DEFER
// that item (keep its base key), surface it. Everything else merges.
// ===========================================================================
function mergeOrderKeyCRDT(edits) {
  const byItem = new Map();                           // id -> [{actor,key}...]
  for (const e of edits) for (const m of e) (byItem.get(m.id) ?? byItem.set(m.id,[]).get(m.id)).push(m);
  const keys = baseKeys();
  const deferred = [];
  for (const [id, moves] of byItem) {
    const distinct = new Set(moves.map(m=>m.key));
    if (distinct.size === 1) keys.set(id, moves[0].key);          // agreed (or single) -> apply
    else deferred.push(`item ${id} moved to ${distinct.size} different slots`); // true conflict -> keep base key, surface
  }
  return { list: listOf(keys), deferred };
}

// ---------------------------------------------------------------------------
// TEST HARNESS
// ---------------------------------------------------------------------------
let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const noLossNoDup = (list) => { const s = new Set(list); return s.size === list.length && s.size === BASE.length && BASE.every(([id])=>s.has(id)); };

const POLICIES = [
  { name:'LWW      ', fn: mergeLWW },
  { name:'DEFER-all', fn: mergeDefer },
  { name:'ORDER-KEY', fn: mergeOrderKeyCRDT },
];

console.log('=== RD-005.3 ordered-list conflicts: concurrent reorder merge ===\n');
console.log(`base order: ${listOf(baseKeys()).join(' ')}   (P1: D->front,  P2: A->end)\n`);
// Encode the EXPECTED behaviour of each policy so ALL PASS means "every policy
// behaved as the theory predicts" — the desirable-vs-flawed split is the finding.
const EXPECT_INTENT = { 'LWW      ': false, 'DEFER-all': false, 'ORDER-KEY': true };  // keeps BOTH moves?
const EXPECT_BLOCKS = { 'LWW      ': false, 'DEFER-all': true,  'ORDER-KEY': false }; // spuriously defers disjoint?

// --- Determinism: both arrival orders must converge (all three should) ------
console.log('--- determinism (P1,P2) vs (P2,P1) converge to the same order ---');
for (const p of POLICIES) {
  const ab = p.fn([P1,P2]).list, ba = p.fn([P2,P1]).list;
  ok(eq(ab,ba), `${p.name} converges regardless of arrival order  -> ${ab.join(' ')} == ${ba.join(' ')}`);
}

// --- Integrity: no item dropped or duplicated (all three should) ------------
console.log('\n--- integrity (every item exactly once) ---');
for (const p of POLICIES) { const r = p.fn([P1,P2]); ok(noLossNoDup(r.list), `${p.name} keeps all 4 items exactly once -> ${r.list.join(' ')}`); }

// --- Intent preservation: only ORDER-KEY should keep BOTH moves -------------
console.log('\n--- intent preservation (D first from P1, A last from P2 — different items) ---');
for (const p of POLICIES) {
  const r = p.fn([P1,P2]);
  const bothIntents = r.list[0] === 'D' && r.list[r.list.length-1] === 'A';
  ok(bothIntents === EXPECT_INTENT[p.name],
     `${p.name} intent-preserved=${bothIntents} (expected ${EXPECT_INTENT[p.name]}) -> ${r.list.join(' ')}${r.deferred.length?'  [deferred]':''}`);
}

// --- Minimal blocking: only DEFER-all should block the disjoint case --------
console.log('\n--- minimal blocking (P1,P2 touch DIFFERENT items) ---');
for (const p of POLICIES) {
  const r = p.fn([P1,P2]);
  const blocks = r.deferred.length > 0;
  ok(blocks === EXPECT_BLOCKS[p.name], `${p.name} spuriously-defers=${blocks} (expected ${EXPECT_BLOCKS[p.name]})`);
}

// --- True conflict: BOTH move the SAME item to different slots ---------------
console.log('\n--- true conflict (both move C, to front vs to end) ---');
{
  const Q1 = [{ actor:'P1', id:'C', key: beforeAll() }];   // C to front
  const Q2 = [{ actor:'P2', id:'C', key: afterAll() }];    // C to end
  const crdt = mergeOrderKeyCRDT([Q1,Q2]);
  ok(crdt.deferred.length === 1 && noLossNoDup(crdt.list), `ORDER-KEY surfaces the same-item clash, keeps C at base -> ${crdt.list.join(' ')} [${crdt.deferred.join(';')}]`);
  const lww = mergeLWW([Q1,Q2]);
  ok(lww.deferred.length === 0, `LWW silently picks one placement of C, no surface -> ${lww.list.join(' ')}  (the Crop #142 bug, list form)`);
}

// --- Convergence stress: many disjoint concurrent moves --------------------
console.log('\n--- stress: 3 actors each move a different item, any interleaving converges ---');
{
  const e1 = [{actor:'P1',id:'A',key:afterAll()}];         // A to end
  const e2 = [{actor:'P2',id:'C',key:beforeAll()}];        // C to front
  const e3 = [{actor:'P3',id:'B',key:between('C','D')}];   // B between C and D (base coords)
  const perms = [[e1,e2,e3],[e3,e1,e2],[e2,e3,e1],[e3,e2,e1]];
  const outs = perms.map(pm => mergeOrderKeyCRDT(pm).list);
  ok(outs.every(o => eq(o, outs[0])) && noLossNoDup(outs[0]), `ORDER-KEY converges over all interleavings -> ${outs[0].join(' ')}`);
}

// ---------------------------------------------------------------------------
console.log('\n--- computed verdict ---');
console.log('  LWW       : deterministic but SILENTLY LOSES one actor\'s move (integrity ok, intent NOT).');
console.log('  DEFER-all : safe but blocks even disjoint moves that had a clean lossless merge.');
console.log('  ORDER-KEY : fractional order-keys; disjoint moves MERGE losslessly & commute, only a');
console.log('              same-item clash defers — RD-005 applied to order. Interleaving of multi-');
console.log('              element runs at one gap is the known CRDT wart (out of scope, flagged).');
console.log(`\n  ${FAIL === 0 ? 'ALL PASS' : FAIL + ' FAILED'}  (${PASS} passed, ${FAIL} failed)`);
console.log('  Every policy behaved as predicted; only ORDER-KEY satisfies determinism + integrity');
console.log('  + intent-preservation + minimal-blocking together. LWW fails intent; DEFER-all over-blocks.');
if (FAIL) process.exitCode = 1;
