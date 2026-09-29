'use strict';
// =============================================================================
// RD-022: CLAIM TTL + DISCONNECT — expiry tuning and what happens when the
// claiming actor drops (flagged open since RD-002; owns the reload-releases-
// claims semantic pinned by RD-B6.1).
// =============================================================================
// Two questions, measured separately:
//
//   Q1 (TTL): what bounds how long a vanished actor can deny an entity, and
//      what shape does the bound take at the wire/engine boundary?
//      Rivals: NO-CAP (status quo) / CLAMP (silently truncate to cap) /
//              REJECT (whole-tx, localized reason) — the RD-018 clamp lesson
//              retested at the claim layer.
//   Q2 (disconnect): is disconnect DISTINCT from timeout?
//      Rivals: TTL-ONLY (disconnect = wait for expiry) /
//              IMMEDIATE (releaseActor drops claims now) /
//              GRACE (releaseActor shortens claims to a reconnect window).
//
// Negative controls (the guard must be load-bearing, not decorative):
//   NC1 cap off  -> claim{ticks:1e9} commits and denies 1000/1000 submits.
//   NC2 the user-facing one: a STALE CLAIM THAT SHOULD EXPIRE BUT DOESN'T —
//       the exact pre-fix state claim{ticks:NaN} produced (until=NaN: never
//       blocks AND never swept = permanent zombie) and claim{ticks:Infinity}
//       (blocks forever). Both now unrepresentable through submit().
//
// Boundary scrutiny carried forward from RD-B6.1 (what silently breaks at the
// boundary — measured by probe BEFORE the fix, each pinned below):
//   pre-fix, ALL of these COMMITTED with zero reasons:
//     ticks:1e9      -> unbounded denial (1000/1000)
//     ticks:NaN      -> zombie map entry (never blocks, never swept — leak)
//     ticks:Infinity -> blocks forever, never swept
//     ticks:'5'      -> until = 1 + '5' = '15' (string concat, wrong horizon)
//     ticks:0/-1     -> silent no-op lease
//     claim on a deleted target -> committed, no claim placed (author
//                       believes it holds what it does not)
//
// Zero deps. `node experiments/032_claim_ttl/claim_ttl.js`
// =============================================================================
const path = require('node:path');
const CORE = path.join(__dirname, '..', '..', 'core');
const { Engine, TYPE, TYPE_NAME, CLAIM_TTL_MAX } = require(path.join(CORE, 'engine.js'));
const { parseProposal } = require(path.join(CORE, 'protocol.js'));
const P = require(path.join(CORE, 'persistence.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);

// seeded PRNG + permutation — the RD-021 pattern
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const permute = (rnd, arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// committed-state signature (type-correct rows — the RD-021 lesson)
function sig(g) {
  const w = g.w, rows = [];
  for (let e = 0; e < w.count; e++) {
    if (w.destroyed[e]) continue;
    const r = w.componentIndex[e], t = w.type[e];
    rows.push([w.uuid[e], TYPE_NAME[t], w.parent[e] >= 0 ? w.uuid[w.parent[e]] : '-', w.name[e],
      t === TYPE.CROP ? w.crop_water[r] : '-', t === TYPE.CROP ? w.crop_growth[r] : '-'].join(':'));
  }
  return rows.sort().join('|');
}
// claims-map signature (uuid-keyed so it is index-layout independent)
const claimSig = (g) => [...g.claims.entries()]
  .map(([e, c]) => `${g.w.uuid[e]}:${c.actor}:${c.until}`).sort().join('|');

function farm(nCrops = 4) {
  const g = new Engine(256);
  const zone = g.spawn(TYPE.ZONE, { name: 'field' }).uuid;
  const crops = Array.from({ length: nCrops }, (_, i) =>
    g.spawn(TYPE.CROP, { name: `c${i}`, parent: zone, water: 5, growth: 10 }).uuid);
  return { g, zone, crops };
}
const water = (actor, c, v) => ({ actor, ops: [{ kind: 'setfield', target: c, field: 'water', value: v }] });
const claim = (actor, c, ticks) => ({ actor, ops: [{ kind: 'claim', target: c, ticks }] });

console.log('=== RD-022: claim TTL cap + disconnect-distinct-from-timeout ===');

// ============================================================================
hr('NC1  NEGATIVE CONTROL — cap off: unbounded denial-of-progress');
// engine.claimTtlMax is the documented per-instance override; Infinity = the
// pre-RD-022 engine (any integer TTL admitted). This is the D&H denial shape
// one level up, reachable through the wire (any positive integer passed).
{
  const { g, crops } = farm();
  g.claimTtlMax = Infinity;                          // guard OFF
  const r = g.submit([claim('A', crops[0], 1e9)]);
  ok(r.results[0].status === 'committed', 'NC1 cap off: claim{ticks:1e9} COMMITS');
  let blocked = 0;
  for (let i = 0; i < 1000; i++) if (g.submit([water('B', crops[0], 50)]).results[0].status === 'rejected') blocked++;
  ok(blocked === 1000, `NC1 cap off: B denied ${blocked}/1000 submits — unbounded (the cap is load-bearing)`);
}

// ============================================================================
hr('NC2  NEGATIVE CONTROL — the stale claim that should expire but DOESN\'T');
// Reproduce the exact map states the pre-fix code created from ticks:NaN and
// ticks:Infinity (until = tick + ticks). NaN fails BOTH comparisons: it never
// blocks (silently useless to its author) and never satisfies the sweep
// (until <= tick is false forever) — a permanent zombie entry. Infinity is the
// opposite failure: blocks forever. Then prove both are now UNREPRESENTABLE
// through submit().
{
  const { g, crops } = farm();
  const e = g.w.byUuid.get(crops[0]);
  g.claims.set(e, { actor: 'ghost', until: NaN });   // what claim{ticks:NaN} used to leave behind
  ok(g.submit([water('B', crops[0], 50)]).results[0].status === 'committed',
    'NC2 zombie(NaN): never BLOCKS — silently useless to the actor who "holds" it');
  for (let i = 0; i < 500; i++) g.submit([water('B', crops[0], 1)]);
  ok(g.claims.size === 1, `NC2 zombie(NaN): never SWEPT — still in the map after 500 expiry sweeps (leak)`);

  const e1 = g.w.byUuid.get(crops[1]);
  g.claims.set(e1, { actor: 'ghost', until: Infinity }); // what claim{ticks:Infinity} left behind
  let blocked = 0;
  for (let i = 0; i < 500; i++) if (g.submit([water('B', crops[1], 50)]).results[0].status === 'rejected') blocked++;
  ok(blocked === 500, `NC2 immortal(Infinity): blocks ${blocked}/500 — a stale claim that SHOULD expire and never does`);

  // ... and neither state is constructible through the pipeline anymore:
  const { g: g2, crops: c2 } = farm();
  for (const t of [NaN, Infinity]) {
    const r = g2.submit([claim('A', c2[0], t)]);
    ok(r.results[0].status === 'rejected' && /positive integer/.test(r.results[0].reasons.join()) && g2.claims.size === 0,
      `NC2 guard: claim{ticks:${String(t)}} rejected with a localized reason, zero footprint`);
  }
}

// ============================================================================
hr('T1  BOUNDARY PIN — ticks:n protects exactly n-1 subsequent submits');
// The lease span is INCLUSIVE of the granting tick (until = grantTick + n;
// blocking requires until > tick). Pinned so it cannot drift silently:
// ticks:1 grants a lease that expires before any other actor can collide —
// legal, harmless, protects nothing. Authors who want "cover my next tick"
// need ticks:2. (Documented, not rejected: refusing a legal harmless value
// would be policy, not safety.)
{
  for (const n of [1, 2, 3, 5]) {
    const { g, crops } = farm();
    g.submit([claim('A', crops[0], n)]);
    let protectedTicks = 0;
    for (let i = 0; i < n + 2; i++) if (g.submit([water('B', crops[0], 50)]).results[0].status === 'rejected') protectedTicks++;
    ok(protectedTicks === n - 1, `T1 ticks:${n} -> exactly ${n - 1} subsequent submit(s) protected`);
  }
}

// ============================================================================
hr('T2  CAP EDGE — 64 commits, 65 rejected whole-tx with an instructive reason');
{
  const { g, crops } = farm();
  const r64 = g.submit([claim('A', crops[0], CLAIM_TTL_MAX)]);
  ok(r64.results[0].status === 'committed', `T2 ticks:${CLAIM_TTL_MAX} (the cap itself) commits`);

  const { g: g2, crops: c2 } = farm();
  const r65 = g2.submit([{ actor: 'A', ops: [
    { kind: 'setfield', target: c2[1], field: 'water', value: 80 },
    { kind: 'claim', target: c2[0], ticks: CLAIM_TTL_MAX + 1 },
  ] }]);
  ok(r65.results[0].status === 'rejected', `T2 ticks:${CLAIM_TTL_MAX + 1} rejected`);
  ok(/RENEWALS/.test(r65.results[0].reasons.join()), 'T2 reason TEACHES the alternative (renewals) — RD-018.1: error text is load-bearing');
  const w1 = g2.w.crop_water[g2.w.componentIndex[g2.w.byUuid.get(c2[1])]];
  ok(w1 === 5 && g2.claims.size === 0, 'T2 whole-tx atomicity: the sibling setfield in the same tx also lands NOTHING (zero footprint)');

  // per-instance override respected end to end
  const { g: g3, crops: c3 } = farm();
  g3.claimTtlMax = 8;
  ok(g3.submit([claim('A', c3[0], 9)]).results[0].status === 'rejected', 'T2 engine.claimTtlMax=8 override: ticks:9 rejected');
  ok(g3.submit([claim('A', c3[1], 8)]).results[0].status === 'committed', 'T2 override: ticks:8 commits');
}

// ============================================================================
hr('T3  INVALID TICKS — every silent pre-fix shape now rejects, zero footprint');
{
  for (const t of [NaN, Infinity, 0, -1, 1.5, '5']) {
    const { g, crops } = farm();
    const r = g.submit([claim('A', crops[0], t)]);
    const next = g.submit([water('B', crops[0], 50)]).results[0].status;
    ok(r.results[0].status === 'rejected' && g.claims.size === 0 && next === 'committed',
      `T3 ticks:${typeof t === 'string' ? `"${t}"` : String(t)} -> rejected, no map entry, no residual blocking`);
  }
  // claim on an absent target: explicit RD-004.6 absence, not a silent no-op
  const { g, crops } = farm();
  g.submit([{ actor: 'A', ops: [{ kind: 'delete', target: crops[0] }] }]);
  const rd = g.submit([claim('B', crops[0], 3)]);
  ok(rd.results[0].status === 'rejected' && /is deleted/.test(rd.results[0].reasons.join()),
    'T3 claim on a DELETED target -> rejected "deleted" (was: committed no-op the author believed was a hold)');
  const rm = g.submit([claim('B', 'u-nope', 3)]);
  ok(rm.results[0].status === 'rejected' && /is missing/.test(rm.results[0].reasons.join()),
    'T3 claim on a MISSING target -> rejected "missing" (deleted vs missing surfaced, RD-004.6)');
  // same-batch delete-then-claim: deterministic rejection, not a race
  const { g: g4, crops: c4 } = farm();
  const rb = g4.submit([
    { actor: 'A', ops: [{ kind: 'delete', target: c4[0] }] },
    { actor: 'B', ops: [{ kind: 'claim', target: c4[0], ticks: 3 }] },
  ]);
  ok(rb.results[0].status === 'committed' && rb.results[1].status === 'rejected' && /being deleted this batch/.test(rb.results[1].reasons.join()),
    'T3 claim of an entity being deleted the SAME batch -> localized rejection');
}

// ============================================================================
hr('T4  Q1 RIVAL: CLAMP vs REJECT — the RD-018 clamp lesson at the claim layer');
// CLAMP (truncate 1e9 -> 64 and commit) looks harmless: the denial is bounded.
// What it costs is the AUTHOR'S MODEL: the claim commits with zero signal, the
// author believes it holds the entity "forever", schedules no renewal — and at
// cap expiry the entity is silently up for grabs. The belief diverges from the
// world with no error at any point (the D&H shape applied to coordination
// state). REJECT (shipped) converts that future silent surprise into an
// immediate, repairable, instructive error.
{
  // CLAMP rival, implemented at the same boundary the real guard occupies
  const { g, crops } = farm();
  g.claimTtlMax = Infinity;                           // disable REJECT so the rival owns the boundary
  const clampedTicks = Math.min(1e9, CLAIM_TTL_MAX);  // what a clamping boundary would grant
  const rc = g.submit([claim('A', crops[0], clampedTicks)]);
  ok(rc.results[0].status === 'committed' && rc.results[0].reasons.length === 0,
    'T4 CLAMP: commits with ZERO reasons — author intended 1e9, was given 64, and was never told');
  // author acts on its belief: no renewal scheduled; interloper waits out the cap
  for (let i = 0; i < CLAIM_TTL_MAX - 1; i++) g.submit([water('B', crops[0], 50)]); // all rejected (hold active)
  const steal = g.submit([claim('B', crops[0], 4)]);
  ok(steal.results[0].status === 'committed', 'T4 CLAMP: at cap expiry B silently takes the entity');
  const rA = g.submit([water('A', crops[0], 99)]);
  ok(rA.results[0].status === 'rejected' && /held by B/.test(rA.results[0].reasons.join()),
    'T4 CLAMP: A\'s next act on "its" entity is rejected — the first signal arrives AFTER the damage');

  // REJECT (shipped): the divergence is impossible — the author learns at submit time
  const { g: g2, crops: c2 } = farm();
  const rr = g2.submit([claim('A', c2[0], 1e9)]);
  ok(rr.results[0].status === 'rejected' && /exceeds the TTL cap/.test(rr.results[0].reasons.join()),
    'T4 REJECT: the same intent fails LOUDLY at submit time, with the renewal recipe in the reason');
}

// ============================================================================
hr('T5  RENEWALS — long holds are legal while the actor is ALIVE');
// The cap bounds a single lease, not a tenure: the holder re-claims within the
// window and keeps the entity indefinitely — renewal requires the actor to be
// alive, which is exactly the liveness signal the TTL exists to extract.
{
  const { g, crops } = farm();
  g.submit([claim('A', crops[0], 3)]);
  let blocked = 0, renewals = 0;
  for (let round = 0; round < 100; round++) {
    if (g.submit([water('B', crops[0], 50)]).results[0].status === 'rejected') blocked++;
    if (round % 2 === 1) { // renew every 2nd tick, well inside the 2-protected-submit window
      const r = g.submit([claim('A', crops[0], 3)]);
      if (r.results[0].status === 'committed') renewals++;
    }
  }
  ok(blocked === 100 && renewals === 50, `T5 renewal chain: B blocked ${blocked}/100 across ~150 ticks (>2x the cap) — tenure unbounded while alive`);
  // each renewal is itself capped — the chain cannot smuggle an immortal lease
  ok(g.submit([claim('A', crops[0], CLAIM_TTL_MAX + 1)]).results[0].status === 'rejected',
    'T5 a RENEWAL over the cap is rejected like any claim (no privileged path)');
  // and when the actor stops renewing (vanished), the worst case is the cap
  const { g: g2, crops: c2 } = farm();
  g2.submit([claim('A', c2[0], CLAIM_TTL_MAX)]);
  let denied = 0;
  for (let i = 0; i < CLAIM_TTL_MAX + 4; i++) if (g2.submit([water('B', c2[0], 50)]).results[0].status === 'rejected') denied++;
  ok(denied === CLAIM_TTL_MAX - 1, `T5 vanish worst case: denial ends at ${denied} submits (< cap ${CLAIM_TTL_MAX}) — bounded horizon, the cap's whole purpose`);
}

// ============================================================================
hr('T6  Q2 RIVALS — disconnect: TTL-ONLY vs IMMEDIATE vs GRACE');
// Scenario (both variants, all rivals): A claims a crop (ticks:8) and starts a
// multi-tick harvest (write growth, then write water, then delete). A
// disconnects after step 1.
//   VANISH: A never returns. Measure: how many submits is B denied?
//   BLIP:   A returns 2 ticks later and finishes. Measure: does the action
//           complete, or did an interloper break it mid-way?
function startHarvest() {
  const { g, crops } = farm();
  const c = crops[0];
  g.submit([claim('A', c, 8)]);
  g.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: c, field: 'growth', value: 50 }] }]); // step 1
  return { g, c }; // disconnect happens here
}
{
  // ---- R-A TTL-ONLY: no release mechanism; disconnect === timeout ----------
  {
    const { g, c } = startHarvest();               // VANISH
    let denied = 0;
    for (let i = 0; i < 12; i++) if (g.submit([water('B', c, 50)]).results[0].status === 'rejected') denied++;
    // lease until = grantTick+8; A's own step-1 consumed one tick, so B is
    // denied the 6 remaining protected ticks — the FULL remaining TTL.
    ok(denied === 6, `T6 TTL-ONLY vanish: B denied ${denied} submits — the full remaining TTL (worst case: cap-1 = ${CLAIM_TTL_MAX - 1})`);
  }
  {
    const { g, c } = startHarvest();               // BLIP (reconnect at +2)
    g.submit([water('B', c, 50)]);                  // interloper during the blip: rejected (hold active)
    const s2 = g.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: c, field: 'water', value: 0 }] }]);
    const s3 = g.submit([{ actor: 'A', ops: [{ kind: 'delete', target: c }] }]);
    ok(s2.results[0].status === 'committed' && s3.results[0].status === 'committed' && g.w.resolve(c).status === 'deleted',
      'T6 TTL-ONLY blip: A resumes and COMPLETES the harvest (blip-safe)');
  }

  // ---- R-B IMMEDIATE: releaseActor at disconnect, no grace ------------------
  {
    const { g, c } = startHarvest();               // VANISH
    g.releaseActor('A');
    ok(g.submit([water('B', c, 50)]).results[0].status === 'committed',
      'T6 IMMEDIATE vanish: B in on the very next submit — denial 0 (best possible)');
  }
  {
    const { g, c } = startHarvest();               // BLIP
    g.releaseActor('A');
    g.submit([{ actor: 'B', ops: [{ kind: 'claim', target: c, ticks: 4 }, { kind: 'setfield', target: c, field: 'water', value: 99 }] }]);
    const back = g.submit([{ actor: 'A', ops: [{ kind: 'setfield', target: c, field: 'water', value: 0 }] }]);
    ok(back.results[0].status === 'rejected' && /held by B/.test(back.results[0].reasons.join()),
      'T6 IMMEDIATE blip: A returns 2 ticks later to find its entity TAKEN — action broken mid-way');
    const w = g.w, e = w.byUuid.get(c);
    ok(w.resolve(c).status === 'live' && w.crop_growth[w.componentIndex[e]] === 50 && w.crop_water[w.componentIndex[e]] === 99,
      'T6 IMMEDIATE blip cost, measured: crop stranded HALF-HARVESTED (A\'s step-1 growth) + B\'s write — per-tick txs were atomic, the multi-tick INTENT was not protected');
  }

  // ---- R-C GRACE: releaseActor(actor, {graceTicks}) -------------------------
  {
    const { g, c } = startHarvest();               // VANISH, grace 4
    g.releaseActor('A', { graceTicks: 4 });
    let denied = 0;
    for (let i = 0; i < 8; i++) if (g.submit([water('B', c, 50)]).results[0].status === 'rejected') denied++;
    ok(denied === 3, `T6 GRACE(4) vanish: B denied ${denied} submits (= grace-1, same span rule as T1) — bounded by the WINDOW, not the TTL`);
  }
  {
    const { g, c } = startHarvest();               // BLIP, grace 4
    g.releaseActor('A', { graceTicks: 4 });
    ok(g.submit([water('B', c, 50)]).results[0].status === 'rejected', 'T6 GRACE blip: interloper still blocked during the window');
    const re = g.submit([{ actor: 'A', ops: [{ kind: 'claim', target: c, ticks: 8 }, { kind: 'setfield', target: c, field: 'water', value: 0 }] }]);
    const s3 = g.submit([{ actor: 'A', ops: [{ kind: 'delete', target: c }] }]);
    ok(re.results[0].status === 'committed' && s3.results[0].status === 'committed' && g.w.resolve(c).status === 'deleted',
      'T6 GRACE blip: A re-claims inside the window and COMPLETES — blip-safe AND bounded');
  }
  console.log('     scorecard: TTL-ONLY  blip:SAFE  denial:remaining-TTL (up to cap-1)');
  console.log('                IMMEDIATE blip:BROKEN denial:0');
  console.log('                GRACE     blip:SAFE  denial:<=grace   <- dominates: disconnect IS distinct from timeout');
}

// ============================================================================
hr('T7  releaseActor SEMANTICS — shorten-only, idempotent, validated');
{
  const { g, crops } = farm();
  g.submit([claim('A', crops[0], 2)]);              // expires soon on its own
  g.releaseActor('A', { graceTicks: 50 });          // "grace" longer than the lease
  ok(g.claims.get(g.w.byUuid.get(crops[0])).until === g.tick + 2 - 0,
    'T7 grace never EXTENDS a hold: until = min(old, tick+grace) — release can only shorten');
  ok(g.releaseActor('nobody') === 0, 'T7 releasing an unknown actor: 0 affected, no throw (idempotent)');
  g.releaseActor('A');
  ok(g.releaseActor('A') === 0 && g.claims.size === 0, 'T7 double release: second call finds nothing (idempotent)');
  let threw = 0;
  for (const bad of [-1, 1.5, NaN, '3']) { try { g.releaseActor('A', { graceTicks: bad }); } catch { threw++; } }
  ok(threw === 4, 'T7 trusted API discipline: invalid graceTicks THROWS (like spawn), it does not localize');
  // multi-entity: one release covers every claim the actor holds
  const { g: g2, crops: c2 } = farm();
  g2.submit([{ actor: 'A', ops: c2.map(c => ({ kind: 'claim', target: c, ticks: 8 })) }]);
  ok(g2.releaseActor('A') === 4 && g2.claims.size === 0, 'T7 one call releases ALL of a vanished actor\'s claims (4/4)');
}

// ============================================================================
hr('T8  COMPOSITION — undo, reload (RD-B6.1), tombstoned rows, GC of entries');
{
  // undo does not touch claims (session state, the RD-020/RD-019 policy line)
  const { g, crops } = farm();
  g.enableHistory();
  g.submit([{ actor: 'A', ops: [
    { kind: 'claim', target: crops[0], ticks: 8 },
    { kind: 'setfield', target: crops[0], field: 'water', value: 80 },
  ] }]);
  g.undo();
  ok(g.claims.size === 1, 'T8 undo reverses the DATA, not the claim — claims are session state, never history entries');
  ok(g.submit([water('B', crops[0], 50)]).results[0].status === 'rejected', 'T8 ... and the surviving claim still blocks');

  // reload releases claims — including GRACED ones (RD-B6.1 T6c extended)
  const { g: g2, crops: c2 } = farm();
  g2.submit([claim('A', c2[0], 8)]);
  g2.submit([claim('C', c2[1], 8)]);
  g2.releaseActor('A', { graceTicks: 6 });          // mid-grace at save time
  const g3 = P.load(P.save(g2));
  ok(g3.claims.size === 0, 'T8 reload releases ALL claims, graced ones included — a reload is a disconnect of every actor (RD-B6.1 pinned)');

  // a claim on an entity its holder then deletes: entry expires, no leak
  const { g: g4, crops: c4 } = farm();
  g4.submit([claim('A', c4[0], 4)]);
  g4.submit([{ actor: 'A', ops: [{ kind: 'delete', target: c4[0] }] }]);   // holder may delete its held entity
  ok(g4.claims.size === 1, 'T8 claim entry may briefly outlive its (tombstoned) entity...');
  for (let i = 0; i < 6; i++) g4.submit([water('B', c4[1], 1)]);
  ok(g4.claims.size === 0, 'T8 ...and the expiry sweep reclaims it — no leak (rows are never reused, so no aliasing window)');
}

// ============================================================================
hr('T9  DETERMINISM UNDER PERMUTATION (RD-003/P1) — claims + cap + release');
{
  const build = () => {
    const { g, crops } = farm(6);
    return { g, crops };
  };
  const mkBatch = (crops) => [
    claim('A', crops[0], 8),
    claim('B', crops[1], CLAIM_TTL_MAX + 1),                     // over cap -> rejected
    claim('C', crops[2], NaN),                                    // invalid -> rejected
    { actor: 'D', ops: [{ kind: 'claim', target: crops[3], ticks: 4 }, { kind: 'setfield', target: crops[3], field: 'water', value: 9 }] },
    water('E', crops[0], 77),                                     // same-tick as A's claim: claim layer is prior-tick only, folds/defers normally
    water('F', crops[4], 33),
  ];
  const base = build();
  base.g.submit(mkBatch(base.crops));
  base.g.releaseActor('D', { graceTicks: 3 });
  const baseSig = sig(base.g), baseClaims = claimSig(base.g);
  const rnd = mulberry32(2026);
  let identical = 0;
  for (let p = 0; p < 6; p++) {
    const r = build();
    r.g.submit(permute(rnd, mkBatch(r.crops)));
    r.g.releaseActor('D', { graceTicks: 3 });
    if (sig(r.g) === baseSig && claimSig(r.g) === baseClaims) identical++;
  }
  ok(identical === 6, `T9 committed state AND claims map identical across 6 permutations (${identical}/6) — cap/validation/release add no arrival-order dependence`);
}

// ============================================================================
hr('T10 THE WIRE (RD-018) — localized codes, no silent rewrite, cap follows the engine');
{
  const { g, crops } = farm();
  const p0 = parseProposal(g, JSON.stringify({ actor: 'ai', ops: [{ op: 'claim', target: crops[0], ticks: 0 }] }));
  ok(!p0.ok && p0.errors[0].code === 'claim_ticks_invalid' && p0.errors[0].opIndex === 0,
    `T10 ticks:0 -> (0, claim_ticks_invalid) — pre-fix the wire SILENTLY rewrote it to 3`);
  const pBig = parseProposal(g, JSON.stringify({ actor: 'ai', ops: [{ op: 'claim', target: crops[0], ticks: 1e9 }] }));
  ok(!pBig.ok && pBig.errors[0].code === 'claim_ttl_cap' && /RENEW/i.test(pBig.errors[0].detail),
    'T10 ticks:1e9 -> (0, claim_ttl_cap), detail teaches renewals (repairable, RD-018.1)');
  const pDef = parseProposal(g, JSON.stringify({ actor: 'ai', ops: [{ op: 'claim', target: crops[0] }] }));
  ok(pDef.ok && pDef.batch[0].ops[0].ticks === 3, 'T10 ABSENT ticks -> documented default 3 (unchanged behavior)');
  g.claimTtlMax = 16;
  const pOv = parseProposal(g, JSON.stringify({ actor: 'ai', ops: [{ op: 'claim', target: crops[0], ticks: 20 }] }));
  ok(!pOv.ok && pOv.errors[0].code === 'claim_ttl_cap' && /cap 16/.test(pOv.errors[0].detail),
    'T10 wire cap FOLLOWS engine.claimTtlMax override (16) — one policy, two enforcement points');
}

console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
process.exitCode = FAIL ? 1 : 0;
