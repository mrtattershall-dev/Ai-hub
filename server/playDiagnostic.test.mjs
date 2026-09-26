/**
 * playDiagnostic.test.mjs - the PLAY kind through the real Hub: the declared farm play as the
 * automatic diagnostic (opening + after every change), the recovery controller over the
 * game's tracked files, and the evaluator's play verdicts. Scripted replies, the machine's
 * own Chrome, no model.
 *
 *   node server/playDiagnostic.test.mjs
 *
 *   1. opening diagnostic on a partial game: "the game at index.html", 5/8, cases 5-7 listed
 *   2. a write that completes the game -> after-edit diagnostic 8/8 -> controller ACCEPT;
 *      the checkpoint sha is the game snapshot's sha
 *   3. on a complete game, a write that breaks the page -> PROTECTED_BROKEN -> exact
 *      restoration of index.html (multi-file checkpoint), then the run finishes
 *   4. evaluator: requested play PASSes on the positive control and FAILs on the negative;
 *      protected steps that pass stay PASS when only later steps fail
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { gameSnapshot } = await import('./autodiag.js');
const { evaluate, VERDICT } = await import('./evaluator.js');
const { farmTasks } = await import('./benchTasks.js');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash('sha256').update(s).digest('hex');

const FARM = join(HERE, '..', 'legasus', 'bench', 'farm');
const spec = JSON.parse(readFileSync(join(FARM, 'play.json'), 'utf8'));
const POSITIVE = readFileSync(join(FARM, 'controls', 'positive', 'index.html'), 'utf8');
const NOHARVEST = readFileSync(join(FARM, 'controls', 'negative-noharvest', 'index.html'), 'utf8');
const THROWS = readFileSync(join(FARM, 'controls', 'negative-throws', 'index.html'), 'utf8');
const PLAN = '1. WHAT IT DOES - farm\n2. FILES - index.html\n3. BUILD ORDER - write\n4. HOW TO VERIFY - the play runs automatically';
const write = (body) => `THOUGHT: Writing the page.\nACTION: write_file\nPATH: index.html\n\`\`\`html\n${body}\n\`\`\``;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\ndone';
const dirs = [];

async function drive(label, initialHtml, replies, { recovery = { maxAttempts: 2, maxRepeats: 2, maxProvisional: 3 } } = {}) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`pd-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'index.html'), initialHtml, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const promptLog = join(dir, 'prompts.jsonl');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore', env: { ...process.env, FAKE_PROMPT_LOG: promptLog } });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build' } });
    hub = started.hub;
    const { runId } = await started.api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: 'Build the farm game.', budgetSec: 240, diagnostic: { kind: 'play', spec, timeoutSec: 60 }, ...(recovery ? { recovery } : {}) }) });
    let run = null;
    for (let i = 0; i < 240; i++) { run = await started.api(`/agent/${runId}`).catch(() => null); if (run && run.status && run.status !== 'running' && !run.busy && run.finalizedAt) break; await sleep(1000); }
    const reqs = readFileSync(promptLog, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    return { run, ws, reqs, file: readFileSync(join(ws, 'index.html'), 'utf8') };
  } finally { try { hub && hub.kill('SIGKILL'); } catch {} try { fake.kill('SIGKILL'); } catch {} }
}
const diagMsgs = (reqs) => { const seen = new Set(), out = []; for (const r of reqs) for (const m of r.messages) { const c = String(m.content || ''); if (/^AUTOMATIC DIAGNOSTIC/.test(c) && !seen.has(c)) { seen.add(c); out.push(c); } } return out; };
const rsteps = (run) => (run.steps || []).filter((s) => s.type === 'recovery');

try {
  console.log('=== 1+2. a partial game, then the write that completes it ===');
  const a = await drive('complete', NOHARVEST, [PLAN, write(POSITIVE), FINISH]);
  const dm = diagMsgs(a.reqs);
  console.log('        note: opening head:', (dm[0]||'').split('\n').slice(0,4).join(' | ').slice(0,300));
  console.log('        note: snapshot at end:', JSON.stringify(Object.keys(gameSnapshot(a.ws).files)), 'ckpt', a.run.recovery?.verified?.sha256?.slice(0,12), 'now', gameSnapshot(a.ws).sha256.slice(0,12));
  console.log('        note: file vs POSITIVE lengths:', a.file.length, POSITIVE.length, 'status', a.run.status, 'last steps:', (a.run.steps||[]).slice(-3).map(x=>x.type+':'+String(x.text||x.tool||'').slice(0,60)).join(' || '));
  say(dm.length >= 2, `${dm.length} distinct diagnostic messages reached the model`);
  say(/TESTED: the game at index\.html \(1 tracked file\(s\), sha256 [0-9a-f]{16}\)/.test(dm[0] || ''), 'the opening report names the game and its tracked-file identity');
  say(/RESULT: 8 cases attempted, 5 passed, 3 failed\./.test(dm[0] || '') && /FAIL case 5 /.test(dm[0]) && /FAIL case 6 /.test(dm[0]) && /FAIL case 7 /.test(dm[0]), 'the opening report: 5/8, with steps 5, 6 and 7 listed as failing');
  say(/re-run for you just now/.test(dm[1] || '') && /RESULT: 8 cases attempted, 8 passed, 0 failed/.test(dm[1] || ''), 'after the write: 8/8');
  const rs = rsteps(a.run);
  say(rs.some((s) => s.action === 'INIT') && /5 protected case/.test(rs.find((s) => s.action === 'INIT')?.text || ''), 'the controller opened with the 5 passing steps as the protected set');
  say(rs.some((s) => s.action === 'ACCEPT') && a.run.recovery?.state === 'ACCEPTED', 'the completing write was ACCEPTED');
  say(a.run.recovery?.verified?.sha256 === gameSnapshot(a.ws).sha256, 'the checkpoint sha is the game snapshot sha (the tracked-file set)');
  say(a.run.status === 'done' && a.file === POSITIVE, 'the run finished with the complete page in place');

  console.log('\n=== 3. a complete game, then a write that breaks the page ===');
  const b = await drive('break', POSITIVE, [PLAN, write(THROWS), FINISH]);
  const rb = rsteps(b.run);
  console.log('        note: recovery steps:', rb.map(x=>x.action+'/'+(x.kind||'')+'/'+x.restoredExact).join(', '), 'run status', b.run.status);
  const restore = rb.find((s) => s.action === 'RESTORE');
  say(!!restore && restore.kind === 'PROTECTED_BROKEN' && restore.restoredExact === true, `the breaking write was rejected (${restore?.kind}) and restored byte-exact`);
  say(b.file === POSITIVE && sha(b.file) === sha(POSITIVE), 'index.html is the checkpoint again, byte for byte');
  const dmb = diagMsgs(b.reqs);
  say(dmb.some((m) => /RESULT: 8 cases attempted, 0 passed, 8 failed/.test(m) && /\[JS ERROR\]|undefinedFunction|ReferenceError/.test(m)), 'the after-edit report showed 0/8 with the thrown error in the observed evidence');
  say(/RECOVERY CONTROLLER - your last change was REJECTED and the game at index\.html was RESTORED/.test(restore?.packet || ''), 'the packet names the game, not a .py file');

  console.log('\n=== 4. the evaluator: play verdicts ===');
  // The last increment requests all 8 steps; for the evaluator check, take it with nothing protected.
  const task = { ...farmTasks()[3], id: 'farm-full', protected: null };
  say(!!task && task.requested.play.steps.length === 8 && farmTasks()[0].protected === null, 'farm-i4 requests all 8 steps; farm-i1 protects nothing (built from nothing)');
  const gitDir = (html) => { const d = scratch('pd-eval'); dirs.push(d); const ws = join(d, 'ws'); mkdirSync(ws, { recursive: true }); writeFileSync(join(ws, 'index.html'), html, 'utf8'); for (const args of [['init', '-q'], ['config', 'core.autocrlf', 'false'], ['add', '-A'], ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'c']]) execFileSync('git', ['-C', ws, ...args], { windowsHide: true }); return ws; };
  const good = await evaluate(gitDir(POSITIVE), task, { timeoutSec: 90 });
  console.log('        note: evaluate keys:', Object.keys(good).join(','), JSON.stringify(good).slice(0,300));
  say(good.requested?.verdict === VERDICT.PASS && good.verdict === VERDICT.PASS, `requested play PASSes on the positive control (${good.requested?.verdict}, overall ${good.verdict})`);
  const bad = await evaluate(gitDir(NOHARVEST), task, { timeoutSec: 90 });
  say(bad.requested?.verdict === VERDICT.FAIL && JSON.stringify(bad.requested?.failing) === JSON.stringify([5, 6, 7]), `requested play FAILs on the negative control at steps ${JSON.stringify(bad.requested?.failing)}`);
  const protectedTask = { ...task, id: 'farm-v1b', protected: { play: { spec, steps: [1, 2, 3, 4] } } };
  const part = await evaluate(gitDir(NOHARVEST), protectedTask, { timeoutSec: 90 });
  say(part.requested?.verdict === VERDICT.FAIL && part.protected?.verdict === VERDICT.PASS, `with steps 1-4 protected, the negative control is requested FAIL / protected PASS (${part.requested?.verdict}/${part.protected?.verdict})`);
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}
console.log(`\n  play diagnostic: ${passed} passed, ${failed} failed -> ${failed ? 'THE PLAY KIND IS NOT ESTABLISHED' : 'the game is diagnosed, checkpointed, restored and judged like a module'}`);
process.exit(failed ? 1 : 0);
