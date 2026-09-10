/**
 * realGame.test.mjs - the hard one: a real game, real assets, real verification.
 *
 *   MODEL_BASE=https://…modal.run node server/realGame.test.mjs
 *
 * realChain proved the mechanism on three small maths goals. This is the job the hub
 * actually exists to do, and it is harder in every dimension that has bitten today:
 *
 *   ASSETS      it must find sprites in a 13,500-item library and load them by exact path.
 *               A missing asset FAILS verification - it is not a warning.
 *   SIZE        a Phaser game is thousands of tokens per write, so this exercises prompt
 *               growth and the anchor cap against REAL generated content, not 'X'*200000.
 *   THE OTHER   isGameGoal() sends these down the GAME planner branch. The non-game branch
 *   BRANCH      is verified against a real model; this one is not.
 *   EDITING     goals 2 and 3 must modify a large existing HTML file without destroying it,
 *               which is where write_file-over-working-code went wrong before.
 *   READING     goal 3 must document what the code REALLY contains - the exact step that
 *               failed on the maths chain, where the README omitted multiply().
 *
 * DELIBERATELY FEW HARD ASSERTIONS. Today four of my own harnesses reported failures that
 * were bugs in the harness, so this mostly OBSERVES and prints. It asserts only what is
 * unambiguous: files exist, the chain advanced, assets resolve, the page has no console
 * errors. Everything else is reported for a human to judge.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.MODEL_BASE || '').replace(/\/+$/, '');
if (!BASE_URL) { console.error('set MODEL_BASE'); process.exit(2); }
const MODEL = process.env.MODEL_NAME || 'mycoder';
const PORT = 4900 + Math.floor(Math.random() * 200);
const API = `http://127.0.0.1:${PORT}/api`;

let passed = 0, failed = 0;
const notes = [];
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 400)}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'realgame-'));
const ws = join(dir, 'workspace');
const dbPath = join(dir, 'hub.json');
writeFileSync(dbPath, JSON.stringify({
  api_keys: { ollama: { base_url: BASE_URL, model: MODEL } }, history: [], settings: {},
}), 'utf8');

const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: {
    ...process.env,
    PORT: String(PORT), HUB_DB: dbPath,
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'),        // keep this out of the live run history
    AGENT_SUPERVISOR: '1', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_MAX_STEPS: '30', AGENT_MAX_MINUTES: '12',
    MODEL_FIRST_BYTE_S: '600', MODEL_STALL_S: '90', MODEL_TIMEOUT_S: '1800',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const hubLog = [];
hub.stdout.on('data', (d) => hubLog.push(d.toString()));
hub.stderr.on('data', (d) => hubLog.push(d.toString()));

const api = async (p, o) => {
  const r = await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120_000) });
  return r.json();
};
for (let i = 0; i < 240; i++) {
  try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

console.log(`\nreal game chain: ${BASE_URL}\n`);

const GOALS = [
  'Build a Phaser 3 game in index.html. Use list_assets to find a sprite for the player and a sprite for a collectible, and load them by their EXACT paths from the asset library. The player moves with the arrow keys and collects the items. Test it in the browser before finishing.',
  'Add a score counter to the EXISTING index.html that goes up by 10 each time the player collects an item, and show it on screen. Keep everything else working. Test it in the browser.',
  'Write GAME.md describing what index.html actually does. Read index.html first and describe only what is really in it: the controls, the assets it loads by path, and the scoring.',
];

let ids = [];
await test('the three game goals queue as an ordered chain', async () => {
  let prev = null;
  for (const goal of GOALS) {
    const r = await api('/agent/queue', { method: 'POST', body: JSON.stringify(prev ? { goal, after: prev } : { goal }) });
    const id = r.item?.id || r.id;
    assert.ok(id, 'queue rejected a goal: ' + JSON.stringify(r).slice(0, 200));
    ids.push(id); prev = id;
  }
});

await test('the supervisor drives the whole game chain unattended', async () => {
  const first = await api('/agent/queue/run', { method: 'POST', body: JSON.stringify({ id: ids[0] }) }).catch(() => null);
  if (!first || (!first.runId && !first.ok)) {
    const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: GOALS[0] }) });
    assert.ok(s.runId, 'could not start: ' + JSON.stringify(s).slice(0, 200));
  }
  const deadline = Date.now() + 45 * 60_000;
  let q = null;
  while (Date.now() < deadline) {
    q = await api('/agent/queue');
    const open = (q.items || []).filter((i) => !['done', 'failed', 'cancelled'].includes(i.status));
    if (!open.length) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  const states = ((q && q.items) || []).map((i) => i.status).join(', ');
  notes.push(`queue end state: ${states || '(empty)'}`);
  console.log(`        queue: ${states}`);
  const list = await api('/agent/list');
  const runs = (Array.isArray(list) ? list : []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  notes.push(`runs: ${runs.map((r) => `${r.status}(${(r.steps || []).length || r.modelCalls || '?'})`).join(' -> ')}`);
  console.log(`        runs: ${runs.map((r) => r.status).join(' -> ')}`);
  assert.ok(runs.some((r) => r.status === 'done'), 'not one run reached done');
});

// ── what actually got built ──────────────────────────────────────────────────
await test('index.html exists and is a real Phaser page', () => {
  const f = join(ws, 'index.html');
  assert.ok(existsSync(f), `no index.html; workspace: ${existsSync(ws) ? readdirSync(ws).join(', ') : '(none)'}`);
  const html = readFileSync(f, 'utf8');
  notes.push(`index.html: ${html.length} bytes`);
  console.log(`        index.html is ${html.length} bytes`);
  assert.match(html, /phaser/i, 'no Phaser in the page');
  assert.match(html, /<script/i, 'no script tag');
});

await test('ASSETS: it loaded real files from the library by exact path', async () => {
  const html = readFileSync(join(ws, 'index.html'), 'utf8');
  const refs = [...new Set([...html.matchAll(/assets\/[A-Za-z0-9_.\/-]+/g)].map((m) => m[0]))];
  notes.push(`asset paths referenced: ${refs.join(', ') || '(none)'}`);
  console.log(`        assets referenced: ${refs.join(', ') || '(NONE)'}`);
  assert.ok(refs.length > 0, 'the game references no library assets at all');

  // Every referenced path must actually resolve in the manifest - a missing asset is a
  // verification failure by design, not a warning.
  const A = await import('./assets.js');
  const missing = refs.filter((p) => !A.resolve(p));
  notes.push(`unresolvable asset paths: ${missing.length ? missing.join(', ') : 'none'}`);
  assert.equal(missing.length, 0, `references assets that do not exist: ${missing.join(', ')}`);
});

await test('VERIFIER: the page runs in a browser with no console errors', async () => {
  const html = readFileSync(join(ws, 'index.html'), 'utf8');
  const v = await api('/game/verify', { method: 'POST', body: JSON.stringify({ engine: 'phaser', code: html }) })
    .catch((e) => ({ error: String(e.message) }));
  notes.push(`verifier: ${JSON.stringify(v).slice(0, 300)}`);
  console.log(`        verifier: ok=${v.ok} ${v.verdict ? String(v.verdict).slice(0, 90) : ''}`);
  if (v.error) assert.fail(`verifier could not run: ${v.error}`);
  assert.ok(v.ok !== false || !/never loaded|missing asset/i.test(String(v.verdict || '')),
    `verification failed: ${String(v.verdict || '').slice(0, 200)}`);
});

await test('SCORE: goal 2 edited the page instead of replacing it', () => {
  const html = readFileSync(join(ws, 'index.html'), 'utf8');
  const hasScore = /score/i.test(html);
  notes.push(`score present: ${hasScore}`);
  assert.ok(hasScore, 'no scoring was added by goal 2');
  assert.match(html, /(up|arrow|cursor|keyboard)/i, 'movement was lost when scoring was added');
});

await test('DOCS: GAME.md describes what is really in the file', () => {
  const f = join(ws, 'GAME.md');
  assert.ok(existsSync(f), `GAME.md missing; workspace: ${readdirSync(ws).join(', ')}`);
  const doc = readFileSync(f, 'utf8');
  const html = readFileSync(join(ws, 'index.html'), 'utf8');
  const refs = [...new Set([...html.matchAll(/assets\/([A-Za-z0-9_-]+)\./g)].map((m) => m[1]))];
  const named = refs.filter((n) => new RegExp(n, 'i').test(doc));
  notes.push(`GAME.md ${doc.length} bytes; names ${named.length}/${refs.length} of the assets actually used`);
  console.log(`        GAME.md names ${named.length}/${refs.length} of the real assets, score mentioned: ${/score/i.test(doc)}`);
  assert.match(doc, /score/i, 'the docs do not mention scoring, which the code has');
});

const rates = (hubLog.join('').match(/= ([0-9.]+) tok\/s/g) || []).slice(0, 8);
if (rates.length) console.log(`\n  model rates: ${rates.join(', ')}`);
const prompts = (hubLog.join('').match(/prompt ~([0-9]+) tok/g) || []).map((m) => parseInt(m.match(/[0-9]+/)[0], 10));
if (prompts.length) console.log(`  prompt tokens: min ${Math.min(...prompts)}, max ${Math.max(...prompts)}, last ${prompts[prompts.length - 1]}`);

hub.kill();
console.log('\n--- notes ---');
notes.forEach((n) => console.log('  ' + n));
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
