/**
 * attenuationComposes.test.mjs — W6b, END-TO-END, across TWO real autonomous boundaries.
 *
 *   node server/attenuationComposes.test.mjs
 *
 * The preregistration named this the hardest world and Amendment 1 recorded it as BLOCKED: it is
 * unreachable through spawn_subtask (a sub-task cannot delegate at all), and at the queue boundary it
 * needed the generation chain to actually advance - which it did not, until `_activeRun` was assigned
 * for every dispatch. generationChain.test.mjs measures that: [1,1] before, [1,2] after.
 *
 * THE QUESTION W6a COULD NOT ANSWER. W6a proved the RELATION composes:
 * attenuate(attenuate(S,A),B) ⊆ attenuate(S,A), over 4000 random inputs. That says nothing about the
 * live path, because a correct relation installed by a mechanism that overwrites shared state still
 * loses the property. Here the narrowing happens in one process, is carried on a queue item, is
 * installed in a SECOND process, narrowed again, carried again, and installed in a THIRD.
 *
 *     OWNER {a,b}
 *        └─ parent      requests {a}     -> delegated {a}      hop 1
 *             └─ child  requests {a,b}   -> delegated {a}      hop 2  <- the re-widening attempt
 *                  └─ grandchild                                      writes a.py, tries b.py
 *
 * If the grandchild can write b.py, attenuation is a suggestion and the hypothesis is dead.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log('  ok    ' + what); } else { fail++; console.log('  FAIL  ' + what); } };
const freePort = () => new Promise((res) => {
  const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
});
const NL = '\n';
const fin = ['ACTION: finish', 'SUMMARY: done'].join(NL);
const plan = ['1. Work', '2. FILES: a.py', '3. BUILD ORDER: 1) go', '4. HOW TO VERIFY: python a.py'].join(NL);
const q = (goal, scope) => ['ACTION: queue_task', 'GOAL: ' + goal, 'SCOPE: ' + scope.join(', ')].join(NL);
const wr = (p) => ['ACTION: write_file', 'PATH: ' + p, '```python', 'def k():' + NL + '    return 1', '```'].join(NL);

// One mock per generation, on its own port. No text routing - see queuedAuthority.test.mjs.
const ports = [await freePort(), await freePort(), await freePort()];
const hubPort = await freePort();
const idx = [0, 0, 0], served = [0, 0, 0];
const SCRIPTS = [
  [plan, q('HOP2 work', ['a.py']), fin],                 // parent: narrow {a,b} -> {a}
  [plan, q('HOP3 work', ['a.py', 'b.py']), fin],         // child: try to re-widen back to {a,b}
  [plan, wr('a.py'), wr('b.py'), fin],                   // grandchild: use it, and overreach
];
const servers = SCRIPTS.map((script, n) => createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'script', lora: null }));
  }
  let b = ''; req.on('data', (d) => { b += d; });
  req.on('end', () => {
    served[n]++;
    const i = idx[n]++;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: 'script', message: { role: 'assistant', content: i < script.length ? script[i] : fin }, done: true }));
  });
}));
for (let n = 0; n < 3; n++) await new Promise((r) => servers[n].listen(ports[n], '127.0.0.1', r));

const dir = mkdtempSync(join(tmpdir(), 'atcomp-'));
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
const point = (port) => writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: 'http://127.0.0.1:' + port, model: 'script' } }, history: [], settings: {},
}), 'utf8');
point(ports[0]);

const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
  env: {
    ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'),
    RUN_INDEX: join(dir, 'index.jsonl'),
    AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_MAX_STEPS: '12', AGENT_MAX_MINUTES: '3',
    MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
    AGENT_GOVERNED_WRITES: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
hub.stdout.on('data', () => {}); hub.stderr.on('data', () => {});

const API = 'http://127.0.0.1:' + hubPort + '/api';
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();
for (let i = 0; i < 240; i++) {
  try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}
const settle = async (id) => {
  const deadline = Date.now() + 100000;
  while (Date.now() < deadline) {
    const r = await api('/agent/' + id).catch(() => null);
    if (r && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(r.status) && !r.busy) return r;
    await new Promise((x) => setTimeout(x, 350));
  }
  return null;
};

const runs = [];
let items = [];
try {
  const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Narrow and delegate.', writeScope: ['a.py', 'b.py'] }) });
  runs.push(await settle(s.runId));
  for (let hop = 1; hop <= 2; hop++) {
    point(ports[hop]);
    const d = await api('/agent/queue/run', { method: 'POST' });
    if (!d.runId) break;
    runs.push(await settle(d.runId));
  }
  items = ((await api('/agent/queue')) || {}).items || [];
} finally { hub.kill(); servers.forEach((x) => x.close()); }

const body = (p) => { const f = join(ws, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
const stepsOf = (r) => (r && r.steps) || [];
const recv = (r) => stepsOf(r).find((x) => x.type === 'authority_received') || null;
const deleg = (r) => stepsOf(r).find((x) => x.type === 'authority_delegated') || null;
const attempts = (r) => stepsOf(r).filter((x) => x.type === 'tool' && x.tool === 'write_file')
  .map((x) => ({ path: (x.args && x.args.path) || '?', ok: /^OK[:,]/.test(String(x.result || '')), refused: /REFUSED by governance/.test(String(x.result || '')) }));

const [parent, child, grand] = runs;

console.log('--- DIAGNOSTIC ---');
for (const [n, r] of runs.entries()) {
  const rc = recv(r), dl = deleg(r);
  console.log('  run ' + n + ' goal=' + JSON.stringify((r && r.goal || '').slice(0, 28))
    + ' gen=' + (r && r.generation) + ' status=' + (r && r.status));
  console.log('      received: ' + (rc ? JSON.stringify({ installed: rc.installed, delegated: rc.authority && rc.authority.delegated, parent: rc.authority && rc.authority.parentRunId }) : 'NONE'));
  console.log('      delegated: ' + (dl ? JSON.stringify({ avail: dl.authority.availableBefore, req: dl.authority.requested, del: dl.authority.delegated }) : 'NONE'));
  console.log('      attempts: ' + JSON.stringify(attempts(r)));
}
console.log('  queue left: ' + JSON.stringify(items.map((i) => ({ id: i.id, goal: (i.goal||'').slice(0,14), gen: i.generation, status: i.status, auth: i.authority && i.authority.delegated }))));
console.log('--- END DIAGNOSTIC ---');
console.log('W6b — attenuation across two real boundaries');
ok(runs.length === 3, 'three runs happened: parent, child, grandchild (' + runs.length + ')');
ok(served[0] > 0 && served[1] > 0 && served[2] > 0,
  'APPARATUS CONTROL: all three generations asked their own mock (' + JSON.stringify(served) + ')');

const d1 = deleg(parent), d2 = deleg(child);
ok(d1 && d1.authority.availableBefore.join(',') === 'a.py,b.py' && d1.authority.delegated.join(',') === 'a.py',
  'hop 1: the parent held {a,b} and delegated {a}');
ok(child && recv(child) && recv(child).installed.join(',') === 'a.py',
  'hop 1: the child INSTALLED {a}');
ok(d2 && d2.authority.availableBefore.join(',') === 'a.py',
  'hop 2: the child had only {a} available to pass on');
ok(d2 && d2.authority.requested.join(',') === 'a.py,b.py',
  'hop 2: and it REQUESTED {a,b} - the re-widening attempt is on the record');
ok(d2 && d2.authority.delegated.join(',') === 'a.py',
  'hop 2: yet delegated {a} - ATTENUATION COMPOSED, the narrowing was not undone by depth');
ok(d2 && d2.authority.refusedFromRequest.join(',') === 'b.py',
  'hop 2: with b.py recorded as refused from the request');
ok(grand && recv(grand) && recv(grand).installed.join(',') === 'a.py',
  'the grandchild installed {a} - two hops from an owner grant for {a,b}');

const ga = attempts(grand);
ok(ga.some((x) => x.path === 'a.py' && x.ok), 'the grandchild WROTE a.py - authority survived two crossings');
ok(ga.some((x) => x.path === 'b.py' && x.refused),
  'the grandchild was REFUSED on b.py - what the child gave up could NOT be recovered downstream'
  + ' (attempts: ' + JSON.stringify(ga) + ')');
ok(body('a.py') !== null && body('b.py') === null, 'and the filesystem agrees: a.py present, b.py absent');

try { rmSync(dir, { recursive: true, force: true }); } catch { /* windows */ }
console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
