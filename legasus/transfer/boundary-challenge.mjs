/**
 * boundary-challenge.mjs - BIND-CJS step 11 (legasus/BIND-CJS_BOUNDARY.md, 5d47d25).
 *
 *   node legasus/transfer/boundary-challenge.mjs <out-dir>
 *
 * For each proposition: two worlds differing in its truth, a decider stated in advance over
 * recorded fields, and a comparison of NORMALIZED bundles. Nothing is proposed or repaired.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');   // e41c1e3, unchanged
const FIX = join(HERE, 'bnd-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'boundary'));
mkdirSync(outDir, { recursive: true });
const TARGET = join(FIX, 'target.js');
const MUTANT = join(FIX, 'mutant.js');
const MECH_URL = pathToFileURL(MECH).href;
const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const spawnedPids = [];

/** Run one world. `opts` selects everything that can vary; nothing else does. */
async function runWorld(tag, opts) {
  const trace = join(outDir, `${tag}.marks.jsonl`);
  const requests = join(outDir, `${tag}.requests.jsonl`);
  const mech = join(outDir, `${tag}.mechanism.jsonl`);
  const trigger = join(outDir, `${tag}.trigger`);
  for (const f of [trace, requests, mech, trigger]) rmSync(f, { force: true });
  const common = { LEGASUS_PROBE_TRACE: trace, LEGASUS_REQUESTS: requests, LEGASUS_CJS_LOG: mech, LEGASUS_TRIGGER: trigger,
    LEGASUS_CJS_MAP: JSON.stringify(opts.serve === false ? [] : [{ from: TARGET, to: MUTANT }]) };

  let worker = null;
  if (opts.worker !== 'none') {
    const wenv = { ...process.env, ...common, LEGASUS_ROLE: 'worker', LEGASUS_WORKER_MODE: opts.worker, LEGASUS_WORKER_DELAY: String(opts.workerDelay ?? 300) };
    delete wenv.NODE_OPTIONS;
    // P6's World-: the observation channel is removed from THIS process only. It still executes.
    if (opts.observeWorker === false) delete wenv.LEGASUS_PROBE_TRACE;
    worker = spawn(process.execPath, [join(FIX, 'worker.js')], { cwd: FIX, env: wenv, stdio: ['ignore', 'pipe', 'pipe'] });
    spawnedPids.push({ tag, role: 'worker', pid: worker.pid });
  }

  const env = { ...process.env, ...common, LEGASUS_ROLE: 'witness', LEGASUS_REQUEST: opts.request ? '1' : '0',
    LEGASUS_REQUEST_DELAY: String(opts.requestDelay ?? 0), NODE_OPTIONS: `--import ${MECH_URL}` };
  const r = spawnSync(process.execPath, ['--import', MECH_URL, join(FIX, 'witness.js')], { cwd: FIX, env, encoding: 'utf8', timeout: 60_000 });
  await sleep(300);
  if (worker) { try { worker.kill(); } catch { /* exited */ } }

  const markers = read(trace);
  const reqs = read(requests);
  const served = read(mech).filter((m) => m.event === 'served');
  // NORMALIZED bundle: pids -> role labels, timestamps -> rank order, paths -> basenames.
  const events = [...markers.map((m) => ({ kind: 'execution', role: m.role, identity: m.loaded, at: m.at })),
    ...reqs.map((q) => ({ kind: 'request', role: 'witness', identity: null, at: q.at }))]
    .sort((a, b) => a.at - b.at)
    .map((e, i) => ({ rank: i, kind: e.kind, role: e.role, identity: e.identity }));
  const normalized = { events, servedCount: served.length, servedBasenames: [...new Set(served.map((s) => s.servedPath.split(/[\\/]/).pop()))] };
  return { tag, opts, normalized, raw: { markers: markers.length, requests: reqs.length, served: served.length }, witnessExit: r.status };
}

// Deciders, each stated in advance, over recorded fields only.
const D = {
  P1: (b) => b.normalized.events.some((e) => e.kind === 'request'),
  P2: (b) => b.normalized.servedCount > 0,
  P3: (b) => b.normalized.events.some((e) => e.kind === 'execution' && e.role !== 'witness'),
  P4: (b) => { const q = b.normalized.events.find((e) => e.kind === 'request'); const x = b.normalized.events.find((e) => e.kind === 'execution' && e.role !== 'witness'); return Boolean(q && x && x.rank > q.rank); },
  P5: (b) => { const ids = new Set(b.normalized.events.filter((e) => e.kind === 'execution').map((e) => e.identity)); return ids.size === 1 && ids.has('MUTANT'); },
  P6: () => null,   // no field bears on it; the decider CANNOT be written, which is the point
  P7: () => null,   // step 10's known negative
};

const props = [
  { id: 'P1', text: 'a request was issued', plus: { worker: 'none', request: true }, minus: { worker: 'none', request: false }, expected: 'IDENTIFIABLE' },
  { id: 'P2', text: 'module M was served', plus: { worker: 'none', request: false }, minus: { worker: 'none', request: false, serve: false }, expected: 'IDENTIFIABLE' },
  { id: 'P3', text: 'an execution occurred outside the witness', plus: { worker: 'on-timer', request: false }, minus: { worker: 'none', request: false }, expected: 'IDENTIFIABLE' },
  { id: 'P4', text: 'that execution followed the request', plus: { worker: 'on-timer', request: true, workerDelay: 700, requestDelay: 0 }, minus: { worker: 'on-timer', request: true, workerDelay: 100, requestDelay: 800 }, expected: 'IDENTIFIABLE' },
  { id: 'P5', text: 'every OBSERVED execution used M', plus: { worker: 'none', request: false }, minus: { worker: 'on-timer', request: false }, expected: 'IDENTIFIABLE' },
  { id: 'P6', text: 'no UNOBSERVED execution occurred', plus: { worker: 'none', request: false }, minus: { worker: 'on-timer', request: false, observeWorker: false }, expected: 'NOT_IDENTIFIABLE_STRONG' },
  { id: 'P7', text: 'the request was responsible for the execution', plus: { worker: 'on-request', request: true, workerDelay: 200 }, minus: { worker: 'on-timer', request: true, workerDelay: 200 }, expected: 'NOT_IDENTIFIABLE_STRONG' },
];

const results = [];
for (const p of props) {
  const plus = await runWorld(`${p.id}-plus`, p.plus);
  const minus = await runWorld(`${p.id}-minus`, p.minus);
  const same = JSON.stringify(plus.normalized) === JSON.stringify(minus.normalized);
  const dec = D[p.id];
  const dp = dec ? dec(plus) : null;
  const dm = dec ? dec(minus) : null;
  let status;
  if (dp === true && dm === false) status = 'IDENTIFIABLE';
  else if (same) status = 'NOT_IDENTIFIABLE_STRONG';
  else status = 'NOT_IDENTIFIABLE_WEAK';
  results.push({ ...p, decider: { plus: dp, minus: dm }, bundlesIdentical: same,
    plusBundle: plus.normalized, minusBundle: minus.normalized, raw: { plus: plus.raw, minus: minus.raw }, status, matchedExpectation: status === p.expected });
  const x = results[results.length - 1];
  console.log(`  ${p.id} ${x.status.padEnd(25)} ${x.matchedExpectation ? '   ' : '!! '} decider(+/-)=${dp}/${dm} bundlesIdentical=${same}  "${p.text}"`);
}

const methodOk = results.find((r) => r.id === 'P7').status === 'NOT_IDENTIFIABLE_STRONG';
const survived = results.filter((r) => r.status === 'IDENTIFIABLE').map((r) => r.id);
const died = results.filter((r) => r.status !== 'IDENTIFIABLE').map((r) => `${r.id}:${r.status}`);

const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
writeFileSync(join(outDir, 'boundary.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  normalization: 'pids -> role labels, timestamps -> rank order, paths -> basenames (frozen in the prereg)',
  methodControl: { P7reproducesStep10: methodOk }, results, survived, died,
  processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length, sweep } }, null, 2));

console.log(`\nmethod control (P7 must reproduce step 10): ${methodOk ? 'PASS' : 'FAIL - nothing else here may be read'}`);
console.log(`established by the single run: ${survived.join(', ') || 'none'}`);
console.log(`not established: ${died.join(', ') || 'none'}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${sweep.filter((s) => s.aliveAtSweep).length} alive at sweep`);
console.log(`-> ${join(outDir, 'boundary.json')}`);
