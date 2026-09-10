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
import { mkdtempSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
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
hub.on('exit', (c, s) => { died = `code=${c} sig=${s}`; });
const log = [];
hub.stdout.on('data', (d) => log.push(d.toString()));
hub.stderr.on('data', (d) => log.push(d.toString()));

const api = async (p, o) => (await fetch(API + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(60_000) })).json();
for (let i = 0; i < 400; i++) { try { await fetch(API + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }

const GOALS = [
  // GAMES, which is what this hub exists to build, and the least-tested surface: only three
  // of the previous ninety trials touched a game. Each one must find sprites in a ~13,500
  // item library, load them by EXACT path, and pass browser verification - a missing asset
  // FAILS, it is not a warning. Deliberately varied genres so it cannot reuse one template.
  'Build g1_collect.html: a Phaser 3 game. Use list_assets to find a player sprite and a collectible, load both by EXACT path, arrow-key movement, collecting increases a visible score. Test it in the browser.',
  'Build g2_avoid.html: a Phaser 3 game where the player moves with arrow keys and must avoid a moving hazard sprite from the asset library. Show a lives counter. Test it in the browser.',
  'Build g3_click.html: a Phaser 3 game where sprites from the asset library appear at random positions and disappear when clicked, with a timer. Test it in the browser.',
  'Build g4_walk.html: a Phaser 3 scene with a tiled ground from the asset library and a character that walks left and right with animation frames. Test it in the browser.',
  'Build g5_shoot.html: a Phaser 3 game where the player fires a projectile at targets loaded from the asset library. Test it in the browser.',
  'Add a restart button to the EXISTING g1_collect.html that resets the score and repositions the player. Keep everything working. Test in the browser.',
  'Add a second collectible type to the EXISTING g1_collect.html worth 50 points, using a different sprite from the library. Test in the browser.',
  'Add sound-free visual feedback to the EXISTING g2_avoid.html: flash the player sprite when it hits the hazard. Test in the browser.',
  'Add a start screen to the EXISTING g3_click.html that waits for a click before the timer begins. Test in the browser.',
  'Add gravity and a jump to the EXISTING g4_walk.html so the character can jump. Test in the browser.',
  'Write G1.md describing what g1_collect.html actually does: controls, the exact asset paths it loads, and the scoring. Read the file first.',
  'Write G2.md describing what g2_avoid.html actually does, including its asset paths and the lives system. Read the file first.',
  'Write G4.md describing what g4_walk.html actually does, including its animation and asset paths. Read the file first.',
  'Create GAMES.md indexing every g-prefixed html file in the workspace with one line each on what it is. Read them first.',
  'Build g6_grid.html: a Phaser 3 game with a 4x4 grid of sprites from the asset library that swap positions when two are clicked. Test it in the browser.',
];

console.log(`full agent run: ${MINUTES} min against ${BASE}`);
console.log(`workspace ${ws}\n`);

let prev = null;
for (const goal of GOALS) {
  const r = await api('/agent/queue', { method: 'POST', body: JSON.stringify(prev ? { goal, after: prev } : { goal }) });
  prev = r.item?.id || r.id;
}
const kicked = await api('/agent/queue/run', { method: 'POST', body: JSON.stringify({ id: (await api('/agent/queue')).items[0].id }) }).catch(() => null);
if (!kicked || (!kicked.runId && !kicked.ok)) await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal: GOALS[0] }) });

const t0 = Date.now(), end = t0 + MINUTES * 60_000;
console.log('  mins  queue(done/open)  runs(done/other)  files  rss(MB)  note');
let lastNote = '';
while (Date.now() < end && !died) {
  await new Promise((r) => setTimeout(r, 30_000));
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
    const files = existsSync(ws) ? readdirSync(ws).filter((f) => f !== '.git').length : 0;
    const txt = log.join('');
    const notes = txt.match(/(treated as DENIED|Resumed automatically|supervisor picked up a queued goal)/g) || [];
    const note = notes.length ? `${notes.length} tick action(s): ${[...new Set(notes)].join(' / ')}` : '';
    if (note !== lastNote && note) { lastNote = note; }
    console.log(`  ${String(((Date.now() - t0) / 60000).toFixed(1)).padStart(4)}  ${String(done + '/' + open).padStart(16)}  ${String(rdone + '/' + (runs.length - rdone)).padStart(16)}  ${String(files).padStart(5)}  ${String(process.memoryUsage ? '-' : '-').padStart(7)}  ${note}`);
    if (!open) { console.log('\n  ALL GOALS COMPLETE'); break; }
  } catch (e) { console.log(`  (sample failed: ${e.message.slice(0, 60)})`); }
}

const txt = log.join('');
const rates = (txt.match(/= ([0-9.]+) tok\/s/g) || []).map((m) => parseFloat(m.match(/[0-9.]+/)[0]));
const prompts = (txt.match(/prompt ~([0-9]+) tok/g) || []).map((m) => parseInt(m.match(/[0-9]+/)[0], 10));
console.log('\n--- result ---');
console.log('hub:', died ? 'DIED ' + died : 'alive');
const q = await api('/agent/queue').catch(() => ({ items: [] }));
console.log('queue:', (q.items || []).map((i) => i.status).join(', ') || '(empty)');
const list = await api('/agent/list').catch(() => []);
console.log('runs:', (Array.isArray(list) ? list : []).map((r) => r.status).join(' -> '));
console.log('files:', existsSync(ws) ? readdirSync(ws).filter((f) => f !== '.git').join(', ') : '(none)');
if (rates.length) console.log(`tok/s: min ${Math.min(...rates)} max ${Math.max(...rates)} n=${rates.length}`);
if (prompts.length) console.log(`prompt tokens: max ${Math.max(...prompts)}`);
for (const k of ['treated as DENIED', 'Resumed automatically', 'supervisor picked up a queued goal']) {
  console.log(`tick "${k}": ${(txt.match(new RegExp(k, 'g')) || []).length}`);
}
hub.kill();
