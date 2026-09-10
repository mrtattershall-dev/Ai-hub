/**
 * soak.mjs - leave the loop running and watch what grows.
 *
 *   node server/soak.mjs [minutes]
 *
 * Every other suite here finishes in under two minutes, which is exactly the wrong
 * duration to find what kills a 24/7 process: heap that never comes back, file handles
 * that are never closed, directories that only ever grow. This runs the REAL hub with the
 * REAL supervisor against a scripted model, feeds it goals continuously, and samples.
 *
 * Isolated: own workspace, queue, config, ports. Touches nothing live.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MINUTES = parseFloat(process.argv[2] || '20');
const HUB_PORT = 4200 + Math.floor(Math.random() * 200);
const FAKE_PORT = 11800 + Math.floor(Math.random() * 150);
const BASE = `http://127.0.0.1:${HUB_PORT}/api`;

const dir = mkdtempSync(join(tmpdir(), 'soak-'));
const ws = join(dir, 'workspace');
const dbPath = join(dir, 'hub.json');
writeFileSync(dbPath, JSON.stringify({
  api_keys: { ollama: { base_url: `http://127.0.0.1:${FAKE_PORT}`, model: 'fake' } },
  history: [], settings: {},
}), 'utf8');

const fake = spawn(process.execPath, [join(__dirname, 'fakemodel.mjs'), '--port', String(FAKE_PORT), '--script', 'happy'], { stdio: 'ignore' });
const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
  env: {
    ...process.env, PORT: String(HUB_PORT), HUB_DB: dbPath,
    AGENT_WORKSPACE: ws, AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_SUPERVISOR: '1', AGENT_APPROVAL_MODE: 'build', HUB_TOKEN: '',
    AGENT_MAX_STEPS: '12', AGENT_MAX_MINUTES: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let hubDied = null;
hub.on('exit', (c, s) => { hubDied = `code=${c} signal=${s}`; });
hub.stdout.on('data', () => {});
hub.stderr.on('data', () => {});

const api = async (p, o) => {
  const r = await fetch(BASE + p, { headers: { 'Content-Type': 'application/json' }, ...o, signal: AbortSignal.timeout(20_000) });
  return r.json();
};
for (let i = 0; i < 160; i++) {
  try { await fetch(BASE + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
}

const dirBytes = (d) => {
  try { return readdirSync(d).reduce((n, f) => n + (statSync(join(d, f)).size || 0), 0); } catch { return 0; }
};
const rss = () => {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      `(Get-Process -Id ${hub.pid} -ErrorAction SilentlyContinue).WorkingSet64`], { encoding: 'utf8' });
    return Math.round(parseInt(out.trim(), 10) / 1048576);
  } catch { return -1; }
};
const handles = () => {
  try {
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      `(Get-Process -Id ${hub.pid} -ErrorAction SilentlyContinue).HandleCount`], { encoding: 'utf8' });
    return parseInt(out.trim(), 10);
  } catch { return -1; }
};

const t0 = Date.now();
const end = t0 + MINUTES * 60_000;
let queued = 0, primes = 0, samples = [];
console.log(`soak: ${MINUTES} min, hub pid ${hub.pid}, workspace ${ws}`);
console.log('  mins  rss(MB)  handles  runs  runDir(KB)  wsGit(KB)  queued  primes  status');

let tick = 0;
while (Date.now() < end && !hubDied) {
  // Keep the backlog fed AND prime the chain when it stalls.
  //
  // The supervisor is a CHAIN, not a poller: it pulls the next goal only when a run
  // finishes with status 'done' (agent.js ~2551). An idle hub with a full queue therefore
  // sits idle forever - which is what the first version of this soak measured, and why
  // its memory line was reassuringly flat. Counting the re-primes is the real result: it
  // is how many times the unattended loop stopped on its own in this window.
  try {
    const q = await api('/agent/queue');
    const items = q.items || [];
    if (items.filter((i) => i.status === 'queued').length < 2) {
      await api('/agent/queue', { method: 'POST', body: JSON.stringify({ goal: `soak goal ${++queued}: write counter${queued}.js and verify it` }) });
    }
    const list = await api('/agent/list');
    const live = (Array.isArray(list) ? list : []).filter((r) => ['running', 'awaiting_approval'].includes(r.status));
    if (live.length === 0) {
      const goal = `soak prime ${++primes}: write primed${primes}.js and verify it`;
      const r = await api('/agent/start', { method: 'POST', body: JSON.stringify({ goal }) });
      if (!r.runId) primes--;
    }
  } catch { /* keep sampling even if one call fails */ }

  if (tick % 6 === 0) {
    const runsDir = join(__dirname, 'agent-runs');
    const s = {
      min: ((Date.now() - t0) / 60000).toFixed(1),
      rss: rss(), handles: handles(),
      runs: existsSync(runsDir) ? readdirSync(runsDir).length : 0,
      runKB: Math.round(dirBytes(runsDir) / 1024),
      gitKB: Math.round(dirBytes(join(ws, '.git')) / 1024),
      queued,
    };
    samples.push(s);
    console.log(`  ${String(s.min).padStart(4)}  ${String(s.rss).padStart(7)}  ${String(s.handles).padStart(7)}  ${String(s.runs).padStart(4)}  ${String(s.runKB).padStart(10)}  ${String(s.gitKB).padStart(9)}  ${String(s.queued).padStart(6)}  ${String(primes).padStart(6)}  ${hubDied || 'alive'}`);
  }
  tick++;
  await new Promise((r) => setTimeout(r, 5000));
}

const first = samples[1] || samples[0], last = samples[samples.length - 1];
console.log('\n--- verdict ---');
console.log(`hub: ${hubDied ? 'DIED ' + hubDied : 'alive after ' + MINUTES + ' min'}`);
if (first && last) {
  console.log(`rss    ${first.rss}MB -> ${last.rss}MB   (${last.rss - first.rss >= 0 ? '+' : ''}${last.rss - first.rss}MB)`);
  console.log(`handles ${first.handles} -> ${last.handles}   (${last.handles - first.handles >= 0 ? '+' : ''}${last.handles - first.handles})`);
  console.log(`run files ${first.runs} -> ${last.runs}, dir ${first.runKB}KB -> ${last.runKB}KB`);
  console.log(`goals queued: ${queued} | CHAIN RE-PRIMES (times the loop stopped on its own): ${primes}`);
}
hub.kill(); fake.kill();
