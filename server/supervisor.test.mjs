/**
 * supervisor.test.mjs - the launch script's stage2 SUPERVISOR detects a stalled runner, kills it
 * by pid, relaunches it on the same root, and the campaign completes.
 *
 *   node server/supervisor.test.mjs
 *
 * Runs `mech1Launch.sh stage2` for real (CAMPAIGN_URL points at the scripted backend, no
 * deploy, no GPU; CAMPAIGN_ALLOW_DIRTY=1 so an uncommitted tree can be tested). The runner's
 * post-processing is made to hang after unit 1 (AUTODIAG_INJECT_HANG_IN_RECORD=1) with a
 * campaign wall far away, so only the supervisor's stall detection can rescue it.
 * What is established:
 *   1. the supervisor sees no summary progress for one unit bound + slack, kills the runner
 *   2. it relaunches on the SAME root (resume), and the hung unit - never recorded - is re-run
 *   3. every planned unit has exactly one row; DONE is written; the campaign ends normally
 */
import { spawn } from 'node:child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const { freePorts } = await import('./testHarness.mjs');
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const work = mkdtempSync(join(tmpdir(), 'sup-'));
const [fakePort] = await freePorts(1);
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--script', 'loop'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const t0 = Date.now();
let out = '';
const sup = spawn('bash', ['server/mech1Launch.sh', 'stage2', work], {
  cwd: REPO,
  env: { ...process.env, CAMPAIGN_URL: `http://127.0.0.1:${fakePort}`, CAMPAIGN_ALLOW_DIRTY: '1', CAMPAIGN_EXPERIMENT: 'SMOKE-SUP',
    CAMPAIGN_ARMS: 'CONTROL', CAMPAIGN_REPS: '1', CAMPAIGN_SEEDS: '5', CAMPAIGN_TASK_IDS: 'ext-gcd,ext-pascal', CAMPAIGN_PER_TASK_SEC: '20',
    CAMPAIGN_TOTAL_SEC: '900', CAMPAIGN_STALL_SLACK_SEC: '25', CAMPAIGN_MAX_RELAUNCH: '2', AUTODIAG_UNIT_GRACE_MS: '3000',
    AUTODIAG_INJECT_HANG_IN_RECORD: '1', PYTHONIOENCODING: 'utf-8' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
sup.stdout.on('data', (d) => { out += d; }); sup.stderr.on('data', (d) => { out += d; });
const code = await new Promise((resolve) => { const k = setTimeout(() => { try { sup.kill('SIGKILL'); } catch {} resolve('KILLED_BY_TEST'); }, 8 * 60_000); sup.on('exit', (c) => { clearTimeout(k); resolve(c); }); });
const elapsed = Math.round((Date.now() - t0) / 1000);
try { fake.kill('SIGKILL'); } catch { /* best effort */ }

const root = existsSync(join(work, 'root.txt')) ? readFileSync(join(work, 'root.txt'), 'utf8').trim() : '';
const raw = root && existsSync(join(root, 'summary.jsonl')) ? readFileSync(join(root, 'summary.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
const rows = raw.filter((r) => r.kind === 'run'), plan = raw.filter((r) => r.kind === 'plan');
try {
  console.log('=== 1. stall detected, runner killed ===');
  say(/\[fault injection\] post-processing of unit 1 will never return/.test(out), 'the hang was injected after unit 1');
  say(/STALL: no summary progress for 45s - killing runner pid \d+/.test(out), 'the supervisor reported the stall (20s unit bound + 25s slack) and killed by pid');
  say(/runner attempt 1 exited (137|127|1)/.test(out), `attempt 1 recorded as killed (${(out.match(/runner attempt 1 exited (\S+)/) || [])[1]})`);
  console.log('=== 2. relaunch on the same root ===');
  say(/runner attempt 2 \(remaining \d+s, resuming /.test(out), 'attempt 2 resumed the same root');
  say(/RESUMING .* 0 unit\(s\) already recorded/.test(out), 'the hung unit had no row, so nothing was skipped - it was re-run');
  say(!/attempt 2[\s\S]*\[fault injection\]/.test(out), 'no fault injected on the resumed attempt');
  console.log('=== 3. the campaign completed ===');
  say(existsSync(join(work, 'DONE')), 'DONE written');
  say(plan.length === 1 && rows.length === 2 && new Set(rows.map((r) => r.task)).size === 2 && rows.every((r) => r.state !== 'UNATTEMPTED'), `every planned unit has exactly one row (${rows.length} rows, ${plan.length} plan)`);
  say(/SMOKE-SUP COMPLETE \S+Z\s*$/m.test(out) && !/HALTED BY THE CAMPAIGN WALL/.test(out), 'COMPLETE printed, not halted by the wall');
  say(code === 0, `stage2 exited 0 (${code}) in ${elapsed}s`);
} finally {
  try { rmSync(work, { recursive: true, force: true }); } catch { /* best effort */ }
}
console.log(`\n  supervisor: ${passed} passed, ${failed} failed`);
if (failed) console.log(out.slice(-3000));
process.exit(failed ? 1 : 0);
