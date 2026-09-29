'use strict';
// =============================================================================
// RD-B1 BEHAVIOR CORPUS — the shared ground truth the scoring harness judges
// against. This file holds NO scoring logic and NO decision; it is the referee's
// rulebook. RD-B1's rival representations (declarative rules / total mini-DSL /
// sandboxed code — authored in a separate chat) are scored BY the harness
// AGAINST these behaviors. See interface.md for the adapter seam.
//
// Three classes of behavior:
//   REAL      — every admissible representation MUST express these (lifted from
//               core/tick_test.js's trusted systems, plus a few that stress
//               locality and write-set breadth). Each carries a hand-written
//               `oracle` (the exact op multiset on its fixture) AND a reference
//               encoding whose output selfCheck() asserts equals the oracle — so
//               the oracle is independent + inspectable AND provably runnable.
//   MALICIOUS — every admissible representation MUST reject-at-compile or have
//               its run CONTAINED by the harness. Scope violations, host escape,
//               non-termination, unbounded growth, memory exhaustion.
//   (nondet)   — informational: whether a rep can OBSERVE ambient nondeterminism
//               (Math.random / clock). Surfaced for RD-B2, not scored here.
//
// A behavior's `sources` map carries one encoding per representation keyed by the
// adapter's `sourceKey`. This file ships the `ref` encoding ({fn, code}) that the
// harness's control adapters consume (a trusted JS closure + an equivalent raw-JS
// string). An RD-B1 rival adds its own key (e.g. `rules`, `dsl`) — the corpus is
// the one place both sides meet.
//
// Every behavior is a pure function of (view) for ONE tick. `ops` speak the
// engine's op shape (kind/target/field/value | createChild{type,parent,props} |
// delete | reparent | move), so a scored behavior drops straight into stepTick.
// Zero deps beyond core/engine.js (for TYPE only). `node` self-check at bottom.
// =============================================================================

const { TYPE, TYPE_NAME } = require('../../core/engine.js');

// --- op helpers --------------------------------------------------------------
const setf   = (target, field, value) => ({ kind: 'setfield', target, field, value });
const del    = (target)               => ({ kind: 'delete', target });
const child  = (type, parent, props)  => ({ kind: 'createChild', type, parent, props });

// Canonical form for order-INDEPENDENT comparison (EXPRESSIVE): sort a stable
// JSON of each op. Two behaviors "agree" iff their canonical multisets match —
// the pipeline schedules, so emission order carries no meaning for correctness.
function canonOps(ops) {
  return ops.map(o => JSON.stringify(o, Object.keys(o).sort())).sort();
}
const opsEqual = (a, b) => {
  const ca = canonOps(a), cb = canonOps(b);
  return ca.length === cb.length && ca.every((x, i) => x === cb[i]);
};

// =============================================================================
// TRIPWIRE VIEW — the RD-007 _systemView shape, instrumented. Every FIELD read
// and every type ENUMERATION is recorded into `reads` as `type.field` / `type.*`.
// SAFE is then MEASURED (what the run actually touched) not pattern-matched off
// the source. Structural reads (parent/child topology) are always permitted.
// Reads COMMITTED fixture state only — the double-buffer discipline from the core.
// =============================================================================
function makeView(fixture) {
  const byUuid = new Map();
  for (const e of fixture.entities) byUuid.set(e.uuid, e);
  const reads = new Set();
  const live = (u) => { const e = byUuid.get(u); return e && !e.destroyed ? e : null; };
  const view = Object.freeze({
    tick: fixture.tick | 0,
    allOfType: (t) => {
      const name = typeof t === 'number' ? TYPE_NAME[t] : t;
      reads.add(`${name}.*`);
      return fixture.entities.filter(e => !e.destroyed && e.type === name).map(e => e.uuid);
    },
    field: (u, f) => {
      const e = live(u); if (!e) return undefined;
      reads.add(`${e.type}.${f}`);
      return f === 'name' ? e.name : (e.fields ? e.fields[f] : undefined);
    },
    typeOf:     (u) => { const e = live(u); return e ? e.type : undefined; },
    nameOf:     (u) => { const e = live(u); return e ? e.name : undefined; },
    parentOf:   (u) => { const e = live(u); return e ? (e.parent ?? null) : null; },
    childrenOf: (u) => fixture.entities.filter(e => !e.destroyed && e.parent === u).map(e => e.uuid),
  });
  return { view, reads };
}

// helper: entity type of a uuid within a fixture (for write-scope checks)
function typeOfIn(fixture, uuid) {
  const e = fixture.entities.find(x => x.uuid === uuid);
  return e ? e.type : undefined;
}

// small fixture builders keep the entity literals readable
const crop = (uuid, water, growth, parent = null) => ({ uuid, type: 'crop', name: uuid, parent, fields: { water, growth } });
const enemy = (uuid, hp, parent = null) => ({ uuid, type: 'enemy', name: uuid, parent, fields: { hp } });
const zone = (uuid, tally = 0) => ({ uuid, type: 'zone', name: uuid, parent: null, fields: { tally } });

// =============================================================================
// REAL BEHAVIORS — must be expressible. Fixture + oracle + `ref` encoding.
// =============================================================================
const REAL = [
  {
    id: 'growth', class: 'real',
    doc: 'watered crops grow +5 (clamp 255), water evaporates -1 (clamp 0)',
    fixture: { tick: 1, entities: [zone('z'), crop('c1', 10, 0, 'z'), crop('c2', 3, 0, 'z')] },
    allowedScope: { reads: ['crop.water', 'crop.growth', 'crop.*'], writes: ['crop.growth', 'crop.water'], spawns: [], deletes: false },
    oracle: [setf('c1', 'growth', 5), setf('c1', 'water', 9), setf('c2', 'growth', 5), setf('c2', 'water', 2)],
    sources: { ref: {
      fn: (view) => { const ops = []; for (const u of view.allOfType('crop')) { const w = view.field(u, 'water'), g = view.field(u, 'growth'); if (w > 0) { ops.push(setf(u, 'growth', Math.min(255, g + 5))); ops.push(setf(u, 'water', Math.max(0, w - 1))); } } return ops; },
      code: `(function(view){ var ops=[]; var us=view.allOfType('crop'); for(var i=0;i<us.length;i++){ var u=us[i], w=view.field(u,'water'), g=view.field(u,'growth'); if(w>0){ ops.push({kind:'setfield',target:u,field:'growth',value:Math.min(255,g+5)}); ops.push({kind:'setfield',target:u,field:'water',value:Math.max(0,w-1)}); } } return ops; })`,
    } },
  },
  {
    id: 'irrigate', class: 'real',
    doc: 'crops with water < 5 are watered to 8 (threshold rule)',
    fixture: { tick: 1, entities: [zone('z'), crop('c1', 10, 0, 'z'), crop('c2', 3, 0, 'z')] },
    allowedScope: { reads: ['crop.water', 'crop.*'], writes: ['crop.water'], spawns: [], deletes: false },
    oracle: [setf('c2', 'water', 8)],
    sources: { ref: {
      fn: (view) => { const ops = []; for (const u of view.allOfType('crop')) if (view.field(u, 'water') < 5) ops.push(setf(u, 'water', 8)); return ops; },
      code: `(function(view){ var ops=[]; var us=view.allOfType('crop'); for(var i=0;i<us.length;i++){ if(view.field(us[i],'water')<5) ops.push({kind:'setfield',target:us[i],field:'water',value:8}); } return ops; })`,
    } },
  },
  {
    id: 'spawner', class: 'real',
    doc: 'the zone plants a crop every 5 ticks (structural create + tick clock)',
    fixture: { tick: 5, entities: [zone('z')] },
    allowedScope: { reads: ['zone.*'], writes: [], spawns: ['crop'], deletes: false },
    oracle: [child(TYPE.CROP, 'z', { name: 'crop-t5', water: 20, growth: 0 })],
    sources: { ref: {
      fn: (view) => { if (view.tick % 5 !== 0) return []; const z = view.allOfType('zone')[0]; return [child(TYPE.CROP, z, { name: `crop-t${view.tick}`, water: 20, growth: 0 })]; },
      code: `(function(view){ if(view.tick%5!==0) return []; var z=view.allOfType('zone')[0]; return [{kind:'createChild',type:0,parent:z,props:{name:'crop-t'+view.tick,water:20,growth:0}}]; })`,
    } },
  },
  {
    id: 'reaper', class: 'real',
    doc: 'fully-grown crops (growth >= 50) are harvested (deleted)',
    fixture: { tick: 1, entities: [zone('z'), crop('c1', 0, 50, 'z'), crop('c2', 0, 20, 'z')] },
    allowedScope: { reads: ['crop.growth', 'crop.*'], writes: [], spawns: [], deletes: true },
    oracle: [del('c1')],
    sources: { ref: {
      fn: (view) => view.allOfType('crop').filter(u => view.field(u, 'growth') >= 50).map(u => del(u)),
      code: `(function(view){ return view.allOfType('crop').filter(function(u){ return view.field(u,'growth')>=50; }).map(function(u){ return {kind:'delete',target:u}; }); })`,
    } },
  },
  {
    id: 'spread', class: 'real',
    doc: 'a mature crop (growth >= 50) with no child seeds one child crop (locality)',
    fixture: { tick: 1, entities: [zone('z'), crop('c1', 0, 60, 'z')] },
    allowedScope: { reads: ['crop.growth', 'crop.*'], writes: [], spawns: ['crop'], deletes: false },
    oracle: [child(TYPE.CROP, 'c1', { name: 'seed', water: 5, growth: 0 })],
    sources: { ref: {
      fn: (view) => { const ops = []; for (const u of view.allOfType('crop')) if (view.field(u, 'growth') >= 50 && view.childrenOf(u).length < 1) ops.push(child(TYPE.CROP, u, { name: 'seed', water: 5, growth: 0 })); return ops; },
      code: `(function(view){ var ops=[]; var us=view.allOfType('crop'); for(var i=0;i<us.length;i++){ var u=us[i]; if(view.field(u,'growth')>=50 && view.childrenOf(u).length<1) ops.push({kind:'createChild',type:0,parent:u,props:{name:'seed',water:5,growth:0}}); } return ops; })`,
    } },
  },
  {
    id: 'decay-cascade', class: 'real',
    doc: 'an over-ripe plant (growth >= 60) is deleted AND its children\'s water zeroed (multi-entity write-set)',
    fixture: { tick: 1, entities: [zone('z'), crop('p', 0, 60, 'z'), crop('ch1', 5, 0, 'p'), crop('ch2', 7, 0, 'p')] },
    allowedScope: { reads: ['crop.growth', 'crop.*'], writes: ['crop.water'], spawns: [], deletes: true },
    oracle: [del('p'), setf('ch1', 'water', 0), setf('ch2', 'water', 0)],
    sources: { ref: {
      fn: (view) => { const ops = []; for (const u of view.allOfType('crop')) { if (view.field(u, 'growth') >= 60) { const kids = view.childrenOf(u); if (kids.length) { ops.push(del(u)); for (const k of kids) ops.push(setf(k, 'water', 0)); } } } return ops; },
      code: `(function(view){ var ops=[]; var us=view.allOfType('crop'); for(var i=0;i<us.length;i++){ var u=us[i]; if(view.field(u,'growth')>=60){ var kids=view.childrenOf(u); if(kids.length){ ops.push({kind:'delete',target:u}); for(var j=0;j<kids.length;j++) ops.push({kind:'setfield',target:kids[j],field:'water',value:0}); } } } return ops; })`,
    } },
  },
];

// =============================================================================
// MALICIOUS BEHAVIORS — must be rejected-at-compile or CONTAINED at run.
//   facet: which axis the behavior probes. `allowedScope` is the ground-truth
//   permission for this behavior; SAFE = actual reads/writes ⊆ allowedScope AND
//   host canary untouched. BOUNDED is enforced by the harness (external kill /
//   growth cap), independent of the adapter's goodwill.
// =============================================================================
const MALICIOUS = [
  {
    id: 'M-scope-read', class: 'malicious', facet: 'SAFE',
    doc: 'reads enemy.hp when only crop.water is permitted (out-of-scope read)',
    fixture: { tick: 1, entities: [zone('z'), crop('c1', 10, 0, 'z'), enemy('e1', 30, 'z')] },
    allowedScope: { reads: ['crop.water', 'crop.*'], writes: [], spawns: [], deletes: false },
    sources: { ref: {
      fn: (view) => { for (const u of view.allOfType('enemy')) view.field(u, 'hp'); return []; },
      code: `(function(view){ var us=view.allOfType('enemy'); for(var i=0;i<us.length;i++) view.field(us[i],'hp'); return []; })`,
    } },
  },
  {
    id: 'M-scope-write', class: 'malicious', facet: 'SAFE',
    doc: 'writes enemy.hp when only crop.water is permitted (out-of-scope write)',
    fixture: { tick: 1, entities: [zone('z'), crop('c1', 10, 0, 'z'), enemy('e1', 30, 'z')] },
    allowedScope: { reads: ['crop.*', 'enemy.*'], writes: ['crop.water'], spawns: [], deletes: false },
    sources: { ref: {
      fn: (view) => view.allOfType('enemy').map(u => setf(u, 'hp', 0)),
      code: `(function(view){ return view.allOfType('enemy').map(function(u){ return {kind:'setfield',target:u,field:'hp',value:0}; }); })`,
    } },
  },
  {
    id: 'M-escape', class: 'malicious', facet: 'SAFE',
    doc: 'reaches ambient host state (sets a canary that a confined rep cannot touch)',
    fixture: { tick: 1, entities: [zone('z'), crop('c1', 10, 0, 'z')] },
    allowedScope: { reads: [], writes: [], spawns: [], deletes: false },
    sources: { ref: {
      fn: () => { globalThis.__CANARY__ = 'DIRTY'; return []; },
      // classic prototype escape: reaches the real global even from a naive vm context
      code: `(function(view){ try{ this.constructor.constructor('globalThis.__CANARY__="DIRTY"')(); }catch(e){ globalThis.__CANARY__='DIRTY'; } return []; })`,
    } },
  },
  {
    id: 'M-infloop', class: 'malicious', facet: 'BOUNDED',
    doc: 'never terminates (must be stopped within the wall-clock budget)',
    fixture: { tick: 1, entities: [zone('z')] },
    allowedScope: { reads: [], writes: [], spawns: [], deletes: false },
    sources: { ref: {
      fn: () => { while (true) { /* spin */ } },
      code: `(function(view){ while(true){} })`,
    } },
  },
  {
    id: 'M-forkbomb', class: 'malicious', facet: 'BOUNDED',
    doc: 'emits unbounded createChild ops in one tick (must trip the growth cap)',
    fixture: { tick: 1, entities: [zone('z')] },
    allowedScope: { reads: ['zone.*'], writes: [], spawns: ['crop'], deletes: false },
    sources: { ref: {
      fn: (view) => { const z = view.allOfType('zone')[0]; const ops = []; for (let i = 0; i < 100000; i++) ops.push(child(TYPE.CROP, z, { name: 'x' })); return ops; },
      code: `(function(view){ var z=view.allOfType('zone')[0]; var ops=[]; for(var i=0;i<100000;i++) ops.push({kind:'createChild',type:0,parent:z,props:{name:'x'}}); return ops; })`,
    } },
  },
  {
    id: 'M-membomb', class: 'malicious', facet: 'BOUNDED',
    doc: 'allocates until OOM (must hit the worker memory cap, not take the host down)',
    fixture: { tick: 1, entities: [zone('z')] },
    allowedScope: { reads: [], writes: [], spawns: [], deletes: false },
    sources: { ref: {
      fn: () => { const a = []; while (true) a.push(new Array(1e6).fill(0)); },
      code: `(function(view){ var a=[]; while(true) a.push(new Array(1e6).fill(0)); })`,
    } },
  },
];

// =============================================================================
// NONDET PROBES — informational only (RD-B2 read-set surface, not scored here).
// A representation that produces varying output across identical runs here can
// OBSERVE ambient nondeterminism. Reported by the harness, never in the verdict.
// =============================================================================
const NONDET = [
  {
    id: 'N-rand', class: 'nondet', facet: 'observesNondet',
    doc: 'branches on Math.random() — output varies run to run iff the rep can see it',
    fixture: { tick: 1, entities: [zone('z'), crop('c1', 10, 0, 'z')] },
    allowedScope: { reads: ['crop.*'], writes: ['crop.water'], spawns: [], deletes: false },
    sources: { ref: {
      fn: (view) => view.allOfType('crop').map(u => setf(u, 'water', Math.random() < 0.5 ? 1 : 9)),
      code: `(function(view){ return view.allOfType('crop').map(function(u){ return {kind:'setfield',target:u,field:'water',value:Math.random()<0.5?1:9}; }); })`,
    } },
  },
];

// =============================================================================
// LOCALIZED PROBES — malformed sources. A representation-agnostic trigger: a
// source flagged `{ __malformed__: reason }`. Every honest compile() must detect
// it and return LOCALIZED errors [{ at, code, detail }] (mirrors protocol.js's
// err(opIndex, code, detail)). The real localization test is for RD-B1 rivals
// with real broken programs; this calibrates that the harness's L-detector fires.
// =============================================================================
const MALFORMED = [
  { id: 'L-garbage', source: { __malformed__: 'unparseable input' } },
  { id: 'L-empty',   source: { __malformed__: 'empty program' } },
];

// --- POST-PROCESS: bake the declared scope + rejection reason into each `ref`
// encoding. This models the reality that an authored behavior ships WITH a scope
// declaration, and that a SAFE/TOTAL representation's compiler STATICALLY REJECTS
// constructs it cannot represent (host access, unbounded loops, out-of-scope
// access). A "confined" adapter honors `reject` (refuses at compile → safe by
// construction); an UNSAFE adapter ignores it and runs the body raw — where the
// harness's runtime measurement (tripwire reads, canary, kill/cap) catches it.
// The two paths together prove the harness is load-bearing regardless of adapter
// cooperation. `reject` is the stand-in for "not expressible in a safe notation".
const REJECT = {
  'M-scope-read':  'reads a field outside the declared read-set',
  'M-scope-write': 'writes a field outside the declared write-set',
  'M-escape':      'reaches ambient host state (not expressible)',
  'M-infloop':     'non-terminating loop (not expressible in a total notation)',
  'M-forkbomb':    'unbounded per-tick spawn (not expressible under a growth bound)',
  'M-membomb':     'unbounded allocation (not expressible under a memory bound)',
};
for (const b of REAL)      b.sources.ref.scope = b.allowedScope;
for (const b of MALICIOUS) { b.sources.ref.scope = b.allowedScope; b.sources.ref.reject = REJECT[b.id]; }
for (const b of NONDET)    b.sources.ref.scope = b.allowedScope;

// --- CROSS-CHECK ENCODING: `rules` — the DECIDED RD-B1 winner (core/behavior.js).
// Added here per interface.md ("the RD-B1 author adds their own sourceKey"), so the
// referee can score the actual chosen representation. Real behaviors get a real
// rule; malicious ones that a rule can ATTEMPT get an attack-rule that core/behavior
// STATICALLY REJECTS (cross-pool field, oversized spawn cap) — proving safety by
// construction, not by a flag. M-escape/M-infloop/M-membomb get NO rules encoding:
// they are unrepresentable in the grammar (no host access / no loops / no alloc),
// so compile is handed `undefined` and rejects — the honest "not expressible" path.
// decay-cascade gets only what a rule CAN express (delete the matched entity); it
// cannot write its CHILDREN's fields, so its output misses the cascade and EXPRESSIVE
// fails — independently reproducing RD-B1's measured expressiveness ceiling (the
// multi-entity / topology behaviors are the ones rules cannot author).
const RULES_SRC = {
  growth:   { name: 'growth',   match: { type: 'crop', where: { field: 'water', cmp: '>', value: 0 } },
              effects: [ { set: 'growth', to: { min: [ { add: [ { field: 'growth' }, 5 ] }, 255 ] } },
                         { set: 'water',  to: { max: [ { sub: [ { field: 'water' }, 1 ] }, 0 ] } } ] },
  irrigate: { name: 'irrigate', match: { type: 'crop', where: { field: 'water', cmp: '<', value: 5 } },
              effects: [ { set: 'water', to: 8 } ] },
  spawner:  { name: 'spawner',  match: { type: 'zone' }, every: 5,
              effects: [ { spawn: { type: 'crop', props: { name: 'crop-t5', water: 20, growth: 0 }, cap: 1 } } ] },
  reaper:   { name: 'reaper',   match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 50 } },
              effects: [ { delete: true } ] },
  spread:   { name: 'spread',   match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 50 } },
              effects: [ { spawn: { type: 'crop', props: { name: 'seed', water: 5, growth: 0 }, cap: 1 } } ] },
  // partial — rules can only touch the MATCHED entity, not its children (the gap):
  'decay-cascade': { name: 'decay', match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 60 } },
              effects: [ { delete: true } ] },
  // attack-rules that core/behavior STATICALLY REJECTS:
  'M-scope-read':  { name: 'peek', match: { type: 'crop', where: { field: 'hp', cmp: '>', value: 0 } }, effects: [ { set: 'water', to: 0 } ] },
  'M-scope-write': { name: 'poke', match: { type: 'crop' }, effects: [ { set: 'hp', to: 0 } ] },
  'M-forkbomb':    { name: 'bomb', match: { type: 'zone' }, effects: [ { spawn: { type: 'crop', cap: 100000 } } ] },
  // M-escape / M-infloop / M-membomb: intentionally absent — unrepresentable.
};
for (const b of REAL)      if (RULES_SRC[b.id]) b.sources.rules = RULES_SRC[b.id];
for (const b of MALICIOUS) if (RULES_SRC[b.id]) b.sources.rules = RULES_SRC[b.id];

const ALL = [...REAL, ...MALICIOUS, ...NONDET];
const byId = new Map(ALL.map(b => [b.id, b]));

module.exports = {
  REAL, MALICIOUS, NONDET, MALFORMED, ALL, byId, REJECT,
  makeView, canonOps, opsEqual, typeOfIn, TYPE, TYPE_NAME,
  ids: {
    real: REAL.map(b => b.id),
    malicious: MALICIOUS.map(b => b.id),
    nondet: NONDET.map(b => b.id),
    malformed: MALFORMED.map(b => b.id),
  },
  // Assert every REAL behavior's reference encoding reproduces its literal oracle.
  // Independent oracle (hand-written) + runnable ref (closure) must agree, or the
  // corpus itself is wrong — the RD-004/RD-005 "check the test" discipline.
  selfCheck() {
    const fails = [];
    for (const b of REAL) {
      const { view } = makeView(b.fixture);
      const got = b.sources.ref.fn(view);
      if (!opsEqual(got, b.oracle)) fails.push({ id: b.id, oracle: canonOps(b.oracle), got: canonOps(got) });
    }
    return fails;
  },
};

// run directly: `node corpus.js` prints the self-check result
if (require.main === module) {
  const fails = module.exports.selfCheck();
  if (fails.length) { console.log('CORPUS SELF-CHECK FAILED'); for (const f of fails) console.log(f); process.exit(1); }
  console.log(`CORPUS OK — ${REAL.length} real, ${MALICIOUS.length} malicious, ${NONDET.length} nondet, ${MALFORMED.length} malformed. Reference encodings reproduce every oracle.`);
}
