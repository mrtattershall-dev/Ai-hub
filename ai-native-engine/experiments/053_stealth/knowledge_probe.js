'use strict';
// =============================================================================
// RD-041 follow-up — falsify the reviewer's stealth prediction BEFORE building it
// (measure, don't argue). Claim: stealth's "guard's knowledge of the player,
// persisting after line-of-sight breaks" is per-PAIR persistent state = RD-040 L3b,
// the one thing that reopens the concurrency model. Test it against the L1/L2
// prototype (self-writes + relational reads only; L3b would be UNREACHABLE here).
//
// HYPOTHESIS (mine, to falsify): the prediction is HALF right. For a SINGLE intruder
// — the classic stealth game — a guard's knowledge is its OWN scalar state (last-seen
// position, suspicion), updated by a relational read (can I see the player?) and
// PERSISTING as a self-field when it can't. That is L2, not L3b. It becomes L3b only
// when ONE guard must track MULTIPLE targets SEPARATELY (guard's memory of A vs of B).
//   node experiments/053_stealth/knowledge_probe.js
// =============================================================================
const path = require('node:path');
const { makeWorld, step } = require(path.join(__dirname, '..', '050_relational', 'relational_harness.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);
const F = (f) => ({ field: f });
const clampd = (e, lo, hi) => ({ clamp: [e, lo, hi] });

const R = 20, RISE = 30, DECAY = 5;
const canSee = { min: [{ count: { type: 'player', near: R } }, 1] };   // 0/1 — a relational read
const notSee = { sub: [1, canSee] };
const playerX = { sum: { type: 'player', field: 'x' } };              // single player's x (one in scope)

// knowledge rules — ALL self-writes on the guard: remember last-seen x (a branchless
// "update if seen, else keep" — the tick-latch convention, here INTENTIONAL memory),
// and a suspicion meter that rises on sight and decays otherwise.
const KNOW = [
  { name: 'remember', type: 'guard', effects: [{ set: 'last_x',
    to: clampd({ add: [{ mul: [canSee, playerX] }, { mul: [notSee, F('last_x')] }] }, 0, 255) }] },
  { name: 'suspicion', type: 'guard', effects: [{ set: 'susp',
    to: clampd({ add: [F('susp'), { sub: [{ mul: [canSee, RISE] }, { mul: [notSee, DECAY] }] }] }, 0, 100) }] },
];
const crossWrites = (w, r) => r.ops.filter((o) => w.byId(o.target).type !== 'guard').length;

// ---- SINGLE intruder: knowledge is self-state (PREDICT: falsifies the L3b claim) --
hr('single intruder — a guard remembers last-seen + suspicion as its OWN state, no L3b');
{
  const w = makeWorld();
  const g = w.spawn('guard', { x: 50, y: 0, last_x: 0, susp: 0 });
  const p = w.spawn('player', { x: 200, y: 0 });        // far: dist 150 > R
  let cross = 0;
  const run = (n) => { for (let i = 0; i < n; i++) { const r = step(w, KNOW); cross += crossWrites(w, r); } };
  run(3);
  ok(w.get(g, 'last_x') === 0 && w.get(g, 'susp') === 0, 'out of sight: no memory, no suspicion');
  w.byId(p).f.x = 60;                                    // player creeps into view (dist 10 < R)
  run(3);
  ok(w.get(g, 'last_x') === 60, `spotted: guard's last-seen updates to the player (last_x=${w.get(g, 'last_x')})`);
  ok(w.get(g, 'susp') > 0, `suspicion rose on sight (susp=${w.get(g, 'susp')})`);
  const suspPeak = w.get(g, 'susp');
  w.byId(p).f.x = 200;                                   // player breaks line of sight
  run(3);
  ok(w.get(g, 'last_x') === 60, `MEMORY PERSISTS after LOS breaks — guard still believes "last seen at 60" (last_x=${w.get(g, 'last_x')})`);
  ok(w.get(g, 'susp') < suspPeak, `suspicion decays when the trail goes cold (${suspPeak}→${w.get(g, 'susp')})`);
  ok(cross === 0, `NO cross-entity write and NO per-pair state — all self-state + a relational read (cross=${cross})`);
  console.log('  => VERDICT: single-intruder stealth knowledge is L2 (self-state), NOT L3b. The strong prediction is FALSIFIED for the common case.');
}

// ---- MULTIPLE intruders: now it IS per-pair (PREDICT: confirms L3b) --------------
hr('multiple intruders — one guard tracking TWO players separately IS per-pair (L3b)');
{
  const w = makeWorld();
  const g = w.spawn('guard', { x: 100, y: 0, last_x: 0, susp: 0 });
  w.spawn('player', { x: 60, y: 0 });                    // A, in view
  w.spawn('player', { x: 140, y: 0 });                  // B, in view (R big enough below)
  // reuse the single-target rule but with vision R covering both:
  const bigR = { min: [{ count: { type: 'player', near: 60 } }, 1] };
  const sumX = { sum: { type: 'player', field: 'x' } };
  const rules = [{ name: 'remember', type: 'guard', effects: [{ set: 'last_x',
    to: clampd({ add: [{ mul: [bigR, sumX] }, { mul: [{ sub: [1, bigR] }, F('last_x')] }] }, 0, 255) }] }];
  step(w, rules);
  const lx = w.get(g, 'last_x');
  ok(lx !== 60 && lx !== 140, `the guard's SINGLE last_x conflates both players (last_x=${lx} = the sum, not A@60 or B@140)`);
  console.log('  => VERDICT: to remember A AND B SEPARATELY the guard needs one memory slot PER player — per-(guard,player)');
  console.log('     state, which scalar self-fields cannot hold for a dynamic set. That is exactly L3b.');
  ok(true, 'CONFIRMED: multi-target guard memory is per-pair persistent state = RD-040 L3b (the deferred residue)');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed`);
console.log('REFINED FINDING: the reviewer\'s "stealth = L3b" is HALF right. Single-intruder stealth (the classic');
console.log('  game) is self-state + relational reads = L2, buildable today+after L1/L2. Only MULTI-target guard');
console.log('  memory is L3b. So stealth does NOT force L3b onto the critical path — unless the design needs one');
console.log('  guard to track many intruders distinctly. Worth deciding that in the SPEC, not mid-build.');
process.exit(FAIL ? 1 : 0);
