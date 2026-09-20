// LAW 7 — THE STOPPING LAW.
//
//     UNCERTAINTY DOES NOT ITSELF AUTHORIZE RESOLUTION ATTEMPTS.
//     The existence of an unresolved distinction does not imply entitlement to act on it.
//
// Almost every mechanism in this architecture is biased toward resolution: UNKNOWN -> investigate, STALE
// -> revalidate, UNOBSERVABLE -> establish a witness, PREREQUISITE_MISSING -> establish it. That bias has
// been productive and it smuggles in a proposition nobody justified:
//
//     there exists more work that should eventually resolve this.
//
// Left unchecked, PURPOSE sees CONTESTED and emits RESOLVE_CONTEST forever. A month-long run spends
// forty thousand iterations learning nothing relevant, and the loop never reports a problem because every
// individual step is justified. This is the same authority-from-absence bug one level up: "I do not know"
// silently becomes "therefore I may keep spending resources until I do".
//
//     SAFE AUTONOMY IS NOT ONLY "DO NOT DO UNJUSTIFIED THINGS". IT IS ALSO "KNOW WHEN THERE IS NO
//     JUSTIFIED THING TO DO."
//
// So an investigation needs its own justification, exactly as an action does. A retry, an experiment and
// a model call each need one.
//
// AND "IRREDUCIBLE" IS NOT CLAIMABLE. Nothing here can prove that no evidence anywhere could settle a
// question. The claim is scoped to what the system can currently justify:
//
//     no admissible resolution is currently justified within the declared evidence and authority frontier
//
// which is a statement about the SYSTEM'S ENTITLEMENT, not about the proposition.
//
// THE COMPLETENESS BOUNDARY, named by the owner 2026-09-20 and previously only implied by the words
// "declared" and "frontier". Four statements look alike in ordinary software and are not equivalent
// here, and this law reaches exactly one of them:
//
//     no defect observed                        an outcome of running instruments
//     no known attack remains                   a statement about the attacks someone thought of
//     NO JUSTIFIED OBJECTIVE EXISTS             <- what QUIESCENT sounds like
//     the system is ready                       an owner's decision, never this law's
//
// What contestState() computes is narrower than the third:
//
//     ESTABLISHES       no investigation FORMULATED in this frontier is currently justified
//     DOES NOT ESTABLISH that no justified investigation exists - the frontier's COMPLETENESS over the
//                       space of questions that could be asked is not established here, and nothing in
//                       this module could establish it
//
// The evidence that the gap is real rather than pedantic is this project's own: on 2026-09-20 the
// frontier was QUIESCENT with zero objectives, and three successive preregistered attack waves each
// found new authority defects in deciding paths - twenty-one in total - after the previous wave had
// gone green. The verdict was correct every time over the questions it held. It was silent about the
// ones nobody had written down.
//
// SO THE QUALIFICATION TRAVELS WITH THE VERDICT rather than living in this comment, because a bounded
// claim quoted without its bound is an unbounded claim. Every contestState() result carries
// `establishes` and `doesNotEstablish`. This adds no objective: "is the frontier complete?" is not an
// investigation with an outcome, and a law that emitted one here would be the loop it forbids.

export const FRONTIER = { OPEN: 'OPEN', CLOSED: 'CLOSED' };

export const CONTEST = {
  OPEN_CONTEST: 'OPEN_CONTEST',             // conflict stands, but expected evidence is still missing
  QUIESCENT_CONTEST: 'QUIESCENT_CONTEST',   // conflict stands and no justified operation would move it
};

// EVIDENCE COMPLETENESS, which validity alone does not give you. "A says P, B says not-P" may really be
// "A vs B with a decisive C that never ran".
// THE FRONTIER'S OWN BOUND, and it is where the completeness gap ORIGINATES (consumption attack
// SC-4). CLOSED is computed from `requiredProducers`, an INPUT - in quiesce-check.mjs, three
// hand-written strings. So CLOSED has never meant "the evidence that could discriminate has been
// gathered"; it means "the producers someone listed were run", and the contest layer inherits that
// before it adds a gap of its own. Entry 16 said the frontier is a set of questions someone wrote
// down. The evidence requirement is a set someone wrote down too.
export const FRONTIER_SCOPE = {
  establishes: 'every producer DECLARED required was attempted, and nothing justified is pending',
  doesNotEstablish: 'that the declared requirement list covers the evidence that could discriminate.'
    + ' requiredProducers is an input to this function, not a finding of it.',
};

export function evidenceFrontier({ requiredProducers = [], attempted = [], pending = [] }) {
  const missing = requiredProducers.filter((p) => !attempted.includes(p));
  const state = (missing.length || pending.length) ? FRONTIER.OPEN : FRONTIER.CLOSED;
  return {
    state,
    missing,
    pending: [...pending],
    ...FRONTIER_SCOPE,
    why: state === FRONTIER.OPEN
      ? 'the evidence frontier is OPEN: '
        + (missing.length ? 'required producers never attempted (' + missing.join(', ') + ')' : '')
        + (missing.length && pending.length ? '; ' : '')
        + (pending.length ? 'operations already authorized and expected to discriminate are pending ('
          + pending.join(', ') + ')' : '')
      : 'every producer DECLARED required was attempted and nothing authorized is pending',
  };
}

// FOUR CONDITIONS, ALL REQUIRED. The fourth is the one usually skipped, and it is the one that stops a
// system re-running something that cannot change its mind.
export function investigationJustified({ name, authorized, executable, targetsDistinction,
  canChangeEntitlement }) {
  const failed = [];
  if (!authorized) failed.push('not authorized');
  if (!executable) failed.push('not executable');
  if (!targetsDistinction) failed.push('does not target the unresolved distinction');
  if (!canChangeEntitlement) failed.push('no outcome of it would change entitlement');
  return {
    ok: failed.length === 0, name, failed,
    why: failed.length
      ? name + ' is not justified: ' + failed.join('; ')
        + (failed.includes('no outcome of it would change entitlement')
          ? '. Running it is epistemically pointless however cheap it is.' : '')
      : name + ' is justified: authorized, executable, targets the distinction, and some outcome of it'
        + ' would change what may be claimed',
  };
}

// The state of a standing conflict. QUIESCENT is a POSITIVE finding about the system's entitlement, not a
// failure to try hard enough.
// The bound every verdict carries. Stated once, attached to all of them, so no reader can quote the
// state without it.
export const SCOPE = {
  establishes: 'no investigation FORMULATED in this frontier is currently justified',
  doesNotEstablish: 'that no justified investigation EXISTS. The frontier is a set of questions'
    + ' someone wrote down; its completeness over the space of questions that could be asked is not'
    + ' established here, and nothing in this module could establish it.',
};

export function contestState({ frontier, investigations = [] }) {
  const justified = investigations.map(investigationJustified).filter((i) => i.ok);
  // A PENDING OPERATION HOLDS THE FRONTIER OPEN ONLY WHILE IT IS ITSELF A JUSTIFIED INVESTIGATION.
  // The first version took `pending` on trust: any string in it made the frontier OPEN, and an OPEN
  // frontier with zero justified investigations is a stall that reports "do not quiesce" forever
  // (composition attack C9-a). Adding an irrelevant name to a list created non-work that could not be
  // discharged. A name is not an obligation; a pending item that is not a justified investigation is
  // DISCHARGED, and the discharge is recorded on the frontier rather than silently dropped. A missing
  // required producer still holds the frontier open on its own - that is a real gap, not a name.
  const justifiedNames = new Set(justified.map((i) => i.name));
  const pending = frontier.pending || [];
  const discharged = pending.filter((p) => !justifiedNames.has(p));
  const stillPending = pending.filter((p) => justifiedNames.has(p));
  const missing = frontier.missing || [];
  const open = missing.length > 0 || stillPending.length > 0;
  const view = { ...frontier, pending: stillPending, discharged,
    state: open ? FRONTIER.OPEN : FRONTIER.CLOSED,
    why: (open ? frontier.why : 'every required producer was attempted and nothing justified is pending')
      + (discharged.length ? ' (discharged from pending as not a justified investigation: '
        + discharged.join(', ') + ')' : '') };
  if (open) {
    return { state: CONTEST.OPEN_CONTEST, justified, frontier: view, ...SCOPE,
      why: 'the conflict stands and the evidence frontier is not closed: ' + view.why };
  }
  if (justified.length) {
    return { state: CONTEST.OPEN_CONTEST, justified, frontier: view, ...SCOPE,
      why: 'the frontier is closed but ' + justified.length + ' justified investigation(s) remain: '
        + justified.map((i) => i.name).join(', ') };
  }
  return { state: CONTEST.QUIESCENT_CONTEST, justified: [], frontier: view, ...SCOPE,
    why: 'no investigation formulated in this frontier is currently justified, so the system is'
      + ' ENTITLED TO STOP INVESTIGATING. This says nothing about whether the proposition is'
      + ' decidable, and nothing about whether a justified investigation exists that nobody has'
      + ' formulated - see doesNotEstablish.' };
}

// WHICH LEVEL HAS BEEN EARNED. Four claims that look alike and are not, named by the owner
// 2026-09-20, and reporting the weakest while sounding like the strongest is the Entry 16 error at
// higher resolution:
//
//     1 NO_CURRENT_OBJECTIVE     no represented investigation is presently justified
//     2 FRONTIER_EXHAUSTED       every represented investigation is resolved or blocked
//     3 NAMED_COVERAGE_EXHAUSTED a predeclared challenge found no defect over failure classes whose
//                                coverage was INDEPENDENTLY established
//     4 COMPLETE                 no important failure exists anywhere
//
// Levels 1-3 are potentially establishable. LEVEL 4 IS NOT A PROPOSITION THIS SYSTEM CAN HOLD, so it
// is refused rather than computed - returning `false` would imply the question had been evaluated.
//
// LEVEL 2 IS NOT LEVEL 1. An UNKNOWN-classed question - one for which neither an unblocking condition
// nor terminality is established - is NEITHER resolved NOR blocked, so a frontier can have no
// justified investigation while still holding a question it cannot classify. That is the honest
// difference between "nothing to do now" and "nothing left open".
//
// LEVEL 3 NEEDS AN OUTSIDE WITNESS and cannot be self-asserted: `coverage` must come from something
// that established it - instruments.mjs subsumption, for instance - and its absence is UNKNOWN, never
// a quiet yes.
export const ATTAINMENT = {
  NO_CURRENT_OBJECTIVE: 'NO_CURRENT_OBJECTIVE',
  FRONTIER_EXHAUSTED: 'FRONTIER_EXHAUSTED',
  NAMED_COVERAGE_EXHAUSTED: 'NAMED_COVERAGE_EXHAUSTED',
  COMPLETE: 'COMPLETE',
};

// `entries` are the represented investigations, each carrying the block class the frontier assigned.
// `coverageEstablished` is a claim someone else must have earned; UNKNOWN by default.
export function attainment({ contest, entries = [], coverageEstablished = null }) {
  const unclassified = entries.filter((e) => !e.blockClass
    || /^UNKNOWN/.test(String(e.blockClass)));
  const level1 = contest.state === CONTEST.QUIESCENT_CONTEST;
  const level2 = level1 && entries.length > 0 && unclassified.length === 0;
  const level3 = level2 && coverageEstablished === true;
  return {
    earned: level3 ? ATTAINMENT.NAMED_COVERAGE_EXHAUSTED
      : level2 ? ATTAINMENT.FRONTIER_EXHAUSTED
        : level1 ? ATTAINMENT.NO_CURRENT_OBJECTIVE : null,
    levels: {
      [ATTAINMENT.NO_CURRENT_OBJECTIVE]: level1,
      [ATTAINMENT.FRONTIER_EXHAUSTED]: level2,
      [ATTAINMENT.NAMED_COVERAGE_EXHAUSTED]: level3,
      [ATTAINMENT.COMPLETE]: 'NOT_REPRESENTABLE',
    },
    unclassified: unclassified.map((e) => e.name),
    why: (level1 ? '' : 'a justified investigation remains, so not even level 1. ')
      + (level1 && !level2
        ? unclassified.length + ' represented question(s) are UNKNOWN-classed - neither resolved nor'
          + ' blocked (' + unclassified.map((e) => e.name).join(', ') + ') - so the frontier is not'
          + ' exhausted even though nothing in it is currently justified. ' : '')
      + (level2 && !level3
        ? 'coverage over named failure classes is ' + (coverageEstablished === null ? 'UNKNOWN'
          : 'not established') + ', so no predeclared challenge can be said to have exhausted it. ' : '')
      + 'COMPLETE is NOT_REPRESENTABLE: no finite procedure here establishes that no important failure'
      + ' class was left unimagined, and returning false would imply the question was evaluated.',
  };
}

// THE RULE PURPOSE MUST OBEY, or the architecture cannot ever be idle.
//
// AND THE BOUND TRAVELS INTO IT. Entry 16 attached `establishes` / `doesNotEstablish` to the verdict
// and stopped there; this function - the artifact PURPOSE consumes - dropped both, so "zero
// objectives" arrived downstream denying nothing. informationMonotonicity, this project's own Law 1
// instrument, reported it as a FORBIDDEN TRANSITION: erasure GAINED the permission to conclude that
// no justified investigation exists (consumption attack SC-2). An objective list is a PROJECTION of a
// verdict, so it inherits that verdict's bound verbatim rather than being given one of its own.
export function objectivesFromContest(contest) {
  const bound = { establishes: contest.establishes, doesNotEstablish: contest.doesNotEstablish };
  if (contest.state === CONTEST.QUIESCENT_CONTEST) {
    return { objectives: [], ...bound,
      why: 'a QUIESCENT contest generates NO objective. An epistemic deficit generates work only when'
        + ' there is an authorized operation with a justified expectation of increasing relevant'
        + ' information. Emitting RESOLVE_CONTEST here is how a loop runs forever.' };
  }
  return { objectives: contest.justified.map((i) => ({ kind: 'REDUCE_UNCERTAINTY', target: i.name })),
    ...bound,
    why: 'each objective corresponds to an investigation that passed all four conditions' };
}

// THE LEGITIMATE IDLE STATE. Most agent architectures assume `while (true) choose_action()`, which forces
// an answer out of an authority graph that may not have one.
//
// ITS BOUND IS ABOUT THE CANDIDATES, not the frontier, so it is stated separately rather than reusing
// SCOPE. "There is no justified next action" is bounded by who supplied the candidate list, and this
// function never said so (consumption attack SC-3).
export const ACTION_SCOPE = {
  establishes: 'no candidate OFFERED to this call is justified',
  doesNotEstablish: 'that no justified action exists. The candidate list is supplied by the caller,'
    + ' and nothing here establishes that it covers the actions available.',
};

export function nextAction({ candidates = [] }) {
  const justified = candidates.filter((c) => c.justified);
  if (!justified.length) {
    return { quiesce: true, action: null, ...ACTION_SCOPE,
      why: 'there is currently no justified next action. The model is NOT asked what to do when the'
        + ' authority graph has no justified answer - that is where invented objectives come from.' };
  }
  return { quiesce: false, frontier: justified, ...ACTION_SCOPE,
    why: justified.length + ' justified candidate(s)' };
}
