/**
 * p2-challenge.mjs - BIND-CJS step 14 (legasus/BIND-CJS_P2.md, 2126fab).
 *
 *   node legasus/transfer/p2-challenge.mjs <out-dir>
 *
 * Part A: S3" - the genuine world's external worker receives the mechanism, removing the last
 *         identity scar on P3.
 * Part B: P2 - the named rescue D-P2' is attacked in both directions.
 *
 * Nothing is written to rescue anything; every decider here was frozen in the preregistration.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH_URL = pathToFileURL(join(ROOT, 'legasus', 'cjs-preload.mjs')).href;   // e41c1e3
const FIX = join(HERE, 'bnd-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'p2'));
mkdirSync(outDir, { recursive: true });
const TARGET = join(FIX, 'target.js');
const MUTANT = join(FIX, 'mutant.js');
const IMPOSTOR = join(FIX, 'impostor.js');
const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const spawnedPids = [];

async function runWorld(tag, o) {
  const trace = join(outDir, `${tag}.marks.jsonl`); const requests = join(outDir, `${tag}.requests.jsonl`);
  const ops = join(outDir, `${tag}.ops.jsonl`); const mech = join(outDir, `${tag}.mechanism.jsonl`); const trigger = join(outDir, `${tag}.trigger`);
  for (const f of [trace, requests, ops, mech, trigger]) rmSync(f, { force: true });
  const serveTo = o.serveImpostor ? IMPOSTOR : MUTANT;
  const common = { LEGASUS_PROBE_TRACE: trace, LEGASUS_REQUESTS: requests, LEGASUS_OPS: ops, LEGASUS_TRIGGER: trigger,
    LEGASUS_CJS_MAP: JSON.stringify(o.serve === false ? [] : [{ from: TARGET, to: serveTo }]) };
  // B-SILENT: the mechanism still substitutes; its log channel is simply not given to it.
  if (!o.silentMechanism) common.LEGASUS_CJS_LOG = mech;

  let worker = null;
  if (o.worker && o.worker !== 'none') {
    const wenv = { ...process.env, ...common, LEGASUS_ROLE: 'worker', LEGASUS_WORKER_MODE: o.worker, LEGASUS_WORKER_DELAY: String(o.workerDelay ?? 300) };
    // A1: the genuine external worker RECEIVES the mechanism, so it loads the mutant like the
    // hostile world's second in-process load. Without this, identity was the remaining scar.
    if (o.workerGetsMechanism) wenv.NODE_OPTIONS = `--import ${MECH_URL}`;
    else delete wenv.NODE_OPTIONS;
    worker = spawn(process.execPath, [join(FIX, 'worker.js')], { cwd: FIX, env: wenv, stdio: ['ignore', 'pipe', 'pipe'] });
    spawnedPids.push({ tag, pid: worker.pid });
  }

  const env = { ...process.env, ...common, LEGASUS_ROLE: 'witness', LEGASUS_REQUEST: o.request ? '1' : '0',
    LEGASUS_REQUEST_DELAY: String(o.requestDelay ?? 0), LEGASUS_RESOLVE_ONLY: o.resolveOnly ? '1' : '0',
    LEGASUS_SELF_WORKER: o.selfWorker ? '1' : '0', LEGASUS_SELF_WORKER_DELAY: String(o.selfWorkerDelay ?? 300),
    LEGASUS_OPS_MARK: '0', NODE_OPTIONS: `--import ${MECH_URL}` };
  const child = spawn(process.execPath, ['--import', MECH_URL, join(FIX, 'witness.js')], { cwd: FIX, env, stdio: ['ignore', 'pipe', 'pipe'] });
  spawnedPids.push({ tag, pid: child.pid });
  await new Promise((done) => child.on('exit', () => done()));
  await sleep(250);
  if (worker) { try { worker.kill(); } catch { /* exited */ } }

  const events = [...read(trace).map((m) => ({ kind: 'execution', role: m.role, identity: m.loaded, at: m.at })),
    ...read(requests).map((q) => ({ kind: 'request', role: 'witness', identity: null, at: q.at }))]
    .sort((a, b) => a.at - b.at).map((e, i) => ({ rank: i, kind: e.kind, role: e.role, identity: e.identity }));
  return { events, servedCount: read(mech).filter((m) => m.event === 'served').length };
}

/** D-P2', named in the preregistration before it was attacked. Not modified here. */
const DP2 = (b) => b.servedCount > 0 && b.events.some((e) => e.kind === 'execution' && e.identity === 'MUTANT');

// ---- Part A: S3" -----------------------------------------------------------------------------
console.log('Part A - S3": the genuine external worker receives the mechanism');
const aHostile = await runWorld('A-hostile', { worker: 'none', request: false, selfWorker: true, selfWorkerDelay: 300 });
const aGenuine = await runWorld('A-genuine', { worker: 'on-timer', request: false, workerDelay: 300, workerGetsMechanism: true });
const aIdentical = JSON.stringify(aHostile.events) === JSON.stringify(aGenuine.events);
console.log(`  hostile:  ${aHostile.events.map((e) => `${e.kind}:${e.role}:${e.identity}`).join(' > ')}`);
console.log(`  genuine:  ${aGenuine.events.map((e) => `${e.kind}:${e.role}:${e.identity}`).join(' > ')}`);
console.log(`  A1: bundles ${aIdentical ? 'IDENTICAL - P3 converts to an evidence limit' : 'STILL DIFFER - stopping rule applies, no further iteration'}`);

// ---- Part B: P2 ------------------------------------------------------------------------------
console.log('\nPart B - P2: attacking the named rescue D-P2\' in both directions');
const bGenuine = await runWorld('B-genuine', { worker: 'none', request: false });
const bNothing = await runWorld('B-nothing', { worker: 'none', request: false, serve: false });
const bImpostor = await runWorld('B-impostor', { worker: 'none', request: false, serveImpostor: true });
const bSilent = await runWorld('B-silent', { worker: 'none', request: false, silentMechanism: true });

const ctlTrue = DP2(bGenuine);
const ctlFalse = DP2(bNothing);
const b1 = DP2(bImpostor);          // expected TRUE while P2 is false
const b2 = DP2(bSilent);            // expected FALSE while P2 is true
const ctlOk = ctlTrue === true && ctlFalse === false;
for (const [name, b] of [['genuine', bGenuine], ['nothing-served', bNothing], ['impostor', bImpostor], ['silent-mechanism', bSilent]]) {
  console.log(`  ${name.padEnd(17)} served=${String(b.servedCount).padStart(2)} identities=[${b.events.filter((e) => e.kind === 'execution').map((e) => e.identity).join(',')}] D-P2'=${DP2(b)}`);
}

const scoring = {
  A1: aIdentical ? 'CONFIRMED - P3 converts to an evidence limit under this configuration' : 'FALSIFIED - a new difference remains; the frozen stopping rule applies',
  'B-CTL': ctlOk ? 'HELD - the rescue discriminates a genuine world from one where nothing is served' : 'FAILED - Part B is void',
  B1: !ctlOk ? 'not evaluated' : b1 ? 'CONFIRMED - the distinction occurs WITHOUT the proposition (an impostor was served; M never was)' : 'FALSIFIED - the rescue declined the impostor world',
  B2: !ctlOk ? 'not evaluated' : !b2 ? 'CONFIRMED - the proposition occurs WITHOUT the distinction (M was served and evaluated; no served record)' : 'FALSIFIED - the rescue still affirmed the silent world',
  verdict: !ctlOk ? 'Part B void' : (b1 && !b2) ? "D-P2' dies in BOTH directions" : (b1 || !b2) ? "D-P2' dies in one direction and survived the other - the survivor is the next target" : "D-P2' survived both attacks - the first candidate in this sequence to do so",
};

const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
writeFileSync(join(outDir, 'p2.json'), JSON.stringify({ at: new Date().toISOString(),
  partA: { hostile: aHostile, genuine: aGenuine, identical: aIdentical },
  partB: { genuine: bGenuine, nothing: bNothing, impostor: bImpostor, silent: bSilent, DP2: { genuine: ctlTrue, nothing: ctlFalse, impostor: b1, silent: b2 } },
  scoring, processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length } }, null, 2));
console.log(`\nA1 ${scoring.A1}\nB-CTL ${scoring['B-CTL']}\nB1 ${scoring.B1}\nB2 ${scoring.B2}\n=> ${scoring.verdict}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${sweep.filter((s) => s.aliveAtSweep).length} alive at sweep`);
console.log(`-> ${join(outDir, 'p2.json')}`);
