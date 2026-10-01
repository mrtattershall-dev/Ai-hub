/**
 * dconsume1.probe.mjs - D-CONSUME-1. Does ambient repository identity reach an authoritative output?
 *
 *   node server/dconsume1.probe.mjs
 *
 * Frozen in legasus/screen/D-CONSUME-1_PREREG.md (582f3ef2) BEFORE this file existed.
 * D is UNREPAIRED. Every module under test is imported and run as shipped; the ONLY stub is
 * runTask - the model - which writes fixed bytes. Every artifact goes through EH1.
 *
 * The A5 construction, lifted onto real paths: identical candidate bytes and task inputs, the
 * whole thing rooted inside parent P1 or parent P2. P1a/P1b (identical parents) are the noise
 * floor; POS (same parent shape, different candidate bytes) is the must-fire control.
 */
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import { runBatch } from './batch.js';
import { evaluate } from './evaluator.js';
import { prepareGoverned, concludeGoverned } from './governance.js';
import { captureState, observeTargets, treeOf, evaluateD2 } from './d2.js';
import { ensureRepo } from './workspaceGit.js';
import { WORKER_IMAGE } from './worker.js';

const REPO = process.cwd();
const RUNROOT = process.env.DCONSUME_RUNS || join(REPO, 'legasus', 'evidence-runs');
mkdirSync(RUNROOT, { recursive: true });
const run = openRun({
  root: RUNROOT, label: 'D-CONSUME-1', command: 'node server/dconsume1.probe.mjs', repo: REPO,
  evidenceClass: EVIDENCE_CLASS.ORIGINAL,
  note: 'does ambient repository identity reach an authoritative output? D unrepaired. Prereg 582f3ef2.',
});

const log = [];
const say = (s) => { console.log(s); log.push(s); };
const git = (at, a) => { try { return execFileSync('git', ['-C', at, ...a], { encoding: 'utf8', windowsHide: true }).trim(); } catch (e) { return `ERR:${String(e.message).split('\n')[0].slice(0, 80)}`; } };
const temps = [];
const mk = (p) => { const d = mkdtempSync(join(tmpdir(), p)); temps.push(d); return d; };

/** Content hash of a directory, .git excluded: sorted relative path + bytes. */
function bytesOf(dir) {
  if (!existsSync(dir)) return 'ABSENT';
  const files = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n === '.git') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p); else files.push(p);
    }
  };
  walk(dir);
  const h = createHash('sha256');
  for (const f of files.map((f) => relative(dir, f).split(sep).join('/')).sort()) {
    h.update(f + '\0'); h.update(readFileSync(join(dir, f))); h.update('\0');
  }
  return `${files.length}f:${h.digest('hex').slice(0, 16)}`;
}

/** A parent repository with fixed content. Identical `content` -> identical HEAD tree. */
function parentRepo(tag, content, extraCommit = false) {
  const p = mk(`dcons-${tag}-`);
  if (content === null) return p;   // P0: no repository at all
  git(p, ['init', '-q']); git(p, ['config', 'user.email', 'p@p']); git(p, ['config', 'user.name', 'p']);
  if (content === '') return p;     // Pc: repository with no commits
  writeFileSync(join(p, 'PARENT_FILE.txt'), content, 'utf8');
  git(p, ['add', '-A']); git(p, ['commit', '-q', '-m', 'parent']);
  if (extraCommit) { writeFileSync(join(p, 'other.txt'), 'unrelated\n', 'utf8'); git(p, ['add', '-A']); git(p, ['commit', '-q', '-m', 'second']); }
  return p;
}

// ── the fixed inputs ───────────────────────────────────────────────────────────────────────────
const GOOD = 'module.exports={probe:()=>"CANDIDATE"};\n';
const BAD = 'module.exports={probe:()=>"WRONG"};\n';
const CHECKS = {
  requested: { script: 'node -e "process.exit(require(\'/candidate/subject.js\').probe()===\'CANDIDATE\'?0:1)"' },
  protected: { script: 'grep -q KEEP /candidate/keep.txt' },
};
const tasksFor = () => [
  { id: 't1', seed: { 'keep.txt': 'KEEP\n' }, ...CHECKS },
  { id: 't2', dependsOn: 't1', ...CHECKS },
  { id: 't3', dependsOn: 't1', requested: { script: 'test -f /candidate/extra.js && node -e "require(\'/candidate/subject.js\')"' }, protected: CHECKS.protected },
];

// ── ARM B: the batch runner, including resume ──────────────────────────────────────────────────
async function armB(parent, subjectBytes) {
  const root = join(parent, 'hub');
  const workspacesDir = join(root, 'workspaces'), auditDir = join(root, 'audit'), journalPath = join(root, 'journal.jsonl');
  const startBytes = {};
  const runTask = async (ws, task) => {
    startBytes[task.id] = bytesOf(ws);   // what this task was GIVEN
    if (task.id === 't1') writeFileSync(join(ws, 'subject.js'), subjectBytes, 'utf8');
    if (task.id === 't2') { unlinkSync(join(ws, 'keep.txt')); writeFileSync(join(ws, 'junk.js'), '//junk\n', 'utf8'); }
    if (task.id === 't3') writeFileSync(join(ws, 'extra.js'), 'module.exports=1;\n', 'utf8');
    return { status: 'DONE', exit: 0 };
  };
  const opts = { workspacesDir, auditDir, journalPath, perTaskSec: 120, totalSec: 900, runTask, evalImage: WORKER_IMAGE, chain: true };
  const first = await runBatch(tasksFor(), opts);
  const finalBytes = Object.fromEntries(['t1', 't2', 't3'].map((t) => [t, bytesOf(join(workspacesDir, t))]));
  const baselineBytes = bytesOf(join(workspacesDir, '.accepted-baseline'));
  const resumed = await runBatch(tasksFor(), { ...opts, runTask: async () => { throw new Error('resume must not re-run an ended task'); } });
  const journal = readFileSync(journalPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return {
    results: first.results.map((r) => ({
      task: r.task, state: r.state, termination: r.termination ?? null,
      verdict: r.verdict?.verdict ?? null, requested: r.verdict?.requested?.verdict ?? null, protected: r.verdict?.protected?.verdict ?? null,
      candidateTree: r.verdict?.candidateTree ?? null,
      disposition: r.acceptance?.disposition ?? null, promotable: r.acceptance?.promotable ?? null,
      countsAsCompletion: r.acceptance?.countsAsCompletion ?? null,
      survivingTree: r.acceptance?.survivingWorkspaceVerdict?.candidateTree ?? null,
      survivingVerdict: r.acceptance?.survivingWorkspaceVerdict?.overall ?? null,
      survivingBytes: r.acceptance?.survivingBytes ?? null,
      baselineTree: r.baselineTree ?? null,
      startBytes: startBytes[r.task] ?? null, finalBytes: finalBytes[r.task],
    })),
    halted: first.halted ?? null, accounting: first.accounting, baselineBytes,
    resume: { results: resumed.results.map((r) => ({ task: r.task, state: r.state, resumedFromJournal: !!r.resumedFromJournal })), halted: resumed.halted ?? null },
    journal: journal.map(({ at, attemptId, workspace, preservedAt, capturedAt, ...rest }) => rest),
  };
}

// ── ARM G: governed run, workspace starting with NO .git ───────────────────────────────────────
async function armG(parent, subjectBytes) {
  const out = {};
  for (const [name, mutate] of [
    ['retain', (ws) => writeFileSync(join(ws, 'subject.js'), subjectBytes, 'utf8')],
    ['restore', (ws) => { writeFileSync(join(ws, 'subject.js'), subjectBytes, 'utf8'); unlinkSync(join(ws, 'keep.txt')); }],
  ]) {
    const ws = join(parent, 'gws', name);
    mkdirSync(ws, { recursive: true });
    writeFileSync(join(ws, 'keep.txt'), 'KEEP\n', 'utf8');
    writeFileSync(join(ws, 'subject.js'), GOOD, 'utf8');   // starting state passes both checks
    const ownGitBefore = existsSync(join(ws, '.git'));
    const prep = await prepareGoverned(ws, `g-${name}`, CHECKS, { qualifiedPath: true });
    const rec = { ownGitBefore, prepOk: prep.ok, prepReason: prep.reason ?? null, startTree: prep.startTree ?? null,
      startVerdictProtected: prep.startVerdict?.protected ?? null, requestedAlreadyPasses: prep.requestedAlreadyPasses ?? null };
    if (prep.ok) {
      mutate(ws);
      const c = await concludeGoverned(ws, { id: `g-${name}`, governed: { checks: CHECKS, startRef: prep.startRef } }, { captureDir: join(parent, 'gcap') });
      Object.assign(rec, {
        protection: c.protection, disposition: c.disposition ?? null, countsAsCompletion: c.countsAsCompletion ?? null,
        workspaceRestored: c.workspaceRestored ?? null, error: c.error ?? null,
        // acceptance.js names it `overall`, not `verdict` (run 1 read `verdict` and got null - a probe fault)
        verdict: c.candidateVerdict?.overall ?? null, candidateTree: c.candidateVerdict?.candidateTree ?? null,
        survivingVerdict: c.survivingWorkspaceVerdict?.overall ?? null, survivingTree: c.survivingWorkspaceVerdict?.candidateTree ?? null,
        finalBytes: bytesOf(ws),
      });
    }
    out[name] = rec;
  }
  return out;
}

// ── ARM D: the d2 functions the agent calls, in the order it calls them ────────────────────────
async function armD(parent) {
  const ws = join(parent, 'dws');
  mkdirSync(ws, { recursive: true });
  writeFileSync(join(ws, 'lib.js'), 'module.exports={v:1};\n', 'utf8');
  writeFileSync(join(ws, 'main.js'), "module.exports=require('./lib.js').v+1;\n", 'utf8');
  const ensured = await ensureRepo(ws);
  const c0 = await captureState(ws, 'd2 start', 'refs/legasus/start/probe');
  const start = await observeTargets(ws, c0.sha, ['main.js']);
  writeFileSync(join(ws, 'lib.js'), "throw new Error('broken');\n", 'utf8');
  const c1 = await captureState(ws, 'd2 candidate', 'refs/legasus/candidate/probe');
  const startTreeNow = await treeOf(ws, start.ref);
  const invalid = startTreeNow !== start.tree;
  const v = invalid ? null : await evaluateD2(ws, { startRef: c0.sha, candidateRef: c1.sha, written: ['lib.js'], targets: ['main.js'], startObservations: start.observations });
  return {
    ensuredCreated: ensured.created ?? null, ownGit: existsSync(join(ws, '.git')),
    startTree: start.tree, candidateTree: c1.tree, invalid,
    violated: v ? !!v.violated : null, startLoads: start.observations?.['main.js']?.loads ?? JSON.stringify(start.observations?.['main.js'] ?? null),
  };
}

// ── ARM E: evaluate() directly on a directory with NO own .git (the A5 shape) ──────────────────
async function armE(parent, subjectBytes) {
  const dir = join(parent, 'evaldir');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'keep.txt'), 'KEEP\n', 'utf8');
  writeFileSync(join(dir, 'subject.js'), subjectBytes, 'utf8');
  const v = await evaluate(dir, { id: 'e', ...CHECKS });
  return { ownGit: existsSync(join(dir, '.git')), verdict: v.verdict, requested: v.requested?.verdict ?? null,
    protected: v.protected?.verdict ?? null, candidateTree: v.candidateTree ?? null, reason: v.reason ?? null };
}

// ── ARM M: mechanismAudit.mjs, unmodified, over a campaign root built from arm B ───────────────
function armM(parent, b) {
  const root = join(parent, 'campaign');
  mkdirSync(join(root, 'runs'), { recursive: true });
  const lines = [{ kind: 'plan', tasks: b.results.map((r) => r.task) }];
  b.results.forEach((r, i) => {
    lines.push({ kind: 'run', idx: i, task: r.task, arm: 'B', rep: 1, runId: `run-${r.task}`, state: r.state,
      disposition: r.disposition, accepted: r.disposition === 'RETAIN', candidateTree: r.candidateTree, survivingTree: r.survivingTree });
    writeFileSync(join(root, 'runs', `run-${r.task}.json`), JSON.stringify({ id: `run-${r.task}`, status: 'done', steps: [] }), 'utf8');
  });
  writeFileSync(join(root, 'summary.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf8');
  const outFile = join(root, 'audit.json');
  execFileSync(process.execPath, [join(REPO, 'server', 'mechanismAudit.mjs'), root, '--out', outFile], { encoding: 'utf8', windowsHide: true });
  const a = JSON.parse(readFileSync(outFile, 'utf8'));
  return { units: a.units.map((u) => ({ task: u.task, disposition: u.disposition, treesEqual: u.treesEqual, labelAgrees: u.labelAgrees })),
    labelDisagreements: a.labelDisagreements };
}

// ── comparison against the frozen observable lists ─────────────────────────────────────────────
const AUTH = new Set(['verdict', 'requested', 'protected', 'disposition', 'state', 'finalState', 'termination', 'promotable',
  'countsAsCompletion', 'halted', 'halt', 'reason', 'prepOk', 'prepReason', 'workspaceRestored', 'protection', 'error', 'violated',
  'invalid', 'treesEqual', 'labelAgrees', 'labelDisagreements', 'accepted', 'action', 'resumedFromJournal', 'survivingVerdict',
  'startVerdictProtected', 'requestedAlreadyPasses', 'baselineBytes', 'startBytes', 'finalBytes', 'startLoads', 'accounting', 'event',
  'disposition', 'baselineSource', 'ownGit', 'ownGitBefore', 'ensuredCreated', 'overall', 'survivingBytes']);
const RECEIPT = new Set(['candidateTree', 'survivingTree', 'baselineTree', 'startTree', 'tree']);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function mask(v, parent) {
  const pf = parent.split(sep).join('/');
  if (typeof v === 'string') {
    if (ISO.test(v)) return '<T>';
    return v.split(parent).join('<PARENT>').split(pf).join('<PARENT>');
  }
  if (Array.isArray(v)) return v.map((x) => mask(x, parent));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = /^(at|attemptId|startRef|candidateRef|sha|ref|runId)$/.test(k) ? '<MASKED>' : mask(x, parent);
    return o;
  }
  return v;
}
function leaves(v, path = '', out = new Map()) {
  if (v && typeof v === 'object') {
    // labelDisagreements is one observable, compared whole
    for (const [k, x] of Object.entries(v)) {
      if (k === 'labelDisagreements' || k === 'accounting') out.set(`${path}.${k}`, JSON.stringify(x));
      else leaves(x, `${path}.${k}`, out);
    }
  } else out.set(path, v);
  return out;
}
function compare(label, x, y) {
  const a = leaves(x), b = leaves(y);
  const diffs = { authoritative: [], receipt: [], other: [] };
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(k) === b.get(k)) continue;
    const key = k.split('.').pop().replace(/\[\d+\]$/, '');
    const leafKey = /^\d+$/.test(key) ? k.split('.').slice(-2, -1)[0] : key;
    const bucket = AUTH.has(leafKey) ? 'authoritative' : RECEIPT.has(leafKey) ? 'receipt' : 'other';
    diffs[bucket].push({ path: k, a: a.get(k), b: b.get(k) });
  }
  say(`--- ${label}: authoritative ${diffs.authoritative.length}, receipt ${diffs.receipt.length}, other ${diffs.other.length}`);
  for (const bucket of ['authoritative', 'receipt', 'other']) {
    for (const d of diffs[bucket].slice(0, 12)) say(`    [${bucket}] ${d.path}: ${JSON.stringify(d.a)} | ${JSON.stringify(d.b)}`);
    if (diffs[bucket].length > 12) say(`    [${bucket}] ... ${diffs[bucket].length - 12} more`);
  }
  return diffs;
}

// ── run ────────────────────────────────────────────────────────────────────────────────────────
const record = { prereg: '582f3ef2', image: WORKER_IMAGE, arms: {}, comparisons: {} };
try {
  say('D-CONSUME-1  ambient repository identity vs authoritative behaviour');
  say(`EH1 run: ${run.id}`);
  const tmpTop = git(tmpdir(), ['rev-parse', '--show-toplevel']);
  say(`tmpdir encloses a repo? ${tmpTop.startsWith('ERR:') ? 'no (P0 is genuinely repo-free)' : 'YES: ' + tmpTop}`);

  // READINESS. A candidate WITH ITS OWN repository - the only shape evaluate() can PASS.
  // Run 1 (67cea7eb) used a repo-free directory here, which evaluate() refuses by design, so
  // that run's readiness could never hold: an apparatus fault, recorded, not a finding.
  const readyDir = join(parentRepo('ready', null), 'cand');
  mkdirSync(readyDir, { recursive: true });
  writeFileSync(join(readyDir, 'keep.txt'), 'KEEP\n', 'utf8');
  writeFileSync(join(readyDir, 'subject.js'), GOOD, 'utf8');
  git(readyDir, ['init', '-q']); git(readyDir, ['add', '-A']); git(readyDir, ['-c', 'user.email=r@r', '-c', 'user.name=r', 'commit', '-q', '-m', 'ready']);
  const rv = await evaluate(readyDir, { id: 'ready', ...CHECKS });
  const ready = { verdict: rv.verdict, reason: rv.reason ?? null };
  say(`READINESS  evaluate() on a passing candidate with its own repo: ${ready.verdict} (${ready.reason || 'no reason'})`);
  record.readiness = ready;

  const parents = {
    P1: parentRepo('p1', 'PARENT ONE\n'),
    P2: parentRepo('p2', 'PARENT TWO IS DIFFERENT\n', true),
    P1a: parentRepo('p1a', 'PARENT ONE\n'),
    P1b: parentRepo('p1b', 'PARENT ONE\n'),
  };
  for (const [name, p] of Object.entries(parents)) {
    say(`\n=== parent ${name}  HEAD tree ${git(p, ['rev-parse', 'HEAD^{tree}']).slice(0, 12)}`);
    const B = await armB(p, GOOD);
    say(`  B  ${B.results.map((r) => `${r.task}:${r.disposition}/${r.verdict}`).join('  ')}  halted=${B.halted}`);
    const G = await armG(p, GOOD);
    say(`  G  retain:${G.retain.disposition}/${G.retain.verdict}  restore:${G.restore.disposition}/${G.restore.verdict}  prep ${G.retain.prepOk}/${G.restore.prepOk}`);
    const D = await armD(p);
    say(`  D  invalid=${D.invalid} violated=${D.violated} ownGit=${D.ownGit}`);
    const E = await armE(p, GOOD);
    say(`  E  ${E.verdict}  tree=${String(E.candidateTree).slice(0, 12)}  parentTree=${git(p, ['rev-parse', 'HEAD^{tree}']).slice(0, 12)}`);
    const M = armM(p, B);
    say(`  M  ${M.units.map((u) => `${u.task}:${u.disposition}/eq=${u.treesEqual}/agrees=${u.labelAgrees}`).join('  ')}`);
    record.arms[name] = mask({ B, G, D, E, M }, p);
  }

  // MUST-FIRE: same parent content as P1, different candidate bytes
  const pos = parentRepo('pos', 'PARENT ONE\n');
  const posB = await armB(pos, BAD);
  say(`\n=== POS (P1 content, BAD bytes)  B ${posB.results.map((r) => `${r.task}:${r.disposition}/${r.verdict}`).join('  ')}`);
  record.arms.POS = mask({ B: posB, M: armM(pos, posB) }, pos);

  // ARM E extras: no enclosing repo, commitless enclosing repo
  const p0 = parentRepo('p0', null), pc = parentRepo('pc', '');
  record.arms.E_P0 = mask(await armE(p0, GOOD), p0);
  record.arms.E_Pc = mask(await armE(pc, GOOD), pc);
  say(`  E  P0 (no repo): ${record.arms.E_P0.verdict}   Pc (commitless): ${record.arms.E_Pc.verdict}`);

  say('\n=== COMPARISONS ===');
  const A = record.arms;
  record.comparisons.noise_P1a_P1b = compare('NOISE  P1a vs P1b (must-not-fire)', A.P1a, A.P1b);
  record.comparisons.mustfire = compare('MUST-FIRE  P1 vs POS, arm B+M', { B: A.P1.B, M: A.P1.M }, A.POS);
  for (const arm of ['B', 'G', 'D', 'M']) record.comparisons[`context_${arm}`] = compare(`CONTEXT  P1 vs P2, arm ${arm}`, A.P1[arm], A.P2[arm]);
  record.comparisons.context_E = compare('CONTEXT  P1 vs P2, arm E (non-production shape)', A.P1.E, A.P2.E);
  record.comparisons.context_E_P0 = compare('CONTEXT  P1 vs P0, arm E', A.P1.E, A.E_P0);
  record.comparisons.context_E_Pc = compare('CONTEXT  P1 vs Pc, arm E', A.P1.E, A.E_Pc);

  // classification, against the frozen table
  const C = record.comparisons;
  const noiseAuth = new Set(C.noise_P1a_P1b.authoritative.map((d) => d.path));
  const real = (cmp) => cmp.authoritative.filter((d) => !noiseAuth.has(d.path));
  const controls = ready.verdict === 'PASS' && C.mustfire.authoritative.length > 0;
  const prodAuth = ['B', 'G', 'D'].flatMap((a) => real(C[`context_${a}`]));
  const prodReceipt = ['B', 'G', 'D'].flatMap((a) => C[`context_${a}`].receipt);
  const evid = real(C.context_M);
  let cls;
  if (!controls) cls = 'NOT_EVALUATED (a control failed)';
  else if (prodAuth.length) cls = 'AUTHORITY-AFFECTING ON A PRODUCTION PATH (sub-class from the listed fields)';
  else if (evid.length) cls = 'EVIDENCE_BINDING_DEFECT';
  else if (prodReceipt.length) cls = 'PROVENANCE_RECEIPT_DEFECT supported on production paths';
  else cls = 'NOT REACHABLE ON PRODUCTION PATHS (authoritative and receipts identical)';
  const eAuth = [...real(C.context_E), ...real(C.context_E_P0), ...real(C.context_E_Pc)];
  const eRec = [...C.context_E.receipt, ...C.context_E_P0.receipt, ...C.context_E_Pc.receipt];
  const eCls = eAuth.length ? 'AUTHORITY-AFFECTING in the no-.git shape (see fields: AVAILABILITY if only EVALUATION_ERROR appears)'
    : eRec.length ? 'RECEIPT differs in the no-.git shape, verdicts identical' : 'no difference in the no-.git shape';
  record.classification = { controls, noiseFields: [...noiseAuth], production: cls, nonProductionShape: eCls };
  say('\n=== D-CONSUME-1 CLASSIFICATION (frozen table) ===');
  say(`  controls held:            ${controls}`);
  say(`  noise-floor fields:       ${noiseAuth.size ? [...noiseAuth].join(', ') : 'none'}`);
  say(`  production paths (B/G/D): ${cls}`);
  say(`  evidence consumer (M):    ${evid.length ? 'DIFFERS' : 'identical across parents'}`);
  say(`  no-.git shape (E):        ${eCls}`);

  run.artifact('dconsume1.log', log.join('\n') + '\n');
  run.artifact('record.json', record);
  const sealed = run.seal({ exitStatus: 0 });
  console.log(`\nEH1 sealed: ${sealed.state} artifacts=${sealed.artifacts.length} clean=${sealed.worktreeClean} diff=${String(sealed.worktreeDiffHash).slice(0, 12)}`);
  console.log(`run dir: ${run.dir}`);
} catch (e) {
  say(`APPARATUS FAILURE: ${e.stack || e}`);
  try { run.artifact('dconsume1.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message || e).slice(0, 300) }); } catch { /* preserve what we can */ }
  process.exitCode = 1;
} finally {
  for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  console.log('NOTHING WAS REPAIRED.');
}
