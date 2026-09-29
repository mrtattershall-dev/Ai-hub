'use strict';
// =============================================================================
// RD-B6.1 — RD-B5 x RD-B6 COMPOSITION: save/reload MID-SESSION, with the
// boundary placed ON TOP of the exact multi-rule phenomena the RD-B5
// calibration surfaced. Both parents are individually closed; their seam has
// never been crossed:
//   - RD-B6's fork-determinism test (030 T2) saves a 5-tick world where NO
//     crop ever reaches the reap threshold — the round-trip never crosses a
//     delete, a spawn, a fold arbitration, or the atomicity-coupling tick.
//   - RD-B5's calibration (029) exercises all of those — and never saves.
// The question: is a mid-session reload OBSERVATIONALLY INVISIBLE to a
// running multi-rule session? Concretely, for each RD-B5 phenomenon, fork the
// world at (or immediately before) the phenomenon and demand the reloaded
// branch is tick-for-tick IDENTICAL to the branch that never saved — traces
// (ops/actor, rejections, fold arbitrations, spawns/reaps) AND authoritative
// state (saveText bytes, which include uuid mints and tombstones). Honest
// division of labor (verified by reverting the orderKey fix): traces are
// BLIND to sibling order — the byte/orderedChildren checks are what catch
// this bug class; traces catch behavioral divergence (rejections, spawns).
//
// Why identity is the right bar: RD-019 fork determinism + RD-B6 revalidation
// each promise it separately; composition is where promises usually leak
// (RD-B2's fuzzer found the identity gap only at composition, RD-B5's
// calibration found opposed-fold only at composition).
//
// CONTROLS (the equality assertions must be shown to BITE):
//   NC-A (029-shape) an old-schema reload (rules stripped) diverges — frozen
//        world, spliced observable FAILS — so trace-equality is not vacuous.
//   T4's in-session-vs-reload roster divergence is DOCUMENTED, not hidden:
//        a dead-target rule no-ops in-session but is quarantined on reload;
//        state trajectories must still match (stepTick emits no tx for a
//        no-op system), while save bytes legitimately differ (rules vs
//        rulesQuarantined) — asserted precisely, not averaged away.
//
// `node experiments/031_reload_composition/reload_composition.js` -> ALL PASS.
// Zero deps. Reuses the 029 apparatus (fixture, rule-sets, observable,
// classifier) and the real wire + persistence — no parallel implementations.
// =============================================================================
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE, foldSemantics, isFoldable, NO_ROW } = CORE('engine.js');
const { installRule } = CORE('behavior.js');
const P = CORE('persistence.js');
const { buildFarm, checkFarmObservable, classifyOpGrowth,
        ORACLE_RULES, OPPOSED_FOLD_RULES, DELETE_VS_WRITE_RULES } =
  require(path.join(__dirname, '..', '029_multirule_session', 'multirule_session.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// ---- instrumented stepper for an EXISTING engine ------------------------------
// Same per-tick record as 029's runSession (so traces are comparable with the
// calibration), but parameterized by engine: the whole point here is stepping
// ONE world, saving it, and stepping TWO worlds from the fork.
function traceTicks(g, ticks) {
  let lastBatch = null;
  const origSubmit = g.submit.bind(g);
  g.submit = (batch) => { lastBatch = batch; return origSubmit(batch); };
  const trace = [];
  let unsafe = 0;
  for (let t = 0; t < ticks; t++) {
    const r = g.stepTick();
    const batch = lastBatch ?? [];
    const opsByActor = {}, rejected = [];
    let totalOps = 0, spawns = 0, reaps = 0;
    batch.forEach((tx, i) => {
      opsByActor[tx.actor] = (opsByActor[tx.actor] ?? 0) + tx.ops.length;
      totalOps += tx.ops.length;
      const st = r.results[i]?.status;
      if (st === 'committed') for (const op of tx.ops) {
        if (op.kind === 'createChild') spawns++;
        if (op.kind === 'delete') reaps++;
      }
      if (st === 'rejected') rejected.push({ actor: tx.actor, reasons: r.results[i].reasons });
    });
    // silent-fold-arbitration detector, verbatim from 029 (same instrument,
    // same reading — a reload must not change what it counts)
    const writes = new Map();
    batch.forEach((tx, i) => {
      if (r.results[i]?.status !== 'committed') return;
      for (const op of tx.ops) if (op.kind === 'setfield') {
        const e = g.w.liveEntity(op.target);
        const ty = e >= 0 ? g.w.type[e] : null;
        const k = `${op.target}|${op.field}`;
        (writes.get(k) ?? writes.set(k, []).get(k)).push({ actor: tx.actor, value: op.value, ty });
      }
    });
    let foldArbitrations = 0;
    for (const [k, ws] of writes) {
      const actors = new Set(ws.map(w => w.actor)), values = new Set(ws.map(w => w.value));
      if (actors.size >= 2 && values.size >= 2 && ws[0].ty !== null
          && isFoldable(foldSemantics(ws[0].ty, k.split('|')[1]))) foldArbitrations++;
    }
    const liveCrops = g.w.byType.get(TYPE.CROP)?.size ?? 0;
    let maxGrowth = 0;
    for (const e of g.w.byType.get(TYPE.CROP) ?? []) maxGrowth = Math.max(maxGrowth, g._field(e, 'growth'));
    if (!g.indexesConsistent()) unsafe++;
    for (const [u, e] of g.w.byUuid) if (g.w.destroyed[e] || g.w.uuid[e] !== u) unsafe++;
    trace.push({ tick: r.tick, totalOps, opsByActor, committed: r.committed,
      rejected, deferrals: r.deferrals, foldArbitrations, spawns, reaps, liveCrops, maxGrowth });
    lastBatch = null;
  }
  g.submit = origSubmit;
  return { trace, unsafe };
}

const J = JSON.stringify;
// entity-state-only signature: everything authoritative EXCEPT the rule sets.
// Used exactly once (T4), where the rule ROSTER legitimately differs between
// branches while the WORLD must not.
const worldSig = (g) => { const d = P.save(g); return J({ e: d.entities, t: d.tombstones, s: d.uuidSeq, k: d.tick }); };

// --- T1: ORACLE loop, reload mid-churn — the full farming loop crosses the seam
console.log('=== T1: oracle loop, save at tick 25 (post-reap, mid-reseed) — fork invisible ===');
{
  const { g } = buildFarm();
  const installErrs = ORACLE_RULES.map(r => installRule(g, r)).filter(r => !r.ok);
  ok(installErrs.length === 0, 'T1 all 4 oracle rules install');
  const pre = traceTicks(g, 25);
  ok(pre.trace.reduce((n, t) => n + t.reaps, 0) >= 1 && g.w.tombstones.size >= 1,
    `T1 fork point is PAST a delete (tombstones=${g.w.tombstones.size}) — 030 T2 never crossed one`);
  const snap = P.saveText(g);
  const g2 = P.loadText(snap, 256);
  ok(g2.ruleLoadReport.length === 4 && g2.ruleLoadReport.every(r => r.ok),
    'T1 all 4 rules revalidate clean against the mid-churn world');
  ok(g2.tick === g.tick, `T1 tick preserved (${g2.tick}) — reseed's every:3 cadence depends on it`);
  const postA = traceTicks(g, 15);        // the branch that never saved
  const postB = traceTicks(g2, 15);       // the reloaded branch
  ok(J(postB.trace) === J(postA.trace),
    'T1 15 post-fork ticks TICK-FOR-TICK identical (ops/actor, rejections, spawns, reaps, populations)');
  ok(postB.trace.reduce((n, t) => n + t.spawns, 0) >= 3 && postB.trace.reduce((n, t) => n + t.reaps, 0) >= 1,
    'T1 ...and the compared window itself contains spawns AND reaps (not a quiet stretch)');
  ok(P.saveText(g) === P.saveText(g2),
    'T1 authoritative state BYTE-IDENTICAL after 15 more ticks — incl. post-reload uuid mints (uuidSeq linchpin) and tombstones');
  // regression pin for the bug THIS check found on first run: spawn's default
  // orderKey was the entity INDEX, which load compacts — post-reload seeds got
  // smaller keys and interleaved among pre-fork crops in the ordered view
  // (A: u2,ua,ub,uc,... vs B: u2,uc,ua,ud,ub,...). Fixed in engine.js (default
  // now derives from the persisted identity seq). Assert the VISIBLE symptom:
  const zoneUuid = g.w.uuid[0];
  ok(g.orderedChildren(zoneUuid).join() === g2.orderedChildren(zoneUuid).join(),
    `T1 RD-005.3 ordered view identical across the seam: [${g2.orderedChildren(zoneUuid)}]`);
  ok(postA.unsafe === 0 && postB.unsafe === 0, 'T1 zero unsafe events on both branches');
  const spliced = pre.trace.concat(postB.trace);
  const obs = checkFarmObservable(spliced, pre.unsafe + postB.unsafe);
  ok(obs.pass, `T1 the 40-tick temporal observable holds ACROSS the reload seam: ${J(obs.clauses)}`);
  ok(classifyOpGrowth(spliced).label !== 'superlinear',
    `T1 spliced op growth still ${classifyOpGrowth(spliced).label} — reload adds no op inflation`);

  // NC-A control: the equality bar must BITE. Old-schema reload (rules
  // stripped) = RD-B6's measured hole; its branch must visibly diverge.
  const doc = JSON.parse(snap); delete doc.rules; delete doc.rulesQuarantined;
  const gC = P.load(doc, 256);
  const postC = traceTicks(gC, 15);
  ok(postC.trace.reduce((n, t) => n + t.totalOps, 0) === 0 && J(postC.trace) !== J(postA.trace),
    'T1 NC-A control: rule-less reload freezes and DIVERGES — the identity assertions are not vacuous');
  ok(!checkFarmObservable(pre.trace.concat(postC.trace), 0).pass,
    'T1 NC-A control: spliced observable FAILS without the rules (checker bites across the seam too)');
}

// --- T2: reload ON TOP of the opposed-fold event — arbitration is reload-invariant
console.log('\n=== T2: opposed-fold (boost+10 vs decay-3), save mid-arbitration ===');
{
  const { g, c1 } = buildFarm();
  for (const r of OPPOSED_FOLD_RULES) installRule(g, r);
  const pre = traceTicks(g, 5);           // arbitration fires on both crops every tick
  ok(pre.trace.every(t => t.foldArbitrations === 2),
    'T2 fork point is INSIDE the phenomenon: 2 fold arbitrations/tick for all 5 pre-fork ticks');
  const g2 = P.loadText(P.saveText(g), 256);
  const postA = traceTicks(g, 5);
  const postB = traceTicks(g2, 5);
  ok(J(postB.trace) === J(postA.trace), 'T2 post-fork traces identical — same arbitrations, zero deferrals, same winner');
  ok(postB.trace.every(t => t.foldArbitrations === 2 && t.deferrals.length === 0),
    'T2 arbitration continues at 2/tick with 0 deferrals after reload — the fold decision does not re-open at the seam');
  const g1v = g._field(g.w.liveEntity(c1), 'growth'), g2v = g2._field(g2.w.liveEntity(c1), 'growth');
  ok(g1v === 100 && g2v === 100,
    `T2 c1 growth = ${g2v} after 10 ticks on BOTH branches = +10/tick exactly — decay's contribution is discarded IDENTICALLY across the reload (the silent arbitration is at least deterministic; the RD-B5 H2 signal gap is unchanged, neither fixed nor worsened by persistence)`);
  ok(P.saveText(g) === P.saveText(g2), 'T2 state bytes identical');
  ok(postA.unsafe + postB.unsafe === 0, 'T2 zero unsafe events');
}

// --- T3: reload IMMEDIATELY BEFORE the delete-vs-write coupling tick ------------
console.log('\n=== T3: delete-vs-write — save at tick 2, the coupling fires at tick 3 ===');
{
  const { g } = buildFarm();
  for (const r of DELETE_VS_WRITE_RULES) installRule(g, r);
  const pre = traceTicks(g, 2);
  ok(pre.trace[1].maxGrowth === 100, 'T3 c2 hits 100 at tick 2 — the reap+rejection lands on the FIRST post-reload tick');
  const g2 = P.loadText(P.saveText(g), 256);
  const postA = traceTicks(g, 4);
  const postB = traceTicks(g2, 4);
  const t3 = postB.trace[0];
  ok(t3.reaps === 1, 'T3 reload-then-tick: reap lands (the reloaded rule set reproduces the event)');
  const rej = t3.rejected.find(x => x.actor === 'sys:rule:fert');
  ok(!!rej && /cannot write .* destroyed/.test(rej.reasons[0] || ''),
    `T3 fert tx rejected at the VALIDATE layer with the same localized reason: "${rej?.reasons[0]}"`);
  ok(t3.maxGrowth === 60 && postB.trace[1].maxGrowth === 90,
    'T3 innocent-target stall (60) and next-tick recovery (90) reproduce exactly on the reloaded branch');
  ok(J(postB.trace) === J(postA.trace) && P.saveText(g) === P.saveText(g2),
    'T3 both branches identical through the coupling event — trace and state bytes');
  ok(postA.unsafe + postB.unsafe === 0, 'T3 zero unsafe events');
}

// --- T4: a RULE reaps another rule's match.uuid target, THEN the world reloads --
// New composition: RD-B6's quarantine (030 T4) was driven by a PLAYER delete;
// here the deletion is authored behavior (RD-B5 dynamics) and the reload must
// still resolve it to an explicit `deleted` quarantine — plus the documented
// roster divergence: in-session the dead-target rule stays as a no-op, after
// reload it is quarantined; the WORLD trajectory must be identical either way.
console.log('\n=== T4: rule-kills-rule\'s-target, then reload -> quarantine; world unchanged ===');
{
  const { g, c2 } = buildFarm();
  for (const r of DELETE_VS_WRITE_RULES) installRule(g, r);
  installRule(g, { name: 'vip', match: { type: 'crop', uuid: c2 },
    effects: [ { set: 'water', to: 9 } ] });
  const pre = traceTicks(g, 3);           // tick 3: reap deletes c2 (vip's target)
  const t3 = pre.trace[2];
  ok(t3.reaps === 1 && t3.rejected.some(x => x.actor === 'sys:rule:vip'),
    'T4 at the reap tick, vip\'s write to its dying target is rejected alongside fert (both couplings visible)');
  ok(g.systems.some(s => s.name === 'rule:vip'), 'T4 in-session: vip stays installed after its target dies (no-op semantic)');
  const g2 = P.loadText(P.saveText(g), 256);
  const q = g2.ruleQuarantine.find(x => x.rule.name === 'vip');
  ok(!!q && q.errors.some(e => e.code === 'target_not_live' && /deleted/.test(e.detail)),
    `T4 on reload: vip quarantined with the explicit RD-004.6 answer ("${q?.errors[0]?.detail}") — a rule-authored delete quarantines exactly like a player delete`);
  ok(g2.systems.filter(s => s.name.startsWith('rule:')).length === 2 && g2.ruleQuarantine.length === 1,
    'T4 accounting: 3 rules authored = 2 reinstalled + 1 quarantined — no silent loss when rules kill rules\' targets');
  const postA = traceTicks(g, 3);         // vip present as a no-op actor
  const postB = traceTicks(g2, 3);        // vip absent (quarantined)
  ok(J(postB.trace) === J(postA.trace),
    'T4 world trajectory identical despite the roster divergence — a no-op system emits no tx, so the quarantine changes NOTHING observable');
  ok(worldSig(g) === worldSig(g2),
    'T4 entity state, tombstones, uuidSeq, tick all identical (save bytes differ ONLY in rules-vs-quarantine placement, as designed)');
  const g3 = P.loadText(P.saveText(g2), 256);
  ok(!!g3.ruleQuarantine.find(x => x.rule.name === 'vip'),
    'T4 quarantine survives a further round-trip mid-session (030 T7, now under session dynamics)');
  ok(postA.unsafe + postB.unsafe === 0, 'T4 zero unsafe events');
}

// --- T5: the reloaded session still composes with history — one tick, one undo -
console.log('\n=== T5: post-reload multi-rule tick is still ONE undo step ===');
{
  const { g } = buildFarm();
  for (const r of ORACLE_RULES) installRule(g, r);
  traceTicks(g, 5);
  const g2 = P.loadText(P.saveText(g), 256);
  g2.enableHistory();
  const sig = () => J([...g2.w.byUuid.entries()].map(([u, e]) =>
    [u, g2.w.type[e] === TYPE.CROP ? [g2._field(e, 'water'), g2._field(e, 'growth')] : null]));
  const before = sig();
  g2.stepTick();
  ok(sig() !== before, 'T5 post-reload tick mutated the world (reinstalled rules fired)');
  const u = g2.undo();
  ok(u.ok && sig() === before, 'T5 ONE undo reverses the whole reinstalled-rule tick (RD-020 composes through persistence)');
}

// --- T6: adversarial-review + fuzz-P6 findings, pinned -------------------------
// The independent review falsified the ABSOLUTE invisibility claim on three
// unpersisted state classes; the fuzzer's new P6 reload-fork arm then found a
// fourth. Each is now either FIXED (a,b,d) or an EXPLICIT documented boundary
// (c). This block is the regression pin for all four.
console.log('\n=== T6: seam boundaries — review/fuzz findings pinned ===');
{
  // (a) non-finite orderKey: the engine used to COMMIT Infinity/NaN, which JSON
  // rewrites to null and load then silently replaced — reload visibly reordered
  // siblings. Now rejected at validate, localized.
  const { g, c1 } = buildFarm();
  const r = g.submit([{ actor: 'p', ops: [{ kind: 'setfield', target: c1, field: 'orderKey', value: Infinity }] }]);
  ok(r.results[0].status === 'rejected' && /finite/.test(r.results[0].reasons[0] || ''),
    `T6a non-finite orderKey rejected at validate: "${r.results[0].reasons[0]}"`);
  const rn = g.submit([{ actor: 'p', ops: [{ kind: 'setfield', target: c1, field: 'orderKey', value: NaN }] }]);
  ok(rn.results[0].status === 'rejected', 'T6a NaN rejected too — P4 finiteness is now ENFORCED, not just asserted');
}
{
  // (b) capacity is authoritative and persists: count-expr range proofs and the
  // world-full boundary no longer depend on what the LOADER happens to pass.
  const { g } = buildFarm(200);
  const g2 = P.loadText(P.saveText(g));               // deliberately NO hint
  ok(g2.w.capacity === 200, `T6b capacity round-trips without a hint (${g2.w.capacity}) — revalidation verdicts are reload-stable by construction`);
}
{
  // (c) claims are SESSION state, ephemeral by decision (RD-002/RD-020, like
  // history): reload RELEASES them. This is the one documented observable
  // divergence class across the seam — explicit, not silent. Expiry/disconnect
  // semantics belong to the open claim-TTL card.
  const { g, c1 } = buildFarm();
  g.submit([{ actor: 'player', ops: [{ kind: 'claim', target: c1, ticks: 10 }] }]);
  ok(g.claims.size === 1, 'T6c claim held at save time');
  const g2 = P.loadText(P.saveText(g));
  ok(g2.claims.size === 0, 'T6c ...and released by reload — documented boundary, pinned so it can never become a silent surprise');
}
{
  // (d) dangling parent edges survive reload (fuzz P6's catch): RD-005.2 keeps
  // an orphan SURFACED-not-cascaded in-session; load used to silently root it —
  // parentOf answered differently, sibling sets (move keys) and RD-019.1 GC
  // reachability diverged. Tombstoned parents now re-materialize as stub
  // destroyed rows (chains included — cycle walks traverse dead rows).
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'z' }).uuid;
  const crop = g.spawn(TYPE.CROP, { name: 'kid', parent: zone, water: 1 }).uuid;
  g.submit([{ actor: 'p', ops: [{ kind: 'delete', target: zone }] }]);
  const g2 = P.loadText(P.saveText(g));
  const pOf = (eng, u) => { const e = eng.w.liveEntity(u); const p = eng.w.parent[e]; return p >= 0 ? eng.w.uuid[p] : null; };
  ok(pOf(g, crop) === zone && pOf(g2, crop) === zone,
    `T6d orphan's dangling parent survives reload (${pOf(g2, crop)}) — surfaced, not silently rooted`);
  ok(g2.w.byUuid.get(zone) === undefined && g2.w.resolve(zone).status === 'deleted',
    'T6d stub is destroyed-row shaped: absent from byUuid, resolves `deleted` with metadata');
  ok(g.gcTombstones().kept.includes(zone) && g2.gcTombstones().kept.includes(zone),
    'T6d GC parity: the dangling parent keeps the tombstone alive on BOTH branches (RD-019.1)');
}
{
  // (e) a stub has NO component pool row — its componentIndex carries the
  // NO_ROW sentinel (Uint32: a literal -1 would store the same bits but make
  // every `< 0` check silently dead — the shape that hid finding (a)). Pool-
  // field access through it must THROW, not return undefined / no-op: nothing
  // legitimate ever reads component fields of a destroyed entity, so any such
  // read is a bug that must fail loudly.
  const g = new Engine(64);
  const zone = g.spawn(TYPE.ZONE, { name: 'z', tally: 3 }).uuid;
  const crop = g.spawn(TYPE.CROP, { name: 'kid', parent: zone }).uuid;
  g.submit([{ actor: 'p', ops: [{ kind: 'delete', target: zone }] }]);
  const g2 = P.loadText(P.saveText(g));
  const se = g2.w.parent[g2.w.byUuid.get(crop)];
  ok(g2.w.componentIndex[se] === NO_ROW,
    'T6e stub componentIndex carries the NO_ROW sentinel (Uint32-correct, checkable)');
  let readThrew = false; try { g2._field(se, 'tally'); } catch { readThrew = true; }
  let writeThrew = false; try { g2._writeField(se, 'tally', 9); } catch { writeThrew = true; }
  ok(readThrew, 'T6e pool-field READ of a stub throws — no silent undefined/NaN propagation');
  ok(writeThrew, 'T6e pool-field WRITE to a stub throws — no silent no-op');
  ok(g2._field(se, 'name') === 'z' && g2._field(se, 'destroyed') === 1,
    'T6e ...while per-entity fields (name/destroyed) stay readable — a stub owns those rows');
}
{
  // (f) stub LIFECYCLE: a stub is not a special case for GC — once its last
  // live referrer dies, the existing RD-019.1 pass drops its tombstone with
  // verdicts identical to the never-reloaded branch, and the next save/load
  // compacts the stub row away (save only persists dangling-REACHABLE dead
  // parents, and load only materializes stubs reachable from a live entity).
  // Reloaded worlds cannot leak stub rows indefinitely.
  const mk = () => {
    const g = new Engine(64);
    const p = g.spawn(TYPE.ZONE, { name: 'P' }).uuid;
    const c = g.spawn(TYPE.CROP, { name: 'C', parent: p }).uuid;
    g.submit([{ actor: 'x', ops: [{ kind: 'delete', target: p }] }]);
    return { g, p, c };
  };
  const A = mk();                                      // control: never persisted
  const B = mk(); const gb = P.loadText(P.saveText(B.g));
  A.g.submit([{ actor: 'x', ops: [{ kind: 'delete', target: A.c }] }]);
  gb.submit([{ actor: 'x', ops: [{ kind: 'delete', target: B.c }] }]);
  const gcA = A.g.gcTombstones(), gcB = gb.gcTombstones();
  ok(gcB.dropped.includes(B.p) &&
     gcA.dropped.sort().join() === gcB.dropped.sort().join() &&
     gcA.kept.sort().join() === gcB.kept.sort().join(),
    'T6f unreferenced stub tombstone dropped by the EXISTING GC pass, verdicts identical to the never-reloaded branch');
  const g3 = P.loadText(P.saveText(gb));
  ok(g3.w.count === 0 && g3.w.tombstones.size === 0,
    'T6f next save/load compacts the stub row away entirely — no indefinite leak in reloaded worlds');
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exit(FAIL ? 1 : 0);
