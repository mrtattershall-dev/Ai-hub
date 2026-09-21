# EntitlementCertificate — language-neutral contract, frozen 2026-09-21
Version `1.0.0-frozen-2026-09-21`. Schema: `entitlement-certificate.schema.json`.
Sequence step 2 of 8. This file is the seam between the Python evidence side and the JavaScript
authority side. Neither imports the other; both agree on **data**.

> **A certificate carries evidence and correspondence claims. It carries no authority.
> Successful deserialization establishes nothing.**

That sentence is the adversarial test for everything downstream: a perfectly formed certificate
plus no successful `legaknow` constructor equals no `AuthorityToken` equals no admission.

## Dependency direction, fixed

    Python screen
        │  writes
        ▼
    this contract                       <- data only
        │  read by
        ▼
    legasus/runtime/epistemic-admission/adapter.mjs
        │  calls legaknow.observe() / derive()
        ▼
    real minted token  (or refusal)
        │
        ▼
    admission.mjs      <- the one consumer

Never `legaknow -> Python producer`. Never `legascreen/bridges -> runtime action`. The comparison
bridges exist to keep production and specification independent; using them as transport would let
a shared defect produce false agreement.

## Hard interface rules — the schema enforces these, prose does not

1. **No authority fields, at any depth.** `authority`, `authorized`, `minted`, `grant`, `OWNER`,
   `owner`, `kind`, `isAuthority`, `token`, `permission` each fail validation. A certificate that
   grows one of these has started becoming a second authority system.
2. **No cause fields.** `cause`, `reason`, `root_cause`, `primary` fail. Multi-gate failures stay
   vectors; the certificate says what did not pass, never why the underlying work failed.
3. **`licensed_claim` requires a relation proof.** It is `null` with `licensed_relation: NONE`, or
   a claim with `LICENSES`/`EQUIVALENT`. A claim the evidence *supports* but the request does not
   *license* cannot occupy this slot. That is the A8 defect, made unrepresentable.
4. **Supported-but-not-licensed knowledge is kept**, in `collateral_observations`, each carrying
   its relation to the request (`INCOMPARABLE`, `DOES_NOT_LICENSE`, `STRONGER_THAN_REQUEST`).
   Nothing is thrown away; it is kept off the licensed slot.
5. **Derivation preserves AND/OR.** `alternatives[]` is ANY-of; `premises[]` within one is ALL-of.
   Flattening this to one `DERIVE` call would erase the structure `justification.mjs` already
   found necessary.
6. **Measurement carries the observation, not just capability.** `legaknow.observe()` needs the
   actual observation, its evidential force, procedure and context. A fired positive control
   establishes capability for a *class* of observation; it does not mint.
7. **The run floor is on another axis.** `run_floor` records what the instrument emitted. It is
   about the run, always present, and is never compared against subject-level claims.
8. `additionalProperties: false` everywhere. Unknown fields fail.

## Field semantics

    requested_claim         the claim as attempted: { domain, quantifier, predicate }
    licensed_claim          null, or a restriction the request LICENSES
    licensed_relation       NONE | LICENSES | EQUIVALENT   - the proof for the slot above
    collateral_observations what the run established that does not restrict the request
    frontier[]              per-gate: what prevented the requested claim; blocking kind if known
    obligation              { passed, unmet[], coverage{domain -> PARTIAL|EXHAUSTIVE|UNKNOWN} }
    derivation              { passed, alternatives[ {premises[], relation_witnesses[], closed} ],
                              open_frontier }
    measurement             { capability_demonstrated, positive_control{fired, ref},
                              observation{ref, evidential_force, procedure, context},
                              instrument{name, version_digest} }
    run_floor               { instrument, emitted_ref, run_id }
    provenance              { producer, producer_digest, evidence_refs[], run_id, emitted_at }

Digests are SHA-256 of the producing source, so a stale certificate is detectable and revalidation
costs a re-run, consistent with `legaknow`'s asymmetric validity.

## What the adapter (step 5) may and may not do with this

May: read it, reconstruct `observe()` / `derive()` calls from `measurement` and `derivation`, and
obtain whatever real tokens the calculus permits.

May not: treat any field as a token, mint on `licensed_relation` alone, or call `delegate()` —
this contract is entirely epistemic and originates no permission. `commit()` is not a consumer of
it; the epistemic × normative action join is a later, separately preregistered claim.

## Status

Frozen. Exercised by `legasus/screen/certificate.py` (emitter) and `certificate_test.py`
(validation, including adversarial cases). No consumer exists. No branch is merged.
