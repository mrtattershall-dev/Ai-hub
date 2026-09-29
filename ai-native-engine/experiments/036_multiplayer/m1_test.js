'use strict';
// =============================================================================
// M1 TEST — two REAL socket clients, one live world, every BAR M1 clause.
// The server runs in-process in MANUAL tick mode (deterministic same-tick
// contention: both clients' txs queue, then ONE doTick() lands them in the
// same batch) but clients connect over the actual TCP transport — the wire
// being tested is the wire humans will use.
// Clauses (BAR.md M1, pinned): one submit() only; foldable contested field
// FOLDS losslessly; non-foldable DEFERS, visibly to BOTH clients; zero unsafe;
// plus: claim blocks the other actor; the RD-B6 gate rejects a bad rule with
// the world BYTE-IDENTICAL; disconnect releases claims after grace (RD-022).
// `node experiments/036_multiplayer/m1_test.js`
// =============================================================================
const net = require('node:net');
const path = require('node:path');
const { startServer } = require('./m1_server.js');
const P = require(path.join(__dirname, '..', '..', 'core', 'persistence.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

// -- tiny client harness over the real transport ------------------------------
function connect(name, port) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(port, '127.0.0.1');
    sock.setEncoding('utf8');
    const inbox = []; const waiters = [];
    let buf = '';
    sock.on('data', (ch) => {
      buf += ch; let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        const wi = waiters.findIndex(w => w.pred(m));
        if (wi >= 0) waiters.splice(wi, 1)[0].res(m); else inbox.push(m);
      }
    });
    sock.on('error', reject);
    const c = {
      sock, name,
      send: (m) => sock.write(JSON.stringify(m) + '\n'),
      next: (pred, ms = 3000) => {
        const i = inbox.findIndex(pred);
        if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
        return new Promise((res, rej) => {
          const w = { pred, res };
          waiters.push(w);
          setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); rej(new Error(`${name}: timeout waiting`)); } }, ms);
        });
      },
      drain: () => inbox.splice(0),
      close: () => new Promise(r => { sock.once('close', r); sock.end(); sock.destroy(); }),
    };
    sock.on('connect', () => { c.send({ t: 'hello', name }); resolve(c); });
  });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('=== M1: two clients, one world, one submit() ===\n');
  const srv = startServer({ port: 42421, manual: true, graceTicks: 2, quiet: true });
  await sleep(100);

  const A = await connect('alice', 42421);
  const wA = await A.next(m => m.t === 'welcome');
  const B = await connect('bob', 42421);
  const wB = await B.next(m => m.t === 'welcome');
  const crop = wA.view.crops[0].uuid;                       // both fight over this one
  ok(wA.view.crops.length === 3 && wB.view.crops.length === 3, `both clients see the same start world (3 crops; contested target ${crop})`);

  // --- clause: contested FOLDABLE field folds losslessly (crop.water = max) --
  A.send({ t: 'tx', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 100 }] });
  B.send({ t: 'tx', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 150 }] });
  await sleep(80);                                          // both queued pre-tick
  srv.doTick();
  const [tA1, tB1] = await Promise.all([A.next(m => m.t === 'tick'), B.next(m => m.t === 'tick')]);
  ok(tA1.yours[0]?.status === 'committed' && tB1.yours[0]?.status === 'committed',
    'same-tick contested water: BOTH txs committed (foldable, lossless)');
  B.send({ t: 'get' });
  const v1 = await B.next(m => m.t === 'view');
  const wat = v1.view.crops.find(c => c.uuid === crop)?.water;
  // grow/drain also ran this tick: fold(max)=150, then next committed state may drain -1
  ok(wat === 149 || wat === 150, `water folded to max(100,150) (observed ${wat}; 149 if drain also ticked)`);

  // --- clause: contested NON-foldable field defers, VISIBLY TO BOTH ----------
  A.send({ t: 'tx', ops: [{ kind: 'setfield', target: crop, field: 'name', value: 'alices' }] });
  B.send({ t: 'tx', ops: [{ kind: 'setfield', target: crop, field: 'name', value: 'bobs' }] });
  await sleep(80);
  srv.doTick();
  const [tA2, tB2] = await Promise.all([A.next(m => m.t === 'tick'), B.next(m => m.t === 'tick')]);
  const dA = tA2.deferrals.find(d => d.field === 'name'), dB = tB2.deferrals.find(d => d.field === 'name');
  ok(!!dA && !!dB, 'name conflict DEFERRED and the deferral is visible to BOTH clients');
  ok(dA && dA.competing.length === 2 && JSON.stringify(dA.competing) === JSON.stringify(dB.competing),
    'both clients see the SAME competing values (alice vs bob)');
  B.send({ t: 'get' });
  const v2 = await B.next(m => m.t === 'view');
  ok(v2.view.crops.find(c => c.uuid === crop)?.name === 'c0',
    'the contested name was written by NEITHER (held for author resolution, no LWW)');

  // --- claim blocks the other actor, visibly ---------------------------------
  A.send({ t: 'tx', ops: [{ kind: 'claim', target: crop, ticks: 6 }] });
  await sleep(50); srv.doTick();
  await Promise.all([A.next(m => m.t === 'tick'), B.next(m => m.t === 'tick')]);
  B.send({ t: 'tx', ops: [{ kind: 'setfield', target: crop, field: 'water', value: 7 }] });
  await sleep(50); srv.doTick();
  const [tA3, tB3] = await Promise.all([A.next(m => m.t === 'tick'), B.next(m => m.t === 'tick')]);
  ok(tB3.yours[0]?.status === 'rejected' && /claim/.test(tB3.yours[0]?.reasons[0] ?? ''),
    `bob blocked by alice's claim, with the holder named: "${tB3.yours[0]?.reasons[0]}"`);
  ok(tA3.claims.some(c => c.uuid === crop && c.holder === 'alice'),
    'the claim is LEGIBLE in the shared view (who holds what, until when)');

  // --- live rule authoring through the gate; rejected rule = byte-identical --
  const before = P.saveText(srv.engine);
  B.send({ t: 'rule', source: { name: 'cheat', match: { type: 'crop' },
    effects: [{ set: 'growth', to: { add: [{ field: 'growth' }, 50] } }] } });   // unclamped -> range_unprovable
  const rr1 = await B.next(m => m.t === 'rule-result');
  ok(!rr1.ok && /range_unprovable/.test(JSON.stringify(rr1.errors)),
    'bad rule rejected by the gate with a localized error (range_unprovable)');
  ok(P.saveText(srv.engine) === before, 'world BYTE-IDENTICAL after the rejected rule (the thesis, over the wire)');
  B.send({ t: 'rule', source: { name: 'bobsprinkler', match: { type: 'crop', where: { field: 'water', cmp: '<', value: 5 } },
    effects: [{ set: 'water', to: { min: [{ add: [{ field: 'water' }, 3] }, 255] } }] } });
  const rr2 = await B.next(m => m.t === 'rule-result');
  const evA = await A.next(m => m.t === 'event' && /bobsprinkler/.test(m.msg));
  ok(rr2.ok === true, "bob's valid rule installs through the same gate, live, mid-session");
  ok(!!evA, `alice was told: "${evA.msg}"`);

  // --- disconnect: claims release after grace (RD-022 releaseActor) ----------
  await A.close();
  await sleep(80);
  srv.doTick(); srv.doTick(); srv.doTick();                  // grace=2, then expired
  B.drain();
  B.send({ t: 'tx', ops: [{ kind: 'claim', target: crop, ticks: 3 }] });
  await sleep(50); srv.doTick();
  const tB4 = await B.next(m => m.t === 'tick' && m.yours.length);
  ok(tB4.yours[0]?.status === 'committed',
    "alice's claim released after the 2-tick grace — bob now holds the crop");

  // --- session record: zero unsafe + the M6 accounting line ------------------
  await B.close();
  const rec = await srv.stop();
  console.log(`\nsession record: ticks=${rec.ticks} unsafe=${rec.unsafe} deferrals=${rec.deferrals}`);
  console.log(`rule-effect accounting (BAR M6 amendment): dropped rule txs=${rec.ruleDrops.count} why=${JSON.stringify(rec.ruleDrops.why)}`);
  console.log(`per-client: ${JSON.stringify(rec.perClient)}`);
  ok(rec.unsafe === 0, 'ZERO unsafe events across the session');
  ok(typeof rec.ruleDrops.count === 'number' && rec.ruleDrops.why !== undefined,
    'the session record carries the rule-effect accounting line');

  console.log(`\n${FAIL === 0 ? 'ALL PASS' : 'FAILURES'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
