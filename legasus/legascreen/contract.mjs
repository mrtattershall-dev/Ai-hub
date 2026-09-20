// LEGASCREEN — THE CONTRACT AS AN EVIDENCE OBJECT.
//
//     declared: 'ALL_OF'
//
// is human testimony with no identity, no provenance, and no validity. It is fine for development
// and useless for autonomous screening, because an implementation and its criterion can be edited
// together into a green result:
//
//     implementation ANY_OF / contract ALL_OF  ->  both changed  ->  ANY_OF / ANY_OF  ->  GREEN
//
// So a contract carries what it rests on, and WHAT IT WAS VALID AGAINST. `validAgainst` is a digest
// of the subject's bytes. If the subject has moved, the contract is STALE and can neither convict
// nor absolve - editing the implementation invalidates the criterion BY CONSTRUCTION rather than by
// anybody remembering to.
//
// AND UNMAPPABLE IS FIRST-CLASS. If an observation cannot be expressed in the specification's
// vocabulary, the answer is not "probably UNKNOWN" and not "closest thing is X". Those are quiet
// coercions, and a coerced answer is the screen inventing a requirement. UNMAPPABLE is a capability
// gap IN THE SPECIFICATION, not evidence against the subject.
//
//     CHARACTERIZED   we measured it; no established contract says what it should be
//     UNMAPPABLE      we measured it; the specification has no vocabulary for what we saw
//
// Those are different facts and they are kept apart.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { journey, STATE, VERDICT } from './outcome.mjs';

export const STATUS = { ESTABLISHED: 'ESTABLISHED', UNKNOWN: 'UNKNOWN', STALE: 'STALE' };

export const RESOLUTION = {
  SCREENED: 'SCREENED',               // an established, current contract was compared to an observation
  CHARACTERIZED: 'CHARACTERIZED',     // observed, but nothing authoritative to compare it to
  UNMAPPABLE: 'UNMAPPABLE',           // observed something the specification cannot express
};

export const digestOf = (file) => createHash('sha256')
  .update(readFileSync(file)).digest('hex').slice(0, 16);

// A contract is refused at construction if it does not carry what it rests on. A criterion with no
// stated authority is exactly the thing that lets criterion and implementation move together.
export function contract({ subject, coordinate, proposition, authority }) {
  for (const k of ['source', 'provenance', 'validAgainst']) {
    if (!authority || !authority[k]) {
      throw new Error('a contract without authority.' + k + ' is testimony, not evidence: it could'
        + ' have been edited alongside the implementation it judges');
    }
  }
  return Object.freeze({ subject, coordinate, proposition, authority: Object.freeze({ ...authority }) });
}

// The specification's vocabulary. An observation outside it is UNMAPPABLE, never coerced into it.
export function resolve({ observed, contract: c, digest, vocabulary, evidence = {} }) {
  const j = journey((c ? c.subject : 'unknown') + ' ' + (c ? c.coordinate : ''));
  j.mark(STATE.DISCOVERED, 'a transformation discovered by the surface scan');
  if (evidence.replayed) j.mark(STATE.BASELINE_REPLAYED, 'the recorded construction reproduced itself');
  if (evidence.replayed && evidence.applied) j.mark(STATE.PERTURBATION_APPLIED, 'at least one cell perturbed');
  if (evidence.replayed && evidence.applied && evidence.observed) {
    j.mark(STATE.OBSERVED, 'at least one cell read');
  }

  const base = { observed, subject: c && c.subject, coordinate: c && c.coordinate };

  if (!c) {
    return { ...base, resolution: RESOLUTION.CHARACTERIZED, status: STATUS.UNKNOWN,
      why: 'no contract governs this coordinate, so its behaviour is recorded and nothing is'
        + ' concluded. The screen does not invent requirements.' };
  }
  if (digest !== undefined && digest !== c.authority.validAgainst) {
    return { ...base, resolution: RESOLUTION.CHARACTERIZED, status: STATUS.STALE,
      why: 'the contract was established against ' + c.authority.validAgainst + ' and the subject is'
        + ' now ' + digest + '. A contract cannot judge a subject it has not been re-established'
        + ' against - that is what stops an implementation and its criterion moving together.' };
  }
  if (vocabulary && !vocabulary.includes(observed)) {
    return { ...base, resolution: RESOLUTION.UNMAPPABLE, status: c.authority && STATUS.ESTABLISHED,
      why: 'the observation "' + observed + '" has no counterpart in the specification vocabulary ('
        + vocabulary.join(', ') + '). That is a capability gap IN THE SPECIFICATION and is NOT'
        + ' evidence against the subject. It is not coerced to UNKNOWN and not coerced to the'
        + ' nearest available word.' };
  }
  if (observed === 'UNKNOWN') {
    return { ...base, resolution: RESOLUTION.CHARACTERIZED, status: STATUS.ESTABLISHED,
      why: 'the relation could not be established by measurement, so the contract is not consulted' };
  }

  const agrees = observed === c.proposition;
  const v = agrees ? j.held('observed ' + observed + ', which the contract requires')
    : j.violated('the contract requires ' + c.proposition + ' and the subject is OBSERVED to be '
      + observed, { declared: c.proposition, observed });
  return { ...base, resolution: RESOLUTION.SCREENED, status: STATUS.ESTABLISHED,
    verdict: v.verdict, authority: c.authority, journey: j,
    why: v.verdict === VERDICT.INVARIANT_UNKNOWN
      ? 'the contract is current and established, but the experiment never ran: ' + v.why : v.why };
}
