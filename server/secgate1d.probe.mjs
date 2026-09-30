/**
 * secgate1d.probe.mjs - SECGATE-1 finding D. READ-ONLY. Reproduces, does not repair.
 *
 *   node server/secgate1d.probe.mjs
 *
 * THE PROPOSITION:
 *
 *     Does the evaluator's recorded identity denote the exact candidate bytes/tree whose
 *     acceptance it authorizes?
 *
 * The world under test, per SECGATE-1_PREREG:
 *
 *     committed tree      = C
 *     candidate tree      = K   (the working tree the model actually changed)
 *     C != K
 *     which does the evaluator EXECUTE?      which does it NAME?
 *
 * THREE OUTCOMES, KEPT APART - they are different findings with different severity:
 *
 *   D-i    evaluates K, NAMES C            identity defect: the verdict is about K but attributed
 *                                          to C, so a later reader believes C was verified
 *   D-ii   evaluates C, and that result authorizes K   evidence-object substitution - much worse
 *   D-iii  identity is merely descriptive metadata and nothing consumes it   narrowest
 *
 * ACCEPTANCE CORRECTNESS IS NOT THE DEPENDENT VARIABLE. 6ad0aafd already recorded acceptance
 * non-vacuity as PRE-EXISTING, reproduced on baseline with identical labels in both arms. If the
 * verdict itself were the measurement here, that prior finding would contaminate the reading. The
 * measurement is ONLY: which tree does the recorded identity denote?
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const out = [];
const say = (s) => { console.log(s); out.push(s); };
const git = (ws, args) => execFileSync('git', ['-C', ws, ...args], { encoding: 'utf8', windowsHide: true }).trim();

/** VERBATIM from server/evaluator.js:60. Not re-designed - this is the implicated line. */
function candidateTree_asShipped(workspace) {
  try { return git(workspace, ['rev-parse', 'HEAD^{tree}']); } catch { return null; }
}

const ws = mkdtempSync(join(tmpdir(), 'secgate-d-'));
git(ws, ['init', '-q']);
git(ws, ['config', 'user.email', 'p@p']);
git(ws, ['config', 'user.name', 'probe']);

// ── build C: the COMMITTED state ───────────────────────────────────────────────────────────────
writeFileSync(join(ws, 'lib.js'), 'module.exports = { v: 1 };\n', 'utf8');
git(ws, ['add', '-A']);
git(ws, ['commit', '-q', '-m', 'C: the committed baseline']);
const C = candidateTree_asShipped(ws);
const C_bytes = readFileSync(join(ws, 'lib.js'), 'utf8').trim();
say(`C  committed tree   : ${C}`);
say(`   committed bytes  : ${JSON.stringify(C_bytes)}`);

// ── build K: the CANDIDATE the model produced, uncommitted ─────────────────────────────────────
writeFileSync(join(ws, 'lib.js'), 'module.exports = { v: 999, BROKEN: undefinedName };\n', 'utf8');
const K_bytes = readFileSync(join(ws, 'lib.js'), 'utf8').trim();
// The tree K's bytes WOULD hash to, obtained without committing - this is what an honest identity
// for the working tree looks like, and it is available with two ordinary git commands.
git(ws, ['add', '-A']);
const K_real = git(ws, ['write-tree']);
git(ws, ['reset', '-q']);                       // leave the index as it was: K stays UNCOMMITTED
say('');
say(`K  candidate bytes  : ${JSON.stringify(K_bytes)}`);
say(`   candidate tree   : ${K_real}   <- what the working tree actually hashes to`);
say(`   C != K           : ${C !== K_real}`);

// ── THE MEASUREMENT: which tree does the shipped identity function name? ───────────────────────
const named = candidateTree_asShipped(ws);
say('');
say('=== THE MEASUREMENT ===');
say(`  bytes on disk that an evaluator would execute : ${JSON.stringify(K_bytes)}`);
say(`  identity candidateTree() records             : ${named}`);
say(`  does that identity denote the executed bytes : ${named === K_real}`);
say(`  does it denote the COMMITTED tree instead    : ${named === C}`);

// ── NEGATIVE CONTROL: with a CLEAN tree the identity must be correct, or the probe proves nothing
git(ws, ['add', '-A']);
git(ws, ['commit', '-q', '-m', 'K: now committed']);
const afterCommit = candidateTree_asShipped(ws);
say('');
say('=== NEGATIVE CONTROL: commit K, then ask again ===');
say(`  identity now                : ${afterCommit}`);
say(`  equals the real K tree      : ${afterCommit === K_real}  <- must be true, or the function is simply broken`);

// ── verdict ────────────────────────────────────────────────────────────────────────────────────
const reproduced = named === C && named !== K_real && afterCommit === K_real;
say('');
say('=== D VERDICT ===');
if (reproduced) {
  say('  REPRODUCED as D-i / D-iii: with an UNCOMMITTED candidate, candidateTree() names the');
  say('  COMMITTED tree C while the bytes an evaluator would execute are K. The identity does not');
  say('  denote what was judged.');
  say('');
  say('  NOT ESTABLISHED HERE - and deliberately not claimed:');
  say('    * whether evaluate() executes K or C           (needs the worker image; not run)');
  say('    * whether any consumer ACTS on that identity   (that would be D-ii, much worse)');
  say('  So this is an IDENTITY defect demonstrated on the identity function, not yet demonstrated');
  say('  as evidence-object substitution through a live promotion.');
} else {
  say(`  NOT_REPRODUCED or NOT_EVALUATED - named=${named} C=${C} K=${K_real} afterCommit=${afterCommit}`);
}

const dir = process.env.SECGATE_OUT || join(tmpdir(), 'SECGATE-1-counterexamples');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'D-evaluator-identity.json'), JSON.stringify({
  proposition: "the evaluator's recorded identity denotes the exact candidate whose acceptance it authorizes",
  implicated: 'server/evaluator.js:60  git rev-parse HEAD^{tree}',
  statedIntent: 'evaluator.js:32 - "RESULTS BIND TO THE EXACT CANDIDATE EVALUATED - the tree id, not the workspace"',
  committedTree_C: C, candidateTree_K: K_real, identityRecorded: named,
  identityDenotesExecutedBytes: named === K_real,
  identityDenotesCommittedTree: named === C,
  negativeControl_afterCommit: afterCommit, negativeControlHeld: afterCommit === K_real,
  verdict: reproduced ? 'REPRODUCED (D-i/D-iii)' : 'NOT_REPRODUCED_OR_NOT_EVALUATED',
  notEstablished: ['whether evaluate() executes K or C', 'whether any consumer acts on the identity (D-ii)'],
  at: new Date().toISOString(),
}, null, 2));
say('');
say(`counterexample preserved under ${dir}`);
say('NOTHING WAS REPAIRED.');
try { rmSync(ws, { recursive: true, force: true }); } catch {}
