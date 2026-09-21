// THE RUNTIME ADAPTER — foreign certificate bytes into the calculus's own constructors.
//
//     certificate (data)  ->  observe() / derive()  ->  whatever the calculus permits
//
// THIS FILE CANNOT MINT. There is no token constructor here and none can be written: legaknow's brand
// is a module-private WeakSet, so the only way into it is observe/derive/delegate. What this file does
// is BUILD ARGUMENTS. The calculus decides.
//
// FOUR HARD RULES, each from a decision already taken:
//
//   1. It does NOT import the semantic bridges. Those are an adversarial research instrument; reusing
//      their readers here would let a bug in a bridge migrate into runtime and would destroy the very
//      independence that makes their agreement informative.
//   2. It calls observe() and derive() ONLY. No delegate - this contract is entirely epistemic and
//      originates no permission. No commit - that consumes NORMATIVE authority, and the
//      epistemic x normative join is a separate, later claim.
//   3. It may TRANSMIT and VALIDATE attribution. It may never SYNTHESIZE it, and never infer it from
//      procedure, filename, producer or issuer. There is deliberately no code path that writes one.
//   4. A certificate is an APPLICATION for authority. Successful parsing establishes nothing.
//   5. RULE IDENTITY, NOT RULE AUTHORITY. The certificate says WHICH rule it claims to have used and
//      WHICH witnesses it established. What that rule REQUIRES is resolved here, from this runtime's
//      own registry, and a moved definition is refused rather than silently re-interpreted. Letting
//      the producer declare `requires` would let it choose its own burden of proof.
import { OBSERVABILITY, observation } from '../../legaknow/observation.mjs';
import { observe, derive, isAuthority, KIND } from '../../legaknow/calculus.mjs';
import { resolveRule } from './rules.mjs';

export const CONTRACT_VERSION = '1.2.0-frozen-2026-09-21';

// A certificate that carries any of these has started becoming a second authority system. The
// producer's schema forbids them; the consumer refuses them again, because a forged certificate does
// not go through the producer's validator.
const FORBIDDEN = new Set(['authority', 'authorized', 'minted', 'grant', 'OWNER', 'owner', 'kind',
  'isAuthority', 'token', 'permission']);

const refuse = (why, extra = {}) => ({ minted: false, why, ...extra });

// Deep scan: the forbidden keys are refused at ANY depth, not only at the top level.
export function carriesAuthorityShape(node, path = '') {
  if (!node || typeof node !== 'object') return null;
  for (const [k, v] of Object.entries(node)) {
    if (FORBIDDEN.has(k)) return (path ? path + '.' : '') + k;
    const deeper = carriesAuthorityShape(v, (path ? path + '.' : '') + k);
    if (deeper) return deeper;
  }
  return null;
}

// STRUCTURAL ADMISSIBILITY of the bytes. Not a re-implementation of the JSON Schema - only the fields
// this adapter actually consumes, so nothing is read that was not checked.
export function readable(cert) {
  if (!cert || typeof cert !== 'object') return 'not an object';
  if (cert.contract_version !== CONTRACT_VERSION) {
    return 'contract_version is ' + JSON.stringify(cert.contract_version) + '; this adapter consumes '
      + CONTRACT_VERSION + ' only. A version it cannot check is a version it must not read.';
  }
  const bad = carriesAuthorityShape(cert);
  if (bad) {
    return 'certificate carries an authority-shaped field at ' + bad + '. A certificate is an'
      + ' application for authority and never authority; this one is refused unread.';
  }
  for (const p of ['requested_claim', 'measurement', 'derivation', 'provenance']) {
    if (!cert[p]) return 'missing ' + p;
  }
  const o = cert.measurement.observation;
  if (!o || typeof o.evidential_force !== 'boolean' || !o.procedure || !o.context) {
    return 'measurement.observation is incomplete for observe()';
  }
  if (!('attribution' in o)) {
    return 'measurement.observation has no attribution key. v1.0 cannot express it, and this adapter'
      + ' may not synthesize one.';
  }
  if (!cert.derivation.rule_id || !cert.derivation.rule_digest) {
    return 'derivation carries no rule identity. A derivation whose rule this runtime cannot resolve'
      + ' is one whose obligations it cannot enforce.';
  }
  return null;
}

// ARGUMENTS FOR OBSERVE. Every field is TRANSMITTED from the certificate. `attribution` is passed
// through exactly as given - including null, which observe() will refuse as PROVENANCE_INCOMPLETE on
// its own terms. Nothing here invents a value.
export function observeArgs(cert) {
  const m = cert.measurement;
  const o = m.observation;
  return {
    observation: observation({
      status: o.evidential_force ? OBSERVABILITY.OBSERVED : OBSERVABILITY.PRODUCER_FAILED,
      value: o.ref,
      subject: cert.requested_claim.predicate,
      producer: cert.provenance.producer,
      procedure: o.procedure,
      attribution: o.attribution,          // transmitted, never synthesized
      context: o.context,
    }),
    procedure: o.procedure,
    context: o.context,
  };
}

// ARGUMENTS FOR DERIVE, for ONE closed alternative. Alternatives are claim-level ANY_OF and are not
// flattened: the caller picks an alternative, and every premise inside it is conjunctive.
//
// THE RULE COMES FROM THE LOCAL REGISTRY. `localRule` is what resolveRule() returned for the
// certificate's rule_id after its digest matched. The certificate contributes WITNESSES - facts it
// established - and contributes nothing to what is required. Earlier this function wrote
// `requires: []` itself, so derive()'s witness check passed vacuously; the calculus was enforcing
// correctly against a rule object that asked for nothing.
export function deriveArgs(cert, altIndex, premiseTokens, localRule) {
  const alt = cert.derivation.alternatives[altIndex];
  return {
    premises: premiseTokens,
    rule: localRule,                                   // never assembled from certificate data
    relationWitnesses: (alt.relation_witnesses || []).map((r) => ({ relation: r })),
    claim: cert.requested_claim.predicate,
  };
}

// THE ONE ENTRY POINT. Returns what the calculus returned, plus why the adapter stopped if it did.
// It never returns a token it made; `observe` and `derive` are the only sources.
export function adapt(cert) {
  const why = readable(cert);
  if (why) return refuse(why, { stage: 'READ' });

  const obsTok = observe(observeArgs(cert));
  if (!isAuthority(obsTok)) {
    return refuse('observe() refused: ' + obsTok.why, { stage: 'OBSERVE', reason: obsTok.reason });
  }

  // A closed alternative may be DERIVED from the observation token. No closed alternative means no
  // derivation is attempted - an open premise is not something the adapter can close.
  const idx = cert.derivation.alternatives.findIndex((a) => a.closed === true);
  if (idx < 0) {
    return { minted: false, stage: 'DERIVE', observationToken: obsTok,
      why: 'no closed alternative in the certificate; ' + (cert.derivation.open_frontier
        || 'the derivation frontier is open') };
  }
  // RESOLVE THE RULE LOCALLY, and refuse a definition that has moved underneath the certificate.
  const r = resolveRule(cert.derivation);
  if (!r.ok) {
    return refuse(r.why, { stage: 'RULE', moved: !!r.moved, observationToken: obsTok });
  }

  const derTok = derive(deriveArgs(cert, idx, [obsTok], r.rule));
  if (!isAuthority(derTok)) {
    return refuse('derive() refused: ' + derTok.why, { stage: 'DERIVE', observationToken: obsTok,
      rule: r.rule.name, requires: r.rule.requires, missing: derTok.missing });
  }
  return { token: derTok, observationToken: obsTok, alternative: idx, kind: derTok.kind,
    rule: r.rule.name };
}

export { isAuthority, KIND };
