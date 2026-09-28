// ══════════════════════════════════════════════════════════════════════════════════════════════════
// attemptRecord.mjs — PRESERVE what an attempt taught, separately from whether it was authorized.
//
// Two decisions that are not the same decision:
//   AUTHORIZED TO SURVIVE    does this change replace the working program? `retainPath.shouldRetain`
//                            answers that, and nothing here weakens it.
//   WORTH KEEPING TO STUDY   did this attempt show a mechanism working, even while failing its task?
//
// The runner used to answer only the first. A rejected candidate's assembled file and its workspace
// were deleted and only a SHA survived, so "it failed to clear the filter, but it DID create a visible
// control and wire its click handler" was unrecoverable the moment the process exited. Destroyed
// information is terminal, not pending - it cannot be recovered by deciding later that it mattered.
//
// So: every attempt is written down, accepted or not. The task's verdict is untouched. What is added is
// the material needed to ask, afterwards, what went wrong and whether some part of it went right.
//
// WHAT THIS DELIBERATELY DOES NOT DO: it draws no lesson, promotes nothing to guidance, and lets no
// preserved fragment influence a later run. A partial success recorded here is a QUESTION. Turning one
// into a rule takes reproduction, a discriminating experiment, and a test on cases that did not produce
// it - none of which happens here.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * WHAT WAS PREDICTED, AND WHAT HAPPENED.
 *
 * The prediction is not a guess about the model. It is what the plan COMMITS to: if this edit is what
 * the requirement asked for, the addition checks pass and the carried-forward checks keep passing. The
 * emitter has already established both halves are meaningful - it refuses to emit unless the addition
 * FAILS on the delivered page and the carried-forward checks PASS there.
 *
 * The classes below are about where an attempt sat relative to that commitment. They are descriptions
 * of a record, not verdicts: `NOTHING_WORKED` and `PARTIAL_EFFECT` are both failures of the task.
 *
 *   MET                  the addition checks passed and nothing carried forward broke
 *   PARTIAL_EFFECT       SOME addition checks passed and some did not - a mechanism worked partway.
 *                        This is the interesting one, and the reason this file exists.
 *   NOTHING_WORKED       no addition check passed; the carried-forward checks survived
 *   BROKE_WHAT_WORKED    something carried forward stopped working, whatever the addition did
 *   NOT_JUDGED           the completion never reached the gate (refused, or no code at all)
 *   UNCLASSIFIED         the task does not declare which checks are the addition
 */
export const MISMATCH = {
  MET: 'MET',
  PARTIAL_EFFECT: 'PARTIAL_EFFECT',
  NOTHING_WORKED: 'NOTHING_WORKED',
  BROKE_WHAT_WORKED: 'BROKE_WHAT_WORKED',
  NOT_JUDGED: 'NOT_JUDGED',
  UNCLASSIFIED: 'UNCLASSIFIED',
};

export function classifyAttempt(task, rec) {
  const prov = (task && task.provenance) || {};
  const addition = prov.additionSteps;
  const carriedForward = prov.carriedSteps;
  if (!rec || !rec.play || !Array.isArray(rec.play.passing)) {
    return { mismatch: MISMATCH.NOT_JUDGED, why: 'the completion never reached the gate', addition: null, carriedForward: null };
  }
  if (!Array.isArray(addition) || !Array.isArray(carriedForward)) {
    return { mismatch: MISMATCH.UNCLASSIFIED, why: 'the task does not say which of its checks are the addition', addition: null, carriedForward: null };
  }
  const pass = new Set(rec.play.passing);
  const addPassed = addition.filter((n) => pass.has(n));
  const carriedBroken = carriedForward.filter((n) => !pass.has(n));
  const detail = {
    addition: { asked: addition, passed: addPassed, failed: addition.filter((n) => !pass.has(n)) },
    carriedForward: { asked: carriedForward, broken: carriedBroken },
  };
  // Breaking what already worked is reported first whatever else happened: an addition that works by
  // damaging the page is not a partial success, it is a regression that also did something.
  if (carriedBroken.length) {
    return { ...detail, mismatch: MISMATCH.BROKE_WHAT_WORKED, why: `${carriedBroken.length} carried-forward check(s) stopped passing: ${carriedBroken.join(', ')}` };
  }
  if (addPassed.length === addition.length) {
    return { ...detail, mismatch: MISMATCH.MET, why: 'every addition check passed and nothing carried forward broke' };
  }
  if (addPassed.length) {
    return { ...detail, mismatch: MISMATCH.PARTIAL_EFFECT, why: `addition check(s) ${addPassed.join(', ')} passed while ${detail.addition.failed.join(', ')} did not - something worked partway` };
  }
  return { ...detail, mismatch: MISMATCH.NOTHING_WORKED, why: 'no addition check passed; the page is intact and unchanged in the way that was asked for' };
}

/**
 * Write one attempt to the corpus. The FULL assembled candidate, not a hash of it - a hash answers
 * "was this the same file" and nothing else, and the question a preserved attempt has to answer later
 * is "what did it actually write".
 *
 * Returns the relative path recorded in the run, or null if nothing could be written. A corpus that
 * cannot be written is reported, never silently skipped.
 */
export function preserveAttempt(dir, rec, { candidate, rawFull, prompt, suffix, proposal, classification }) {
  try {
    mkdirSync(dir, { recursive: true });
    const stem = `r${rec.round}-s${rec.seed}-${String(rec.outcome || 'UNKNOWN').toLowerCase()}`;
    if (candidate) writeFileSync(join(dir, `${stem}.html`), candidate, 'utf8');
    writeFileSync(join(dir, `${stem}.json`), JSON.stringify({
      round: rec.round, seed: rec.seed, outcome: rec.outcome,
      // The record the investigation needs: what was asked, what was sent, what came back, what it did.
      classification,
      proposal,
      request: { prompt, suffix },
      // THE COMPLETE completion, not the 6000-character slice the run record keeps. A corpus that
      // truncates the artifact it exists to preserve has the defect it was built to prevent: a runaway
      // completion is exactly the case worth studying, and exactly the one a slice destroys.
      completion: { ...rec.rawCompletion, text: rawFull !== undefined ? rawFull : rec.rawCompletion.text, truncatedInRunRecord: rec.rawCompletion.chars > 6000 },
      contained: rec.transformedCandidate || null,
      containment: rec.containment || null,
      play: rec.play ? { passing: rec.play.passing, failing: rec.play.failing, errors: (rec.play.errors || []).slice(0, 5) } : null,
      acceptance: rec.acceptance ? { disposition: rec.acceptance.disposition, protected: rec.acceptance.survivingWorkspaceVerdict && rec.acceptance.survivingWorkspaceVerdict.protected } : null,
      decision: rec.decision || null,
      candidateFile: candidate ? `${stem}.html` : null,
    }, null, 2), 'utf8');
    return stem;
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}
