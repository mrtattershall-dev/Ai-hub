# r4 — is provenance a FUNCTION of content, or a RELATION? Predictions frozen before any attack.

Raised by the owner, 2026-09-20, reviewing the wave-1 repair of C8-a. Recorded as the owner's
observation rather than as my discovery, because it is.

## What the code asserts today

    bind()      "this content was produced by this implementation"   (provenance.mjs, one binding)
    decided     identical bytes at a DIFFERENT path RETAIN provenance
    C8-a repair two bindings for one digest with different attributions -> provenance: CONTESTED

The first two model content -> producer as a FUNCTION. The third inherits that model and hardens it:
having refused to pick a winner, it declares the two attributions to be in CONFLICT.

## The observation, stated as the owner stated it

Provenance is potentially a RELATION - a production event relates a producer to content - and
identical bytes can legitimately arise through several histories. Then

    same digest
    A says it produced it
    B says it produced it

is not a contradiction. It is two production events with one content referent.

## Why the word matters, and this is the part that makes it a defect rather than a quibble

`CONTESTED` is not a neutral label in this project. `legaknow/ledger.mjs` LAW 3 defines it:

    CONTESTED   contradicting live claims are not settled by recency. CONTESTED blocks reliance
                and OWES AN EXPERIMENT.

An experiment is owed when two claims about one thing conflict and evidence could separate them. No
experiment separates "two tools each emitted an empty file": both statements are true. So the repair
attaches an unsatisfiable obligation to a state that may carry none - manufacturing work out of a
name, which is the stopping law's own failure mode.

AND IT IS THE C4 CLASS, COMMITTED BY ME, IN THE REPAIR FOR C8. C4 was: a coordinate acquired a
declared dimension's authority because two strings matched. This is: a provenance state acquired the
ledger's CONTESTED authority - blocks reliance, owes an experiment - because I reused the word.
Same name is not same meaning, one module further out.

## NON-VACUITY, measured before predicting

    benchmarks/PROVENANCE.json           21 artifacts, 21 distinct digests, 0 collisions
    benchmarks/repoC/IDENTITY.json       3 files share e3b0c442…, the empty-file digest
                                         (pyparsing/ai/__init__.py, ai/show_best_practices/__init__.py,
                                          tools/__init__.py)

So: no historical attribution is currently mis-reported - the defect is LATENT - and the condition
that triggers it already exists in data this project measures. Both halves are stated so the repair
cannot be sold as fixing a live corruption.

## Predictions

    PR-1  ATTACK. Two bindings over IDENTICAL bytes, different producers, neither of which is wrong -
          two empty files from two tools - yield `provenance: CONTESTED` with a `why` naming the
          last-wins map. The ledger asserts a conflict that the evidence does not support.
    PR-2  ATTACK. Nothing in the module can distinguish PR-1 from a genuinely damaged ledger (one
          artifact declared to have two producers), because the digest is the only identity and path
          is DESCRIPTION by decision. Demonstrated by constructing both and showing the outputs are
          indistinguishable.
    PR-3  CONTROL, expected to hold pre-repair and post-repair: the same attribution bound twice is
          ONE attribution, not a multiplicity.
    PR-4  CONTROL, expected to hold pre-repair and post-repair: a lookup for either state returns no
          single `producedBy`. The ENTITLEMENT was already right; only the RELATION is misdescribed.
    PR-5  CONTROL: the seal still covers every attribution in a multiply-bound set (C8-b must not
          regress).

## Expected repair, if the predictions hold

State the relation and refuse the attribution, without asserting a conflict:

    MULTIPLY_BOUND   these bytes carry N production events; no single producer is established.
                     NOT a contradiction: identical content may have several histories, and this
                     ledger - whose identity is the digest, by decision - cannot tell that case from
                     a damaged record. Neither is attributed.

`CONTESTED` is not renamed away as a possibility; it is left to a check that HAS the coordinate that
would justify it. A conflict claim needs evidence that the content had ONE history, and the digest
is not that evidence. Where such a check belongs is left UNKNOWN rather than invented here.

## What a NULL result looks like

If PR-1 does not reproduce - if `CONTESTED` turns out to carry no obligation in this module because
nothing reads it that way - then the objection is about a word with no consumer, the state is
renamed for clarity only, and this file records the owner's observation as not-yet-a-defect.
