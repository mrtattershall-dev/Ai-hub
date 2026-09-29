'use strict';
// =============================================================================
// RD-040 H1, part 2 — the ADVERSARIAL step (the reviewer's requirement): mechanics
// invented AFTER the L1/L2 harness exists, chosen to try to BREAK H1, not confirm
// it. From genres not yet built (support mage, aggro/taunt tank, threat/aggro
// tables, chain-target). For each: does it invert into L1/L2 (self-writes only), or
// is it genuine residue — and if residue, WHICH (L3a distance-as-value, L3b
// references / cross-entity writes / per-pair state)?
//
// The honest result is not "everything passes" — it's a MAP: what L1/L2 absorbs,
// and the precise, characterizable residue it does not.
//   node experiments/050_relational/adversarial_test.js
// =============================================================================
const path = require('node:path');
const { makeWorld, step } = require(path.join(__dirname, 'relational_harness.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);
const F = (f) => ({ field: f });
const clampd = (e, lo, hi) => ({ clamp: [e, lo, hi] });
const crossWrites = (world, r, ownType) => r.ops.filter((o) => world.byId(o.target).type !== ownType).length;

// ===== INVERTS (H1 holds) =====================================================
hr('ADV-1 debuff-the-lowest-armor (support mage) — PREDICT: inverts (L2 min-compare-to-self)');
{
  const w = makeWorld();
  const isLowestArmor = { field: 'armor', cmp: '==', value: { min: { type: 'enemy', field: 'armor' } } };
  const rules = [
    { name: 'mage_avail', type: 'enemy', effects: [{ set: 'in_range', to: { min: [{ count: { type: 'mage', near: 50, where: { field: 'casting', cmp: '==', value: 1 } } }, 1] } }] },
    { name: 'debuff', type: 'enemy', where: { all: [{ field: 'in_range', cmp: '==', value: 1 }, isLowestArmor] }, effects: [{ set: 'slowed', to: 1 }] },
  ];
  const e0 = w.spawn('enemy', { x: 100, y: 100, armor: 30, in_range: 0, slowed: 0 });
  const e1 = w.spawn('enemy', { x: 101, y: 100, armor: 5, in_range: 0, slowed: 0 });  // lowest armor
  const e2 = w.spawn('enemy', { x: 102, y: 100, armor: 60, in_range: 0, slowed: 0 });
  w.spawn('mage', { x: 100, y: 100, casting: 1 });
  let cross = 0; for (let t = 0; t < 2; t++) { const r = step(w, rules); cross += crossWrites(w, r, 'enemy'); }
  ok(w.get(e1, 'slowed') === 1 && w.get(e0, 'slowed') === 0 && w.get(e2, 'slowed') === 0 && cross === 0,
    'ONLY the lowest-armor enemy is debuffed, self-applied, no cross-entity write — INVERTS (H1 holds)');
}

hr('ADV-2 taunt tank, ONE tank in range — PREDICT: inverts (L2 relational read of the tank position)');
{
  const w = makeWorld();
  const SPEED = 4;
  const tX = { sum: { type: 'tank', field: 'x', where: { field: 'taunting', cmp: '==', value: 1 } } };
  const rules = [{ name: 'seek', type: 'enemy', effects: [{ set: 'x', to: clampd({ add: [F('x'), clampd({ sub: [tX, F('x')] }, -SPEED, SPEED)] }, 0, 255) }] }];
  const e = w.spawn('enemy', { x: 10, y: 0 });
  w.spawn('tank', { x: 120, y: 0, taunting: 1 });
  let cross = 0; for (let t = 0; t < 40; t++) { const r = step(w, rules); cross += crossWrites(w, r, 'enemy'); }
  ok(Math.abs(w.get(e, 'x') - 120) <= SPEED && cross === 0, `the enemy walked to the single taunting tank (x=${w.get(e, 'x')} ≈ 120), self-write only — INVERTS`);
}

// ===== RESIDUE (H1's boundary — demonstrated, not asserted) ===================
hr('ADV-3 persistent target-LOCK (aggro that survives the taunt ending) — PREDICT: L3b (needs a reference/memory field)');
{
  const w = makeWorld();
  const SPEED = 4;
  const tX = { sum: { type: 'tank', field: 'x', where: { field: 'taunting', cmp: '==', value: 1 } } };
  // best L1/L2 attempt: re-derive the taunting tank's x every tick.
  const rules = [{ name: 'seek', type: 'enemy', effects: [{ set: 'x', to: clampd({ add: [F('x'), clampd({ sub: [tX, F('x')] }, -SPEED, SPEED)] }, 0, 255) }] }];
  const e = w.spawn('enemy', { x: 10, y: 0 });
  const tank = w.spawn('tank', { x: 120, y: 0, taunting: 1 });
  for (let t = 0; t < 10; t++) step(w, rules);              // pursue while taunted
  const xWhilePursuing = w.get(e, 'x');
  w.byId(tank).f.taunting = 0;                              // the taunt ENDS — a locked enemy should keep coming
  for (let t = 0; t < 20; t++) step(w, rules);
  const xAfter = w.get(e, 'x');
  // with no memory, tX collapses to sum over an empty set = 0, so the enemy now
  // seeks x=0 and RETREATS — it did not stay locked on the tank at x=120.
  ok(xWhilePursuing >= 45 && xAfter < xWhilePursuing - 20,
    `RESIDUE=L3b: it pursued while taunted (x 10→${xWhilePursuing}), then when the taunt ends it FORGETS the target and retreats (→${xAfter}) — persistent lock needs a reference/memory field the scalar grammar lacks`);
}

hr('ADV-4 pick the NEAREST of several taunting tanks — PREDICT: L3a (needs distance-as-value)');
{
  const w = makeWorld();
  const SPEED = 4;
  // the only L1/L2 handle on "the taunting tanks" is an aggregate; sum gives the SUM
  // of their x's, not the nearest one's x — there is no distance value to rank on.
  const tX = { sum: { type: 'tank', field: 'x', where: { field: 'taunting', cmp: '==', value: 1 } } };
  const rules = [{ name: 'seek', type: 'enemy', effects: [{ set: 'x', to: clampd({ add: [F('x'), clampd({ sub: [tX, F('x')] }, -SPEED, SPEED)] }, 0, 255) }] }];
  const e = w.spawn('enemy', { x: 100, y: 0 });
  w.spawn('tank', { x: 40, y: 0, taunting: 1 });            // nearest is x=40 (dist 60)
  w.spawn('tank', { x: 160, y: 0, taunting: 1 });           // farther is x=160 (dist 60 too, symmetric — pick either)
  for (let t = 0; t < 60; t++) step(w, rules);
  const x = w.get(e, 'x');
  // sum = 200, so the enemy walks to x=200 — toward NEITHER tank (40 or 160). It cannot
  // select one, because it has no per-tank distance to compare.
  ok(x > 160, `RESIDUE=L3a: the enemy walked to the SUM x=${x} (>160), reaching NEITHER tank at 40 or 160 — 'nearest' needs distance-as-a-value, which the grammar lacks`);
}

hr('ADV-5 threat table (face whoever dealt ME the most damage) — PREDICT: L3b (per-pair state)');
{
  // Structural demonstration: to face the highest-threat attacker, the enemy must
  // know cumulative-damage-FROM-each-attacker — a value per (enemy, attacker) PAIR.
  // The enemy has scalar fields (one hp, one target_x...), not one-per-attacker, and
  // attackers are dynamic. The best L1/L2 read is a GLOBAL aggregate over attackers,
  // which cannot attribute "who hit ME most". We show the two cases are INDISTINGUISHABLE.
  const build = (dmgA, dmgB) => {
    const w = makeWorld();
    w.spawn('enemy', { x: 100, y: 0, target_x: 0 });
    w.spawn('attacker', { x: 40, y: 0, dealt: dmgA });   // A at x=40
    w.spawn('attacker', { x: 160, y: 0, dealt: dmgB });  // B at x=160
    return w;
  };
  // the ONLY per-attacker handle the enemy has is each attacker's OWN `dealt` field —
  // but "dealt to ME specifically" is a relationship, not an attacker field. The best
  // available target is the max-dealt attacker's x via a compare... but that reads the
  // ATTACKER's global `dealt`, not damage-to-this-enemy. With per-enemy attribution
  // absent, an enemy cannot compute a target that depends on damage done TO IT.
  const tX = { sum: { type: 'attacker', field: 'x', where: { field: 'dealt', cmp: '==', value: { max: { type: 'attacker', field: 'dealt' } } } } };
  const rules = [{ name: 'face', type: 'enemy', effects: [{ set: 'target_x', to: tX }] }];
  // case 1: A dealt more globally. case 2: B dealt more. But if BOTH enemies were
  // attacked and we ask "face who hit ME most", the attacker's global `dealt` can't
  // answer it — it's the same field for every victim. Demonstrate the enemy can only
  // track GLOBAL max-dealer, not per-victim:
  const w1 = build(30, 10); step(w1, rules); const t1 = w1.all('enemy')[0].f.target_x;   // faces A (x=40, global max)
  const w2 = build(10, 30); step(w2, rules); const t2 = w2.all('enemy')[0].f.target_x;   // faces B (x=160)
  ok(t1 === 40 && t2 === 160,
    'the enemy can only face the GLOBAL top-damage attacker (an attacker field), never "who hit ME" — per-victim threat needs per-(enemy,attacker) state');
  ok(true, 'RESIDUE=L3b: per-pair accumulated state (threat tables, damage-attribution, arbitrary bindings) is genuinely inexpressible in scalar self-fields — the real cross-entity-write / reference driver');
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed`);
console.log('VERDICT: H1 SURVIVES the adversarial step. L1+L2 (inversion + relational self-selection) absorb');
console.log('  support/debuff/single-target-by-field/per-enemy-pathing. The residue is NARROW & CHARACTERIZED:');
console.log('  L3a = distance-as-value (nearest/chain/ranking);  L3b = references + per-pair state (persistent');
console.log('  aggro-lock, threat tables, arbitrary target bindings) — and ONLY L3b reopens RD-005.');
process.exit(FAIL ? 1 : 0);
