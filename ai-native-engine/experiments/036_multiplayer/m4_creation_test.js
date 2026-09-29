'use strict';
// =============================================================================
// RD-034 — the GAME-CREATION flow, end to end, over the real transport:
// an EMPTY world (no types, no rules, no entities) becomes a running game using
// nothing but the three gates — deftype (RD-024), tx/submit (RD-002..017),
// rule/installRule (RD-B6). This is "building games with AI" minus the AI:
// the exact byte-level flow the editor UI and the propose pane drive.
// `node m4_creation_test.js`
// =============================================================================
const net = require('node:net');
const { startServer } = require('./m1_server.js');

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

function client(port, name) {
  const sock = net.connect(port, '127.0.0.1');
  const inbox = [];
  let buf = '';
  sock.setEncoding('utf8');
  sock.on('data', (ch) => {
    buf += ch;
    let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) inbox.push(JSON.parse(l)); }
  });
  const send = (m) => sock.write(JSON.stringify(m) + '\n');
  const waitFor = (pred, ms = 3000) => new Promise((res, rej) => {
    const t0 = Date.now();
    (function poll() {
      const hit = inbox.find(pred);
      if (hit) return res(hit);
      if (Date.now() - t0 > ms) return rej(new Error('timeout'));
      setTimeout(poll, 15);
    })();
  });
  return { sock, inbox, send, waitFor, hello: () => { send({ t: 'hello', name }); return waitFor((m) => m.t === 'welcome'); } };
}

(async () => {
  const h = startServer({ port: 4942, manual: true, quiet: true, world: 'empty' });
  await new Promise((r) => setTimeout(r, 300));
  const c = client(4942, 'creator');
  const wel = await c.hello();

  // ---- 1. the world really is EMPTY -------------------------------------------
  ok(wel.view.schemaDefs.length === 0 && wel.view.entities.length === 0 && wel.view.rules.length === 0,
    'the empty world has NO types, NO entities, NO rules — nothing predates the author');
  ok(wel.view.crops === undefined && wel.view.zone === undefined,
    'and NO farm keys — the farm is one possible game, not the default reality');

  // ---- 2. schema authoring through the wire gate -------------------------------
  c.send({ t: 'deftype', spec: { name: 'tower', spatial: { x: 'x', y: 'y' },
    fields: { x: { range: [0, 255], init: 0 }, y: { range: [0, 255], init: 0 }, charge: { range: [0, 100], init: 0 } } } });
  const d1 = await c.waitFor((m) => m.t === 'deftype-result');
  ok(d1.ok && d1.name === 'tower', `deftype 'tower' accepted through the gate`);

  c.send({ t: 'deftype', spec: { name: 'tower', fields: {} } });
  const d2 = await c.waitFor((m) => m.t === 'deftype-result' && m !== d1);
  ok(!d2.ok && d2.errors.some((e) => e.code === 'duplicate_type'),
    'CONTROL: a duplicate type is REFUSED with a localized error, world untouched');

  // ---- 3. the vocabulary reaches clients on the next tick ----------------------
  h.doTick();
  const t1 = await c.waitFor((m) => m.t === 'tick' && m.schemaDefs?.some((d) => d.name === 'tower'));
  ok(!!t1, 'the new type travels to every client in the tick broadcast');

  // ---- 4. populate + author behavior over the runtime-born type ----------------
  c.send({ t: 'tx', ops: [{ kind: 'createChild', type: 'tower', parent: null, props: { name: 'north tower', x: 40, y: 60 } }] });
  await c.waitFor((m) => m.t === 'queued');
  h.doTick();
  const t2 = await c.waitFor((m) => m.t === 'tick' && m.entities.some((e) => e.type === 'tower'));
  const tower = t2.entities.find((e) => e.type === 'tower');
  ok(tower.name === 'north tower' && tower.fields.x === 40 && tower.fields.charge === 0,
    `'north tower' exists at (40,60) with charge 0 — created by a gated tx`);

  c.send({ t: 'rule', source: { name: 'charge_up', match: { type: 'tower' },
    effects: [{ set: 'charge', to: { min: [{ add: [{ field: 'charge' }, 5] }, 100] } }] } });
  const r1 = await c.waitFor((m) => m.t === 'rule-result');
  ok(r1.ok, `a behavior rule over the runtime-born type installs through the RD-B6 gate`);

  h.doTick(); h.doTick(); h.doTick();
  const t3 = await c.waitFor((m) => m.t === 'tick' && m.entities.some((e) => e.type === 'tower' && e.fields.charge >= 15));
  ok(!!t3, `the rule RUNS: the tower charged to ${t3.entities.find((e) => e.type === 'tower').fields.charge} over three ticks`);

  // ---- 5. invariants ------------------------------------------------------------
  let unsafe = 0;
  if (!h.engine.indexesConsistent()) unsafe++;
  for (const [uu, e] of h.engine.w.byUuid) if (h.engine.w.destroyed[e] || h.engine.w.uuid[e] !== uu) unsafe++;
  ok(unsafe === 0, 'unsafe sweep: 0 — a world authored from nothing keeps every invariant');

  c.sock.destroy();
  await h.stop();
  console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-034: a game born from an empty world through the three gates`);
  process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
