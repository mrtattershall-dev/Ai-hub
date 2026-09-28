// LEGAPURPOSE — THE PROJECT CONSTITUTION, and the derivation of the next justified objective.
//
// "Build a farming RPG" cannot remain a prompt. A prompt is consumed once; a two-month run needs
// something that is still exerting authority on day 53 and can say WHY the work being done is the work
// that should be done.
//
// TWO HONESTIES ARE REQUIRED OF A CONSTITUTION, or it is decoration with a schema.
//
// FIRST: SOME CLAUSES CANNOT BE ENFORCED, AND MUST NOT PRETEND TO BE.
//     "the game remains playable"      ENFORCEABLE   something can check it
//     "the game feels calm"            DECLARED      nothing here can check it, and claiming otherwise
//                                                    would be an oracle asserting taste
//   This is the metric-class discipline one level up: BEHAVIORAL may promote, DESCRIPTIVE is reported,
//   POLICY needs an owner. A DECLARED clause has no authority to reject work.
//
// SECOND: AN OBJECTIVE WITHOUT A FALSIFICATION CONDITION IS NOT AN OBJECTIVE. IT IS AN ACTIVITY.
//   This is the experimental discipline the project runs on, turned inward and applied to the system's
//   own goals. Before work begins, an objective must state what evidence would show it SUCCEEDED and what
//   evidence would show it FAILED - and those must be different observations. An objective that cannot be
//   failed will be reported as achieved forever, and a month-long run is precisely long enough for that
//   to consume everything.
//
// THIRD, AND THE REASON UNKNOWNS EXIST: there are questions the system has NO AUTHORITY TO INVENT the
// answer to. It must escalate, not guess. Silence from the owner is not consent.
import { STATE, strengthOf, mayRely } from '../legaknow/ledger.mjs';
import { VERDICT } from '../legaprogress/frontier.mjs';

export const ENFORCEMENT = { ENFORCEABLE: 'ENFORCEABLE', DECLARED: 'DECLARED' };

export const OBJECTIVE = {
  REPAIR_REGRESSION: 'REPAIR_REGRESSION',
  REVALIDATE_STALE: 'REVALIDATE_STALE',
  PAY_OBSERVABILITY_DEBT: 'PAY_OBSERVABILITY_DEBT',
  ESTABLISH_CAPABILITY: 'ESTABLISH_CAPABILITY',
  REDUCE_UNCERTAINTY: 'REDUCE_UNCERTAINTY',
  ESCALATE_UNKNOWN: 'ESCALATE_UNKNOWN',
};

// A DECLARED priority order. This is a POLICY metric and it needs an owner - it is not learned, not
// optimised, and not evidence of anything. A scheduler would live here, and cannot be built until
// advancement is a measured signal, so the order is fixed and visible instead of clever and hidden.
export const PRIORITY = [
  OBJECTIVE.REPAIR_REGRESSION,
  OBJECTIVE.ESCALATE_UNKNOWN,
  OBJECTIVE.REVALIDATE_STALE,
  OBJECTIVE.PAY_OBSERVABILITY_DEBT,
  OBJECTIVE.ESTABLISH_CAPABILITY,
  OBJECTIVE.REDUCE_UNCERTAINTY,
];

// Validating a constitution is mostly refusing to let it overclaim.
export function constitution(doc) {
  const problems = [];
  const invariants = (doc.invariants || []).map((c) => {
    if (c.enforcement === ENFORCEMENT.ENFORCEABLE && typeof c.check !== 'function') {
      problems.push({ clause: c.id,
        why: 'declared ENFORCEABLE without a check. A clause with no check has no authority to reject'
          + ' work, and saying otherwise is an oracle asserting taste.' });
      return { ...c, enforcement: ENFORCEMENT.DECLARED, demoted: true };
    }
    return c;
  });
  if (!(doc.domains || []).length) problems.push({ clause: '(domains)', why: 'no region is declared' });
  return {
    ...doc, invariants, problems,
    enforceable: invariants.filter((c) => c.enforcement === ENFORCEMENT.ENFORCEABLE),
    declared: invariants.filter((c) => c.enforcement === ENFORCEMENT.DECLARED),
  };
}

// Only ENFORCEABLE clauses may reject. DECLARED clauses are reported and carried forward for a human.
export function checkInvariants(con, state) {
  const violations = [];
  const unjudged = [];
  for (const c of con.invariants) {
    if (c.enforcement !== ENFORCEMENT.ENFORCEABLE) { unjudged.push({ clause: c.id, why: c.clause }); continue; }
    let ok;
    try { ok = c.check(state); } catch (e) { ok = null; }
    if (ok === null || ok === undefined) {
      // UNOBSERVABLE is never an admission. A check that could not run has not passed.
      violations.push({ clause: c.id, kind: 'UNOBSERVABLE',
        why: 'the check could not be evaluated, which is not the same as the invariant holding' });
    } else if (!ok) {
      violations.push({ clause: c.id, kind: 'VIOLATED', why: c.clause });
    }
  }
  return { ok: violations.length === 0, violations, unjudged };
}

// AN OBJECTIVE MUST BE FALSIFIABLE. This refuses at construction, so an unfalsifiable goal can never
// enter the work queue in the first place.
export function objective({ kind, target, serves, justification, advancementTest, falsification,
  blockedBy = null }) {
  if (!falsification) {
    return { rejected: true, why:
      'an objective with no falsification condition is an activity: nothing could ever show it failed,'
      + ' so it will report success forever' };
  }
  if (!advancementTest) {
    return { rejected: true, why: 'an objective must state what evidence would count as achieving it' };
  }
  if (advancementTest === falsification) {
    return { rejected: true, why:
      'success and failure must be DIFFERENT observations, or the test cannot discriminate' };
  }
  if (!serves) {
    return { rejected: true, why: 'an objective must name the purpose clause or region it serves' };
  }
  return { kind, target, serves, justification, advancementTest, falsification, blockedBy };
}

// THE DERIVATION. Everything here is READ from evidence - the ledger, the frontier, the last assessment.
// Nothing is invented, and where the system has no authority the objective is to ESCALATE, not to decide.
export function nextObjectives({ con, ledger, frontier, assessment, gaps = [] }) {
  const out = [];

  if (assessment && assessment.verdict === VERDICT.REGRESSION) {
    for (const r of assessment.regressions.filter((x) => x.supported)) {
      out.push(objective({ kind: OBJECTIVE.REPAIR_REGRESSION, target: r.subject,
        serves: 'completed capability is not casually destroyed',
        justification: r.subject + ' fell from ' + r.from + ' to ' + r.to,
        advancementTest: 'a replayable witness re-establishes ' + r.subject + ' at VERIFIED',
        falsification: 'no witness can be established, or it establishes a different behaviour' }));
    }
  }

  // Things the system has no authority to invent. Silence from the owner is not consent.
  for (const u of con.unknowns || []) {
    out.push(objective({ kind: OBJECTIVE.ESCALATE_UNKNOWN, target: u.id || u,
      serves: 'the constitution reserves this decision',
      justification: 'the project cannot proceed on this point without a decision it may not make',
      advancementTest: 'the owner records a decision',
      falsification: 'no decision is recorded, and work depending on it stays blocked',
      blockedBy: 'NEEDS_OWNER' }));
  }

  for (const e of Object.values(ledger || {})) {
    const rely = mayRely(e);
    if (rely.reason === 'STALE' || rely.reason === 'CONTESTED') {
      out.push(objective({ kind: OBJECTIVE.REVALIDATE_STALE, target: e.subject,
        serves: 'no authority outlives its evidence',
        justification: 'the claim is ' + rely.reason + ': ' + rely.why,
        advancementTest: 're-derivation returns a state against the current world',
        falsification: 're-derivation cannot be performed, and the claim becomes INVALID' }));
    }
  }

  if (assessment && assessment.debt && assessment.debt.increased) {
    const dark = Object.entries(frontier || {})
      .filter(([, v]) => strengthOf(v.state) === strengthOf(STATE.CLAIMED)).map(([k]) => k);
    out.push(objective({ kind: OBJECTIVE.PAY_OBSERVABILITY_DEBT, target: dark,
      serves: 'capability may not outrun the evidence able to observe it',
      justification: 'claimed capability grew faster than witness-backed capability',
      advancementTest: 'a replayable witness is established for at least one claimed-only capability',
      falsification: 'no invocation can be found or mined that makes the capability execute' }));
  }

  // Frontier growth. The gaps are supplied, not invented here - and a gap is a QUESTION, never a
  // specification, or the frontier quietly becomes the checklist the whole design refuses to be.
  for (const g of gaps) {
    out.push(objective({ kind: OBJECTIVE.ESTABLISH_CAPABILITY, target: g.subject,
      serves: g.serves || con.identity,
      justification: g.why || 'no capability currently covers this part of the declared region',
      advancementTest: 'a witness-backed capability exists that is execution-connected to the project',
      falsification: 'the work produces no witness, or produces one nothing in the project reaches' }));
  }

  for (const e of Object.values(ledger || {})) {
    const rely = mayRely(e);
    if (rely.reason === 'UNTESTED' || rely.reason === 'UNOBSERVABLE') {
      out.push(objective({ kind: OBJECTIVE.REDUCE_UNCERTAINTY, target: e.subject,
        serves: 'unknowns are reduced deliberately, not encountered accidentally',
        justification: 'the claim is ' + rely.reason,
        advancementTest: 'the claim moves to a state that may be relied upon',
        falsification: 'the claim remains UNOBSERVABLE, which is recorded rather than resolved' }));
    }
  }

  const accepted = out.filter((o) => !o.rejected);
  accepted.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));
  return { objectives: accepted, refused: out.filter((o) => o.rejected),
    policyNote: 'the ORDER of these objectives is a declared POLICY, not a measurement. It needs an'
      + ' owner. No evidence here says this order is the best use of the next hour.' };
}
