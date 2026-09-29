# The farm gate was blind in one exact place, and the correction withdraws the only narrow-arm acceptance

2026-09-29, $0, local. Nothing was rerun; this is a re-judgement of an artifact already on disk.

## Where the blindness was

`legasus/bench/farm/play.json` **is** error-sensitive: step 1 asserts `errors.length === 0` at load, and
step 8 asserts `noErrors` after the whole play. NARROW-2 was accepted on **farm-i1**, a subset of
**steps 1-3** — which dropped step 8. Errors thrown *during* the arrow-key movement had nothing to
report them.

## The correction, validated against the known-bad artifact

`legasus/screen/NARROW-2_accepted_index.html`, re-judged:

| gate | verdict |
|---|---|
| v1 as accepted, steps 1-3 | passing 1,2,3 — **accepted** |
| corrected, steps 1-3 + the trailing `noErrors` | **FAILS step 8** — `[JS ERROR] Cannot set prop…` |

The corrected gate catches an artifact independently established as broken. That is the strongest
positive control available for a gate: not a mutant written to be caught, but a real accepted candidate
already known to throw.

## What this withdraws

NARROW-2's amendment already said the acceptance meant "passed farm-i1 under play spec v1", never
"error-free or fully working". This sharpens it: **under the corrected gate the artifact is rejected
outright.**

Combined with NARROW-1's `B7 accepted — 0 of 5`, the position is:

> **There is currently no surviving acceptance produced by a narrowed generation interface, on any
> family, from this model.**

The historical record stands as a record of what the v1 gate said. What does not stand is any claim
that narrowing has been shown to produce a working artifact.

## What it does not establish

- Nothing about the filter family, where free-form won 12-0 under a gate that already carried its
  trailing error check and showed no structural drift.
- Nothing about whether narrowing *could* work under the corrected protocol. It has not been tried.
- Nothing about the 7B, which is not involved here.

## The experiment this sets up

A definitive farm result needs **both** arms rerun under the corrected protocol — free-form and bounded,
same gate, same acceptance, same budget. A free-form-only replay is **diagnostic**, not definitive.

The prior going in is now: narrowing has no surviving acceptance anywhere, so "narrowing helps on the
farm family" is not a hypothesis with evidence behind it — it is a hypothesis whose original support has
been withdrawn.
