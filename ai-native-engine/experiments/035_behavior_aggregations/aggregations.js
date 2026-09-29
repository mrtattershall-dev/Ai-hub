'use strict';
// =============================================================================
// RD-B7 — SUM + SPATIAL (containment-scoped) aggregations. Extends the behavior
// grammar the RD-B4 `count` way: statically checkable, capacity-aware range
// proof, no escape to general code. Two new powers for an AI author:
//   * {sum:{field,type,where?,of?}}  — bounded SUM of a numeric field.
//   * of:"children" on count/sum     — aggregate over the matched entity's
//     direct children (the containment graph's "spatial" neighbourhood),
//     not globally.
// Every gain paired with its negative control (RD-B2 discipline).
// `node experiments/035_behavior_aggregations/aggregations.js` -> ALL PASS.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');
const { installRule, parseRule } = CORE('behavior.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);

// two zones, each with its own crops — so global vs scoped aggregation DIFFER.
function build(cap = 256) {
  const g = new Engine(cap);
  const A = g.spawn(TYPE.ZONE, { name: 'fieldA', tally: 0 }).uuid;
  const B = g.spawn(TYPE.ZONE, { name: 'fieldB', tally: 0 }).uuid;
  [[10, 0], [20, 50], [30, 100]].forEach(([w, gr], i) => g.spawn(TYPE.CROP, { name: `a${i}`, parent: A, water: w, growth: gr }));
  [[40, 100], [50, 100]].forEach(([w, gr], i) => g.spawn(TYPE.CROP, { name: `b${i}`, parent: B, water: w, growth: gr }));
  return { g, A, B };
}
const tallyOf = (g, u) => g._field(g.w.liveEntity(u), 'tally');
const rejectCodes = (r) => (r.errors || []).map(e => e.code);

console.log('=== RD-B7: sum + spatial (containment-scoped) aggregations ===');

// ---- T1 SUM (global): total water across ALL crops -------------------------
hr('T1 sum global — set zone tally = sum(water over all crops)');
{
  const { g, A, B } = build();
  const rule = { name: 'total_water', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { min: [{ sum: { field: 'water', type: 'crop' } }, 4294967295] } }] };
  ok(installRule(g, rule).ok, 'sum rule installs (statically valid)');
  g.stepTick();
  ok(tallyOf(g, A) === 150 && tallyOf(g, B) === 150, `both zones see the GLOBAL sum 10+20+30+40+50=150 (A=${tallyOf(g, A)} B=${tallyOf(g, B)})`);
}

// ---- T2 SUM (scoped): each zone sums only ITS OWN crops' water --------------
hr('T2 sum spatial (of:children) — each zone sums only its own crops');
{
  const { g, A, B } = build();
  const rule = { name: 'my_water', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { min: [{ sum: { field: 'water', type: 'crop', of: 'children' } }, 4294967295] } }] };
  ok(installRule(g, rule).ok, 'scoped sum rule installs');
  g.stepTick();
  ok(tallyOf(g, A) === 60 && tallyOf(g, B) === 90,
    `A sums its own (10+20+30=60), B its own (40+50=90) — SCOPE is load-bearing (A=${tallyOf(g, A)} B=${tallyOf(g, B)})`);
  ok(tallyOf(g, A) !== 150, 'scoped result DIFFERS from the global sum (150) — not the same query');
}

// ---- T3 COUNT (scoped): ready crops per zone -------------------------------
hr('T3 count spatial (of:children) — ready crops per zone vs globally');
{
  const { g, A, B } = build();
  installRule(g, { name: 'ready_here', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { count: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 }, of: 'children' } } }] });
  g.stepTick();
  ok(tallyOf(g, A) === 1 && tallyOf(g, B) === 2,
    `A has 1 ready child, B has 2 (global would be 3) — A=${tallyOf(g, A)} B=${tallyOf(g, B)}`);
}

// ---- T4 THE RANGE PROOF extends to sum (capacity-aware) ---------------------
hr('T4 range proof — an unclamped sum that can overflow is STATICALLY REJECTED');
{
  const { g } = build();
  // sum(water) can reach capacity*255 = 65280; into growth [0,255] -> unprovable.
  const bad = { name: 'overflow', match: { type: 'crop' },
    effects: [{ set: 'growth', to: { sum: { field: 'water', type: 'crop' } } }] };
  const rb = parseRule(g, bad);
  ok(!rb.ok && rejectCodes(rb).includes('range_unprovable'), `unclamped sum->growth REJECTED range_unprovable (reach up to ${256 * 255})`);
  // clamped is accepted — the author STATED the clamp.
  const good = { name: 'clamped', match: { type: 'crop' },
    effects: [{ set: 'growth', to: { min: [{ sum: { field: 'water', type: 'crop' } }, 255] } }] };
  ok(parseRule(g, good).ok, 'the SAME sum, clamped with min, is accepted (author stated the bound)');
}

// ---- T5 NEGATIVE CONTROLS (each new surface has one) ------------------------
hr('T5 negative controls — malformed aggregations rejected with localized codes');
{
  const { g } = build();
  const cases = [
    [{ name: 'x', match: { type: 'zone' }, effects: [{ set: 'tally', to: { min: [{ sum: { field: 'hp', type: 'crop' } }, 9] } }] }, 'field_not_owned', 'sum a field the counted type does not own (hp on crop)'],
    [{ name: 'x', match: { type: 'zone' }, effects: [{ set: 'tally', to: { min: [{ sum: { field: 'name', type: 'crop' } }, 9] } }] }, 'unknown_field', 'sum a non-numeric field (name)'],
    [{ name: 'x', match: { type: 'zone' }, effects: [{ set: 'tally', to: { min: [{ sum: { field: 'water', type: 'banana' } }, 9] } }] }, 'unknown_type', 'sum over an unknown type'],
    [{ name: 'x', match: { type: 'zone' }, effects: [{ set: 'tally', to: { count: { type: 'crop', of: 'cousins' } } }] }, 'bad_scope', 'an unknown scope (of:"cousins")'],
    [{ name: 'x', match: { type: 'zone' }, effects: [{ set: 'tally', to: { sum: { field: 'water', type: 'crop', of: 'ancestors' } } }] }, 'bad_scope', 'an unsupported scope (of:"ancestors")'],
    [{ name: 'x', match: { type: 'zone' }, effects: [{ set: 'tally', to: { min: [{ max: { field: 'hp', type: 'crop' } }, 9] } }] }, 'field_not_owned', 'max aggregation of a field the type does not own (hp on crop)'],
  ];
  for (const [rule, code, desc] of cases) {
    const r = parseRule(g, rule);
    ok(!r.ok && rejectCodes(r).includes(code), `REJECTED (${code}): ${desc}`);
  }
}

// ---- T6 SAFETY + DETERMINISM through the pipeline ---------------------------
hr('T6 a scoped-sum rule runs safely + deterministically over many ticks');
{
  const run = () => {
    const { g, A } = build();
    installRule(g, { name: 'my_water', match: { type: 'zone' },
      effects: [{ set: 'tally', to: { min: [{ sum: { field: 'water', type: 'crop', of: 'children' } }, 4294967295] } }] });
    // also grow crops so the aggregated value changes over time
    installRule(g, { name: 'grow', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 0 } },
      effects: [{ set: 'growth', to: { min: [{ add: [{ field: 'growth' }, 5] }, 255] } }] });
    let unsafe = 0;
    const tallies = [];
    for (let t = 0; t < 15; t++) { g.stepTick(); if (!g.indexesConsistent()) unsafe++; tallies.push(tallyOf(g, A)); }
    return { unsafe, tallies: tallies.join(',') };
  };
  const r1 = run(), r2 = run();
  ok(r1.unsafe === 0, 'zero unsafe events across 15 ticks with a scoped-sum rule live');
  ok(r1.tallies === r2.tallies, 'deterministic: identical tally trace across two identical runs');
}

// ---- T7 composes with the existing grammar (sum inside arithmetic) ----------
hr('T7 sum composes inside arithmetic (add/min) like any expr');
{
  const { g, A } = build();
  // tally = min(own-water-sum + own-ready-count, cap): a compound scoped expr.
  installRule(g, { name: 'compound', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { min: [{ add: [
      { sum: { field: 'water', type: 'crop', of: 'children' } },
      { count: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 }, of: 'children' } }] }, 4294967295] } }] });
  g.stepTick();
  ok(tallyOf(g, A) === 61, `A = own water sum 60 + own ready count 1 = 61 (compound scoped expr, got ${tallyOf(g, A)})`);
}

// ---- T8 RD-B7.1: min/max FIELD aggregations (object arg vs binary array) ----
hr('T8 min/max field aggregations — the ripest and thirstiest crop');
{
  const { g, A } = build();
  installRule(g, { name: 'ripest', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { max: { field: 'growth', type: 'crop', of: 'children' } } }] });
  g.stepTick();
  ok(tallyOf(g, A) === 100, `A's ripest own crop has growth 100 (max aggregation, got ${tallyOf(g, A)})`);

  const { g: g2, A: A2 } = build();
  installRule(g2, { name: 'driest', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { min: { field: 'water', type: 'crop', of: 'children' } } }] });
  g2.stepTick();
  ok(tallyOf(g2, A2) === 10, `A's driest own crop has water 10 (min aggregation, got ${tallyOf(g2, A2)})`);

  // the binary min/max OPERATORS (array arg) still work alongside the aggregations
  const { g: g3, A: A3 } = build();
  installRule(g3, { name: 'clamped_max', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { min: [{ max: { field: 'growth', type: 'crop', of: 'children' } }, 50] } }] }); // agg max clamped by binary min
  g3.stepTick();
  ok(tallyOf(g3, A3) === 50, `binary min([aggMax=100, 50]) = 50 — object-arg agg and array-arg operator coexist (got ${tallyOf(g3, A3)})`);
}

// ---- T9 RD-B7.1: of:"subtree" — transitive descendants -----------------------
hr('T9 of:"subtree" — aggregate over the whole containment subtree');
{
  // nest crops under crops (a sub-plot): A -> crop -> crop.
  const g = new (require(path.join(__dirname, '..', '..', 'core', 'engine.js')).Engine)(256);
  const A = g.spawn(TYPE.ZONE, { name: 'A', tally: 0 }).uuid;
  const c1 = g.spawn(TYPE.CROP, { name: 'c1', parent: A, water: 10, growth: 0 }).uuid;
  const c2 = g.spawn(TYPE.CROP, { name: 'c2', parent: c1, water: 20, growth: 0 }).uuid;  // grandchild
  g.spawn(TYPE.CROP, { name: 'c3', parent: c2, water: 30, growth: 0 });                   // great-grandchild
  installRule(g, { name: 'children_sum', match: { type: 'zone' },
    effects: [{ set: 'tally', to: { min: [{ sum: { field: 'water', type: 'crop', of: 'children' } }, 4294967295] } }] });
  installRule(g, { name: 'subtree_sum', match: { type: 'crop', uuid: c1 },
    effects: [{ set: 'growth', to: { min: [{ sum: { field: 'water', type: 'crop', of: 'subtree' } }, 255] } }] });
  g.stepTick();
  ok(tallyOf(g, A) === 10, `of:children sees only the DIRECT child (water 10), not descendants (got ${tallyOf(g, A)})`);
  const c1g = g._field(g.w.liveEntity(c1), 'growth');
  ok(c1g === 50, `of:subtree from c1 sums ALL descendants c2+c3 (20+30=50), not just direct (got ${c1g})`);
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
