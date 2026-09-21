/**
 * survivor-challenge.mjs - BIND-CJS step 12 (legasus/BIND-CJS_SURVIVORS.md, 442963c).
 *
 *   node legasus/transfer/survivor-challenge.mjs <out-dir>
 *
 * False-positive attacks on step 11's five survivors. The step-11 deciders are used VERBATIM.
 * For each proposition: a hostile world where it is FALSE, plus the step-11 World- re-run as a
 * must-fire negative so a decider that says true everywhere cannot manufacture five deaths.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');   // e41c1e3, unchanged
const FIX = join(HERE, 'bnd-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'survivors'));
mkdirSync(outDir, { recursive: true });
const TARGET = join(FIX, 'target.js');
const MUTANT = join(FIX, 'mutant.js');
const IMPOSTOR = join(FIX, 'impostor.js');
const MECH_URL = pathToFileURL(MECH).href;
const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const spawnedPids = [];

async function runWorld(tag, o) {
  const trace = join(outDir, `${tag}.marks.jsonl`);
  const requests = join(outDir, `${tag}.requests.jsonl`);
  const ops = join(outDir, `${tag}.ops.jsonl`);
  const mech = join(outDir, `${tag}.mechanism.jsonl`);
  const trigger = join(outDir, `${tag}.trigger`);
  for (const f of [trace, requests, ops, mech, trigger]) rmSync(f, { force: true });
  // S1: another writer seeds the request channel before the run.
  if (o.preseedRequest) writeFileSync(requests, JSON.stringify({ event: 'request', at: Date.now(), by: 'another writer entirely' }) + '\n');
  const serveTo = o.serveImpostor ? IMPOSTOR : MUTANT;
  const common = { LEGASUS_PROBE_TRACE: trace, LEGASUS_REQUESTS: requests, LEGASUS_OPS: ops, LEGASUS_CJS_LOG: mech, LEGASUS_TRIGGER: trigger,
    LEGASUS_CJS_MAP: JSON.stringify(o.serve === false ? [] : [{ from: TARGET, to: serveTo }]) };

  let worker = null;
  if (o.worker && o.worker !== 'none') {
    const wenv = { ...process.env, ...common, LEGASUS_ROLE: 'worker', LEGASUS_WORKER_MODE: o.worker, LEGASUS_WORKER_DELAY: String(o.workerDelay ?? 300) };
    delete wenv.NODE_OPTIONS;
    if (o.observeWorker === false) delete wenv.LEGASUS_PROBE_TRACE;
    const script = o.opworker ? 'opworker.js' : 'worker.js';
    worker = spawn(process.execPath, [join(FIX, script)], { cwd: FIX, env: wenv, stdio: ['ignore', 'pipe', 'pipe'] });
    spawnedPids.push({ tag, role: 'worker', pid: worker.pid });
    if (o.opworker) await sleep(250);   // let the operation begin BEFORE the request
  }

  const env = { ...process.env, ...common, LEGASUS_ROLE: o.witnessRole || 'witness',
    LEGASUS_REQUEST: o.request ? '1' : '0', LEGASUS_REQUEST_DELAY: String(o.requestDelay ?? 0),
    LEGASUS_RESOLVE_ONLY: o.resolveOnly ? '1' : '0', NODE_OPTIONS: `--import ${MECH_URL}` };
  const r = spawnSync(process.execPath, ['--import', MECH_URL, join(FIX, 'witness.js')], { cwd: FIX, env, encoding: 'utf8', timeout: 60_000 });
  await sleep(300);
  if (worker) { try { worker.kill(); } catch { /* exited */ } }

  const markers = read(trace);
  const reqs = read(requests);
  const opRecs = read(ops);
  const served = read(mech).filter((m) => m.event === 'served');
  const events = [...markers.map((m) => ({ kind: 'execution', role: m.role, identity: m.loaded, at: m.at })),
    ...reqs.map((q) => ({ kind: 'request', role: 'witness', identity: null, at: q.at })),
    ...opRecs.map((q) => ({ kind: 'operation-start', role: q.role, identity: null, at: q.at }))]
    .sort((a, b) => a.at - b.at).map((e, i) => ({ rank: i, kind: e.kind, role: e.role, identity: e.identity }));
  return { tag, normalized: { events, servedCount: served.length }, raw: { markers: markers.length, requests: reqs.length, ops: opRecs.length, served: served.length }, witnessExit: r.status };
}

// ---- THE STEP-11 DECIDERS, VERBATIM. Not one character is changed to survive an attack. ----
const D = {
  P1: (b) => b.normalized.events.some((e) => e.kind === 'request'),
  P2: (b) => b.normalized.servedCount > 0,
  P3: (b) => b.normalized.events.some((e) => e.kind === 'execution' && e.role !== 'witness'),
  P4: (b) => { const q = b.normalized.events.find((e) => e.kind === 'request'); const x = b.normalized.events.find((e) => e.kind === 'execution' && e.role !== 'witness'); return Boolean(q && x && x.rank > q.rank); },
  P5: (b) => { const ids = new Set(b.normalized.events.filter((e) => e.kind === 'execution').map((e) => e.identity)); return ids.size === 1 && ids.has('MUTANT'); },
};

const attacks = [
  { id: 'S1', prop: 'P1', text: 'a request was issued', hostile: { worker: 'none', request: false, preseedRequest: true },
    control: { worker: 'none', request: false }, falseBecause: 'the record was written by another writer; the intervention issued nothing' },
  { id: 'S2', prop: 'P2', text: 'module M was served', hostile: { worker: 'none', request: false, resolveOnly: true },
    control: { worker: 'none', request: false, serve: false }, falseBecause: 'the hook answered a resolution; nothing was supplied to an execution' },
  { id: 'S3', prop: 'P3', text: 'an execution occurred outside the witness', hostile: { worker: 'none', request: false, witnessRole: 'worker' },
    control: { worker: 'none', request: false }, falseBecause: 'the only process was the witness, wearing a self-reported label' },
  { id: 'S4', prop: 'P4', text: 'the execution followed the request', hostile: { worker: 'on-timer', opworker: true, request: true, workerDelay: 900, requestDelay: 0 },
    control: { worker: 'on-timer', request: true, workerDelay: 100, requestDelay: 800 }, falseBecause: 'the operation began before the request; only the load came after' },
  { id: 'S5', prop: 'P5', text: 'every observed execution used M', hostile: { worker: 'none', request: false, serveImpostor: true },
    control: { worker: 'on-timer', request: false }, falseBecause: 'the served file was not the requested mutant; it self-reported the identity' },
];

const results = [];
for (const a of attacks) {
  const hostile = await runWorld(`${a.id}-hostile`, a.hostile);
  const control = await runWorld(`${a.id}-control`, a.control);
  const dec = D[a.prop];
  const dh = dec(hostile);
  const dc = dec(control);
  const controlOk = dc === false;
  const died = dh === true;
  results.push({ ...a, deciderHostile: dh, deciderControl: dc, mustFireNegativeHeld: controlOk,
    verdict: !controlOk ? 'VOID - the decider answers true in the must-fire negative too' : died ? 'PROPOSITION DIES - affirmed in a world where it is false' : 'SURVIVES this attack',
    hostileBundle: hostile.normalized, hostileRaw: hostile.raw, controlRaw: control.raw });
  const x = results[results.length - 1];
  console.log(`  ${a.id} (${a.prop}) decider(hostile)=${dh} decider(control)=${dc} -> ${x.verdict}`);
  console.log(`        false because: ${a.falseBecause}`);
}

const died = results.filter((r) => r.verdict.startsWith('PROPOSITION DIES')).map((r) => r.prop);
const survived = results.filter((r) => r.verdict.startsWith('SURVIVES')).map((r) => r.prop);
const voids = results.filter((r) => r.verdict.startsWith('VOID')).map((r) => r.prop);

const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
writeFileSync(join(outDir, 'survivors.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  deciders: 'step-11 deciders, verbatim', results, died, survived, voids,
  processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length, sweep } }, null, 2));
console.log(`\ndied: ${died.join(', ') || 'none'}`);
console.log(`survived a second attack: ${survived.join(', ') || 'none'}`);
console.log(`void: ${voids.join(', ') || 'none'}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${sweep.filter((s) => s.aliveAtSweep).length} alive at sweep`);
console.log(`-> ${join(outDir, 'survivors.json')}`);
