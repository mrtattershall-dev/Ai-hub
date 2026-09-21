# Witness requirement modes — result. T0..T8 against `REQUIREMENT-MODES_PREREG.md`.

    9 arms, all green after three code changes.  123 -> 132 tests in this directory.
    7 mutants run; 5 caught by the frozen arms, 2 survived and led to two arms being strengthened.

## The prerequisite, discharged first

**T0: the eligibility probe is observationally inert.** This was the arm I was least sure of, because
a trial calls `adapt`, which calls `derive()`, which *mints*. Measured over 25 consecutive trials
against a live store: **no store entry added, no validity changed, no record changed**, the same
answer every time, and probing order does not change what is admitted. The trial token is returned
and dropped; nothing files it, and only `admitToken` files anything. The probe may now be treated as
a pure question — because it was measured, not argued.

## The default had no name, and now it is pinned

T1 fixes what the code has always done when no mode is declared, and it is **none of the three
modes**: *try the designated address within its own origin; failing that, fall back to candidates
found by claim, requiring exactly one eligible, else refuse.* Both halves are asserted, and
`outcome.mode` is `undefined` where nothing was declared — no mode is invented where none was given.

## Arm by arm

| arm | outcome |
|---|---|
| **T0** probe inertness | **held**, measured |
| **T1** default unchanged | **held** — identical with no policy and with `{}`; the unnamed hybrid is now pinned |
| **T2** `DESIGNATED` | **held** — a genuinely admissible, genuinely *binding* substitute for the same claim does **not** satisfy it: *a designated obligation is not satisfied by an equally true substitute*. Positive control: when the designated address resolves, it satisfies by `REFERENCE`. And the same certificate under the **default** does take the substitute — the mode is the only difference |
| **T3** `EXISTENTIAL` | **held** — one binding support satisfies; a second agreeing support leaves state, `why` and `bound` unchanged while every eligible support stays named. It does **not** lower the binding bar: a support from another world still fails |
| **T4** `COMPLETE` | **expressible, not satisfiable** — refuses, naming that *a stalled pass shows only that nothing can advance under the current scheduling rules, not that every possible supplier has been exposed, because replayability itself depends on consumers still being postponed*. Nothing was built to make it pass |
| **T5** scheduling | **FAILED as first run**, then held — see below |
| **T6** S6 regression | **held, both halves** — and the second half must not be misread |
| **T7** not producer-declarable | **held** — a mode on the certificate's witness *and* on the journal's consumed entry changes nothing; only the runtime policy governs |
| **T8** no amplification | **held** — identical `why`, `bound`, state and claim with one support and with two; no corroboration, confidence, strength or score anywhere |

## The prediction that failed

**T5.** `EXISTENTIAL` picked a *different* support depending on which journal was passed first.
Satisfaction was invariant — established either way — but the **provenance was not**, and provenance
that moves with argument order is not provenance. "First eligible" had quietly meant "first in input
order".

Fixed with a **stable total order** over `(origin, ref)`. The order is arbitrary, and being
arbitrary is acceptable here *only* because the obligation said any one eligible support would do;
every candidate is still named regardless of which was used. A mutant restoring input order is
caught by T5 alone.

## What a mode does about S6, and what it does not

**Under the default, the concealment S6 found still happens, unchanged** — the consumer commits
without seeing the hidden supplier, and its outcome still says
`completenessBasis: 'DECLARED_CLAIMS_OF_PENDING_RECORDS'`.

**Under `EXISTENTIAL` the same attack is inert**, and its outcome says
`completenessBasis: 'NOT_REQUIRED_BY_THIS_MODE'`. **This is a change of semantics, not a repair**,
and T6 carries the proof that it is not a repair: when the *only* supplier hides, `EXISTENTIAL`
fails too — the identical record, declaring its claim, is found, and the undeclared one is not. The
declared claim still gates termination; the mode only narrows the set of consumers for whom that
gating can change an outcome.

So the precise standing of S6 after this run: **the defect is unchanged and its blast radius is now
measurable.** It can alter an admission wherever the obligation needs the candidate set — which is
the default today, and `COMPLETE` in future.

## Mutation table

| mutant | caught by |
|---|---|
| `DESIGNATED` accepts a claim substitute | T2, T5 |
| `COMPLETE` silently treated as the default | T4 |
| candidates back to input order | T5 |
| mode taken from the **consumed entry** | T7 *(after strengthening)* |
| mode taken from the **certificate witness** | T7 *(after strengthening)* |
| `EXISTENTIAL` reports a completeness basis it did not use | T3 *(after strengthening)* |

Two mutants survived the first round. One was **mis-constructed** — it read a producer-side field
the code never consults, so it was inert rather than surviving. The other exposed a real gap: T3
asserted the completeness basis only on the single-candidate branch, so the multi-candidate literal
was unasserted. Both arms were strengthened and both mutants now die. **A mutant that does nothing
looks exactly like a mutant that survives**, which is the third time that confusion has cost
something in this sequence.

## One implementation defect, preserved

The mode was **half wired**: its meaning was applied in the multi-candidate branch and not in the
single-candidate one, so a lone support under `EXISTENTIAL` still reported the default's completeness
basis. T3 and T6 caught it on the first run. A vocabulary that means something in one branch and
nothing in the neighbouring branch is worse than no vocabulary, because the outcome still *reads* as
though the mode applied.

## Recorded hazards and limits

- **The policy lives at the call site, not in the registry.** No registry rule could be added or
  changed in this run, so modes are supplied as an explicit runtime policy. That is weaker than the
  registry: the runtime author can still choose the burden. **The producer still cannot** (T7), which
  is the property that mattered.
- **`COMPLETE` is vocabulary without a mechanism.** It refuses honestly. Its frontier boundary — what
  "every replayable record" means when replayability depends on consumers being postponed — is *not*
  frozen here and needs its own preregistration.
- The registry is still **3 authored rules, 0/15**. No freshness rule. F2 untouched. S6 untouched.
- H-IDENTITY-AUTHORITY stays at **NONE**.

## The finding, stated as precisely as it can be

**The system's authority checks can hold while its account of whether it has seen enough remains
defeasible — and the two are now separable.** `DESIGNATED` needs no account of completeness because
designation reduces the search. `EXISTENTIAL` needs one only to find its first support. `COMPLETE`
needs a real one and does not have it, and says so instead of pretending. The uncertainty has been
isolated rather than allowed to hide inside a successful admission.
