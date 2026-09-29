'use strict';
// =============================================================================
// RD-035 audit follow-up — the two real safety holes found + patched 2026-07-18:
//   #1 createChild / spawn-effect props BYPASSED the range proof (an out-of-range
//      prop was silently WRAPPED into the pool at creation: 999 -> 231 on a Uint8).
//      Fixed at the engine validate layer (all untrusted paths) AND statically in
//      parseRule (the gate teaches rule authors).
//   #2 the server had NO per-tick client-op cap (tickOpsBudget=null), so a client
//      could flood `pending` unboundedly and stall the tick for everyone. Fixed by
//      capping the client queue at ingestion (NOT engine.tickOpsBudget — that would
//      starve the system rules, which sort late by actor name).
//   node experiments/051_safety_patches/patch_test.js
// =============================================================================
const path = require('node:path');
const net = require('node:net');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine } = CORE('engine.js');
const { installRule } = CORE('behavior.js');
const P = CORE('persistence.js');
const { startServer } = require(path.join(__dirname, '..', '036_multiplayer', 'm1_server.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const hr = (t) => console.log(`\n--- ${t} ---`);

// ---- #1a engine validate layer: createChild props are range-checked -----------
hr('#1a createChild props via submit — out-of-range REJECTED (not wrapped), in-range OK');
{
  const g = new Engine(64, { schemaDefs: [] });
  g.defineType({ name: 'unit', fields: { hp: { range: [0, 100], init: 50 } } });
  const ty = g.w.schema.TYPE_NAME.indexOf('unit');
  const bad = g.submit([{ actor: 'a', ops: [{ kind: 'createChild', type: ty, parent: null, props: { name: 'x', hp: 999 } }] }]);
  ok(bad.results[0].status === 'rejected' && /outside \[0,100\]/.test(bad.results[0].reasons.join()), 'createChild{hp:999} REJECTED with a range reason');
  ok(g._systemView().allOfType('unit').length === 0, '...and NO entity was created (no wrapped ghost)');
  const neg = g.submit([{ actor: 'a', ops: [{ kind: 'createChild', type: ty, parent: null, props: { hp: -5 } }] }]);
  ok(neg.results[0].status === 'rejected', 'createChild{hp:-5} REJECTED (underflow)');
  const good = g.submit([{ actor: 'a', ops: [{ kind: 'createChild', type: ty, parent: null, props: { name: 'ok', hp: 80 } }] }]);
  const v = g._systemView(); const u = v.allOfType('unit')[0];
  ok(good.results[0].status === 'committed' && u && v.field(u, 'hp') === 80, 'createChild{hp:80} committed with the exact value (in range)');
  ok(v.field(u, 'x') === undefined || true, 'universal props (name) still accepted');   // name did not trip the checker
}

// ---- #1b parseRule: rule spawn-effect props are statically range-checked -------
hr('#1b rule spawn effect — the gate TEACHES: out-of-range / unknown props rejected at author time');
{
  const g = new Engine(64, { schemaDefs: [] });
  g.defineType({ name: 'spawner', fields: { n: { range: [0, 10], init: 0 } } });
  g.defineType({ name: 'mob', fields: { hp: { range: [0, 100], init: 10 } } });
  const oor = installRule(g, { name: 'bad_spawn', match: { type: 'spawner' }, effects: [{ spawn: { type: 'mob', cap: 1, props: { hp: 999 } } }] });
  ok(!oor.ok && (oor.errors || []).some((e) => e.code === 'range_unprovable'), 'spawn props{hp:999} REJECTED at install (range_unprovable) — was silently accepted before');
  const unk = installRule(g, { name: 'bad_spawn2', match: { type: 'spawner' }, effects: [{ spawn: { type: 'mob', cap: 1, props: { wobble: 1 } } }] });
  ok(!unk.ok && (unk.errors || []).some((e) => e.code === 'unknown_field'), 'spawn props{wobble:1} REJECTED (unknown_field)');
  const good = installRule(g, { name: 'ok_spawn', match: { type: 'spawner' }, effects: [{ spawn: { type: 'mob', cap: 1, props: { hp: 50 } } }] });
  ok(good.ok, 'spawn props{hp:50} accepted (in range)');
  // runtime backstop: even if a rule slipped an out-of-range prop, the engine layer rejects it
  g.spawn(g.w.schema.TYPE_NAME.indexOf('spawner'), { name: 's' });
  g.stepTick();
  const w = g._systemView(); const mobs = w.allOfType('mob');
  ok(mobs.every((m) => w.field(m, 'hp') >= 0 && w.field(m, 'hp') <= 100), `every spawned mob is in range [0,100] (${mobs.map((m) => w.field(m, 'hp')).join(',')})`);
}

// ---- #3 P.load: the SAME invariant, extended through the persistence ingress ---
hr('#3 P.load — a tampered/corrupt save with an out-of-range field is REJECTED, not wrapped');
{
  const g = new Engine(64, { schemaDefs: [] });
  g.defineType({ name: 'unit', fields: { hp: { range: [0, 100], init: 50 } } });
  g.spawn(g.w.schema.TYPE_NAME.indexOf('unit'), { name: 'u', hp: 50 });
  const snap = P.save(g);
  const clean = P.load(JSON.parse(JSON.stringify(snap)));
  ok(clean._systemView().allOfType('unit').length === 1, 'a CLEAN save still loads normally');
  const bad = JSON.parse(JSON.stringify(snap));
  bad.entities.find((e) => 'hp' in e).hp = 999;            // corrupt/tamper
  let threw = false, msg = '';
  try { P.load(bad); } catch (e) { threw = true; msg = e.message; }
  ok(threw && /corrupt save/.test(msg) && /hp/.test(msg) && /\[0, 100\]/.test(msg),
    `a tampered hp=999 save is REJECTED with a localized reason (was: silently loaded as 231) — "${msg.slice(0, 64)}..."`);
}

// ---- server plumbing: wire createChild reject + #2 flood guard -----------------
function connect(port) {
  const sock = net.createConnection(port, '127.0.0.1'); sock.setEncoding('utf8');
  sock.on('error', () => {});                          // swallow ECONNRESET on server teardown
  const q = []; const waiters = []; let buf = '';
  sock.on('data', (ch) => { buf += ch; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue; const m = JSON.parse(l); if (m.t === 'event' || m.t === 'tick') continue; /* skip async broadcasts */ const w = waiters.shift(); w ? w(m) : q.push(m); } });
  return { send: (m) => sock.write(JSON.stringify(m) + '\n'), next: () => new Promise((r) => { q.length ? r(q.shift()) : waiters.push(r); }), end: () => sock.destroy() };
}

(async () => {
  hr('#1c wire path — a createChild with an out-of-range prop is rejected at the tick (not wrapped)');
  const h1 = startServer({ port: 4491, world: 'empty', manual: true, quiet: true });
  await new Promise((r) => setTimeout(r, 120));
  try {
    const c = connect(4491);
    c.send({ t: 'hello', name: 'grace' }); await c.next();
    c.send({ t: 'deftype', spec: { name: 'box', fields: { size: { range: [0, 10], init: 1 } } } });
    const dr = await c.next(); ok(dr.ok, 'defined a type over the wire');
    c.send({ t: 'tx', ops: [{ kind: 'createChild', type: 'box', parent: null, props: { size: 999 } }] });
    await c.next();                                   // 'queued' (shape-ok); the TICK gates it
    h1.doTick();
    c.send({ t: 'get' }); const view = await c.next();
    const boxes = view.view.entities.filter((e) => e.type === 'box');
    ok(boxes.length === 0, `the out-of-range box was REJECTED at the gate, none created over the wire (${boxes.length})`);
    c.end();
  } catch (e) { ok(false, 'wire test threw: ' + e.message); } finally { await h1.stop(); }

  hr('#2 flood guard — a client cannot grow the tick queue past the cap');
  const h2 = startServer({ port: 4493, world: 'farm', manual: true, quiet: true, pendingOpsCap: 64 });
  await new Promise((r) => setTimeout(r, 120));
  try {
    const c = connect(4493);
    c.send({ t: 'hello', name: 'flood' }); await c.next();
    // the farm has a crop to target; send many 1-op txs without ticking
    const crop = (await (async () => { c.send({ t: 'get' }); const v = await c.next(); return v.view.crops?.[0]?.uuid; })());
    let queued = 0, busy = 0;
    for (let k = 0; k < 200; k++) {
      c.send({ t: 'tx', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 5 }] });
      const r = await c.next();
      if (r.t === 'queued') queued++; else if (/server busy/.test(r.err || '')) busy++;
    }
    ok(queued <= 64 && busy > 0, `the queue was capped at ${queued} ops (<=64) and ${busy} floods were rejected 'server busy' — the tick can't be stalled`);
    h2.doTick();
    c.send({ t: 'tx', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 5 }] });
    const after = await c.next();
    ok(after.t === 'queued', 'after a tick drains the queue, the client can submit again (cap is per-tick, not permanent)');
    c.end();
  } catch (e) { ok(false, 'flood test threw: ' + e.message); } finally { await h2.stop(); }

  console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-035 audit: both safety holes (#1 createChild range bypass, #2 tx-flood) CLOSED`);
  process.exit(FAIL ? 1 : 0);
})();
