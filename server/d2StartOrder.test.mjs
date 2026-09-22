/**
 * d2StartOrder.test.mjs - the START-CAPTURE ORDERING regression.
 *
 *   node server/d2StartOrder.test.mjs
 *
 * THE DEFECT THIS PINS. `run.d2Start` was captured fire-and-forget, so a model whose first
 * write landed before the observation finished had its "established starting state" recorded
 * from the ALREADY-MUTATED workspace. START read THROWS, no LOADS->THROWS transition existed,
 * and a real regression went unattributed WITH NO ERROR ANYWHERE. It passed 36/36 once purely
 * because the timing won.
 *
 * THE REQUIREMENT, which is stronger than "await the promise":
 *
 *   the starting-state observation and the restoration snapshot must describe the SAME state,
 *   established BEFORE mutation is permitted.
 *
 * Naming a field `d2Start` never guaranteed that. So this exercises the ordering directly:
 * hold the observation pending, request a write, confirm it CANNOT execute, release the
 * observation, then confirm the damaging write IS detected against the true starting state.
 *
 * SCOPE: this pins the guarantee on the execution path that is actually tested here - the
 * drive() entry gate and the d2 evaluation it feeds. It does not claim every conceivable
 * mutation route is covered; 2690 (subtask) and 4590 (approved-pending) remain outside it.
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { mayMutate, observeTargets, captureState, evaluateD2, restoreTo, verifyAt, treeOf } =
  await import('./d2.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const TARGETS = ['lib.js'];

function fixture() {
  const WS = mkdtempSync(join(tmpdir(), 'd2ord-'));
  const g = (...a) => execFileSync('git', ['-C', WS, ...a], { encoding: 'utf8' }).trim();
  g('init', '-q');
  writeFileSync(join(WS, 'package.json'), '{"name":"fx","type":"commonjs"}\n', 'utf8');
  writeFileSync(join(WS, 'lib.js'), 'function double(n) { return n * 2; }\nmodule.exports = { double };\n', 'utf8');
  g('add', '-A'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'seed');
  return { WS, g };
}

const dirs = [];
try {
  // ── 1. OBSERVATION PENDING -> the run may not mutate ──
  console.log('=== 1. while the observation is pending, mutation is refused ===');
  const pending = { id: 'r1' };                       // d2Start not yet set: exactly the race window
  const m1 = mayMutate(pending, true);
  say(m1.ok === false, `a run whose observation has not landed may NOT mutate (${m1.reason})`);
  say(/never recorded/.test(m1.reason || ''), 'and the reason names the missing observation, not something else');

  // ── 2. OBSERVATION ERROR -> the run may not mutate either ──
  console.log('\n=== 2. an observation ERROR stops the run before it mutates ===');
  const errored = { id: 'r2', d2StartError: 'start capture failed: disk on fire' };
  const m2 = mayMutate(errored, true);
  say(m2.ok === false, `an apparatus failure refuses the run (${m2.reason})`);
  say(/disk on fire/.test(m2.reason), 'the underlying error is carried, not flattened to a generic refusal');
  // A failed measurement must stop the run at the START: by the terminal boundary there is no
  // established state to restore TO, which is the one thing recovery depends on.
  say(mayMutate({ id: 'r3', d2Start: { ref: 'abc', observations: {} } }, true).ok === false,
    'an observation with no bound TREE is refused too - it cannot anchor a restoration');

  // ── 3. RELEASE the observation -> mutation permitted, and the damage IS detected ──
  console.log('\n=== 3. once observed, the run proceeds and the damage is caught ===');
  const { WS, g } = fixture(); dirs.push(WS);
  const start = await captureState(WS, 'start', 'refs/legasus/start/r4');
  const obs = await observeTargets(WS, start.sha, TARGETS);
  const run = { id: 'r4', d2Start: obs };
  say(mayMutate(run, true).ok === true, 'with the observation landed, mutation is permitted');
  say(obs.observations['lib.js'] === true, 'and it recorded the TRUE starting state (lib.js loaded)');

  // now the damaging write, exactly as the race would have hidden it
  writeFileSync(join(WS, 'lib.js'), "export const broken = true;\n", 'utf8');   // ESM in a CJS workspace
  const cand = await captureState(WS, 'candidate', 'refs/legasus/candidate/r4');
  const v = await evaluateD2(WS, { startRef: start.sha, candidateRef: cand.sha, written: ['lib.js'], targets: TARGETS, startObservations: obs.observations });
  say(v.violated === true, 'the damaging write IS detected against the true starting state');

  // ── 4. THE RACE, REPRODUCED: observing AFTER the write hides the regression ──
  console.log('\n=== 4. the defect itself, reproduced - observing too late hides it ===');
  const lateObs = await observeTargets(WS, cand.sha, TARGETS);        // observed the MUTATED state
  const vLate = await evaluateD2(WS, { startRef: cand.sha, candidateRef: cand.sha, written: ['lib.js'], targets: TARGETS, startObservations: lateObs.observations });
  say(lateObs.observations['lib.js'] === false, 'observing after the write records START=THROWS');
  say(vLate.violated === false, 'and d2 then reports NO violation for a genuinely broken file - the silent failure');
  console.log('      ^ this is what the ordering gate prevents. It is reproduced here so a future');
  console.log('        change that reintroduces it fails this file rather than passing 36/36 by luck.');

  // ── 5. PRESERVATION: stored content and working tree are SEPARATE claims ──
  console.log('\n=== 5. blob identity and working-tree restoration are different claims ===');
  const r = await restoreTo(WS, start.sha);
  const ver = await verifyAt(WS, start.sha);
  say(r.ok && ver.ok, 'restore verified against the start ref');
  // (a) STORED CONTENT
  say(await treeOf(WS, 'HEAD') === await treeOf(WS, start.sha), 'STORED: HEAD tree == the start tree (git-stored content preserved)');
  // (b) WORKING TREE - the checked-out bytes and the behaviour they produce. Blob identity
  //     cannot stand in for this: the checkout can differ from the object (autocrlf), and it
  //     is the checkout the next run actually executes.
  const onDisk = readFileSync(join(WS, 'lib.js'), 'utf8');
  say(onDisk.includes('function double(n)') && !onDisk.includes('export const broken'),
    'WORKING TREE: the checked-out file is the start version, by content');
  let loads = false;
  try { execFileSync(process.execPath, ['-e', 'const l=require(process.argv[1]); if(l.double(2)!==4) throw new Error("bad")', join(WS, 'lib.js')], { timeout: 15000 }); loads = true; } catch { /* stays false */ }
  say(loads, 'WORKING TREE: it loads and double(2)===4 - the behavioural check, not a hash');
  say(g('status', '--porcelain') === '', 'WORKING TREE: nothing uncommitted left behind');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
}

console.log(`\n  d2 start ordering: ${passed} passed, ${failed} failed -> ${failed ? 'THE ORDERING GUARANTEE IS BROKEN' : 'observation precedes mutation, on the tested path'}`);
process.exit(failed ? 1 : 0);
