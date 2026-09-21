# H-OBLIGATION — does claim form determine required proof topology?
Frozen 2026-09-21, before any conclusion was scored.

## The hypothesis

> The proof structure required to entitle a conclusion is determined by the **logical form and
> domain** of the claim. Errors occur when evidence sufficient for one claim form is promoted to
> another.

Evidence aggregation is **not symmetric**. For `∃x : P(x)` one closed witness suffices. For
`∀x : ¬P(x)` one closed derivation proves almost nothing; it needs coverage of the domain or a
general argument over it. This branch has repeatedly treated the two as interchangeable.

The suspected implicit rule is **negation by failure of proof**:

    not found                   -> absent
    not represented             -> different
    not observed                -> did not happen
    not reachable by the tracer -> unreachable
    not proven same             -> different

`all([]) == True` is the pure case. The logic is flawless; the **domain binding** is wrong. Zero
failures over zero executed tests is perfectly true and useless for the proposition of interest.

## The tautology trap, named because it would make this worthless

Writing an obligation compiler and observing that it refuses what I programmed it to refuse proves
nothing. So the compiler is **not** the result. The result is whether the compiler — built from
claim form alone and frozen before scoring — reproduces this branch's **independently recorded
retraction history**.

## Frozen claim-form extraction, mechanical

Applied to the headline sentence of each recorded conclusion, by keyword, without judgement:

    universal / absence   no, none, zero, never, cannot, every, all, always, only
    existential           a, one, found, exists, at least, demonstrated
    identity              same, equals, equivalent, is
    distinction           differs, distinct, not the same, discriminates

## Frozen obligation topology per form

    EXISTENTIAL   one closed derivation with a reachable witness
    UNIVERSAL     domain established + coverage of that domain + instrument capability
    ABSENCE       search executed + search domain established + coverage + instrument capability
    DISTINCTION   positive evidence of difference (failure to prove sameness does NOT discharge)
    IDENTITY      positive evidence of sameness (failure to prove difference does NOT discharge)
    UNREACHABLE   exclusion of all relevant paths, or a domain constraint removing the state

## Frozen discharge test, checkable against the documents

An obligation counts as discharged **only if the result document records the corresponding
evidence**:

    domain established      the document states the search domain and its size
    coverage                the document states what fraction of that domain was examined
    instrument capability   a positive control is recorded as having fired
    reachable witness       a reachability fact is recorded
    positive difference     an exhibited witness of difference

## Predictions

**O-1.** The set of conclusions the compiler marks UNENTITLED equals the set this branch
independently **retracted or corrected**.
FALSIFIER: any retracted conclusion is marked entitled, or any surviving conclusion is marked
unentitled.

**O-2 — the over-flagging guard, and the likeliest way this dies.** The compiler must mark a
**substantial fraction** of conclusions ENTITLED. A compiler that refuses everything is trivially
consistent with every retraction and is useless.
FALSIFIER: fewer than half of the non-retracted conclusions are marked entitled.

**O-3.** The retracted conclusions are not retracted for a *shared surface reason* that a much
simpler rule would catch — for instance "all retractions were about reachability". If one shallow
feature predicts the retraction set equally well, claim form earns nothing.
FALSIFIER: a single shallower feature separates the sets as cleanly.

## Dispositions

    O-1, O-2, O-3 hold     claim form mechanically reproduces the branch's retraction history.
                           Retrospective on a corpus I authored; evidence about the SHAPE of the
                           remedy, not proof of the hypothesis.
    O-1 fails              claim form does not determine entitlement as stated
    O-2 fails              the compiler is a refusal machine; no usable architecture follows
    O-3 fails              a shallower account suffices; claim form is vocabulary

## What is explicitly NOT claimed

That this is the root. That a substrate making illegal promotion unrepresentable would have
prevented these errors — that is a **design proposal**, untested, and nothing is installed by this
file. The corpus is retrospective and self-authored, which is the same objection that keeps H-SUBST
unadopted; O-1 is scored against a retraction record written **before** this hypothesis existed,
which is the only thing that makes it better than storytelling.
