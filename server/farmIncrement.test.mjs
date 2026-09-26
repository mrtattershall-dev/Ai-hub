/**
 * farmIncrement.test.mjs - the M2/M3 shape of MILESTONE-1 with the model scripted: a SECOND hub
 * process on the SAME workspace adds a feature (farm-v2: day/night + selling) under a play
 * that protects everything farm-v1 passed; an increment that breaks an earlier feature is
 * restored; the notes, ledger and lessons of the first session are in the second's opening.
 *
 *   node server/farmIncrement.test.mjs
 *
 *   1. session 1 (v1 play): builds the v1 page; ACCEPT; leaves NOTES.md, TASKS.md, LESSONS.jsonl
 *   2. RESTART: session 2 (v2 play, new process, same workspace) opens with the v1 state:
 *      the opening diagnostic says 8/11 (v1 steps pass, v2 steps fail); the controller's
 *      protected set is the 8 v1 steps; the opening context carries the notes and lessons
 *   3. a v2 write that KEEPS v1 working -> 11/11 -> ACCEPT (M3: added without breaking)
 *   4. session 3 (v2 play again): a write that adds v2 but BREAKS saving (a v1 step) ->
 *      PROTECTED_BROKEN -> exact restore of the accepted v2 page
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { gameSnapshot } = await import('./autodiag.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FARM = join(HERE, '..', 'legasus', 'bench', 'farm');
const SPEC1 = JSON.parse(readFileSync(join(FARM, 'play.json'), 'utf8'));
const SPEC2 = JSON.parse(readFileSync(join(FARM, 'play-v2.json'), 'utf8'));
const V1 = readFileSync(join(FARM, 'controls', 'positive', 'index.html'), 'utf8');
const V2 = readFileSync(join(FARM, 'controls', 'positive-v2', 'index.html'), 'utf8');
// v2 features present, but saving removed: a v1 step (7) breaks.
const V2_NOSAVE = V2.replace("function save() { localStorage.setItem('farm-save', JSON.stringify(S)); }", "function save() { /* forgot to save */ }");
const PLAN = '1. WHAT IT DOES - farm\n2. FILES - index.html\n3. BUILD ORDER - write\n4. HOW TO VERIFY - the play runs automatically';
const write = (body) => `THOUGHT: Writing the page.\nACTION: write_file\nPATH: index.html\n\`\`\`html\n${body}\n\`\`\``;
const REMEMBER = 'THOUGHT: Worth keeping.\nACTION: remember\nTEXT: the save key is farm-save; keys p/t/h/s are taken';
const LESSON = 'THOUGHT: A scoped lesson.\nACTION: lesson\nLANGUAGE: javascript\nTOOL: write_file\nMISTAKE: forgot to persist new state fields in save()\nFIX: every new state field must be included in the saved object and restored on load\nDETECT: forgot to save';
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\ndone';

const dir = scratch('farm-inc');
const ws = join(dir, 'workspace');
mkdirSync(ws, { recursive: true });
const dirs = [dir];

async function session(label, spec, replies) {
  const [hubPort, fakePort] = await freePorts(2);
  const cfg = scratch(`farm-inc-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(cfg);
  const rf = join(cfg, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const promptLog = join(cfg, 'prompts.jsonl');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
  let hub = null;
  try {
    const started = await startHub(cfg, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_WORKSPACE: ws } });
    hub = started.hub;
    const { runId } = await started.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: spec === SPEC1 ? 'Build the farm game.' : 'Add a day/night cycle and selling crops for coins. Keep everything that works working.', budgetSec: 240, diagnostic: { kind: 'play', spec, timeoutSec: 60 }, recovery: { maxAttempts: 2, maxRepeats: 2, maxProvisional: 3 } }) });
    let run = null;
    for (let i = 0; i < 240; i++) { run = await started.api(`/agent/${runId}`).catch(() => null); if (run && run.status && run.status !== 'running' && !run.busy && run.finalizedAt) break; await sleep(1000); }
    const reqs = readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    return { run, reqs, file: readFileSync(join(ws, 'index.html'), 'utf8') };
  } finally { try { hub && hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} }
}
const diagMsgs = (reqs) => { const seen = new Set(), out = []; for (const r of reqs) for (const m of r.messages) { const c = String(m.content || ''); if (/^AUTOMATIC DIAGNOSTIC/.test(c) && !seen.has(c)) { seen.add(c); out.push(c); } } return out; };
const rsteps = (run) => (run.steps || []).filter((s) => s.type === 'recovery');

try {
  console.log('=== 1. session 1 builds v1 and leaves memory behind ===');
  const s1 = await session('s1', SPEC1, [PLAN, write(V1), REMEMBER, LESSON, FINISH]);
  say(s1.run.recovery?.state === 'ACCEPTED' && s1.file === V1, 'v1 built and ACCEPTED');
  say(existsSync(join(ws, 'NOTES.md')) && existsSync(join(ws, 'LESSONS.jsonl')) && existsSync(join(ws, 'TASKS.md')), 'NOTES.md, LESSONS.jsonl and TASKS.md exist in the workspace');

  console.log('\n=== 2. RESTART: session 2 on the same workspace, the v2 play ===');
  const s2 = await session('s2', SPEC2, [PLAN, write(V2), FINISH]);
  const dm2 = diagMsgs(s2.reqs);
  say(/RESULT: 11 cases attempted, 8 passed, 3 failed/.test(dm2[0] || '') && /FAIL case 9 /.test(dm2[0]) && /FAIL case 10 /.test(dm2[0]) && /FAIL case 11 /.test(dm2[0]), 'the opening diagnostic under v2: 8/11 - the v1 steps pass, the three new ones fail');
  const init2 = rsteps(s2.run).find((s) => s.action === 'INIT');
  say(/8 protected case/.test(init2?.text || ''), `the controller protects the 8 v1 steps (${(init2?.text || '').match(/\d+ protected case/)?.[0]})`);
  const opening = s2.reqs[0]?.messages?.map((m) => String(m.content || '')) || [];
  say(opening.some((c) => /^Your notes from earlier work/.test(c) && /farm-save/.test(c)), 'the opening context carries session 1\'s notes');
  say(opening.some((c) => /^LESSONS FROM EARLIER WORK/.test(c) && /forgot to persist/.test(c)), 'and session 1\'s scoped lesson');
  say(s2.run.recovery?.state === 'ACCEPTED' && /RESULT: 11 cases attempted, 11 passed/.test(dm2[1] || '') && s2.file === V2, 'the v2 write passes 11/11 and is ACCEPTED - added without breaking v1');

  console.log('\n=== 3. session 3: an increment that breaks an earlier feature is restored ===');
  const s3 = await session('s3', SPEC2, [PLAN, write(V2_NOSAVE), FINISH]);
  const rb = rsteps(s3.run);
  const guard = (s3.run.steps || []).find((s) => s.type === 'lesson_guard');
  say(!!guard, `the lesson guard refused the write once (DETECT "forgot to save" in javascript/write_file): ${guard ? 'yes' : 'no'}`);
  const w = (s3.run.steps || []).filter((s) => s.type === 'tool' && s.tool === 'write_file');
  say(w.length >= 1 && /^REFUSED ONCE by lesson/.test(String(w[0].result || '')), 'the first write result was the refusal with the lesson');
  say(s3.file === V2 && gameSnapshot(ws).sha256 === s3.run.recovery?.verified?.sha256, 'index.html is still the accepted v2 page, byte for byte, and equals the checkpoint');
  say(!rb.some((s) => s.action === 'ACCEPT'), 'nothing was accepted in session 3');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}
console.log(`\n  farm increment: ${passed} passed, ${failed} failed -> ${failed ? 'THE INCREMENT SHAPE IS NOT ESTABLISHED' : 'restart continuity, protected increment, refused regression'}`);
process.exit(failed ? 1 : 0);
