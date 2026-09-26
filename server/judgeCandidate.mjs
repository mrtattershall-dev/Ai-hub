/**
 * judgeCandidate.mjs - the UNCHANGED gate, in one place, so that two generation protocols
 * cannot accidentally be judged by two different standards.
 *
 * The narrow-artifact harness (whole-file return) and the localized-edit harness both end the
 * same way: the candidate is on disk and committed, and then the declared play, the independent
 * evaluator and the acceptance policy decide what happens to it. That tail used to live inside
 * narrowArtifact.mjs. Comparing a whole-file cell against an edit cell is only meaningful if
 * the tail is identical, and "identical" is worth more as a shared function than as a promise:
 * narrowArtifact's own 34-case suite still passes over this extraction, which is the evidence
 * that moving it changed nothing.
 *
 * Nothing here decides anything about the candidate. It records what the gate said.
 */

const VERDICT_RETAIN = 'RETAIN';

/**
 * Judge the workspace as it stands. Fills `rec` in place and returns it.
 *
 *   ws        the workspace, with the candidate already written AND committed
 *   task      the bench task (its play spec, protected spec and requested spec)
 *   spec      task.diagnostic.spec - the declared play
 *   startRef  the verified starting commit, for the acceptance policy's rollback
 *   rec       the record being built; rec.boundaries and rec.timing are filled
 *   T0        the run's start, for elapsed timings
 *   deps      { playCheck, evaluate, applyAcceptance, join, readFileSync }
 */
export async function judgeCandidate(ws, task, spec, startRef, rec, T0, deps) {
  const { playCheck, evaluate, applyAcceptance, join, readFileSync } = deps;
  const ENTRY = spec.entry || 'index.html';

  const play = await playCheck(ws, spec, { timeoutMs: 90_000 });
  rec.boundaries.reachedExecution = play.status === 'OK';
  rec.play = {
    status: play.status, reason: play.reason ?? null,
    passing: [...(play.passing || [])], failing: [...(play.failing || [])],
    total: play.total ?? null, log: String(play.log || '').slice(0, 4000),
  };
  rec.timing.playMs = Date.now() - T0;

  const verdict = await evaluate(ws, task, { timeoutSec: 120 });
  rec.boundaries.passedDiagnostic = verdict.requested?.verdict === 'PASS';
  rec.boundaries.passedProtected = !task.protected || verdict.protected?.verdict === 'PASS';
  rec.verdict = {
    overall: verdict.verdict, requested: verdict.requested?.verdict ?? null,
    protected: verdict.protected?.verdict ?? null, requestedFailing: verdict.requested?.failing ?? null,
  };

  const acc = await applyAcceptance(ws, task, verdict, { startRef, captureDir: join(ws, '.rejected'), taskId: task.id });
  rec.boundaries.accepted = acc.disposition === VERDICT_RETAIN;
  rec.acceptance = {
    disposition: acc.disposition, countsAsCompletion: acc.countsAsCompletion, promotable: acc.promotable,
    // what SURVIVED matters as much as the label: a rollback that reports success while the
    // workspace no longer passes is the failure this whole record exists to make visible.
    survivingWorkspaceVerdict: acc.survivingWorkspaceVerdict ?? null, survivingBytes: acc.survivingBytes ?? null,
  };
  rec.timing.acceptanceMs = Date.now() - T0;
  if (rec.boundaries.accepted) rec.acceptedFile = readFileSync(join(ws, ENTRY), 'utf8');
  return rec;
}
