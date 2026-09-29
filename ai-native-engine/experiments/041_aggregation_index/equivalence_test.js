'use strict';
// =============================================================================
// RD-026 bars 2 + 3 — the ANTI-H3 bar. Acceleration that changes semantics is
// not acceleration. Every aggregation form x every scope is run through 120
// ticks (WITH spawns and deletes churning the world) twice — accelerated and
// not — and the two runs must be byte-identical in RESULT and in OP ORDER.
// Determinism: a third run repeats the accelerated one exactly.
// `node equivalence_test.js`
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule, parseRule, setAccel } = CORE('behavior.js');
const P = CORE('persistence.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// Every (aggregation x scope) the grammar admits. `near` needs coords; children/
// subtree need the containment tree — the fixture below has both.
const RULES = [
  ['count/all',       { count: { type: 'mote' } }],
  ['count/all+where', { count: { type: 'mote', where: { field: 'v', cmp: '>', value: 50 } } }],
  ['count/children',  { count: { type: 'mote', of: 'children' } }],
  ['count/subtree',   { count: { type: 'mote', of: 'subtree' } }],
  ['count/near',      { count: { type: 'mote', of: { near: 12 } } }],
  ['count/near+where',{ count: { type: 'mote', of: { near: 12 }, where: { field: 'v', cmp: '<', value: 128 } } }],
  ['sum/all',         { sum: { field: 'v', type: 'mote' } }],
  ['sum/near',        { sum: { field: 'v', type: 'mote', of: { near: 12 } } }],
  ['sum/children',    { sum: { field: 'v', type: 'mote', of: 'children' } }],
  ['min/all',         { min: { field: 'v', type: 'mote' } }],
  ['min/near',        { min: { field: 'v', type: 'mote', of: { near: 12 } } }],
  ['max/all',         { max: { field: 'v', type: 'mote' } }],
  ['max/near',        { max: { field: 'v', type: 'mote', of: { near: 12 } } }],
  ['max/subtree',     { max: { field: 'v', type: 'mote', of: 'subtree' } }],
];

// A world that CHURNS: motes spawn under the hub every 5 ticks, the ripest is
// deleted every 7 — so pools, coords and the tree all move under the cache.
function run(accel, seed = 0) {
  setAccel(accel);
  const g = new Engine(512);
  const M = g.defineType({ name: 'mote', spatial: { x: 'x', y: 'y' },
    fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 },
              v: { range: [0, 255], init: 0 }, out: { range: [0, 255], init: 0 } } });
  const H = g.defineType({ name: 'hub', spatial: { x: 'x', y: 'y' },
    fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 }, out: { range: [0, 255], init: 0 } } });
  const hub = g.spawn(H.type, { name: 'hub', x: 128, y: 128 }).uuid;
  for (let i = 0; i < 40; i++)
    g.spawn(M.type, { name: `m${i}`, parent: i % 3 === 0 ? hub : undefined, x: (i * 29 + seed) % 256, y: (i * 47) % 256, v: (i * 13) % 256 });
  // one rule per (agg x scope), each writing into its own subject's `out`,
  // clamped so the range proof passes — the point is the VALUE, byte-compared.
  for (const [label, expr] of RULES) {
    const r = installRule(g, { name: label.replace(/[^a-z]/g, '_'), match: { type: 'hub' },
      effects: [{ set: 'out', to: { min: [expr, 255] } }] });
    if (!r.ok) throw new Error(`${label} failed to install: ${JSON.stringify(r.errors)}`);
  }
  // churn systems: spawn + delete under the same gate everything else uses
  g.registerSystem('spawner', (v) => (v.tick % 5 === 0
    ? [{ kind: 'createChild', type: M.type, parent: hub, props: { name: `s${v.tick}`, x: (v.tick * 37) % 256, y: (v.tick * 53) % 256, v: (v.tick * 7) % 256 } }] : []));
  g.registerSystem('reaper', (v) => {
    if (v.tick % 7 !== 0) return [];
    const all = v.allOfType('mote');
    return all.length > 12 ? [{ kind: 'delete', target: all[0] }] : [];
  });

  const trace = [];
  for (let t = 0; t < 120; t++) {
    const r = g.stepTick();
    // record every op the rules emitted, in order, with its value
    trace.push(r.results.map((x) => `${x.actor}|${x.status}|${(x.reasons ?? []).join('~')}`).join(';'));
    trace.push(`out=${g._systemView().field(hub, 'out')}`);
    trace.push(`pop=${g._systemView().allOfType('mote').length}`);
  }
  setAccel(true);
  return { trace: trace.join('\n'), save: JSON.stringify(P.save(g)) };
}

// ---- bar 2: ON vs OFF, byte-identical ---------------------------------------
const off = run(false), on = run(true);
ok(off.trace === on.trace, `120 ticks x ${RULES.length} aggregation forms (all/children/subtree/near, with spawns+deletes): trace byte-identical ON vs OFF`);
ok(off.save === on.save, 'final world state byte-identical ON vs OFF');

// ---- bar 3: determinism (accelerated run repeats exactly) --------------------
const on2 = run(true);
ok(on.trace === on2.trace && on.save === on2.save, 'accelerated run is deterministic across repeats');

// ---- the memo must NOT leak across ticks (world changes between them) --------
{
  setAccel(true);
  const g = new Engine(64);
  const T = g.defineType({ name: 'blob', fields: { n: { range: [0, 255], init: 0 } } });
  g.spawn(T.type, { name: 'a' }); g.spawn(T.type, { name: 'b' });
  installRule(g, { name: 'census', match: { type: 'blob' },
    effects: [{ set: 'n', to: { min: [{ count: { type: 'blob' } }, 255] } }] });
  g.stepTick();
  const first = g._systemView().field(g._systemView().allOfType('blob')[0], 'n');
  g.spawn(T.type, { name: 'c' });                       // world grows BETWEEN ticks
  g.stepTick();
  const second = g._systemView().field(g._systemView().allOfType('blob')[0], 'n');
  ok(first === 2 && second === 3, `memo is per-tick only: count 2 -> spawn -> count 3 (got ${first} -> ${second})`);
}

// ---- a scope-VARIANT aggregation must never be memoized across entities -----
{
  setAccel(true);
  const g = new Engine(64);
  const M = g.defineType({ name: 'node', spatial: { x: 'x', y: 'y' },
    fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 }, near_n: { range: [0, 255], init: 0 } } });
  // three nodes: a(0,0) b(5,0) c(200,200). radius 10: a sees b, b sees a, c sees none.
  const a = g.spawn(M.type, { name: 'a', x: 0, y: 0 }).uuid;
  const b = g.spawn(M.type, { name: 'b', x: 5, y: 0 }).uuid;
  const c = g.spawn(M.type, { name: 'c', x: 200, y: 200 }).uuid;
  installRule(g, { name: 'prox', match: { type: 'node' },
    effects: [{ set: 'near_n', to: { min: [{ count: { type: 'node', of: { near: 10 } } }, 255] } }] });
  g.stepTick();
  const v = g._systemView();
  ok(v.field(a, 'near_n') === 1 && v.field(b, 'near_n') === 1 && v.field(c, 'near_n') === 0,
    `near is per-entity, never memoized across entities (a=1 b=1 c=0, got ${v.field(a, 'near_n')} ${v.field(b, 'near_n')} ${v.field(c, 'near_n')})`);
}

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-026 equivalence & determinism`);
process.exit(FAIL ? 1 : 0);
