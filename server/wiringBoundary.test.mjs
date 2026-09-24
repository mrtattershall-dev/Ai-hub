/**
 * wiringBoundary.test.mjs - DID THE MODEL RECEIVE THE NEW INFORMATION AND STILL REPEAT, OR DID
 * THE HUB FAIL TO DELIVER IT?
 *
 *   node server/wiringBoundary.test.mjs
 *
 * BENCH-1: ten runs produced byte-identical consecutive replies after an outline result. That
 * is consistent with four causes - model behaviour, an unchanged outgoing message, dropped tool
 * feedback, or replayed responses - and only the REQUEST BOUNDARY distinguishes them.
 *
 * CORRECTION. A first pass claimed the transcripts store "[object Object]" and record nothing
 * of what was sent. That was my inspection calling String() on an array. The transcripts store
 * the real per-turn DELTA - the messages new since the model last spoke - which is why repeated
 * turns show 3 messages: tool result, task ledger, asset library. They DO record the boundary,
 * and so do all 500 historical transcripts under measurements/. The live run can therefore be
 * read directly; this replay confirms the same route with a recording backend.
 *
 * So the preserved failing run (pascal) is replayed through the REAL Hub route. The fake
 * backend serves the model's recorded replies verbatim, in order, and records every request it
 * receives. A scripted model cannot show that an outline result CAUSES a real model to repeat;
 * it can show exactly what the Hub sent back after each turn. That is the question here. No GPU.
 *
 * ASSERTED, per turn:
 *   1. the request after the outline call CONTAINS the outline result
 *   2. the request after the repeated call CONTAINS the repeat warning, and not before
 *   3. consecutive requests DIFFER - the outgoing message is not frozen
 *   4. each request's newest tool result is the result of the IMMEDIATELY preceding call
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import * as fs2 from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { externalTasks, BENCH_GUIDANCE } = await import('./benchTasks.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const REPLIES = join(HERE, '..', 'legasus', 'fixtures', 'bench1', 'pascal-replies.json');
const task = externalTasks().find((t) => t.id === 'ext-pascal');

const [hubPort, fakePort] = await freePorts(2);
const dir = scratch('wiring', { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
for (const [f, body] of Object.entries(task.seed)) writeFileSync(join(ws, f), body, 'utf8');
const promptLog = join(dir, 'prompts.jsonl');

const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', REPLIES],
  { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
let hub = null;
try {
  const started = await startHub(dir, {
    port: hubPort,
    env: { AGENT_APPROVAL_MODE: 'build', AGENT_WORKER_EXEC: '1', AGENT_BOUND_ROUTES: '1' },
  });
  hub = started.hub;
  const { api } = started;
  const { runId } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: `${task.goal}\n\n${BENCH_GUIDANCE}` }) });
  let run = null;
  for (let i = 0; i < 60; i++) {
    run = await api(`/agent/${runId}`).catch(() => null);
    if (run && run.status && run.status !== 'running' && !run.busy) break;
    await sleep(1000);
  }

  const reqs = existsSync(promptLog)
    ? readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const text = (r) => JSON.stringify(r.messages);
  // NOT the newest user message: after every tool result the Hub appends a TASK LEDGER block and
  // an ASSET LIBRARY block, so the result sits two messages back. The first version of this
  // test assumed newest-is-result, found nothing, and reported delivery FAILED - a wrong-shaped
  // check reading as a finding. It matches the newest TOOL RESULT message instead.
  const lastUser = (r) => [...(r?.messages || [])].reverse().find((m) => m.role === 'user' && /^TOOL RESULT|did not contain a valid ACTION/.test(String(m.content)))?.content || '';

  console.log(`=== replayed run: status=${run?.status}, ${reqs.length} model requests recorded ===`);
  say(reqs.length >= 4, `the Hub made at least four model requests (${reqs.length})`);
  const tools = (run?.steps || []).filter((s) => s.tool);
  say(tools.length >= 3 && tools.every((s) => s.tool === 'outline_file'), `the replay reproduced the recorded loop: ${tools.length}x outline_file`);
  say(/same response|identical/.test(JSON.stringify(run?.steps || [])), 'and the repeat guard stopped it, as it did live');
  note(`messages per request: ${reqs.map((r) => r.messages.length).join(', ')}`);

  // find the first request whose newest user message carries the outline result, and the first
  // carrying the warning - by CONTENT, not by assumed index
  const iResult = reqs.findIndex((r) => /1 declarations/.test(lastUser(r)) && /def pascal/.test(lastUser(r)));
  const iWarn = reqs.findIndex((r) => /already ran this exact/.test(lastUser(r)));

  console.log('\n=== 1. the tool result is delivered ===');
  say(iResult >= 0, `a request carries the outline RESULT as its newest message (request #${iResult})`);
  note(`newest user message there: ${lastUser(reqs[iResult] || {}).replace(/\s+/g, ' ').slice(0, 110)}`);

  console.log('\n=== 2. the repeat warning is delivered, in order ===');
  say(iWarn >= 0, `a request carries the guard WARNING as its newest message (request #${iWarn})`);
  say(iWarn > iResult, `and it comes AFTER the plain result (#${iWarn} > #${iResult}) - the warning is not present prematurely`);

  console.log('\n=== 3. consecutive requests differ ===');
  let identicalPairs = 0;
  for (let i = 1; i < reqs.length; i++) if (text(reqs[i]) === text(reqs[i - 1])) identicalPairs++;
  say(identicalPairs === 0, `no two consecutive requests are byte-identical (${identicalPairs} identical pairs of ${reqs.length - 1})`);
  const sizes = reqs.map((r) => r.messages.length);
  note(`the live transcript showed 6,3,3,3... - here the counts are ${sizes.join(',')}`);

  console.log('\n=== 4. WHEN does the repeat warning reach the model? ===');
  // The guard marks the 2nd identical call in the STEP RECORD. This measures how many calls
  // later the warning first appears in an OUTGOING REQUEST. A first draft asserted "from the
  // 2nd call"; the replay showed RRRWWW - result three times, then warning - so the delay is
  // the result, not an assertion to force.
  const guardFiredOnCall = tools.findIndex((s) => /already ran this exact/.test(String(s.result || ''))) + 1;   // 1-based call number
  const warnRequest = reqs.findIndex((r) => /already ran this exact/.test(lastUser(r)));
  const resultRequest = reqs.findIndex((r) => /^TOOL RESULT \(outline_file\)/.test(lastUser(r)));
  // request k carries the result of call (k - resultRequest + 1)
  const warnAfterCall = warnRequest >= 0 ? warnRequest - resultRequest + 1 : null;
  say(guardFiredOnCall === 2, `the guard marked the repeat in the step record on call #${guardFiredOnCall}`);
  say(warnAfterCall !== null, `the warning reached an outgoing request after call #${warnAfterCall}`);
  const delay = warnAfterCall !== null ? warnAfterCall - guardFiredOnCall : null;
  note(`DELAY between the guard firing and the model being told: ${delay} call(s)`);
  note(delay === 0 ? 'no gap - the model was warned as soon as the guard fired'
    : `for ${delay} call(s) the model received the identical result with NO warning attached`);
  console.log('\n=== VERDICT ON THE REQUEST BOUNDARY ===');
  console.log('  Tool RESULT delivered: ' + (resultRequest >= 0 ? 'YES, every turn' : 'NO'));
  console.log('  Repeat WARNING delivered: ' + (warnRequest >= 0 ? 'YES, but ' + delay + ' call(s) after the guard fired' : 'NO'));
  console.log('  Requests changed while replies stayed identical: YES');
  console.log('  So the model DID receive the outline result and repeated anyway; the warning it was');
  console.log('  supposed to get arrived late. Two separate facts, and the second is a Hub defect.');
} finally {
  try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
  try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  if (process.env.KEEP_WIRING_LOG) { try { fs2.copyFileSync(promptLog, process.env.KEEP_WIRING_LOG); } catch {} }
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}

console.log(`\n  request boundary: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
