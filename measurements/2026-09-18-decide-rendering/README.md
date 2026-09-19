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

---

# RESULT — the prediction is FALSIFIED, and the failure mode has a name

**GPU stopped and verified (`legasus-scale`, state `stopped`, 0 tasks) before any of this was read.**

## Primary endpoint — falsified

Sibling defence did not appear. **Exclusion — carving a sibling's domain out of your own — occurred zero
times in 1429 guards, in every condition and at every capacity.** Not rare: absent.

What appeared instead was the opposite operation.

    guards whose own domain CONTAINS a sibling's     EXCLUDED it     ADOPTED it
    ISOLATED                          232                  0            0    0.0%
    SIBLING_NAMED                     239                  0          127   53.1%

    p = 4.0e-48

And it is confined exactly to the operations that have something to lose. Guards with no sibling inside
their domain adopted nothing: **0 of 479 under `SIBLING_NAMED`**, identical to `ISOLATED`.

## The failure mode: DOMAIN COLLAPSE

Told that a narrower behaviour is requested inside its own domain, the operation **replaces its own
domain with the sibling's** instead of excluding it:

    low   asked for n < 10   wrote n < 0     89 times     (micro's domain)
    mid   asked for n < 100  wrote n < 0     22 times     (micro's domain)
                             wrote n < 10    14 times     (low's domain)

    micro asked for n < 0    wrote n < 0    235/235       unchanged in both conditions
    five, fifty, high                       unchanged in both conditions

The direction is strict: **the wider operation collapses onto the narrower sibling; never the reverse.**

Under the derived order the narrow operation is placed first, so the collapsed guard is unreachable —
and the damage lands in the **healthy** arm. `P(correct | assembled)` under `DECIDE ON`:

    model      case   ISOLATED   SIBLING_NAMED
    1.5B        E1      1.000        0.000
    1.5B        E2      1.000        0.000
    1.5B        E3      1.000        0.143
    7B          E1      1.000        0.850
    14B         E1      1.000        0.050

## Capacity does not protect, and the curve is not monotone

    model                ISOLATED   SIBLING_NAMED   collapse rate
    qwen2.5-coder:1.5b     0/72         58/79           73%
    qwen2.5-coder:7b       0/80          5/80            6%
    qwen2.5-coder:14b      0/80         64/80           80%

**The largest model is the most affected.** 7B is largely resistant and 14B is not. This is reported as
observed and **not explained** — one 3-cell curve is not enough to claim a mechanism, and inventing one
here would be exactly the repair-after-the-fact this project forbids. It is a candidate for its own
family, not a conclusion.

## Secondary endpoint — no rescue, at any dose

    condition       edges 0      edges 1      edges 2      edges 3
    ISOLATED         0/56 0%    53/53 100%   50/50 100%   51/51 100%
    SIBLING_NAMED    0/56 0%    18/18 100%   27/27 100%   22/22 100%

The ablation still breaks every constrained transaction and still breaks no disjoint one. Naming the
sibling facts bought **nothing** on the endpoint it was predicted to move, while destroying correctness
upstream of it. The `ISOLATED` arm replicated the specificity family exactly, so the comparison is sound.

## What this establishes

The law proposed by the specificity family — *a realization can defend itself only against facts its own
prompt names* — **predicted the wrong thing and is withdrawn as stated.** The facts were named and the
defence still did not appear.

> The missing thing was never the fact. Handing over `DECIDE`'s **inputs** without `DECIDE`'s
> **conclusion** does not give the model a usable premise — it gives it an **ambiguity**, and the model
> resolves that ambiguity by collapsing its own contract onto its neighbour's.

Two overlapping domains do not by themselves say whether an operation should narrow itself, exclude the
other, or do nothing. Choosing among those **is** `DECIDE`. This is a stronger result for the
architecture than a rescue would have been: `DECIDE` is not a convenience that supplies information the
model lacks, and it is not work a larger model absorbs. Removing it and handing over its inputs made
every model worse, and made the largest model worst.

It also sharpens the division of labour. `RENDER`'s job is to state what the model must know; this family
shows that **stating more is not the same as stating what is decidable**. A rendering that adds a true
fact the model cannot resolve is not neutral — it is harmful, and here it cost up to 95% of correctness.

## Two defects in this family's own instruments, both recorded

1. **The defence metric was not a defence metric.** `defence_sibling` counted *any* clause that was not
   the canonical own-domain, so a simply wrong guard (an operation that wrote `n == 3`) scored as
   defending. Replaced by `siblingRelation`, which distinguishes `EXCLUDED` from `ADOPTED` and counts
   only guards whose domain contains a sibling. The repaired metric, replayed on the recorded rows,
   reproduces the hand analysis exactly: `0 excluded, 127 adopted of 239`.
2. **The per-model summary divided by cases and not by cells**, reporting a transaction yield of `2.000`
   once the rendering axis doubled the cell count. Cosmetic, in the summary line only.

**Neither touched the conclusion, because the conclusion came from the raw artifacts.** That is the whole
reason the rule exists: the console summary said `defends SIBLING 44` under `ISOLATED`, which was false,
and reading the actual guard conditions is what exposed it.
