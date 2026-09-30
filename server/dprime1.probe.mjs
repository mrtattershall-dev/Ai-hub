/**
 * dprime1.probe.mjs - D'-1. Does enclosing repository context contaminate candidate identity?
 *
 *   node server/dprime1.probe.mjs
 *
 * CHARACTERIZATION, NOT DEBUGGING. D is unrepaired and stays so. Nothing here is fixed.
 * Every arm runs through EH1, so each artifact is sealed and hash-bound to commit + dirty state.
 *
 * The measurement mirrors production: batch.js:189 copies the workspace with `cpSync` EXCLUDING
 * `.git`, so the accepted baseline has no repository of its own. The question is what
 * candidateTree() reports when that directory sits INSIDE one.
 *
 * candidateTree() is module-private, so its single implicated line is reproduced verbatim from
 * evaluator.js:60 and labelled as such.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';

const RUNROOT = process.env.DPRIME_RUNS || join(tmpdir(), 'dprime1-runs');
mkdirSync(RUNROOT, { recursive: true });

const run = openRun({
  root: RUNROOT, label: 'D-PRIME-1',
  command: 'node server/dprime1.probe.mjs',
  repo: process.cwd(),
  evidenceClass: EVIDENCE_CLASS.ORIGINAL,
  note: "does enclosing repository context contaminate candidate identity? D unrepaired.",
});

const out = [];
const say = (s) => { console.log(s); out.push(s); };
const git = (ws, a) => { try { return execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', windowsHide: true }).trim(); } catch (e) { return `ERR:${String(e.message).split('\n')[0].slice(0, 70)}`; } };

/** VERBATIM from server/evaluator.js:60. The implicated line, not a redesign. */
const candidateTree_asShipped = (workspace) => git(workspace, ['rev-parse', 'HEAD^{tree}']);

const dirs = [];
const mk = (p) => { const d = mkdtempSync(join(tmpdir(), p)); dirs.push(d); return d; };
function repo(at, content, msg) {
  git(at, ['init', '-q']); git(at, ['config', 'user.email', 'p@p']); git(at, ['config', 'user.name', 'p']);
  if (content) { writeFileSync(join(at, 'PARENT_FILE.txt'), content, 'utf8'); git(at, ['add', '-A']); git(at, ['commit', '-q', '-m', msg || 'parent']); }
  return at;
}
/** A candidate workspace with its own repo, then copied WITHOUT .git exactly as batch.js:189 does. */
function candidateInto(dest, bytes) {
  const src = mk('dprime-src-');
  repo(src, null);
  writeFileSync(join(src, 'subject.js'), bytes, 'utf8');
  git(src, ['add', '-A']); git(src, ['commit', '-q', '-m', 'candidate']);
  const ownTree = candidateTree_asShipped(src);
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, filter: (s) => !s.includes(`${sep}.git`) });
  return { ownTree, src };
}

const rows = [];
function arm(id, label, build) {
  let r;
  try { r = build(); } catch (e) { r = { error: e.message }; }
  rows.push({ arm: id, label, ...r });
  say(`--- ${id}  ${label} ---`);
  for (const [k, v] of Object.entries(r)) say(`    ${k.padEnd(22)} ${v}`);
  say('');
  return r;
}

say('D\'-1  enclosing repository context vs candidate identity');
say(`EH1 run: ${run.id}`);
say('');

const BYTES = 'module.exports={probe:()=>"CANDIDATE"};\n';

// ── A1 baseline dir (no .git) nested inside an enclosing repository ────────────────────────────
arm('A1', 'parent repo encloses the baseline dir', () => {
  const parent = repo(mk('dprime-parent-'), 'PARENT CONTENT\n', 'parent base');
  const parentTree = candidateTree_asShipped(parent);
  const baseline = join(parent, 'workspaces', '.accepted-baseline');
  const { ownTree } = candidateInto(baseline, BYTES);
  const reported = candidateTree_asShipped(baseline);
  return {
    candidateOwnTree: ownTree, parentTree, reportedIdentity: reported,
    equalsCandidate: reported === ownTree, equalsParent: reported === parentTree,
    discoveredRoot: git(baseline, ['rev-parse', '--show-toplevel']),
  };
});

// ── A2 enclosing repository whose HEAD is a DIFFERENT tree entirely ────────────────────────────
arm('A2', 'different-HEAD parent', () => {
  const parent = repo(mk('dprime-parent2-'), 'TOTALLY UNRELATED PROJECT\n', 'unrelated');
  writeFileSync(join(parent, 'other.txt'), 'more unrelated\n', 'utf8');
  git(parent, ['add', '-A']); git(parent, ['commit', '-q', '-m', 'second']);
  const parentTree = candidateTree_asShipped(parent);
  const baseline = join(parent, 'deep', 'nest', '.accepted-baseline');
  const { ownTree } = candidateInto(baseline, BYTES);
  const reported = candidateTree_asShipped(baseline);
  return {
    candidateOwnTree: ownTree, parentTree, reportedIdentity: reported,
    equalsCandidate: reported === ownTree, equalsParent: reported === parentTree,
  };
});

// ── A3 enclosing repository with NO commits ────────────────────────────────────────────────────
arm('A3', 'commitless parent', () => {
  const parent = repo(mk('dprime-parent3-'), null);
  const baseline = join(parent, '.accepted-baseline');
  const { ownTree } = candidateInto(baseline, BYTES);
  const reported = candidateTree_asShipped(baseline);
  return {
    candidateOwnTree: ownTree, reportedIdentity: reported,
    isError: String(reported).startsWith('ERR:'),
    failsClosed: String(reported).startsWith('ERR:') ? 'no identity returned' : 'AN IDENTITY WAS RETURNED',
  };
});

// ── A4 submodule-like: a repository inside a repository ────────────────────────────────────────
arm('A4', 'submodule-like nesting (repo inside repo)', () => {
  const parent = repo(mk('dprime-parent4-'), 'OUTER\n', 'outer');
  const parentTree = candidateTree_asShipped(parent);
  const inner = join(parent, 'inner');
  mkdirSync(inner, { recursive: true });
  repo(inner, null);
  writeFileSync(join(inner, 'subject.js'), BYTES, 'utf8');
  git(inner, ['add', '-A']); git(inner, ['commit', '-q', '-m', 'inner']);
  const innerTree = candidateTree_asShipped(inner);
  return {
    innerOwnTree: innerTree, parentTree, reportedIdentity: innerTree,
    equalsInner: innerTree === innerTree, equalsParent: innerTree === parentTree,
    note: 'an inner repo with its OWN .git is expected to shadow the parent - the control for A1',
  };
});

// ── A5 THE CONTROL: identical candidate bytes, two different enclosing repositories ────────────
const a5 = arm('A5', 'SAME candidate bytes under two DIFFERENT parents', () => {
  const p1 = repo(mk('dprime-p5a-'), 'PARENT ONE\n', 'one');
  const p2 = repo(mk('dprime-p5b-'), 'PARENT TWO IS DIFFERENT\n', 'two');
  const b1 = join(p1, '.accepted-baseline');
  const b2 = join(p2, '.accepted-baseline');
  const c1 = candidateInto(b1, BYTES);
  const c2 = candidateInto(b2, BYTES);
  const r1 = candidateTree_asShipped(b1);
  const r2 = candidateTree_asShipped(b2);
  const bytesIdentical = readFileSync(join(b1, 'subject.js'), 'utf8') === readFileSync(join(b2, 'subject.js'), 'utf8');
  return {
    bytesIdentical,
    candidateOwnTree_1: c1.ownTree, candidateOwnTree_2: c2.ownTree,
    candidateTreesEqual: c1.ownTree === c2.ownTree,
    reportedUnderParent1: r1, reportedUnderParent2: r2,
    identityChangedWithContext: r1 !== r2,
    verdict: (bytesIdentical && r1 !== r2)
      ? 'CONTAMINATED: identical candidate, different recorded identity - context, not content'
      : 'identity did not change with context',
  };
});

// ── downstream: is the identity CONSUMED as authority? ─────────────────────────────────────────
say('--- DOWNSTREAM CONSUMPTION (read from source, not inferred) ---');
const src = readFileSync(join(process.cwd(), 'server', 'batch.js'), 'utf8');
const advanceIsBytes = /cpSync\(ws, acceptedBaselineDir/.test(src);
const treeIsJournalled = /baselineTree:\s*acceptedBaselineTree/.test(src);
const treeGatesAnything = /if\s*\([^)]*acceptedBaselineTree/.test(src)
  || /acceptedBaselineTree\s*(===|!==|\?\?|\|\|)\s*[^n]/.test(src.replace(/acceptedBaselineTree = [^;]+;/g, ''));
say(`    baseline advances by BYTES (cpSync)   ${advanceIsBytes}`);
say(`    identity journalled as baselineTree   ${treeIsJournalled}`);
say(`    identity GATES a decision             ${treeGatesAnything}`);
say('');

// ── classification, against the frozen table ───────────────────────────────────────────────────
const a1 = rows.find((r) => r.arm === 'A1');
let cls;
if (a1 && a1.equalsCandidate) cls = 'NOT_REPRODUCED (identity correct)';
else if (a1 && String(a1.reportedIdentity).startsWith('ERR:')) cls = 'IDENTITY_UNAVAILABLE (examine fail-closed)';
else if (a1 && a1.equalsParent && !treeGatesAnything) cls = 'PROVENANCE_RECEIPT_DEFECT';
else if (a1 && a1.equalsParent && treeGatesAnything) cls = 'AUTHORITY_MISBINDING';
else cls = `UNCLASSIFIED reported=${a1 && a1.reportedIdentity}`;

say('=== D\'-1 CLASSIFICATION (from the frozen table) ===');
say(`    ${cls}`);
say(`    A5 context control: ${a5.verdict}`);
say('');
say('    NOT established: whether later evidence VALIDATES against the wrong object');
say('    (historical evidence contamination). That needs a replay consumer, not this probe.');

run.artifact('dprime1.log', out.join('\n') + '\n');
run.artifact('arms.json', { rows, downstream: { advanceIsBytes, treeIsJournalled, treeGatesAnything }, classification: cls });
const sealed = run.seal({ exitStatus: 0 });
console.log('');
console.log(`EH1 sealed: ${sealed.state}  artifacts=${sealed.artifacts.length}  clean=${sealed.worktreeClean}  diff=${String(sealed.worktreeDiffHash).slice(0, 12)}`);
console.log(`run dir: ${run.dir}`);
console.log('NOTHING WAS REPAIRED.');
for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
