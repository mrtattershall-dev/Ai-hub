/**
 * resumeAfterRestart.test.mjs - a run that is resumed after the hub restarts keeps working.
 *
 *   node server/resumeAfterRestart.test.mjs
 *
 * Audited 2026-09-11. run.callLog was a Map. persist() writes it with the run, JSON.stringify(new Map()) is `{}`,
 * loadRuns() reads that back verbatim, and `run.callLog || new Map()` did not repair it because `{}` is truthy. So
 * the FIRST tool call of any resumed run threw "run.callLog.get is not a function". The throw was uncaught inside
 * drive(), so the finally block ran with the status still 'running' - and every terminal-status gate failed closed:
 * no syntax rollback, no trace row, no run-index line, no escalation, no repair goal queued. The queue item was
 * released and the goal looked as though it had never been attempted.
 *
 * That is the shape that loses an unattended overnight run: a laptop sleeps, the hub restarts, the supervisor
 * resumes - and the run dies on its first action while destroying the evidence of why.
 *
 *   - a resumed run takes its next action instead of throwing;
 *   - it reaches a terminal status, and is written to the run index;
 *   - the repeated-identical-call notice still works across the restart (which is what callLog is FOR).
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freePorts } from './testPort.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TERMINAL = ['done', 'error', 'stopped', 'interrupted', 'failed', 'awaiting_approval'];
const FENCE = '`'.repeat(3);
const list = (t) => `THOUGHT: ${t}\nACTION: list_dir\nPATH: .`;
// The repeat NOTICE fires on an identical ANSWER, not merely an identical call - so the call repeated across the
// restart has to be one whose answer cannot drift. Reading an unchanged file qualifies; list_dir does not, because
// anything written in between changes the listing.
const readFile = (p, t) => `THOUGHT: ${t}\nACTION: read_file\nPATH: ${p}`;
const write = (p, body) => `THOUGHT: writing ${p}.\nACTION: write_file\nPATH: ${p}\n${FENCE}\n${body}\n${FENCE}`;
const FINISH = 'THOUGHT: done.\nACTION: finish\nSUMMARY: ok';
let passed = 0, failed = 0;
const test = async (n, f) => { try { await f(); passed++; console.log(`  ok    ${n}`); } catch (e) { failed++; console.error(`  FAIL  ${n}\n        ${e.message}`); } };
console.log('\na resumed run keeps working\n');

const [mockPort, hubPort] = await freePorts(2);
// The mock stalls once, on cue, so the hub can be killed while the run is genuinely mid-flight - which is what
// makes loadRuns() mark it 'interrupted' and gives us a run to resume.
const rig = { script: [], hold: true, log: [], calls: 0 };
const mock = createServer((req, res) => {
  if (!/\/api\/chat/.test(req.url)) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, engine: 'mock', model: 'resume', lora: null, models: [] })); }
  let body = ''; req.on('data', (d) => { body += d; });
  req.on('end', async () => {
    let m = []; try { m = JSON.parse(body).messages || []; } catch { /* empty */ }
    rig.calls++;
    // Running dry must PARK the run, not finish it. Answering FINISH when the script empties is what kept ending the
    // run before the kill: the hub reached 'done' on its own and there was nothing interrupted left to resume. While
    // `hold` is set, an exhausted script simply never answers, so the run is mid-flight by construction, not by luck.
    const planner = m.length === 2;
    if (!planner && !rig.script.length && rig.hold) { await sleep(120000); return; }
    const text = planner ? 'Plan: look around, write, finish.' : (rig.script.length ? rig.script.shift() : FINISH);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ model: 'resume', message: { role: 'assistant', content: text }, done: true }));
  });
});
await new Promise((r) => mock.listen(mockPort, '127.0.0.1', r));
const dir = mkdtempSync(join(tmpdir(), 'resume-'));
writeFileSync(join(dir, 'hub.json'), JSON.stringify({ api_keys: { ollama: { base_url: `http://127.0.0.1:${mockPort}`, model: 'resume' } }, history: [], settings: {} }), 'utf8');
const ENV = { ...process.env, PORT: String(hubPort), HUB_DB: join(dir, 'hub.json'), AGENT_WORKSPACE: join(dir, 'workspace'), AGENT_QUEUE_FILE: join(dir, 'queue.json'),
  AGENT_RUNS_DIR: join(dir, 'runs'), AGENT_TRACES_DIR: join(dir, 'traces'), RUN_INDEX: join(dir, 'index.jsonl'),
  AGENT_SUPERVISOR: '0', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '', AGENT_BATCH_ACTIONS: '0',
  AGENT_MAX_STEPS: '14', AGENT_MAX_MINUTES: '6', MODEL_FIRST_BYTE_S: '90', MODEL_STALL_S: '90', MODEL_TIMEOUT_S: '120' };
const API = `http://127.0.0.1:${hubPort}/api`;
const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60000) })).json();
async function boot() {
  const h = spawn(process.execPath, [join(HERE, 'index.js')], { env: ENV, stdio: ['ignore', 'pipe', 'pipe'] });
  h.stdout.on('data', (d) => rig.log.push(String(d))); h.stderr.on('data', (d) => rig.log.push(String(d)));
  for (let i = 0; i < 240; i++) { try { await fetch(API + '/auth/hint'); return h; } catch { await sleep(250); } }
  console.error('  FAIL  the hub did not start\n' + rig.log.join('').slice(-600)); h.kill(); mock.close(); process.exit(1);
}

// ── first life: one tool call lands, then the model stalls and the hub is killed mid-run ──
let hub = await boot();
// No FINISH here on purpose: the run must still be mid-flight when the hub is killed, or there is nothing
// interrupted to resume. Scripting a FINISH let the run reach 'done' before the kill and the test then measured
// nothing at all.
rig.script = [list('looking around'), write('a.js', 'const a = 1;'), readFile('a.js', 'checking what I wrote')];
const st = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Create a.js.' }) });
assert.ok(st.runId, 'start failed: ' + JSON.stringify(st).slice(0, 160));
let toolsSeen = 0, readsSeen = 0;
for (let i = 0; i < 240 && readsSeen < 1; i++) {
  const r = await api('/agent/' + st.runId).catch(() => null);
  const tools = (r?.steps || []).filter((s) => s.type === 'tool');
  toolsSeen = tools.length; readsSeen = tools.filter((s) => s.tool === 'read_file').length;
  if (readsSeen < 1) await sleep(250);
}
await test('the premise: the call to be repeated landed before the hub went down', () => assert.ok(readsSeen >= 1, `read_file did not run before the kill (${toolsSeen} tool steps)`));
await sleep(1500);                    // the script is empty and `hold` is set, so the run is parked, not finished
hub.kill('SIGKILL');
await sleep(800);
// Scripted AFTER the kill, not before: the stalled call is still holding the request when the hub dies, and it had
// already taken the next reply off the list - so scripting earlier fed the resumed run the second reply instead of
// the first, and the repeat could never happen. list_dir . repeats the call made before the restart (same tool, same
// args, so it must be recognised) with different THOUGHT text, so the reply-based stuck-loop guard stays out of it.
rig.hold = false;   // the resumed run is allowed to finish normally
rig.script = [readFile('a.js', 'checking a.js again after the restart'), write('b.js', 'const b = 2;'), FINISH];

// ── second life: the hub comes back and the run is resumed ──
hub = await boot();
const after = await api('/agent/' + st.runId).catch(() => null);
await test('the interrupted run survives the restart and can be offered Resume', () => {
  assert.ok(after && after.id === st.runId, 'the run was not loaded from disk');
  assert.equal(after.status, 'interrupted', 'status after restart: ' + after?.status);
});
await api('/agent/' + st.runId + '/resume', { method: 'POST', body: '{}' }).catch(() => null);
let run = null;
for (let i = 0; i < 400; i++) {
  run = await api('/agent/' + st.runId).catch(() => null);
  if (run && TERMINAL.includes(run.status) && run.busy !== true && run.status !== 'interrupted') break;
  await sleep(300);
}
const steps = (run?.steps || []);
const errText = steps.filter((s) => s.type === 'error' || s.type === 'note').map((s) => String(s.text || '')).join('\n');
console.log(`  (tools: ${steps.filter((s) => s.type === 'tool').map((s) => s.tool).join(' -> ') || 'none'} | status ${run?.status} | model calls ${rig.calls})`);
console.log(`  (notes/errors: ${errText.replace(/\n/g, ' / ').slice(0, 220) || 'none'})`);

await test('the premise: the resumed run actually took an action', () => {
  // Without this the whole test can pass by doing nothing at all, which is how the first version of it passed
  // against the very bug it was written to catch.
  const afterRestart = steps.filter((s) => s.type === 'tool').length - toolsSeen;
  assert.ok(afterRestart >= 1, `the resumed run made no tool call (${toolsSeen} before, ${steps.filter((s) => s.type === 'tool').length} total)`);
});

await test('the resumed run does not die on its first tool call', () => {
  assert.doesNotMatch(errText, /callLog/, 'the resume threw: ' + errText.slice(0, 300));
  assert.doesNotMatch(errText, /The run loop stopped unexpectedly/, errText.slice(0, 300));
});
await test('it reaches a terminal status instead of being left running', () => {
  assert.ok(run && TERMINAL.includes(run.status) && run.status !== 'interrupted', 'status: ' + run?.status);
});
await test('and it is recorded, so the failure could never be invisible', () => {
  const idx = join(dir, 'index.jsonl');
  assert.ok(existsSync(idx), 'no run index was written at all');
  assert.match(readFileSync(idx, 'utf8'), new RegExp(st.runId), 'the resumed run left no index line');
});
await test('the repeated-identical-call notice still works across the restart', () => {
  // read_file a.js ran once before the restart and once after, with a.js untouched in between - so the answers are
  // byte-identical and the second MUST be recognised as a repeat. That is only possible if callLog came back from
  // disk with its contents, which is the whole point of it not being a Map.
  const reads = steps.filter((s) => s.type === 'tool' && s.tool === 'read_file');
  assert.ok(reads.length >= 2, 'read_file ran ' + reads.length + ' time(s); expected one either side of the restart');
  assert.match(String(reads[reads.length - 1].result || ''), /You already ran this exact read_file/, String(reads[reads.length - 1].result || '').slice(-250));
});

hub.kill(); mock.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
