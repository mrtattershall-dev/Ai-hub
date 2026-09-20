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
export function evidenceFrontier({ requiredProducers = [], attempted = [], pending = [] }) {
  const missing = requiredProducers.filter((p) => !attempted.includes(p));
  const state = (missing.length || pending.length) ? FRONTIER.OPEN : FRONTIER.CLOSED;
  return {
    state,
    missing,
    pending: [...pending],
    why: state === FRONTIER.OPEN
      ? 'the evidence frontier is OPEN: '
        + (missing.length ? 'required producers never attempted (' + missing.join(', ') + ')' : '')
        + (missing.length && pending.length ? '; ' : '')
        + (pending.length ? 'operations already authorized and expected to discriminate are pending ('
          + pending.join(', ') + ')' : '')
      : 'every required producer was attempted and nothing authorized is pending',
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

// THE RULE PURPOSE MUST OBEY, or the architecture cannot ever be idle.
export function objectivesFromContest(contest) {
  if (contest.state === CONTEST.QUIESCENT_CONTEST) {
    return { objectives: [],
      why: 'a QUIESCENT contest generates NO objective. An epistemic deficit generates work only when'
        + ' there is an authorized operation with a justified expectation of increasing relevant'
        + ' information. Emitting RESOLVE_CONTEST here is how a loop runs forever.' };
  }
  return { objectives: contest.justified.map((i) => ({ kind: 'REDUCE_UNCERTAINTY', target: i.name })),
    why: 'each objective corresponds to an investigation that passed all four conditions' };
}

// THE LEGITIMATE IDLE STATE. Most agent architectures assume `while (true) choose_action()`, which forces
// an answer out of an authority graph that may not have one.
export function nextAction({ candidates = [] }) {
  const justified = candidates.filter((c) => c.justified);
  if (!justified.length) {
    return { quiesce: true, action: null,
      why: 'there is currently no justified next action. The model is NOT asked what to do when the'
        + ' authority graph has no justified answer - that is where invented objectives come from.' };
  }
  return { quiesce: false, frontier: justified, why: justified.length + ' justified candidate(s)' };
}
