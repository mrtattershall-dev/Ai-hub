/**
 * discriminate-challenge.mjs - BIND-CJS step 16 (legasus/BIND-CJS_DISCRIMINATE.md, 097a99e).
 *
 *   node legasus/transfer/discriminate-challenge.mjs <out-dir>
 *
 * Two worlds in which H0 (a program can emit false text) and H1 (an authority path fails when
 * the representation can vary independently of the event) predict OPPOSITE outcomes. Both
 * deciders are frozen in the preregistration. Nothing is repaired or renamed.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIX = join(HERE, 'disc-fixture');
const outDir = resolve(process.argv[2] || join(ROOT, 'legasus', 'out', 'discriminate'));
mkdirSync(outDir, { recursive: true });
const spawnedPids = [];
const ID = 'joins with a plus';

function runProc(tag, script, env, preload) {
  return new Promise((done) => {
    const args = preload ? ['--import', pathToFileURL(preload).href, script] : [script];
    const child = spawn(process.execPath, args, { cwd: FIX, env, stdio: ['ignore', 'pipe', 'pipe'] });
    spawnedPids.push({ tag, pid: child.pid });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => done({ out, err, code }));
  });
}
const oracleOf = (p) => { try { const l = readFileSync(p, 'utf8').split('\n').filter(Boolean).map((x) => JSON.parse(x)); return l.length ? l[0].assertionHeld : null; } catch { return null; } };

// ---- BOUND -----------------------------------------------------------------------------------
async function bound(tag, mode) {
  const oracle = join(outDir, `bound-${tag}.oracle.jsonl`);
  rmSync(oracle, { force: true });
  const nonce = randomBytes(6).toString('hex');
  const env = { ...process.env, LEGASUS_DISC_MODE: mode, LEGASUS_ORACLE: oracle, LEGASUS_NONCE: nonce };
  const r = await runProc(`bound-${tag}`, join(FIX, 'bound-witness.js'), env, join(FIX, 'checkpreload.mjs'));
  // THE DECIDER, frozen: only nonce-tagged lines count.
  const decider = new RegExp(`^PASS ${nonce} ${ID}\\s*$`, 'm').test(r.out);
  return { world: 'BOUND', tag, mode, nonce, stdout: r.out.trim(), underlyingTruth: oracleOf(oracle), decider };
}

// ---- OBSERVER --------------------------------------------------------------------------------
async function observer(tag, mode) {
  const oracle = join(outDir, `obs-${tag}.oracle.jsonl`);
  const state = join(outDir, `obs-${tag}.state.json`);
  rmSync(oracle, { force: true }); rmSync(state, { force: true });
  const env = { ...process.env, LEGASUS_DISC_MODE: mode, LEGASUS_ORACLE: oracle, LEGASUS_STATE: state };
  await runProc(`obs-${tag}-subject`, join(FIX, 'observer-witness.js'), env, null);
  const rep = await runProc(`obs-${tag}-observer`, join(FIX, 'observer.js'), env, null);
  // THE DECIDER, frozen: the ordinary PASS <id> line, now produced by a different process.
  const decider = new RegExp(`^PASS ${ID}\\s*$`, 'm').test(rep.out);
  return { world: 'OBSERVER', tag, mode, stdout: rep.out.trim(), underlyingTruth: oracleOf(oracle), decider };
}

const results = [];
results.push(await bound('ctl-pass', 'genuine-pass'));
results.push(await bound('ctl-fail', 'genuine-fail'));
results.push(await bound('D1', 'forge'));
results.push(await observer('ctl-pass', 'genuine-pass'));
results.push(await observer('ctl-fail', 'genuine-fail'));
results.push(await observer('D2', 'lie'));
for (const r of results) console.log(`  ${r.world.padEnd(9)} ${r.tag.padEnd(9)} truth=${String(r.underlyingTruth).padEnd(5)} decider=${String(r.decider).padEnd(5)} ${r.decider !== r.underlyingTruth ? '<< DECIDER AND REALITY DISAGREE' : ''}  stdout: ${r.stdout.replace(/\n/g, ' | ')}`);

const bCtlP = results.find((r) => r.world === 'BOUND' && r.tag === 'ctl-pass');
const bCtlF = results.find((r) => r.world === 'BOUND' && r.tag === 'ctl-fail');
const oCtlP = results.find((r) => r.world === 'OBSERVER' && r.tag === 'ctl-pass');
const oCtlF = results.find((r) => r.world === 'OBSERVER' && r.tag === 'ctl-fail');
const D1 = results.find((r) => r.tag === 'D1');
const D2 = results.find((r) => r.tag === 'D2');
const boundCtlOk = bCtlP.decider === true && bCtlF.decider === false;
const obsCtlOk = oCtlP.decider === true && oCtlF.decider === false;

const d1Declines = D1.decider === false;
const d2Affirms = D2.decider === true && D2.underlyingTruth === false;
let verdict;
if (!boundCtlOk || !obsCtlOk) verdict = 'VOID - a world\'s controls did not behave';
else if (d1Declines && d2Affirms) verdict = 'H1 DISCRIMINATED FROM H0 in both directions - the deeper layer is purchased';
else if (!d1Declines && !d2Affirms) verdict = 'H0 is the better account - the deeper layer is NOT purchased, and "self-report" was the operative property';
else verdict = 'MIXTURE - neither explanation is discriminated by this pair; no layer is purchased';

const scoring = {
  'D-CTL': `${boundCtlOk ? 'BOUND held' : 'BOUND FAILED'}; ${obsCtlOk ? 'OBSERVER held' : 'OBSERVER FAILED'}`,
  D1: d1Declines ? 'the naive forgery FAILED - H1 predicted this, H0 did not' : 'the naive forgery SUCCEEDED - H0 predicted this, H1 did not',
  D2: d2Affirms ? 'a faithful separate reporter affirmed a case that did not pass - H1 predicted this, H0 did not' : 'the separate reporter did not affirm a false case - H0 predicted this, H1 did not',
  verdict,
  boundCaveat: 'BOUND tested binding against a NAIVE forger only: the nonce lives in the witness environment and an adversarial subject could read it. A decline here does not establish that representations can be bound in-process.',
};

const sweep = [];
for (const s of spawnedPids) {
  const q = spawnSync('tasklist', ['/FI', `PID eq ${s.pid}`, '/NH'], { encoding: 'utf8', shell: false });
  const alive = /node\.exe/i.test(q.stdout || '');
  if (alive) spawnSync('taskkill', ['/PID', String(s.pid), '/T', '/F'], { stdio: 'ignore' });
  sweep.push({ ...s, aliveAtSweep: alive });
}
writeFileSync(join(outDir, 'discriminate.json'), JSON.stringify({ at: new Date().toISOString(),
  hypotheses: { H0: 'a program permitted to emit its own verdict can emit a false one', H1: 'an authority path fails when the representation it consumes can vary independently of the event it establishes' },
  results, scoring, processHygiene: { spawnedRecorded: spawnedPids.length, aliveAtSweep: sweep.filter((s) => s.aliveAtSweep).length } }, null, 2));
console.log(`\nD-CTL ${scoring['D-CTL']}\nD1 ${scoring.D1}\nD2 ${scoring.D2}\n=> ${verdict}`);
console.log(`process hygiene: ${spawnedPids.length} pids recorded, ${sweep.filter((s) => s.aliveAtSweep).length} alive at sweep`);
console.log(`-> ${join(outDir, 'discriminate.json')}`);
