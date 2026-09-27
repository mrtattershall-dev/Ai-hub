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
 * WHY A FAILURE LOOKS TOTAL. A verdict of "every step failed" has at least three causes that call
 * for different responses, and reporting them as one number was a real defect in this instrument:
 *
 *   RUNTIME_EXCEPTION_AT_LOAD  the page threw while loading. Nothing about the candidate's
 *                              behaviour was observed, and nothing about it can be concluded -
 *                              the failing behavioural steps were never reached.
 *   SEAM_MISSING               no exception, but the declared state accessor is absent, so the
 *                              contract was not met and again nothing behavioural was observed.
 *   BEHAVIOUR                  the page loaded, state was readable, and steps failed on their
 *                              own terms. Only here do the step verdicts describe the program.
 *
 * ON "INITIALIZATION COMPLETED": state being readable does NOT by itself establish that the
 * script finished. What does establish it here is a conjunction: the seam is the LAST statement in
 * the file, so if the seam is readable AND no page error was raised, execution reached the end.
 * Hoisting the seam earlier would DESTROY that property - it would make the seam readable while
 * later initialization could still have thrown. So the seam stays last and the exception is
 * recorded separately, which is the opposite of the fix I first proposed.
 */
export function classifyFailure(play, rec) {
  const errors = [...(play.errors || [])];
  const threw = errors.filter((e) => /^\[JS ERROR\]/.test(e));
  const seamMissing = /reading 'state'|window\.game|__error/.test(String(play.log || ''));
  const observed = (play.passing || []).length > 0 || !seamMissing;
  let failureClass = 'NONE';
  if (play.status !== 'OK') failureClass = 'APPARATUS_UNAVAILABLE';
  else if (threw.length && !observed) failureClass = 'RUNTIME_EXCEPTION_AT_LOAD';
  else if (!threw.length && !observed) failureClass = 'SEAM_MISSING';
  else if ((play.failing || []).length) failureClass = 'BEHAVIOUR';
  return {
    failureClass,
    loadErrors: errors.slice(0, 5),
    threwDuringLoad: threw.length > 0,
    stateObserved: observed,
    // The conjunction above, stated as a claim that can be false.
    initializationCompleted: observed && threw.length === 0,
    behaviouralVerdictsMeaningful: failureClass === 'BEHAVIOUR' || failureClass === 'NONE',
    note: failureClass === 'RUNTIME_EXCEPTION_AT_LOAD'
      ? 'the page threw while loading: the failing behavioural steps were NEVER REACHED, so no claim about the candidate behaviour follows from them'
      : failureClass === 'SEAM_MISSING'
        ? 'no exception, but the declared state accessor is absent: the contract was not met and behaviour was not observed'
        : null,
  };
}


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
    // The captured page and console errors, kept as their own field. Arm B's four "total
    // failures" were all one `[JS ERROR] Cannot read properties of null (reading
    // 'addEventListener')`, and the record threw that message away, leaving only "every step
    // failed" - which is exactly the sentence a repair cannot be built from.
    errors: [...(play.errors || [])],
  };
  rec.diagnosis = classifyFailure(play, rec);
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
