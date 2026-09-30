/**
 * dprop1.probe.mjs - D-PROP-1. Does the evaluator's evidence preserve the identity of what it
 * executed, through evaluation and consumption?
 *
 *   node server/dprop1.probe.mjs
 *
 * C and K are distinguishable BY EXECUTION, not by hash: the check prints "COMMITTED" or
 * "CANDIDATE", so the returned string names which bytes ran independently of anything the
 * component says about itself.
 *
 * EXTERNAL RULER, captured before evaluation and never derived from the receipt:
 *     C_tree = git rev-parse HEAD^{tree}
 *     K_tree = git add -A && git write-tree   (then reset - K stays uncommitted)
 *
 * NO REPAIR. evaluator.js, acceptance.js and batch.js are not edited.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluate, VERDICT } from './evaluator.js';

const out = [];
const say = (s) => { console.log(s); out.push(s); };
const git = (ws, a) => { try { return execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', windowsHide: true }).trim(); } catch (e) { return `ERR:${String(e.message).slice(0, 60)}`; } };

// A SHELL script: evaluate() writes it to /check/<kind>.sh and runs `sh /check/<kind>.sh`.
//
// THREE APPARATUS FAULTS FOUND THE HARD WAY, all mine, all fixed here:
//   1 this was a JS fragment requiring "/w/subject.js" - a mount that does not exist. The real
//     mounts are /candidate:ro (the workspace) and /check:ro (the checks).
//   2 copying into /scratch fails "Permission denied": it is a root-owned tmpfs and the
//     container runs --user 1000:1000. The subject is required DIRECTLY from /candidate, since
//     reading is all that is needed.
//   3 the node command must be the LAST statement. An earlier draft ended with `echo`, whose
//     exit status masked a crashed check and made evaluate() report PASS over MODULE_NOT_FOUND.
//
// It prints what the subject SAYS IT IS - the third, independent channel naming which bytes ran.
const CHECK = 'node -e \'const {probe}=require("/candidate/subject.js");const w=probe();console.log("EXECUTED_SUBJECT="+w);process.exit(w==="CANDIDATE"?0:1)\'\n';

async function world({ dirty }) {
  const ws = mkdtempSync(join(tmpdir(), 'dprop-'));
  git(ws, ['init', '-q']); git(ws, ['config', 'user.email', 'p@p']); git(ws, ['config', 'user.name', 'p']);

  // ---- C: the COMMITTED subject
  writeFileSync(join(ws, 'subject.js'), 'module.exports={probe:()=>"COMMITTED"};\n', 'utf8');
  git(ws, ['add', '-A']); git(ws, ['commit', '-q', '-m', 'C']);
  const C_tree = git(ws, ['rev-parse', 'HEAD^{tree}']);

  // ---- K: the CANDIDATE subject, uncommitted when dirty
  if (dirty) writeFileSync(join(ws, 'subject.js'), 'module.exports={probe:()=>"CANDIDATE"};\n', 'utf8');
  git(ws, ['add', '-A']);
  const K_tree = git(ws, ['write-tree']);
  if (dirty) git(ws, ['reset', '-q']);           // K stays UNCOMMITTED
  else git(ws, ['reset', '-q']);

  const checkDir = mkdtempSync(join(tmpdir(), 'dprop-check-'));
  writeFileSync(join(checkDir, 'check.js'), CHECK, 'utf8');
  return { ws, checkDir, C_tree, K_tree, bytes: readFileSync(join(ws, 'subject.js'), 'utf8').trim() };
}

async function measure(label, { dirty }) {
  const w = await world({ dirty });
  say(`--- ${label} ---`);
  say(`  1 HEAD tree (C_tree)      : ${w.C_tree}`);
  say(`  2 workspace tree (K_tree) : ${w.K_tree}`);
  say(`    C_tree === K_tree       : ${w.C_tree === w.K_tree}`);
  say(`    bytes on disk say       : ${/CANDIDATE/.test(w.bytes) ? 'CANDIDATE' : 'COMMITTED'}`);

  // task.requested = { script } - evaluate() materialises the checks itself in its own temp dir.
  const task = { id: label, requested: { script: CHECK } };
  let r = null; let err = null;
  try { r = await evaluate(w.ws, task, { timeoutSec: 120 }); }
  catch (e) { err = e.message; }

  const blob = JSON.stringify(r || {});
  const m = blob.match(/EXECUTED_SUBJECT=(COMMITTED|CANDIDATE)/);
  const executed = m ? m[1] : null;
  say(`  3 EXECUTED subject        : ${executed || 'NOT OBSERVED' + (err ? ' (' + err + ')' : '')}`);
  say(`  4 receipt records         : candidateTree=${r && r.candidateTree}`);
  say(`      === C_tree ? ${r && r.candidateTree === w.C_tree}    === K_tree ? ${r && r.candidateTree === w.K_tree}`);
  if (r) say(`    verdict=${r.verdict}${r.reason ? ' reason=' + String(r.reason).slice(0, 90) : ''}`);

  // ---- 5 which bytes ADVANCE, reproducing batch.js:189 verbatim (cpSync excluding .git)
  const baseline = join(mkdtempSync(join(tmpdir(), 'dprop-base-')), '.accepted-baseline');
  cpSync(w.ws, baseline, { recursive: true, filter: (s) => !s.includes(`${sep}.git`) });
  const advanced = readFileSync(join(baseline, 'subject.js'), 'utf8');
  say(`  5 bytes that ADVANCE      : ${/CANDIDATE/.test(advanced) ? 'CANDIDATE' : 'COMMITTED'}`);

  // ---- the .git-discovery caution, MEASURED not assumed
  const discoveredRoot = git(baseline, ['rev-parse', '--show-toplevel']);
  const downstreamTree = git(baseline, ['rev-parse', 'HEAD^{tree}']);
  say(`  6 downstream repo root    : ${discoveredRoot}`);
  say(`    downstream HEAD^{tree}  : ${downstreamTree}`);
  say(`    discovered a PARENT repo: ${!String(discoveredRoot).startsWith('ERR') && !discoveredRoot.includes('accepted-baseline')}`);

  const row = { label, C_tree: w.C_tree, K_tree: w.K_tree, treesDiffer: w.C_tree !== w.K_tree,
    executed, recorded: r && r.candidateTree, recordedIsC: !!(r && r.candidateTree === w.C_tree),
    recordedIsK: !!(r && r.candidateTree === w.K_tree), verdict: r && r.verdict,
    advanced: /CANDIDATE/.test(advanced) ? 'CANDIDATE' : 'COMMITTED',
    downstreamRoot: discoveredRoot, downstreamTree, evaluateError: err };
  try { rmSync(w.ws, { recursive: true, force: true }); rmSync(w.checkDir, { recursive: true, force: true }); } catch {}
  say('');
  return row;
}

// ══ MUST-FIRE POSITIVE CONTROL: C = K must give a self-consistent chain ════════════════════════
say('=== MUST-FIRE POSITIVE CONTROL (C = K, clean committed workspace) ===');
const ctrl = await measure('control-C-equals-K', { dirty: false });
const ctrlFired = ctrl.treesDiffer === false && ctrl.executed === 'COMMITTED'
  && ctrl.recorded === ctrl.C_tree && ctrl.advanced === 'COMMITTED';
say(`CONTROL FIRED: ${ctrlFired}`);
if (!ctrlFired) {
  say('');
  say('D-PROP-1 = NOT_EVALUATED. The apparatus could not produce a coherent chain on the easy');
  say('case, so it says NOTHING about the hard one. This is not evidence against D.');
}

let main = null;
if (ctrlFired) {
  say('');
  say('=== THE MEASUREMENT (C != K) ===');
  main = await measure('main-C-differs-from-K', { dirty: true });
}

// ══ verdict ════════════════════════════════════════════════════════════════════════════════════
say('=== D-PROP-1 VERDICT ===');
let verdict = 'NOT_EVALUATED';
if (ctrlFired && main) {
  const { executed, recordedIsC, recordedIsK, advanced } = main;
  if (executed === 'CANDIDATE' && recordedIsK && advanced === 'CANDIDATE') verdict = 'D_DOES_NOT_PROPAGATE';
  else if (executed === 'CANDIDATE' && recordedIsC && advanced === 'CANDIDATE') verdict = 'EVIDENCE_IDENTITY_MISBINDING';
  else if (executed === 'COMMITTED' && recordedIsC && advanced === 'CANDIDATE') verdict = 'EVIDENCE_OBJECT_SUBSTITUTION';
  else if (executed === 'COMMITTED' && recordedIsC && advanced === 'COMMITTED') verdict = 'EVALUATOR_COHERENT_SEMANTICS_WRONG_ELSEWHERE';
  else verdict = `UNCLASSIFIED executed=${executed} recordedIsC=${recordedIsC} recordedIsK=${recordedIsK} advanced=${advanced}`;
  say(`  executed=${executed}  recorded=${recordedIsC ? 'C' : recordedIsK ? 'K' : 'neither'}  advanced=${advanced}`);
}
say(`  ${verdict}`);
say('');
say('  NOT ESTABLISHED by this probe, and not claimed: whether a later consumer TRUSTS the');
say('  journalled identity. Reproducing batch.js:189 shows HOW the baseline advances (bytes);');
say('  it does not show whether any subsequent decision reads baselineTree.');

const dir = process.env.SECGATE_OUT || join(tmpdir(), 'SECGATE-1-counterexamples');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'D-PROP-1.json'), JSON.stringify({
  proposition: "the evaluator's evidence preserves the identity of the exact executable object it observes",
  workerImageDigest: 'sha256:fa49b576430b1288a585522bbf011fbd218cedcb379eb7bb57e3a69fec08a8c3',
  positiveControl: ctrl, positiveControlFired: ctrlFired, main, verdict,
  notEstablished: ['whether a later consumer trusts the journalled baselineTree identity'],
  at: new Date().toISOString(),
}, null, 2));
say(`preserved under ${dir}`);
say('NOTHING WAS REPAIRED.');
