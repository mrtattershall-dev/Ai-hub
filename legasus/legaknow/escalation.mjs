// LAW 3 — NO SELF-RATIFICATION.
//
//     AUTHORITY CANNOT AUTHORIZE ITS OWN EXPANSION.
//
// The failure this prevents is privilege escalation, and every individual step of it can be internally
// consistent:
//
//     the objective does not satisfy PURPOSE0
//     the actor changes PURPOSE0 -> PURPOSE1
//     the objective satisfies PURPOSE1
//     the actor declares progress
//
// or, at code scale, the version this project already produced BY ACCIDENT:
//
//     the candidate does not pass the documented example
//     the change edits the documented example
//     the candidate passes
//
// Five of the frozen 56 did exactly that, with no malice and no model involved - the mutation machinery
// treated a `>>>` line as an ordinary editable source location. A stochastic coder will find this route
// eventually, because it is the cheapest way to pass a test.
//
// SURFACES ARE NOT A TAXONOMY OF FILES. A docstring is simultaneously documentation, an executable
// evidence source, and sometimes a behavioural specification; a test helper can be apparatus AND
// implementation. So the question is never "what kind of line is this" but:
//
//     WHICH AUTHORITY DOMAINS DOES MODIFYING THIS ARTIFACT AFFECT?
//
// Several may be true at once. The dangerous transition then becomes mechanically visible: a proposal
// authorised over the SUBJECT whose change also affects the EVIDENCE is reaching into something that
// judges it.
import { REFERENT_DIMENSIONS } from './referent.mjs';

export const DOMAIN = {
  SUBJECT: 'SUBJECT',                 // the thing being changed
  EVIDENCE: 'EVIDENCE',               // how the subject is observed
  SPECIFICATION: 'SPECIFICATION',     // what the evidence is interpreted to mean
  CRITERION: 'CRITERION',             // what counts as success
  APPARATUS: 'APPARATUS',             // what can be observed or evaluated at all
};

// WHO JUDGES WHOM. Deliberately a graph rather than a total order, because the relationships are not
// naturally ranked: APPARATUS has power over evidence and over evaluation without sitting "above"
// specification.
const JUDGES = {
  [DOMAIN.EVIDENCE]: [DOMAIN.SUBJECT],
  [DOMAIN.SPECIFICATION]: [DOMAIN.EVIDENCE, DOMAIN.SUBJECT],
  [DOMAIN.CRITERION]: [DOMAIN.SPECIFICATION, DOMAIN.EVIDENCE, DOMAIN.SUBJECT],
  [DOMAIN.APPARATUS]: [DOMAIN.EVIDENCE, DOMAIN.CRITERION, DOMAIN.SUBJECT],
};

// Everything that has power over whether `domain` is accepted, transitively.
export function judgesOf(domain) {
  const out = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const [judge, judged] of Object.entries(JUDGES)) {
      if (judged.includes(domain) || judged.some((d) => out.has(d))) {
        if (!out.has(judge)) { out.add(judge); grew = true; }
      }
    }
  }
  out.delete(domain);
  return [...out];
}

// Classify a concrete change by the domains it affects. Grounded in the artifact rather than asserted,
// and deliberately permitted to return several.
export function surfaceAuthority({ path = '', line = '', insideDocstring = false, isTest = false,
  isHarness = false, declares = [] }) {
  const affects = new Set(declares);
  affects.add(DOMAIN.SUBJECT);
  // A doctest line is EXECUTABLE EVIDENCE. Editing it changes what will later judge the implementation.
  if (insideDocstring && /^\s*>>>/.test(line)) affects.add(DOMAIN.EVIDENCE);
  // Its expected-output line is the specification that evidence is compared against.
  if (insideDocstring && !/^\s*>>>/.test(line) && line.trim()) affects.add(DOMAIN.SPECIFICATION);
  if (isTest) affects.add(DOMAIN.EVIDENCE);
  if (isHarness) affects.add(DOMAIN.APPARATUS);
  if (/(^|\/)(conftest|constitution|purpose)\./.test(path)) affects.add(DOMAIN.CRITERION);
  return { affects: [...affects] };
}

export const AUTHORIZATION = {
  SELF: 'SELF',                       // derived from the very authority being expanded
  OWNER: 'OWNER',                     // a human took responsibility
  INDEPENDENT: 'INDEPENDENT',         // a separate authority that does not depend on the actor
};

// THE CHECK. An actor granted authority over some domains proposes a change affecting some domains.
export function mayApply({ grantedOver = [], affects = [], authorizedBy = AUTHORIZATION.SELF }) {
  const judges = new Set();
  for (const g of grantedOver) for (const j of judgesOf(g)) judges.add(j);
  const escalating = affects.filter((a) => judges.has(a) && !grantedOver.includes(a));
  const ungranted = affects.filter((a) => !grantedOver.includes(a) && !judges.has(a));

  if (!escalating.length && !ungranted.length) {
    return { ok: true, escalating: [], why: 'the change stays inside the granted domains' };
  }
  if (escalating.length && authorizedBy === AUTHORIZATION.SELF) {
    return { ok: false, escalating, verdict: 'AUTHORITY_ESCALATION',
      why: 'the change reaches into ' + escalating.join(', ') + ', which judges '
        + grantedOver.join(', ') + '. New authority cannot be derived from the authority it would'
        + ' enlarge - that is self-ratification.' };
  }
  if (ungranted.length && authorizedBy === AUTHORIZATION.SELF) {
    return { ok: false, ungranted, verdict: 'UNGRANTED_DOMAIN',
      why: 'the change affects ' + ungranted.join(', ') + ', which was never granted' };
  }
  return { ok: true, escalating, ungranted, authorizedBy,
    why: 'the crossing was independently authorised by ' + authorizedBy };
}

// A claim that a project advanced is itself a scoped claim whose criterion is a referent coordinate, so
// changing the constitution is a REFERENT MOVE and not a free upgrade of past progress.
export const CRITERION_IS_A_REFERENT = REFERENT_DIMENSIONS.includes('criterion');
