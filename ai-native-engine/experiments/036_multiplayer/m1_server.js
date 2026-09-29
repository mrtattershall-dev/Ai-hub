'use strict';
// =============================================================================
// M1 SERVER — one authoritative engine, N thin clients, ONE submit().
// Invariant pinned in decisions/RD-M1_transport.md BEFORE this file existed:
// the transport parses and routes; it never mutates. Two sanctioned channels
// only — submit() (world mutation, via stepTick extraBatch) and installRule()
// (behavior content, the RD-B6 gate). Handlers below construct data and queue;
// doTick() and the gate are the only code touching the engine.
//
// TWO transports, same channels, same handlers:
//   - TCP newline-JSON on <port>        (terminal clients: m1_client.js)
//   - HTTP + SSE on <port+1>            (the VISUAL EDITOR: editor.html)
// The browser is just another client; it speaks the identical message grammar
// via POST /msg and receives the identical tick broadcasts via SSE.
//
// Run:  node experiments/036_multiplayer/m1_server.js [port] [tickMs]
// Then: node experiments/036_multiplayer/m1_client.js <name> [port]   (terminal)
//  or:  open http://127.0.0.1:<port+1>/                               (visual)
// Zero deps.
// =============================================================================
const net = require('node:net');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const CORE = (f) => require(path.join(__dirname, '..', '..', 'core', f));
const { Engine, TYPE, TYPE_NAME } = CORE('engine.js');
const { installRule, uninstallRule, writeSmells } = CORE('behavior.js');
const { runRuleLoop } = CORE('editor.js');
const P = CORE('persistence.js');
const H = require(path.join(__dirname, '..', '034_homestead_game', 'homestead.js'));

const VERSION = 'editor-v2 (2026-07-16)';
// v2 UI + language modules live in 037; fall back to the v1 page beside us.
const UI_DIR = path.join(__dirname, '..', '037_ai_native_editor');

// The AI-propose model. REMOTE ONLY — this machine must never serve local
// inference (owner rule, memory: no-local-models-hard-rule). Two backends:
//   MODEL_ENDPOINT + MODEL_NAME [+ MODEL_KEY]  -> OpenAI-compatible /chat/completions (e.g. Modal vLLM)
//   MODEL_MOCK=1                               -> deterministic template proposer (plumbing tests, no LLM)
// Neither set -> propose replies 'no remote model configured' (UI explains).
function makeCallModel() {
  if (process.env.MODEL_MOCK === '1') return async (prompt) => {
    // minimal honest mock: echo a clamped sprinkler-style rule for any goal.
    const goal = (prompt.match(/GOAL: (.*)/) || [, ''])[1];
    return JSON.stringify({ name: (goal.match(/[a-z]+/i) || ['rule'])[0].toLowerCase() + '_ai',
      match: { type: 'crop', where: { field: 'water', cmp: '<', value: 10 } },
      effects: [{ set: 'water', to: { min: [{ add: [{ field: 'water' }, 5] }, 255] } }] });
  };
  const url = process.env.MODEL_ENDPOINT, name = process.env.MODEL_NAME;
  if (!url || !name) return null;
  // accept either an OpenAI-style base ending in /v1 (append the route) or a
  // full single-route URL (e.g. a Modal fastapi_endpoint) used as-is.
  const full = /\/v1\/?$/.test(url) ? url.replace(/\/$/, '') + '/chat/completions' : url;
  return async (prompt) => {
    const r = await fetch(full, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.MODEL_KEY ? { Authorization: `Bearer ${process.env.MODEL_KEY}` } : {}) },
      body: JSON.stringify({ model: name, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 600 }),
    });
    if (!r.ok) throw new Error(`model endpoint ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const t = (await r.json()).choices?.[0]?.message?.content ?? '';
    const s = t.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/gi, '');
    const i = s.indexOf('{');
    return i < 0 ? s : s.slice(i, s.lastIndexOf('}') + 1 || undefined);
  };
}

const OP_KINDS = new Set(['setfield', 'claim', 'move', 'delete', 'createChild']);

// Transport hygiene: SHAPE-CHECK only — reject, never repair (repair is
// interpretation, and interpretation on the write path is a mutation policy).
function sanitizeOps(raw, schema = null) {
  // RD-M2: type names resolve against the WORLD's runtime schema when given;
  // the module-level farm table remains the default (back-compat, RD-024).
  const typeNames = schema ? schema.TYPE_NAME : TYPE_NAME;
  if (!Array.isArray(raw) || !raw.length || raw.length > 32)
    return { err: 'ops must be a non-empty array of <= 32 ops' };
  const ops = [];
  for (const o of raw) {
    if (!o || typeof o !== 'object' || !OP_KINDS.has(o.kind)) return { err: `unknown op kind '${o && o.kind}'` };
    if (o.kind === 'createChild') {
      const ty = typeNames.indexOf(String(o.type));
      if (ty < 0) return { err: `unknown entity type '${o.type}'` };
      // RD-034: parent is OPTIONAL — root entities are legal (the engine always
      // allowed them; this check didn't, because farm crops always grew under a
      // zone. An empty world's first tower has no parent to have.)
      if (o.parent != null && typeof o.parent !== 'string') return { err: 'createChild parent must be a uuid string or null' };
      const props = (o.props && typeof o.props === 'object') ? o.props : {};
      ops.push({ kind: 'createChild', type: ty, parent: o.parent ?? null, props });
    } else {
      if (typeof o.target !== 'string') return { err: `${o.kind} needs a target uuid string` };
      const op = { kind: o.kind, target: o.target };
      if (o.kind === 'setfield') {
        if (typeof o.field !== 'string') return { err: 'setfield needs a field name' };
        op.field = o.field; op.value = o.value; // value validated by the pipeline (range/type invariants)
      }
      if (o.kind === 'claim') op.ticks = o.ticks;          // validated by RD-022 in the pipeline
      if (o.kind === 'move') op.after = o.after == null ? null : String(o.after);
      ops.push(op);
    }
  }
  return { ops };
}

// RD-033: the WORLD is a choice, not a hardcode. Each builder returns
// {engine, zone} — `zone` is the farm's root and is simply null for worlds that
// have no such thing (the snapshot omits it rather than lying with a fake one).
const WORLDS = {
  // RD-034: the GAME-CREATION world — no types, no rules, no entities. Everything
  // it ever contains arrives through the three gates (deftype / rule / tx). This
  // is the "building games with AI" surface, not a demo to watch.
  empty: (capacity) => ({ engine: new Engine(capacity, { schemaDefs: [] }), zone: null }),
  farm: (capacity) => {
    const { engine, zone } = H.buildStartWorld(new Engine(capacity));
    for (const r of H.oracleRules()) {
      const res = installRule(engine, r);
      if (!res.ok) throw new Error(`oracle rule failed: ${JSON.stringify(res.errors)}`);
    }
    return { engine, zone };
  },
  pong: () => {
    const V2 = require(path.join(__dirname, '..', '042_pong', 'pong_rules_v2.js'));
    const { g, T } = V2.buildWorld();
    for (const r of V2.install(g)) if (!r.ok) throw new Error(`pong rule ${r.name}: ${JSON.stringify(r.errors)}`);
    g.spawn(T.paddle, { name: 'left paddle', x: 8, y: 128, side: 0 });
    g.spawn(T.paddle, { name: 'right paddle', x: 247, y: 128, side: 1 });
    g.spawn(T.ball, { name: 'ball', x: 128, y: 128, vx: -3, vy: 1 });
    return { engine: g, zone: null };
  },
  shooter: () => {
    const S = require(path.join(__dirname, '..', '044_shooter', 'shooter_rules.js'));
    const { g, T } = S.buildWorld();
    for (const r of S.install(g)) if (!r.ok) throw new Error(`shooter rule ${r.name}: ${JSON.stringify(r.errors)}`);
    g.spawn(T.player, { name: 'you', x: 128, y: 128 });
    g.spawn(T.spawner, { name: 'nest' });
    for (let i = 0; i < S.POOL; i++) g.spawn(T.bullet, { name: `bullet ${i + 1}`, life: 0 });
    for (const [i, p] of [[40, 40], [210, 60], [60, 200]].entries())
      g.spawn(T.enemy, { name: `enemy ${i + 1}`, x: p[0], y: p[1], hp: 100 });
    return { engine: g, zone: null };
  },
};

function startServer({ port = 4242, tickMs = 250, manual = false, graceTicks = 8, quiet = false, capacity = 65536, world = 'farm', pendingOpsCap = 4096 } = {}) {
  // FIRST LIVE HUMAN SESSION FINDING (2026-07-16): the Phase B fixture default
  // (Engine(256)) is a ~756-tick death sentence for a PERSISTENT server — rows
  // are never reused (RD-004.6), reseed burns 1 row/3 ticks, so at 4Hz the
  // world fills in ~3 minutes, every later spawn is rejected 'world full', and
  // the farm dies with nothing able to replant. 64k rows ≈ 13h at 4Hz. The
  // real long-lived-server answer (periodic save/load compaction — RD-019's
  // load compacts tombstoned rows out — or an explicit row-reuse policy) is an
  // open M-series design question, deliberately not improvised here.
  if (!WORLDS[world]) throw new Error(`unknown world '${world}' — one of: ${Object.keys(WORLDS).join(', ')}`);
  const { engine, zone } = WORLDS[world](capacity);
  const clients = new Map(); // id -> {name, push(msg)}
  const callModel = makeCallModel();
  let nextId = 1;
  let pending = [];          // queued client txs -> next tick's extraBatch
  let pendingOps = 0;        // running op count in `pending`, bounded per tick (flood guard)
  const stats = { ticks: 0, perClient: {}, deferrals: 0, ruleDrops: { count: 0, why: {} }, unsafe: 0, popMin: Infinity, popMax: 0 };
  const say = (m) => { if (!quiet) console.log(m); };
  const broadcast = (msg) => { for (const r of clients.values()) r.push(msg); };
  const nameTaken = (name) => [...clients.values()].some(x => x.name === name);

  // read path: the SAME frozen read-only view systems get + a claims listing.
  // RD-033: the READ path is schema-driven. It used to hand out `crops` with
  // hardcoded water/growth — so a Pong world sent `crops: []` and the editor could
  // not see any game but the farm, however general the engine underneath had become.
  // Now every live entity travels with its declared fields; the client decides how
  // to draw them from `schemaDefs` (which types declare spatial:{x,y}, what each
  // field's range is). No farm strings below this line.
  function snapshot() {
    const v = engine._systemView();
    const w = engine.w;
    const claims = [...engine.claims].map(([e, c]) => ({ uuid: w.uuid[e], holder: c.actor, until: c.until }));
    const entities = [];
    for (const d of w.schema.defs) {
      const fieldNames = Object.entries(d.fields).filter(([, sp]) => sp.pool !== false).map(([f]) => f);
      for (const u of v.allOfType(d.name)) {
        const fields = {};
        for (const f of fieldNames) fields[f] = v.field(u, f);
        entities.push({ uuid: u, type: d.name, name: v.nameOf(u), parent: v.parentOf(u), fields });
      }
    }
    const snap = { tick: v.tick, entities, claims,
      rules: [...(engine.ruleSources?.keys() ?? [])],
      schemaDefs: w.schema.defs,                       // RD-M2: the vocabulary travels to clients
      rows: { used: w.count, cap: w.capacity } };
    // BACK-COMPAT (bar 4): the terminal client and m1_test read `crops`/`zone`/
    // `tally`. Derived here from the generic `entities` — present only when the
    // world happens to HAVE those types, absent (not empty-and-lying) otherwise.
    if (w.schema.TYPE_NAME.includes('crop'))
      snap.crops = entities.filter(e => e.type === 'crop').map(e => ({ uuid: e.uuid, name: e.name, water: e.fields.water, growth: e.fields.growth }));
    if (zone != null && v.typeOf(zone)) { snap.zone = zone; snap.tally = v.field(zone, 'tally'); }
    return snap;
  }

  function unsafeCheck() {
    let u = 0;
    if (!engine.indexesConsistent()) u++;
    for (const [uu, e] of engine.w.byUuid) if (engine.w.destroyed[e] || engine.w.uuid[e] !== uu) u++;
    return u;
  }

  function doTick() {
    const extra = pending; pending = []; pendingOps = 0;
    const byActor = new Map(extra.map(tx => [tx.actor, []]));
    const r = engine.stepTick(extra);
    stats.ticks++;
    for (const res of r.results) {
      if (String(res.actor).startsWith('sys:')) {
        if (res.status === 'rejected') {                       // M6 amendment: rule-effect accounting
          stats.ruleDrops.count++;
          const why = String(res.reasons[0] ?? '?').split(':')[0];
          stats.ruleDrops.why[why] = (stats.ruleDrops.why[why] ?? 0) + 1;
        }
        continue;
      }
      const mine = byActor.get(res.actor);
      if (mine) mine.push({ status: res.status, reasons: res.reasons });
      const pc = stats.perClient[res.actor] ??= { committed: 0, rejected: 0 };
      if (res.status === 'committed') pc.committed++; else if (res.status === 'rejected') pc.rejected++;
    }
    stats.deferrals += r.deferrals.length;
    stats.unsafe += unsafeCheck();
    // row-budget visibility + tombstone GC (bounds the tombstone map; rows
    // themselves are monotonic by design — see capacity note above).
    if (stats.ticks % 200 === 0) {
      engine.gcTombstones();
      const used = engine.w.count / engine.w.capacity;
      if (used >= 0.9) { say(`! world rows ${(used * 100).toFixed(0)}% consumed (${engine.w.count}/${engine.w.capacity}) — session nearing its row budget`);
        broadcast({ t: 'event', msg: `world rows ${(used * 100).toFixed(0)}% consumed — session nearing its row budget` }); }
    }
    const snap = snapshot();
    // RD-033: population is ENTITIES, not crops. This line crashed the first Pong
    // server the moment `crops` correctly stopped existing — the session record was
    // still farm-shaped one layer below the view. Same assumption, deeper.
    stats.popMin = Math.min(stats.popMin, snap.entities.length);
    stats.popMax = Math.max(stats.popMax, snap.entities.length);
    for (const rec of clients.values()) {
      rec.push({ t: 'tick', tick: r.tick, pop: snap.entities.length, tally: snap.tally,
        yours: byActor.get(rec.name) ?? [], deferrals: r.deferrals,       // deferrals visible to ALL clients (BAR M1)
        claims: snap.claims, entities: snap.entities, crops: snap.crops, rows: snap.rows,  // RD-033: entities generic; crops kept for the terminal client
        schemaDefs: snap.schemaDefs,             // RD-034: a type defined mid-session reaches every client next tick
        rules: snap.rules,                                               // v2: rule chips stay live (stale-chip fix)
        drops: stats.ruleDrops.count });
    }
    return r;
  }

  function sessionRecord() {
    return { ...stats, popMin: stats.popMin === Infinity ? null : stats.popMin };
  }

  // one message grammar for every transport. reply() answers the sender.
  function onMessage(reply, c, msg) {
    if (msg.t === 'hello') {
      const name = String(msg.name ?? '').slice(0, 24);
      if (!name || nameTaken(name)) return reply({ t: 'error', err: 'name empty or taken' });
      c.name = name;
      stats.perClient[name] ??= { committed: 0, rejected: 0 };
      say(`+ ${name} connected`);
      reply({ t: 'welcome', you: name, view: snapshot() });
      broadcast({ t: 'event', msg: `${name} joined` });
    } else if (!c.name) {
      reply({ t: 'error', err: 'say hello first' });
    } else if (msg.t === 'tx') {
      const { ops, err } = sanitizeOps(msg.ops, engine.w.schema);   // RD-M2: runtime vocabulary
      if (err) return reply({ t: 'error', err });
      // FLOOD GUARD (RD-035 audit #2): sanitizeOps caps ONE message at 32 ops, but a
      // client could send unlimited messages between ticks, growing `pending`
      // unboundedly and stalling the tick for EVERYONE. Bound the per-tick client op
      // budget here, at ingestion. NOT engine.tickOpsBudget: that sorts txs by actor
      // name and `sys:rule:*` sorts LATE, so a client flood would starve the system
      // rules and freeze the simulation. Capping the client queue leaves rules untouched.
      if (pendingOps + ops.length > pendingOpsCap)
        return reply({ t: 'error', err: `server busy — ${pendingOps}/${pendingOpsCap} ops already queued this tick; tx dropped, retry next tick` });
      pending.push({ actor: c.name, ops });                    // queued; the TICK submits it
      pendingOps += ops.length;
      reply({ t: 'queued', n: ops.length });
    } else if (msg.t === 'rule') {
      const r = installRule(engine, msg.source, msg.replace ? { replace: true } : {});   // the RD-B6 gate
      // RD-035: warnings are ADVISORIES (the unconditional-write smell), distinct from
      // errors — the rule is installed and safe; the author is asked to confirm intent.
      reply({ t: 'rule-result', ok: r.ok, name: r.ok ? r.name : undefined, errors: r.ok ? undefined : r.errors, warnings: r.ok ? r.warnings : undefined });
      if (r.ok) broadcast({ t: 'event', msg: `${c.name} installed rule '${r.name}'${r.warnings?.length ? ' (with an advisory)' : ''}` });
    } else if (msg.t === 'deftype') {
      // RD-034: schema authoring over the wire — the THIRD sanctioned gate
      // (RD-024's defineType validates fully and applies atomically; a rejected
      // definition changes NOTHING). The transport still never mutates: it routes
      // to a gate, exactly like 'rule' routes to installRule.
      const r = engine.defineType(msg.spec ?? {});
      reply({ t: 'deftype-result', ok: r.ok, name: r.ok ? r.name : undefined, errors: r.ok ? undefined : r.errors });
      if (r.ok) {
        say(`+ ${c.name} defined type '${r.name}'`);
        broadcast({ t: 'event', msg: `${c.name} defined a new type: '${r.name}'` });
      }
    } else if (msg.t === 'uninstall') {
      const r = uninstallRule(engine, String(msg.name ?? ''));
      reply({ t: 'rule-result', ok: r.ok, name: msg.name, errors: r.ok ? undefined : r.errors });
      if (r.ok) broadcast({ t: 'event', msg: `${c.name} uninstalled rule '${msg.name}'` });
    } else if (msg.t === 'get') {
      reply({ t: 'view', view: snapshot() });
    } else if (msg.t === 'propose') {
      // AI-authoring: propose -> gate -> repair, ALL against a sandbox CLONE of
      // the world (P.load(P.save())) — the live world is untouched until the
      // human reads the explanation and installs through the normal 'rule'
      // path. The clone also means a mid-propose tick can't race the loop.
      const goal = String(msg.goal ?? '').slice(0, 400);
      if (!goal.trim()) return reply({ t: 'propose-result', ok: false, err: 'empty goal' });
      if (!callModel) return reply({ t: 'propose-result', ok: false, err: 'no remote model configured — set MODEL_ENDPOINT + MODEL_NAME (never local)' });
      broadcast({ t: 'event', msg: `${c.name} asked the AI: "${goal}"` });
      say(`? ${c.name} propose: "${goal}"`);
      return (async () => {
        const sandbox = P.load(P.save(engine));
        const r = await runRuleLoop(sandbox, callModel, { goal, rootUuid: zone, maxAttempts: 4 });
        // HOUSE RULE (STATE.md, pinned 2026-07-16): capture FULL artifacts on
        // every live GPU run — raw rule bodies + reject codes, not just verdicts.
        // The first live-user propose failure was undiagnosable without this.
        try { fs.appendFileSync(path.join(UI_DIR, 'propose_log.jsonl'),
          JSON.stringify({ at: new Date().toISOString(), who: c.name, goal, success: r.success, transcript: r.transcript }) + '\n'); } catch {}
        say(`? propose ${r.success ? `OK '${r.name}'` : 'REFUSED'} after ${r.attempts} attempt(s)`);
        if (!r.success) return { t: 'propose-result', ok: false, goal, attempts: r.attempts,
          errors: r.transcript.at(-1)?.errors ?? [],
          lastRaw: String(r.transcript.at(-1)?.raw ?? '').slice(0, 2000),   // the AI's final draft, so the human can SEE what was refused
          err: 'the gate refused every attempt — world untouched' };
        const source = sandbox.ruleSources.get(r.name);
        // RD-035: surface the unconditional-write advisory in the PREVIEW, before the
        // human clicks install — the gate teaching at draft time, not after deferral spam.
        const warnings = writeSmells(sandbox, source);
        return { t: 'propose-result', ok: true, goal, attempts: r.attempts, name: r.name, source, warnings };
      })().then(reply, (e) => reply({ t: 'propose-result', ok: false, err: String(e.message).slice(0, 200) }));
    } else if (msg.t === 'decision' || msg.t === 'uxlog') {
      // artifact capture only (house rule) — these handlers do I/O, never touch the engine.
      const entry = msg.t === 'decision'
        ? { at: new Date().toISOString(), who: c.name, kind: 'decision', goal: String(msg.goal ?? '').slice(0, 400),
            name: msg.name == null ? null : String(msg.name).slice(0, 80), verdict: String(msg.verdict ?? '').slice(0, 20) }
        : { at: new Date().toISOString(), who: c.name, kind: String(msg.event ?? '').slice(0, 40),
            text: String(msg.text ?? '').slice(0, 200), say: String(msg.say ?? '').slice(0, 200) };
      const file = msg.t === 'decision' ? 'propose_log.jsonl' : 'ux_log.jsonl';
      try { fs.appendFileSync(path.join(UI_DIR, file), JSON.stringify(entry) + '\n'); } catch {}
      reply({ t: 'ok' });
    } else {
      reply({ t: 'error', err: `unknown message type '${msg.t}'` });
    }
  }

  function dropClient(id, rec) {
    if (!clients.has(id)) return;
    clients.delete(id);
    if (rec.name) {
      const released = engine.releaseActor(rec.name, { graceTicks });   // RD-022: disconnect ≠ timeout
      say(`- ${rec.name} disconnected (${released} claim(s) enter ${graceTicks}-tick grace)`);
      broadcast({ t: 'event', msg: `${rec.name} left (claims release after ${graceTicks}-tick grace)` });
    }
  }

  // ---- transport 1: TCP newline-JSON ----------------------------------------
  const tcpSocks = new Set();
  const server = net.createServer((sock) => {
    tcpSocks.add(sock); sock.once('close', () => tcpSocks.delete(sock));
    const id = nextId++;
    const rec = { name: null, push: (m) => { if (!sock.destroyed) sock.write(JSON.stringify(m) + '\n'); } };
    clients.set(id, rec);
    sock.setEncoding('utf8');
    let buf = '';
    sock.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        let msg; try { msg = JSON.parse(line); } catch { rec.push({ t: 'error', err: 'malformed JSON' }); continue; }
        try { onMessage(rec.push, rec, msg); } catch (e) { rec.push({ t: 'error', err: String(e.message).slice(0, 120) }); }
      }
    });
    const bye = () => dropClient(id, rec);
    sock.on('close', bye); sock.on('error', bye);
  });

  // ---- transport 2: HTTP + SSE (the visual editor) ---------------------------
  const httpPort = port + 1;
  const web = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${httpPort}`);
    if (req.method === 'GET' && url.pathname === '/') {
      const v2 = path.join(UI_DIR, 'editor.html');
      fs.readFile(fs.existsSync(v2) ? v2 : path.join(__dirname, 'editor.html'), (e, data) => {
        if (e) { res.writeHead(500); return res.end('editor.html missing'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
    } else if (req.method === 'GET' && url.pathname === '/version') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: VERSION, model: callModel ? (process.env.MODEL_MOCK === '1' ? 'mock' : process.env.MODEL_NAME) : null }));
    } else if (req.method === 'GET' && /^\/lib\/(intent|intent2|explain)\.js$/.test(url.pathname)) {
      // the language modules are CommonJS; wrap for the browser (they import nothing).
      const g = { 'intent.js': 'INTENT', 'intent2.js': 'INTENT2', 'explain.js': 'EXPLAIN' }[path.basename(url.pathname)];
      fs.readFile(path.join(UI_DIR, path.basename(url.pathname)), 'utf8', (e, src) => {
        if (e) { res.writeHead(404); return res.end(`// ${path.basename(url.pathname)} not built yet`); }
        res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        res.end(`window.${g} = (() => { const module = { exports: {} }; const exports = module.exports;\n${src}\nreturn module.exports; })();`);
      });
    } else if (req.method === 'GET' && url.pathname === '/events') {
      const name = String(url.searchParams.get('name') ?? '').slice(0, 24);
      if (!name || nameTaken(name)) { res.writeHead(409); return res.end('name empty or taken'); }
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      const id = nextId++;
      const rec = { name: null, push: (m) => { try { res.write(`data: ${JSON.stringify(m)}\n\n`); } catch {} } };
      clients.set(id, rec);
      onMessage(rec.push, rec, { t: 'hello', name });          // welcome arrives over the stream
      req.on('close', () => dropClient(id, rec));
    } else if (req.method === 'POST' && url.pathname === '/msg') {
      let body = '';
      req.on('data', (ch) => { body += ch; if (body.length > 65536) req.destroy(); });
      req.on('end', () => {
        let payload; try { payload = JSON.parse(body); } catch { res.writeHead(400); return res.end('{"t":"error","err":"malformed JSON"}'); }
        const rec = [...clients.values()].find(x => x.name === payload.name);
        res.setHeader('Content-Type', 'application/json');
        if (!rec) { res.writeHead(404); return res.end('{"t":"error","err":"no such client — connect the event stream first"}'); }
        let out = null;
        // v2: propose is async — onMessage may return a promise that resolves AFTER reply() ran.
        Promise.resolve()
          .then(() => onMessage((m) => { out = m; }, rec, payload.msg ?? {}))
          .catch((e) => { out = out ?? { t: 'error', err: String(e.message).slice(0, 120) }; })
          .then(() => { res.writeHead(200); res.end(JSON.stringify(out)); });
      });
    } else { res.writeHead(404); res.end(); }
  });

  let timer = null;
  const portHelp = (which, p) => { // the failure that burned the first live user: a stale old-code server still holding the port.
    console.error(`\n!! port ${p} is already in use (${which}).`);
    console.error(`   Most likely an OLD server window is still open — close it (Ctrl-C) and run this again.`);
    console.error(`   To find it:  netstat -ano | findstr :${p}   then:  taskkill /PID <pid> /F\n`);
    process.exitCode = 1; try { server.close(); web.close(); } catch {}
  };
  server.on('error', (e) => e.code === 'EADDRINUSE' ? portHelp('TCP', port) : console.error(e));
  web.on('error', (e) => e.code === 'EADDRINUSE' ? portHelp('HTTP', httpPort) : console.error(e));
  server.listen(port, '127.0.0.1', () => {
    web.listen(httpPort, '127.0.0.1', () => {
      say(`M1 server ${VERSION} — TCP 127.0.0.1:${port} (terminal) | VISUAL EDITOR http://127.0.0.1:${httpPort}/ | AI: ${callModel ? (process.env.MODEL_MOCK === '1' ? 'mock' : process.env.MODEL_NAME) : 'not configured'} | tick ${manual ? 'MANUAL' : tickMs + 'ms'}, WORLD=${world.toUpperCase()} (${engine.w.schema.TYPE_NAME.join('/')})`);
      say(`  (use the 127.0.0.1 address exactly — on Windows, 'localhost' can resolve to IPv6 and miss the server)`);
      if (!manual) timer = setInterval(doTick, tickMs);
    });
  });

  const stop = () => new Promise((res) => {
    if (timer) clearInterval(timer);
    for (const rec of clients.values()) { try { rec.push({ t: 'event', msg: 'server closing' }); } catch {} }
    clients.clear();
    for (const s of tcpSocks) s.destroy();
    web.close(() => server.close(() => res(sessionRecord())));
    // destroy lingering http/sse connections so close() resolves promptly
    web.closeAllConnections?.();
  });
  return { server, web, engine, zone, doTick, stop, sessionRecord, port, httpPort };
}

module.exports = { startServer, sanitizeOps };

if (require.main === module) {
  // node m1_server.js [port] [tickMs] [world]   world = farm | pong | shooter (RD-033)
  const port = Number(process.argv[2] ?? 4242), tickMs = Number(process.argv[3] ?? 250);
  const world = process.argv[4] ?? process.env.WORLD ?? 'farm';
  const h = startServer({ port, tickMs, world });
  process.on('SIGINT', async () => {
    const rec = await h.stop();
    console.log('\n=== SESSION RECORD (incl. rule-effect accounting, BAR M6 amendment) ===');
    console.log(JSON.stringify(rec, null, 2));
    process.exit(0);
  });
}
