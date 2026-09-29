'use strict';
// =============================================================================
// 037 — INTENT2 END-TO-END against the REAL Pong world, through the SERVED
// browser bundle and the REAL gate. This closes the thread the user opened on
// 2026-07-16 ("move left paddle down" got a farm-verb refusal in a live Pong
// world) with the exact chain the browser runs:
//
//   real m1_server (WORLD=pong)                       <- the live game
//     -> GET /lib/intent2.js  (the browser wrapper)   <- the SERVED bundle
//        eval'd exactly as a <script> would            <- window.INTENT2.parse
//     -> welcome.view  (a real server snapshot)        <- schema-driven, no fixture
//     -> parse(view, 'move left paddle down')          <- the user's phrase
//     -> {t:'tx', ops}  over the transport             <- sanitizeOps (runtime schema)
//     -> doTick()  (the engine pipeline / RD-B* gate)  <- validate-before-execute
//     -> a fresh snapshot                              <- OBSERVE the world moved
//
// The unit suite (intent2_test.js, 75/75) already proves the parser in
// isolation on synthetic worlds. THIS proves the integrated claim: the served
// module, the real Pong vocabulary (paddle/ball, x/y — NOT the fixture's
// slider/orb), the real transport, and the real gate all agree, and the world
// actually changes. Plus the negative: a farm verb in a Pong world is refused,
// not silently reinterpreted.
//
//   node experiments/037_ai_native_editor/intent2_e2e_pong_test.js
// =============================================================================
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { startServer } = require(path.join(__dirname, '..', '036_multiplayer', 'm1_server.js'));

let PASS = 0, FAIL = 0;
const ok = (c, m) => { c ? PASS++ : FAIL++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };

const PORT = 4471;                 // TCP; HTTP is PORT+1
const HTTP = PORT + 1;

// ---- tiny helpers -------------------------------------------------------------
function httpGet(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: HTTP, path: p }, (r) => {
      let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => res({ status: r.statusCode, body: b }));
    }).on('error', rej);
  });
}

// A line-delimited-JSON TCP client for the terminal transport. Same onMessage /
// snapshot / sanitizeOps the browser hits — the browser just uses HTTP+SSE.
function connect() {
  const sock = net.createConnection(PORT, '127.0.0.1');
  sock.setEncoding('utf8');
  const waiters = [];         // FIFO of {match, resolve}
  const backlog = [];
  let buf = '';
  const deliver = (msg) => {
    const i = waiters.findIndex((w) => w.match(msg));
    if (i >= 0) { const [w] = waiters.splice(i, 1); w.resolve(msg); }
    else backlog.push(msg);
  };
  sock.on('data', (chunk) => {
    buf += chunk; let j;
    while ((j = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, j); buf = buf.slice(j + 1);
      if (line.trim()) deliver(JSON.parse(line));
    }
  });
  const send = (msg) => sock.write(JSON.stringify(msg) + '\n');
  const waitFor = (match, ms = 3000) => new Promise((resolve, reject) => {
    const bi = backlog.findIndex(match);
    if (bi >= 0) { const [m] = backlog.splice(bi, 1); return resolve(m); }
    const w = { match, resolve };
    waiters.push(w);
    setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); reject(new Error('timeout waiting for ' + match)); } }, ms);
  });
  return { sock, send, waitFor, end: () => sock.destroy() };
}

// Load the served bundle the way a <script src="/lib/intent2.js"> would: run the
// wrapper text with a fake `window` and read window.INTENT2 back out.
function evalServedBundle(wrapperText) {
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', wrapperText)(window);
  return window.INTENT2;
}

(async () => {
  const h = startServer({ port: PORT, world: 'pong', manual: true, quiet: true });
  await new Promise((r) => setTimeout(r, 150));   // let both listeners bind

  try {
    // 1) the SERVED bundle -----------------------------------------------------
    const served = await httpGet('/lib/intent2.js');
    ok(served.status === 200, 'GET /lib/intent2.js served (200)');
    ok(/window\.INTENT2\s*=/.test(served.body), 'served body is the browser wrapper assigning window.INTENT2');
    const INTENT2 = evalServedBundle(served.body);
    ok(INTENT2 && typeof INTENT2.parse === 'function', 'served bundle evaluates to an object exposing parse()');

    // 2) a REAL Pong snapshot over the transport -------------------------------
    const cli = connect();
    cli.send({ t: 'hello', name: 'grace' });        // greet first; welcome carries the snapshot
    const welcome = await cli.waitFor((m) => m.t === 'welcome');
    const view = welcome.view;
    ok(view && Array.isArray(view.entities), 'welcome carries a real server snapshot with entities');
    const defNames = (view.schemaDefs || []).map((d) => d.name).sort();
    ok(JSON.stringify(defNames) === JSON.stringify(['ball', 'paddle']),
      `Pong vocabulary is exactly paddle+ball (got: ${defNames.join('+')}) — not the farm, not the fixture`);
    const leftBefore = view.entities.find((e) => e.name === 'left paddle');
    ok(leftBefore && leftBefore.type === 'paddle' && leftBefore.fields.y === 128,
      `the world contains 'left paddle' (a paddle) at y=${leftBefore && leftBefore.fields.y}`);

    // 3) THE USER'S PHRASE, through the served parser --------------------------
    const r = INTENT2.parse(view, 'move left paddle down');
    ok(r.kind === 'ops' && r.ops.length === 1, "'move left paddle down' -> 1 op (NOT a farm-verb refusal)");
    ok(r.ops[0].kind === 'setfield' && r.ops[0].target === leftBefore.uuid && r.ops[0].field === 'y' && r.ops[0].value === 136,
      `resolves to the real left paddle, y 128 -> 136 on the real spatial field (op: ${JSON.stringify(r.ops[0])})`);
    ok(/left paddle/.test(r.say) && /128/.test(r.say) && /136/.test(r.say) && !new RegExp(leftBefore.uuid).test(r.say),
      `human echo names the paddle and 128->136, no bare uuid: "${r.say}"`);

    // 4) commit through the REAL transport + gate ------------------------------
    cli.send({ t: 'tx', ops: r.ops });
    const queued = await cli.waitFor((m) => m.t === 'queued' || m.t === 'error');
    ok(queued.t === 'queued' && queued.n === 1, 'sanitizeOps (runtime Pong schema) accepted the op and queued it');
    h.doTick();                                    // the pipeline runs the gate

    // 5) OBSERVE: the live world actually moved --------------------------------
    cli.send({ t: 'get' });
    const after = await cli.waitFor((m) => m.t === 'view');
    const leftAfter = after.view.entities.find((e) => e.uuid === leftBefore.uuid);
    ok(leftAfter && leftAfter.fields.y === 136,
      `the committed world moved: left paddle y ${leftBefore.fields.y} -> ${leftAfter && leftAfter.fields.y}`);

    // 6) NEGATIVE: a farm verb in a Pong world is REFUSED, not reinterpreted ----
    const farm = INTENT2.parse(after.view, 'water the driest crop');
    ok(farm.kind === 'error', "'water the driest crop' in a Pong world -> error (no farm verb leaks in)");
    ok(!/\bcrop\b/i.test((view.schemaDefs || []).map((d) => d.name).join(' ')),
      'the Pong world has no crop type at all (de-farmed at the source, not just the strings)');

    cli.end();
  } catch (e) {
    ok(false, 'threw: ' + e.stack);
  } finally {
    await h.stop();
  }

  console.log(`\n${FAIL ? 'FAIL' : 'ALL PASS'} — ${PASS} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})();
