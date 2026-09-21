/**
 * minimize-challenge.mjs - BIND-CJS step 13 (legasus/BIND-CJS_MINIMIZE.md, 23c23b4).
 *
 *   node legasus/transfer/minimize-challenge.mjs <out-dir>
 *
 * Removes the incidental differences step 12 left between hostile and genuine worlds and asks
 * again whether the recorded evidence separates them. S4 is scored under TWO field sets.
 * Nothing is rescued, proposed or named.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, appendFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH_URL = pathToFileURL(join(ROOT, 'legasus', 'cjs-preload.mjs')).href;   // e41c1e3
const FIX = join(HERE, 'bnd-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'minimize'));
mkdirSync(outDir, { recursive: true });
const TARGET = join(FIX, 'target.js');
const MUTANT = join(FIX, 'mutant.js');
const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const spawnedPids = [];

async function runWorld(tag, o) {
  const trace = join(outDir, `${tag}.marks.jsonl`); const requests = join(outDir, `${tag}.requests.jsonl`);
  const ops = join(outDir, `${tag}.ops.jsonl`); const mech = join(outDir, `${tag}.mechanism.jsonl`); const trigger = join(outDir, `${tag}.trigger`);
  for (const f of [trace, requests, ops, mech, trigger]) rmSync(f, { force: true });
  const common = { LEGASUS_PROBE_TRACE: trace, LEGASUS_REQUESTS: requests, LEGASUS_OPS: ops, LEGASUS_CJS_LOG: mech, LEGASUS_TRIGGER: trigger,
    LEGASUS_CJS_MAP: JSON.stringify([{ from: TARGET, to: MUTANT }]) };

  let worker = null;
  if (o.worker && o.worker !== 'none') {
    const wenv = { ...process.env, ...common, LEGASUS_ROLE: 'worker', LEGASUS_WORKER_MODE: o.worker, LEGASUS_WORKER_DELAY: String(o.workerDelay ?? 300) };
    delete wenv.NODE_OPTIONS;
    worker = spawn(process.execPath, [join(FIX, o.opworker ? 'opworker.js' : 'worker.js')], { cwd: FIX, env: wenv, stdio: ['ignore', 'pipe', 'pipe'] });
    spawnedPids.push({ tag, pid: worker.pid });
    if (o.opworker) await sleep(250);          // the operation begins BEFORE the request
  }

  const env = { ...process.env, ...common, LEGASUS_ROLE: 'witness', LEGASUS_REQUEST: o.request ? '1' : '0',
    LEGASUS_REQUEST_DELAY: String(o.requestDelay ?? 0), LEGASUS_RESOLVE_ONLY: '0',
    LEGASUS_SELF_WORKER: o.selfWorker ? '1' : '0', LEGASUS_SELF_WORKER_DELAY: String(o.selfWorkerDelay ?? 300),
    LEGASUS_OPS_MARK: o.opsMark ? '1' : '0', LEGASUS_OPS_DELAY: String(o.opsDelay ?? 400),
    NODE_OPTIONS: `--import ${MECH_URL}` };
  const child = spawn(process.execPath, ['--import', MECH_URL, join(FIX, 'witness.js')], { cwd: FIX, env, stdio: ['ignore', 'pipe', 'pipe'] });
  spawnedPids.push({ tag, pid: child.pid });

  // S1': a FOREIGN writer seeds the request channel MID-RUN, at the moment the genuine witness
  // would have issued. The rank scar from step 12 is removed by construction.
  if (o.foreignSeedAt != null) setTimeout(() => { try { appendFileSync(requests, JSON.stringify({ event: 'request', at: Date.now(), by: 'a foreign writer' }) + '\n'); } catch { /* ignored */ } }, o.foreignSeedAt);

  await new Promise((done) => child.on('exit', () => done()));
  await sleep(250);
  if (worker) { try { worker.kill(); } catch { /* exited */ } }

  const mk = (includeOps) => [...read(trace).map((m) => ({ kind: 'execution', role: m.role, identity: m.loaded, at: m.at })),
    ...read(requests).map((q) => ({ kind: 'request', role: 'witness', identity: null, at: q.at })),
    ...(includeOps ? read(ops).map((q) => ({ kind: 'operation-start', role: q.role, identity: null, at: q.at })) : [])]
    .sort((a, b) => a.at - b.at).map((e, i) => ({ rank: i, kind: e.kind, role: e.role, identity: e.identity }));
  return { original: { events: mk(false), servedCount: read(mech).filter((m) => m.event === 'served').length },
    extended: { events: mk(true), servedCount: read(mech).filter((m) => m.event === 'served').length } };
}

const cases = [
  { id: 'S1prime', prop: 'P1', text: 'a request was issued',
    hostile: { worker: 'none', request: false, foreignSeedAt: 250 },
    genuine: { worker: 'none', request: true, requestDelay: 250 },
    fieldSet: 'original', expect: 'IDENTICAL' },
  { id: 'S3prime', prop: 'P3', text: 'an execution occurred outside the witness',
    hostile: { worker: 'none', request: false, selfWorker: true, selfWorkerDelay: 300 },
    genuine: { worker: 'on-timer', request: false, workerDelay: 300 },
    fieldSet: 'original', expect: 'IDENTICAL' },
  { id: 'S4prime-original', prop: 'P4', text: 'the execution followed the request (original field set)',
    hostile: { worker: 'on-timer', opworker: true, request: true, workerDelay: 900, requestDelay: 0 },
    genuine: { worker: 'on-timer', request: true, workerDelay: 900, requestDelay: 0, opsMark: true, opsDelay: 400 },
    fieldSet: 'original', expect: 'IDENTICAL' },
  { id: 'S4prime-extended', prop: 'P4', text: 'the execution followed the request (operation-start included)',
    hostile: { worker: 'on-timer', opworker: true, request: true, workerDelay: 900, requestDelay: 0 },
    genuine: { worker: 'on-timer', request: true, workerDelay: 900, requestDelay: 0, opsMark: true, opsDelay: 400 },
    fieldSet: 'extended', expect: 'DIFFER' },
];

const results = [];
for (const c of cases) {
  const h = await runWorld(`${c.id}-hostile`, c.hostile);
  const g = await runWorld(`${c.id}-genuine`, c.genuine);
  const hb = h[c.fieldSet]; const gb = g[c.fieldSet];
  const identical = JSON.stringify(hb) === JSON.stringify(gb);
  const outcome = identical ? 'IDENTICAL' : 'DIFFER';
  results.push({ ...c, outcome, matched: outcome === c.expect,
    classification: identical ? 'EVIDENCE_LIMIT under this field set' : 'a difference remains - the next target, not an answer',
    hostileBundle: hb, genuineBundle: gb });
  const x = results[results.length - 1];
  console.log(`  ${c.id.padEnd(18)} [${c.fieldSet}] ${outcome.padEnd(9)} ${x.matched ? '  ' : '!!'} ${x.classification}`);
  if (!identical) console.log(`        hostile:  ${hb.events.map((e) => e.kind + ':' + e.role).join(' > ')}\n        genuine:  ${gb.events.map((e) => e.kind + ':' + e.role).join(' > ')}`);
}

const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
const N3a = results.find((r) => r.id === 'S4prime-original');
const N3b = results.find((r) => r.id === 'S4prime-extended');
writeFileSync(join(outDir, 'minimize.json'), JSON.stringify({ at: new Date().toISOString(), results,
  configurationFinding: N3a && N3b ? { originalFieldSet: N3a.outcome, extendedFieldSet: N3b.outcome,
    boundaryMoved: N3a.outcome === 'IDENTICAL' && N3b.outcome === 'DIFFER' } : null,
  processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length } }, null, 2));
console.log(`\nboundary moved with the observation configuration: ${N3a && N3b ? (N3a.outcome === 'IDENTICAL' && N3b.outcome === 'DIFFER') : 'not evaluated'}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${sweep.filter((s) => s.aliveAtSweep).length} alive at sweep`);
console.log(`-> ${join(outDir, 'minimize.json')}`);
