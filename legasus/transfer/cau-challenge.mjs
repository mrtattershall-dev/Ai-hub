/**
 * cau-challenge.mjs - BIND-CJS step 10 (legasus/BIND-CJS_CAUSAL.md, 567eaa5).
 *
 *   node legasus/transfer/cau-challenge.mjs <out-dir>
 *
 * H-CAU (a request was issued and the execution followed) and H-POST (the execution fell inside
 * the window) are EVALUATED as columns. Neither is adopted. The counterfactual world C-A0 is run
 * so that C-A's inertness is shown by evidence rather than asserted.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');   // e41c1e3, unchanged
const FIX = join(HERE, 'cau-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'cau'));
mkdirSync(outDir, { recursive: true });
const TARGET = join(FIX, 'target.js');
const MUTANT = join(FIX, 'mutant.js');
const MECH_URL = pathToFileURL(MECH).href;
const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** H-CAU, evaluated from the record: a request exists and the execution came after it. */
const hcau = (exec, requests) => requests.length ? { belongs: exec.at >= requests[0].at, basis: `request at ${requests[0].at}, execution at ${exec.at}` }
  : { belongs: false, basis: 'no request recorded' };
/** H-POST, the weaker sibling: the execution fell inside the intervention window. */
const hpost = (exec, w) => ({ belongs: exec.at >= w.start && exec.at <= w.end, basis: `window ${w.start}..${w.end}, execution at ${exec.at}` });

const worlds = [
  { id: 'C-REQ', workerMode: 'on-request', request: true, why: 'positive control: the worker acts ONLY when asked, and is asked' },
  { id: 'C-A', workerMode: 'on-timer', request: true, why: 'request present, causal responsibility absent: the worker ignores requests' },
  { id: 'C-A0', workerMode: 'on-timer', request: false, why: 'counterfactual for C-A, and H-POST\'s object: no request at all' },
];

const spawnedPids = [];
const results = [];
for (const w of worlds) {
  const trace = join(outDir, `${w.id}.marks.jsonl`);
  const requests = join(outDir, `${w.id}.requests.jsonl`);
  const trigger = join(outDir, `${w.id}.trigger`);
  for (const f of [trace, requests, trigger]) rmSync(f, { force: true });
  const common = { LEGASUS_PROBE_TRACE: trace, LEGASUS_REQUESTS: requests, LEGASUS_TRIGGER: trigger,
    LEGASUS_CJS_MAP: JSON.stringify([{ from: TARGET, to: MUTANT }]), LEGASUS_CJS_LOG: join(outDir, `${w.id}.mechanism.jsonl`) };

  const wenv = { ...process.env, ...common, LEGASUS_ROLE: 'worker', LEGASUS_WORKER_MODE: w.workerMode };
  delete wenv.NODE_OPTIONS;
  const worker = spawn(process.execPath, [join(FIX, 'worker.js')], { cwd: FIX, env: wenv, stdio: ['ignore', 'pipe', 'pipe'] });
  spawnedPids.push({ world: w.id, role: 'worker', pid: worker.pid });
  let workerOut = '';
  worker.stdout.on('data', (d) => { workerOut += d; });

  const windowStart = Date.now();
  const env = { ...process.env, ...common, LEGASUS_ROLE: 'witness', LEGASUS_REQUEST: w.request ? '1' : '0', NODE_OPTIONS: `--import ${MECH_URL}` };
  const r = spawnSync(process.execPath, ['--import', MECH_URL, join(FIX, 'witness.js')], { cwd: FIX, env, encoding: 'utf8', timeout: 60_000 });
  const windowEnd = Date.now();
  await sleep(400);
  try { worker.kill(); } catch { /* already exited */ }

  const markers = read(trace);
  const reqs = read(requests);
  const workerExecs = markers.filter((m) => m.role === 'worker');
  const evaluated = workerExecs.map((e) => ({ at: e.at, pid: e.pid, loaded: e.loaded,
    hcau: hcau(e, reqs), hpost: hpost(e, { start: windowStart, end: windowEnd }) }));

  results.push({ world: w.id, why: w.why, requestIssued: w.request, requestsRecorded: reqs.length,
    window: { start: windowStart, end: windowEnd }, workerExecutions: evaluated,
    cardinality: { markerRecords: markers.length, distinctPids: new Set(markers.map((m) => m.pid)).size, identities: [...new Set(markers.map((m) => m.loaded))] },
    witness: { exit: r.status }, workerStdout: workerOut.trim() });
  const x = results[results.length - 1];
  console.log(`  ${x.world.padEnd(6)} requests=${x.requestsRecorded} workerExecutions=${x.workerExecutions.length} ${x.workerExecutions.map((e) => `[H-CAU ${e.hcau.belongs} | H-POST ${e.hpost.belongs}]`).join(' ')}   ${x.workerStdout.split('\n')[0] || '(worker produced no line)'}`);
}

const REQ = results.find((r) => r.world === 'C-REQ');
const CA = results.find((r) => r.world === 'C-A');
const CA0 = results.find((r) => r.world === 'C-A0');
const K0 = REQ.workerExecutions.length === 1 && REQ.workerExecutions[0].hcau.belongs && REQ.workerExecutions[0].hpost.belongs;
const K1 = CA.workerExecutions.length === 1 && CA.workerExecutions[0].hcau.belongs && CA0.workerExecutions.length === 1;
const K2 = CA0.workerExecutions.length === 1 && CA0.workerExecutions[0].hpost.belongs && CA0.requestsRecorded === 0;

// K3: is there ANY recorded field that separates C-A's execution from C-REQ's?
const fieldsOf = (r) => { const e = r.workerExecutions[0] || {}; return { loaded: e.loaded, role: 'worker', insideWindow: e.hpost ? e.hpost.belongs : null, afterRequest: e.hcau ? e.hcau.belongs : null, hasPid: typeof e.pid === 'number' }; };
const fa = fieldsOf(CA); const fr = fieldsOf(REQ);
const differing = Object.keys(fr).filter((k) => JSON.stringify(fr[k]) !== JSON.stringify(fa[k]));

const scoring = {
  K0: K0 ? 'HELD - both rules fire on the genuine case, so they are capable of saying belongs' : 'FAILED - the rules cannot fire; the experiment is void, not informative',
  K1: K1 ? 'CONFIRMED - H-CAU says belongs in C-A, and C-A0 shows the same execution occurring with NO request: succession after a request does not establish causation'
    : `FALSIFIED - C-A H-CAU=${CA.workerExecutions[0] && CA.workerExecutions[0].hcau.belongs}, C-A0 executions=${CA0.workerExecutions.length}`,
  K2: K2 ? 'CONFIRMED - H-POST says belongs for an execution inside the window with no request at all: temporal containment does not establish causation'
    : `FALSIFIED - C-A0 H-POST=${CA0.workerExecutions[0] && CA0.workerExecutions[0].hpost.belongs}, requests=${CA0.requestsRecorded}`,
  K3: differing.length ? `recorded fields differing between C-A and C-REQ: ${differing.join(', ')}` : 'NO recorded field distinguishes C-A\'s execution from C-REQ\'s - left as the finding, not repaired',
  verdict: (K1 || K2) ? 'H-CAU and/or H-POST DENIED the status of a sufficient basis' : 'both survived this expedition',
};

const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
writeFileSync(join(outDir, 'causal.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  hypotheses: 'H-CAU and H-POST - evaluated, never adopted', results, scoring,
  processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length, sweep } }, null, 2));
console.log(`\nK0 ${scoring.K0}\nK1 ${scoring.K1}\nK2 ${scoring.K2}\nK3 ${scoring.K3}\n=> ${scoring.verdict}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${sweep.filter((s) => s.aliveAtSweep).length} alive at sweep`);
console.log(`-> ${join(outDir, 'causal.json')}`);
