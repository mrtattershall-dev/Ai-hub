/**
 * visualBaseline.test.mjs - the finish gate judges the page the run worked on, and blocks only on
 * visual problems the run INTRODUCED.
 *
 *   node server/visualBaseline.test.mjs
 *
 * WHY. Harvested games were being refused by the hub's own finish gate for things that were
 * already true before the agent touched them: 57 of 327 tripped on a blank spare canvas, 31 on a
 * collapsed element. An agent editing an EXISTING project would be told to fix what it never broke,
 * and a run that did its job ended in three gate blocks and a forced finish. And the gate only ever
 * looked at /workspace/index.html: a web page anywhere else got no visual check at all, so a run
 * that blanked game/index.html finished clean.
 *
 * What is asserted:
 *   unit  problemKeys / newProblems: a problem already present is not new; a newly blank canvas
 *         is; a count only matters when it grows.
 *   S1    a page that already has a spare blank canvas; the run changes only the background ->
 *         the finish gate does NOT block (before: blocked for the pre-existing blank canvas).
 *   S2    the same page; the run removes the main drawing -> the gate STILL blocks, visually.
 *   S3    the only page is game/index.html; the run blanks its canvas -> the gate blocks it
 *         (before: no root index.html, so no visual check happened at all).
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { freePorts } from './testPort.mjs';
import { problemKeys, newProblems } from './visualCheck.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; console.log(`  ok    ${name}`); }
  catch (e) { failed++; console.error(`  FAIL  ${name}\n        ${String(e.message).slice(0, 500)}`); }
};

console.log('\nvisual baseline - the finish gate blocks only what a run introduced\n');

// ── unit ─────────────────────────────────────────────────────────────────────────────
const facts = (canvases, issues = []) => ({ ok: true, facts: { canvases, issues, painted: 6, textLen: 20 }, errors: [] });
await test('unit: a pre-existing blank canvas is not new; a newly blank one is; counts only matter when they grow', () => {
  const before = problemKeys(facts([{ w: 800, h: 400, blank: false }, { w: 800, h: 400, blank: true }],
    ['1 element(s) with content collapsed to zero width or height - a layout/CSS bug, they render nothing.']));
  const same = problemKeys(facts([{ w: 800, h: 400, blank: false }, { w: 800, h: 400, blank: true }],
    ['1 element(s) with content collapsed to zero width or height - a layout/CSS bug, they render nothing.']));
  assert.deepEqual(newProblems(before, same), [], 'identical problems must not count as new');
  const mainBlank = problemKeys(facts([{ w: 800, h: 400, blank: true }, { w: 800, h: 400, blank: true }],
    ['1 element(s) with content collapsed to zero width or height - a layout/CSS bug, they render nothing.']));
  assert.equal(newProblems(before, mainBlank).length, 1, 'blanking the main canvas is new');
  const moreCollapsed = problemKeys(facts([{ w: 800, h: 400, blank: false }, { w: 800, h: 400, blank: true }],
    ['2 element(s) with content collapsed to zero width or height - a layout/CSS bug, they render nothing.']));
  assert.equal(newProblems(before, moreCollapsed).length, 1, 'a collapsed count that grows is new');
  assert.deepEqual(newProblems(moreCollapsed, before), [], 'a count that shrinks is not new');
  assert.deepEqual(newProblems(undefined, before).length > 0, true, 'with no baseline everything is new');
});

// ── the loop ─────────────────────────────────────────────────────────────────────────
const F = '```';
const reply = (thought, action) => `THOUGHT: ${thought}\nACTION: ${action}`;
const finish = (n) => reply(`the change is done and tested (${n})`, 'finish');

// Canvas #a is drawn by the page; canvas #b is never drawn - the pre-existing "problem".
const PAGE = '<!doctype html><html><body><h1>Game</h1>'
  + '<canvas id="a" width="200" height="100"></canvas><canvas id="b" width="120" height="60"></canvas>'
  + '<script>\nconst ctx = document.getElementById("a").getContext("2d");\nctx.fillStyle = "red";\nctx.fillRect(10, 10, 120, 60);\n</script>'
  + '</body></html>\n';
const ONE_CANVAS = '<!doctype html><html><body><h1>Game</h1><canvas id="a" width="200" height="100"></canvas>'
  + '<script>\nconst ctx = document.getElementById("a").getContext("2d");\nctx.fillStyle = "red";\nctx.fillRect(10, 10, 120, 60);\n</script>'
  + '</body></html>\n';

async function scenario(name, files, script) {
  const [mockPort, hubPort] = await freePorts(2);
  const queue = [...script];
  let k = 0;
  const mock = createServer((req, res) => {
    if (!/\/api\/chat/.test(req.url)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'vb', lora: null, models: [] }));
    }
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let messages = [];
      try { messages = JSON.parse(body).messages || []; } catch { /* a turn */ }
      const text = messages.length === 2 ? 'Plan: make the change, test it in the browser, finish.'
        : (queue.length ? queue.shift() : finish(++k));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ model: 'vb', message: { role: 'assistant', content: text }, done: true }));
    });
  });
  await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
  const dir = mkdtempSync(join(tmpdir(), 'vbase-' + name + '-'));
  const ws = join(dir, 'workspace');
  for (const [p, c] of Object.entries(files)) { mkdirSync(dirname(join(ws, p)), { recursive: true }); writeFileSync(join(ws, p), c); }
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({
    api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'vb' } }, history: [], settings: {},
  }), 'utf8');
  const hub = spawn(process.execPath, [join(HERE, 'index.js')], {
    env: {
      ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'),
      AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
      AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
      AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
      AGENT_MAX_STEPS: '16', AGENT_MAX_MINUTES: '5',
      MODEL_FIRST_BYTE_S: '30', MODEL_STALL_S: '30', MODEL_TIMEOUT_S: '60',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  hub.stdout.on('data', (d) => log.push(d.toString()));
  hub.stderr.on('data', (d) => log.push(d.toString()));
  const API = `http://127.0.0.1:${hubPort}/api`;
  const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(120000) })).json();
  try {
    for (let i = 0; i < 240; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await sleep(250); } }
    const s = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Change the game page as asked, test it, then finish.' }) });
    assert.ok(s.runId, 'start failed: ' + JSON.stringify(s).slice(0, 200));
    let run = null;
    const deadline = Date.now() + 4 * 60000;
    while (Date.now() < deadline) {
      run = await api('/agent/' + s.runId).catch(() => null);
      if (run?.status === 'awaiting_approval' && run.pending) { await api(`/agent/${s.runId}/approve`, { method: 'POST', body: JSON.stringify({ approve: true }) }); continue; }
      if (run && ['done', 'error', 'stopped', 'interrupted', 'failed'].includes(run.status) && run.busy !== true) break;
      await sleep(300);
    }
    return { run, log: log.join('') };
  } finally {
    hub.kill(); mock.close();
  }
}
const VISUAL_BLOCK = 'The page renders, but something is wrong with what is on screen.';
const visualBlocks = (run) => (run?.steps || []).filter((x) => x.type === 'error' && String(x.text || '') === VISUAL_BLOCK).length;
const notes = (run) => (run?.steps || []).filter((x) => x.type === 'note').map((x) => String(x.text || '')).join(' | ');

await test('S1: a blank spare canvas that was already there does NOT block a run that changed only the background', async () => {
  const { run } = await scenario('s1', { 'index.html': PAGE }, [
    reply('only the background changes', `append_file\nPATH: index.html\n${F}html\n<style>body { background: #001133; }</style>\n${F}`),
    reply('check it in a browser', 'test_web\nPATH: index.html'),
  ]);
  assert.equal(visualBlocks(run), 0, `visual gate blocked ${visualBlocks(run)}x for a problem the page already had | notes: ${notes(run).slice(0, 300)}`);
  assert.equal(run?.status, 'done', 'run did not finish: ' + run?.status);
});

await test('S2: removing the main drawing still blocks - a NEW blank canvas is the run\'s doing', async () => {
  const { run } = await scenario('s2', { 'index.html': PAGE }, [
    reply('remove the drawing', `edit_file\nPATH: index.html\nFIND:\n${F}\nctx.fillRect(10, 10, 120, 60);\n${F}\nREPLACE:\n${F}\n// drawing removed\n${F}`),
    reply('check it in a browser', 'test_web\nPATH: index.html'),
  ]);
  assert.ok(visualBlocks(run) >= 1, 'the gate let a newly blank main canvas finish | notes: ' + notes(run).slice(0, 300));
});

await test('S3: a page that is NOT the root index.html gets the visual check - blanking game/index.html blocks', async () => {
  const { run } = await scenario('s3', { 'game/index.html': ONE_CANVAS }, [
    reply('clear the canvas after it draws', `append_file\nPATH: game/index.html\n${F}html\n<script>setTimeout(function () { var c = document.getElementById("a"); c.getContext("2d").clearRect(0, 0, c.width, c.height); }, 0);</script>\n${F}`),
    reply('check it in a browser', 'test_web\nPATH: game/index.html'),
  ]);
  assert.ok(visualBlocks(run) >= 1, 'a blanked game/index.html finished without a visual block | notes: ' + notes(run).slice(0, 300));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
