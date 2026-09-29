'use strict';
// =============================================================================
// RD-024 GENERALITY BAR — Pong's vocabulary defined AT RUNTIME through the
// schema gate, then driven through every proven subsystem: spawn, gated
// writes, RD-005 conflicts, an RD-B6 behavior rule over a DYNAMIC field with
// the range proof, the AI wire, save/load with the schema traveling in the
// snapshot, and the unsafe sweep. Zero core edits happen here — that is the
// point. Pre-registered in decisions/RD-024_schema_authoring.md (bar 2 + 3).
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');
const { parseProposal } = CORE('protocol.js');
const P = CORE('persistence.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const unsafeCheck = (g) => {
  let u = 0;
  if (!g.indexesConsistent()) u++;
  for (const [uu, e] of g.w.byUuid) if (g.w.destroyed[e] || g.w.uuid[e] !== uu) u++;
  return u;
};

const engine = new Engine(64);

// ---- 1. define the vocabulary through the gate --------------------------------
// paddle.y and ball.y COEXIST (per-type namespace); no fold on y (contested
// paddle input must DEFER, not auto-merge); ball.score folds additively.
const rPaddle = engine.defineType({ name: 'paddle', fields: { y: { range: [0, 255], init: 128 } } });
ok(rPaddle.ok, `defineType paddle -> ok (type index ${rPaddle.type})`);
const rBall = engine.defineType({ name: 'ball', fields: {
  x: { range: [0, 255], init: 128 }, y: { range: [0, 255], init: 128 },
  score: { range: [0, 4294967295], fold: 'additive', init: 0 } } });
ok(rBall.ok, 'defineType ball (x, y, score) -> ok — y on BOTH types coexists');

// ---- 2. rejection battery (bar 3): the gate refuses, world untouched ----------
const sigBefore = JSON.stringify(P.save(engine));
const bad = [
  ['duplicate type', { name: 'paddle', fields: {} }, 'duplicate_type'],
  ['reserved field', { name: 'thing', fields: { name: { range: [0, 1] } } }, 'reserved_field'],
  ['inverted range', { name: 'thing', fields: { v: { range: [9, 1] } } }, 'bad_range'],
  ['unknown fold', { name: 'thing', fields: { v: { range: [0, 9], fold: 'average' } } }, 'unknown_fold'],
  ['init out of range', { name: 'thing', fields: { v: { range: [0, 9], init: 99 } } }, 'bad_init'],
  ['bad type name', { name: 'Thing!', fields: {} }, 'bad_name'],
];
for (const [label, spec, code] of bad) {
  const r = engine.defineType(spec);
  ok(!r.ok && r.errors.some((e) => e.code === code), `gate refuses ${label} (${code}) with localized error`);
}
ok(JSON.stringify(P.save(engine)) === sigBefore, 'six refusals changed NOTHING (world byte-identical)');

// ---- 3. spawn + gated writes over dynamic types --------------------------------
const p1 = engine.spawn(rPaddle.type, { name: 'left paddle', y: 100 }).uuid;
const p2 = engine.spawn(rPaddle.type, { name: 'right paddle' }).uuid;   // init -> 128
const ball = engine.spawn(rBall.type, { name: 'ball' }).uuid;
const view = engine._systemView();
ok(view.field(p1, 'y') === 100 && view.field(p2, 'y') === 128 && view.field(ball, 'x') === 128,
  'spawn honors props and schema init values');
ok(view.typeOf(ball) === 'ball' && view.allOfType('paddle').length === 2, 'view speaks the new vocabulary');

let r = engine.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: p1, field: 'y', value: 42 }] }]);
ok(r.results[0].status === 'committed' && engine._systemView().field(p1, 'y') === 42, 'gated write to paddle.y commits');
r = engine.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: p1, field: 'score', value: 1 }] }]);
ok(r.results[0].status === 'rejected' && /cross-pool/.test(r.results[0].reasons[0]), 'score on a paddle -> cross-pool REJECTED');
r = engine.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: p1, field: 'y', value: 999 }] }]);
ok(r.results[0].status === 'rejected' && /range/.test(r.results[0].reasons.join()), 'y=999 -> range REJECTED, never truncated');

// ---- 4. RD-005 conflicts on dynamic fields -------------------------------------
r = engine.submit([
  { actor: 'A', ops: [{ kind: 'setfield', target: p1, field: 'y', value: 10 }] },
  { actor: 'B', ops: [{ kind: 'setfield', target: p1, field: 'y', value: 200 }] },
]);
ok(r.deferrals.length === 1 && engine._systemView().field(p1, 'y') === 42,
  'contested paddle.y (no fold declared) DEFERS — neither write lands, conflict surfaced');
r = engine.submit([
  { actor: 'A', ops: [{ kind: 'setfield', target: ball, field: 'score', value: 1 }] },
  { actor: 'B', ops: [{ kind: 'setfield', target: ball, field: 'score', value: 2 }] },
]);
ok(engine._systemView().field(ball, 'score') === 3, 'contested ball.score folds ADDITIVELY (1+2=3) as declared');

// ---- 5. an RD-B6 behavior rule over a DYNAMIC field, range proof intact --------
const unclamped = installRule(engine, { name: 'drift_bad', match: { type: 'ball' },
  effects: [{ set: 'x', to: { add: [{ field: 'x' }, 3] } }] });
ok(!unclamped.ok && unclamped.errors.some((e) => e.code === 'range_unprovable'),
  'unclamped drift on ball.x -> range proof REFUSES it (the gate reasons about a field born at runtime)');
const drift = installRule(engine, { name: 'drift', match: { type: 'ball' },
  effects: [{ set: 'x', to: { min: [{ add: [{ field: 'x' }, 3] }, 255] } }] });
ok(drift.ok, 'clamped drift installs through the RD-B6 gate');
const x0 = engine._systemView().field(ball, 'x');
engine.stepTick(); engine.stepTick();
ok(engine._systemView().field(ball, 'x') === x0 + 6, `the rule RUNS: ball.x ${x0} -> ${x0 + 6} over two ticks`);

// ---- 6. the AI wire speaks the new vocabulary -----------------------------------
const prop = parseProposal(engine, JSON.stringify({ actor: 'ai', ops: [
  { op: 'setfield', target: p2, field: 'y', value: 77 },
  { op: 'createChild', childType: 'ball', parent: null, props: { name: 'ball 2' } },
] }));
ok(prop.ok, 'parseProposal validates dynamic-type ops');
const bad2 = parseProposal(engine, JSON.stringify({ actor: 'ai', ops: [
  { op: 'setfield', target: p2, field: 'x', value: 5 }] }));
ok(!bad2.ok && bad2.errors[0].code === 'field_type_mismatch', 'wire rejects ball-field on a paddle with the owner named');

// ---- 7. save/load: the vocabulary TRAVELS with the world -------------------------
const snap = P.save(engine);
ok(Array.isArray(snap.schemaDefs) && snap.schemaDefs.some((d) => d.name === 'ball'), 'snapshot carries schemaDefs');
const g2 = P.load(JSON.parse(JSON.stringify(snap)));
const v2 = g2._systemView();
ok(v2.typeOf(ball) === 'ball' && v2.field(ball, 'x') === x0 + 6 && v2.field(p1, 'y') === 42,
  'load rebuilds dynamic types + values byte-faithfully');
ok([...g2.ruleSources.keys()].includes('drift'), 'the dynamic-field rule reinstalled through the gate on load');
g2.stepTick();
ok(v2.field(ball, 'x') === x0 + 9, 'and it keeps RUNNING post-load');

// ---- 8. invariants ---------------------------------------------------------------
ok(unsafeCheck(engine) === 0 && unsafeCheck(g2) === 0, 'unsafe sweep: 0 on both worlds');

console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — Pong vocabulary at runtime, zero core edits`);
process.exit(FAIL ? 1 : 0);
