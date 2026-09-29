---
name: contracts-not-the-1p5b-bottleneck
description: 2026-09-18 Modal T4 — giving the 1.5B explicit where/order/precedence contracts did NOT help; scope creep and simply not making the change dominate
metadata:
  type: project
---

Preregistered contract-vs-baseline run, Qwen2.5-Coder-1.5B on a Modal T4, 40 generations.

    arm        case A   case B   parsed
    BASELINE   3/10     2/10     10/10
    CONTRACT   2/10     1/10     10/10

**NULL on the preregistered primary**, and the preregistration named this outcome in advance. The
CONTRACT arm was nominally LOWER. No endpoint reinterpreted.

**The dominant failures are not precedence.** Everything parsed. 6/10 BASELINE-A invented a
`return "large"` branch nobody asked for, destroying a preserved behaviour. 6/10 CONTRACT-A returned
the original function unchanged — valid Python, requested change simply absent. In case B, where the
contract says outright that the contested input must be "small", 1/10 produced it.

> The ruling was communicated correctly and not acted on.

**Why it matters:** for a 1.5B at this task, representing intent is NOT the binding constraint — basic
obligation-following is. A contract cannot help a model that adds an unrequested branch or makes no
change. This does not retire the v7 semantic machinery, which passes its own direct witnesses; it says
this experiment cannot see its value because a prior failure mode dominates.

**How to apply:** before testing whether better *information* helps a small model, check whether it
follows a plain obligation at all. Measure the failure-mode tally, not just the pass rate — the tally
is what carried this run. Next useful experiment is enforcement (LegaGate / bounded authority), not
another contract arm. Related: [[orchestration-discards-good-work]],
[[protocol-not-capability-ceiling]], [[localization-is-participants-not-lines]].

Hypothesis named, NOT claimed (n=10): the obligations package is abstract prose and the 1.5B may act
less reliably on it than on a direct imperative — `small=positive` appeared 6/10 in CONTRACT-A and
0/10 in BASELINE-A.

**FOLLOW-UP, same day — bounded authority: 3/20 -> 20/20 on the same end goal.**

    BASELINE  3/10  2/10   rewrite the whole function
    CONTRACT  2/10  1/10   whole function + semantic contract
    BOUNDED  10/10 10/10   write ONE guard and its return; Legasus places it

Scope creep 6/10 -> 0 and no-op 6/10 -> 0, because the authority to commit them was removed: the model
never sees the function, and unauthorized output is refused rather than repaired.

**The caveat is not optional.** The model emitted the IDENTICAL fragment 20/20 times and the prompt
contains that fragment - it is near-transcription. This is not evidence the 1.5B improved; it is
evidence the system succeeds when the residual job is small enough. Zero variance at temperature 0.6 is
itself a reason to distrust it.

**What IS strong:** case A and case B got BYTE-IDENTICAL prompts and identical model output, yet
finished correct in opposite directions - all of the semantic distinction was carried by derived
placement. Stated in prose, the same ruling had been followed 1 time in 10.

**Next question is dose-response, not yes/no:** widen the fragment (condition stated -> condition
derived -> value computed) and find where 10/10 breaks. Related: [[advisory-vs-mechanical-recovery]],
[[hub-detects-but-does-not-act]] - the same lesson at a different layer: detection and instruction do
nothing, enforcement does.

