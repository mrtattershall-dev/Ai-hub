/**
 * fullAgent.mjs - a long unattended run against a REAL model.
 *
 *   MODEL_BASE=https://…modal.run node server/fullAgent.mjs [minutes]
 *
 * Everything else here replaces the model with a script I wrote, which means the harness
 * and its expectations share an author and agreement between them proves very little. A
 * real model does what it actually does. So this is a RUN, not a test: it reports what
 * happened and asserts almost nothing, because five of my harnesses lied today and every
 * one of them lied in the reassuring direction.
 *
 * Mixed goals on purpose - game and non-game alternating, so both planner branches run
 * repeatedly rather than once - and the supervisor TICK is on, which has never executed
 * against a real model: stale approvals denied, interrupted runs resumed, queued work
 * picked up while idle.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, existsSync, statSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.MODEL_BASE || '').replace(/\/+$/, '');
if (!BASE) { console.error('set MODEL_BASE'); process.exit(2); }
const MINUTES = parseFloat(process.argv[2] || '45');
const PORT = 5500 + Math.floor(Math.random() * 200);
const API = `http://127.0.0.1:${PORT}/api`;

const dir = mkdtempSync(join(tmpdir(), 'fullagent-'));
const ws = join(dir, 'workspace');
writeFileSync(join(dir, 'hub.json'), JSON.stringify({
  api_keys: { ollama: { base_url: BASE, model: process.env.MODEL_NAME || 'mycoder' } },
  history: [], settings: {},
}), 'utf8');

const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: {
    ...process.env, PORT: String(PORT), HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'), AGENT_RUNS_DIR: join(dir, 'runs'), RUN_INDEX: process.env.TRIAL_INDEX || join(dir, 'run-index.jsonl'),
    // The hourly auto-start ceiling defaults to 12. It was added after a real runaway
    // (40 runs in 60 SECONDS) and it works, but it cannot tell "a loop repeating itself"
    // from "a lot of distinct work": at ~130 tok/s a goal takes ~20s, so 12/hour throttles
    // legitimate batches to one goal every five minutes. Measured just now - 13 goals in
    // five minutes hit the cap and 17 sat queued for the rest of the hour.
    // The runaway case is already covered by the generation cap and queue dedup.
    AGENT_MAX_AUTO_STARTS: process.env.AGENT_MAX_AUTO_STARTS || '400',
    AGENT_SUPERVISOR: '1', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_TICK_S: '30', AGENT_APPROVAL_TIMEOUT_MIN: '2',
    AGENT_MAX_STEPS: '30', AGENT_MAX_MINUTES: '10',
    MODEL_FIRST_BYTE_S: '600', MODEL_STALL_S: '90', MODEL_TIMEOUT_S: '1800',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let died = null;
const log = [];
hub.stdout.on('data', (d) => log.push(d.toString()));
hub.stderr.on('data', (d) => log.push(d.toString()));

// ---------------------------------------------------------------------------
// SUMMARY DURABILITY
//
// A real 20-minute run printed its header, ONE 30-second sample, and then ended
// reporting exit code 0. The '--- result ---' block used to live at the very bottom
// of this file, so it was only reachable by falling off the end of the sampler loop
// normally - which meant queue end state, run statuses, tok/s and tick counts were
// all lost, even though the work itself was sitting on disk the whole time. And
// exit 0 made a dead run look like a finished one.
//
// The lesson is not "find what killed the loop". It is that a summary you only get
// when nothing goes wrong is not a summary. So: it is a function, it is idempotent,
// it is SYNCHRONOUS (so it can also run inside process.on('exit'), where no promise
// will ever settle), it goes to a FILE as well as stdout, and every exit path calls
// it - normal end, Ctrl-C, an outside kill, an uncaught throw, or the hub dying.
const t0 = Date.now();
const SUMMARY_FILE = join(dir, 'summary.txt');

// emit() cannot ask the hub anything - an 'exit' handler gets no async turns - so the
// sampler leaves its last answers here and emit() reports those plus how stale they
// are. Stale-but-present beats fresh-but-lost; the whole point of this exercise.
const snap = { at: null, queue: [], runs: [], files: [] };
const readFiles = () => { try { return existsSync(ws) ? readdirSync(ws).filter((f) => f !== '.git') : []; } catch { return []; } };

const build = (reason) => {
  const txt = log.join('');
  const rates = (txt.match(/= ([0-9.]+) tok\/s/g) || []).map((m) => parseFloat(m.match(/[0-9.]+/)[0]));
  const prompts = (txt.match(/prompt ~([0-9]+) tok/g) || []).map((m) => parseInt(m.match(/[0-9]+/)[0], 10));
  return [
    '', '--- result ---',
    `reason: ${reason}`,
    `elapsed: ${((Date.now() - t0) / 60000).toFixed(1)} min of ${MINUTES} requested`,
    `hub: ${died ? 'DIED ' + died : 'alive'}`,
    `snapshot: ${snap.at || '(never sampled - numbers below are empty, not zero)'}`,
    `queue: ${snap.queue.join(', ') || '(empty)'}`,
    `runs: ${snap.runs.join(' -> ') || '(none)'}`,
    `files: ${snap.files.join(', ') || '(none)'}`,
    ...(rates.length ? [`tok/s: min ${Math.min(...rates)} max ${Math.max(...rates)} n=${rates.length}`] : []),
    ...(prompts.length ? [`prompt tokens: max ${Math.max(...prompts)}`] : []),
    ...['treated as DENIED', 'Resumed automatically', 'supervisor picked up a queued goal']
      .map((k) => `tick "${k}": ${(txt.match(new RegExp(k, 'g')) || []).length}`),
    `workspace: ${ws}`,
    `summary file: ${SUMMARY_FILE}`,
    '',
  ].join('\n');
};

// Rewritten after EVERY 30s sample, not just at the end. On Windows an outside kill is a
// TerminateProcess: no SIGTERM, no 'exit' handler, nothing of ours runs at all. The only
// defence against that is a file that was already correct before the kill landed, so the
// worst case for an overnight run is losing the last 30 seconds instead of all of it.
const writeSummary = (reason) => { try { writeFileSync(SUMMARY_FILE, build(reason), 'utf8'); } catch {} };

let emitted = false;
const emit = (reason) => {
  if (emitted) return;   // SIGINT emits, then its process.exit() fires 'exit', which would emit again
  emitted = true;
  if (!snap.at) snap.files = readFiles();   // killed before the first sample: still report the files
  const out = build(reason);
  // Both writes are synchronous on purpose. console.log to a pipe is ASYNC on Windows,
  // so anything still queued there is discarded if the process exits underneath it -
  // which is one of the ways this run lost its summary in the first place. The file is
  // the copy that survives even when stdout does not.
  try { writeFileSync(SUMMARY_FILE, out, 'utf8'); } catch {}
  try { writeSync(1, out); } catch {}
  // The hub is a child holding a TCP port. If this harness is killed and we do not take
  // the hub with us, an orphan keeps the port and the next run picks a different random
  // port and quietly talks to nothing. Kill it on EVERY way out, not just the tidy one.
  try { hub.kill(); } catch {}
};

const shutdown = (reason, code) => { emit(reason); process.exit(code); };
process.on('SIGINT', () => shutdown('SIGINT - interrupted', 130));
process.on('SIGTERM', () => shutdown('SIGTERM - killed from outside', 143));
process.on('uncaughtException', (e) => shutdown(`uncaught exception: ${(e && e.stack || String(e)).split('\n')[0]}`, 4));
process.on('unhandledRejection', (e) => shutdown(`unhandled rejection: ${(e && e.message) || String(e)}`, 4));
// The catch-all, and the only one that covers node deciding on its own that it is done:
// when the event loop empties between awaits node exits cleanly, reporting 0, printing
// nothing. That is indistinguishable from success unless something runs here.
process.on('exit', () => emit('process exited without reaching the end of the sampler'));

// ...and this makes that particular exit impossible rather than merely reported. A ref'd
// interval is a standing reason for node to stay alive, so the process can no longer end
// just because an await left the loop with nothing in it - it has to go out through one
// of the handlers above. Cleared before the intended exit so we still end promptly.
const keepAlive = setInterval(() => {}, 15_000);

// The sampler sleeps 30s at a time. If the hub dies during a sleep, waiting out the rest
// of it delays the summary for no reason, so hub death interrupts the sleep.
let wake = null;
hub.on('exit', (c, s) => { died = `code=${c} sig=${s}`; if (wake) wake(); });
const sleep = (ms) => new Promise((r) => {
  const t = setTimeout(() => { wake = null; r(); }, ms);
  wake = () => { clearTimeout(t); wake = null; r(); };
});

const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60_000) })).json();
const refresh = async () => {
  try { snap.queue = ((await api('/agent/queue')).items || []).map((i) => i.status); } catch {}
  try { const l = await api('/agent/list'); snap.runs = (Array.isArray(l) ? l : []).map((r) => r.status); } catch {}
  snap.files = readFiles();
  snap.at = new Date().toISOString();
};

// Printed BEFORE the hub-ready wait, not after it. If this harness is killed during the
// 100-second wait - or its stdout is lost - the human still knows which directory on disk
// to go and read.
console.log(`full agent run: ${MINUTES} min against ${BASE}`);
console.log(`workspace ${ws}`);
console.log(`summary   ${SUMMARY_FILE}   <- written on EVERY exit path, including a kill\n`);

for (let i = 0; i < 400; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await sleep(250); } }
if (died) { emit(`hub never came up: ${died}`); process.exit(3); }

const GOALS = [
  // One goal per SHAPE, cheapest possible proof that a 7B can drive the loop at all.
  // Format compliance on a single prompt is not evidence it holds across creates, edits
  // and multi-site changes - and a 7B is meaningfully weaker than the 30B every earlier
  // number came from.
  'Create p1_calc.js exporting add(a,b) and mul(a,b), with self-checks that throw. Verify with node.',
  'Add sub(a,b) to the EXISTING p1_calc.js, keeping add and mul unchanged. Verify.',
  'In the EXISTING p1_calc.js, change ONLY mul so it throws on non-numeric input. Touch nothing else. Verify.',
  'Add input validation to EVERY function in p1_calc.js that lacks it. Keep the maths. Verify.',
  'Create p2_str.py with a function slug(s) plus asserts at the bottom, and run it with python.',
  'Write P1.md documenting every function that really exists in p1_calc.js. Read the file first.',
];

let prev = null;
for (const goal of GOALS) {
  const r = await api('/agent/queue', { method: 'POST', body: JSON.stringify(prev ? { goal, after: prev } : { goal }) });
  prev = r.item?.id || r.id;
}
const kicked = await api('/agent/queue/run', { method: 'POST', body: JSON.stringify({ id: (await api('/agent/queue')).items[0].id }) }).catch(() => null);
if (!kicked || (!kicked.runId && !kicked.ok)) await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: GOALS[0] }) });

const end = t0 + MINUTES * 60_000;
console.log('  mins  queue(done/open)  runs(done/other)  files  rss(MB)  note');
let lastNote = '';
let allDone = false;
while (Date.now() < end && !died) {
  await sleep(30_000);
  try {
    const q = await api('/agent/queue');
    const items = q.items || [];
    const done = items.filter((i) => i.status === 'done').length;
    // 'stopped' is TERMINAL. Counting it as open made this sampler wait out its entire
    // deadline on a goal that had already failed and been repaired - seventeen minutes of
    // an idle GPU reported as "still working".
    const open = items.filter((i) => !['done', 'failed', 'cancelled', 'stopped'].includes(i.status)).length;
    const list = await api('/agent/list');
    const runs = Array.isArray(list) ? list : [];
    const rdone = runs.filter((r) => r.status === 'done').length;
    const files = readFiles().length;
    // Feed the snapshot every sample. This is what emit() has to work from if the harness
    // is killed a second from now, so it is updated BEFORE anything below can throw.
    snap.queue = items.map((i) => i.status);
    snap.runs = runs.map((r) => r.status);
    snap.files = readFiles();
    snap.at = new Date().toISOString();
    writeSummary('IN PROGRESS - rolling snapshot, the run had not finished when this was written');
    const txt = log.join('');
    const notes = txt.match(/(treated as DENIED|Resumed automatically|supervisor picked up a queued goal)/g) || [];
    const note = notes.length ? `${notes.length} tick action(s): ${[...new Set(notes)].join(' / ')}` : '';
    if (note !== lastNote && note) { lastNote = note; }
    console.log(`  ${String(((Date.now() - t0) / 60000).toFixed(1)).padStart(4)}  ${String(done + '/' + open).padStart(16)}  ${String(rdone + '/' + (runs.length - rdone)).padStart(16)}  ${String(files).padStart(5)}  ${String(process.memoryUsage ? '-' : '-').padStart(7)}  ${note}`);
    if (!open) { allDone = true; console.log('\n  ALL GOALS COMPLETE'); break; }
  } catch (e) { console.log(`  (sample failed: ${e.message.slice(0, 60)})`); }
}

clearInterval(keepAlive);
await refresh();          // one last live read; emit() itself must stay synchronous

const mins = ((Date.now() - t0) / 60000).toFixed(1);
// "No open items" is only a success if the items actually finished. A dead endpoint drains
// the whole queue to 'failed' in seconds, which trips the same ALL GOALS COMPLETE break -
// and reporting that as exit 0 would be the identical lie this fix exists to remove.
const bad = snap.queue.filter((s) => s !== 'done');
if (allDone && !bad.length) {
  emit('all goals complete');
} else if (allDone) {
  emit(`queue drained early: ${snap.queue.length - bad.length} done, ${bad.length} not (${[...new Set(bad)].join(', ')})`);
  writeSync(2, `\nEARLY END: queue drained after ${mins} of ${MINUTES} requested minutes with ${bad.length} item(s) not done (${[...new Set(bad)].join(', ')}). Exiting 3, NOT 0.\n`);
  process.exitCode = 3;
} else if (!died && Date.now() >= end - 1000 && snap.queue.includes('done')) {
  emit(`sampler ran the full ${MINUTES} min`);
} else if (!died && Date.now() >= end - 1000) {
  // Full window, zero goals done. Not an early end, but the same lie in a different shape:
  // against a dead endpoint this sits there for the whole duration and then reports success.
  // A run of this harness exists to show a model doing work; nothing done is a failed run.
  emit(`ran the full ${MINUTES} min with ZERO goals done`);
  writeSync(2, `\nNOTHING TO SHOW: ${MINUTES} min elapsed and not one goal reached 'done' (queue: ${snap.queue.join(', ') || 'empty'}). Exiting 3, NOT 0.\n`);
  process.exitCode = 3;
} else {
  // Exit 0 on an early end is what made a dead 20-minute run read as a successful one:
  // the summary was missing, but nothing SAID anything was wrong. An end before the
  // requested time is a failure and has to announce itself in the text AND the code.
  const why = died ? `hub died (${died})` : 'sampler loop ended early';
  emit(`EARLY END - ${why}`);
  writeSync(2, `\nEARLY END: ${why}. Ran ${mins} of ${MINUTES} requested minutes. Exiting 3, NOT 0.\n`);
  process.exitCode = 3;
}
try { hub.kill(); } catch {}
// If the hub is slow to let go of its pipes, do not hang the harness forever. Unref'd, so
// it only ever fires when something else is still holding the loop open.
setTimeout(() => process.exit(process.exitCode || 0), 10_000).unref();
