// Test support: build an authority store that legitimately establishes a certificate's witnesses.
//
// This is NOT part of the runtime. It stands in for the prior admissions that would, in a real
// system, have put relation authority in the store. Each token is minted by the calculus from an
// observation OF THE RELATION - nothing here fabricates a token, and the store itself refuses to
// file anything unbranded.
//
// v1.4: a token is minted IN A WORLD. World identity is {repository, claim_domain}, determined by
// the search in WORLD-IDENTITY_PREREG, so the stand-in must establish the relation in the same
// repository the consuming certificate is in and over the same claim domain the witness is about.
// Before v1.4 these tokens carried {repository: witness.domain}, which conflated the repository with
// the claim domain - the very collapse the world-identity experiment existed to avoid.
import { store, relationClaim } from './authority-store.mjs';
import { observe } from '../../legaknow/calculus.mjs';
import { observation, OBSERVABILITY } from '../../legaknow/observation.mjs';

export const worldOf = (cert, w) => ({
  repository: cert.measurement.observation.context.repository,
  claim_domain: w.domain,
  examined: cert.measurement.observation.context.examined,
  domain_size: cert.measurement.observation.context.domain_size,
  procedure: 'establish ' + w.relation,
});

export function relationTokenFor(w, cert) {
  const claim = relationClaim(w.relation, w.subject, w.object);
  const world = worldOf(cert, w);
  return observe({
    observation: observation({ status: OBSERVABILITY.OBSERVED, value: claim, subject: claim,
      producer: 'relation-prover', procedure: world.procedure,
      attribution: w.provenance || 'test support', context: world }),
    procedure: world.procedure, context: world });
}

// A store holding authority for every witness the certificate offers, and the certificate REWRITTEN
// to carry the handles the store issued. Handles are opaque: the producer names one, it does not
// choose what it resolves to.
export function storeFor(cert) {
  const s = store();
  for (const alt of cert.derivation.alternatives || []) {
    for (const w of alt.relation_witnesses || []) {
      if (!w.evidence_root) continue;
      const r = s.admitToken(relationTokenFor(w, cert),
        { note: 'test support: prior admission stand-in' });
      w.evidence_root = r.ref;                    // the certificate now references a real handle
    }
  }
  return s;
}

// NOTE: this MUTATES the certificate's evidence_root fields into issued handles, which is what a
// real producer would receive from a prior admission. Callers pass a clone when they need the
// original bytes.
export const deps = (cert) => ({ authorityStore: storeFor(cert) });
