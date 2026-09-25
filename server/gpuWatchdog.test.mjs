/**
 * gpuWatchdog.test.mjs - the external shutdown guarantee, exercised without a GPU.
 *
 *   node server/gpuWatchdog.test.mjs
 *
 * The real `modal` CLI is replaced by fakeModal.mjs (MODAL_CMD); the watchdog itself, its
 * triggers, its verification loop, its retries, its bounds and its detach path are the real
 * code. Five situations:
 *
 *   1. COMPLETION   the campaign writes its DONE file -> stop issued within one poll, stopped
 *                   state OBSERVED, exit 0, and the log carries when it was observed
 *   2. DEADLINE     no DONE file ever -> stop issued at the deadline, confirmed, exit 0
 *   3. TRANSIENT    the first stop call fails -> it is retried, then confirmed
 *   4. NEVER STOPS  stop "succeeds" but the app stays deployed -> exit 3 UNCONFIRMED within
 *                   the bound, retries exhausted, never reported as stopped
 *   5. ORPHANED     launched --detach from a parent that exits immediately -> the watchdog
 *                   still fires at its deadline and confirms, with no parent alive
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// JSON form: the node binary's path carries a space on Windows ("Program Files").
const MODAL_CMD = JSON.stringify([process.execPath, join(HERE, 'fakeModal.mjs')]);
const dirs = [];
function scene(name, state = {}) {
  const dir = mkdtempSync(join(tmpdir(), `wd-${name}-`)); dirs.push(dir);
  const stateFile = join(dir, 'state.json');
  writeFileSync(stateFile, JSON.stringify({ app: 'legasus-7b', state: 'deployed', stopCalls: 0, listCalls: 0, ...state }), 'utf8');
  return { dir, stateFile, modalLog: join(dir, 'modal.jsonl'), log: join(dir, 'watchdog.log'), sentinel: join(dir, 'DONE') };
}
function run(sc, args, { extraEnv = {}, killAfterMs = 120_000 } = {}) {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn(process.execPath, [join(HERE, 'gpuWatchdog.mjs'), '--app', 'legasus-7b', '--log', sc.log, ...args], {
      env: { ...process.env, MODAL_CMD, FAKE_MODAL_STATE: sc.stateFile, FAKE_MODAL_LOG: sc.modalLog, ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
    const t = setTimeout(() => { try { p.kill('SIGKILL'); } catch {} resolve({ code: 'KILLED_BY_TEST', out, p }); }, killAfterMs);
    p.on('exit', (code) => { clearTimeout(t); resolve({ code, out, p }); });
  });
}
const events = (sc) => existsSync(sc.log) ? readFileSync(sc.log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const modalCalls = (sc) => existsSync(sc.modalLog) ? readFileSync(sc.modalLog, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const state = (sc) => JSON.parse(readFileSync(sc.stateFile, 'utf8'));

try {
  console.log('=== 1. completion: the DONE file triggers the stop, stopped state is OBSERVED ===');
  {
    const sc = scene('done');
    const t0 = Date.now();
    const pr = run(sc, ['--deadline-sec', '300', '--sentinel', sc.sentinel, '--poll-sec', '0.5', '--verify-sec', '20']);
    await sleep(2500);
    say(state(sc).stopCalls === 0, 'before the DONE file, no stop has been issued');
    writeFileSync(sc.sentinel, JSON.stringify({ completedAt: new Date().toISOString() }), 'utf8');
    const tDone = Date.now();
    const r = await pr;
    const ev = events(sc);
    const stopEv = ev.find((e) => e.event === 'stop_issued');
    const conf = ev.find((e) => e.event === 'CONFIRMED_STOPPED');
    say(r.code === 0, `exit 0 (${r.code})`);
    say(ev.some((e) => e.event === 'trigger' && e.trigger === 'sentinel'), 'trigger recorded as the sentinel, not the deadline');
    say(!!stopEv && Date.parse(stopEv.at) - tDone < 3000, `stop issued ${stopEv ? Date.parse(stopEv.at) - tDone : '?'}ms after the DONE file appeared (bound 3000ms; one poll is 500ms)`);
    say(state(sc).state === 'stopped' && state(sc).stopCalls === 1, 'the fake app is stopped after exactly one stop call');
    say(!!conf && conf.state === 'stopped' && !!conf.stopped_at, 'CONFIRMED_STOPPED carries the observed state and Modal\'s stopped_at');
    say(!!conf && Date.parse(conf.at) >= Date.parse(stopEv.at), 'confirmation is timestamped at or after the stop');
    say(modalCalls(sc).some((c) => c.cmd === 'stop' && c.yes), 'the stop was issued with --yes (a prompt would abort non-interactively)');
    note(`total ${Date.now() - t0}ms`);
  }

  console.log('\n=== 2. deadline: no DONE file ever, the stop fires at the deadline ===');
  {
    const sc = scene('deadline');
    const t0 = Date.now();
    const r = await run(sc, ['--deadline-sec', '3', '--sentinel', sc.sentinel, '--poll-sec', '0.5', '--verify-sec', '20']);
    const ev = events(sc);
    const trig = ev.find((e) => e.event === 'trigger');
    say(r.code === 0, `exit 0 (${r.code})`);
    say(!!trig && trig.trigger === 'deadline', 'trigger recorded as the deadline');
    say(!!trig && Date.parse(trig.at) - t0 >= 2900 && Date.parse(trig.at) - t0 < 6000, `fired ${trig ? Date.parse(trig.at) - t0 : '?'}ms after start for a 3s deadline`);
    say(state(sc).state === 'stopped', 'the app is stopped');
    say(ev.some((e) => e.event === 'CONFIRMED_STOPPED'), 'and that was observed, not assumed');
  }

  console.log('\n=== 3. transient failure: the first stop call fails, the watchdog retries ===');
  {
    const sc = scene('transient', { failStopsBefore: 2 });
    const r = await run(sc, ['--deadline-sec', '1', '--poll-sec', '0.3', '--verify-sec', '2', '--stop-retries', '3']);
    const ev = events(sc);
    const stops = ev.filter((e) => e.event === 'stop_issued');
    say(r.code === 0, `exit 0 (${r.code})`);
    say(stops.length === 2 && stops[0].code !== 0 && stops[1].code === 0, `two stop attempts: first failed (code ${stops[0]?.code}), second succeeded (code ${stops[1]?.code})`);
    say(ev.some((e) => e.event === 'not_observed_stopped' && e.attempt === 1), 'the failed attempt was logged as not observed stopped, with its attempt number');
    say(ev.some((e) => e.event === 'CONFIRMED_STOPPED' && e.attempt === 2), 'confirmation names the attempt that worked');
  }

  console.log('\n=== 4. never stops: reported UNCONFIRMED within the bound, never as stopped ===');
  {
    const sc = scene('never', { neverStops: true });
    const t0 = Date.now();
    const r = await run(sc, ['--deadline-sec', '1', '--poll-sec', '0.3', '--verify-sec', '2', '--stop-retries', '2']);
    const ev = events(sc);
    say(r.code === 3, `exit 3 UNCONFIRMED (${r.code})`);
    say(ev.filter((e) => e.event === 'stop_issued').length === 2, 'exactly the configured number of stop attempts');
    say(!ev.some((e) => e.event === 'CONFIRMED_STOPPED'), 'CONFIRMED_STOPPED never appears');
    const last = ev[ev.length - 1];
    say(last && last.event === 'UNCONFIRMED' && last.lastState?.state === 'deployed', 'the final line says UNCONFIRMED and carries the last observed state (deployed)');
    say(Date.now() - t0 < 15_000, `bounded: finished in ${Date.now() - t0}ms (1s deadline + 2 x 2s verify + overhead)`);
  }

  console.log('\n=== 5. orphaned: --detach from a parent that exits at once; the watchdog still fires ===');
  {
    const sc = scene('orphan');
    const launch = execFileSync(process.execPath, [join(HERE, 'gpuWatchdog.mjs'), '--app', 'legasus-7b', '--log', sc.log,
      '--deadline-sec', '3', '--poll-sec', '0.5', '--verify-sec', '20', '--detach'],
    { env: { ...process.env, MODAL_CMD, FAKE_MODAL_STATE: sc.stateFile, FAKE_MODAL_LOG: sc.modalLog }, windowsHide: true, timeout: 20_000 }).toString();
    const pid = +(launch.match(/pid (\d+)/) || [])[1];
    say(Number.isInteger(pid) && pid > 0, `parent printed the detached pid (${pid}) and exited`);
    // The parent is gone (execFileSync returned). Wait past the deadline and look at the log.
    let ev = [];
    for (let i = 0; i < 40; i++) { await sleep(500); ev = events(sc); if (ev.some((e) => e.event === 'CONFIRMED_STOPPED' || e.event === 'UNCONFIRMED')) break; }
    say(ev.some((e) => e.event === 'start' && e.pid === pid), 'the detached child logged its start under the printed pid');
    say(ev.some((e) => e.event === 'trigger' && e.trigger === 'deadline'), 'it reached its deadline with no parent alive');
    say(ev.some((e) => e.event === 'CONFIRMED_STOPPED'), 'and confirmed the stop');
    say(state(sc).state === 'stopped', 'the app is stopped');
    const lines = existsSync(sc.log) ? readFileSync(sc.log, 'utf8').trim().split('\n') : [];
    const starts = lines.filter((l) => l.includes('"event":"start"')).length;
    say(starts === 1, `each event is written to the log once, not twice (${starts} start line(s))`);
  }
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  gpuWatchdog: ${passed} passed, ${failed} failed -> ${failed ? 'THE SHUTDOWN GUARANTEE IS NOT ESTABLISHED' : 'stops on completion or deadline, observes the stopped state, reports what it could not observe, survives its parent'}`);
process.exit(failed ? 1 : 0);
