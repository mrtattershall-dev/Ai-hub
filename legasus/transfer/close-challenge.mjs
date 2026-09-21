/**
 * close-challenge.mjs - BIND-CJS step 17 (legasus/BIND-CJS_CLOSE.md, 0f7d197).
 * Two named experiments that close this branch. No repair, no descent.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const DISC = join(HERE, 'disc-fixture');
const BND = join(HERE, 'bnd-fixture');
const MECH_URL = pathToFileURL(join(ROOT, 'legasus', 'cjs-preload.mjs')).href;
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'close'));
mkdirSync(outDir, { recursive: true });
const spawnedPids = [];
const ID = 'joins with a plus';
const read = (p) => { try { return readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runProc(tag, cwd, script, env, preload) {
  return new Promise((done) => {
    const args = preload ? ['--import', pathToFileURL(preload).href, script] : [script];
    const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    spawnedPids.push({ tag, pid: child.pid });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', (code) => done({ out, code }));
  });
}

// ---- Experiment 1: N-ADV ---------------------------------------------------------------------
console.log('N-ADV: the readable-nonce attack on H1');
const nadv = [];
for (const [tag, mode] of [['ctl-pass', 'genuine-pass'], ['ctl-fail', 'genuine-fail'], ['N-ADV', 'forge-adversarial']]) {
  const oracle = join(outDir, `nadv-${tag}.oracle.jsonl`);
  rmSync(oracle, { force: true });
  const nonce = randomBytes(6).toString('hex');
  const r = await runProc(`nadv-${tag}`, DISC, join(DISC, 'bound-witness.js'),
    { ...process.env, LEGASUS_DISC_MODE: mode, LEGASUS_ORACLE: oracle, LEGASUS_NONCE: nonce }, join(DISC, 'checkpreload.mjs'));
  const decider = new RegExp(`^PASS ${nonce} ${ID}\\s*$`, 'm').test(r.out);
  const o = read(oracle);
  nadv.push({ tag, mode, decider, underlyingTruth: o.length ? o[0].assertionHeld : null, stdout: r.out.trim().replace(/\n/g, ' | ') });
  const x = nadv[nadv.length - 1];
  console.log(`  ${tag.padEnd(9)} truth=${String(x.underlyingTruth).padEnd(5)} decider=${String(x.decider).padEnd(5)} ${x.decider !== x.underlyingTruth ? '<< DISAGREE' : ''}  ${x.stdout}`);
}
const nCtlOk = nadv[0].decider === true && nadv[1].decider === false;
const nAdv = nadv[2];
const h1Holds = nAdv.decider === true && nAdv.underlyingTruth === false;

// ---- Experiment 2: P2-MIN ---------------------------------------------------------------------
console.log('\nP2-MIN: minimised worlds for "M was supplied to an actual evaluation"');
const TARGET = join(BND, 'target.js');
const MUTANT = join(BND, 'mutant.js');
const IMPOSTOR = join(BND, 'impostor.js');
async function p2World(tag, serveTo) {
  const trace = join(outDir, `p2-${tag}.marks.jsonl`); const mech = join(outDir, `p2-${tag}.mech.jsonl`);
  const requests = join(outDir, `p2-${tag}.requests.jsonl`); const trigger = join(outDir, `p2-${tag}.trigger`);
  for (const f of [trace, mech, requests, trigger]) rmSync(f, { force: true });
  const env = { ...process.env, LEGASUS_PROBE_TRACE: trace, LEGASUS_CJS_LOG: mech, LEGASUS_REQUESTS: requests,
    LEGASUS_TRIGGER: trigger, LEGASUS_OPS: join(outDir, `p2-${tag}.ops.jsonl`), LEGASUS_ROLE: 'witness',
    LEGASUS_REQUEST: '0', LEGASUS_REQUEST_DELAY: '0', LEGASUS_RESOLVE_ONLY: '0', LEGASUS_SELF_WORKER: '0',
    LEGASUS_OPS_MARK: '0', LEGASUS_CJS_MAP: JSON.stringify([{ from: TARGET, to: serveTo }]), NODE_OPTIONS: `--import ${MECH_URL}` };
  await runProc(`p2-${tag}`, BND, join(BND, 'witness.js'), env, join(ROOT, 'legasus', 'cjs-preload.mjs'));
  await sleep(150);
  const events = read(trace).map((m) => ({ kind: 'execution', role: m.role, identity: m.loaded, at: m.at }))
    .sort((a, b) => a.at - b.at).map((e, i) => ({ rank: i, kind: e.kind, role: e.role, identity: e.identity }));
  return { events, servedCount: read(mech).filter((m) => m.event === 'served').length };
}
const p2True = await p2World('true', MUTANT);
const p2False = await p2World('false', IMPOSTOR);
const p2Identical = JSON.stringify(p2True) === JSON.stringify(p2False);
console.log(`  P2-true  (M served+evaluated):        served=${p2True.servedCount} events=${p2True.events.map((e) => e.role + ':' + e.identity).join(' > ')}`);
console.log(`  P2-false (impostor served+evaluated): served=${p2False.servedCount} events=${p2False.events.map((e) => e.role + ':' + e.identity).join(' > ')}`);
console.log(`  bundles ${p2Identical ? 'IDENTICAL - P2 joins the evidence-limit group' : 'DIFFER - the difference is the next target, no rescue written'}`);

const scoring = {
  'N-ADV-CTL': nCtlOk ? 'HELD' : 'FAILED - N-ADV is void',
  'N-ADV': !nCtlOk ? 'not evaluated' : h1Holds
    ? 'H1 HELD - a forger that read the nonce affirmed a false case, so step 16 D1 resisted only a naive forger, exactly as its caveat said'
    : 'H1 IN TROUBLE - the tagged forgery did not affirm; something other than independence is binding the representation',
  'P2-MIN': p2Identical ? 'CONFIRMED - the bundles are identical; P2 joins P1/P3/P5/P6/P7 as an evidence limit under this configuration'
    : 'FALSIFIED - a difference remains; named and left as the next target, with no third rescue written',
};
const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
writeFileSync(join(outDir, 'close.json'), JSON.stringify({ at: new Date().toISOString(), nadv, p2: { p2True, p2False, identical: p2Identical },
  scoring, processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length } }, null, 2));
console.log(`\nN-ADV ${scoring['N-ADV']}\nP2-MIN ${scoring['P2-MIN']}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${sweep.filter((s) => s.aliveAtSweep).length} alive at sweep`);
console.log(`-> ${join(outDir, 'close.json')}`);
