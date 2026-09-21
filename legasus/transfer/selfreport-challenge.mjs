/**
 * selfreport-challenge.mjs - BIND-CJS step 15 (legasus/BIND-CJS_SELFREPORT.md, 6f62025).
 *
 *   node legasus/transfer/selfreport-challenge.mjs <out-dir>
 *
 * The first PROSPECTIVE test of the self-report pattern. D-P8 was frozen in the preregistration
 * and is not modified here. The oracle channel records the underlying truth and the decider
 * never reads it.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIX = join(HERE, 'sr-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'selfreport'));
mkdirSync(outDir, { recursive: true });
const spawnedPids = [];

/** D-P8, frozen in the preregistration: a line matching ^PASS <id> on stdout. */
const DP8 = (stdout, id) => new RegExp(`^PASS ${id}\\s*$`, 'm').test(stdout);

async function runWorld(tag, mode) {
  const oracle = join(outDir, `${tag}.oracle.jsonl`);
  rmSync(oracle, { force: true });
  const child = spawn(process.execPath, [join(FIX, 'witness.js')], {
    cwd: FIX, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, LEGASUS_SR_MODE: mode, LEGASUS_ORACLE: oracle },
  });
  spawnedPids.push({ tag, pid: child.pid });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  const code = await new Promise((done) => child.on('close', (c) => done(c)));
  let oracleRecs = [];
  try { oracleRecs = readFileSync(oracle, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { /* none */ }
  return { tag, mode, exit: code, stdout: out, stderr: err,
    underlyingTruth: oracleRecs.length ? oracleRecs[0].assertionHeld : null,
    deciderSays: DP8(out, 'joins with a plus'), stdoutLines: out.split('\n').filter(Boolean).length };
}

const worlds = [
  { tag: 'CTL-PASS', mode: 'genuine-pass', expectDecider: true, expectTruth: true },
  { tag: 'CTL-FAIL', mode: 'genuine-fail', expectDecider: false, expectTruth: false },
  { tag: 'R1-FORGED', mode: 'forged', expectDecider: true, expectTruth: false },
  { tag: 'R2-LOST', mode: 'lost', expectDecider: false, expectTruth: true },
];

const results = [];
for (const w of worlds) {
  // genuine-fail needs an assertion that actually fails; 'forged' already supplies one.
  const r = await runWorld(w.tag, w.mode === 'genuine-fail' ? 'forged-but-honest' : w.mode);
  results.push({ ...w, ...r, deciderMatchedExpectation: r.deciderSays === w.expectDecider, truthMatchedExpectation: r.underlyingTruth === w.expectTruth });
  const x = results[results.length - 1];
  console.log(`  ${w.tag.padEnd(10)} underlyingTruth=${String(x.underlyingTruth).padEnd(5)} D-P8=${String(x.deciderSays).padEnd(5)} exit=${x.exit} stdoutLines=${x.stdoutLines} ${x.deciderSays !== x.underlyingTruth ? '<< DECIDER AND REALITY DISAGREE' : ''}`);
}

const ctlPass = results.find((r) => r.tag === 'CTL-PASS');
const ctlFail = results.find((r) => r.tag === 'CTL-FAIL');
const r1 = results.find((r) => r.tag === 'R1-FORGED');
const r2 = results.find((r) => r.tag === 'R2-LOST');
const ctlOk = ctlPass.deciderSays === true && ctlPass.underlyingTruth === true && ctlFail.deciderSays === false && ctlFail.underlyingTruth === false;

const scoring = {
  'R-CTL': ctlOk ? 'HELD - both controls behave, so the expedition is informative' : 'FAILED - the expedition is void, not informative',
  R1: !ctlOk ? 'not evaluated' : (r1.deciderSays === true && r1.underlyingTruth === false)
    ? 'CONFIRMED - the decider affirms a case that did not pass, because the subject emitted the expected field value. THE PATTERN MADE A PROSPECTIVE PREDICTION AND IT LANDED.'
    : `FALSIFIED - decider=${r1.deciderSays}, underlying truth=${r1.underlyingTruth}. The self-report pattern's first prospective test has failed and is NOT reinterpreted.`,
  R2: !ctlOk ? 'not evaluated' : (r2.deciderSays === false && r2.underlyingTruth === true)
    ? 'CONFIRMED - the line was lost to an abrupt exit; the decider declines a case that did pass'
    : `FALSIFIED - the written line survived the abrupt exit (decider=${r2.deciderSays}); only the forward direction stands`,
};

const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
writeFileSync(join(outDir, 'selfreport.json'), JSON.stringify({ at: new Date().toISOString(),
  decider: 'D-P8, frozen in the preregistration: a ^PASS <id> line on stdout', results, scoring,
  processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length } }, null, 2));
console.log(`\nR-CTL ${scoring['R-CTL']}\nR1 ${scoring.R1}\nR2 ${scoring.R2}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${sweep.filter((s) => s.aliveAtSweep).length} alive at sweep`);
console.log(`-> ${join(outDir, 'selfreport.json')}`);
