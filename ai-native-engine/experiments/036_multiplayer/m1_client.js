'use strict';
// =============================================================================
// M1 CLIENT — thin terminal REPL. Constructs command messages; ALL state lives
// on the server; every mutation the user types becomes a tx that flows through
// the server's single submit() at the next tick (RD-M1 pinned invariant).
//
//   node experiments/036_multiplayer/m1_client.js <name> [port]
//
// Commands:
//   look                         world snapshot (crops, tally, claims)
//   set <uuid> <field> <value>   e.g. set u1 water 200
//   name <uuid> <label>          set the name label (defer-on-conflict field)
//   claim <uuid> [ticks]         hold an entity (RD-002/022)
//   move <uuid> <afterUuid|front>
//   del <uuid>
//   plant [name]                 spawn a crop under the field zone
//   rule <json>                  author a behavior rule (RD-B6 gate decides)
//   uninstall <ruleName>
//   quit
// =============================================================================
const net = require('node:net');
const readline = require('node:readline');

const name = process.argv[2];
const port = Number(process.argv[3] ?? 4242);
if (!name) { console.error('usage: node m1_client.js <name> [port]'); process.exit(1); }

const sock = net.connect(port, '127.0.0.1');
sock.setEncoding('utf8');
const send = (m) => sock.write(JSON.stringify(m) + '\n');

let zone = null;
let lastTickShown = 0;
// name -> [uuids], refreshed from every welcome/view ('look'). Humans point at
// things by NAME; the wire speaks uuid (RD-004: names are mutable labels, not
// identity). Resolution is client-side sugar — the server never sees names as
// addresses, and a stale cache just earns the engine's own localized rejection.
const known = new Map();
function learn(view) {
  known.clear();
  for (const c of view.crops) (known.get(c.name) ?? known.set(c.name, []).get(c.name)).push(c.uuid);
}
function resolveId(token) {
  if (/^u[0-9a-z]+$/.test(token) || !known.size) return token;   // looks like a uuid, or nothing learned yet
  const hits = known.get(token);
  if (!hits) { console.log(`! no live '${token}' known here — it may have been harvested; 'look' refreshes names`); return null; }
  if (hits.length > 1) { console.log(`! '${token}' is ambiguous: ${hits.join(', ')} — use the uuid (see 'look')`); return null; }
  console.log(`(${token} -> ${hits[0]})`);
  return hits[0];
}
let quietLook = false;   // auto-refresh of the name cache without reprinting the world
let pendingPlant = false; // after a committed plant, refresh names so 'claim <name>' just works

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: `${name}> ` });

function show(view) {
  console.log(`tick ${view.tick}  tally=${view.tally}  crops=${view.crops.length}`);
  for (const c of view.crops) console.log(`  ${c.uuid}  ${String(c.name).padEnd(12)} water=${String(c.water).padStart(3)} growth=${String(c.growth).padStart(3)}`);
  if (view.claims.length) for (const cl of view.claims) console.log(`  CLAIM ${cl.uuid} held by ${cl.holder} until tick ${cl.until}`);
}

sock.on('data', (() => { let buf = ''; return (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.t === 'welcome') { zone = m.view.zone; learn(m.view); console.log(`connected as ${m.you} — 'look' to see the world`); show(m.view); rl.prompt(); }
    else if (m.t === 'view') { learn(m.view); if (!quietLook) { show(m.view); rl.prompt(); } quietLook = false; }
    else if (m.t === 'tick') {
      if (pendingPlant && m.yours.some(y => y.status === 'committed')) { pendingPlant = false; quietLook = true; send({ t: 'get' }); }
      const noteworthy = m.yours.length || m.deferrals.length;
      if (noteworthy || m.tick - lastTickShown >= 20) {
        lastTickShown = m.tick;
        const bits = [`[t${m.tick}] pop=${m.pop} tally=${m.tally}`];
        for (const y of m.yours) bits.push(y.status === 'committed' ? '✓ committed' : `✗ ${y.status}: ${y.reasons.join(' | ')}`);
        for (const d of m.deferrals) bits.push(`⚖ DEFERRED ${d.field} of ${d.target}: ${d.competing.map(x => `${x.actor}=${JSON.stringify(x.value ?? x.parent)}`).join(' vs ')} — held for author resolution`);
        console.log('\n' + bits.join('\n'));
        rl.prompt();
      }
    }
    else if (m.t === 'rule-result') { console.log(m.ok ? `✓ rule '${m.name}' installed` : `✗ rule rejected:\n${(m.errors ?? []).map(e => `  [${e.where}] ${e.code}: ${e.detail ?? ''}`).join('\n')}`); rl.prompt(); }
    else if (m.t === 'event') { console.log(`* ${m.msg}`); rl.prompt(); }
    else if (m.t === 'error') { console.log(`! ${m.err}`); rl.prompt(); }
    else if (m.t === 'queued') { /* quiet ack; result arrives with the tick */ }
  }
}; })());

sock.on('connect', () => send({ t: 'hello', name }));
sock.on('close', () => { console.log('server closed'); process.exit(0); });
sock.on('error', (e) => { console.error(`connection error: ${e.message}`); process.exit(1); });

rl.on('line', (line) => {
  const [cmd, ...a] = line.trim().split(/\s+/);
  if (!cmd) return rl.prompt();
  if (cmd === 'quit') { sock.end(); return; }
  if (cmd === 'look') send({ t: 'get' });
  else if (cmd === 'set' && a.length === 3) { const u = resolveId(a[0]); if (u) send({ t: 'tx', ops: [{ kind: 'setfield', target: u, field: a[1], value: Number.isNaN(Number(a[2])) ? a[2] : Number(a[2]) }] }); else rl.prompt(); }
  else if (cmd === 'name' && a.length >= 2) { const u = resolveId(a[0]); if (u) send({ t: 'tx', ops: [{ kind: 'setfield', target: u, field: 'name', value: a.slice(1).join(' ') }] }); else rl.prompt(); }
  // default 40 ticks (~10s at 250ms) — the engine's own default (3) is tuned
  // for sim actors and expires before a human finishes reading `look`.
  else if (cmd === 'claim' && a.length >= 1) { const u = resolveId(a[0]); if (u) send({ t: 'tx', ops: [{ kind: 'claim', target: u, ticks: a[1] ? Number(a[1]) : 40 }] }); else rl.prompt(); }
  else if (cmd === 'move' && a.length === 2) { const u = resolveId(a[0]); if (u) send({ t: 'tx', ops: [{ kind: 'move', target: u, after: a[1] === 'front' ? null : resolveId(a[1]) }] }); else rl.prompt(); }
  else if ((cmd === 'del' || cmd === 'harvest') && a.length === 1) { const u = resolveId(a[0]); if (u) send({ t: 'tx', ops: [{ kind: 'delete', target: u }] }); else rl.prompt(); }
  else if (cmd === 'plant') { pendingPlant = true; send({ t: 'tx', ops: [{ kind: 'createChild', type: 'crop', parent: zone, props: { name: a[0] ?? 'seed', water: 25, growth: 0 } }] }); }
  else if (cmd === 'water' && a.length >= 1) { const u = resolveId(a[0]); if (u) send({ t: 'tx', ops: [{ kind: 'setfield', target: u, field: 'water', value: Number(a[1] ?? 100) }] }); else rl.prompt(); }
  else if (cmd === 'rule') { try { send({ t: 'rule', source: JSON.parse(a.join(' ')) }); } catch { console.log('! rule needs valid one-line JSON'); rl.prompt(); } }
  else if (cmd === 'uninstall' && a.length === 1) send({ t: 'uninstall', name: a[0] });
  else { console.log('commands: look | plant [name] | water name|u [amt] | claim name|u [ticks=40] | harvest name|u | set name|u field v | name u label | move u after|front | del u | rule {json} | uninstall n | quit'); rl.prompt(); }
});
rl.on('close', () => sock.end());
