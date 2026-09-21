/**
 * survivor-classify.mjs - POST-HOC characterisation of step 12's five deaths.
 *
 * Step 12 established that each frozen decider affirms its proposition in a world where the
 * proposition is false. That is a fact about the DECIDER. It does not establish that the
 * evidence could not separate the worlds by some other decider over the same recorded fields.
 *
 * This script runs, for each proposition, a world where it is genuinely TRUE, and compares the
 * normalized bundle with step 12's hostile bundle:
 *
 *   identical  -> EVIDENCE LIMIT   no decider over these fields could separate them
 *   differ     -> DECIDER WEAKNESS this decider was insufficient; the record holds something
 *
 * Labelled post-hoc throughout. Nothing is repaired and no decider is rewritten.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MECH_URL = pathToFileURL(join(ROOT, 'legasus', 'cjs-preload.mjs')).href;
const FIX = join(HERE, 'bnd-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'survivors'));
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
    worker = spawn(process.execPath, [join(FIX, 'worker.js')], { cwd: FIX, env: wenv, stdio: ['ignore', 'pipe', 'pipe'] });
    spawnedPids.push({ tag, pid: worker.pid });
  }
  const env = { ...process.env, ...common, LEGASUS_ROLE: 'witness', LEGASUS_REQUEST: o.request ? '1' : '0',
    LEGASUS_REQUEST_DELAY: String(o.requestDelay ?? 0), LEGASUS_RESOLVE_ONLY: '0', NODE_OPTIONS: `--import ${MECH_URL}` };
  spawnSync(process.execPath, ['--import', MECH_URL, join(FIX, 'witness.js')], { cwd: FIX, env, encoding: 'utf8', timeout: 60_000 });
  await sleep(300);
  if (worker) { try { worker.kill(); } catch { /* exited */ } }
  const events = [...read(trace).map((m) => ({ kind: 'execution', role: m.role, identity: m.loaded, at: m.at })),
    ...read(requests).map((q) => ({ kind: 'request', role: 'witness', identity: null, at: q.at })),
    ...read(ops).map((q) => ({ kind: 'operation-start', role: q.role, identity: null, at: q.at }))]
    .sort((a, b) => a.at - b.at).map((e, i) => ({ rank: i, kind: e.kind, role: e.role, identity: e.identity }));
  return { events, servedCount: read(mech).filter((m) => m.event === 'served').length };
}

const genuineWorlds = {
  P1: { worker: 'none', request: true },
  P2: { worker: 'none', request: false },
  P3: { worker: 'on-timer', request: false },
  P4: { worker: 'on-timer', request: true, workerDelay: 700, requestDelay: 0 },
  P5: { worker: 'none', request: false },
};

const step12 = JSON.parse(readFileSync(join(outDir, 'survivors.json'), 'utf8'));
const out = [];
for (const r of step12.results) {
  const genuine = await runWorld(`${r.id}-genuine`, genuineWorlds[r.prop]);
  const same = JSON.stringify(genuine) === JSON.stringify(r.hostileBundle);
  out.push({ id: r.id, prop: r.prop, text: r.text, deathKind: same ? 'EVIDENCE_LIMIT' : 'DECIDER_WEAKNESS',
    note: same ? 'the genuine-true bundle and the hostile bundle are identical: no decider over these recorded fields separates them'
      : 'the bundles differ, so the record holds something this decider did not consult - the proposition is not shown unidentifiable, only this decider unsound',
    genuineBundle: genuine, hostileBundle: r.hostileBundle });
  console.log(`  ${r.id} (${r.prop}) ${out[out.length - 1].deathKind}`);
}

const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
writeFileSync(join(outDir, 'death-kinds.json'), JSON.stringify({ at: new Date().toISOString(), postHoc: true,
  caveat: 'run AFTER step 12 and labelled post-hoc; it characterises the deaths, it does not rescue any proposition',
  results: out, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length }, null, 2));
console.log(`\nevidence limits: ${out.filter((x) => x.deathKind === 'EVIDENCE_LIMIT').map((x) => x.prop).join(', ') || 'none'}`);
console.log(`decider weaknesses: ${out.filter((x) => x.deathKind === 'DECIDER_WEAKNESS').map((x) => x.prop).join(', ') || 'none'}`);
console.log(`-> ${join(outDir, 'death-kinds.json')}`);
