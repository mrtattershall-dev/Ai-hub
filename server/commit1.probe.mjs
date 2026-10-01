/**
 * commit1.probe.mjs - COMMIT-1. The terminal-state authority boundary, UNREPAIRED.
 *
 *   node server/commit1.probe.mjs
 *
 * Frozen in legasus/screen/COMMIT-1_PREREG.md (claim 6b655812) BEFORE this file existed.
 * Nothing is repaired. acceptance.js, batch.js, governance.js, evaluator.js are run AS SHIPPED.
 * cid1 is the probe's own oracle only. Every arm goes through EH1.
 *
 * THE PROPERTY: every state that becomes authoritative must carry an authorization for that exact
 * identity. An accepting verdict authorizes only verdict.subject; rejection/restoration preserves
 * the previously authoritative identity; unestablishable equality fails closed.
 *
 * INJECTABLE vs COMPOSITIONAL, stated so the result cannot overclaim:
 *   T1 K8      applyAcceptance called directly - the probe controls the gap between verdict and
 *              commit, so a mutation can be INJECTED there.                            INJECTED
 *   T5 governed real prepareGoverned -> real damage -> real concludeGoverned -> RESTORE.  INJECTED
 *   T6         refusal/error paths, direct.                                            INJECTED
 *   ABA        mutate then restore to C0 bytes, then commit.                           INJECTED
 *   T2 T3 T4   runBatch's finalise and concludeGoverned each call evaluate() then
 *              applyAcceptance() back-to-back with NO external injection point. They are shown
 *              to fire BY COMPOSITION with T1 (they persist whatever applyAcceptance RETAINs),
 *              cited to their code sites, and recorded as such - never as an injected result.
 */
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cid1 } from './cid1.mjs';
import { evaluate, VERDICT } from './evaluator.js';
import { applyAcceptance, DISPOSITION } from './acceptance.js';
import { prepareGoverned, concludeGoverned } from './governance.js';
import { WORKER_IMAGE } from './worker.js';
import { openRun, EVIDENCE_CLASS } from './evidenceRun.mjs';

const RUNROOT = process.env.COMMIT1_RUNS || join(tmpdir(), 'commit1-runs');
mkdirSync(RUNROOT, { recursive: true });
const run = openRun({ root: RUNROOT, label: 'COMMIT-1', command: 'node server/commit1.probe.mjs',
  repo: process.cwd(), evidenceClass: EVIDENCE_CLASS.ORIGINAL,
  note: 'terminal-state authority boundary, unrepaired. K8 must fire first.' });

const out = []; const rows = [];
const say = (s) => { console.log(s); out.push(s); };
const git = (ws, ...a) => execFileSync('git', ['-C', ws, ...a], { encoding: 'utf8', windowsHide: true }).trim();
const short = (s) => (s ? String(s).slice(0, 18) : String(s));
const record = (id, label, r) => { rows.push({ id, label, ...r }); say(`--- ${id}  ${label}`); for (const [k, v] of Object.entries(r)) say(`    ${k.padEnd(14)} ${typeof v === 'string' ? v : JSON.stringify(v)}`); say(''); };

const ORIGINAL = 'module.exports={probe:()=>"ORIGINAL"};\n';
const MUTATED = 'module.exports={probe:()=>"MUTATED"};\n';

/** A candidate with its own repo - the production shape D-CONS used. Returns { d, startRef }. */
function candidate() {
  const d = mkdtempSync(join(tmpdir(), 'commit1-'));
  writeFileSync(join(d, 'subject.js'), ORIGINAL, 'utf8');
  writeFileSync(join(d, 'keep.txt'), 'protected\n', 'utf8');
  git(d, 'init', '-q'); git(d, 'config', 'core.autocrlf', 'false');
  git(d, 'config', 'user.email', 'p@p'); git(d, 'config', 'user.name', 'p');
  git(d, 'add', '-A'); git(d, 'commit', '-q', '-m', 'start');
  return { d, startRef: git(d, 'rev-parse', 'HEAD') };
}
const PASS_TASK = (id) => ({ id, requested: { script: 'true' }, protected: { script: 'true' } });

say('COMMIT-1  unrepaired  EH1 ' + run.id); say('');

// ═══ T1 / K8  THE MUST-FIRE. Reused verbatim from dbind1.probe.mjs:136-141. ═══════════════════
let k8Fired = false;
{
  const { d, startRef } = candidate();
  const v = await evaluate(d, PASS_TASK('k8'));
  const C0 = v.subject;
  writeFileSync(join(d, 'subject.js'), MUTATED, 'utf8');                 // the gap: after verdict, before commit
  const acc = await applyAcceptance(d, PASS_TASK('k8'), v, { startRef, captureDir: null, taskId: 'k8' });
  const live = cid1(d).id;
  k8Fired = acc.disposition === DISPOSITION.RETAIN && live !== C0;
  record('T1', 'K8: mutation between verdict and commit', {
    verdict: v.verdict, C0: short(C0), live: short(live), disposition: acc.disposition, promotable: acc.promotable,
    outcome: k8Fired ? 'FIRES - authorized(C0), RETAINED(C1), C0 != C1' : `did not fire (${acc.disposition})`,
  });
}
if (!k8Fired) {
  say('K8 DID NOT FIRE UNREPAIRED. The probe is broken, not the system. NOT_EVALUATED - stopping.');
  run.artifact('rows.json', { rows, verdict: 'NOT_EVALUATED', why: 'must-fire K8 did not fire' });
  run.seal({ exitStatus: 2 }); process.exit(2);
}

// ═══ ABA  must be PERMITTED after repair; trivially permitted now (nothing checks) ════════════
{
  const { d, startRef } = candidate();
  const v = await evaluate(d, PASS_TASK('aba'));
  const C0 = v.subject;
  writeFileSync(join(d, 'subject.js'), MUTATED, 'utf8');                 // -> C1
  writeFileSync(join(d, 'subject.js'), ORIGINAL, 'utf8');                // -> back to C0 bytes
  const live = cid1(d).id;
  const acc = await applyAcceptance(d, PASS_TASK('aba'), v, { startRef, captureDir: null, taskId: 'aba' });
  record('ABA', 'mutate then restore to C0 bytes, then commit', {
    C0: short(C0), liveAtCommit: short(live), liveEqualsC0: live === C0, disposition: acc.disposition,
    outcome: acc.disposition === DISPOSITION.RETAIN ? 'PERMITTED (informative only before repair: nothing checks)' : `REFUSED (${acc.disposition})`,
  });
}

// ═══ T6a  EVALUATION_ERROR -> HELD: no new authoritative identity ═════════════════════════════
{
  const { d, startRef } = candidate();
  const v = await evaluate(d, PASS_TASK('t6a'), { image: 'sha256:' + '0'.repeat(64) });   // unpullable image -> EVALUATION_ERROR
  const acc = await applyAcceptance(d, PASS_TASK('t6a'), v, { startRef, captureDir: null, taskId: 't6a' });
  record('T6a', 'EVALUATION_ERROR -> HELD', {
    verdict: v.verdict, disposition: acc.disposition, promotable: acc.promotable,
    outcome: acc.disposition === DISPOSITION.HELD && acc.promotable === false ? 'HOLDS - nothing promoted' : 'FAILS_OPEN',
  });
}

// ═══ T6b  requested FAIL / protected PASS -> PRESERVE_INCOMPLETE, not a baseline ══════════════
{
  const { d, startRef } = candidate();
  const task = { id: 't6b', requested: { script: 'false' }, protected: { script: 'true' } };
  const v = await evaluate(d, task);
  const acc = await applyAcceptance(d, task, v, { startRef, captureDir: null, taskId: 't6b' });
  record('T6b', 'incomplete -> PRESERVE_INCOMPLETE', {
    requested: v.requested?.verdict, disposition: acc.disposition, promotable: acc.promotable,
    outcome: acc.disposition === DISPOSITION.PRESERVE_INCOMPLETE && acc.promotable === false ? 'HOLDS - kept, not authoritative' : 'FAILS_OPEN',
  });
}

// ═══ T5 governed  real prepareGoverned -> damage -> real concludeGoverned -> RESTORE ═══════════
// Anchor: g.startVerdict.candidateTree is cid1(start) since D-BIND (deprecated alias == subject).
{
  const { d } = candidate();
  const checks = { requested: { script: 'true' }, protected: { script: 'test -f /candidate/keep.txt' } };
  const g = await prepareGoverned(d, 'c1', checks, { qualifiedPath: true, image: WORKER_IMAGE });
  if (!g.ok) {
    record('T5g', 'governed RESTORE', { outcome: `NOT_EVALUATED - prepareGoverned refused: ${g.reason}` });
  } else {
    const startId = g.startVerdict?.candidateTree ?? null;              // cid1(start), transported by prepareGoverned
    unlinkSync(join(d, 'keep.txt'));                                   // damage: protected will FAIL
    // run.governed must carry `checks`: concludeGoverned reads run.governed.checks, and prepareGoverned's
    // return does not include it - the /start route assembles { checks, ...prep } itself. The first EH1
    // run passed `g` bare and T5g returned FAILED_TO_APPLY ("reading 'requested'") - apparatus, not system.
    const res = await concludeGoverned(d, { id: 'c1', governed: { ...g, checks } }, { captureDir: null, image: WORKER_IMAGE });
    const restored = cid1(d).id;
    const holds = res.disposition === DISPOSITION.RESTORED && startId && restored === startId;
    record('T5g', 'governed RESTORE: restored state == previously authoritative identity', {
      startId: short(startId), disposition: res.disposition, restoredId: short(restored), equalsStart: restored === startId,
      outcome: !startId ? 'UNMEASURABLE - no cid1 of start transported'
        : holds ? 'HOLDS - restore returned the previously authoritative identity'
          : res.disposition !== DISPOSITION.RESTORED ? `NOT a RESTORED transition (${res.disposition})`
            : 'FIRES - restored state is not the previously authoritative identity',
    });
  }
}

// ═══ T5 batch  UNMEASURABLE by construction: batch.js's task start is git-only (no cid1 of start) ═
record('T5b', 'batch RESTORE anchor', { outcome: 'UNMEASURABLE - batch.js task start computes startRef/startTree by git only; no cid1 of START exists in that path (batch.js:281-282)' });

// ═══ T2 T3 T4  BY COMPOSITION, not injected ═══════════════════════════════════════════════════
record('T2', 'RETAIN -> accepted baseline', { outcome: 'FIRES_BY_COMPOSITION - batch.js finalise cpSyncs the LIVE ws on RETAIN (batch.js:194) and records survivingWorkspaceVerdict; T1 shows RETAIN of C1 under C0, so the baseline becomes C1. Not injected: no external hook between evaluate() and applyAcceptance() inside runBatch.' });
record('T3', 'baseline -> next task start', { outcome: 'FIRES_BY_INHERITANCE - the next task is seeded from the baseline and startRef/startTree are a git commit of whatever was copied (batch.js:275-282). Drift in T2 becomes the next restore anchor.' });
record('T4', 'governed conclusion -> surviving state', { outcome: 'FIRES_BY_COMPOSITION - concludeGoverned calls evaluate() then the SAME applyAcceptance back-to-back (governance.js:137-138); T1 is the shared transition. No external injection point.' });

// ═══ classification, from the frozen table ═════════════════════════════════════════════════
const by = Object.fromEntries(rows.map((r) => [r.id, r]));
const fires = rows.filter((r) => /^FIRES/.test(r.outcome)).map((r) => r.id);
say('=== COMMIT-1 (unrepaired) ===');
say(`  must-fire K8          : FIRED`);
say(`  FIRES (injected)      : ${rows.filter((r) => /^FIRES -/.test(r.outcome)).map((r) => r.id).join(', ') || '(none)'}`);
say(`  FIRES (by composition): ${rows.filter((r) => /^FIRES_BY/.test(r.outcome)).map((r) => r.id).join(', ') || '(none)'}`);
say(`  HOLDS                 : ${rows.filter((r) => /^HOLDS/.test(r.outcome)).map((r) => r.id).join(', ') || '(none)'}`);
say(`  UNMEASURABLE          : ${rows.filter((r) => /^UNMEASURABLE/.test(r.outcome)).map((r) => r.id).join(', ') || '(none)'}`);
say(`  ABA                   : ${by.ABA.outcome}`);
say(''); say('NOTHING WAS REPAIRED.');

run.artifact('commit1.log', out.join('\n') + '\n');
run.artifact('rows.json', { rows, fires, k8Fired, prereg: 'legasus/screen/COMMIT-1_PREREG.md @ 6b655812' });
const sealed = run.seal({ exitStatus: 0 });
console.log(`EH1 sealed ${sealed.state} artifacts=${sealed.artifacts.length} clean=${sealed.worktreeClean} diff=${String(sealed.worktreeDiffHash).slice(0, 12)}`);
console.log(`run dir: ${run.dir}`);
