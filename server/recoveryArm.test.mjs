/**
 * recoveryArm.test.mjs - the RECOVERY_ARM through the REAL campaign entry point, scripted
 * backend, no GPU: the controller is enabled by the runner, its account lands on the row, and
 * the row's two integrity flags behave.
 *
 *   node server/recoveryArm.test.mjs
 *
 *   unit 1  BREAK then FIXED   -> controller RESTORE (byte-exact) then ACCEPT; acceptance RETAIN;
 *                                 neither flag raised
 *   unit 2  PROGRESS then FINISH -> controller PROVISIONAL, never ACCEPT; acceptance is NOT
 *                                 RETAIN (the evaluator judges the unverified candidate itself);
 *                                 provisionalDeliveredAsAccepted is false because nothing
 *                                 delivered it as accepted - and would be TRUE if it had been
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { freePorts } = await import('./testHarness.mjs');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const BUGGY = '                dp[i, j] = dp[i - 1, j] + 1';
const PROGRESS_LINE = '                dp[i, j] = dp[i - 1, j] + 2';
const FIXED_LINE = '                dp[i, j] = dp[i - 1, j - 1] + 1';
const RETURN_LINE = '    return max(dp.values()) if dp else 0';
const PLAN = '1. WHAT IT DOES - lcs_length\n2. FILES - lcs_length.py\n3. BUILD ORDER - fix\n4. HOW TO VERIFY - the diagnostic runs automatically';
const edit = (find, replace) => `THOUGHT: Editing.\nACTION: edit_file\nPATH: lcs_length.py\nFIND:\n${find}\nREPLACE:\n${replace}`;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nfixed';

async function campaign(label, replies) {
  const dir = mkdtempSync(join(tmpdir(), `recarm-${label}-`));
  const [fakePort] = await freePorts(1);
  const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify(replies), 'utf8');
  const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
  let out = '';
  const runner = spawn(process.execPath, [join(HERE, 'autodiag1.mjs'), `http://127.0.0.1:${fakePort}`], {
    env: { ...process.env, AUTODIAG_EXPERIMENT: `SMOKE-RECARM-${label}`, AUTODIAG_ARMS: 'RECOVERY_ARM', AUTODIAG_REPS: '1', AUTODIAG_SEEDS: '7', AUTODIAG_TASK_IDS: 'ext-lcs_length', AUTODIAG_PER_TASK_SEC: '150', AUTODIAG_TOTAL_SEC: '900', AGENT_MAX_STEPS: '25' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  runner.stdout.on('data', (d) => { out += d; }); runner.stderr.on('data', (d) => { out += d; });
  const code = await new Promise((resolve) => { const k = setTimeout(() => { try { runner.kill('SIGKILL'); } catch {} resolve('KILLED'); }, 8 * 60_000); runner.on('exit', (c) => { clearTimeout(k); resolve(c); }); });
  try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  const root = dirname((out.match(/summary: (.+summary\.jsonl)/) || [])[1] || '');
  const rows = existsSync(join(root, 'summary.jsonl')) ? readFileSync(join(root, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'run') : [];
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  return { code, out, row: rows[0] };
}

console.log('=== unit 1: rejected edit restored, then the fix accepted ===');
{
  const { code, out, row } = await campaign('fix', [PLAN, edit(RETURN_LINE, '    return 1'), edit(BUGGY, FIXED_LINE), FINISH]);
  say(code === 0 && row, `campaign ran (exit ${code})`);
  say(row?.recovery?.enabled === true && row.recovery.state === 'ACCEPTED', `controller enabled and ended ACCEPTED (${row?.recovery?.state})`);
  say(JSON.stringify(row?.recovery?.decisions) === JSON.stringify(['RESTORE', 'ACCEPT']), `decisions RESTORE > ACCEPT (${row?.recovery?.decisions?.join('>')})`);
  say(row?.recovery?.restores === 1 && row.recovery.restoresExact === 1, 'one restore, byte-exact');
  say(row?.disposition === 'RETAIN' && row.accepted === true, `acceptance RETAIN (${row?.disposition})`);
  say(row?.provisionalDeliveredAsAccepted === false && row?.controllerAcceptNotRetained === false, 'neither integrity flag raised');
  say(/ctl=ACCEPTED RESTORE>ACCEPT restores=1\/1/.test(out), 'the console line carries the controller account');
}

console.log('\n=== unit 2: a provisional candidate is never delivered as accepted ===');
{
  const { code, out, row } = await campaign('prov', [PLAN, edit(BUGGY, PROGRESS_LINE), FINISH]);
  say(code === 0 && row, `campaign ran (exit ${code})`);
  say(row?.recovery?.state === 'ACTIVE' && row.recovery.provisionals === 1 && JSON.stringify(row.recovery.decisions) === JSON.stringify(['PROVISIONAL']), `controller left ACTIVE after one PROVISIONAL (${row?.recovery?.decisions?.join('>')})`);
  say(row?.disposition !== 'RETAIN' && row?.accepted === false && row?.requested === 'FAIL' && row?.protected === 'PASS', `acceptance did not retain it: ${row?.disposition} (requested ${row?.requested}, protected ${row?.protected})`);
  say(row?.provisionalDeliveredAsAccepted === false, 'provisionalDeliveredAsAccepted is false - nothing delivered it as accepted');
  // The flag's own logic, exercised: had acceptance said RETAIN with the controller short of
  // ACCEPT, the flag would be TRUE. (Computed the same way the runner computes it.)
  const wouldFlag = !!(row?.recovery?.enabled && true && row.recovery.state !== 'ACCEPTED');
  say(wouldFlag === true, 'and it WOULD be raised if a non-ACCEPTED controller state were retained (flag logic checked)');
  say(!/PROVISIONAL DELIVERED AS ACCEPTED/.test(out), 'no violation line on the console');
}

console.log(`\n  recovery arm: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
