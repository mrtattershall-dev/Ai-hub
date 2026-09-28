#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════════════════════════
// acceptanceDecision.mjs — combine the functional verdict with the visual evidence, under rules that
// distinguish A REQUIREMENT FAILURE from A CHECKER LIMITATION.
//
// The distinction is the whole point. "This page does not conform to the 400-pixel scoreboard layout"
// means two completely different things depending on what the task asked for:
//
//   the task REQUIRES that layout      -> non-conformance is a REQUIREMENT FAILURE. The task said the
//                                         display must look like this; it does not.
//   the task says nothing about it     -> non-conformance is a CHECKER LIMITATION. The page may be
//                                         perfect; this checker simply cannot judge it, and the honest
//                                         report is VISUAL CORRECTNESS NOT EVALUATED.
//
// Making the visual check advisory everywhere would let a KNOWN WRONG DISPLAY pass on exactly the tasks
// where it can be verified. Making it blocking everywhere would reject almost every real page for a fact
// about the checker rather than about the page.
//
//   situation                                      treatment
//   task declares a supported visual contract      conformance AND correct displayed totals are REQUIRED
//   page outside the checker's supported layouts   visual correctness NOT EVALUATED; does not block
//   generic state-to-pixel consistency             findings and coverage RECORDED; never rejects
//
// `renderEvidence` is advisory everywhere and has no rejection rule at all: both of its rules have known
// exceptions in both directions, so a contradiction it reports is a finding to read, not a verdict.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * @param functional  { accepted, disposition, requestedVerdict, protectedVerdict }  from the frozen gate
 * @param visual      the visualCheck result, or null if it was not run
 * @param render      the renderEvidence result, or null if it was not run
 * @param task        the task; `task.visualContract` declares whether a visual contract is REQUIRED
 */
export function decide({ functional, visual = null, render = null, task = {} }) {
  const contract = task.visualContract || null;
  const required = !!(contract && contract.required);
  const reasons = [];
  const advisories = [];

  // ── the functional gate, unchanged and always decisive in the negative ──
  const functionallyAccepted = !!(functional && functional.accepted);
  if (!functionallyAccepted) reasons.push('the functional checks did not pass');

  // ── the visual arm ──
  let visualStatus;
  if (!visual) {
    visualStatus = required ? 'REQUIRED_BUT_NOT_RUN' : 'NOT_RUN';
    if (required) reasons.push('a visual contract is required and the visual check was not run');
  } else if (visual.evaluated === false) {
    if (required) {
      // The task asked for this layout. Not conforming to it IS the failure.
      visualStatus = 'REQUIREMENT_FAILURE_NONCONFORMING';
      reasons.push(`the task requires the ${contract.name || 'declared'} layout and the page does not conform: ${visual.reason || 'non-conforming'}`);
    } else {
      visualStatus = 'NOT_EVALUATED';
      advisories.push(`visual correctness NOT EVALUATED: ${visual.reason || 'the page is outside this checker\'s supported layouts'}`);
    }
  } else if (visual.verdict === 'DISPLAY_MATCHES_EXPECTED') {
    visualStatus = 'MATCHES';
  } else {
    visualStatus = required ? 'REQUIREMENT_FAILURE_WRONG_DISPLAY' : 'MISMATCH_ADVISORY';
    const detail = `the displayed values do not match the expected values at ${(visual.mismatched || []).length} step(s)`;
    if (required) reasons.push(detail);
    else advisories.push(`${detail} - recorded, and NOT blocking because this task declares no visual contract`);
  }

  // ── the render arm: advisory, always ──
  let renderStatus = 'NOT_RUN';
  if (render && render.ok) {
    renderStatus = render.verdict;
    if (render.verdict === 'RENDER_CONTRADICTS_STATE') {
      advisories.push('renderEvidence reports a state/picture contradiction - ADVISORY ONLY: both of its rules have legitimate exceptions, so this is a finding to read rather than a verdict');
    } else if (render.verdict === 'RENDER_EVIDENCE_VACUOUS') {
      advisories.push('renderEvidence was VACUOUS: neither of its rules was exercised, so it supports nothing either way');
    }
  }

  const visualBlocks = required && (visualStatus.startsWith('REQUIREMENT_FAILURE') || visualStatus === 'REQUIRED_BUT_NOT_RUN');
  const accepted = functionallyAccepted && !visualBlocks;

  return {
    accepted,
    functionallyAccepted,
    visualStatus,
    visualBlocking: required,
    visualEvaluated: !!(visual && visual.evaluated !== false),
    renderStatus,
    renderCoverage: render && render.coverage ? render.coverage : null,
    reasons,
    advisories,
    // Reported separately, always, so one can never be read off the other.
    summary: {
      functional: functionallyAccepted ? 'PASS' : 'FAIL',
      visual: visualStatus,
      render: renderStatus + ' (advisory)',
    },
  };
}

export default decide;
