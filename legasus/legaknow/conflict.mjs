// GENUINE DISAGREEMENT — the verdict this architecture is most at risk of never reaching.
//
// Every investigation in this project has ended by decomposing an apparent disagreement into a provenance
// defect, a scope mismatch, a referent move or a stale evidence set. Zero unexplained residual is good
// development evidence and it creates a specific danger:
//
//     THE ARCHITECTURE COULD BECOME VERY GOOD AT EXPLAINING AWAY DISAGREEMENT.
//
// A system that can always find an explanation is not careful, it is unfalsifiable. So there must be a
// terminal verdict that says:
//
//     No. We really are talking about the same thing, under compatible scope, both observations are
//     attributable and entitled, and these conclusions actually conflict.
//
// and then STOPS. No reconciliation. No collapse to UNKNOWN. No "closest explanation". No picking the
// more recent, the better-evidenced or the more convenient. BOTH EVIDENCE CHAINS ARE PRESERVED.
//
// GENUINE_DISAGREEMENT IS NOT UNKNOWN. Unknown means the world has not told us. Genuine disagreement
// means it told us two incompatible things, which is a strictly stronger and more useful state - it
// licenses an experiment, and it forbids acting as though the matter were settled.
//
// THE ORDER OF CHECKS IS DELIBERATELY ADVERSARIAL TO ITSELF: every reconciling explanation is tried
// first, and if none APPLIES - not "none is convenient" - the verdict is disagreement. An explanation is
// only permitted to fire when its own precondition is independently established.
import { referentDelta, transfer, POLARITY } from './referent.mjs';

export const VERDICT = {
  NOT_COMPARABLE: 'NOT_COMPARABLE',                 // different subjects; there is no shared question
  SCOPE_INCOMPATIBLE: 'SCOPE_INCOMPATIBLE',         // same question, different worlds, no bridge
  ONE_UNESTABLISHED: 'ONE_UNESTABLISHED',           // one side never earned the right to speak
  COMPOSITION_UNJUSTIFIED: 'COMPOSITION_UNJUSTIFIED', // premises fine, the join is not
  AGREEMENT: 'AGREEMENT',
  GENUINE_DISAGREEMENT: 'GENUINE_DISAGREEMENT',
};

// A side of a dispute. `entitled` is supplied by the caller's own justification walk - this module never
// re-derives entitlement, it only adjudicates between two parties that already have it or do not.
export function party({ name, proposition, referent, polarity = POLARITY.POSITIVE, entitled,
  evidence = [], joinJustified = true }) {
  return { name, proposition, referent, polarity, entitled: !!entitled, evidence,
    joinJustified: joinJustified !== false };
}

export function adjudicate({ a, b, bridges = {} }) {
  const keep = { evidence: { [a.name]: a.evidence, [b.name]: b.evidence } };

  // 1. Is there even a shared question? Different subjects are not a disagreement about anything.
  if (a.referent.subject !== b.referent.subject) {
    return { verdict: VERDICT.NOT_COMPARABLE, ...keep,
      why: 'the two claims are about different subjects, so there is nothing for them to disagree about' };
  }

  // 2. Same question, different worlds. This is the explanation that dissolved most of the doctest
  //    residual, and it may ONLY fire when the referents genuinely differ.
  const moved = referentDelta(a.referent, b.referent).filter((d) => d !== 'subject');
  if (moved.length) {
    const t = transfer({ from: a.referent, to: b.referent, polarity: a.polarity, bridges });
    if (!t.ok) {
      return { verdict: VERDICT.SCOPE_INCOMPATIBLE, moved, blocked: t.blocked, ...keep,
        why: 'the claims differ in ' + moved.join(', ') + ' and no bridge carries one to the other.'
          + ' They were never evaluating the same thing, so this is not a disagreement.' };
    }
  }

  // 3. Did both sides earn the right to speak?
  if (!a.entitled || !b.entitled) {
    return { verdict: VERDICT.ONE_UNESTABLISHED,
      unestablished: [a, b].filter((p) => !p.entitled).map((p) => p.name), ...keep,
      why: 'a party whose own evidence does not entitle it cannot be in genuine conflict with one that' };
  }

  // 4. Are both conclusions actually derivable, or does one rest on a join nothing justifies?
  if (!a.joinJustified || !b.joinJustified) {
    return { verdict: VERDICT.COMPOSITION_UNJUSTIFIED,
      unjustified: [a, b].filter((p) => !p.joinJustified).map((p) => p.name), ...keep,
      why: 'the individual facts are admissible and the CONCLUSION depends on a composition that is not'
        + ' justified. The premises are not in dispute; the derivation is.' };
  }

  if (a.polarity === b.polarity) {
    return { verdict: VERDICT.AGREEMENT, ...keep, why: 'same subject, compatible scope, same conclusion' };
  }

  // 5. NOTHING EXPLAINS THIS. Stop.
  return {
    verdict: VERDICT.GENUINE_DISAGREEMENT,
    subject: a.referent.subject,
    positions: [{ party: a.name, polarity: a.polarity, proposition: a.proposition },
      { party: b.name, polarity: b.polarity, proposition: b.proposition }],
    ...keep,
    resolved: false,
    why: 'same subject, compatible scope, both parties entitled, both compositions justified, and the'
      + ' conclusions conflict. NO RECONCILIATION IS OFFERED. Both evidence chains are preserved. This'
      + ' state licenses an experiment and forbids acting as though the matter were settled.',
  };
}

// A genuine disagreement is not a gap in knowledge - it is a surplus of it, and the work it owes is
// different from the work an UNKNOWN owes.
export const owesExperiment = (r) => r.verdict === VERDICT.GENUINE_DISAGREEMENT;

// Nothing in this module may pick a winner. Exposed so a test can assert the absence.
export const RESOLUTION_STRATEGIES_DELIBERATELY_ABSENT = Object.freeze([
  'most recent wins', 'strongest evidence wins', 'majority wins', 'closest explanation',
  'prefer the local system', 'prefer the external system',
]);
