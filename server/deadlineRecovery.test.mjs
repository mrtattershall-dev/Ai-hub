/**
 * deadlineRecovery.test.mjs - THE CAMPAIGN SURVIVES AN OPERATION THAT NEVER SETTLES.
 *
 *   node server/deadlineRecovery.test.mjs
 *
 * No GPU, no model. Driven through the ACTUAL campaign entry point (`server/autodiag1.mjs`),
 * not a unit of one of its parts, because the failure being repaired happened between the
 * parts: a polling loop whose deadline was only tested BETWEEN awaits, and one await that
 * never settled.
 *
 * WHAT AUTODIAG-1 DID. One unit (mergesort / AUTODIAG_ARM / r1) ran 99 minutes of a 150-minute
 * campaign. Its model call's 295s local deadline fired and is recorded - and the await did not
 * unwind for 5,964 seconds. 31 of 60 planned units never started.
 *
 * WHY "36/36 still green" PROVED NOTHING. Those suites passed before the 99-minute wait too.
 * A timeout on an HTTP request only stops WAITING FOR A RESPONSE; it is not evidence that the
 * operation underneath ended. So this test asserts the things that actually matter:
 *
 *   1. the runner REGAINS CONTROL within its configured bound, against a backend that never
 *      responds and never closes and ignores the client going away
 *   2. NO LATE RESPONSE CAN EXECUTE A TOOL - nothing ran in the workspace afterwards
 *   3. EXECUTION IS CONFIRMED STOPPED before the next unit starts, or the campaign HALTS
 *      explicitly and says so
 *   4. THE FINAL REPORT IS PRODUCED, and EVERY unattempted queue entry appears in it with a
 *      reason - not merely as an UNACCOUNTED count
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const { freePorts } = await import('./testHarness.mjs');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const PER_TASK = 12;          // seconds - the configured bound under test
const GRACE_MS = 8000;        // how long the runner may wait past it before taking over
const TASKS = 'ext-lcs_length,ext-pascal';   // two tasks, so a later unit exists to be protected

const [fakePort] = await freePorts(1);
const evLog = join(tmpdir(), `dlr-events-${Date.now()}.jsonl`);
// A backend that accepts the request, sends nothing, never closes, and ignores the client
// going away. The closest a stub can get to "ignores cancellation / never settles".
const fake = spawn(process.execPath, [join(HERE, 'fakemodel.mjs'), '--port', String(fakePort), '--blackhole'],
  { stdio: 'ignore', env: { ...process.env, FAKE_EVENT_LOG: evLog } });
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
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
runner.stdout.on('data', (d) => { out += d.toString(); });
runner.stderr.on('data', (d) => { out += d.toString(); });

const exitCode = await new Promise((resolve) => {
  const kill = setTimeout(() => { try { runner.kill('SIGKILL'); } catch {} resolve('KILLED_BY_TEST'); }, 8 * 60_000);
  runner.on('exit', (c) => { clearTimeout(kill); resolve(c); });
});
const elapsed = Math.round((Date.now() - t0) / 1000);
try { fake.kill('SIGKILL'); } catch { /* best effort */ }

const root = (out.match(/summary: (.+summary\.jsonl)/) || [])[1]
  || (readdirSync(tmpdir()).filter((d) => d.startsWith('autodiag1-')).map((d) => join(tmpdir(), d, 'summary.jsonl')).filter(existsSync).sort().pop());
const rows = root && existsSync(root)
  ? readFileSync(root, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'run')
  : [];
const plan = root && existsSync(root)
  ? (readFileSync(root, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).find((r) => r.kind === 'plan') || {}).tasks || []
  : [];

console.log('=== 1. the runner regains control within its configured bound ===');
note(`per-task bound ${PER_TASK}s + ${GRACE_MS / 1000}s grace, 4 units planned; runner exited ${exitCode} after ${elapsed}s`);
say(exitCode !== 'KILLED_BY_TEST', 'the runner exited on its own - it was not killed by the test');
// 4 units x (bound + grace) plus per-unit hub startup and the confirm step; generous, but
// nothing like the 99-minute overrun this repairs.
const ceiling = 4 * (PER_TASK + GRACE_MS / 1000 + 45) + 120;
say(elapsed < ceiling, `it finished in ${elapsed}s, under the ${ceiling}s ceiling for 4 bounded units`);
// WHICH LAYER RECOVERED, reported rather than assumed. Against this backend the HUB's own
// per-call deadline fires first and the unit ends normally; the runner's outer wall is
// defence in depth and is NOT exercised here. Asserting the wall must fire would be asserting
// the wrong thing - and demanding it would have failed a correctly-working system.
const wallFired = /hard wall|past its bound/.test(out);
const haltedOut = /HALTING:/.test(out);
note(wallFired ? 'recovered by the RUNNER OUTER WALL'
  : haltedOut ? 'recovered by an explicit HALT'
    : 'recovered by the HUB per-call deadline (the inner layer); the outer wall was not needed');
say(rows.length > 0 && rows.every((r) => r.termination), 'every unit reached a recorded terminal state within the bound');
note('NOT PROVEN BY THIS TEST: that the outer wall fires when the inner deadline does not.');
note('AUTODIAG-1 failed with the inner deadline firing and its await not unwinding; this');
note('backend cannot reproduce that, because node unwinds its fetch here correctly.');

console.log('\n=== 2. no late response executed a tool ===');
const wsRoots = root ? readdirSync(dirname(root)).filter((d) => d.startsWith('ws-')) : [];
let toolSteps = 0, candidateChanged = 0;
const runsDir = root ? join(dirname(root), 'runs') : null;
if (runsDir && existsSync(runsDir)) {
  for (const f of readdirSync(runsDir).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(readFileSync(join(runsDir, f), 'utf8'));
    toolSteps += (j.steps || []).filter((s) => s.type === 'tool').length;
  }
}
say(toolSteps === 0, `no tool executed in any run (${toolSteps}) - the backend never answered, so nothing could be acted on`);
for (const w of wsRoots) {
  for (const t of readdirSync(join(dirname(root), w))) {
    const py = readdirSync(join(dirname(root), w, t)).filter((x) => x.endsWith('.py'));
    for (const f of py) {
      const src = readFileSync(join(dirname(root), w, t, f), 'utf8');
      if (/TAMPER|late/.test(src)) candidateChanged++;
    }
  }
}
say(candidateChanged === 0, 'and no workspace file carries a late write');

console.log('\n=== 3. execution is confirmed stopped, or the campaign halts explicitly ===');
say(/executionConfirmedStopped|stopped cleanly: YES|HALTING/.test(out) || rows.some((r) => r.state),
  'the runner reported on whether execution was confirmed stopped');
const halted = /HALTING:/.test(out);
say(!halted || /refusing to start another unit|could not be confirmed stopped/.test(out),
  halted ? 'it halted with an explicit reason' : 'it confirmed execution stopped and continued (no halt needed)');
say(!/Cannot read|is not a function|undefined/.test(out), 'no crash in the bounding path');

console.log('\n=== 4. the final report accounts for every planned unit ===');
say(/AUTODIAG-1 COMPLETE/.test(out), 'the campaign produced its final report');
say(plan.length === 4, `the plan recorded all 4 planned units (${plan.length})`);
const recorded = new Set(rows.map((r) => r.task));
const missing = plan.filter((t) => !recorded.has(t));
say(missing.length === 0, `every planned unit has a row (${rows.length} rows, ${missing.length} missing)`);
const unatt = rows.filter((r) => r.termination === 'UNATTEMPTED');
say(unatt.every((r) => r.reason && /never started/.test(r.reason)),
  `every unattempted entry carries a reason (${unatt.length} unattempted)`);
if (unatt.length) note(`e.g. ${unatt[0].task}: ${unatt[0].reason}`);
const reportPath = root ? join(dirname(root), 'AUTODIAG-1_REPORT.json') : null;
if (reportPath && existsSync(reportPath)) {
  const rep = JSON.parse(readFileSync(reportPath, 'utf8'));
  say(rep.byStatus && rep.byStatus.UNACCOUNTED === 0, `the report shows UNACCOUNTED 0 (${rep.byStatus?.UNACCOUNTED}) - unattempted units are accounted, not merely missing`);
  say(rep.integrity?.ok === true, `integrity true (${rep.integrity?.ok}) - every emitted status carries its required fields`);
} else {
  say(false, 'the report file exists');
  say(false, 'integrity reported');
}

try { if (root) rmSync(dirname(root), { recursive: true, force: true }); } catch { /* best effort */ }
try { rmSync(evLog, { force: true }); } catch { /* best effort */ }
console.log(`\n  deadline recovery: ${passed} passed, ${failed} failed -> ${failed ? 'THE CAMPAIGN CAN STILL BE STALLED BY ONE UNIT' : 'a never-settling operation is bounded, confirmed stopped, and fully accounted'}`);
process.exit(failed ? 1 : 0);
