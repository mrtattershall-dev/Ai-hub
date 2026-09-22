/**
 * d2Recovery.test.mjs - the DANGEROUS TRANSITIONS of the d2 finish gate.
 *
 *   node server/d2Recovery.test.mjs
 *
 * d2.test.mjs covers the DECISION (does d2 fire on the right thing). This covers what happens
 * AFTER it fires, which is where a preservation mechanism destroys work if it is wrong.
 *
 * Every assertion compares TREES or BYTES, never a command's exit code. A command returning 0
 * is not proof that state is correct - this session alone has seen a shell report 0 for a node
 * process that exited 1, and a regression rig read an output file without checking its child's
 * status and commit an empty result that looked like a completed run.
 *
 * THE ORDERING UNDER TEST:
 *     capture candidate FIRST -> evaluate -> quarantine + VERIFY -> restore + VERIFY -> refuse
 * and its failure rule:
 *     cannot PROVE the candidate preserved  ->  DO NOT RESET
 * An ugly retained workspace beats destroying the only copy of the work in the name of
 * recovery.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { evaluateD2, observeTargets, quarantine, restoreTo, verifyAt, treeOf, modelEnv, captureState } =
  await import('./d2.js');

let passed = 0, failed = 0;
const say = (ok, m) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${m}`); ok ? passed++ : failed++; };

const WS = mkdtempSync(join(tmpdir(), 'd2rec-'));
const git = (...a) => execFileSync('git', ['-C', WS, ...a], { encoding: 'utf8' }).trim();
const put = (f, s) => writeFileSync(join(WS, f), s, 'utf8');
const commit = (m) => { git('add', '-A'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', m); return git('rev-parse', '--short', 'HEAD'); };
/**
 * Recover one file from the audit bundle, the way an auditor would.
 *
 * Returns BOTH the checked-out text and the stored blob id. "Survives byte-for-byte" must be
 * asserted on the BLOB ID: git's Windows autocrlf converts LF to CRLF on checkout, so a
 * working-tree comparison fails on a file whose stored bytes are identical. Asserting on the
 * checkout would be testing the platform's line-ending policy, not preservation.
 */
const recoverFile = (q, name) => {
  const d = mkdtempSync(join(tmpdir(), 'rec-'));
  try {
    execFileSync('git', ['clone', '-q', '-b', q.branch, q.bundle, join(d, 'r')], { encoding: 'utf8' });
    const r = join(d, 'r');
    const blob = execFileSync('git', ['-C', r, 'rev-parse', `HEAD:${name}`], { encoding: 'utf8' }).trim();
    return { text: readFileSync(join(r, name), 'utf8'), blob };
  } catch { return { text: '(unrecoverable)', blob: null }; }
  finally { try { rmSync(d, { recursive: true, force: true }); } catch {} }
};

const TARGETS = ['s3_matrix.js', 's7_cache.js'];

try {
  git('init', '-q');
  put('package.json', '{"name":"fx","type":"commonjs"}');
  put('helper.js', 'module.exports = { twice: (n) => n * 2 };\n');
  put('s3_matrix.js', "const h = require('./helper');\nmodule.exports = { go: () => h.twice(2) };\n");
  put('s7_cache.js', 'module.exports = { ok: true };\n');
  const START = commit('start');
  const startObs = await observeTargets(WS, START, TARGETS);
  const START_TREE = await treeOf(WS, START);

  // ── 1. candidate survives quarantine BYTE-FOR-BYTE ──
  put('s3_matrix.js', "throw new Error('broken');\n");
  put('newwork.js', 'module.exports = { valuable: true };\n');   // good work in the same candidate
  const CAND = commit('candidate: breaks s3, adds newwork');
  const CAND_TREE = await treeOf(WS, CAND);
  const q = await quarantine(WS, 'run-1', CAND);
  say(q.ok, `quarantine succeeded and self-verified (${q.ok ? q.bundle : q.error})`);
  // The artifact lives OUTSIDE the workspace now (audit-only), so it is verified through the
  // bundle rather than an in-workspace ref - the ref WAS the cross-run leak.
  say(q.tree === CAND_TREE, 'the audit artifact holds the candidate TREE');
  const srcBlob = git('rev-parse', `${CAND}:newwork.js`);
  const rec = recoverFile(q, 'newwork.js');
  say(rec.blob === srcBlob, `good work inside the refused candidate survives BYTE-FOR-BYTE (blob ${String(rec.blob).slice(0, 8)} vs ${srcBlob.slice(0, 8)})`);

  // ── 2. restore returns the authoritative tree EXACTLY, and observations bind to it ──
  const r = await restoreTo(WS, START);
  const ver = await verifyAt(WS, START);
  say(r.ok && ver.ok, `restore verified (${ver.ok ? ver.tree : ver.error})`);
  say(await treeOf(WS, 'HEAD') === START_TREE, 'HEAD tree is byte-identical to the run-start tree');
  say(readFileSync(join(WS, 's3_matrix.js'), 'utf8').includes('h.twice(2)'), 'the broken file is gone from the working tree');
  say(git('status', '--porcelain') === '', 'nothing uncommitted is left behind');
  // The assertion that stops two different baselines being compared without any error.
  say(startObs.tree === START_TREE, 'start observations are BOUND to the tree they were measured on');

  // ── 3. d2 PASS leaves the candidate untouched ──
  put('s3_matrix.js', "const h = require('./helper');\nmodule.exports = { go: () => h.twice(3) };\n");
  const GOOD = commit('candidate: changes s3 but it still loads');
  const GOOD_TREE = await treeOf(WS, GOOD);
  const pass = await evaluateD2(WS, { startRef: START, candidateRef: GOOD, written: ['s3_matrix.js'], targets: TARGETS, startObservations: startObs.observations });
  say(pass.violated === false, 'a change that keeps the target loadable PASSES');
  say(await treeOf(WS, 'HEAD') === GOOD_TREE, 'on PASS the candidate is still HEAD - nothing was quarantined or reset');

  // ── 4. the quarantined candidate remains recoverable AFTER the reset ──
  say(existsSync(q.bundle), 'the audit artifact still exists after a later reset');
  say(recoverFile(q, 'newwork.js').text.includes('valuable'), 'and its contents are still recoverable');

  // ── 5. FAIL CLOSED: quarantine that cannot be verified must NOT reset ──
  // A ref that does not resolve to the candidate is exactly the state where resetting would
  // destroy the only copy. quarantine() must refuse rather than report success.
  const bad = await quarantine(WS, 'run-bad', 'refs/does/not/exist');
  say(bad.ok === false, `quarantine of an unresolvable ref FAILS rather than claiming success (${bad.error || ''})`.slice(0, 120));

  // ── 6. causal_root = UNRESOLVED actually executes ──
  // TWO changed modules are both newly unloadable, so no single one is established as root.
  git('reset', '-q', '--hard', START);
  put('helper.js', "throw new Error('helper broken');\n");
  put('s7_cache.js', "throw new Error('cache broken too');\n");
  const TWO = commit('two independent breaks');
  const amb = await evaluateD2(WS, { startRef: START, candidateRef: TWO, written: ['helper.js', 's7_cache.js'], targets: TARGETS, startObservations: startObs.observations });
  say(amb.violated === true, 'the ambiguous case still REFUSES - blocking never requires causal diagnosis');
  say(amb.causal_root === 'UNRESOLVED', `causal_root is UNRESOLVED when two candidates are plausible (got ${amb.causal_root})`);
  say(amb.newly_unloadable.includes('s3_matrix.js') && amb.newly_unloadable.includes('s7_cache.js'),
    'both affected deliverables are reported (s3 via the helper, s7 directly)');
  say(!amb.newly_unloadable.includes('helper.js'), 'the non-target helper is still not a protected violation');

  // ── 7. OBSERVATION_ERROR is not UNESTABLISHED ──
  // observeTargets must THROW on an unresolvable ref rather than return an empty record that
  // a caller could mistake for "nothing was established".
  let threw = false;
  try { await observeTargets(WS, 'refs/nope', TARGETS); } catch { threw = true; }
  say(threw, 'observeTargets THROWS on an unresolvable ref (an apparatus failure, not an empty observation)');

  // ── 8. CAPTURE IS NON-INVASIVE: instrumentation must not become the treatment ──
  // ARM B captures a start and a candidate per run. If those were ordinary commits, the model
  // could read them with git_log and ARM B's history would differ from ARM A's by two visible
  // commits per run - a model-visible arm marker, exactly like the env var.
  git('reset', '-q', '--hard', START);
  const logBefore = git('log', '--format=%H %s');
  const headBefore = git('rev-parse', 'HEAD');
  const statusBefore = git('status', '--porcelain');
  put('inprogress.js', 'module.exports = 1;\n');            // uncommitted working-tree change
  const cap = await captureState(WS, 'd2 candidate: run-x', 'refs/legasus/candidate/run-x');
  say(cap.ok, `captureState succeeded (${cap.ok ? cap.sha : cap.error})`);
  say(git('log', '--format=%H %s') === logBefore, 'agent-visible git log is UNCHANGED by the capture');
  say(git('rev-parse', 'HEAD') === headBefore, 'HEAD is unchanged');
  say(git('status', '--porcelain') === statusBefore + (statusBefore ? '\n' : '') + '?? inprogress.js',
    'the working tree and index are untouched - the file is still uncommitted');
  say(git('cat-file', '-t', cap.sha) === 'commit', 'the capture IS a real commit object, reachable by its ref');
  say(git('show', `${cap.sha}:inprogress.js`) === 'module.exports = 1;',
    'and it contains the uncommitted work, so nothing had to be committed to capture it');

  // ── 9. the treatment is not visible to model-controlled subprocesses ──
  const leaked = modelEnv({ PATH: 'x', AGENT_D2_TARGETS: 's3_matrix.js', HOST_EVENT_LOG: '/tmp/e', HUB_TOKEN: 'secret', KEEP: '1' });
  say(!('AGENT_D2_TARGETS' in leaked), 'AGENT_D2_TARGETS is stripped - the model cannot read which ARM it is in');
  say(!('HOST_EVENT_LOG' in leaked) && !('HUB_TOKEN' in leaked), 'HOST_EVENT_LOG and HUB_TOKEN are stripped too');
  say(leaked.PATH === 'x' && leaked.KEEP === '1', 'ordinary environment is preserved');
} finally {
  try { rmSync(WS, { recursive: true, force: true }); } catch {}
}

console.log(`\n  d2 recovery: ${passed} passed, ${failed} failed -> ${failed ? 'DO NOT RUN THE CAMPAIGN' : 'dangerous transitions qualified'}`);
process.exit(failed ? 1 : 0);
