/**
 * resumeCampaign.test.mjs - a campaign whose PROCESS dies completes its pairs on relaunch.
 *
 *   node server/resumeCampaign.test.mjs
 *
 * OVERNIGHT-1 attempt 1 exited 127 one second into its second unit, silently. The relevant
 * condition is injected here (AUTODIAG_INJECT_EXIT_AFTER_UNIT=1: exit 127 right after unit 1
 * is recorded) through the real entry point against the scripted backend; then the runner is
 * launched again on the SAME root (AUTODIAG_ROOT). What is established:
 *   1. the crash is DIAGNOSABLE: <root>/crash.log names the exit
 *   2. the resumed run skips the recorded unit, runs the rest, and the summary holds every
 *      planned unit exactly once (no duplicate rows, the plan recorded once)
 *   3. the report reconciles (integrity true, UNACCOUNTED 0) and COMPLETE/DONE are written
 *   4. the supervisor in mech1Launch.sh would find the root (AUTODIAG_ROOT_FILE written)
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
const FIXED = '                dp[i, j] = dp[i - 1, j - 1] + 1';
const PLAN = '1. WHAT IT DOES - lcs_length\n2. FILES - lcs_length.py\n3. BUILD ORDER - fix\n4. HOW TO VERIFY - the diagnostic runs automatically';
const edit = (find, replace) => `THOUGHT: Editing.\nACTION: edit_file\nPATH: lcs_length.py\nFIND:\n${find}\nREPLACE:\n${replace}`;
const FINISH = 'THOUGHT: Done.\nACTION: finish\nTEXT:\nfixed';

const dir = mkdtempSync(join(tmpdir(), 'resume-'));
const [fakePort] = await freePorts(1);
const rf = join(dir, 'replies.json'); writeFileSync(rf, JSON.stringify([PLAN, edit(BUGGY, FIXED), FINISH]), 'utf8');
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--replies', rf], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const rootFile = join(dir, 'root.txt');
const doneFile = join(dir, 'DONE');
const baseEnv = { ...process.env, AUTODIAG_EXPERIMENT: 'SMOKE-RESUME', AUTODIAG_ARMS: 'CONTROL,AUTODIAG_ARM', AUTODIAG_REPS: '1', AUTODIAG_TASK_IDS: 'ext-lcs_length,ext-gcd', AUTODIAG_PER_TASK_SEC: '120', AUTODIAG_TOTAL_SEC: '1200', AUTODIAG_DONE_FILE: doneFile, AUTODIAG_ROOT_FILE: rootFile };

function launch(extra) {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn(process.execPath, [join(HERE, 'autodiag1.mjs'), `http://127.0.0.1:${fakePort}`], { env: { ...baseEnv, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    const k = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} resolve({ code: 'KILLED', out }); }, 8 * 60_000);
    p.on('exit', (c) => { clearTimeout(k); resolve({ code: c, out }); });
  });
}

try {
  console.log('=== attempt 1: dies with exit 127 after unit 1 (injected) ===');
  const a1 = await launch({ AUTODIAG_INJECT_EXIT_AFTER_UNIT: '1' });
  say(a1.code === 127, `attempt 1 exited 127 (${a1.code})`);
  say(existsSync(rootFile), 'the root was published for the supervisor');
  const root = existsSync(rootFile) ? readFileSync(rootFile, 'utf8').trim() : '';
  const rows1 = existsSync(join(root, 'summary.jsonl')) ? readFileSync(join(root, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  say(rows1.filter((r) => r.kind === 'run').length === 1 && rows1.filter((r) => r.kind === 'plan').length === 1, `one unit recorded, one plan (${rows1.filter((r) => r.kind === 'run').length} runs)`);
  say(!existsSync(doneFile), 'no DONE file - the campaign is not complete');
  const crashLog = join(root, 'crash.log');
  say(existsSync(crashLog) && /code 127/.test(readFileSync(crashLog, 'utf8')), `crash.log names the exit: ${existsSync(crashLog) ? readFileSync(crashLog, 'utf8').trim().slice(0, 100) : 'MISSING'}`);

  console.log('\n=== attempt 2: relaunched on the same root, resumes ===');
  const a2 = await launch({ AUTODIAG_ROOT: root });
  say(a2.code === 0, `attempt 2 exited 0 (${a2.code})`);
  say(/RESUMING .* 1 unit\(s\) already recorded/.test(a2.out) && /\(RESUMED\)/.test(a2.out), 'the runner announced the resume and the skipped count');
  const rows2 = readFileSync(join(root, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const runs = rows2.filter((r) => r.kind === 'run');
  const plan = rows2.filter((r) => r.kind === 'plan');
  say(plan.length === 1 && plan[0].tasks.length === 4, 'the plan is recorded exactly once, 4 units');
  say(runs.length === 4 && new Set(runs.map((r) => r.task)).size === 4, `every planned unit has exactly one row (${runs.length} rows, ${new Set(runs.map((r) => r.task)).size} distinct)`);
  // The scripted edit targets lcs_length.py, so the gcd units RUN but cannot be accepted.
  say(runs.every((r) => r.state !== 'UNATTEMPTED') && runs.filter((r) => r.task.startsWith('ext-lcs_length@')).every((r) => r.accepted === true) && runs.filter((r) => r.task.startsWith('ext-gcd@')).every((r) => r.accepted === false), 'all four ran; both lcs_length units accepted (the scripted fix), both gcd units not (the script does not fix gcd)');
  say(runs.map((r) => r.idx).join(',') === '1,2,3,4', `indices continue without gaps or repeats (${runs.map((r) => r.idx).join(',')})`);
  const rep = JSON.parse(readFileSync(join(root, 'SMOKE-RESUME_REPORT.json'), 'utf8'));
  say(rep.integrity?.ok === true && rep.reconciliation?.ok === true && rep.byStatus?.UNACCOUNTED === 0, 'report: integrity true, reconciliation true, UNACCOUNTED 0');
  say(existsSync(doneFile) && /SMOKE-RESUME COMPLETE/.test(a2.out), 'COMPLETE printed and the DONE file written');
  say(!/\[fault injection\]/.test(a2.out), 'no fault injected on the resume');
} finally {
  try { fake.kill('SIGKILL'); } catch { /* best effort */ }
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
}
console.log(`\n  resume: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
