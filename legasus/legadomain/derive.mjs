// LEGADOMAIN — DERIVATION, and the projection that keeps it away from PROPOSE.
//
//     TASK / DELTA  +  PROGRAM FACTS  +  DECLARED DOMAIN
//            |
//        LegaDomain
//            |
//     obligations / prohibitions / unknowns
//            |
//          DECIDE  ->  semantic contract  ->  PROVE derives checks
//            |
//          RENDER  ->  MINIMAL RESIDUAL PROJECTION ONLY
//            |
//         PROPOSE
//
// The layer produces two DIFFERENT things and they must not be confused:
//
//     the CONTRACT      everything derived, at full richness, for DECIDE and PROVE
//     the PROJECTION    the residue a single PROPOSE call needs to discharge its own operation
//
// Semantic least privilege is not advice here. The rendering families measured true, relevant
// neighbouring semantics costing up to 95% of correctness when handed to the model, so the projection is
// built by SUBTRACTION from the contract with an explicit reason recorded for everything withheld.
import { AUTHORITY, claim, resolve } from './authority.mjs';
import { knowledgeFor, AUTHORITY_OF, DOMAIN_IRRELEVANT_OPERATIONS } from './domains.mjs';

const NL = String.fromCharCode(10);

// Derive the domain-relevant obligations for one operation.
//
//   task           what was asked, with any explicit requirements it states outright
//   programFacts   observed repository truth, each already carrying REPOSITORY_FACT authority
//   domain         the DECLARED domain id, never inferred
//   policyOwners   subjects whose DOMAIN_POLICY an owner has explicitly adopted
export function deriveObligations({ task, programFacts = [], domain, operation, policyOwners = {} }) {
  const claims = [];

  // 1. The task outranks everything. What was actually asked for is not negotiable by domain lore.
  for (const r of task.requirements || []) {
    claims.push(claim({ subject: r.subject, requirement: r.requirement,
      authority: AUTHORITY.TASK_SPECIFICATION, source: 'task', why: r.why || 'stated in the request' }));
  }

  // 2. Repository facts are concrete local truth and defeat domain lore about the same subject.
  for (const f of programFacts) {
    claims.push(claim({ subject: f.subject, requirement: f.requirement,
      authority: AUTHORITY.REPOSITORY_FACT, source: f.source || 'observed in the repository',
      why: f.why || 'this program demonstrably does this' }));
  }

  // 3. Domain knowledge, at whatever authority each fact declares.
  const k = knowledgeFor(domain, operation);
  const unknowns = [];
  if (!k.known) {
    unknowns.push({ subject: 'domain:' + domain + ':' + operation, authority: AUTHORITY.UNKNOWN,
      why: k.why + '. No generic best practice is substituted.' });
  } else {
    for (const kind of ['invariants', 'defaults', 'policies']) {
      for (const f of k[kind] || []) {
        claims.push(claim({ subject: f.subject, requirement: f.requirement,
          authority: AUTHORITY_OF[kind], source: domain + '.' + operation + '.' + kind,
          owner: kind === 'policies' ? (policyOwners[f.subject] || null) : null, why: f.why }));
      }
    }
  }

  const resolved = resolve(claims);
  return {
    domain, operation,
    domainRelevant: !DOMAIN_IRRELEVANT_OPERATIONS.has(operation) && k.known,
    obligations: resolved.obligations.filter((o) => o.requirement === 'MUST_PERSIST'),
    prohibitions: resolved.obligations.filter((o) => o.requirement === 'MUST_NOT_PERSIST'),
    other: resolved.obligations.filter((o) =>
      o.requirement !== 'MUST_PERSIST' && o.requirement !== 'MUST_NOT_PERSIST'),
    conflicts: resolved.conflicts,
    inert: resolved.inert,
    unknowns,
  };
}

// THE PROJECTION. What may this particular PROPOSE call be told?
//
// Built by SUBTRACTION, and everything withheld is recorded with a reason - a projection that cannot say
// what it removed is indistinguishable from one that removed nothing.
//
// The rule: a fact reaches the model only if the operation it is generating can actually act on it. A
// prohibition about a field this call never touches is a true, relevant, globally-important fact that the
// model has no use for, and the rendering families measured what happens when such facts are supplied.
export function projectForProposal(derived, { handles = [] } = {}) {
  const touches = new Set(handles);
  const included = []; const withheld = [];
  for (const o of [...derived.obligations, ...derived.prohibitions, ...derived.other]) {
    if (touches.has(o.subject)) included.push(o);
    else {
      withheld.push({ subject: o.subject, authority: o.authority,
        reason: 'this proposal does not touch ' + o.subject
          + ', so the fact is internal to DECIDE and PROVE' });
    }
  }
  // Policy that never became an obligation, and unknowns, are never model-facing at all.
  for (const i of derived.inert) {
    withheld.push({ subject: i.subject, authority: i.authority, reason: i.reason });
  }
  for (const u of derived.unknowns) {
    withheld.push({ subject: u.subject, authority: u.authority, reason: u.why });
  }
  return { included, withheld };
}

// The checks PROVE should derive. Separate from the projection on purpose: the verifier gets everything,
// the generator gets the residue.
export function verificationRequirements(derived) {
  return [
    ...derived.obligations.map((o) => ({ check: 'ROUND_TRIPS', subject: o.subject,
      authority: o.authority, why: o.why })),
    ...derived.prohibitions.map((o) => ({ check: 'ABSENT_AFTER_SAVE', subject: o.subject,
      authority: o.authority, why: o.why })),
  ];
}

export { NL };
