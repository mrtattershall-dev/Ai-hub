# PREREGISTRATION — is DECIDE substitutable if the model is simply told what it is missing?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Where this comes from

The specificity family found that **no realization ever defended against a sibling operation: 0 of 648
guards**, flat across 1.5B, 7B and 14B — while defence against the **preserved** fact, which every
prompt names, rose 48% to 78% to 96% over the same three models. The law proposed from that pair:

> A realization can defend itself only against facts its own prompt names.

That law is cheap to state and risky to test, because it claims the zero was about **information**, not
about capability. If it is right, naming the sibling facts should produce sibling defence. If it is
wrong, the zero is something deeper and the law must be withdrawn.

It also unifies two results that pointed in opposite directions, which is exactly why it needs an
independent test rather than more agreement:

    OBSERVE middle family   the preserved fact IS nameable   substitution 145 times, rising with capacity
    DECIDE specificity      sibling precedence is NOT        substitution 0 times, flat across capacity

## What is given, and what is withheld

The `SIBLING_NAMED` condition tells the model the other requested behaviours exist, what their domains
are, and what they return. It does **not** tell the model the order, and does **not** say which behaviour
wins where two overlap.

> `DECIDE`'s **inputs** are handed over. `DECIDE`'s **conclusion** is not.

Handing over the conclusion would measure whether a model can follow an instruction, which is not in
doubt and is not interesting. Handing over the inputs asks whether the derivation itself is the part
that has to be owned by the architecture.

## Hypothesis

> The absence of sibling defence under `ISOLATED` is caused by the absence of the fact, not by an
> inability to use it. Given the sibling domains, realizations will begin to carve out the domains they
> would otherwise shadow.

## Predictions

**Primary.** `SIBLING_NAMED` produces sibling-defending clauses at a rate greater than zero, against
`ISOLATED` replicating its zero within the same run.

**Secondary.** Where sibling defence appears, the paired ablation is rescued: `broken_by_ablation` falls
below 100% at 1, 2 and 3 violated edges, and the **dose-response gradient appears** — surviving 3
violated edges requires more self-defence than surviving 1, so the survival rate should fall as the edge
count rises.

**Guardrail, reported either way.** Naming the siblings invites the model to write them. Operation yield
and every `CONSTRAIN` refusal reason are reported per condition. **A rendering that buys self-defence by
destroying yield has not bought anything**, and that trade must be visible in the same table rather than
discovered later.

## Falsification

- **If `SIBLING_NAMED` also produces zero sibling defence**, the law as stated is false. The models do
  not reason about cross-operation composition even when handed the facts, and `DECIDE`'s necessity is
  deeper than information access — a stronger result for the architecture and a worse one for the law.
- **If `ISOLATED` produces sibling defence in this run**, the specificity family's zero did not replicate
  and the law has no basis to test.
- **If sibling defence appears but the ablation is not rescued**, the defence is cosmetic: clauses that
  look protective without changing what the composed program does.

## Both outcomes are findings, and they say opposite things

    rescue appears      the zero was about information. Given the facts, a realization CAN absorb what
                        DECIDE does - and the architecture's claim becomes about DIVISION OF LABOUR
                        rather than about impossibility.
    rescue stays zero   DECIDE's necessity is deeper than information access, and the law is withdrawn
                        in favour of something narrower.

## Design

Two rendering conditions over the same four transactions, same plan, same ablation:

    ISOLATED        each prompt names only its own requested behaviour     (replication control)
    SIBLING_NAMED   each prompt also names the other requested behaviours

The ablation is unchanged and still paired on identical fragments: the same generated code assembled in
the derived order and in the presented order, with expectations always computed from the contract.

## Controls, witnessed before any tokens were spent

**The rendering control** — the conditions must actually differ, and must **not** change the plan, or the
family would be varying two things at once:

    E0   prompts differing between conditions 3/3   derived order unchanged [fifty high micro]
    E1   prompts differing between conditions 3/3   derived order unchanged [high micro low]
    E2   prompts differing between conditions 3/3   derived order unchanged [five micro low]
    E3   prompts differing between conditions 3/3   derived order unchanged [micro low mid]

Every sibling operation is asserted present in the rendered text, so a silently empty paragraph cannot
masquerade as a null result.

**The ablation instrument** still registers PASS and FAIL at every dose on perfect fragments (verified at
0 edges; failed at 1, 2, 3), and the **rescue path is still proven to exist** at 1, 2 and 3 edges with a
constructed self-defending realization. Without that second control a zero here would be
uninterpretable — it could mean the apparatus cannot see a rescue.

## Configuration

    models       qwen2.5-coder:1.5b, 7b, 14b        T4, one loaded at a time
    conditions   ISOLATED, SIBLING_NAMED
    samples      20 transactions per case per condition per model
    temperature  0.6
    cases        E0, E1, E2, E3 generate; UND refuses
