#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// retainPath.mjs — THE path a candidate travels to be retained. One function, called by the live runner
// and by the integration test, so the test exercises the real thing rather than a copy of it.
//
// WHY THIS EXISTS AS A MODULE. `acceptanceDecision.mjs` had 30 passing assertions while the live runner
// never imported it: the runner retained on `rec.boundaries.accepted` straight from the functional gate.
// A rule that produces a verdict somewhere in the system is not a rule that controls what survives, and
// this project has the same failure recorded twice before - detection wired to nothing.
//
// So: `judgeAndDecide` is the only way a candidate gets an outcome, and `shouldRetain` is the only
// question asked about it. If the decision blocks, nothing downstream may treat the candidate as
// accepted.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Judge a candidate that is already written into `ws`, gather the visual and render evidence the task
 * calls for, and decide. Mutates `rec` with everything observed, and returns the decision.
 *
 * `runVisual: false` models the case where a required visual check was NOT RUN - which must block, not
 * silently pass.
 */
export async function judgeAndDecide({
  ws, task, spec, startRef, rec, T0, deps,
  runVisual = true, runRender = true, visualKeysFrom = null,
}) {
  const { judgeCandidate, playCheck, evaluate, applyAcceptance } = deps;
  await judgeCandidate(ws, task, spec, startRef, rec, T0, { playCheck, evaluate, applyAcceptance, join, readFileSync });

  const contract = task.visualContract || null;

  // ── the visual arm ──
  let visual = null;
  if (contract && runVisual) {
    try {
      const { visualCheck } = await import('./visualCheck.mjs');
      const layout = JSON.parse(readFileSync(contract.layout, 'utf8'));
      const trace = JSON.parse(readFileSync(contract.trace, 'utf8'));
      visual = await visualCheck(ws, { layout, trace, entry: spec.entry || 'index.html' });
    } catch (e) {
      // A visual check that could not run is NOT a pass. It is recorded as not run, and under a required
      // contract the decision blocks on exactly that.
      visual = { ok: false, evaluated: false, verdict: 'VISUAL_CHECK_ERRORED', reason: String(e.message || e).slice(0, 200) };
    }
  }

  // ── the render arm: advisory, gathered whenever we can ──
  let render = null;
  if (runRender) {
    try {
      const { renderEvidence } = await import('./renderEvidence.mjs');
      const keys = visualKeysFrom || (spec.steps || []).flatMap((s) => (s.do || []).map((d) => d.key)).filter(Boolean);
      render = await renderEvidence(ws, { keys, expr: spec.stateExpr || 'window.app.state()', entry: spec.entry || 'index.html' });
    } catch (e) { render = { ok: false, reason: String(e.message || e).slice(0, 200) }; }
  }

  const { decide } = await import('./acceptanceDecision.mjs');
  const decision = decide({
    functional: { accepted: !!rec.boundaries?.accepted, disposition: rec.acceptance?.disposition },
    visual, render, task,
  });

  rec.visual = visual ? { verdict: visual.verdict, evaluated: visual.evaluated !== false, reason: visual.reason || null, mismatched: (visual.mismatched || []).length } : null;
  rec.render = render && render.ok ? { verdict: render.verdict, coverage: render.coverage || null } : (render ? { verdict: 'UNAVAILABLE', reason: render.reason } : null);
  rec.decision = decision;
  rec.outcome = decision.accepted ? 'ACCEPTED'
    : (decision.functionallyAccepted ? 'BLOCKED_BY_VISUAL_CONTRACT' : 'REJECTED');
  return decision;
}

/**
 * THE ONLY question asked before a candidate is kept. Reading `rec.boundaries.accepted` here instead
 * would restore exactly the defect this module exists to remove.
 */
export function shouldRetain(decision) {
  return !!(decision && decision.accepted);
}

export default { judgeAndDecide, shouldRetain };
