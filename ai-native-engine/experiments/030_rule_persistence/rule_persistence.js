'use strict';
// =============================================================================
// RD-B6 — RULE LIFECYCLE / PERSISTENCE (measured). Closes the confirmed hole:
// installed rules lived OUTSIDE the RD-019 snapshot, so a reloaded world
// silently dropped every authored behavior (probe: systems before save
// ['rule:reap'] -> after reload []). For a project whose thesis is "the model
// AUTHORS logic", losing the authored logic on reload is losing the product.
//
// DECISION UNDER TEST: rules persist as SOURCE JSON (authored content, like
// entities — never the compiled fn), and load RE-RUNS the wire (installRule)
// against the RELOADED world. Revalidation is load-bearing: a match.uuid rule
// whose target died must surface deleted/missing (RD-004.6), not silently
// no-op. Failures go to a persisted QUARANTINE — NO SILENT LOSS: every rule
// ever authored either runs or stays visible with localized errors.
//
// RIVALS measured against it:
//   NC-A  status quo (schema without rules): world silently freezes on reload
//   NC-B  blind reinstall (skip revalidation): dead-target rule reinstalls as
//         a PERMANENT SILENT NO-OP — the D&H bug shape, at the logic layer
//   (persist-compiled-fn is a non-starter, not a rival: a closure doesn't
//    serialize; anything that "rehydrates" one is eval — RD-B1 already
//    rejected emitted code at the boundary.)
//
// `node experiments/030_rule_persistence/rule_persistence.js` -> ALL PASS.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE } = CORE('engine.js');
const { parseRule, installRule, uninstallRule } = CORE('behavior.js');
const P = CORE('persistence.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

const GROW = { name: 'grow', match: { type: 'crop', where: { field: 'water', cmp: '>', value: 0 } },
  effects: [ { set: 'growth', to: { min: [ { add: [ { field: 'growth' }, 5 ] }, 255 ] } },
             { set: 'water',  to: { max: [ { sub: [ { field: 'water' }, 1 ] }, 0 ] } } ] };
const REAP = { name: 'reap', match: { type: 'crop', where: { field: 'growth', cmp: '>=', value: 100 } },
  effects: [ { delete: true } ] };

function farm() {
  const g = new Engine(256);
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const c1 = g.spawn(TYPE.CROP, { name: 'c1', parent: zone, water: 20, growth: 0 }).uuid;
  const c2 = g.spawn(TYPE.CROP, { name: 'c2', parent: zone, water: 5, growth: 10 }).uuid;
  return { g, zone, c1, c2 };
}
const cropSig = (g) => JSON.stringify([...g.w.byUuid.entries()]
  .filter(([, e]) => !g.w.destroyed[e] && g.w.type[e] === TYPE.CROP)
  .map(([u, e]) => [u, g._field(e, 'water'), g._field(e, 'growth')]).sort());

// --- T1: the HOLE, measured (status-quo control NC-A) ------------------------
console.log('=== T1: NC-A status quo — reload silently freezes the world ===');
{
  const { g } = farm();
  installRule(g, GROW);
  const doc = P.save(g);
  const stripped = { ...doc }; delete stripped.rules; delete stripped.rulesQuarantined; // = old schema
  const g2 = P.load(JSON.parse(JSON.stringify(stripped)));
  ok(g2.systems.length === 0, 'T1 old-schema load: zero systems (the confirmed hole)');
  const before2 = cropSig(g2);
  g2.stepTick(); g2.stepTick();
  ok(cropSig(g2) === before2, 'T1 crops FROZEN after reload — authored behavior silently gone (this is what RD-B6 fixes)');
  ok(Array.isArray(g2.ruleLoadReport) && g2.ruleLoadReport.length === 0,
    'T1 ...and the old save still LOADS (back-compat: rules field optional, report empty)');
}

// --- T2: round-trip determinism — the fork test -------------------------------
console.log('\n=== T2: save mid-run, fork, both branches identical for 5 more ticks ===');
{
  const { g } = farm();
  installRule(g, GROW); installRule(g, REAP);
  for (let t = 0; t < 5; t++) g.stepTick();
  const g2 = P.loadText(P.saveText(g));
  ok(g2.systems.map(s => s.name).join() === g.systems.map(s => s.name).join(),
    `T2 systems survive reload in install order: [${g2.systems.map(s => s.name)}]`);
  ok(g2.ruleLoadReport.every(r => r.ok), 'T2 both rules revalidated clean against the reloaded world');
  for (let t = 0; t < 5; t++) { g.stepTick(); g2.stepTick(); }
  ok(cropSig(g) === cropSig(g2), 'T2 fork determinism: original and reloaded worlds byte-identical after 5 more ticks');
  ok(g2.indexesConsistent(), 'T2 indexes consistent on the reloaded branch');
}

// --- T3: match.uuid rule, target LIVE — reinstalls and stays scoped ----------
console.log('\n=== T3: uuid-scoped rule with a live target survives reload, still scoped ===');
{
  const { g, c1, c2 } = farm();
  installRule(g, { name: 'vip', match: { type: 'crop', uuid: c1 },
    effects: [ { set: 'water', to: { min: [ { add: [ { field: 'water' }, 3 ] }, 255 ] } } ] });
  const g2 = P.loadText(P.saveText(g));
  ok(g2.ruleLoadReport.find(r => r.name === 'vip')?.ok === true, 'T3 vip reinstalled (target resolves live in the reloaded world)');
  const w1 = g2._field(g2.w.liveEntity(c1), 'water'), w2 = g2._field(g2.w.liveEntity(c2), 'water');
  g2.stepTick();
  ok(g2._field(g2.w.liveEntity(c1), 'water') === w1 + 3, 'T3 fires on its exact target after reload');
  ok(g2._field(g2.w.liveEntity(c2), 'water') === w2, 'T3 ...and ONLY its target (scoping survived the round-trip)');
}

// --- T4: match.uuid rule, target DELETED before save — quarantined, surfaced -
console.log('\n=== T4: dead-target rule -> quarantine with explicit `deleted`, never silent ===');
{
  const { g, c1 } = farm();
  installRule(g, { name: 'vip', match: { type: 'crop', uuid: c1 }, effects: [ { set: 'water', to: 9 } ] });
  g.submit([{ actor: 'player', ops: [{ kind: 'delete', target: c1 }] }]);   // target dies mid-session
  ok(g.systems.some(s => s.name === 'rule:vip'), 'T4 in-session: rule stays installed after target death (no-ops, existing semantic)');
  const g2 = P.loadText(P.saveText(g));
  ok(!g2.systems.some(s => s.name === 'rule:vip'), 'T4 on reload: dead-target rule NOT reinstalled');
  const q = g2.ruleQuarantine.find(x => x.rule.name === 'vip');
  ok(!!q && q.errors.some(e => e.code === 'target_not_live' && /deleted/.test(e.detail)),
    `T4 quarantined with the RD-004.6 answer: "${q?.errors[0]?.detail}" (deleted — not missing, not wrong-live)`);
  ok(g2.ruleLoadReport.find(r => r.name === 'vip')?.ok === false, 'T4 load report surfaces it (author sees it, author resolves it)');
}

// --- T5: NC-B blind reinstall — why revalidation is load-bearing --------------
console.log('\n=== T5: NC-B blind reinstall admits the dead-target rule as a silent no-op ===');
{
  const { g, c1 } = farm();
  installRule(g, { name: 'vip', match: { type: 'crop', uuid: c1 }, effects: [ { set: 'water', to: 9 } ] });
  g.submit([{ actor: 'player', ops: [{ kind: 'delete', target: c1 }] }]);
  const doc = P.save(g);
  // the rival: compile each saved rule against a PERMISSIVE stub (everything
  // resolves live) and register the fn — reusing the real compiler but
  // skipping liveness. Exactly what "just reinstall it" naively does.
  const stripped = { ...doc }; delete stripped.rules; delete stripped.rulesQuarantined;
  const gB = P.load(JSON.parse(JSON.stringify(stripped)));
  for (const src of doc.rules) {
    // RD-024: parseRule now reads the world's VOCABULARY from engine.w.schema
    // (per-instance since schema authoring). This NC-B stub predates that; give it
    // the real world's schema so the permissive-resolve control still exercises the
    // blind-reinstall path (everything resolves live) instead of crashing in metaFor.
    const stub = { w: { capacity: 256, resolve: () => ({ status: 'live', e: 0 }),
      type: [TYPE[src.match.type.toUpperCase()]], byUuid: new Map(), schema: g.w.schema } };
    const r = parseRule(stub, src);
    if (r.ok) gB.registerSystem(`rule:${r.name}`, r.fn);
  }
  ok(gB.systems.some(s => s.name === 'rule:vip'), 'T5 rival: dead-target rule reinstalled without complaint');
  const before = cropSig(gB);
  gB.stepTick(); gB.stepTick();
  ok(cropSig(gB) === before, 'T5 rival: rule runs forever, matches NOTHING, changes NOTHING — a permanent silent no-op');
  console.log('    [control] no error, no report, no quarantine — the author believes the behavior exists.');
  console.log('              The winner turns this exact state into a localized, visible quarantine entry (T4).');
}

// --- T6: versioning — replace, duplicate, uninstall; all survive round-trip --
console.log('\n=== T6: replace/duplicate/uninstall semantics, persisted ===');
{
  const { g, c1 } = farm();
  installRule(g, GROW);
  const dup = installRule(g, GROW);
  ok(!dup.ok && dup.errors[0].code === 'duplicate_name', 'T6 duplicate install still rejected (RD-B2 identity)');
  const v2 = { ...GROW, effects: [ { set: 'growth', to: { min: [ { add: [ { field: 'growth' }, 7 ] }, 255 ] } } ] };
  ok(installRule(g, v2, { replace: true }).ok, 'T6 replace installs v2 over v1');
  ok(g.systems.filter(s => s.name === 'rule:grow').length === 1, 'T6 exactly one installed rule after replace');
  const bad = installRule(g, { ...GROW, effects: [ { set: 'growth', to: { add: [ { field: 'growth' }, 7 ] } } ] }, { replace: true });
  ok(!bad.ok && g.systems.some(s => s.name === 'rule:grow'),
    'T6 a bad revision NEVER uninstalls the good rule (validate-before-swap)');
  installRule(g, REAP); uninstallRule(g, 'reap');
  ok(!uninstallRule(g, 'reap').ok, 'T6 double-uninstall is a localized error, not a throw');
  const g2 = P.loadText(P.saveText(g));
  const e = g2.w.liveEntity(c1); const before = g2._field(e, 'growth');
  g2.stepTick();
  ok(g2._field(g2.w.liveEntity(c1), 'growth') === before + 7, 'T6 the REPLACED version (v2, +7) is what survives the round-trip');
  ok(!g2.systems.some(s => s.name === 'rule:reap'), 'T6 the uninstalled rule stays uninstalled after reload');
}

// --- T7: NO SILENT LOSS across double round-trip ------------------------------
console.log('\n=== T7: quarantine persists — save/load/save/load never drops a rule ===');
{
  const { g, c1 } = farm();
  installRule(g, GROW);
  installRule(g, { name: 'vip', match: { type: 'crop', uuid: c1 }, effects: [ { set: 'water', to: 9 } ] });
  g.submit([{ actor: 'player', ops: [{ kind: 'delete', target: c1 }] }]);
  const g2 = P.loadText(P.saveText(g));          // vip -> quarantine
  const g3 = P.loadText(P.saveText(g2));         // quarantine must survive the SECOND trip
  ok(g3.systems.some(s => s.name === 'rule:grow'), 'T7 healthy rule still installed after two round-trips');
  const q = g3.ruleQuarantine.find(x => x.rule.name === 'vip');
  ok(!!q, 'T7 quarantined rule STILL visible after two round-trips (no silent loss, ever)');
  ok(q.errors.some(e => e.code === 'target_not_live'), 'T7 ...with its localized reason intact');
}

// --- T8: tombstone-GC interplay — absence stays explicit, degrades honestly --
console.log('\n=== T8: GC drops the tombstone -> quarantine reason degrades deleted->missing, never wrong-live ===');
{
  const { g, c1 } = farm();
  installRule(g, { name: 'vip', match: { type: 'crop', uuid: c1 }, effects: [ { set: 'water', to: 9 } ] });
  g.submit([{ actor: 'player', ops: [{ kind: 'delete', target: c1 }] }]);
  g.gcTombstones();                              // rule sources are an EXTERNAL ref class (RD-019.1
                                                 // open item) — GC does not see them, tombstone drops
  const g2 = P.loadText(P.saveText(g));
  const q = g2.ruleQuarantine.find(x => x.rule.name === 'vip');
  ok(!!q && /missing/.test(q.errors[0]?.detail || ''),
    `T8 after GC the reason is "${q?.errors[0]?.detail}" — degraded metadata (missing, not deleted), still EXPLICIT`);
  ok(!g2.systems.some(s => s.name === 'rule:vip'), 'T8 and it still cannot resolve to any wrong live entity (uuids never recycle)');
  console.log('    [known limit] rule->uuid refs are invisible to refcount GC (RD-019.1 external-ref class);');
  console.log('              cost is deleted->missing detail loss, never a wrong resolution. Retain-flag is future work.');
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
