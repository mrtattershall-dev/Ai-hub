/**
 * recovery.js - THE RECOVERY CONTROLLER: decides, from verified facts, whether the model's
 * last change survives and whether another attempt deserves compute.
 *
 * A DECIDING path, not an advisory sentence. Every earlier Hub "recovery" was a message the
 * model could ignore; this one restores bytes, refuses repeats and stops runs.
 *
 * Facts it uses (all already produced by the Hub):
 *   - the automatic diagnostic (autodiag.js): per-case pass/fail bound to the target's sha256
 *   - the protected set: the cases that passed on the verified checkpoint (discovered, not
 *     designed - the same rule acceptance.js uses)
 *   - the target's bytes at the verified checkpoint, kept here so restoration is exact
 *
 * Decision table (RECOVERY-CONTROLLER_DESIGN.md), applied after every content change:
 *   target fixed, protected passes        ACCEPT     checkpoint advances to the candidate
 *   progress, protected passes            PROVISIONAL keep the candidate; the verified checkpoint
 *                                                    stays available; continuation allowed
 *   protected breaks (incl. import error) RESTORE    checkpoint bytes written back; the rejected
 *                                                    candidate and its evidence are preserved
 *   no measurable progress                DISCARD    restore; a different plan is requested
 *   same rejected candidate again         REPEAT     restore WITHOUT re-verifying; counted
 *   budget exhausted / repeats exhausted  STOP       the run ends; nothing further executes
 *
 * Policy (an engineering starting point, not an established optimum): maxAttempts counts
 * RESTORE + DISCARD decisions (one first attempt + one fresh-plan retry = 2); continuation on
 * PROVISIONAL does not consume an attempt; maxRepeats identical-candidate refusals end the run.
 */
import { createHash } from 'node:crypto';

// maxProvisional: an OVERALL bound on continuation. A provisional step consumes no attempt, so
// without this a run could evade termination by producing small improvements forever. (The
// strictly-increasing rule already bounds it by the number of cases; this is explicit and
// smaller.) Exceeding it STOPS the run; the provisional candidate is left in place for
// acceptance to judge - it was never fully verified, and acceptance says so.
export const DEFAULT_POLICY = Object.freeze({ maxAttempts: 2, maxRepeats: 2, maxProvisional: 3 });
export const MAX_RESIDUAL_SHOWN = 6;

const sha = (s) => createHash('sha256').update(s).digest('hex');
const passingSet = (result) => {
  if (!result || result.status !== 'OK' || result.importError !== undefined || !result.attempted) return new Set();
  const failing = new Set((result.failures || []).map((f) => f.n));
  const s = new Set();
  for (let n = 1; n <= result.attempted; n++) if (!failing.has(n)) s.add(n);
  return s;
};

/** Build the controller state from the OPENING diagnostic and the target's current bytes. */
export function initRecovery(startResult, targetBytes, policy = {}, targetSha = null) {
  const p = { ...DEFAULT_POLICY, ...(policy || {}) };
  if (!startResult || startResult.status !== 'OK') {
    return { enabled: false, reason: 'the opening diagnostic could not run, so no checkpoint could be established', policy: p };
  }
  // BUILT FROM NOTHING: the target does not exist or does not load yet. The checkpoint is that
  // empty state, the protected set is empty, and the first candidate that plays at all is
  // progress. (A module that fails to import at the start is the same case.)
  const passing = passingSet(startResult);
  return {
    enabled: true, policy: p, state: 'ACTIVE',
    // The checkpoint's identity is the DIAGNOSTIC's identity for this target (a module's file
    // bytes, or a game's snapshot over its tracked files) - the same hash freshness compares.
    verified: { sha256: targetSha || sha(targetBytes), bytes: targetBytes, passing: [...passing], passed: startResult.passed || 0, attempted: startResult.attempted || null, failures: startResult.failures || [], fromNothing: startResult.importError !== undefined || !startResult.attempted },
    provisional: null,
    attempts: 0, freshPlans: 0, repeats: 0, provisionals: 0,
    rejected: [],          // { sha256, reason, kind, passed, brokeProtected: [...], at }
    decisions: [],         // { action, reason, sha256, at }
  };
}

/** Is this candidate one the controller already rejected? */
export function isRejected(rec, candidateSha) {
  return !!(rec && rec.enabled && rec.rejected.some((r) => r.sha256 === candidateSha));
}

/**
 * Decide on a VERIFIED candidate. Pure: returns the decision and the updated state fields;
 * the caller performs the restore / stop and records steps.
 */
export function decide(rec, result, candidateSha) {
  const now = Date.now();
  const record = (d) => { rec.decisions.push({ ...d, sha256: candidateSha, at: now }); return d; };
  if (!rec.enabled || rec.state !== 'ACTIVE') return record({ action: 'NONE', reason: 'controller inactive' });
  if (candidateSha === rec.verified.sha256) return record({ action: 'NONE', reason: 'the target is the verified checkpoint' });

  if (!result || result.status !== 'OK') {
    // Unverifiable is not acceptable: nothing is known about the candidate. Restore, but this
    // is an INFRASTRUCTURE event, not the model's attempt - it does not consume an attempt.
    return record({ action: 'RESTORE', kind: 'UNVERIFIABLE', reason: `the diagnostic could not run (${result?.reason || 'unknown'}); an unverified candidate is not kept`, countsAsAttempt: false });
  }
  const best = Math.max(rec.verified.passed, rec.provisional?.passed ?? -1);
  if (result.importError !== undefined) {
    return afterRejection(rec, record({ action: 'RESTORE', kind: 'IMPORT_ERROR', reason: `the file no longer imports (${result.importError})`, brokeProtected: rec.verified.passing.slice(), countsAsAttempt: true }), result, candidateSha);
  }
  const nowPassing = passingSet(result);
  const broke = rec.verified.passing.filter((n) => !nowPassing.has(n));
  if (broke.length) {
    return afterRejection(rec, record({ action: 'RESTORE', kind: 'PROTECTED_BROKEN', reason: `protected behaviour broke: case(s) ${broke.join(', ')} passed on the checkpoint and fail now`, brokeProtected: broke, countsAsAttempt: true }), result, candidateSha);
  }
  if (result.passed === result.attempted) {
    rec.state = 'ACCEPTED';
    return record({ action: 'ACCEPT', reason: `every case passes (${result.passed}/${result.attempted}) and protected behaviour held` });
  }
  if (result.passed > best) {
    rec.provisionals++;
    const d = record({ action: 'PROVISIONAL', reason: `progress: ${result.passed}/${result.attempted} pass (was ${best}); protected behaviour held; the verified checkpoint stays available`, countsAsAttempt: false });
    if (rec.provisionals > rec.policy.maxProvisional) {
      rec.state = 'STOPPED';
      d.stop = `provisional continuations exhausted (${rec.provisionals} > ${rec.policy.maxProvisional}): progress without completion does not earn unbounded compute`;
    }
    return d;
  }
  return afterRejection(rec, record({ action: 'DISCARD', kind: 'NO_PROGRESS', reason: `no measurable progress: ${result.passed}/${result.attempted} pass (best so far ${best})`, countsAsAttempt: true }), result, candidateSha);
}

function afterRejection(rec, d, result, candidateSha) {
  rec.rejected.push({ sha256: candidateSha, kind: d.kind, reason: d.reason, passed: result.passed ?? null, brokeProtected: d.brokeProtected || [], at: Date.now() });
  if (d.countsAsAttempt) rec.attempts++;
  if (d.action === 'DISCARD') rec.freshPlans++;
  if (rec.attempts >= rec.policy.maxAttempts) {
    rec.state = 'STOPPED';
    d.stop = `attempts exhausted (${rec.attempts} of ${rec.policy.maxAttempts}): the remaining budget is not spent repeating`;
  }
  return d;
}

/** The model resubmitted a candidate that was already rejected. */
export function repeat(rec, candidateSha) {
  rec.repeats++;
  const d = { action: 'REPEAT', reason: `this exact candidate (sha ${candidateSha.slice(0, 12)}) was already rejected; restored without re-running the diagnostic`, sha256: candidateSha, at: Date.now() };
  if (rec.repeats >= rec.policy.maxRepeats) { rec.state = 'STOPPED'; d.stop = `the same rejected change was resubmitted ${rec.repeats} time(s); stopping rather than spending the budget on it`; }
  rec.decisions.push(d);
  return d;
}

/** Advance the verified checkpoint to an ACCEPTED candidate. */
export function accept(rec, result, targetBytes, targetSha = null) {
  rec.verified = { sha256: targetSha || sha(targetBytes), bytes: targetBytes, passing: [...passingSet(result)], passed: result.passed, attempted: result.attempted, failures: [] };
  rec.provisional = null;
}
export function provisional(rec, result, candidateSha) {
  rec.provisional = { sha256: candidateSha, passed: result.passed, attempted: result.attempted };
}

/**
 * The FAILURE PACKET after a rejection: compact and authoritative. What was rejected and why,
 * what still fails on the restored checkpoint (expected vs actual, bounded), and that an
 * identical resubmission will be refused. It carries the rejection; it never carries the
 * rejected code back into the file.
 */
export function packetMessage(rec, d, moduleName) {
  const v = rec.verified;
  const lines = [
    `RECOVERY CONTROLLER - your last change was ${d.action === 'REPEAT' ? 'REFUSED' : d.action === 'DISCARD' ? 'DISCARDED' : 'REJECTED'} and ${/\.[a-z0-9]+$|^the game/i.test(moduleName) ? moduleName : moduleName + '.py'} was RESTORED to the verified checkpoint (sha256 ${v.sha256.slice(0, 16)}).`,
    '',
    `WHY: ${d.reason}.`,
  ];
  if (rec.provisional) lines.push(`(A provisional candidate with ${rec.provisional.passed}/${rec.provisional.attempted} passing was also set aside; the checkpoint is the verified state.)`);
  const residual = v.failures.slice(0, MAX_RESIDUAL_SHOWN);
  lines.push('', `STILL FAILING on the restored file (${v.attempted - v.passed} of ${v.attempted} cases; ${v.passing.length} pass and MUST keep passing):`);
  for (const f of residual) lines.push(`  ${f.kind} case ${f.n}  ${f.text}`);
  if (v.failures.length > residual.length) lines.push(`  ... ${v.failures.length - residual.length} further failing case(s) not shown.`);
  lines.push('', `Rejected so far: ${rec.rejected.length} candidate(s). Propose a DIFFERENT change from the restored file; an identical one is refused without being run. Attempts remaining: ${Math.max(0, rec.policy.maxAttempts - rec.attempts)}.`);
  return lines.join('\n');
}
