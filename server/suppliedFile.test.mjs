/**
 * suppliedFile.test.mjs - SMALL NAMED FILES ARE SUPPLIED IN THE OPENING CONTEXT.
 *
 *   node server/suppliedFile.test.mjs
 *
 * BENCH-1: 10 of 15 runs asked for an outline of a ~30-line file and never advanced to reading
 * it. The outline step supplied one line and added a transition the model repeatedly failed to
 * make. For a goal-named file within a fixed limit, the complete contents now go into the
 * opening context, labelled with the path and a content hash, and the model is told it may
 * proceed. Larger files are left exactly as before.
 *
 * Proven through the REAL agent route with scripted replies and a recording backend. No GPU.
 *
 *   1. the supplied bytes are CORRECT - every line, and the hash matches the file on disk
 *   2. an oversized file is NOT inlined and NOT silently truncated - the context is unchanged
 *   3. a valid edit followed by a test executes normally on the supplied path
 *   4. repeat guard, isolation and acceptance are untouched (the existing suites still pass)
 *
 * This removes one opportunity to stall. It does not prove the model will stop stalling.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { externalTasks, BENCH_GUIDANCE } = await import('./benchTasks.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash('sha256').update(s).digest('hex');

const pascal = externalTasks().find((t) => t.id === 'ext-pascal');
const PLAN = JSON.parse(readFileSync(join(HERE, '..', 'legasus', 'fixtures', 'bench1', 'pascal-replies.json'), 'utf8'))[0];
const dirs = [];

async function drive({ files, goal, replies, label }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`sf-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  for (const [f, body] of Object.entries(files)) writeFileSync(join(ws, f), body, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const promptLog = join(dir, 'prompts.jsonl');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf],
    { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_WORKER_EXEC: '1', AGENT_BOUND_ROUTES: '1' } });
    hub = started.hub;
    const { api } = started;
    const { runId } = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
    let run = null;
    for (let i = 0; i < 90; i++) {
      run = await api(`/agent/${runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy) break;
      await sleep(1000);
    }
    const reqs = existsSync(promptLog) ? readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    return { run, reqs, ws };
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}
// the first TURN request (not the planner) carries the opening context
const openingContext = (reqs) => (reqs.find((r) => r.messages.some((m) => /^Files currently in the workspace/.test(String(m.content)))) || { messages: [] }).messages;
const suppliedMsg = (msgs) => msgs.find((m) => m.role === 'user' && /^SUPPLIED FILE: /.test(String(m.content)))?.content || null;

try {
  const goal = `${pascal.goal}\n\n${BENCH_GUIDANCE}`;
  const src = pascal.seed['pascal.py'];

  // ── 1. THE SUPPLIED BYTES ARE CORRECT ──
  console.log('=== 1. a small named file is supplied, and the bytes are right ===');
  const a = await drive({ files: pascal.seed, goal, replies: [PLAN, 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok'], label: 'small' });
  const ctx = openingContext(a.reqs);
  const sup = suppliedMsg(ctx);
  say(!!sup, 'the opening context contains a SUPPLIED FILE message');
  say(/^SUPPLIED FILE: pascal\.py /.test(sup || ''), 'labelled with the path');
  say((sup || '').includes(`sha256 ${sha(src).slice(0, 16)}`), `labelled with the content identity (sha256 ${sha(src).slice(0, 16)})`);
  // every line, numbered exactly as read_file numbers them
  const lines = src.split('\n');
  const missing = lines.map((l, i) => `${i + 1}: ${l}`).filter((nl) => !(sup || '').includes(nl));
  say(missing.length === 0, `every one of the ${lines.length} lines is present, numbered (${missing.length} missing)`);
  say(/already been supplied/.test(sup || '') && /outline|read/.test(sup || ''), 'and the model is told it need not outline or read it');
  say(Array.isArray(a.run?.suppliedFiles) && a.run.suppliedFiles.some((f) => f.path === 'pascal.py' && f.sha256 === sha(src)),
    'the run RECORDS what was supplied, with its hash');
  note(`(${lines.length} lines, ${Buffer.byteLength(src)} bytes)`);

  // ── 2. AN OVERSIZED FILE IS NOT INLINED, AND NOT SILENTLY TRUNCATED ──
  console.log('\n=== 2. an oversized named file is left exactly as before ===');
  const big = Array.from({ length: 2000 }, (_, i) => `def f${i}(x):\n    return x + ${i}`).join('\n\n') + '\n';
  const bigGoal = `The file big.py has a bug in f7(). Fix it.\n\n${BENCH_GUIDANCE}`;
  const b = await drive({ files: { 'big.py': big }, goal: bigGoal, replies: [PLAN, 'THOUGHT: Done.\nACTION: finish\nTEXT:\nok'], label: 'big' });
  const bctx = openingContext(b.reqs);
  const bsup = suppliedMsg(bctx);
  say(bsup === null, `no SUPPLIED FILE message for a ${Buffer.byteLength(big)}-byte file`);
  say(!bctx.some((m) => /def f1999/.test(String(m.content))) && !bctx.some((m) => /def f7\(x\)/.test(String(m.content))),
    'and none of its contents were inlined - not the head, not the tail');
  say(!bctx.some((m) => /\(lines 1-\d+ of \d+\)|more line\(s\) below/.test(String(m.content))), 'no partial was presented in the opening context');
  say(!(b.run?.suppliedFiles || []).length, 'the run records nothing supplied');
  note('Larger files keep the prior behaviour: the model reads them itself.');

  // ── 3. A VALID EDIT THEN A TEST EXECUTES ON THE SUPPLIED PATH ──
  console.log('\n=== 3. a valid edit followed by testing executes normally ===');
  // the real QuixBugs fix: `for c in range(0, r)` should be `range(0, r + 1)`
  const buggyLine = src.split('\n').find((l) => /for c in range\(0, r\)/.test(l));
  say(!!buggyLine, `the seed carries the known buggy line (${(buggyLine || '?').trim()})`);
  const c = await drive({
    files: pascal.seed, goal, label: 'edit',
    replies: [
      PLAN,
      `THOUGHT: The file was supplied. The inner loop stops one short.\nACTION: edit_file\nPATH: pascal.py\nFIND:\n${buggyLine}\nREPLACE:\n${buggyLine.replace('range(0, r)', 'range(0, r + 1)')}`,
      'THOUGHT: Testing.\nACTION: run_python\nCODE:\n```python\nfrom pascal import pascal\nprint(pascal(4))\n```',
      'THOUGHT: Done.\nACTION: finish\nTEXT:\nfixed and tested',
    ],
  });
  const ct = (c.run?.steps || []).filter((s) => s.tool).map((s) => s.tool);
  say(ct.includes('edit_file'), `the edit executed (${ct.join(' -> ')})`);
  say(/range\(0, r \+ 1\)/.test(readFileSync(join(c.ws, 'pascal.py'), 'utf8')), 'and landed in the workspace');
  say(ct.includes('run_python'), 'the test executed after it');
  say(c.run?.status === 'done', `the run finished (${c.run?.status})`);
  say(!(c.run?.steps || []).some((s) => s.tool === 'outline_file' || s.tool === 'read_file'), 'with NO outline or read - the supplied file was enough to act on');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  supplied file: ${passed} passed, ${failed} failed -> ${failed ? 'THE OPENING CONTEXT IS WRONG' : 'small named files are supplied correctly; large ones untouched'}`);
process.exit(failed ? 1 : 0);
