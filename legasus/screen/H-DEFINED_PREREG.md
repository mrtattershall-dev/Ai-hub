# H-DEFINED — was the definedness bit discarded, or was it never available?
Frozen 2026-09-21, before any site was classified.

## The claim under test

> A partial relation is really `(defined(f,x), f(x))`, and ordinary software hardcodes
> `defined = True` while carrying only the value. **Definedness precedes value.**

If that is right, the completion failures in this branch are all the *same* omission: a bit that
**was available at the site and was thrown away**. That is a strong claim and it is the one being
tested, not assumed.

## What separates this from H-COMPLETION

H-COMPLETION is about **direction**: the completion policy predicts merge or split. It has two
non-trivial confirmations (M2, C1). H-DEFINED is about **availability**: whether the bit could have
been carried at all. A site can have a directional policy and still be unable to compute the bit.

## The decisive test, chosen so it is a proof and not an opinion

For each completion site, definedness is computable from the site's input **iff** it is a *function*
of that input. So:

> **Search for two inputs that are identical as far as the site can see, but differ in domain
> membership.** If such a pair exists, `defined` is provably not a function of the site's input, and
> the bit was never available to be discarded. If no such pair can exist, the bit was computable.

This is decidable by exhibiting a pair, or by showing definedness is a syntactic property of the
node the site receives.

## The sites, and what each one actually receives

    id   site                        receives                          
    S1   forwards()                  the Return node and the enclosing FunctionDef
    S2   is_in_domain_const          the returned expression node
    S3   TRUSTED_TAILS               the attribute node, i.e. the spelling `<expr>.get`
    S4   enclosing()                 a file's function spans and a line number
    S5   SKIP_DIRS                   the file path
    S6   resolve_call_arg star case  the Call node
    S7   resolve                     the expression node

## Prediction

**D-1 — and I predict it FAILS.** The strong reading of *definedness precedes value* requires the
bit to be computable at every site. I predict **at least one site where it is not**, and I name it
in advance: **S3**. Deciding whether `<expr>.get` is `dict.get` requires the receiver's type, which
is not a function of the spelling the site receives.
FALSIFIER of my prediction: no indistinguishable pair exists for S3, i.e. the bit was computable
there too and the strong reading survives intact.

**D-2 — the consequence if D-1 fails.** The sites split into *bit discarded* and *bit unavailable*.
For the second group, **domain membership is itself a proposition requiring its own evidence**, so
`defined` does not bottom out. It recurses into exactly the CLOSED/OPEN proof-frontier machinery
from REACH-1, where a claim is settled only if its dependency closure terminates in admitted
grounds.
FALSIFIER: every site is *bit discarded*, and definedness is a free local discipline.

**D-3 — the control against a vacuous result.** At least one site must be *bit discarded*, with
definedness shown to be a syntactic property of its input. If **no** site can carry the bit, the
discipline is unimplementable everywhere and the framing collapses in the other direction.

## Why failing D-1 would be the more interesting outcome

If every site could have carried the bit, *definedness precedes value* is a cheap local rule. If
some sites cannot, then the rule is not a foundation — it is a **recursive obligation**, and the
branch's own reachability result already describes what settles it. That would connect the bottom of
the stack back to its middle, which no result here has yet done.

## Rules

Witness-or-nothing, in both directions: a site is *unavailable* only with an exhibited
indistinguishable pair, and *discarded* only by showing definedness is a function of its input. No
site added or dropped after classification. Sites #7 and #10 stay unrepaired. If D-1 holds — if S3
turns out computable — that is recorded as my prediction being wrong, not worked around.
