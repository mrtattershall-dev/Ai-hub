// Test support: build an authority store that legitimately establishes a certificate's witnesses.
//
// This is NOT part of the runtime. It stands in for the prior admissions that would, in a real
// system, have put relation authority in the store. Each token is minted by the calculus from an
// observation OF THE RELATION - nothing here fabricates a token, and the store itself refuses to
// file anything unbranded.
import { store, relationClaim } from './authority-store.mjs';
import { observe } from '../../legaknow/calculus.mjs';
import { observation, OBSERVABILITY } from '../../legaknow/observation.mjs';

export function relationTokenFor(w) {
  const claim = relationClaim(w.relation, w.subject, w.object);
  return observe({
    observation: observation({ status: OBSERVABILITY.OBSERVED, value: claim, subject: claim,
      producer: 'relation-prover', procedure: 'establish ' + w.relation,
      attribution: w.provenance || 'test support', context: { repository: w.domain } }),
    procedure: 'establish ' + w.relation, context: { repository: w.domain } });
}

// A store holding authority for every witness the certificate offers, under its own evidence_root.
export function storeFor(cert) {
  const s = store();
  for (const alt of cert.derivation.alternatives || []) {
    for (const w of alt.relation_witnesses || []) {
      if (!w.evidence_root) continue;
      s.put(w.evidence_root, relationTokenFor(w));
    }
  }
  return s;
}

export const deps = (cert) => ({ authorityStore: storeFor(cert) });
