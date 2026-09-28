// LEGADOMAIN — THE AUTHORITY LADDER, written before any domain knowledge exists.
//
// THE FIRST CLAIM, deliberately narrower than "understand what kind of software this is":
//
//     Given an EXPLICITLY DECLARED domain, LegaDomain can derive domain-relevant obligations and
//     verification requirements that are not derivable from syntax alone, while exposing no more domain
//     information to PROPOSE than the local operation requires.
//
// Domain INFERENCE is not attempted. Asking a layer to both identify "this is a game" and reason
// correctly about what game persistence means makes every failure uninterpretable - you cannot tell a
// misidentification from a mis-derivation. The domain is declared.
//
// THE TWO THINGS THIS LAYER HAS TO LEARN, and they are the counterparts of what LegaReward just learned
// (measurable does not mean preferable):
//
//     RELEVANT DOES NOT MEAN REVEALABLE.   Knowing something globally does not imply permission to
//                                          reveal it locally. The rendering families measured true,
//                                          relevant neighbouring semantics costing up to 95% of
//                                          correctness when exposed to PROPOSE.
//     COMMON DOES NOT MEAN OBLIGATORY.     "Games usually do X" must never quietly override "this
//                                          particular game intentionally does Y".
//
// Without the second, LegaDomain becomes exactly the plausible-sounding oracle this project has spent
// its whole life removing.
const NL = String.fromCharCode(10);

// Ordered, highest first. A lower level may never contradict a higher one; it may only add where the
// higher is silent.
export const AUTHORITY = {
  TASK_SPECIFICATION: 'TASK_SPECIFICATION',   // what was actually asked for
  REPOSITORY_FACT: 'REPOSITORY_FACT',         // concrete local truth, observed
  DOMAIN_INVARIANT: 'DOMAIN_INVARIANT',       // may add obligations when justified
  DOMAIN_POLICY: 'DOMAIN_POLICY',             // requires a NAMED OWNER or it is inert
  DOMAIN_DEFAULT: 'DOMAIN_DEFAULT',           // defeasible: loses to anything above it
  UNKNOWN: 'UNKNOWN',                         // adds nothing, and says so
};

const RANK = [AUTHORITY.TASK_SPECIFICATION, AUTHORITY.REPOSITORY_FACT, AUTHORITY.DOMAIN_INVARIANT,
  AUTHORITY.DOMAIN_POLICY, AUTHORITY.DOMAIN_DEFAULT, AUTHORITY.UNKNOWN];

export const rankOf = (a) => RANK.indexOf(a);
export const outranks = (a, b) => rankOf(a) < rankOf(b);

// A claim is anything that wants to become part of the contract. It must say WHERE it came from, because
// an obligation whose provenance is unrecorded cannot be overridden by evidence later.
export function claim({ subject, requirement, authority, source, owner = null, why = '' }) {
  return { subject, requirement, authority, source, owner, why };
}

// Resolve competing claims about the same subject.
//
//   a higher authority WINS outright
//   an equal authority that agrees is kept once
//   an equal authority that DISAGREES is a CONFLICT - reported, never silently merged
//   a DOMAIN_POLICY claim with no named owner is INERT and never enters the contract
//   UNKNOWN never contributes
export function resolve(claims) {
  const bySubject = new Map();
  const conflicts = [];
  const inert = [];

  for (const c of claims) {
    if (c.authority === AUTHORITY.UNKNOWN) { inert.push({ ...c, reason: 'UNKNOWN adds nothing' }); continue; }
    if (c.authority === AUTHORITY.DOMAIN_POLICY && !c.owner) {
      inert.push({ ...c, reason: 'DOMAIN_POLICY without a named owner is a preference, not an obligation' });
      continue;
    }
    const held = bySubject.get(c.subject);
    if (!held) { bySubject.set(c.subject, c); continue; }
    if (outranks(c.authority, held.authority)) {
      // The lower-ranked claim is DEFEATED, and that is recorded rather than dropped.
      bySubject.set(c.subject, { ...c, defeated: [...(held.defeated || []), held] });
      continue;
    }
    if (outranks(held.authority, c.authority)) {
      held.defeated = [...(held.defeated || []), c];
      continue;
    }
    if (held.requirement === c.requirement) continue;  // same authority, same answer
    conflicts.push({ subject: c.subject, a: held, b: c,
      why: 'two claims of equal authority disagree, and nothing here is entitled to pick' });
  }

  return { obligations: [...bySubject.values()], conflicts, inert };
}

export { NL };
