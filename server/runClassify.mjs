// runClassify.mjs — one rule, enforced by precedence: a run where the MODEL DID NOT ACT can never be
// scored as a model outcome. QWEN-HUB-1's first pass violated this: two throttle-paused runs (0 and 1
// model calls, the hub itself saying "openrouter is throttling this key") were labelled
// RESTORED_OR_FAILED — a model-outcome label — because the untouched seed naturally reads
// requested=FAIL / protected=PASS. That is the same class as the acceptance EVALUATION_ERROR debt: an
// instrument that did not run producing a result-shaped output.
//
// THE PRECEDENCE IS THE POINT. Infrastructure states are decided BEFORE any check verdict is read, so a
// check verdict on a run the model never drove is never even consulted.
//
// It takes a plain record, not a live run, so it is pure and testable and re-derivable from saved data.

export const CLASS = Object.freeze({
  PROVIDER_ERROR: 'PROVIDER_ERROR',     // the model could not be driven (throttle, no reply, hub failure)
  NOT_EVALUATED: 'NOT_EVALUATED',       // the model acted, but the verifier instrument failed
  RETAINED: 'RETAINED',                 // model acted; requested PASS and protected PASS
  RESTORED_OR_FAILED: 'RESTORED_OR_FAILED', // model acted; protected PASS but requested not achieved
  BROKE_PROTECTED: 'BROKE_PROTECTED',   // model acted; protected FAIL — it damaged existing behaviour
});

const THROTTLE = /throttl|rate.?limit|429|daily free allowance|too many requests/i;

/**
 * @param rec {{
 *   modelActed?: boolean,      // did at least one model call produce an action/edit?
 *   modelCalls?: number,       // count of model calls that returned
 *   pausedReason?: string,     // any hub pause/interrupt text (throttle detection lives here)
 *   runStatus?: string,        // done | error | stopped | interrupted | awaiting_approval | ...
 *   requested?: string,        // PASS | FAIL | EVALUATION_ERROR | undefined
 *   protected?: string,        // PASS | FAIL | EVALUATION_ERROR | undefined
 *   VERDICT?: object,          // optional VERDICT enum; defaults to string literals
 * }}
 */
export function classifyRun(rec, { VERDICT = { PASS: 'PASS', FAIL: 'FAIL', EVALUATION_ERROR: 'EVALUATION_ERROR' } } = {}) {
  // 1. INFRASTRUCTURE FIRST — before any check verdict is looked at.
  if (rec.pausedReason && THROTTLE.test(rec.pausedReason)) return CLASS.PROVIDER_ERROR;
  const acted = rec.modelActed === true || (typeof rec.modelCalls === 'number' && rec.modelCalls > 0 && rec.modelActed !== false);
  if (!acted) return CLASS.PROVIDER_ERROR;                 // no model action reached the workspace
  // 2. INSTRUMENT — the model acted, but did the verifier run?
  if (rec.requested === VERDICT.EVALUATION_ERROR || rec.protected === VERDICT.EVALUATION_ERROR) return CLASS.NOT_EVALUATED;
  if (rec.requested === undefined || rec.protected === undefined) return CLASS.NOT_EVALUATED;
  // 3. ONLY NOW a model outcome, and protected damage outranks a requested miss.
  if (rec.protected === VERDICT.FAIL) return CLASS.BROKE_PROTECTED;
  if (rec.requested === VERDICT.PASS && rec.protected === VERDICT.PASS) return CLASS.RETAINED;
  return CLASS.RESTORED_OR_FAILED;
}
