/**
 * commitChain.test.mjs - COMMIT-2's regression. The REAL runBatch and the REAL concludeGoverned,
 * with drift injected through the falsifiability seam, self-sealed through EH1.
 *
 *   node server/commitChain.test.mjs
 *
 * Written BEFORE the repair and run unrepaired first. Unrepaired, C1/C2/C3 must FAIL: the seam
 * does not exist, so drift is never injected and the real path RETAINs - which is exactly the
 * unfalsifiability COMMIT-1 could only state. C5 is the production no-op control and must pass
 * before AND after; C4 is the anti-over-refusal control for the chain.
 *
 * Journal event names are read from batch.js: task_baseline, task_start, task_end, batch_halt,
 * and the new identity_drift. Every assertion reads the JOURNAL, not the console.
 */
import { mkdtempSync, writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cid1 } from './cid1.mjs';
import { runBatch } from './batch.js';
import { prepareGoverned, concludeGoverned } from './governance.js';
import { WORKER_IMAGE } from './worker.js';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';

const ROOT = process.env.COMMIT2_RUNS || join(tmpdir(), 'commit2-runs');
mkdirSync(ROOT, { recursive: true });
const run = openRun({ root: ROOT, label: 'COMMIT-2-REGRESSION', command: 'node server/commitChain.test.mjs',
  repo: process.cwd(), evidenceClass: EVIDENCE_CLASS.ORIGINAL });

let passed = 0, failed = 0; const rows = [];
const ok = (c, m) => { console.log(`  ${c ? 'PASS' : 'FAIL'}  ${m}`); rows.push({ pass: !!c, m }); c ? passed++ : failed++; };
const git = (ws, ...a) => execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', windowsHide: true }).trim();
const ORIGINAL = 'module.exports={probe:()=>"ORIGINAL"};\n';
const MUTATED = 'module.exports={probe:()=>"MUTATED"};\n';
const journal = (p) => existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const find = (j, event, task) => j.find((e) => e.event === event && e.task === task);

const SEED = { 'subject.js': ORIGINAL, 'keep.txt': 'protected\n' };
const tasks = (protectedScript = 'true') => [
  { id: 't1', requested: { script: 'true' }, protected: { script: protectedScript }, seed: SEED },
  { id: 't2', requested: { script: 'true' }, protected: { script: protectedScript }, seed: SEED },
];
const DONE = async () => ({ status: 'DONE', exit: 0 });
function arena(name) {
  const d = mkdtempSync(join(tmpdir(), `c2-${name}-`));
  return { d, ws: join(d, 'ws'), audit: join(d, 'audit'), journalPath: join(d, 'journal.jsonl'), baseline: join(d, 'ws', '.accepted-baseline') };
}
const opts = (a, extra = {}) => ({ workspacesDir: a.ws, auditDir: a.audit, journalPath: a.journalPath,
  perTaskSec: 120, totalSec: 900, runTask: DONE, evalImage: WORKER_IMAGE, chain: true, ...extra });

console.log('COMMIT-2 regression - drift injected through the REAL batch and governed paths');
console.log('');

// ── C5  production no-op control: no seam passed ─────────────────────────────────────────────
{
  const a = arena('c5');
  const r = await runBatch(tasks(), opts(a));
  const j = journal(a.journalPath);
  ok(find(j, 'task_end', 't1')?.disposition === 'RETAIN', 'C5 no seam: t1 RETAINs as before');
  ok(existsSync(a.baseline), 'C5 no seam: the baseline advanced');
  ok(/accepted baseline from t1/.test(find(j, 'task_baseline', 't2')?.baselineSource || ''), 'C5 no seam: t2 starts from the accepted baseline');
  ok(!r.halted, 'C5 no seam: batch not halted');
}

// ── C1  T2 through the REAL runBatch: drift injected after t1's verdict ──────────────────────
{
  const a = arena('c1');
  const afterVerdict = async (ws, task) => { if (task.id === 't1') writeFileSync(join(ws, 'subject.js'), MUTATED, 'utf8'); };
  const r = await runBatch(tasks(), opts(a, { afterVerdict }));
  const j = journal(a.journalPath);
  const t1 = find(j, 'task_end', 't1');
  ok(t1?.disposition === 'IDENTITY_DRIFT', `C1 T2: drifted t1 is IDENTITY_DRIFT (got ${t1?.disposition})`);
  // APPARATUS CORRECTION (EH1 run 88a29e7c): an end-of-batch `!existsSync(baseline)` check was
  // wrong - t2 is NOT drifted, PASSes, and legitimately advances the baseline itself, so the
  // directory exists at the end. The claim is about t1's TRANSITION: at t1's task_end the
  // baseline had not moved, and no baseline ever carried the drifted bytes. Both read from the
  // record, not from the final state of the disk.
  ok(t1?.baselineTree == null, 'C1 T2: at t1 task_end the baseline had NOT advanced (baselineTree null)');
  ok(!existsSync(join(a.baseline, 'subject.js')) || !readFileSync(join(a.baseline, 'subject.js'), 'utf8').includes('MUTATED'),
    'C1 T2: no baseline ever carried the drifted bytes');
  ok(!!find(j, 'identity_drift', 't1'), 'C1 T2: identity_drift journalled for t1');
  ok(!r.halted, 'C1 T2: the batch was NOT halted by drift (frozen policy)');
  ok(find(j, 'task_baseline', 't2')?.baselineSource === 'task seed', 'C1 T3: t2 starts from its seed, not from drifted bytes');
}

// ── C4  ABA through the chain: mutate then restore the judged bytes -> must RETAIN ───────────
{
  const a = arena('c4');
  const afterVerdict = async (ws, task) => { if (task.id === 't1') { writeFileSync(join(ws, 'subject.js'), MUTATED, 'utf8'); writeFileSync(join(ws, 'subject.js'), ORIGINAL, 'utf8'); } };
  await runBatch(tasks(), opts(a, { afterVerdict }));
  const j = journal(a.journalPath);
  ok(find(j, 'task_end', 't1')?.disposition === 'RETAIN' && existsSync(a.baseline), 'C4 ABA: a state that wandered and came back is RETAINED and advances the baseline');
}

// ── C2  T4 through the REAL concludeGoverned: drift between evaluate and applyAcceptance ─────
{
  const d = mkdtempSync(join(tmpdir(), 'c2-gov-'));
  writeFileSync(join(d, 'subject.js'), ORIGINAL, 'utf8');
  git(d, 'init', '-q'); git(d, 'config', 'core.autocrlf', 'false'); git(d, 'config', 'user.email', 'p@p'); git(d, 'config', 'user.name', 'p');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'start');
  const checks = { requested: { script: 'true' }, protected: { script: 'true' } };
  const g = await prepareGoverned(d, 'c2', checks, { qualifiedPath: true, image: WORKER_IMAGE });
  const res = g.ok
    ? await concludeGoverned(d, { id: 'c2', governed: { ...g, checks } }, { captureDir: null, image: WORKER_IMAGE,
      afterVerdict: async (ws) => writeFileSync(join(ws, 'subject.js'), MUTATED, 'utf8') })
    : { disposition: `prepare refused: ${g.reason}` };
  ok(res.disposition === 'IDENTITY_DRIFT', `C2 T4: governed drift is IDENTITY_DRIFT (got ${res.disposition})`);
  ok(res.workspaceRestored === false && res.countsAsCompletion !== true, 'C2 T4: not restored, not a completion');
  rmSync(d, { recursive: true, force: true });
}

// ── C3  T5b through the REAL runBatch: protected fails -> RESTORED -> identity equals START ──
{
  const a = arena('c3');
  const runTask = async (ws, task) => { if (task.id === 't1') unlinkSync(join(ws, 'keep.txt')); return { status: 'DONE', exit: 0 }; };
  await runBatch(tasks('test -f /candidate/keep.txt'), opts(a, { runTask }));
  const j = journal(a.journalPath);
  const base = find(j, 'task_baseline', 't1'); const end = find(j, 'task_end', 't1'); const start = find(j, 'task_start', 't1');
  ok(typeof base?.startIdentity === 'string' && base.startIdentity.startsWith('cid1:'), `C3 T5b: task_baseline carries a cid1 of START (${String(base?.startIdentity).slice(0, 14)})`);
  ok(end?.disposition === 'RESTORED', `C3 T5b: t1 was RESTORED (got ${end?.disposition})`);
  ok(end?.restoreIdentityHolds === true, `C3 T5b: task_end says restoreIdentityHolds=${end?.restoreIdentityHolds}`);
  const now = start?.workspace ? cid1(start.workspace) : { ok: false };
  ok(now.ok && now.id === base?.startIdentity, 'C3 T5b: the workspace on disk IS the start identity after restore');
}

console.log('');
console.log(`  ${passed} passed, ${failed} failed`);
run.artifact('rows.json', { passed, failed, rows });
run.seal({ exitStatus: failed ? 1 : 0 });
console.log(`  EH1 ${run.id}`);
process.exit(failed ? 1 : 0);
