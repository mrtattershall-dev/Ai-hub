// LEGAPROGRESS — THE PROJECT RATCHET. Did the work advance the project, or merely occur?
//
// This is the layer that stops a two-month run producing twenty thousand individually valid commits that
// do not add up to anything. Every instrument below this one scores CHANGES. None of them can see that a
// week of correct, verified, beautifully bounded refactoring built nothing.
//
//     rename internal variable      VERIFIED
//     refactor helper               VERIFIED
//     improve error message         VERIFIED
//     reorganise constants          VERIFIED
//     add another abstraction       VERIFIED
//     optimise parser               VERIFIED     <- and fishing is still not implemented
//
// LEGAPROGRESS IS AN ORACLE, AND IT INHERITS THE ANTI-ORACLE LAW.
//
//     ANYTHING WITH THE AUTHORITY TO REJECT MUST PROVE IT CAN ADMIT LEGITIMATE ALTERNATIVES.
//
// So the purpose is NOT a checklist. A system that can only recognise advancement it was told to expect
// is not creating anything; it is transcribing a decomposition, extremely reliably. PURPOSE declares a
// REGION OF ACCEPTABLE ADVANCEMENT, and the frontier is whatever evidence-backed capability currently
// exists inside it.
//
// THE HARD PART is admitting the unanticipated while rejecting the divergent, when both are fully
// witnessed and neither was named in advance. Naming cannot be the discriminator or we are back to a
// checklist. So the discriminator is EXECUTION:
//
//     A capability is PURPOSE-SUPPORTED iff it is not prohibited, AND
//         it lies in a declared domain and is execution-connected to the project, OR
//         it is execution-connected to a capability that is already purpose-supported.
//
// CONNECTION IS PROVEN BY A WITNESS, NEVER BY A NAME. An unanticipated fishing module that the player's
// own verified execution path enters is part of this project. A flawless consensus implementation that
// nothing in the game ever reaches is not, however impressive it is.
import { STATE, strengthOf, mayRely } from '../legaknow/ledger.mjs';

export const VERDICT = {
  ADVANCEMENT: 'ADVANCEMENT',
  NO_EVIDENCE_OF_ADVANCEMENT: 'NO_EVIDENCE_OF_ADVANCEMENT',
  NOT_PURPOSE_SUPPORTED: 'NOT_PURPOSE_SUPPORTED',
  PROHIBITED: 'PROHIBITED',
  REGRESSION: 'REGRESSION',
};

export const ROUTE = {
  IN_DOMAIN: 'IN_DOMAIN',                 // declared region, and the project actually runs it
  CONNECTED: 'CONNECTED',                 // reached by an already-supported capability's execution
  UNSUPPORTED: 'UNSUPPORTED',
};

const namespaceOf = (subject) => String(subject).split('.')[0];

// EXECUTION CONNECTIVITY, derived from witnesses. A witness records the subject its invocation was rooted
// at and every frame that execution entered. Nothing here consults a name, a docstring, or a plan.
export function connectivity(witnesses) {
  const reachedFrom = new Map();
  for (const w of witnesses) {
    const set = reachedFrom.get(w.rootSubject) || new Set();
    for (const f of w.entered || []) set.add(f);
    reachedFrom.set(w.rootSubject, set);
  }
  return {
    reaches: (from, to) => (reachedFrom.get(from) || new Set()).has(to),
    reachedBy: (to) => [...reachedFrom.entries()].filter(([, s]) => s.has(to)).map(([f]) => f),
    roots: () => [...reachedFrom.keys()],
  };
}

// The supported region, computed to a FIXPOINT. Seeded by capabilities that are both in a declared domain
// and actually executed by the project, then grown along real execution edges. Growth is what admits the
// unanticipated; requiring an edge is what excludes the divergent.
export function supportedRegion({ purpose, subjects, conn }) {
  const prohibited = new Set();
  for (const s of subjects) {
    for (const p of purpose.prohibitions || []) {
      if (new RegExp(p.match).test(s)) prohibited.add(s);
    }
  }
  const supported = new Map();
  for (const s of subjects) {
    if (prohibited.has(s)) continue;
    const inDomain = (purpose.domains || []).includes(namespaceOf(s));
    const runByProject = (purpose.entryPoints || []).some((e) => conn.reaches(e, s));
    if (inDomain && runByProject) supported.set(s, ROUTE.IN_DOMAIN);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of subjects) {
      if (supported.has(s) || prohibited.has(s)) continue;
      for (const root of supported.keys()) {
        if (conn.reaches(root, s)) { supported.set(s, ROUTE.CONNECTED); grew = true; break; }
      }
    }
  }
  return { supported, prohibited };
}

// OBSERVABILITY DEBT. A project may not claim capability faster than it builds the evidence able to
// observe that capability. `packaging` inherited 21.9% call-time observability because a normal project
// accumulates dark behavioural surface silently. This makes that accumulation a number.
export function observabilityDebt(frontier) {
  const entries = Object.values(frontier);
  const claimed = entries.filter((e) => strengthOf(e.state) >= strengthOf(STATE.CLAIMED)).length;
  const backed = entries.filter((e) => strengthOf(e.state) >= strengthOf(STATE.REACHABLE)).length;
  return { claimed, witnessBacked: backed, ratio: claimed === 0 ? 1 : backed / claimed };
}

// THE ASSESSMENT. Two frontiers, the witnesses that connect them, and the constitution.
export function assessAdvancement({ purpose, before, after, witnesses }) {
  const conn = connectivity(witnesses || []);
  const subjects = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const { supported, prohibited } = supportedRegion({ purpose, subjects, conn });

  const transitions = [];
  const regressions = [];
  for (const s of subjects) {
    const b = before[s];
    const a = after[s];
    const bs = b ? strengthOf(b.state) : strengthOf(STATE.UNTESTED);
    const as = a ? strengthOf(a.state) : strengthOf(STATE.UNTESTED);
    if (as > bs) {
      transitions.push({ subject: s, from: b ? b.state : STATE.UNTESTED, to: a.state,
        route: supported.get(s) || ROUTE.UNSUPPORTED, prohibited: prohibited.has(s) });
    } else if (as < bs && bs >= strengthOf(STATE.REACHABLE)) {
      // Losing evidence for something that had it is a REGRESSION whether or not anything else advanced.
      // "Completed features are not casually destroyed" is only an invariant if something checks it.
      regressions.push({ subject: s, from: b.state, to: a ? a.state : STATE.UNTESTED,
        supported: supported.has(s) });
    }
  }

  const debtBefore = observabilityDebt(before);
  const debtAfter = observabilityDebt(after);
  const debt = { before: debtBefore, after: debtAfter,
    increased: debtAfter.ratio < debtBefore.ratio,
    why: debtAfter.ratio < debtBefore.ratio
      ? 'claimed capability grew faster than the evidence able to observe it' : null };

  const base = { transitions, regressions, debt,
    supported: [...supported.entries()].map(([s, r]) => ({ subject: s, route: r })),
    prohibited: [...prohibited] };

  if (regressions.some((r) => r.supported)) {
    return { ...base, verdict: VERDICT.REGRESSION,
      why: 'a purpose-supported capability lost the evidence that backed it: '
        + regressions.filter((r) => r.supported).map((r) => r.subject).join(', ') };
  }
  if (!transitions.length) {
    return { ...base, verdict: VERDICT.NO_EVIDENCE_OF_ADVANCEMENT,
      why: 'no capability changed evidentiary state. The work may be correct and may be committed;'
        + ' it is not evidence that the project moved.' };
  }
  if (transitions.every((t) => t.prohibited)) {
    return { ...base, verdict: VERDICT.PROHIBITED,
      why: 'the only advancement is in a region the constitution forbids' };
  }
  const supporting = transitions.filter((t) => !t.prohibited && t.route !== ROUTE.UNSUPPORTED);
  if (!supporting.length) {
    return { ...base, verdict: VERDICT.NOT_PURPOSE_SUPPORTED,
      why: 'real, witnessed capability was established, but nothing the project executes reaches it and'
        + ' it lies outside every declared domain. Advancement, but not of THIS project.' };
  }
  return { ...base, verdict: VERDICT.ADVANCEMENT, advanced: supporting,
    why: supporting.map((t) => t.subject + ': ' + t.from + ' -> ' + t.to + ' (' + t.route + ')')
      .join('; ') };
}

// A capability may only be VERIFIED on the strength of a claim that is currently relyable. This is the
// join between the project ratchet and the epistemic one: stale evidence cannot hold a feature up.
export function frontierFrom(ledger, now, freshnessFn) {
  const out = {};
  for (const e of Object.values(ledger)) {
    const checked = now && freshnessFn ? freshnessFn(e, now) : e;
    out[e.subject] = mayRely(checked).ok
      ? checked
      : { ...checked, state: STATE.CLAIMED, downgraded: true,
        why: 'evidence for this capability is ' + mayRely(checked).reason
          + '; the capability reverts to CLAIMED until it is re-established' };
  }
  return out;
}
