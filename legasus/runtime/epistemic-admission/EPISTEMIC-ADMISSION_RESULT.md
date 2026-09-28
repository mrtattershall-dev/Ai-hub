# Steps 5–7 — legaknow's first production consumer, and the ablation that makes it load-bearing
2026-09-21, branch `integration/epistemic-admission`, based on `fix-tolerant-indent` @ `e6a5aff`.
12/12 on node v24. **Epistemic only. No `delegate`. No `commit`. No merge of the Python branch.**

## The milestone, stated narrowly

> There is now one real path in Legasus where a claim cannot enter the ESTABLISHED store unless an
> authority token, minted by `legaknow` from a valid entitlement certificate, covers that exact claim.

Not a warning. Not a log line. `admit()` returns `established: false` and the store does not grow.

## What was imported, and what deliberately was not

    imported   legasus/contracts/   v1.0.0 and v1.1 schemas + the contract document, byte-identical
               six v1.1 certificate fixtures
    NOT        legasus/screen/*.py  the Python gate implementation stays on its own branch

The seam is data. The adapter parses certificates; it has never seen the producer.

## The admission table

    cert  vector  licensed     state            why
    F1    FPP     NONE         CANDIDATE        a token minted; the REQUEST is not established
    F2    PFP     NONE         FRONTIER_OPEN    no closed alternative; the frontier is preserved
    F3    PPF     NONE         OBSERVED         observe() refused - no evidential force
    F3p   FPF     NONE         OBSERVED         observe() refused - no evidential force
    F4    PPP     EQUIVALENT   ESTABLISHED      minted via DERIVE, and the evidence licenses this claim
    F5    PFF     NONE         OBSERVED         observe() refused - no evidential force

One certificate of six is admitted. The store ends with exactly one entry.

## The ablation — each gate made load-bearing, through the calculus's own refusal

    ABLATE M   evidential_force -> false      observe() refuses: "Authority cannot be inferred from
                                              its own absence." Nothing admitted; the run floor survives.
    ABLATE M   attribution -> null            observe() refuses PROVENANCE_INCOMPLETE. The second M
                                              route, and the one v1.1 made expressible.
    ABLATE D   premise unsettled              no closed alternative, so derive() is never attempted.
                                              The OBSERVATION token still mints - only the derivation
                                              failed - and the open frontier text is preserved verbatim.
    ABLATE O   licensed_relation -> NONE      the calculus STILL MINTS: the evidence is untouched and
                                              sound. The request is still not established.

**The O ablation is the one that matters.** A valid token exists, the derivation is correct, and the
claim is refused anyway, because whether the *requested* claim may be called established is a
different question from whether something was validly derived. Removing any one of the three, alone,
prevents admission.

## The two cheats, refused

**Bypass.** `admit()` is the only way into the store, and it consults `adapt()`, which can only
return what `observe()`/`derive()` returned. There is no token constructor in the runtime namespace
and none can be written: the brand is a module-private WeakSet in `calculus.mjs`.

**A second authority system.** A perfectly formed, schema-shaped certificate asserting
`obligation.passed`, `derivation.passed` and `capability_demonstrated` mints **nothing**, because no
constructor succeeds. And a certificate carrying an authority-shaped field — `authorized`,
`authority`, `grant`, `isAuthority`, or `token`/`permission` nested at any depth — is refused
*unread*, before any constructor is called.

## Independence, asserted structurally

The test strips comments and then checks the compiled surface: `observe` and `derive` are the only
constructors called anywhere in the adapter, `delegate` is not even imported, `commit` is absent, no
`legascreen` module is imported, no bridge reader is reused, and there is no code path that writes an
`attribution`. The consumer calls no constructor at all — it asks whether authority covers the action.

## Two apparatus failures, both mine, both in the measure

1. The first v1.1 bridge run failed because I passed a whole certificate to a function taking a
   measurement object.
2. This suite first failed because my source scan matched the word `delegate` inside the adapter's own
   comment saying it does not call `delegate`.

Both are measures seeing the wrong thing, which is this branch's standing subject. Both are fixed in
the measure, with the mistake noted in place.

## Limits, stated rather than discovered later

- **The witness obligation is weaker than `derive()` can enforce.** The contract names an alternative
  and its relation witnesses but carries no rule *requirements*, so `rule.requires` is empty and the
  witness check passes vacuously. That is a gap in the contract, not a bypass, and it is the obvious
  candidate for v1.2.
- Six certificates, from cases I chose, emitted by a producer I wrote.
- `obligation-covers` and `licensed-narrowing` remain limited by the calculus's vocabulary;
  `derivation-derive` still cannot express an undecidable premise.
- The epistemic × normative join — where `commit()` would eventually enter — is untouched and remains
  a separate, unpreregistered claim.
