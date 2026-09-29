'use strict';
// =============================================================================
// RD-B2: BEHAVIOR INVARIANTS — the pre-commit checks that make AI-authored
// logic bear the same guarantees as AI-authored data.
// =============================================================================
// RD-B1 chose the representation (rules). This card proves the INVARIANTS
// around it, each with the project's signature negative control: turn the
// guard off and the exact corruption it prevents reappears.
//
//   I1  RANGE (engine invariant): an out-of-range / non-integer resolved value
//       is rejected for every contributor — including a FOLD whose sum
//       overflows — never silently truncated. Control: without the check the
//       Uint8 pool wraps 999 -> 231 (the RD-B1/A5 corruption).
//   I2  OP BUDGET: an oversized tx is rejected WHOLE (atomicity), other txs
//       in the tick are untouched. Control: without a budget the flood commits.
//   I3  CAPACITY: spawn/createChild past the row budget fail LOUDLY. Control:
//       the pre-fix path creates a GHOST entity (OOB typed-array writes are
//       silently ignored; byUuid points at garbage).
//   I4  DOUBLE-BUFFER SUBSUMES HAZARD ANALYSIS (a measured design consequence,
//       not new machinery): systems read the SAME committed pre-tick state, so
//       read-after-write hazards between systems CANNOT EXIST by construction —
//       no declared read/write sets needed. Proven: a reads-what-b-writes rule
//       pair commits IDENTICAL state under both registration orders.
//   I5  BEHAVIOR FUZZ (RD-021 extended to logic): random worlds x random rule
//       sets x permuted registration x mid-run save/load, checking committed-
//       state identity, index consistency, identity coherence, bounded growth,
//       and undo round-trip.
//
// Also proves core/behavior.js (the productized RD-B1 winner) end-to-end,
// including the COUNT aggregation extension that closes RD-B1's R8 ceiling.
// `node experiments/026_behavior_invariants/behavior_invariants.js`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE, TYPE_NAME, FIELD_RANGE } = CORE('engine.js');
const { parseRule, installRule } = CORE('behavior.js');
const P = CORE('persistence.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const sig = (g) => { // type-correct observable signature (RD-021 lesson)
  const rows = [];
  for (let e = 0; e < g.w.count; e++) {
    if (g.w.destroyed[e]) continue;
    const t = g.w.type[e], r = [g.w.uuid[e], t, g.w.parent[e] >= 0 ? g.w.uuid[g.w.parent[e]] : '-'];
    if (t === TYPE.CROP) r.push(g._field(e, 'water'), g._field(e, 'growth'));
    if (t === TYPE.ENEMY) r.push(g._field(e, 'hp'));
    if (t === TYPE.ZONE) r.push(g._field(e, 'tally'));
    rows.push(r);
  }
  return rows;
};
const liveCount = (g) => { let n = 0; for (let e = 0; e < g.w.count; e++) if (!g.w.destroyed[e]) n++; return n; };

function build(cap = 512) {
  const g = new Engine(cap);
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const crop = g.spawn(TYPE.CROP, { name: 'c0', parent: zone, water: 30, growth: 10 }).uuid;
  return { g, zone, crop };
}

console.log('=== RD-B2: behavior invariants (each with its negative control) ===\n');

// ============================== I1: RANGE ====================================
{
  const { g, crop } = build();
  const r = g.submit([{ actor: 'a', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 999 }] }]);
  ok(r.results[0].status === 'rejected' && r.results[0].reasons.join().includes('range'),
    'I1 out-of-range write REJECTED at the engine (999 on a Uint8 field)');
  ok(g._field(g.w.liveEntity(crop), 'water') === 30, 'I1 value held — not clamped, not truncated');
}
{ // FOLD OVERFLOW: each contribution is in range; the folded SUM is not.
  const { g, zone } = build();
  const r = g.submit([
    { actor: 'a', ops: [{ kind: 'setfield', target: zone, field: 'tally', value: 3000000000 }] },
    { actor: 'b', ops: [{ kind: 'setfield', target: zone, field: 'tally', value: 2000000000 }] },
  ]);
  ok(r.results.every(x => x.status === 'rejected' && x.reasons.join().includes('range')),
    'I1 additive-fold overflow (3e9+2e9 > uint32) rejected for BOTH contributors — checked on the RESOLVED value');
  ok(g._field(g.w.liveEntity(zone), 'tally') === 0, 'I1 fold overflow: nothing written');
}
{
  const { g, crop } = build();
  const r = g.submit([{ actor: 'a', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 2.5 }] }]);
  ok(r.results[0].status === 'rejected', 'I1 non-integer on an int field rejected (typed array would silently floor 2.5 -> 2)');
}
{ // NEGATIVE CONTROL: disable the water range -> the RD-B1/A5 wrap reappears.
  const saved = FIELD_RANGE.water;
  delete FIELD_RANGE.water;
  const { g, crop } = build();
  g.submit([{ actor: 'a', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 999 }] }]);
  const landed = g._field(g.w.liveEntity(crop), 'water');
  FIELD_RANGE.water = saved;
  ok(landed === (999 & 0xFF), `I1 CONTROL: guard off -> Uint8 silently wrapped 999 -> ${landed} — the exact corruption the invariant prevents`);
}

// ============================== I2: OP BUDGET ================================
{
  const g = new Engine(4096, { opsBudget: 100 });
  const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  const crops = Array.from({ length: 150 }, (_, i) => g.spawn(TYPE.CROP, { name: `c${i}`, parent: zone, water: 1 }).uuid);
  const flood = crops.map(u => ({ kind: 'setfield', target: u, field: 'water', value: 9 }));
  const r = g.submit([
    { actor: 'flooder', ops: flood },                                                    // 150 ops > 100
    { actor: 'ok', ops: [{ kind: 'setfield', target: crops[0], field: 'growth', value: 42 }] },
  ]);
  ok(r.results[0].status === 'rejected' && r.results[0].reasons.join().includes('budget'),
    'I2 oversized tx (150 ops > budget 100) rejected WHOLE');
  ok(g._field(g.w.liveEntity(crops[149]), 'water') === 1, 'I2 no partial application of the flood (atomicity)');
  ok(r.results[1].status === 'committed' && g._field(g.w.liveEntity(crops[0]), 'growth') === 42,
    'I2 the OTHER tx in the tick is untouched (isolation)');
  // NEGATIVE CONTROL: no budget -> the same flood commits wholesale.
  const g2 = new Engine(4096, { opsBudget: Infinity });
  const z2 = g2.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  const cs2 = Array.from({ length: 150 }, (_, i) => g2.spawn(TYPE.CROP, { name: `c${i}`, parent: z2, water: 1 }).uuid);
  const r2 = g2.submit([{ actor: 'flooder', ops: cs2.map(u => ({ kind: 'setfield', target: u, field: 'water', value: 9 })) }]);
  ok(r2.results[0].status === 'committed' && g2._field(g2.w.liveEntity(cs2[149]), 'water') === 9,
    'I2 CONTROL: budget off -> unbounded per-tick work admitted (the guard was doing the work)');
}

// ============================== I3: CAPACITY =================================
{
  const g = new Engine(8);   // room for 8 rows, ever (rows never reused)
  const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  for (let i = 0; i < 7; i++) g.spawn(TYPE.CROP, { name: `c${i}`, parent: zone });
  let threw = false;
  try { g.spawn(TYPE.CROP, { name: 'overflow' }); } catch { threw = true; }
  ok(threw, 'I3 spawn at capacity throws LOUDLY (trusted-caller contract)');
  const r = g.submit([{ actor: 'a', ops: [{ kind: 'createChild', type: TYPE.CROP, parent: zone, props: {} }] }]);
  ok(r.results[0].status === 'rejected' && r.results[0].reasons.join().includes('world full'),
    'I3 createChild past capacity rejected with a localized reason');
  ok(g.indexesConsistent() && g.w.byUuid.size === 8, 'I3 world intact: no ghost entity, indexes consistent');
  // NEGATIVE CONTROL: replicate the PRE-FIX spawn path at full capacity.
  const e = g.w.count++;                                  // old code: unchecked bump
  g.w.type[e] = TYPE.CROP; g.w.destroyed[e] = 0;          // OOB writes: silently IGNORED
  g.w.uuid[e] = 'ghost'; g.w.byUuid.set('ghost', e);      // plain arrays/Maps: they "work"
  const ghostLive = g.w.liveEntity('ghost') >= 0;
  const ghostType = g.w.type[e];                          // reads undefined (OOB)
  ok(ghostLive && ghostType === undefined,
    'I3 CONTROL: pre-fix path creates a GHOST — byUuid says live, every typed-array field reads garbage (silent corruption)');
  g.w.count--; g.w.byUuid.delete('ghost');                // undo the demonstration
}

// ============== I4: DOUBLE-BUFFER SUBSUMES HAZARD ANALYSIS ===================
// wilt READS water (fires on water==0); irrigate WRITES water (0 -> 8). If
// system output depended on run order, these two would race. They cannot:
// both read the committed pre-tick state. Measured: identical state under
// both registration orders, and wilt provably read the PRE-tick water.
{
  const mk = (order) => {
    const g = new Engine(64);
    const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
    const dry = g.spawn(TYPE.CROP, { name: 'dry', parent: zone, water: 0, growth: 20 }).uuid;
    const rules = {
      wilt: { name: 'wilt', match: { type: 'crop', where: { field: 'water', cmp: '==', value: 0 } },
        effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 2] }, 0] } }] },
      irrigate: { name: 'irrigate', match: { type: 'crop', where: { field: 'water', cmp: '<', value: 5 } },
        effects: [{ set: 'water', to: 8 }] },
    };
    for (const n of order) { const r = installRule(g, rules[n]); if (!r.ok) throw new Error('rule invalid'); }
    g.stepTick();
    return { state: sig(g), growth: g._field(g.w.liveEntity(dry), 'growth'), water: g._field(g.w.liveEntity(dry), 'water') };
  };
  const A = mk(['wilt', 'irrigate']), B = mk(['irrigate', 'wilt']);
  ok(eq(A.state, B.state), 'I4 committed state IDENTICAL under both registration orders');
  ok(A.growth === 18 && A.water === 8,
    'I4 wilt read the PRE-tick water (0) even though irrigate wrote 8 the same tick — read-after-write hazards unrepresentable by construction');
}

// ==================== I6: SYSTEM IDENTITY =====================================
// Found BY this card's fuzzer at 20k iterations: two same-named rules share an
// actor id; RD-003 determinism is cross-actor, so same-actor txs tie-break by
// input position — committed state silently depended on registration order.
// Fix: duplicate names are unrepresentable (engine throws; wire returns a
// localized error).
{
  const { g } = build();
  const rule = { name: 'dup', match: { type: 'crop' }, effects: [{ set: 'water', to: 1 }] };
  ok(installRule(g, rule).ok, 'I6 first install of a name succeeds');
  const second = installRule(g, { ...rule, effects: [{ set: 'water', to: 2 }] });
  ok(!second.ok && second.errors[0].code === 'duplicate_name',
    'I6 second rule with the SAME name rejected at the wire (localized: duplicate_name)');
  let threw = false;
  try { g.registerSystem('sysX', () => []); g.registerSystem('sysX', () => []); } catch { threw = true; }
  ok(threw, 'I6 registerSystem duplicate throws (a name is an actor identity — one per system)');
}

// ==================== behavior.js wire checks (RD-B1 productized) ============
{
  const { g, zone } = build();
  const r = parseRule(g, '{"name":"x","match":{"type":"crop"},"effects":[{"set":"hp","to":0}]}');
  ok(!r.ok && r.errors[0].code === 'field_not_owned' && r.errors[0].detail.includes('enemy'),
    `W1 parseRule: localized re-promptable error (${r.errors[0].code}: ${r.errors[0].detail})`);
  const r2 = parseRule(g, '{"name":"x","match":{"type":"crop"},"effects":[{"set":"growth","to":{"add":[{"field":"growth"},5]}}]}');
  ok(!r2.ok && r2.errors[0].code === 'range_unprovable', 'W2 parseRule: unclamped growth+5 fails the range proof with the fix named');
  const r3 = parseRule(g, 'not json at all');
  ok(!r3.ok && r3.errors[0].code === 'malformed_json', 'W3 parseRule: malformed JSON is a localized error, not an exception');
  const otherZone = g.spawn(TYPE.ZONE, { name: 'other', tally: 0 }).uuid;
  const scoped = { name: 'scoped', match: { type: 'zone', uuid: zone, where: { field: 'tally', cmp: '==', value: 0 } }, effects: [{ set: 'tally', to: 7 }] };
  const rs = installRule(g, scoped);
  ok(rs.ok, 'W3.1 exact match.uuid rule validates against a live, type-correct entity');
  g.stepTick();
  ok(g._field(g.w.liveEntity(zone), 'tally') === 7 && g._field(g.w.liveEntity(otherZone), 'tally') === 0,
    'W3.2 match.uuid composes with where and scopes a rule to exactly that entity (not the other zone)');
  const wrongType = parseRule(g, { name: 'wrong-type', match: { type: 'crop', uuid: zone }, effects: [{ set: 'water', to: 1 }] });
  ok(!wrongType.ok && wrongType.errors[0].code === 'type_mismatch', 'W3.3 match.uuid rejects a live UUID with the wrong declared type');
  const missing = parseRule(g, { name: 'missing', match: { type: 'zone', uuid: 'u-does-not-exist' }, effects: [{ set: 'tally', to: 1 }] });
  ok(!missing.ok && missing.errors[0].code === 'target_not_live', 'W3.4 match.uuid rejects a missing UUID before registration');
  const dead = new Engine(16);
  const deadZone = dead.spawn(TYPE.ZONE, { name: 'dead' }).uuid;
  dead.submit([{ actor: 'delete', ops: [{ kind: 'delete', target: deadZone }] }]);
  const tombstoned = parseRule(dead, { name: 'dead-target', match: { type: 'zone', uuid: deadZone }, effects: [{ set: 'tally', to: 1 }] });
  ok(!tombstoned.ok && tombstoned.errors[0].code === 'target_not_live' && tombstoned.errors[0].detail.includes('deleted'),
    'W3.5 match.uuid rejects a tombstoned UUID — deleted is explicit, never a stale target');
  // COUNT aggregation — RD-B1's R8 ceiling, closed by extending the grammar:
  const scoreRule = { name: 'score', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { count: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 50 } } } }] };
  const g2 = new Engine(128);
  const z2 = g2.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  [60, 40, 80].forEach((gr, i) => g2.spawn(TYPE.CROP, { name: `c${i}`, parent: z2, growth: gr }));
  const ri = installRule(g2, scoreRule);
  ok(ri.ok, 'W4 count-aggregation rule validates (bounded, statically checkable)');
  g2.stepTick();
  ok(g2._field(g2.w.liveEntity(z2), 'tally') === 2, 'W4 R8 now EXPRESSIBLE: tally = count of ready crops = 2');
  // the range proof is CAPACITY-AWARE: count's interval is [0, capacity].
  // On this 128-cap world, count into a Uint8 field is PROVABLY safe -> accepted;
  // on a 512-cap world the same rule is unprovable -> rejected. Both measured.
  const small = parseRule(g2, { name: 'x', match: { type: 'crop' },
    effects: [{ set: 'water', to: { count: { type: 'crop' } } }] });
  ok(small.ok, 'W5a capacity 128: count into water is provably in [0,128] ⊆ [0,255] — accepted (the proof is exact, not paranoid)');
  const g3 = new Engine(512);
  const bad = parseRule(g3, { name: 'x', match: { type: 'crop' },
    effects: [{ set: 'water', to: { count: { type: 'crop' } } }] });
  ok(!bad.ok && bad.errors[0].code === 'range_unprovable',
    'W5b capacity 512: same rule now unprovable ([0,512] ⊄ [0,255]) — REJECTED by the same proof');
}

// ============================== I5: BEHAVIOR FUZZ ============================
// Random worlds x random rule sets; three replicas per iteration:
//   A: rules installed in generated order        (5 ticks)
//   B: rules installed in REVERSED order         (5 ticks)   -> must equal A
//   C: A's order, but save/load after tick 2     (5 ticks)   -> must equal A
// Checks: state identity, indexesConsistent + identity coherence every tick,
// bounded growth (<= sum(caps) x ticks), undo round-trip on A.
{
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const N = Number(process.env.FUZZ_N ?? 2000), TICKS = 5;
  let fails = 0, ruleCount = 0, rejectedGen = 0;

  const genWorld = (rnd, cap) => {
    const g = new Engine(cap);
    const zone = g.spawn(TYPE.ZONE, { name: 'z0' }).uuid;
    const safe = g.spawn(TYPE.ZONE, { name: 'z1' }).uuid;
    const n = 5 + Math.floor(rnd() * 10);
    for (let i = 0; i < n; i++) {
      const t = rnd() < 0.6 ? TYPE.CROP : TYPE.ENEMY;
      if (t === TYPE.CROP) g.spawn(t, { name: `c${i}`, parent: rnd() < 0.8 ? zone : safe, water: Math.floor(rnd() * 60), growth: Math.floor(rnd() * 120) });
      else g.spawn(t, { name: `e${i}`, parent: zone, hp: Math.floor(rnd() * 120) });
    }
    return { g, zone, safe };
  };
  // rule templates — every generated rule is valid by construction; constants random
  const genRules = (rnd, fx) => {
    const templates = [
      () => ({ name: 'grow' + Math.floor(rnd() * 1e4), match: { type: 'crop', where: { field: 'water', cmp: '>', value: Math.floor(rnd() * 30) } },
        effects: [{ set: 'growth', to: { min: [{ add: [{ field: 'growth' }, 1 + Math.floor(rnd() * 6)] }, 255] } },
                  { set: 'water', to: { max: [{ sub: [{ field: 'water' }, 1] }, 0] } }] }),
      () => ({ name: 'wilt' + Math.floor(rnd() * 1e4), match: { type: 'crop', where: { field: 'water', cmp: '==', value: 0 } },
        effects: [{ set: 'growth', to: { max: [{ sub: [{ field: 'growth' }, 1 + Math.floor(rnd() * 3)] }, 0] } }] }),
      () => ({ name: 'reap' + Math.floor(rnd() * 1e4), match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 + Math.floor(rnd() * 100) } },
        effects: [{ delete: true }] }),
      () => ({ name: 'regen' + Math.floor(rnd() * 1e4), match: { type: 'enemy', where: { field: 'hp', cmp: '<', value: Math.floor(rnd() * 100) } },
        effects: [{ set: 'hp', to: { min: [{ add: [{ field: 'hp' }, 1 + Math.floor(rnd() * 4)] }, 65535] } }] }),
      () => ({ name: 'flee' + Math.floor(rnd() * 1e4), match: { type: 'enemy', where: { field: 'hp', cmp: '<', value: 15 + Math.floor(rnd() * 20) } },
        effects: [{ reparent: { to: fx.safe } }] }),
      () => ({ name: 'plant' + Math.floor(rnd() * 1e4), match: { type: 'zone' }, every: 1 + Math.floor(rnd() * 3),
        effects: [{ spawn: { type: 'crop', props: { water: Math.floor(rnd() * 20) }, cap: 1 + Math.floor(rnd() * 2) } }] }),
      () => ({ name: 'score' + Math.floor(rnd() * 1e4), match: { type: 'zone' },
        effects: [{ set: 'tally', to: { count: { type: 'crop', where: { field: 'growth', cmp: '>=', value: Math.floor(rnd() * 150) } } } }] }),
      // Exact identity scope is stable across save/load because UUIDs are the
      // authoritative identity (RD-004), not transient array indices.
      () => ({ name: 'scoped' + Math.floor(rnd() * 1e4), match: { type: 'zone', uuid: fx.zone },
        effects: [{ set: 'tally', to: { count: { type: 'crop', where: { field: 'growth', cmp: '>=', value: Math.floor(rnd() * 150) } } } }] }),
    ];
    const k = 2 + Math.floor(rnd() * 3);
    // names made unique BY CONSTRUCTION (suffix = slot index): at 20k
    // iterations the 4-digit random suffix collided twice, and two same-named
    // rules share an actor id -> same-actor tie-break -> order-dependence.
    // That was an invalid configuration (fuzzer bug, the RD-021 same-actor
    // lesson again) — AND it exposed that the engine silently accepted it,
    // now fixed: registerSystem rejects duplicates (see I6).
    return Array.from({ length: k }, (_, i) => {
      const r = templates[Math.floor(rnd() * templates.length)]();
      r.name += `_${i}`;
      return r;
    });
  };

  outer:
  for (let seedI = 0; seedI < N; seedI++) {
    const rnd = mulberry32(1000 + seedI);
    const cap = 1024;
    const fxA = genWorld(rnd, cap);
    const rules = genRules(rnd, fxA);
    ruleCount += rules.length;
    // occasionally inject an invalid rule; it must be rejected and register nothing
    if (rnd() < 0.15) {
      const bad = { name: 'bad', match: { type: 'crop' }, effects: [{ set: 'hp', to: 1 }] };
      const rb = installRule(fxA.g, bad);
      if (rb.ok) { console.log(`FUZZ ${seedI}: invalid rule ACCEPTED`); fails++; }
      else rejectedGen++;
    }
    const maxSpawnPerTick = rules.reduce((s, r) => s + (r.effects.find(e => e.spawn)?.spawn.cap ?? 0), 0);

    // replica A (history on) — replay the SAME world via save/load for B and C
    const snap0 = P.saveText(fxA.g);
    const gA = fxA.g; gA.enableHistory();
    for (const r of rules) if (!installRule(gA, r).ok) { console.log(`FUZZ ${seedI}: generated rule invalid`); fails++; continue outer; }
    const n0 = liveCount(gA);
    const sig0 = sig(gA);
    for (let t = 0; t < TICKS; t++) {
      gA.stepTick();
      if (!gA.indexesConsistent()) { console.log(`FUZZ ${seedI}: index desync at tick ${t}`); fails++; continue outer; }
      for (const [u, e] of gA.w.byUuid) if (gA.w.destroyed[e] || gA.w.uuid[e] !== u) { console.log(`FUZZ ${seedI}: identity break`); fails++; continue outer; }
    }
    const sigA = sig(gA);
    // bounded growth
    if (liveCount(gA) - n0 > maxSpawnPerTick * TICKS) { console.log(`FUZZ ${seedI}: growth bound exceeded`); fails++; }

    // replica B: reversed installation order
    const gB = P.loadText(snap0);
    for (const r of [...rules].reverse()) installRule(gB, r);
    for (let t = 0; t < TICKS; t++) gB.stepTick();
    if (!eq(sigA, sig(gB))) { console.log(`FUZZ ${seedI}: registration-order divergence`); fails++; }

    // replica C: mid-run save/load (statelessness of behavior)
    const gC1 = P.loadText(snap0);
    for (const r of rules) installRule(gC1, r);
    gC1.stepTick(); gC1.stepTick();
    const gC = P.loadText(P.saveText(gC1));
    for (const r of rules) installRule(gC, r);
    for (let t = 2; t < TICKS; t++) gC.stepTick();
    if (!eq(sigA, sig(gC))) { console.log(`FUZZ ${seedI}: save/load mid-run divergence`); fails++; }

    // undo round-trip on A: unwind every committed tick, land exactly at sig0
    let undos = 0;
    while (gA.undo().ok) undos++;
    if (!eq(sig(gA), sig0)) { console.log(`FUZZ ${seedI}: undo did not restore pre-run state`); fails++; }
    for (let i = 0; i < undos; i++) gA.redo();
    if (!eq(sig(gA), sigA)) { console.log(`FUZZ ${seedI}: redo did not restore post-run state`); fails++; }
  }
  ok(fails === 0, `I5 FUZZ: ${N} random worlds x rule-sets (${ruleCount} rules, ${rejectedGen} injected-invalid all rejected) x ${TICKS} ticks x 3 replicas — determinism, indexes, identity, bounded growth, undo ALL hold`);
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
