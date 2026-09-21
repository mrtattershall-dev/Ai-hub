/**
 * anc-challenge.mjs - BIND-CJS step 9 (legasus/BIND-CJS_ANCESTRY.md, d598a47).
 *
 *   node legasus/transfer/anc-challenge.mjs <out-dir>
 *
 * Attacks H-ANC: "an observed execution belongs to an intervention iff its process descends
 * from the process under the mechanism." Three hostile worlds. H-ANC is EVALUATED, never
 * adopted; no replacement relation is proposed and no concept is named.
 *
 * Process hygiene: every spawned pid is recorded and swept BY PID at the end; the sweep's
 * result is reported. No kill by image name.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH = join(ROOT, 'legasus', 'cjs-preload.mjs');   // e41c1e3, unchanged
const FIX = join(HERE, 'anc-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'anc'));
mkdirSync(outDir, { recursive: true });
const TARGET = join(FIX, 'target.js');
const MUTANT = join(FIX, 'mutant.js');
const MECH_URL = pathToFileURL(MECH).href;
const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * H-ANC, evaluated from the recorded markers alone - which is the only evidence an intervention
 * judgement would have. Walks ppid links upward through processes that appear in the record.
 * Returns true / false / null, where NULL means the chain could not be evaluated.
 */
function hancDescendant(proc, witnessPid, byPid) {
  let cur = proc;
  const seen = new Set();
  for (let hop = 0; hop < 16; hop++) {
    if (cur.ppid === witnessPid) return { belongs: true, evaluable: true, hops: hop + 1 };
    if (cur.pid === witnessPid) return { belongs: true, evaluable: true, hops: hop };
    if (seen.has(cur.pid)) return { belongs: null, evaluable: false, why: 'cycle in the recorded ppid links' };
    seen.add(cur.pid);
    const parent = byPid[cur.ppid];
    if (!parent) return { belongs: null, evaluable: false, why: `ppid ${cur.ppid} names a process absent from the record (exited, or never observed) - the chain cannot be reconstructed` };
    cur = parent;
  }
  return { belongs: null, evaluable: false, why: 'depth limit' };
}

const spawnedPids = [];
const results = [];

for (const world of ['A-1', 'A-2', 'A-3']) {
  const trace = join(outDir, `${world}.marks.jsonl`);
  const pidsFile = join(outDir, `${world}.pids.jsonl`);
  const trigger = join(outDir, `${world}.trigger`);
  for (const f of [trace, pidsFile, trigger]) rmSync(f, { force: true });
  const common = { LEGASUS_PROBE_TRACE: trace, LEGASUS_PIDS: pidsFile, LEGASUS_TRIGGER: trigger,
    LEGASUS_CJS_MAP: JSON.stringify([{ from: TARGET, to: MUTANT }]), LEGASUS_CJS_LOG: join(outDir, `${world}.mechanism.jsonl`) };

  // A-1: the worker starts BEFORE the witness and is a child of THIS driver.
  let worker = null;
  if (world === 'A-1') {
    const env = { ...process.env, ...common, LEGASUS_ROLE: 'worker' };
    delete env.NODE_OPTIONS;
    worker = spawn(process.execPath, [join(FIX, 'worker.js')], { cwd: FIX, env, stdio: ['ignore', 'pipe', 'pipe'] });
    spawnedPids.push({ world, role: 'worker', pid: worker.pid });
    await sleep(300);   // the worker is waiting before the witness exists
  }

  const env = { ...process.env, ...common, LEGASUS_WORLD: world, LEGASUS_ROLE: 'witness', NODE_OPTIONS: `--import ${MECH_URL}` };
  const r = spawnSync(process.execPath, ['--import', MECH_URL, join(FIX, 'witness.js')], { cwd: FIX, env, encoding: 'utf8', timeout: 60_000 });
  if (world === 'A-1' && worker) { await sleep(600); try { worker.kill(); } catch { /* already exited */ } }
  if (world === 'A-3') await sleep(1500);   // let the detached grandchild finish

  const markers = read(trace);
  const pidRecs = read(pidsFile);
  for (const p of pidRecs) { spawnedPids.push({ world, role: p.role, pid: p.pid }); if (p.spawned) spawnedPids.push({ world, role: 'grandchild', pid: p.spawned }); }

  const byPid = {};
  for (const m of markers) (byPid[m.pid] ??= { pid: m.pid, ppid: m.ppid, role: m.role, loads: [] }).loads.push(m.loaded);
  const procs = Object.values(byPid);
  const witnessPid = (markers.find((m) => m.role === 'witness') || {}).pid || null;
  const evaluated = procs.filter((p) => p.pid !== witnessPid).map((p) => ({ ...p, hanc: hancDescendant(p, witnessPid, byPid) }));

  results.push({ world, witnessPid, processes: procs, nonWitness: evaluated,
    cardinality: { markerRecords: markers.length, distinctPids: procs.length, identities: [...new Set(markers.map((m) => m.loaded))] },
    witness: { exit: r.status, stdoutTail: (r.stdout || '').trim().split('\n').slice(-3).join(' | ').slice(0, 220) },
    workerStdout: worker ? 'spawned by the driver, before the witness existed' : null });

  const x = results[results.length - 1];
  console.log(`  ${world}: witnessPid=${witnessPid} procs=${x.cardinality.distinctPids} ids=[${x.cardinality.identities.join(',')}]`);
  for (const p of x.nonWitness) console.log(`        pid ${p.pid} ppid ${p.ppid} role=${String(p.role).padEnd(12)} loads=[${p.loads.join(',')}]  H-ANC: belongs=${p.hanc.belongs} evaluable=${p.hanc.evaluable}${p.hanc.why ? ' - ' + p.hanc.why : ''}`);
}

// ---- scoring -------------------------------------------------------------------------------
const A1w = results.find((r) => r.world === 'A-1');
const A2w = results.find((r) => r.world === 'A-2');
const A3w = results.find((r) => r.world === 'A-3');
const workerProc = A1w.nonWitness.find((p) => p.role === 'worker');
const bgProc = A2w.nonWitness.find((p) => p.role === 'background');
const gcProc = A3w.nonWitness.find((p) => p.role === 'grandchild');

const A1 = workerProc && workerProc.loads.length > 0 && workerProc.hanc.belongs !== true;
const A2 = Boolean(bgProc && bgProc.hanc.belongs === true);
const A3 = Boolean(gcProc && gcProc.hanc.evaluable === false);
const scoring = {
  A1: A1 ? `CONFIRMED - the worker executed the target (caused by the witness's request) and H-ANC gives belongs=${workerProc.hanc.belongs}: under-inclusion`
    : `FALSIFIED - ${workerProc ? `worker H-ANC belongs=${workerProc.hanc.belongs}, loads=${workerProc.loads.length}` : 'the worker never executed the target'}`,
  A2: A2 ? 'CONFIRMED - a descendant doing work outside every witness case is included by H-ANC, and its record is identical in kind to step 8 P-B\'s escaped descendant'
    : `FALSIFIED - ${bgProc ? `background H-ANC belongs=${bgProc.hanc.belongs}` : 'the background process left no record'}`,
  A3: A3 ? `CONFIRMED - H-ANC is NOT EVALUABLE for the grandchild: ${gcProc.hanc.why}`
    : `FALSIFIED - ${gcProc ? `grandchild H-ANC evaluable=${gcProc.hanc.evaluable}` : 'the grandchild left no record'}`,
  verdict: (A1 || A2 || A3) ? 'H-ANC DENIED the status of a sufficient basis' : 'H-ANC survived every world in this expedition',
};

// ---- sweep BY PID, and report it --------------------------------------------------------------
const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive, killed: alive });
}
const leaked = sweep.filter((s) => s.aliveAtSweep);

writeFileSync(join(outDir, 'ancestry.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version,
  hypothesis: 'H-ANC - evaluated, never adopted', mechanism: 'legasus/cjs-preload.mjs @ e41c1e3, unchanged',
  results, scoring, processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: leaked.length, sweep } }, null, 2));

console.log(`\nA1 ${scoring.A1}\nA2 ${scoring.A2}\nA3 ${scoring.A3}\n=> ${scoring.verdict}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${leaked.length} still alive at sweep${leaked.length ? ' (killed by pid)' : ''}`);
console.log(`-> ${join(outDir, 'ancestry.json')}`);
