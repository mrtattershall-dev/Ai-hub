/**
 * recoveryController.test.mjs - REPLAY VALIDATION of the recovery controller (recovery.js)
 * through the real Hub path, with scripted replies. No GPU. Diagnostics run in the worker.
 *
 *   node server/recoveryController.test.mjs
 *
 * Three properties, each with a positive and a negative side:
 *   1. ROLLBACK      the last verified state is restored EXACTLY (sha256) after a rejected edit,
 *                    including a truncated/partial rewrite, and the model's next observation
 *                    (read_file) shows the restored bytes, not the rejected ones
 *   2. FRESH-PLAN    the failure packet carries the rejection; the rejected code never leaks
 *      RETRIES       back into the file; an identical resubmission is refused WITHOUT spending a
 *                    diagnostic; progress is kept provisionally while the checkpoint stays
 *   3. STOPPING      exhausted attempts and exhausted repeats END the run: the scripted fix that
 *                    follows never executes and the file is the checkpoint
 *   0. CONTROL       without the controller the same rejected edit stays in the file - so the
 *                    controller is the deciding path, not a message
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const { scratch, startHub, freePorts } = await import('./testHarness.mjs');
const { externalTasks } = await import('./benchTasks.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => createHash('sha256').update(s).digest('hex');
const dirs = [];

const TASK = externalTasks().find((t) => t.id === 'ext-lcs_length');
const MODULE = 'lcs_length';
const SEED = TASK.seed['lcs_length.py'];
const CASES = TASK.requested.files['cases.jsonl'];
const BUGGY = '                dp[i, j] = dp[i - 1, j] + 1';
const PROGRESS_LINE = '                dp[i, j] = dp[i - 1, j] + 2';   // 1 -> 2 cases, protected case 3 still passes
const FIXED_LINE = '                dp[i, j] = dp[i - 1, j - 1] + 1';
const RETURN_LINE = '    return max(dp.values()) if dp else 0';

const PLAN = '1. WHAT IT DOES - lcs_length\n2. FILES - lcs_length.py\n3. BUILD ORDER - fix\n4. HOW TO VERIFY - the diagnostic runs automatically';
const edit = (find, replace) => `THOUGHT: Editing.\nACTION: edit_file\nPATH: lcs_length.py\nFIND:\n${find}\nREPLACE:\n${replace}`;
const write = (body) => `THOUGHT: Rewriting the file.\nACTION: write_file\nPATH: lcs_length.py\n\`\`\`python\n${body}\n\`\`\``;
const READ = 'THOUGHT: Looking at the file as it stands.\nACTION: read_file\nPATH: lcs_length.py';
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nfixed';
const BREAK = edit(RETURN_LINE, '    return 1');                         // protected case 3 (expects 0) breaks
const BREAK2 = edit(RETURN_LINE, '    return 2');                        // a DIFFERENT rejected candidate
const PARTIAL = write('def lcs_length(s, t):\n    return 1\n');           // a truncated rewrite: parses, breaks protected
const IMPORT_BROKEN = write('def lcs_length(s, t):\n    return 0\n\nbroken = undefined_symbol\n');  // parses, fails to import
const PROGRESS = edit(BUGGY, PROGRESS_LINE);
const FIXED = edit(BUGGY, FIXED_LINE);
const FIXED_FROM_PROGRESS = edit(PROGRESS_LINE, FIXED_LINE);

async function drive(replies, { label, recovery, budgetSec = 300 }) {
  const [hubPort, fakePort] = await freePorts(2);
  const dir = scratch(`rc-${label}`, { baseUrl: `http://127.0.0.1:${fakePort}`, model: 'fake' });
  dirs.push(dir);
  const ws = join(dir, 'workspace');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'lcs_length.py'), SEED, 'utf8');
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore' });
  let hub = null;
  try {
    const started = await startHub(dir, { port: hubPort, env: { AGENT_APPROVAL_MODE: 'build', AGENT_BOUND_ROUTES: '1', AGENT_WORKER_EXEC: '1' } });
    hub = started.hub;
    const { runId } = await started.api('/agent/start', {
      method: 'POST',
      body: JSON.stringify({ goal: `The file ${MODULE}.py contains a bug. Fix ${MODULE}() so it is correct for every input.`, budgetSec, diagnostic: { moduleName: MODULE, casesJsonl: CASES }, ...(recovery ? { recovery } : {}) }),
    });
    let run = null;
    for (let i = 0; i < 240; i++) {
      run = await started.api(`/agent/${runId}`).catch(() => null);
      if (run && run.status && run.status !== 'running' && !run.busy && run.finalizedAt) break;
      await sleep(1000);
    }
    return { run, ws, file: readFileSync(join(ws, 'lcs_length.py'), 'utf8') };
  } finally {
    try { hub && hub.kill('SIGKILL'); } catch { /* best effort */ }
    try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  }
}
const rsteps = (run) => (run.steps || []).filter((s) => s.type === 'recovery');
const tools = (run, name) => (run.steps || []).filter((s) => s.type === 'tool' && s.tool === name);
const edits = (run) => (run.steps || []).filter((s) => s.type === 'tool' && /^(edit_file|write_file)$/.test(s.tool));
const diags = (run) => (run.diagnostics || []).filter((d) => !d.skipped);
const SEED_SHA = sha(SEED);
const FIXED_SRC = SEED.replace(BUGGY, FIXED_LINE);

try {
  console.log('=== 0. CONTROL: without the controller, a rejected edit stays in the file ===');
  {
    const { run, file } = await drive([PLAN, BREAK, READ, FINISH], { label: 'ctl', recovery: null });
    say(rsteps(run).length === 0 && !run.recovery, 'no recovery steps, no controller state');
    say(/return 1/.test(file) && sha(file) !== SEED_SHA, 'the breaking edit is still in the file at the end');
    const rd = tools(run, 'read_file')[0];
    say(rd && /return 1/.test(String(rd.result || '')), 'and read_file showed the broken file to the model');
  }

  console.log('\n=== 1. ROLLBACK: exact restoration, including after a partial rewrite; observations match ===');
  {
    const { run, file } = await drive([PLAN, BREAK, READ, PARTIAL, READ, IMPORT_BROKEN, READ, FIXED, FINISH], { label: 'rollback', recovery: { maxAttempts: 5, maxRepeats: 2 } });
    const rs = rsteps(run);
    const init = rs.find((s) => s.action === 'INIT');
    // The INIT step records the checkpoint at the start; run.recovery.verified is the FINAL
    // checkpoint (advanced by ACCEPT), so the opening state is asserted from the step text.
    say(init && run.recovery?.enabled && new RegExp(`sha ${SEED_SHA.slice(0, 12)}`).test(init.text) && /\b1 protected case/.test(init.text), `controller ON with the seed as the verified checkpoint: ${init?.text?.slice(0, 110)}`);
    const restores = rs.filter((s) => s.action === 'RESTORE');
    say(restores.length === 3, `three rejected changes, three RESTOREs (${restores.length}): ${restores.map((s) => s.kind).join(', ')}`);
    say(restores.every((s) => s.restoredExact === true), 'every restore was byte-exact (sha256 equal to the checkpoint)');
    say(restores[0]?.kind === 'PROTECTED_BROKEN' && restores[1]?.kind === 'PROTECTED_BROKEN' && restores[2]?.kind === 'IMPORT_ERROR', 'kinds: protected broken (edit), protected broken (truncated rewrite), import error (rewrite)');
    const reads = tools(run, 'read_file');
    say(reads.length === 3 && reads.every((r) => String(r.result || '').includes(RETURN_LINE.trim()) && !/return 1|undefined_symbol/.test(String(r.result || ''))), `every read_file after a rejection showed the RESTORED file (${reads.length} reads)`);
    say(rs.some((s) => s.action === 'ACCEPT') && run.recovery.verified.sha256 === sha(FIXED_SRC), 'the fix was ACCEPTED and the checkpoint advanced to it');
    say(file === FIXED_SRC, 'the workspace file is the fixed source');
    say(run.recovery.rejected.length === 3 && !run.recovery.rejected.some((r) => r.sha256 === SEED_SHA), 'three rejected candidates recorded, none of them the checkpoint');
    say(run.status === 'done', `run finished normally (${run.status})`);
  }

  console.log('\n=== 2. FRESH-PLAN RETRIES: the packet carries the rejection; repeats are refused; progress is provisional ===');
  {
    const { run } = await drive([PLAN, BREAK, BREAK, FIXED, FINISH], { label: 'repeat', recovery: { maxAttempts: 5, maxRepeats: 1 } });
    const rs = rsteps(run);
    const nDiagBefore = diags(run).length;
    say(rs.some((s) => s.action === 'RESTORE') && rs.some((s) => s.action === 'REPEAT'), `first BREAK rejected, identical BREAK refused as a REPEAT (${rs.map((s) => s.action).join(' > ')})`);
    say(diags(run).length === 2, `the repeat spent no diagnostic: ${diags(run).length} diagnostics (opening + first rejection), not 3`);
    say(run.status === 'stopped' && /recovery controller/.test(String((run.steps || []).slice().reverse().find((s) => s.type === 'error')?.text || '')), `maxRepeats 1 -> the run STOPPED (${run.status})`);
    say(edits(run).length === 2, `the scripted FIXED edit after the stop never executed (${edits(run).length} edits ran)`);
    const packet = rs.find((s) => s.action === 'RESTORE')?.packet || '';
    say(/^RECOVERY CONTROLLER - your last change was REJECTED/.test(packet) && /protected behaviour broke: case\(s\) 3\b/.test(packet) && /STILL FAILING on the restored file \(8 of 9 cases; 1 pass/.test(packet) && /identical one is refused/.test(packet), 'the packet names the rejecting check (case 3), the residual failures (8 of 9), and the refusal rule');
    say(packet.length > 0 && !/return 1/.test(packet) && (packet.match(/^ {2}FAIL case /gm) || []).length === 6 && /2 further failing case\(s\) not shown/.test(packet), 'the packet does not carry the rejected code back, and is bounded (6 shown, 2 withheld and said so)');
  }
  {
    const { run, file } = await drive([PLAN, PROGRESS, FIXED_FROM_PROGRESS, FINISH], { label: 'progress', recovery: { maxAttempts: 2, maxRepeats: 2 } });
    const rs = rsteps(run);
    const prov = rs.find((s) => s.action === 'PROVISIONAL');
    say(!!prov, `partial progress (1 -> 2 cases, protected held) was kept PROVISIONALLY: ${prov?.text?.slice(0, 90)}`);
    say(run.recovery.rejected.length === 0 && run.recovery.attempts === 0, 'a provisional candidate consumes no attempt and is not a rejection');
    say(rs.some((s) => s.action === 'ACCEPT') && run.recovery.verified.sha256 === sha(FIXED_SRC) && file === FIXED_SRC, 'the follow-up fix was ACCEPTED from the provisional state');
  }

  console.log('\n=== 3. STOPPING: exhausted attempts end the run; nothing further executes ===');
  {
    const { run, file } = await drive([PLAN, BREAK, BREAK2, FIXED, FINISH], { label: 'budget', recovery: { maxAttempts: 2, maxRepeats: 2 } });
    const rs = rsteps(run);
    say(rs.filter((s) => s.action === 'RESTORE').length === 2, 'two different rejected candidates, two RESTOREs');
    say(run.recovery.attempts === 2 && run.recovery.state === 'STOPPED', `attempts ${run.recovery.attempts} of 2 -> controller state ${run.recovery.state}`);
    say(run.status === 'stopped' && /attempts exhausted/.test(String((run.steps || []).find((s) => s.type === 'error' && /recovery controller/.test(s.text))?.text || '')), `the run STOPPED with the reason (${run.status})`);
    say(edits(run).length === 2 && sha(file) === SEED_SHA, 'the scripted fix never executed; the file is the checkpoint, byte-exact');
    say(!!run.finalizedAt, 'the stopped run was finalized (terminal state persisted)');
  }
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  recovery controller: ${passed} passed, ${failed} failed -> ${failed ? 'THE CONTROLLER IS NOT ESTABLISHED' : 'exact rollback, rejection carried without leaking, repeats refused, budgets stop the run'}`);
process.exit(failed ? 1 : 0);
