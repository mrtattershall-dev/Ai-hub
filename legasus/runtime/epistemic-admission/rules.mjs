// THE ADMITTED RULE REGISTRY — what each inference rule requires, and what SATISFIES it.
//
// A CERTIFICATE CARRIES RULE IDENTITY, NEVER RULE AUTHORITY. It may name the rule it claims to have
// used and supply witness CANDIDATES. It may not say what that rule requires, and it may not declare
// that a candidate satisfies an obligation.
//
// v1.3: A RELATION NAME IS NOT A RELATION INSTANCE. The calculus already holds that coexistence does
// not establish relation - two proven endpoints do not prove an edge between them. The same applies
// one level deeper: naming a relation does not establish that it holds between THESE endpoints.
// `{ relation: 'COVERAGE' }` satisfied a coverage obligation while referring to a different world.
//
//     COVERAGE                                  a label
//     COVERAGE(evidence E, domain D, claim C)   a relation instance
//
// So each obligation carries a MATCHER owned by the rule. Binding is checked HERE, in the runtime,
// before derive() is called: a candidate that fails its matcher is not forwarded, and the calculus
// refuses on a missing witness on its own terms. legaknow is not modified to accommodate this.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveEvidenceRoot } from './authority-store.mjs';
import { fingerprintOf } from './fingerprint.mjs';

export const RULE_MOVED = 'RULE_DEFINITION_MOVED';

// A matcher returns null when the candidate BINDS, or a string naming which binding failed. It never
// returns a bare boolean, because "refused" without a reason is the collapse this project keeps
// finding.
const present = (v) => v !== null && v !== undefined && v !== '';   // eslint-disable-line no-unused-vars

// COVERAGE(evidence, domain, claim): the witness must be about the domain the claim is over, and
// must root in evidence that exists.
const coverageMatcher = (w, ctx) => {
  if (w.relation !== 'COVERAGE') return 'relation is ' + w.relation + ', not COVERAGE';
  if (!present(w.domain)) return 'witness names no domain';
  if (w.domain !== ctx.claimDomain) {
    return 'witness covers "' + w.domain + '" and the claim is over "' + ctx.claimDomain
      + '". A coverage witness about another world does not cover this one.';
  }
  if (!ctx.premiseRefs.includes(w.subject)) {
    return 'witness subject "' + w.subject + '" is not a premise of this derivation ('
      + ctx.premiseRefs.join(', ') + '), so it is bound to something the inference does not rest on';
  }
  // v1.4: the root must RESOLVE to authority establishing COVERAGE(subject, object), not merely be
  // a non-empty string. A witness is a reference to an established relation claim, not evidence.
  return resolveEvidenceRoot(w, ctx);
};

// MEMBERSHIP(element, domain): the element must be a premise of THIS derivation and the domain must
// be the one the claim is over.
const membershipMatcher = (w, ctx) => {
  if (w.relation !== 'MEMBERSHIP') return 'relation is ' + w.relation + ', not MEMBERSHIP';
  if (w.object !== ctx.claimDomain) {
    return 'witness asserts membership in "' + w.object + '" and the claim is over "'
      + ctx.claimDomain + '"';
  }
  if (!ctx.premiseRefs.includes(w.subject)) {
    return 'witness subject "' + w.subject + '" is not a premise of this derivation';
  }
  return resolveEvidenceRoot(w, ctx);
};

const define = (name, obligations, version) => Object.freeze({ name, obligations: Object.freeze(obligations),
  version, requires: Object.freeze(obligations.map((o) => o.relation)) });

export const ADMITTED_RULES = Object.freeze({
  'existential-from-established-member':
    define('existential-from-established-member',
      [{ relation: 'MEMBERSHIP', satisfiedBy: membershipMatcher }], '2'),

  'universal-from-exhaustive-coverage':
    define('universal-from-exhaustive-coverage',
      [{ relation: 'COVERAGE', satisfiedBy: coverageMatcher }], '2'),

  // THE ANTI-REFUSAL CONTROL. Restating an observation as a claim about the same subject at the same
  // scope relates nothing to anything, so it genuinely requires no relation witness. Without such a
  // rule the repair becomes "no witness ever satisfies anything", which passes every binding attack
  // perfectly and is worthless.
  'claim-from-direct-observation': define('claim-from-direct-observation', [], '2'),
});

// THE DIGEST COVERS MEANING, INCLUDING THE MATCHER'S SEMANTIC DEPENDENCY CLOSURE.
//
// The first version hashed `satisfiedBy.toString()` only. R-W4 proved that insufficient: the world
// check moved from one tolerant comparison to two equality checks and an ordering, entirely inside
// `resolveEvidenceRoot`, and the fingerprints were byte-identical. A matcher MEANS its own source
// plus the behaviour of what it calls, so the closure is what gets hashed - derived mechanically,
// never from a declared dependency list, which would mean "the rule means whatever the author
// remembered".
//
// The kernel is inside the closure. What `isAuthority` means is part of what these rules mean, and
// treating legaknow as unexaminable ground would be admitted ground that can change silently.
const MODULE_SOURCES = ['rules.mjs', 'authority-store.mjs']
  .map((f) => ({ path: f, source: readFileSync(new URL('./' + f, import.meta.url), 'utf8') }))
  .concat(['calculus.mjs', 'observation.mjs']
    .map((f) => ({ path: 'legaknow/' + f,
      source: readFileSync(new URL('../../legaknow/' + f, import.meta.url), 'utf8') })));

// The legacy digest, kept ONLY so the migration can be shown to be a migration.
export const legacyDigestOf = (r) => createHash('sha256').update(JSON.stringify({
  name: r.name,
  version: r.version,
  obligations: [...r.obligations]
    .map((o) => ({ relation: o.relation, matcher: o.satisfiedBy.toString().replace(/\s+/g, ' ') }))
    .sort((a, b) => a.relation.localeCompare(b.relation)),
})).digest('hex');

export const digestOf = (r) => {
  const f = fingerprintOf(r, MODULE_SOURCES);
  return f.ok ? f.digest : null;            // null: this rule HAS no identity and cannot be pinned
};

export const UNPINNABLE = Object.freeze(Object.fromEntries(
  Object.entries(ADMITTED_RULES)
    .map(([id, r]) => [id, fingerprintOf(r, MODULE_SOURCES)])
    .filter(([, f]) => !f.ok)
    .map(([id, f]) => [id, f.why])));

export const DIGESTS = Object.freeze(Object.fromEntries(
  Object.entries(ADMITTED_RULES).map(([id, r]) => [id, digestOf(r)]).filter(([, d]) => d !== null)));

// Resolve a certificate's rule IDENTITY to the runtime's definition. Never a rule assembled from
// certificate data.
export function resolveRule({ rule_id, rule_digest }) {
  const local = ADMITTED_RULES[rule_id];
  if (!local) {
    return { ok: false, why: 'rule_id "' + rule_id + '" is not an admitted rule of this runtime.'
      + ' A rule the consumer does not recognise is one whose obligations it cannot enforce.' };
  }
  // I-5: a rule whose semantic closure cannot be resolved HAS no identity, so it cannot be pinned
  // and must not fall back to any other one.
  if (UNPINNABLE[rule_id]) {
    return { ok: false, why: 'rule "' + rule_id + '" has no resolvable identity: '
      + UNPINNABLE[rule_id] + '. A rule that cannot be pinned cannot be relied on.' };
  }
  const here = DIGESTS[rule_id];
  if (rule_digest !== here) {
    return { ok: false, moved: true, why: RULE_MOVED + ': the certificate was produced against "'
      + rule_id + '" @ ' + String(rule_digest).slice(0, 12) + ' and this runtime holds @ '
      + here.slice(0, 12) + '. The definition moved underneath the certificate, so its derivation no'
      + ' longer means what it meant; it can neither convict nor absolve. Re-run the producer.' };
  }
  return { ok: true, rule: local, digest: here };
}

// WHICH CANDIDATES ACTUALLY BIND. The producer supplies candidates; the RULE decides satisfaction.
// Returns the witnesses that may be forwarded to derive(), plus every rejection with its reason, so
// a refusal can say which binding failed rather than only that something did.
export function bindWitnesses(rule, candidates, ctx) {
  const satisfied = [];
  const rejected = [];
  for (const ob of rule.obligations) {
    let found = null;
    for (const cand of candidates) {
      const why = ob.satisfiedBy(cand, ctx);
      if (why === null) { found = cand; break; }
      if (cand.relation === ob.relation) rejected.push({ relation: ob.relation, candidate: cand, why });
    }
    if (found) satisfied.push({ relation: ob.relation, witness: found });
  }
  return { satisfied, rejected };
}
