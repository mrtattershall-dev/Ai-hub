/**
 * outerDeadline.test.mjs - THE OUTER FALLBACK FIRES WHEN NOTHING ELSE DOES.
 *
 *   node server/outerDeadline.test.mjs
 *
 * No GPU, no model. Companion to `deadlineRecovery.test.mjs`, which established recovery
 * through the Hub's INNER per-call deadline. That test says plainly what it does not prove:
 * that the runner's OUTER wall works when the inner layer does not. This one proves that.
 *
 * WHAT IS INJECTED, AND WHAT IS NOT. AUTODIAG-1's backend failure - a call whose cancellation
 * fired while its await ran on for 5,964s - cannot be reproduced on demand. Its RELEVANT
 * CONDITION can: the campaign runner awaits an operation that never settles and cannot be
 * cancelled (`AUTODIAG_INJECT_HANG_TASK`). Everything downstream is the real path, untouched:
 * the real outer timer, the real SIGKILL, the real bounded exit wait, the real
 * confirmNoneRunning, the real halt, the real UNATTEMPTED rows, the real report.
 *
 *   1. THE OUTER DEADLINE ACTUALLY FIRES - the unit is taken apart by the runner, not waited on
 *   2. THE HUB EXITS AND WORKER SHUTDOWN IS CONFIRMED - or the campaign HALTS explicitly
 *   3. NO NEXT TASK STARTS while execution is unresolved
 *   4. EVERY PLANNED UNIT APPEARS IN THE FINAL REPORT
 */
import { spawn } from 'node:child_process';
import { readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { freePorts } = await import('./testHarness.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const PER_TASK = 10;
const GRACE_MS = 4000;
const HANG_TASK = 'ext-lcs_length';
// lcs_length hangs; pascal is the LATER unit that must not start while the first is unresolved.
const TASKS = `${HANG_TASK},ext-pascal`;

const [fakePort] = await freePorts(1);
// A normally-behaving backend: the hang is injected in the runner, not caused by the model.
// So nothing here can recover the unit - the inner deadline has nothing to fire on.
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--script', 'loop'],
  { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));

const t0 = Date.now();
let out = '';
const runner = spawn(process.execPath, [join(HERE, 'autodiag1.mjs'), `http://127.0.0.1:${fakePort}`], {
  env: {
    ...process.env,
    AUTODIAG_REPS: '1',
    AUTODIAG_TASK_IDS: TASKS,
    AUTODIAG_PER_TASK_SEC: String(PER_TASK),
    AUTODIAG_UNIT_GRACE_MS: String(GRACE_MS),
    AUTODIAG_TOTAL_SEC: '600',
    AUTODIAG_INJECT_HANG_TASK: HANG_TASK,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
runner.stdout.on('data', (d) => { out += d.toString(); });
runner.stderr.on('data', (d) => { out += d.toString(); });

// The whole point: without the outer wall this never returns. The test's own kill is set far
// beyond any legitimate bound, so reaching it IS the failure.
const exitCode = await new Promise((resolve) => {
  const kill = setTimeout(() => { try { runner.kill('SIGKILL'); } catch {} resolve('KILLED_BY_TEST'); }, 6 * 60_000);
  runner.on('exit', (c) => { clearTimeout(kill); resolve(c); });
});
const elapsed = Math.round((Date.now() - t0) / 1000);
try { fake.kill('SIGKILL'); } catch { /* best effort */ }

const root = (out.match(/summary: (.+summary\.jsonl)/) || [])[1]
  || readdirSync(tmpdir()).filter((d) => d.startsWith('autodiag1-')).map((d) => join(tmpdir(), d, 'summary.jsonl')).filter(existsSync).sort().pop();
const raw = root && existsSync(root) ? readFileSync(root, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
const rows = raw.filter((r) => r.kind === 'run');
const plan = (raw.find((r) => r.kind === 'plan') || {}).tasks || [];

console.log('=== 1. the OUTER deadline actually fires ===');
note(`injected a never-settling await for ${HANG_TASK}; per-task bound ${PER_TASK}s + ${GRACE_MS / 1000}s grace`);
say(exitCode !== 'KILLED_BY_TEST', `the runner exited on its own after ${elapsed}s - the test never had to kill it`);
say(/fault injection/.test(out), 'the injected hang was reached');
say(/hit the hard wall/.test(out), 'THE OUTER WALL FIRED - the runner took the unit apart rather than waiting on it');
const hungRow = rows.find((r) => r.task.startsWith(`${HANG_TASK}@`));
say(!!hungRow && hungRow.hitHardWall === true, `the hung unit records hitHardWall=true (${hungRow?.hitHardWall})`);
// generous, but nothing like 99 minutes: the injected await would otherwise never return
say(elapsed < 240, `the campaign finished in ${elapsed}s, not indefinitely`);

console.log('\n=== 2. the hub exits and worker shutdown is confirmed, or the campaign halts ===');
const halted = /HALTING:/.test(out);
if (halted) {
  say(/refusing to start another unit|could not be confirmed stopped/.test(out), 'it HALTED with an explicit reason');
  note(out.split('\n').filter((l) => /HALTING:/.test(l))[0] || '');
} else {
  say(hungRow?.hubExited === true, `the hub exited after SIGKILL (${hungRow?.hubExited})`);
  say(hungRow?.executionConfirmedStopped === true, `worker shutdown was CONFIRMED, not assumed (${hungRow?.executionConfirmedStopped})`);
}
say(!/Cannot read|is not a function|ReferenceError/.test(out), 'no crash in the fallback path');

console.log('\n=== 3. no next task starts while execution is unresolved ===');
const later = rows.filter((r) => r.task.startsWith('ext-pascal@') && r.termination !== 'UNATTEMPTED');
if (halted) {
  say(later.length === 0, `the campaign halted, so no later unit ran (${later.length})`);
} else {
  // the later unit may run, but ONLY after the hung one was confirmed stopped
  say(hungRow?.executionConfirmedStopped === true,
    'the later unit could only start because the hung one was confirmed stopped first');
  say(rows.indexOf(hungRow) < (later.length ? rows.indexOf(later[0]) : Infinity),
    'and it is recorded after the hung unit, never concurrently');
}

console.log('\n=== 4. every planned unit appears in the final report ===');
say(/AUTODIAG-1 COMPLETE/.test(out), 'the campaign produced its final report');
say(plan.length === 4, `the plan recorded all 4 planned units (${plan.length})`);
const recorded = new Set(rows.map((r) => r.task));
say(plan.every((t) => recorded.has(t)), `every planned unit has a row (${rows.length} rows)`);
const unatt = rows.filter((r) => r.termination === 'UNATTEMPTED');
say(unatt.every((r) => r.reason), `every unattempted entry carries a reason (${unatt.length} unattempted)`);
if (unatt.length) note(`e.g. ${unatt[0].task}: ${unatt[0].reason}`);
const reportPath = root ? join(dirname(root), 'AUTODIAG-1_REPORT.json') : null;
if (reportPath && existsSync(reportPath)) {
  const rep = JSON.parse(readFileSync(reportPath, 'utf8'));
  say(rep.byStatus?.UNACCOUNTED === 0, `UNACCOUNTED 0 (${rep.byStatus?.UNACCOUNTED}) - nothing is merely missing`);
} else say(false, 'the report file exists');

try { if (root) rmSync(dirname(root), { recursive: true, force: true }); } catch { /* best effort */ }
console.log(`\n  outer deadline: ${passed} passed, ${failed} failed -> ${failed ? 'THE OUTER FALLBACK DOES NOT PROTECT THE CAMPAIGN' : 'an uncancellable never-settling await is bounded, confirmed stopped, and fully accounted'}`);
process.exit(failed ? 1 : 0);
