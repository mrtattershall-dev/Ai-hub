/**
 * governedLoop.test.mjs - governance AND preservation, composing in ONE live path.
 *
 *   node server/governedLoop.test.mjs
 *
 * governed-dispatch.test.mjs proves the boundary through `tools[name](args)`. It cannot reach the
 * PRESERVATION check, which lives in the tool loop after a tool returns. This drives the real loop -
 * a real hub, a scripted mock model, AGENT_GOVERNED_WRITES=1, and an owner-supplied writeScope on
 * /agent/start - so both mechanisms are live at once and each can be seen refusing its own kind of
 * violation:
 *
 *     GOVERNANCE    may this run write this PATH          refuses t.py, which is out of scope
 *     PRESERVATION  is this CONTENT acceptable            refuses dropping beta, and restores it
 *                                                         refuses duplicating alpha
 *
 * That is the distinction between permission and action-acceptability, operational rather than
 * argued: a write can be fully authorized and still be refused, by a different mechanism, in the
 * same path, on the same call.
 *
 * THE CONTROL MATTERS AS MUCH AS THE CASES. Scenario 2 runs the identical script with t.py IN scope.
 * If t.py lands there and not in scenario 1, the scenario-1 refusal was scope. Without it, a hub that
 * had simply stopped writing would pass every refusal assertion.
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
const fence = (body) => ['```python', body, '```'].join(NL);
const act = (tool, path, body, extra) => {
  const h = ['ACTION: ' + tool, 'PATH: ' + path];
  if (extra) h.push(extra);
  return h.concat([fence(body)]).join(NL);
};

const TWO = ['def alpha():', '    return 1', '', 'def beta():', '    return 2', ''].join(NL);
const ONE = ['def alpha():', '    return 1', ''].join(NL);
const DUP = ['def alpha():', '    return 99', ''].join(NL);

// The script, in order. The mock cannot react; this is a fixed sequence by design.
const SCRIPT = [
  ['1. Build s.py', '2. FILES: s.py', '3. BUILD ORDER: 1) write it', '4. HOW TO VERIFY: python s.py'].join(NL),
  act('write_file', 's.py', TWO),                 // in scope, new file        -> should LAND
  act('write_file', 's.py', ONE),                 // in scope, DROPS beta      -> preservation refuses
  act('append_file', 's.py', DUP),                // in scope, DUPLICATES alpha -> duplicate refuses
  act('write_file', 't.py', ONE),                 // OUT of scope              -> governance refuses
  ['ACTION: finish', 'SUMMARY: done'].join(NL),
];

async function scenario(label, writeScope) {
  const mockPort = await freePort(), hubPort = await freePort();
  let served = 0;
  const mock = createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'script', lora: null }));
    }
    let b = ''; req.on('data', (d) => { b += d; });
    req.on('end', () => {
      const text = served < SCRIPT.length ? SCRIPT[served] : SCRIPT[SCRIPT.length - 1];
      served++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'script', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));

  const dir = mkdtempSync(join(tmpdir(), 'govloop-'));
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({
    api_keys: { ollama: { base_url: 'http://127.0.0.1:' + mockPort, model: 'script' } }, history: [], settings: {},
  }), 'utf8');

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
  const log = [];
  hub.stdout.on('data', (d) => log.push(d.toString()));
  hub.stderr.on('data', (d) => log.push(d.toString()));

  const API = 'http://127.0.0.1:' + hubPort + '/api';
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();
  for (let i = 0; i < 240; i++) {
    try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  let run = null;
  try {
    const s = await api('/agent/start', {
      method: 'POST',
      body: JSON.stringify({ goal: 'Create s.py with alpha and beta.', writeScope }),
    });
    if (!s.runId) throw new Error('start failed: ' + JSON.stringify(s).slice(0, 200));
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      run = await api('/agent/' + s.runId).catch(() => null);
      if (run && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) && !run.busy) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  } finally {
    hub.kill(); mock.close();
  }

  const body = (p) => { const f = join(ws, p); return existsSync(f) ? readFileSync(f, 'utf8') : null; };
  const res = {
    label, run, served,
    s: body('s.py'), t: body('t.py'),
    notes: (run && run.steps || []).filter((x) => x.type === 'note').map((x) => String(x.text || '')),
    hubLog: log.join(''),
  };
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* windows */ }
  return res;
}

const count = (s, re) => (String(s || '').match(re) || []).length;

console.log('governed loop — permission and preservation, both live, one path');

// ── SCENARIO 1: s.py in scope, t.py NOT. ─────────────────────────────────────────────────────────
const a = await scenario('scope=[s.py]', ['s.py']);
ok(a.run !== null, 'scenario 1: the run reached a terminal state (status ' + (a.run && a.run.status) + ')');
ok(a.served > 1, 'scenario 1: the mock was actually driven (' + a.served + ' replies served)');
ok(a.s !== null, 'scenario 1: s.py was created - an AUTHORIZED write landed');
ok(count(a.s, /def alpha\(/g) === 1, 'scenario 1: alpha appears ONCE - the duplicate append was refused');
ok(count(a.s, /def beta\(/g) === 1, 'scenario 1: beta SURVIVED - the write that dropped it was refused and restored');
ok(a.t === null, 'scenario 1: t.py was NOT created - governance refused an out-of-scope path');
ok((a.run && a.run.destructiveRefused || 0) >= 1, 'scenario 1: the run records a preservation refusal (destructiveRefused '
  + (a.run && a.run.destructiveRefused || 0) + ')');
ok((a.run && a.run.duplicateRefused || 0) >= 1, 'scenario 1: the run records a duplicate refusal (duplicateRefused '
  + (a.run && a.run.duplicateRefused || 0) + ')');
ok(a.notes.some((n) => /refused: it would have removed/.test(n)), 'scenario 1: a preservation note names the removal');
ok(a.notes.some((n) => /refused: it would have duplicated/.test(n)), 'scenario 1: a preservation note names the duplication');

// ── SCENARIO 2: THE CONTROL. t.py in scope too, identical script. ────────────────────────────────
const b = await scenario('scope=[s.py,t.py]', ['s.py', 't.py']);
ok(b.t !== null, 'scenario 2 CONTROL: with t.py in scope it IS created, so scenario 1 refused on SCOPE and not on breakage');
ok(b.s !== null && count(b.s, /def beta\(/g) === 1,
  'scenario 2: preservation still protected beta even with a wider scope - widening permission does not widen acceptability');

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
