---
name: redundant-wording-changes-completion-behaviour
description: "ANY extra sentence in a model-facing prompt raises reproduction of forbidden code (5/40→14–19/40) — but only in a large window; identifier content is irrelevant, length runs backwards"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-18T11:06:13.153Z
---

2026-09-18, two controlled windows, Qwen2.5-Coder-1.5B, five arms differing from baseline by **exactly
one line** (asserted by a control). Primary endpoint was the failure mode, not the pass rate.

    at FULL (whole function visible), per 40      repeated-forbidden-line    verified
    OFF          no extra sentence                        5                    32
    FACT         "takes one parameter, named n."         19    p=1.2e-3        17
    TARGET_ID    "The parameter is named n."             18    p=2.6e-3        18
    NONTARGET_ID "The function is named classify."       15    p=1.9e-2        22
    NEUTRAL      "defined at the top level of its mod."  14    p=3.4e-2        20

    at W1 (one statement either side)             4, 7, 4, 4, 4 — nothing moves, worst p=0.52

**Pooled over the byte-identical replicates (per 80): any sentence moves it (NEUTRAL p=0.011), and an
obligation-shaped one moves it further (FACT over NEUTRAL p=0.0098).** Both effects are real.

**Identifier content is irrelevant.** Naming a token the fragment must contain vs one it must not:
p=0.65. Direct readout — naming the function did *not* pull its name into the output (1/40 vs 0/40).
**Length runs backwards**: the shortest sentence moved nearly the most, the longest the least.

**Why:** more explicit instruction is not more usable instruction. And the effect is not a property of
the wording — it is a property of the wording *together with* the code surface beside it. The same
sentence is inert in a small window and destructive in a large one.

**How to apply:** do not add sentences a model-facing prompt's window already answers, whatever they
say. Obligation-shaped ones are worse; inert ones are not free. Pair with
[[render-the-relation-not-the-bound]]: the model-facing representation is minimal, relational and
sufficient, separate from the internal representation which is explicit, complete and proof-oriented.
Never test a wording change on pass rate alone — declare the specific failure mode as the endpoint.

**A methodological correction worth keeping:** the first run read NEUTRAL's p=0.25 as evidence of no
effect and concluded "not simply one more sentence". It was underpowered. A null at a sample that could
not have shown the effect is not evidence of absence.

Related: [[bounded-authority-trades-destruction-for-refusal]], [[gate-prompt-suppressor]],
[[authorization-is-not-verification]], [[measure-the-thing-itself]].
