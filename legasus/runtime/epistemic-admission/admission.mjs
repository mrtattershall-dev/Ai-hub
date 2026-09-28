// THE CONSUMER — the first production path in Legasus that asks isAuthority() before acting.
//
//     may this claim enter the ESTABLISHED store?
//
// Purely epistemic. It admits KNOWLEDGE, not actions: commit() consumes NORMATIVE authority and
// explicitly refuses epistemic tokens, so connecting a certificate to it would force the
// epistemic x normative join and the cross-language seam to be proven in one experiment. That join is
// a separate, later claim.
//
// THE DIVISION OF LABOUR, kept strict:
//
//     adapter      can this foreign evidence be expressed through the existing constructors?
//     legaknow     mints or refuses, on its own terms
//     THIS FILE    does the minted authority cover THIS action?
//
// The consumer does not interpret certificate semantics and the adapter does not decide admission.
import { adapt, isAuthority, KIND } from './adapter.mjs';

export const STATE = {
  ESTABLISHED: 'ESTABLISHED',       // admitted: a real token covers the licensed claim
  CANDIDATE: 'CANDIDATE',           // the screen found it; nothing licenses calling it knowledge
  OBSERVED: 'OBSERVED',             // the run happened; the run floor is a fact about the run
  FRONTIER_OPEN: 'FRONTIER_OPEN',   // a premise is unsettled; what blocks it is preserved
  UNRESOLVED: 'UNRESOLVED',         // the adapter could not read or express the certificate
};

const result = (state, why, extra = {}) => ({ state, established: state === STATE.ESTABLISHED,
  why, ...extra });

// A certificate always licenses the RUN FLOOR: what the instrument emitted, in this run. That is a
// fact about the run and never about the subject, so it is returned alongside every outcome and is
// never compared with the subject-level claim.
const floorOf = (cert) => (cert && cert.run_floor)
  ? { instrument: cert.run_floor.instrument, emitted: cert.run_floor.emitted_ref,
    run: cert.run_floor.run_id }
  : null;

export function admit(cert, deps = {}) {
  const floor = floorOf(cert);
  const out = adapt(cert, deps);

  // NO TOKEN, NO ADMISSION. Not a warning, not a log line - the claim cannot enter the store.
  if (!out.token) {
    const state = out.stage === 'READ' ? STATE.UNRESOLVED
      : out.stage === 'DERIVE' ? STATE.FRONTIER_OPEN
        : STATE.OBSERVED;
    return result(state, out.why, { floor, frontier: cert && cert.frontier,
      observationToken: out.observationToken ? 'minted' : null });
  }

  // A TOKEN IS NOT ENOUGH. The token says something was validly derived; whether the REQUESTED claim
  // may be called established is the obligation gate's answer, carried in licensed_relation. A
  // certificate with nothing licensed cannot admit its request however well its derivation minted.
  if (!isAuthority(out.token)) {
    return result(STATE.UNRESOLVED, 'the adapter returned a non-token', { floor });
  }
  if (out.token.kind !== KIND.EPISTEMIC) {
    return result(STATE.UNRESOLVED, 'only EPISTEMIC authority may admit knowledge', { floor });
  }
  if (cert.licensed_claim === null) {
    return result(STATE.CANDIDATE,
      'a token was minted, but the evidence licenses no restriction of the requested claim'
      + ' (licensed_relation NONE). The derivation is sound about what it derived; the REQUEST is not'
      + ' established.', { floor, frontier: cert.frontier, collateral: cert.collateral_observations });
  }

  return result(STATE.ESTABLISHED, 'minted via ' + out.token.constructor + ' and the evidence'
    + ' licenses this claim (' + cert.licensed_relation + ')',
  { floor, claim: cert.licensed_claim, relation: cert.licensed_relation,
    ancestry: out.token.ancestry, collateral: cert.collateral_observations });
}

// THE STORE. Deliberately tiny: its only rule is that nothing enters without admit() saying so.
export function store() {
  const established = [];
  return {
    established,
    offer(cert, deps = {}) {
      const r = admit(cert, deps);
      if (r.established) established.push({ claim: r.claim, ancestry: r.ancestry });
      return r;
    },
  };
}
