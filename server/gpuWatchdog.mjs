/**
 * gpuWatchdog.mjs - a BOUNDED, EXTERNAL guarantee that the GPU app gets stopped.
 *
 *   node server/gpuWatchdog.mjs --app legasus-7b --deadline-sec 16200 \
 *        [--sentinel <file the campaign writes when COMPLETE>] [--log <file>] \
 *        [--poll-sec 15] [--verify-sec 600] [--stop-retries 3] [--detach]
 *
 * WHY THIS EXISTS. After AUTODIAG-2 the scripted `modal app stop` in the launch job ran ~5
 * minutes after the campaign printed COMPLETE, because it waited on the client process
 * exiting. This process does NOT wait on anything the campaign does after completion: it stops
 * the app when the campaign's DONE file appears, or when its own deadline passes, whichever is
 * first - and it says, with a clock, whether the stopped state was OBSERVED.
 *
 * WHAT IT GUARANTEES, AND WHAT IT DOES NOT.
 *   - It issues the stop within one poll interval of the trigger, and re-issues it up to
 *     --stop-retries times if the stopped state is not observed within --verify-sec.
 *   - Exit 0 means `app list --json` REPORTED the app stopped, and the log carries the time
 *     at which that was observed. Exit 3 means it did NOT, within the bound - a state to act
 *     on, never to assume away. Exit 4 means the watchdog's own hard cap was reached.
 *   - It cannot make billing stop at any particular second; Modal's own record is the
 *     authority. It cannot survive the machine sleeping or losing power.
 *
 * --detach re-launches this script as a detached child writing to --log and exits, so the
 * watchdog outlives the shell that started it and the campaign it watches. The child's pid is
 * printed. MODAL_CMD overrides the CLI (default "python -m modal"); tests point it at
 * fakeModal.mjs.
 */
import { spawn, execFile } from 'node:child_process';
import { existsSync, appendFileSync, openSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const APP = opt('app', null);
const DEADLINE_SEC = parseInt(opt('deadline-sec', ''), 10);
const SENTINEL = opt('sentinel', null);
const LOG = opt('log', null);
const POLL_MS = Math.max(200, parseFloat(opt('poll-sec', '15')) * 1000);
const VERIFY_MS = Math.max(1000, parseFloat(opt('verify-sec', '600')) * 1000);
const RETRIES = Math.max(1, parseInt(opt('stop-retries', '3'), 10));
if (!APP || !Number.isFinite(DEADLINE_SEC)) { console.error('usage: gpuWatchdog.mjs --app <name> --deadline-sec <n> [--sentinel f] [--log f] [--poll-sec n] [--verify-sec n] [--stop-retries n] [--detach]'); process.exit(2); }

if (argv.includes('--detach')) {
  const args = argv.filter((a) => a !== '--detach');
  const out = LOG ? openSync(LOG, 'a') : 'ignore';
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args], {
    detached: true, stdio: ['ignore', out, out], windowsHide: true,
    // The child's stdout IS the log file, so it must not also append to it.
    env: { ...process.env, GPU_WATCHDOG_STDOUT_IS_LOG: LOG ? '1' : '' },
  });
  child.unref();
  console.log(`gpuWatchdog detached pid ${child.pid} app ${APP} deadline ${DEADLINE_SEC}s log ${LOG || '(none)'}`);
  process.exit(0);
}

// MODAL_CMD: either words separated by spaces ("python -m modal") or a JSON array for paths
// that contain spaces (["C:\\Program Files\\nodejs\\node.exe", "server/fakeModal.mjs"]).
const MODAL = (() => {
  const raw = process.env.MODAL_CMD || 'python -m modal';
  if (raw.trim().startsWith('[')) return JSON.parse(raw);
  return raw.split(' ').filter(Boolean);
})();
const T0 = Date.now();
const DEADLINE_AT = T0 + DEADLINE_SEC * 1000;
// The watchdog's OWN cap: trigger at the latest by the deadline, then every retry may spend
// a verify window plus the stop call itself. Past that it exits 4 rather than living forever.
const HARD_CAP_AT = DEADLINE_AT + RETRIES * (VERIFY_MS + 120_000) + 60_000;

// When detached, stdout IS the log file (opened above), so the line is not written twice.
const DETACHED_CHILD = process.env.GPU_WATCHDOG_STDOUT_IS_LOG === '1';
const say = (event, extra = {}) => {
  const line = JSON.stringify({ at: new Date().toISOString(), t: Math.round((Date.now() - T0) / 1000), event, ...extra });
  console.log(line);
  if (LOG && !DETACHED_CHILD) { try { appendFileSync(LOG, line + '\n'); } catch { /* the console line still stands */ } }
};

const modal = (args, timeoutMs = 120_000) => new Promise((resolve) => {
  execFile(MODAL[0], [...MODAL.slice(1), ...args], { timeout: timeoutMs, windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 4 << 20 },
    (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, stdout: String(stdout || ''), stderr: String(stderr || ''), timedOut: !!(err && err.killed) }));
});

/** The app's state as Modal reports it: 'stopped' | 'deployed' | ... | 'absent' | 'unknown'. */
async function observedState() {
  const r = await modal(['app', 'list', '--json'], 60_000);
  if (r.code !== 0) return { state: 'unknown', detail: (r.stderr || r.stdout).trim().slice(0, 200) };
  try {
    const apps = JSON.parse(r.stdout);
    const a = apps.find((x) => x.description === APP);
    if (!a) return { state: 'absent' };
    return { state: a.state, tasks: a.tasks, stopped_at: a.stopped_at || null };
  } catch (e) { return { state: 'unknown', detail: `unparseable app list: ${String(e.message).slice(0, 100)}` }; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

say('start', { app: APP, pid: process.pid, deadlineSec: DEADLINE_SEC, sentinel: SENTINEL, pollMs: POLL_MS, verifyMs: VERIFY_MS, retries: RETRIES, modal: MODAL.join(' ') });
say('state_before', await observedState());

// PHASE 1: wait for the trigger. Nothing here depends on the campaign process exiting.
let trigger = null;
while (!trigger) {
  if (SENTINEL && existsSync(SENTINEL)) trigger = 'sentinel';
  else if (Date.now() >= DEADLINE_AT) trigger = 'deadline';
  else await sleep(Math.min(POLL_MS, Math.max(50, DEADLINE_AT - Date.now())));
}
say('trigger', { trigger });

// PHASE 2: stop, then OBSERVE stopped. Repeat, bounded.
let confirmed = null;
for (let attempt = 1; attempt <= RETRIES && !confirmed; attempt++) {
  if (Date.now() >= HARD_CAP_AT) break;
  const r = await modal(['app', 'stop', '--yes', APP]);
  say('stop_issued', { attempt, code: r.code, timedOut: r.timedOut, out: (r.stdout + r.stderr).trim().slice(0, 200) });
  const until = Math.min(Date.now() + VERIFY_MS, HARD_CAP_AT);
  while (Date.now() < until) {
    const s = await observedState();
    if (s.state === 'stopped' || s.state === 'absent') { confirmed = { attempt, ...s }; break; }
    await sleep(POLL_MS);
  }
  if (!confirmed) say('not_observed_stopped', { attempt, lastState: await observedState() });
}
if (confirmed) { say('CONFIRMED_STOPPED', confirmed); process.exit(0); }
if (Date.now() >= HARD_CAP_AT) { say('UNCONFIRMED_HARD_CAP', { lastState: await observedState() }); process.exit(4); }
say('UNCONFIRMED', { attempts: RETRIES, lastState: await observedState() });
process.exit(3);
