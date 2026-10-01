/**
 * dcons1.probe.mjs - D-CONS-1: does the judged state stay one immutable object for the judgment?
 *
 *   DCONS_PHASE=before node server/dcons1.probe.mjs     (shipped evaluator - MUST FIRE on K1-K5)
 *   DCONS_PHASE=after  node server/dcons1.probe.mjs
 *
 * Frozen in legasus/screen/D-CONS-1_PREREG.md (9165f9e4) before this file existed. Runs the REAL
 * evaluate() (and applyAcceptance for K8) against a candidate with its own repo (the production shape).
 * The host mutates the workspace on a timer WHILE the check runs. Repairs nothing.
 *
 * "Authorizing" = a PASS or FAIL overall verdict: either one decides what happens to the live workspace
 * (retain, or restore). Only EVALUATION_ERROR authorizes nothing.
 */
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, renameSync, rmSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';
import { evaluate } from './evaluator.js';
import { applyAcceptance } from './acceptance.js';
import { cid1 } from './cid1.mjs';

const PHASE = process.env.DCONS_PHASE;
if (!['before', 'after'].includes(PHASE)) throw new Error('set DCONS_PHASE=before or after');
const REPO = process.cwd();
const run = openRun({ root: join(REPO, 'legasus', 'evidence-runs'), label: `D-CONS-1-${PHASE.toUpperCase()}`, command: `DCONS_PHASE=${PHASE} node server/dcons1.probe.mjs`,
  repo: REPO, evidenceClass: EVIDENCE_CLASS.ORIGINAL, note: `D-CONS-1 ${PHASE} the evaluator repair. Prereg 9165f9e4.` });
const log = []; const say = (s) => { console.log(s); log.push(s); };
const temps = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (at, a) => execFileSync('git', ['-C', at, ...a], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const ORIGINAL = 'module.exports={probe:()=>"ORIGINAL"};\n';
const MUTATED = 'module.exports={probe:()=>"MUTATED"};\n';
function candidate() {
  const d = mkdtempSync(join(tmpdir(), 'dcons-')); temps.push(d);
  writeFileSync(join(d, 'subject.js'), ORIGINAL); writeFileSync(join(d, 'keep.txt'), 'KEEP\n'); writeFileSync(join(d, 'lib.js'), 'module.exports=1;\n');
  git(d, ['init', '-q']); git(d, ['config', 'core.autocrlf', 'false']); git(d, ['add', '-A']);
  git(d, ['-c', 'user.email=k@k', '-c', 'user.name=k', 'commit', '-q', '-m', 'start']);
  return d;
}
const authorizing = (v) => v.verdict === 'PASS' || v.verdict === 'FAIL';
const sawMutated = (v) => /MUTATED/.test(v.requested?.out || '');
const rows = [];
function record(id, label, r) { rows.push({ id, label, ...r }); say(`  ${id.padEnd(3)} ${label.padEnd(46)} ${r.outcome.padEnd(30)} ${r.note || ''}`); }

/** Run evaluate() while scheduled host mutations fire at the given offsets (ms from start). */
async function during(d, task, schedule, opts = {}) {
  const C0 = cid1(d).id; const t0 = Date.now();
  const timers = schedule.map(([ms, f]) => setTimeout(() => { try { f(d); } catch (e) { say(`    mutation failed: ${e.message}`); } }, ms));
  const v = await evaluate(d, task, opts);
  timers.forEach(clearTimeout);
  return { v, C0, C1: cid1(d).id, ms: Date.now() - t0 };
}
const T = (script) => ({ id: 'dcons', requested: { script }, protected: { script: 'true' } });

try {
  say(`D-CONS-1 ${PHASE.toUpperCase()}   EH1 ${run.id}`);

  // K0 no mutation
  { const d = candidate(); const { v, C0, C1 } = await during(d, T('cat /candidate/subject.js'), []);
    record('K0', 'no mutation', { outcome: v.verdict === 'PASS' ? (v.subject === C0 ? 'ADMISSIBLE, subject=C0' : `PASS, subject ${v.subject ? 'WRONG' : 'ABSENT'}`) : `verdict ${v.verdict}`,
      verdict: v.verdict, subject: v.subject ?? null, C0, C1 }); }

  // K1-K4: a mutation lands mid-check (the check sleeps, then reads)
  const MID = 'sleep 7; cat /candidate/subject.js; ls /candidate';
  for (const [id, label, f] of [
    ['K1', 'file bytes change', (d) => writeFileSync(join(d, 'subject.js'), MUTATED)],
    ['K2', 'file added', (d) => writeFileSync(join(d, 'added.txt'), 'new\n')],
    ['K3', 'file removed', (d) => unlinkSync(join(d, 'keep.txt'))],
    ['K4', 'rename, bytes equivalent', (d) => renameSync(join(d, 'lib.js'), join(d, 'lib2.js'))],
  ]) {
    const d = candidate(); const { v, C0, C1, ms } = await during(d, T(MID), [[3500, f]]);
    const changed = C0 !== C1;
    record(id, label, { outcome: !changed ? 'APPARATUS (mutation did not land)' : authorizing(v) ? `AUTHORIZED (${v.verdict}) - VIOLATION` : 'NOT AUTHORIZING (EVALUATION_ERROR)',
      verdict: v.verdict, subject: v.subject ?? null, C0, C1, note: `${ms}ms; check output: ${JSON.stringify(String(v.requested?.out || '').replace(/\s+/g, ' ').slice(0, 70))}` });
  }

  // K5 mutate -> restore: the check reads twice; the host mutates between the reads and restores before the end
  { const d = candidate();
    const { v, C0, C1, ms } = await during(d, T('cat /candidate/subject.js; sleep 6; cat /candidate/subject.js; sleep 6'),
      [[4000, (x) => writeFileSync(join(x, 'subject.js'), MUTATED)], [11500, (x) => writeFileSync(join(x, 'subject.js'), ORIGINAL)]]);
    const transient = sawMutated(v);
    record('K5', 'mutate -> restore before the post-check', { outcome: C0 !== C1 ? 'APPARATUS (restore did not land)'
        : transient ? `CHECK SAW TRANSIENT BYTES, verdict ${v.verdict} - VIOLATION` : v.verdict === 'PASS' ? 'ADMISSIBLE, check saw only C0' : `verdict ${v.verdict}`,
      verdict: v.verdict, subject: v.subject ?? null, C0, C1, endpointsEqual: C0 === C1, transientObserved: transient,
      note: `${ms}ms; endpoints ${C0 === C1 ? 'EQUAL' : 'differ'}; output ${JSON.stringify(String(v.requested?.out || '').replace(/\s+/g, ' ').slice(0, 90))}` }); }

  // K6 the check tries to write into /candidate
  { const d = candidate(); const { v, C0, C1 } = await during(d, T('echo x > /candidate/created.txt; echo "rc=$?"; true'), []);
    const rc = (String(v.requested?.out || '').match(/rc=(\d+)/) || [])[1];
    record('K6', 'check writes /candidate', { outcome: rc && rc !== '0' && C0 === C1 ? 'WRITE REFUSED, subject unchanged' : `write rc=${rc}, cid1 ${C0 === C1 ? 'same' : 'CHANGED'} - VIOLATION`,
      verdict: v.verdict, C0, C1 }); }

  // K7 mutation, then the check times out
  { const d = candidate(); const { v, C0, C1 } = await during(d, T('sleep 300'), [[3000, (x) => writeFileSync(join(x, 'subject.js'), MUTATED)]], { timeoutSec: 10 });
    record('K7', 'mutation, then the check times out', { outcome: v.verdict === 'EVALUATION_ERROR' ? 'NO AUTHORITATIVE VERDICT' : `AUTHORIZED (${v.verdict}) - VIOLATION`, verdict: v.verdict, C0, C1 }); }

  // K8 the commit boundary: mutate AFTER evaluate() returns, BEFORE acceptance acts - must STAY RED here
  { const d = candidate(); const startRef = git(d, ['rev-parse', 'HEAD']);
    const task = { id: 'k8', requested: { script: 'node -e "process.exit(require(\'/candidate/subject.js\').probe()===\'ORIGINAL\'?0:1)"' }, protected: { script: 'true' } };
    const v = await evaluate(d, task); const subj = cid1(d).id;
    writeFileSync(join(d, 'subject.js'), MUTATED);                       // lands between verdict and commit
    const acc = await applyAcceptance(d, task, v, { startRef, captureDir: null, taskId: 'k8' });
    const committed = cid1(d).id;
    record('K8', 'mutation between verdict and commit', { outcome: acc.disposition === 'RETAIN' && committed !== (v.subject ?? subj)
        ? 'RETAINED A STATE THE VERDICT NEVER JUDGED (expected red: commit boundary)' : `disposition ${acc.disposition}`,
      verdict: v.verdict, disposition: acc.disposition, survivingVerdict: acc.survivingWorkspaceVerdict?.overall, judged: v.subject ?? subj, committed,
      note: `surviving re-check: ${acc.survivingWorkspaceVerdict?.overall}` }); }

  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  const viol = (id) => /VIOLATION/.test(by[id]?.outcome || '');
  const verdict = PHASE === 'before'
    ? { mustFire: ['K1', 'K2', 'K3', 'K4'].some(viol) && viol('K5'), k1to4Authorized: ['K1', 'K2', 'K3', 'K4'].filter(viol), k5TransientSeen: viol('K5'), k8Red: /RETAINED A STATE/.test(by.K8.outcome) }
    : { k0Admissible: /ADMISSIBLE/.test(by.K0.outcome), k1to4NotAuthorizing: ['K1', 'K2', 'K3', 'K4'].every((k) => /NOT AUTHORIZING/.test(by[k].outcome)),
        k5ImmutableJudgment: /ADMISSIBLE, check saw only C0/.test(by.K5.outcome), k6: /WRITE REFUSED/.test(by.K6.outcome), k7: /NO AUTHORITATIVE/.test(by.K7.outcome),
        k8StillRed: /RETAINED A STATE/.test(by.K8.outcome) };
  say(`\n=== D-CONS-1 ${PHASE.toUpperCase()} ===`);
  for (const [k, x] of Object.entries(verdict)) say(`    ${k.padEnd(22)} ${JSON.stringify(x)}`);
  run.artifact('dcons1.log', log.join('\n') + '\n');
  run.artifact('result.json', { phase: PHASE, rows, verdict });
  const s = run.seal({ exitStatus: 0 }); console.log(`EH1 sealed: ${s.state}  ${run.dir}`);
} catch (e) {
  say(`APPARATUS FAILURE: ${e.stack || e}`); try { run.artifact('dcons1.log', log.join('\n') + '\n'); run.abandon({ reason: String(e.message).slice(0, 300) }); } catch {}
  process.exitCode = 1;
} finally { for (const d of temps) { try { rmSync(d, { recursive: true, force: true }); } catch {} } }
