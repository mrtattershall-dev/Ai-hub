/**
 * stopApp.test.mjs - the stop helper, proven against a fake `modal` CLI.
 *
 *   node training-data/factory/stopApp.test.mjs
 *
 * NEVER touches a real Modal account: every case injects its own runner. A test for a tool
 * that stops GPUs must not be able to stop one. And NEVER writes the real COORD: the alarm
 * file is pointed at a scratch path below, before any stop is attempted, so even a case that
 * forgot to inject its own alarm lands in scratch.
 *
 * The cases are the failure modes, not the happy path. Rule 7 exists because a stop failed
 * quietly - first because it asked a question nobody could answer, then because the failure
 * it logged was read by nobody, and then a correct stop reported another app's stop time. So
 * what matters is that each way of failing is RETRIED where that can help, ALARMED where it
 * cannot, and REPORTED about the app it actually stopped.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'stopapp-'));
process.env.STOPAPP_ALARM_FILE = join(scratch, 'ALARMS.md');

const { stopApp, appsNamed, defaultAlarm } = await import('./stopApp.mjs');

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; }
  catch (e) { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; }
};

const NAME = 'coder14b-base';
const app = (state, stopped_at = null, description = NAME, app_id = 'ap-new', created_at = '2026-09-10 21:50') =>
  ({ app_id, description, state, tasks: state === 'deployed' ? '1' : '0', created_at, stopped_at });

/**
 * A fake `python -m modal`. `before` answers the list read taken BEFORE the stop; `stops`
 * answers each successive stop (the last repeats); `lists` answers each successive list read
 * AFTER the stop (the last repeats).
 */
function fakeModal({ before, stops, lists, listCode = 0 }) {
  const calls = [];
  let s = 0;
  let listReads = 0;
  const run = async (args) => {
    calls.push(args);
    if (args[1] === 'stop') return stops[Math.min(s++, stops.length - 1)];
    const out = listReads++ === 0 && before !== undefined ? before : lists[Math.min(listReads - (before !== undefined ? 2 : 1), lists.length - 1)];
    return { code: listCode, out: typeof out === 'string' ? out : JSON.stringify(out), err: listCode ? 'list failed' : '' };
  };
  run.calls = calls;
  run.stopCalls = () => calls.filter((c) => c[1] === 'stop');
  return run;
}
function harness() {
  const alarms = [];
  return { alarms, opts: { retries: 3, waitMs: 0, stopRetries: 3, alarm: (n, r) => alarms.push({ n, r }) } };
}
const ABORT = { code: 1, out: '', err: 'Are you sure? [y/N]: Aborted!' };   // the 2026-09-10 incident
const OK = { code: 0, out: '', err: '' };
const LIVE = [app('deployed')];

await test('EVERY stop attempt carries --yes, retries included', async () => {
  const { opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [ABORT, ABORT, OK], lists: [LIVE, LIVE, [app('stopped', 't')]] });
  await stopApp(NAME, { run, ...opts });
  assert.ok(run.stopCalls().length >= 2, 'expected the retry path to be exercised');
  for (const c of run.stopCalls()) assert.deepEqual(c, ['app', 'stop', '--yes', NAME]);
});

await test('a clean stop confirmed by the list succeeds, with ITS stop time, and raises NO alarm', async () => {
  const { alarms, opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [OK], lists: [[app('stopped', '2026-09-10 22:01:49')]] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, true);
  assert.equal(r.stoppedAt, '2026-09-10 22:01:49');
  assert.deepEqual(r.appIds, ['ap-new']);
  assert.equal(alarms.length, 0);
});

// ---- the report must be about the app THIS call stopped (Session A, 2026-09-10) ---------

const OLD = app('stopped', '2026-09-10 21:10:17', NAME, 'ap-old', '2026-09-10 20:33');

await test('SESSION A\'S CASE: an earlier same-named record never supplies the stop time', async () => {
  const { opts } = harness();
  const run = fakeModal({
    before: [OLD, app('deployed')],
    stops: [OK],
    lists: [[OLD, app('stopped', '2026-09-10 22:01:49')]],
  });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, true);
  assert.equal(r.stoppedAt, '2026-09-10 22:01:49', `reported the earlier app's stop: ${r.stoppedAt}`);
});

await test('while Modal has not written stopped_at yet, it waits rather than borrow the old record\'s', async () => {
  // The likely mechanism of the real report: the new record reads 'stopped' before its
  // stopped_at is set, and the only timestamp on offer belongs to the previous run.
  const { opts } = harness();
  const run = fakeModal({
    before: [OLD, app('deployed')],
    stops: [OK],
    lists: [[OLD, app('stopped', null)], [OLD, app('stopped', '2026-09-10 22:01:49')]],
  });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.stoppedAt, '2026-09-10 22:01:49');
});

await test('if Modal never records it, the report says so and gives NONE - it does not guess', async () => {
  const { opts } = harness();
  const run = fakeModal({ before: [OLD, app('deployed')], stops: [OK], lists: [[OLD, app('stopped', null)]] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, true, 'the stop itself was confirmed');
  assert.equal(r.stoppedAt, null);
  assert.match(r.detail, /had not yet recorded stopped_at/);
});

await test('an already-stopped name reports the LATEST run\'s stop, not the earliest', async () => {
  const { opts } = harness();
  const latest = app('stopped', '2026-09-10 22:01:49', NAME, 'ap-new', '2026-09-10 21:50');
  const run = fakeModal({ before: [OLD, latest], stops: [{ code: 1, out: '', err: 'not running' }], lists: [[OLD, latest]] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, true);
  assert.equal(r.stoppedAt, '2026-09-10 22:01:49');
  assert.match(r.detail, /already stopped/);
});

// ---- failures: retried where that helps, alarmed where it does not ----------------------

await test('THE INCIDENT: a stop that keeps failing is retried, then ALARMED - not merely logged', async () => {
  const { alarms, opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [ABORT], lists: [LIVE] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'stop');
  assert.equal(r.stillDeployed, 1);
  assert.equal(run.stopCalls().length, opts.stopRetries + 1, 'retries must be bounded');
  // The 2026-09-10 watchdog wrote "stop exit 1" to a log nobody read. This is the difference.
  assert.equal(alarms.length, 1, 'a failed stop must raise the alarm exactly once');
  assert.equal(alarms[0].n, NAME);
});

await test('a transient failure that clears on retry succeeds and raises no alarm', async () => {
  const { alarms, opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [ABORT, OK], lists: [LIVE, [app('stopped', 't')]] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, true);
  assert.equal(r.stopAttempts, 2);
  assert.match(r.detail, /attempt 2/);
  assert.equal(alarms.length, 0);
});

await test('a list that lags behind a real stop succeeds once it catches up', async () => {
  const { alarms, opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [OK], lists: [LIVE, LIVE, [app('stopped', 't')]] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, true);
  assert.equal(alarms.length, 0);
});

await test('exit 0 is NOT enough: still deployed after every re-list is a failure, and alarmed', async () => {
  const { alarms, opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [OK], lists: [LIVE] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'verify');
  assert.match(r.detail, /exited 0 but the app list still shows it deployed/);
  assert.equal(alarms.length, 1);
});

await test('A TYPO IS A FAILURE: no app by that name must never read as "stopped"', async () => {
  // The dangerous case: "nothing named coder14b-bse is deployed" is true, and the real app bills.
  const { alarms, opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [OK], lists: [LIVE] });
  const r = await stopApp('coder14b-bse', { run, ...opts });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'input');
  assert.match(r.detail, /no app named "coder14b-bse"/);
  assert.equal(alarms.length, 1);
});

await test('an unreadable app list is a failure, not a pass', async () => {
  const { alarms, opts } = harness();
  const run = fakeModal({ before: 'not json', stops: [OK], lists: ['not json'] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'verify');
  assert.equal(alarms.length, 1);
});

await test('an unreadable list BEFORE the stop does not stop the stop', async () => {
  // Stopping the GPU matters more than a precise report about it.
  const { opts } = harness();
  const run = fakeModal({ before: 'not json', stops: [OK], lists: [[app('stopped', 't')]] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(run.stopCalls().length, 1);
  assert.equal(r.ok, true);
});

await test('one of two same-named apps still deployed means the stop did not finish', async () => {
  // The app history keeps old entries under the same name, so every one has to be down.
  const { alarms, opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [OK], lists: [[app('stopped', 't', NAME, 'ap-a'), app('deployed', null, NAME, 'ap-b')]] });
  const r = await stopApp(NAME, { run, ...opts });
  assert.equal(r.ok, false);
  assert.equal(alarms.length, 1);
});

await test('a missing name is refused before anything is run, and alarmed', async () => {
  const { alarms, opts } = harness();
  const run = fakeModal({ before: [], stops: [OK], lists: [[]] });
  const r = await stopApp('', { run, ...opts });
  assert.equal(r.ok, false);
  assert.equal(run.calls.length, 0);
  assert.equal(alarms.length, 1);
});

// ---- the name must be matched EXACTLY, from --json (ai-native-engine-00's cases) --------

await test('a same-prefix neighbour being stopped does not count: the TARGET must be down', async () => {
  const { alarms, opts } = harness();
  const pair = [app('deployed', null, 'coder14b-base', 'ap-1'), app('stopped', 't', 'coder14b-base-v2', 'ap-2')];
  const run = fakeModal({ before: pair, stops: [OK], lists: [pair] });
  const r = await stopApp('coder14b-base', { run, ...opts });
  assert.equal(r.ok, false, 'reported stopped because a DIFFERENT same-prefix app is stopped');
  assert.equal(alarms.length, 1);
});

await test('a prefix is not a name: "coder14b" must not match "coder14b-base"', async () => {
  const { opts } = harness();
  const run = fakeModal({ before: LIVE, stops: [OK], lists: [LIVE] });
  const r = await stopApp('coder14b', { run, ...opts });
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'input', 'a prefix must read as an unknown name, not as a match');
});

await test('table-shaped output is refused, never guessed at', () => {
  // What `modal app list` prints WITHOUT --json: box-drawing, and truncated names.
  const table = [
    '| App ID                    | Description | State    | Tasks |',
    '|---------------------------+-------------+----------+-------|',
    '| ap-0fcSgmG58W9sINBRIL7pFg | coder14b-ba… | deployed | 1     |',
  ].join('\n');
  assert.equal(appsNamed(table, 'coder14b-base'), null);
});

await test('the default alarm lands in the alarm file - and that file is scratch, not COORD', async () => {
  defaultAlarm(NAME, { stage: 'stop', detail: 'test detail' });
  const written = readFileSync(process.env.STOPAPP_ALARM_FILE, 'utf8');
  assert.match(written, /## ALARM \(stopApp\)/);
  assert.match(written, /GPU MAY STILL BE BILLING: stop of "coder14b-base" FAILED \(stop\)/);
  assert.match(written, /stopApp\.mjs coder14b-base/);
  assert.ok(!process.env.STOPAPP_ALARM_FILE.endsWith('COORD.md'));
});

await test('appsNamed reads the list and rejects anything that is not one', () => {
  assert.equal(appsNamed(JSON.stringify([app('stopped')]), NAME).length, 1);
  assert.equal(appsNamed('garbage', NAME), null);
  assert.equal(appsNamed(JSON.stringify({ not: 'a list' }), NAME), null);
});

rmSync(scratch, { recursive: true, force: true });
console.log(`stopApp: ${passed} passed`);
