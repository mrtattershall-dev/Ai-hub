/**
 * acceptance.test.mjs - THE ACCEPTANCE POLICY, on PILOT-2's real candidates.
 *
 *   node server/acceptance.test.mjs
 *
 * PILOT-2 DETECTED a behavioural regression and let it SURVIVE. This closes that gap, and it is
 * exercised on the actual preserved workspaces from that run - no new model calls, so the
 * candidates are exactly what the 7B produced.
 *
 *   t5  the real regression: cartTotal(items) returns NaN. Must be captured, rolled back, and
 *       the restored workspace re-verified.
 *   t2  a real success. CONTROL: the same policy must not disturb it.
 *   t3  a second real success. CONTROL.
 *
 * The controls are the point. A policy that rejects everything would "pass" the t5 case while
 * destroying the two verified improvements the run produced.
 *
 * CANDIDATE AND SURVIVING VERDICTS ARE ASSERTED SEPARATELY. After a successful restore the
 * workspace is clean - and the record must still show that the MODEL broke it, or rolling back
 * would launder the regression out of the history.
 */
import { mkdtempSync, cpSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'legasus', 'fixtures', 'pilot2');

const { PILOT_TASKS } = await import('./pilotTasks.js');
const { evaluate, VERDICT } = await import('./evaluator.js');
const { applyAcceptance, DISPOSITION } = await import('./acceptance.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };
const note = (m) => console.log(`        ${m}`);

const byId = Object.fromEntries(PILOT_TASKS.map((t) => [t.id, t]));
const dirs = [];

/**
 * Rebuild one PILOT-2 candidate: the SEED as the verified starting state, then the candidate's
 * files on top as an uncommitted change. That is the shape the policy meets at a finish
 * boundary, and it gives a real startRef to restore to.
 */
function stage(taskId) {
  const task = byId[taskId];
  const ws = mkdtempSync(join(tmpdir(), 'acc-'));
  dirs.push(ws);
  const g = (...a) => execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', stdio: 'pipe' });
  for (const [f, body] of Object.entries(task.seed)) writeFile(join(ws, f), body);
  g('init', '-q'); g('add', '-A'); g('-c', 'user.email=a@a', '-c', 'user.name=a', 'commit', '-q', '-m', 'verified starting state');
  const startRef = g('rev-parse', 'HEAD').trim();
  // overlay the candidate the 7B actually produced
  cpSync(join(FIXTURES, taskId), ws, { recursive: true, filter: (src) => !src.includes('.git') });
  return { ws, task, startRef, g };
}
function writeFile(p, body) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, body, 'utf8'); }

try {
  if (!existsSync(FIXTURES)) { console.error(`missing fixtures: ${FIXTURES}`); process.exit(2); }

  // ── 1. t5 — THE DETECTED REGRESSION MUST NOT SURVIVE ──
  console.log('=== 1. t5: the real regression PILOT-2 allowed to survive ===');
  {
    const { ws, task, startRef } = stage('t5-multifile-node-discount');
    const cap = mkdtempSync(join(tmpdir(), 'cap-')); dirs.push(cap);

    const before = await evaluate(ws, task);
    say(before.protected?.verdict === VERDICT.FAIL, `the candidate FAILS the protected check (${before.protected?.verdict})`);
    note('This is the 7B\'s own output: cartTotal(items) returns NaN.');

    const r = await applyAcceptance(ws, task, before, { startRef, captureDir: cap, taskId: task.id });

    say(r.disposition === DISPOSITION.RESTORED, `disposition = RESTORED (${r.disposition})`);
    say(!!r.capturedAt && existsSync(r.capturedAt), 'the rejected candidate was CAPTURED before the rollback');
    say(existsSync(join(r.capturedAt, 'cart.js')) && readFileSync(join(r.capturedAt, 'cart.js'), 'utf8').includes('1 - percent / 100'),
      'and the capture still holds the broken code, so the damage is auditable');

    // THE TWO VERDICTS, SEPARATELY.
    say(r.candidateVerdict.protected === VERDICT.FAIL, 'CANDIDATE verdict still records protected=FAIL after the rollback');
    say(r.survivingWorkspaceVerdict.protected === VERDICT.PASS, `SURVIVING workspace verdict is protected=PASS (${r.survivingWorkspaceVerdict.protected})`);
    note('Reported separately on purpose: a clean workspace afterwards must not read as');
    note('though the model never broke it.');

    // and the workspace really is the starting state, checked on behaviour not on a hash
    const cart = readFileSync(join(ws, 'cart.js'), 'utf8');
    say(!cart.includes('1 - percent / 100'), 'the broken code is gone from the working tree');
    let total = null;
    try { total = JSON.parse(execFileSync(process.execPath, ['-e', 'const c=require(process.argv[1]); process.stdout.write(JSON.stringify(c.cartTotal([{price:10,qty:2},{price:5,qty:1}])))', join(ws, 'cart.js')], { encoding: 'utf8' })); } catch { /* stays null */ }
    say(total === 25, `and cartTotal(items) is 25 again, not NaN (got ${total})`);
    say(r.countsAsCompletion === false, 'a restored task is NOT counted as a completion');
    say(r.promotable === false, 'and is not promotable as a later baseline');
  }

  // ── 2. t2 and t3 — CONTROLS: successful work must SURVIVE the same policy ──
  console.log('\n=== 2. CONTROLS: the two real successes must be retained ===');
  for (const id of ['t2-repair-python-parse', 't3-add-node-median']) {
    const { ws, task, startRef } = stage(id);
    const cap = mkdtempSync(join(tmpdir(), 'cap-')); dirs.push(cap);
    const before = await evaluate(ws, task);
    const r = await applyAcceptance(ws, task, before, { startRef, captureDir: cap, taskId: id });
    say(before.verdict === VERDICT.PASS, `${id}: the candidate passes both checks (${before.verdict})`);
    say(r.disposition === DISPOSITION.RETAIN, `${id}: RETAINED (${r.disposition})`);
    say(r.countsAsCompletion === true, `${id}: counts as a verified completion`);
    say(r.survivingWorkspaceVerdict.overall === VERDICT.PASS, `${id}: the SURVIVING workspace still passes (${r.survivingWorkspaceVerdict.overall})`);
  }
  note('A policy that rejected everything would pass the t5 case and destroy these two.');

  // ── 3. protected PASS + requested FAIL -> preserved, but NOT a completion or a baseline ──
  console.log('\n=== 3. incomplete work is preserved, not promoted ===');
  {
    // t1's real candidate: it changed nothing, so protected passes and requested fails.
    const { ws, task, startRef } = stage('t2-repair-python-parse');
    const cap = mkdtempSync(join(tmpdir(), 'cap-')); dirs.push(cap);
    // force the requested check to fail while protected still passes
    const partial = { ...task, requested: { script: 'exit 1' } };
    const v = await evaluate(ws, partial);
    const r = await applyAcceptance(ws, partial, v, { startRef, captureDir: cap, taskId: 'partial-case' });
    say(r.disposition === DISPOSITION.PRESERVE_INCOMPLETE, `PRESERVE_INCOMPLETE (${r.disposition})`);
    say(r.countsAsCompletion === false, 'not counted as a completion');
    say(r.promotable === false, 'and NOT promoted into a later baseline - passing a limited preservation suite does not make a partial change fit to build on');
    say(existsSync(join(ws, 'parser.py')), 'the work itself is still there, preserved rather than discarded');
  }

  // ── 4. EVALUATION_ERROR -> hold the candidate, promote nothing ──
  console.log('\n=== 4. an evaluation error promotes nothing ===');
  {
    const { ws, task, startRef } = stage('t2-repair-python-parse');
    const cap = mkdtempSync(join(tmpdir(), 'cap-')); dirs.push(cap);
    const broken = await evaluate(ws, task, { image: 'sha256:' + '0'.repeat(64) });
    say(broken.verdict === VERDICT.EVALUATION_ERROR, `the instrument failed (${broken.verdict})`);
    const r = await applyAcceptance(ws, task, broken, { startRef, captureDir: cap, taskId: 'evalerr-case' });
    say(r.disposition === DISPOSITION.HELD, `HELD (${r.disposition})`);
    say(!!r.capturedAt && existsSync(r.capturedAt), 'the candidate is preserved SEPARATELY');
    say(r.promotable === false && r.countsAsCompletion === false, 'nothing is promoted and nothing is counted');
    say(r.survivingWorkspaceVerdict.overall === VERDICT.EVALUATION_ERROR, 'and the surviving verdict says the instrument failed, not that the code did');
  }
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
}

console.log(`\n  acceptance policy: ${passed} passed, ${failed} failed -> ${failed ? 'DETECTED DAMAGE CAN STILL SURVIVE' : 'the verdict now decides what survives'}`);
process.exit(failed ? 1 : 0);
