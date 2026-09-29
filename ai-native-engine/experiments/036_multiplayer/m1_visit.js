'use strict';
// One-shot scripted VISITOR for a live M1 session: connects to the user's
// running server as 'claude', exercises plant/claim/set/rule against the LIVE
// world (their clients see every event), leaves the world as found (uninstalls
// its rule; its crop is left to be reaped naturally). Read-mostly, polite.
const net = require('node:net');
const port = Number(process.argv[2] ?? 4242);
const sock = net.connect(port, '127.0.0.1');
sock.setEncoding('utf8');
const send = (m) => sock.write(JSON.stringify(m) + '\n');
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
const next = (pred, ms = 5000) => {
  const i = inbox.findIndex(pred);
  if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
  return new Promise((res, rej) => {
    const w = { pred, res }; waiters.push(w);
    setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); rej(new Error('timeout')); } }, ms);
  });
};
const myTick = () => next(m => m.t === 'tick' && m.yours.length);

sock.on('error', (e) => { console.log('CONNECT FAILED:', e.message, '— is the server running on', port, '?'); process.exit(1); });
sock.on('connect', () => send({ t: 'hello', name: 'claude' }));

(async () => {
  const w = await next(m => m.t === 'welcome');
  console.log(`[visit] joined live world at tick ${w.view.tick}: pop=${w.view.crops.length} tally=${w.view.tally} claims=${w.view.claims.length}`);

  // 1. plant a crop
  send({ t: 'tx', ops: [{ kind: 'createChild', type: 'crop', parent: w.view.zone, props: { name: 'claude-corn', water: 25, growth: 0 } }] });
  let t = await myTick();
  console.log(`[visit] plant claude-corn -> ${t.yours[0].status} (tick ${t.tick})`);

  // 2. find it, claim it, water it while holding the claim
  send({ t: 'get' });
  const v = await next(m => m.t === 'view');
  const mine = v.view.crops.find(c => c.name === 'claude-corn');
  if (!mine) throw new Error('claude-corn not found after commit');
  send({ t: 'tx', ops: [{ kind: 'claim', target: mine.uuid, ticks: 12 }] });
  t = await myTick();
  console.log(`[visit] claim ${mine.uuid} -> ${t.yours[0].status}`);
  send({ t: 'tx', ops: [{ kind: 'setfield', target: mine.uuid, field: 'water', value: 200 }] });
  t = await myTick();
  console.log(`[visit] water it while holding the claim -> ${t.yours[0].status}`);

  // 3. bad rule against the LIVE world: gate must reject, world untouched
  send({ t: 'rule', source: { name: 'cheat', match: { type: 'crop' }, effects: [{ set: 'growth', to: { add: [{ field: 'growth' }, 50] } }] } });
  const bad = await next(m => m.t === 'rule-result');
  console.log(`[visit] unclamped rule -> ok=${bad.ok} (${bad.errors?.[0]?.code})`);

  // 4. good rule, live, mid-session — their clients see the announcement
  send({ t: 'rule', source: { name: 'claude_sprinkler', match: { type: 'crop', where: { field: 'water', cmp: '<', value: 3 } },
    effects: [{ set: 'water', to: { min: [{ add: [{ field: 'water' }, 3] }, 255] } }] } });
  const good = await next(m => m.t === 'rule-result');
  console.log(`[visit] clamped sprinkler rule -> ok=${good.ok}`);

  // 5. observe a few ticks; confirm my claim is listed in the shared view
  const t2 = await next(m => m.t === 'tick' && m.claims?.some(c => c.holder === 'claude'));
  console.log(`[visit] shared view lists my claim: ${JSON.stringify(t2.claims.find(c => c.holder === 'claude'))}`);
  await new Promise(r => setTimeout(r, 1500));

  // 6. leave it as found
  send({ t: 'uninstall', name: 'claude_sprinkler' });
  await next(m => m.t === 'rule-result');
  console.log('[visit] uninstalled my rule; claude-corn stays and will be reaped naturally. bye');
  sock.end();
  process.exit(0);
})().catch(e => { console.log('[visit] ERROR:', e.message); process.exit(1); });
