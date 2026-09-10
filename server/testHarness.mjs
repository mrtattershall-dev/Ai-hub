/**
 * testHarness.mjs - one correct way to run a hub in a test.
 *
 * Eight instrumentation bugs on 2026-09-10, every one of them in a harness rather than in
 * the product, and every one reassuring rather than alarming:
 *
 *   - a soak whose memory line was beautifully flat because nothing was running
 *   - a test named "no console errors" that never checked console errors
 *   - a queue watcher that treated 'stopped' as "still working" and waited out its whole
 *     deadline on a goal that had already failed
 *   - `pgrep -f`, which matches no Windows node process, so four batches meant to run in
 *     sequence ran AT ONCE against a GPU whose generation is serialised - throughput fell
 *     from 130 to 50 tok/s and the starvation looked exactly like a deadlock
 *   - harnesses writing into the developer's LIVE workspace, queue, run history and index
 *   - four harnesses hard-coding the same port
 *
 * They share one cause: every harness re-implements spawning a hub, waiting for it,
 * deciding what is terminal, and isolating state. Copy-paste means a bug fixed in one
 * survives in the others. So this is the single place those five things are written down.
 *
 * The rule this encodes: A TEST MUST NOT BE ABLE TO TOUCH LIVE STATE. Not "should not" -
 * `isolatedEnv()` sets every override there is, so forgetting one is not possible.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** A run has finished when it is one of these. 'stopped' IS terminal - it will not change. */
export const TERMINAL_RUN = ['done', 'error', 'stopped', 'interrupted', 'awaiting_approval'];
/** A queue item is settled when it is one of these. */
export const TERMINAL_ITEM = ['done', 'failed', 'cancelled', 'stopped'];

// PORTS COME FROM testPort.mjs, NOT FROM HERE.
//
// Session 00 wrote that module two hours before I wrote my own freePort(), and theirs is
// better: freePorts(n) holds every socket open until all n are chosen, because otherwise
// the OS can hand out the SAME port twice - which is exactly what harnesses here do when
// they need a hub AND a fake upstream. Mine had that race. Two implementations of one
// idea is how a fix lands in one place and not the other, which is the whole reason this
// file exists, so the duplicate is gone rather than reconciled.
export { freePort, freePorts } from './testPort.mjs';

/** A scratch directory with a hub.json pointing wherever the test wants. */
export function scratch(prefix, { baseUrl = '', model = 'fake' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), prefix + '-'));
  writeFileSync(join(dir, 'hub.json'), JSON.stringify({
    api_keys: { ollama: { base_url: baseUrl, model } }, history: [], settings: {},
  }), 'utf8');
  return dir;
}

/**
 * EVERY isolation override, together. Add one to the product and add it here; a harness
 * that uses this cannot silently start writing to live state.
 */
export function isolatedEnv(dir, port, extra = {}) {
  return {
    ...process.env,
    PORT: String(port),
    HUB_DB: join(dir, 'hub.json'),
    AGENT_WORKSPACE: join(dir, 'workspace'),
    AGENT_QUEUE_FILE: join(dir, 'queue.json'),
    AGENT_RUNS_DIR: join(dir, 'runs'),
    RUN_INDEX: join(dir, 'run-index.jsonl'),
    HUB_TOKEN: '',
    ...extra,
  };
}

/** Start a hub and wait until it answers. Returns { hub, api, log, port }. */
export async function startHub(dir, { port, env = {}, waitMs = 60_000 } = {}) {
  const p = port || (await freePort());
  const log = [];
  const hub = spawn(process.execPath, [join(__dirname, 'index.js')], {
    env: isolatedEnv(dir, p, env), stdio: ['ignore', 'pipe', 'pipe'],
  });
  hub.stdout.on('data', (d) => log.push(d.toString()));
  hub.stderr.on('data', (d) => log.push(d.toString()));
  let exited = null;
  hub.on('exit', (c, s) => { exited = `code=${c} signal=${s}`; });

  const base = `http://127.0.0.1:${p}/api`;
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`hub exited before it listened: ${exited}\n${log.join('').slice(-800)}`);
    try { await fetch(base + '/auth/hint'); break; } catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  const api = async (path, opts) => {
    const r = await fetch(base + path, {
      headers: { 'Content-Type': 'application/json' }, ...opts,
      signal: AbortSignal.timeout(opts?.timeoutMs || 60_000),
    });
    return r.json();
  };
  return { hub, api, log, port: p, base, died: () => exited };
}

/** Poll until every queue item is settled, or the deadline passes. */
export async function waitForQueue(api, { minutes = 30, every = 4000 } = {}) {
  const deadline = Date.now() + minutes * 60_000;
  let q = null;
  while (Date.now() < deadline) {
    q = await api('/agent/queue');
    const open = (q.items || []).filter((i) => !TERMINAL_ITEM.includes(i.status));
    if (!open.length) return { settled: true, items: q.items || [] };
    await new Promise((r) => setTimeout(r, every));
  }
  return { settled: false, items: (q && q.items) || [] };
}
