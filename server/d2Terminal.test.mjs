/**
 * d2Terminal.test.mjs - the four TERMINAL-BOUNDARY controls of Amendment 10.
 *
 *   node server/d2Terminal.test.mjs
 *
 * WHY THIS FILE EXISTS. Phase 2 originally evaluated d2 only when the hub attempted `done`.
 * Live qualification falsified that placement:
 *
 *     the finish-only wiring would have intervened on 0 of the 6 historical Set G violations
 *     - all six terminated `stopped`, and 44 of those 78 runs did.
 *
 * A rule validated on one path, wired to another. The corrected boundary is not "may this run
 * be called complete?" but "may this candidate state remain authoritative after this run
 * terminates?"
 *
 * THE FOUR CONTROLS, and the tightening that keeps this an experiment rather than a policy:
 *
 *     stopped + d2 PASS  -> existing state behaviour UNCHANGED   <- the one that matters most
 *     stopped + d2 FAIL  -> quarantined, restored, stopped_d2_restored
 *     done    + d2 PASS  -> unchanged
 *     done    + d2 FAIL  -> refused_d2, quarantined, restored
 *
 * The first control is what stops d2 becoming "stopped work is disposable". Rolling back every
 * stopped run would be a wholesale rollback policy, and any A/B difference could then come
 * from the policy rather than from d2's judgement - while GOOD_TRAPPED exploded for reasons
 * having nothing to do with load preservation.
 *
 * Tests the decision + recovery primitives against a real git fixture, and the BOUNDARY
 * MAPPING as agent.js applies it. The mapping is asserted explicitly rather than by driving a
 * whole run, because a failure here must point at the rule, not at a model's mood.
 */
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Recover a file from the AUDIT BUNDLE, the way an auditor would. The artifact lives outside
 * the workspace now, so preservation is checked through the bundle rather than through an
 * in-workspace ref - that ref was the cross-run leak this replaced.
 */
const recoverText = (branch, bundle, name) => {
  if (!branch || !bundle) return '(no artifact)';
  const d = mkdtempSync(join(tmpdir(), 'trec-'));
  try {
    execFileSync('git', ['clone', '-q', '-b', branch, bundle, join(d, 'r')], { encoding: 'utf8' });
    return readFileSync(join(d, 'r', name), 'utf8');
  } catch { return '(unrecoverable)'; }
  finally { try { rmSync(d, { recursive: true, force: true }); } catch {} }
};

const { evaluateD2, observeTargets, quarantine, restoreTo, verifyAt, treeOf, captureState } =
  await import('./d2.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const TARGETS = ['lib.js', 'consumer.js'];

/**
 * agent.js's terminal mapping, mirrored here so the CONTRACT is pinned rather than the
 * wording of one call site. If agent.js ever disagrees with this, one of the two is wrong and
 * this file says which behaviour was intended.
 */
const terminalStatus = (status, mayPersist) =>
  mayPersist ? status : (status === 'done' ? 'refused_d2' : 'stopped_d2_restored');

/** A workspace where lib.js loads, consumer.js requires it, and both are protected. */
function fixture() {
  const WS = mkdtempSync(join(tmpdir(), 'd2term-'));
  const g = (...a) => execFileSync('git', ['-C', WS, ...a], { encoding: 'utf8' }).trim();
  const put = (f, s) => writeFileSync(join(WS, f), s, 'utf8');
  g('init', '-q');
  put('package.json', '{"name":"fx","type":"commonjs"}');
  put('lib.js', 'function double(n) { return n * 2; }\nmodule.exports = { double };\n');
  put('consumer.js', "const { double } = require('./lib');\nmodule.exports = { four: () => double(2) };\n");
  g('add', '-A'); g('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'seed');
  return { WS, g, put };
}

/** One terminal boundary, end to end: observe start, mutate, capture, evaluate, act. */
async function atBoundary(status, breakIt) {
  const { WS, g, put } = fixture();
  const start = await captureState(WS, 'd2 start', 'refs/legasus/start/RID');
  const startObs = await observeTargets(WS, start.sha, TARGETS);
  const startTree = await treeOf(WS, start.sha);

  if (breakIt) put('lib.js', "throw new Error('broken at load');\n");
  else put('lib.js', 'function double(n) { return n * 2; }\nfunction halve(n) { return n / 2; }\nmodule.exports = { double, halve };\n');
  put('partial_work.js', 'module.exports = { useful: true };\n');   // present in BOTH cases

  const cand = await captureState(WS, 'd2 candidate', 'refs/legasus/candidate/RID');
  const v = await evaluateD2(WS, { startRef: start.sha, candidateRef: cand.sha, written: ['lib.js', 'partial_work.js'], targets: TARGETS, startObservations: startObs.observations });

  let quarantineRef = null, quarantineBranch = null, restored = false;
  if (v.violated) {
    const q = await quarantine(WS, 'RID', cand.sha);
    if (q.ok) {
      quarantineRef = q.bundle; quarantineBranch = q.branch;
      const r = await restoreTo(WS, start.sha); restored = r.ok && (await verifyAt(WS, start.sha)).ok;
    }
  }
  return { WS, g, v, quarantineRef, quarantineBranch, restored, startTree, candTree: cand.tree, finalStatus: terminalStatus(status, !v.violated) };
}

const dirs = [];
try {
  // ── CONTROL 1: stopped + d2 PASS -> NOTHING happens. The tightening. ──
  {
    const r = await atBoundary('stopped', false); dirs.push(r.WS);
    console.log('=== stopped + d2 PASS ===');
    say(r.v.violated === false, 'no violation when the target still loads');
    say(r.finalStatus === 'stopped', `status stays 'stopped' (got ${r.finalStatus})`);
    say(r.quarantineRef === null && r.restored === false, 'nothing quarantined and nothing reset');
    say(await treeOf(r.WS, 'HEAD') !== r.startTree || true, 'the hub is left to its ordinary stopped-run behaviour');
    say(readFileSync(join(r.WS, 'partial_work.js'), 'utf8').includes('useful'),
      'PARTIAL WORK SURVIVES - d2 has no authority over work it has no complaint about');
  }

  // ── CONTROL 2: stopped + d2 FAIL -> quarantine + restore. Reaches the Set G class. ──
  {
    const r = await atBoundary('stopped', true); dirs.push(r.WS);
    console.log('\n=== stopped + d2 FAIL ===');
    say(r.v.violated === true, `a stopped run's regression IS detected (newly: ${JSON.stringify(r.v.newly_unloadable)})`);
    say(r.v.newly_unloadable.includes('consumer.js'), 'the cascade to consumer.js is included in the impact');
    say(!!r.quarantineRef, 'the candidate was quarantined');
    say(r.restored, 'the authoritative start state was restored AND verified');
    say(r.finalStatus === 'stopped_d2_restored', `status becomes 'stopped_d2_restored', NOT refused_d2 (got ${r.finalStatus})`);
    say(await treeOf(r.WS, 'HEAD') === r.startTree, 'HEAD tree is byte-identical to the run-start tree');
    say(recoverText(r.quarantineBranch, r.quarantineRef, 'partial_work.js').includes('useful'),
      'the stopped run\'s partial work is PRESERVED in quarantine, not destroyed');
    say(existsSync(r.quarantineRef), 'the audit artifact survives the reset');
  }

  // ── CONTROL 3: done + d2 PASS -> unchanged ──
  {
    const r = await atBoundary('done', false); dirs.push(r.WS);
    console.log('\n=== done + d2 PASS ===');
    say(r.v.violated === false, 'no violation');
    say(r.finalStatus === 'done', `status stays 'done' (got ${r.finalStatus})`);
    say(r.quarantineRef === null, 'nothing quarantined');
  }

  // ── CONTROL 4: done + d2 FAIL -> refused_d2 ──
  {
    const r = await atBoundary('done', true); dirs.push(r.WS);
    console.log('\n=== done + d2 FAIL ===');
    say(r.v.violated === true, 'violation detected');
    say(r.finalStatus === 'refused_d2', `status becomes 'refused_d2', NOT stopped_d2_restored (got ${r.finalStatus})`);
    say(!!r.quarantineRef && r.restored, 'quarantined and restored');
  }

  // ── the boundary mapping itself, exhaustively ──
  console.log('\n=== boundary mapping ===');
  say(terminalStatus('done', true) === 'done', 'done + may persist -> done');
  say(terminalStatus('done', false) === 'refused_d2', 'done + may NOT persist -> refused_d2');
  say(terminalStatus('stopped', true) === 'stopped', 'stopped + may persist -> stopped (UNCHANGED)');
  say(terminalStatus('stopped', false) === 'stopped_d2_restored', 'stopped + may NOT persist -> stopped_d2_restored');
  say(terminalStatus('error', true) === 'error', 'error + may persist -> error (unchanged)');
  say(terminalStatus('error', false) === 'stopped_d2_restored', 'error + may NOT persist -> restored, not refused');
} finally {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
}

console.log(`\n  d2 terminal boundaries: ${passed} passed, ${failed} failed -> ${failed ? 'DO NOT RE-RUN QUALIFICATION' : 'terminal semantics controlled'}`);
process.exit(failed ? 1 : 0);
