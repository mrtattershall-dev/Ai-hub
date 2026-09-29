'use strict';
// =============================================================================
// RD-M2 — transport validates against the RUNTIME schema. Criteria 1/2/4
// (criterion 3 = m1_test.js 15/15, run separately, unmodified).
// A paddle type is defined on the SERVER world; a TCP client then creates and
// writes one through the ordinary message grammar; refusals stay localized and
// identical in shape to single-player; the welcome view carries schemaDefs.
// `node m2_schema_transport_test.js`
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
      if (Date.now() - t0 > ms) return rej(new Error('timeout waiting for ' + pred));
      setTimeout(poll, 15);
    })();
  });
  return { sock, inbox, send, waitFor, hello: () => { send({ t: 'hello', name }); return waitFor((m) => m.t === 'welcome'); } };
}

(async () => {
  const h = startServer({ port: 4742, manual: true, quiet: true });
  await new Promise((r) => setTimeout(r, 300));

  // the server world learns a new type at runtime (RD-024 gate)
  const def = h.engine.defineType({ name: 'paddle', fields: { y: { range: [0, 255], init: 128 } } });
  ok(def.ok, 'server engine defines paddle at runtime');

  const c = client(4742, 'p1');
  const wel = await c.hello();

  // criterion 4: schemaDefs travel in the existing view — no new message types
  ok(Array.isArray(wel.view.schemaDefs) && wel.view.schemaDefs.some((d) => d.name === 'paddle'),
    'welcome view carries schemaDefs including the runtime type');

  // criterion 1: create + write a dynamic type through the ordinary grammar
  c.send({ t: 'tx', ops: [{ kind: 'createChild', type: 'paddle', parent: h.zone, props: { name: 'left', y: 40 } }] });
  await c.waitFor((m) => m.t === 'queued');
  h.doTick();
  const t1 = await c.waitFor((m) => m.t === 'tick' && m.yours.length);
  ok(t1.yours[0].status === 'committed', 'createChild paddle over the wire commits');
  const pu = h.engine._systemView().allOfType('paddle')[0];
  ok(!!pu && h.engine._systemView().field(pu, 'y') === 40, 'paddle exists server-side with the wire-sent y');

  c.send({ t: 'tx', ops: [{ kind: 'setfield', target: pu, field: 'y', value: 200 }] });
  await c.waitFor((m) => m.t === 'queued' && c.inbox.filter((x) => x.t === 'queued').length >= 2);
  h.doTick();
  ok(h.engine._systemView().field(pu, 'y') === 200, 'setfield on the dynamic field commits through the pipeline');

  // criterion 2: refusals identical in shape to single-player
  c.send({ t: 'tx', ops: [{ kind: 'createChild', type: 'spaceship', parent: h.zone, props: {} }] });
  const e1 = await c.waitFor((m) => m.t === 'error');
  ok(/unknown entity type 'spaceship'/.test(e1.err), 'unknown type refused at the transport with the same message shape');

  c.send({ t: 'tx', ops: [{ kind: 'setfield', target: pu, field: 'y', value: 999 }] });
  await c.waitFor((m) => m.t === 'queued' && c.inbox.filter((x) => x.t === 'queued').length >= 3);
  h.doTick();
  const t3 = await c.waitFor((m) => m.t === 'tick' && m.yours.some((y) => y.status === 'rejected'));
  ok(t3.yours.some((y) => /range/.test(y.reasons.join())), 'out-of-range write on a dynamic field -> the SAME pipeline range rejection');

  c.send({ t: 'tx', ops: [{ kind: 'setfield', target: pu, field: 'water', value: 5 }] });
  await c.waitFor((m) => m.t === 'queued' && c.inbox.filter((x) => x.t === 'queued').length >= 4);
  h.doTick();
  const t4 = await c.waitFor((m) => m.t === 'tick' && m.yours.some((y) => y.status === 'rejected' && /cross-pool/.test(y.reasons.join())));
  ok(!!t4, 'farm field on a paddle -> the SAME cross-pool rejection');

  // invariants after mixed farm+dynamic traffic
  let unsafe = 0;
  if (!h.engine.indexesConsistent()) unsafe++;
  for (const [uu, e] of h.engine.w.byUuid) if (h.engine.w.destroyed[e] || h.engine.w.uuid[e] !== uu) unsafe++;
  ok(unsafe === 0, 'unsafe sweep: 0 after mixed farm + dynamic wire traffic');

  c.sock.destroy();
  await h.stop();
  console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed — RD-M2 transport schema`);
  process.exit(FAIL ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
