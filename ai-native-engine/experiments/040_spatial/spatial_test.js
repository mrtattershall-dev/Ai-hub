'use strict';
// =============================================================================
// RD-025 bars 2 + 3 — proximity as a bounded aggregation scope.
// Capability is checked against a HAND-COMPUTED oracle over a fixture grid, not
// against the implementation's own arithmetic. Rejections must be localized and
// leave the world untouched. `node spatial_test.js`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');
const P = CORE('persistence.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

const engine = new Engine(64);
// two spatial types + one deliberately NON-spatial type (for the rejection bar)
const A = engine.defineType({ name: 'agent', spatial: { x: 'x', y: 'y' },
  fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 },
            near_count: { range: [0, 255], init: 0 } } });
const B = engine.defineType({ name: 'beacon', spatial: { x: 'x', y: 'y' },
  fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 }, power: { range: [0, 255], init: 0 } } });
const G = engine.defineType({ name: 'ghost', fields: { v: { range: [0, 255], init: 0 } } });  // no coords
ok(A.ok && B.ok && G.ok, 'defineType agent/beacon (spatial) + ghost (non-spatial)');

// ---- bar 3: the schema gate refuses bad spatial declarations -------------------
const sig0 = JSON.stringify(P.save(engine));
ok(!engine.defineType({ name: 'bad1', fields: { x: { range: [0, 9] } }, spatial: { x: 'x', y: 'nope' } }).ok,
  'spatial naming a non-existent field -> refused');
ok(engine.defineType({ name: 'bad2', fields: { x: { range: [0, 9] } }, spatial: { x: 'x' } }).errors
  .some((e) => e.code === 'bad_spatial'), 'spatial missing y -> bad_spatial');
ok(JSON.stringify(P.save(engine)) === sig0, 'refused schema definitions changed NOTHING');

// ---- fixture: hand-placed grid; distances computed BY HAND below ---------------
//   agent0 at (10,10)   beacons: b1(12,10) d=2 | b2(10,14) d=4 | b3(20,10) d=10 | b4(40,40) d~42
const a0 = engine.spawn(A.type, { name: 'a0', x: 10, y: 10 }).uuid;
const b1 = engine.spawn(B.type, { name: 'b1', x: 12, y: 10, power: 7 }).uuid;
const b2 = engine.spawn(B.type, { name: 'b2', x: 10, y: 14, power: 3 }).uuid;
const b3 = engine.spawn(B.type, { name: 'b3', x: 20, y: 10, power: 100 }).uuid;
const b4 = engine.spawn(B.type, { name: 'b4', x: 40, y: 40, power: 200 }).uuid;
const a1 = engine.spawn(A.type, { name: 'a1', x: 11, y: 10 }).uuid;   // another AGENT 1 away from a0
const view = engine._systemView();
ok(JSON.stringify(view.coordsOf(a0)) === '{"x":10,"y":10}' && view.coordsOf(engine.spawn(G.type, {}).uuid) === null,
  'view.coordsOf reads declared coords; null for a type without them');

// ---- bar 2a: count near, against the hand oracle --------------------------------
// radius 5 from (10,10): b1 (d=2) YES, b2 (d=4) YES, b3 (d=10) no, b4 no  -> 2
const rCount = installRule(engine, { name: 'sense', match: { type: 'agent' },
  effects: [{ set: 'near_count', to: { count: { type: 'beacon', of: { near: 5 } } } }] });
ok(rCount.ok, 'count with of:{near:5} installs through the RD-B6 gate');
engine.stepTick();
ok(engine._systemView().field(a0, 'near_count') === 2,
  'oracle: exactly b1(d=2) and b2(d=4) are within radius 5 of a0 -> near_count=2');

// boundary is INCLUSIVE and integer-exact: radius 4 keeps b2 (d=4), radius 3 drops it
installRule(engine, { name: 'sense', match: { type: 'agent' },
  effects: [{ set: 'near_count', to: { count: { type: 'beacon', of: { near: 4 } } } }] }, { replace: true });
engine.stepTick();
ok(engine._systemView().field(a0, 'near_count') === 2, 'radius 4: d=4 is INSIDE (inclusive boundary)');
installRule(engine, { name: 'sense', match: { type: 'agent' },
  effects: [{ set: 'near_count', to: { count: { type: 'beacon', of: { near: 3 } } } }] }, { replace: true });
engine.stepTick();
ok(engine._systemView().field(a0, 'near_count') === 1, 'radius 3: only b1(d=2) remains -> 1');

// self-exclusion: agents counting AGENTS near them must not count themselves.
// a0 has exactly one other agent (a1, d=1) within radius 5.
installRule(engine, { name: 'peers', match: { type: 'agent' },
  effects: [{ set: 'near_count', to: { count: { type: 'agent', of: { near: 5 } } } }] });
engine.stepTick();
ok(engine._systemView().field(a0, 'near_count') === 1, 'self is EXCLUDED from its own near-pool (a0 sees only a1)');

// ---- bar 2b: a field aggregation, near-scoped ------------------------------------
// max power within radius 5 of a0 = max(b1=7, b2=3) = 7  (b3's 100 is out of range)
const rMax = installRule(engine, { name: 'strongest', match: { type: 'agent' },
  effects: [{ set: 'near_count', to: { max: { field: 'power', type: 'beacon', of: { near: 5 } } } }] });
ok(rMax.ok, 'max-of-field with near scope installs');
engine.uninstallRule?.('peers');
require(path.join(__dirname, '..', '..', 'core', 'behavior.js')).uninstallRule(engine, 'peers');
require(path.join(__dirname, '..', '..', 'core', 'behavior.js')).uninstallRule(engine, 'sense');
engine.stepTick();
ok(engine._systemView().field(a0, 'near_count') === 7,
  'oracle: max beacon power within radius 5 = 7 (b1), NOT b3/b4 at 100/200');

// ---- bar 2c: the RANGE PROOF still bites on near-scoped exprs ----------------------
const unclamped = installRule(engine, { name: 'overflow', match: { type: 'agent' },
  effects: [{ set: 'near_count', to: { sum: { field: 'power', type: 'beacon', of: { near: 5 } } } }] });
ok(!unclamped.ok && unclamped.errors.some((e) => e.code === 'range_unprovable'),
  'unclamped near-scoped SUM -> range_unprovable (proximity does not weaken the proof)');
const clamped = installRule(engine, { name: 'overflow', match: { type: 'agent' },
  effects: [{ set: 'near_count', to: { min: [{ sum: { field: 'power', type: 'beacon', of: { near: 5 } } }, 255] } }] });
ok(clamped.ok, 'the same sum with an author-stated clamp installs');

// ---- bar 3 (cont): grammar-level refusals ------------------------------------------
const bad = [
  ['non-spatial matched type', { name: 'x1', match: { type: 'ghost' },
    effects: [{ set: 'v', to: { count: { type: 'beacon', of: { near: 5 } } } }] }, 'not_spatial'],
  ['non-spatial aggregated type', { name: 'x2', match: { type: 'agent' },
    effects: [{ set: 'near_count', to: { count: { type: 'ghost', of: { near: 5 } } } }] }, 'not_spatial'],
  ['negative radius', { name: 'x3', match: { type: 'agent' },
    effects: [{ set: 'near_count', to: { count: { type: 'beacon', of: { near: -1 } } } }] }, 'bad_scope'],
  ['non-integer radius', { name: 'x4', match: { type: 'agent' },
    effects: [{ set: 'near_count', to: { count: { type: 'beacon', of: { near: 2.5 } } } }] }, 'bad_scope'],
  ['malformed scope object', { name: 'x5', match: { type: 'agent' },
    effects: [{ set: 'near_count', to: { count: { type: 'beacon', of: { far: 5 } } } }] }, 'bad_scope'],
];
const sig1 = JSON.stringify(P.save(engine));
for (const [label, rule, code] of bad) {
  const r = installRule(engine, rule);
  ok(!r.ok && r.errors.some((e) => e.code === code), `gate refuses ${label} (${code})`);
}
ok(JSON.stringify(P.save(engine)) === sig1, 'five refused rules changed NOTHING');

// ---- persistence: spatial declarations travel -----------------------------------
const snap = P.save(engine);
ok(snap.schemaDefs.find((d) => d.name === 'agent').spatial.x === 'x', 'snapshot carries the spatial declaration');
const g2 = P.load(JSON.parse(JSON.stringify(snap)));
ok(JSON.stringify(g2._systemView().coordsOf(a0)) === '{"x":10,"y":10}', 'coords survive save/load');
g2.stepTick();
ok(g2._systemView().field(a0, 'near_count') === 7, 'the near-scoped rule reinstalled and still computes 7 post-load');

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-025 spatial scope`);
process.exit(FAIL ? 1 : 0);
