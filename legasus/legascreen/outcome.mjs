// LEGASCREEN — THE OUTCOME STATE MACHINE. Central, structural, and not a convention.
//
// Four slices of evidence say the same thing: a rule that lives in probe authors' memories gets
// broken by the next probe author, who is me. A refused input was read as a dependency; "could not
// measure" shared a representation with "was removed"; a perturbation that did not perturb produced a
// confident matrix. Each was repaired locally, and the next layer committed the same class again.
//
//     SO A VERDICT IS NOT SOMETHING A PROBE RETURNS. IT IS SOMETHING A JOURNEY EARNS.
//
// A probe records where it got to. The journey refuses illegal transitions as they are attempted, and
// refuses to issue INVARIANT_HELD or INVARIANT_VIOLATED unless the path actually contains the
// experiment those words claim:
//
//     DISCOVERED -> BASELINE_REPLAYED -> PERTURBATION_APPLIED -> OBSERVED
//
// HELD IS GATED AS HARD AS VIOLATED, and that is deliberate. "The invariant held" asserted over an
// experiment that never ran is the vacuous control this project has now caught four times; it is not
// a safer error than a false accusation, it is the SAME error with a comfortable sign.
//
// THE HONEST LIMIT: in JavaScript nobody can stop a probe from returning an object literal that says
// VIOLATED. What this module makes structural is that such an object is NOT A VERDICT - verdicts
// carry a brand no caller can apply - so a consumer that checks is never fooled, and a consumer that
// does not check was never protected by anything. That is the same bound the calculus itself has.

export const STATE = {
  DISCOVERED: 'DISCOVERED',                               // a candidate exists
  BASELINE_UNREPLAYABLE: 'BASELINE_UNREPLAYABLE',         // the legitimate path cannot reproduce itself
  BASELINE_REPLAYED: 'BASELINE_REPLAYED',                 // it can, and did
  PERTURBATION_NOT_APPLICABLE: 'PERTURBATION_NOT_APPLICABLE', // there was no such coordinate to touch
  PERTURBATION_NO_EFFECT: 'PERTURBATION_NO_EFFECT',       // touching it changed nothing: VACUOUS
  PERTURBATION_APPLIED: 'PERTURBATION_APPLIED',           // proven to have changed the intended thing
  RECONSTRUCTION_FAILED: 'RECONSTRUCTION_FAILED',         // production refused to build the new world
  AUTHORITY_REFUSED: 'AUTHORITY_REFUSED',                 // the subject refused a legitimate input
  TARGET_NOT_REACHED: 'TARGET_NOT_REACHED',               // the transformation never ran
  OUTPUT_UNOBSERVABLE: 'OUTPUT_UNOBSERVABLE',             // it ran and produced nothing to read
  OBSERVED: 'OBSERVED',                                   // an output was read under the intervention
};

export const VERDICT = {
  INVARIANT_HELD: 'INVARIANT_HELD',
  INVARIANT_VIOLATED: 'INVARIANT_VIOLATED',
  INVARIANT_UNKNOWN: 'INVARIANT_UNKNOWN',
};

// The path a judgment requires. Every stage, in order, or the answer is UNKNOWN.
export const REQUIRED = [STATE.DISCOVERED, STATE.BASELINE_REPLAYED, STATE.PERTURBATION_APPLIED,
  STATE.OBSERVED];

const TERMINAL = new Set([STATE.BASELINE_UNREPLAYABLE, STATE.PERTURBATION_NOT_APPLICABLE,
  STATE.PERTURBATION_NO_EFFECT, STATE.RECONSTRUCTION_FAILED, STATE.AUTHORITY_REFUSED,
  STATE.TARGET_NOT_REACHED, STATE.OUTPUT_UNOBSERVABLE]);

// What each state needs BEHIND it. This is why a probe cannot mark OBSERVED after a refusal, or claim
// a perturbation was applied without a baseline to apply it against.
const NEEDS = {
  [STATE.BASELINE_REPLAYED]: [STATE.DISCOVERED],
  [STATE.BASELINE_UNREPLAYABLE]: [STATE.DISCOVERED],
  [STATE.PERTURBATION_APPLIED]: [STATE.BASELINE_REPLAYED],
  [STATE.PERTURBATION_NO_EFFECT]: [STATE.BASELINE_REPLAYED],
  [STATE.PERTURBATION_NOT_APPLICABLE]: [STATE.BASELINE_REPLAYED],
  [STATE.RECONSTRUCTION_FAILED]: [STATE.PERTURBATION_APPLIED],
  [STATE.AUTHORITY_REFUSED]: [STATE.PERTURBATION_APPLIED],
  [STATE.TARGET_NOT_REACHED]: [STATE.PERTURBATION_APPLIED],
  [STATE.OUTPUT_UNOBSERVABLE]: [STATE.PERTURBATION_APPLIED],
  [STATE.OBSERVED]: [STATE.PERTURBATION_APPLIED],
};

const VERDICTS = new WeakSet();
export const isVerdict = (v) => !!(v && typeof v === 'object' && VERDICTS.has(v));

const seal = (v) => { const f = Object.freeze(v); VERDICTS.add(f); return f; };

export function journey(subject) {
  const path = [];
  const has = (s) => path.some((p) => p.state === s);
  let closed = false;

  const missing = () => REQUIRED.filter((s) => !has(s));

  const judge = (wanted, why, extra) => {
    const gap = missing();
    if (gap.length) {
      return seal({ subject, verdict: VERDICT.INVARIANT_UNKNOWN, path: path.map((p) => p.state),
        wanted, missing: gap,
        why: 'refused to answer ' + wanted + ': the journey never reached ' + gap.join(', ')
          + '. An invariant is HELD or VIOLATED only over an experiment that actually ran, and this'
          + ' one stopped at ' + (path.length ? path[path.length - 1].state : 'nothing') + '.' });
    }
    return seal({ subject, verdict: wanted, path: path.map((p) => p.state), why, ...extra });
  };

  return {
    mark(state, why) {
      if (!Object.hasOwn(STATE, state)) throw new Error('not an outcome state: ' + state);
      if (closed) {
        throw new Error('journey for ' + subject + ' already ended at '
          + path[path.length - 1].state + '; ' + state + ' cannot follow a terminal outcome');
      }
      for (const need of NEEDS[state] || []) {
        if (!has(need)) {
          throw new Error(state + ' requires ' + need + ' first, and this journey has only '
            + (path.map((p) => p.state).join(' -> ') || 'nothing')
            + '. The stage cannot be skipped by asserting the one after it.');
        }
      }
      if (has(state)) throw new Error(state + ' was already recorded for ' + subject);
      path.push({ state, why });
      if (TERMINAL.has(state)) closed = true;
      return this;
    },
    state: () => (path.length ? path[path.length - 1].state : null),
    path: () => path.map((p) => p.state),
    reached: (s) => has(s),
    missing,
    held: (why) => judge(VERDICT.INVARIANT_HELD, why),
    violated: (why, extra = {}) => judge(VERDICT.INVARIANT_VIOLATED, why, extra),
    unknown: (why) => seal({ subject, verdict: VERDICT.INVARIANT_UNKNOWN,
      path: path.map((p) => p.state), missing: missing(), why }),
  };
}

// A finding may only be built from a sealed verdict. An object literal that says VIOLATED is not one.
export function finding(v) {
  if (!isVerdict(v)) {
    throw new Error('not a verdict: findings are built from journeys, not from objects that claim an'
      + ' outcome. This is the only place the brand is checked, and it is checked here on purpose.');
  }
  return v.verdict === VERDICT.INVARIANT_VIOLATED ? v : null;
}
