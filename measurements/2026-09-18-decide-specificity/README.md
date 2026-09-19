# PREREGISTRATION — DECIDE specificity: does the cost land only where ordering was derived?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Why this family exists

`DECIDE` currently holds its row on **105/105 under the derived order and 0/105 under the presented
order**. That is almost too perfect. It shows `DECIDE` *can* matter enormously; it does not show that it
matters **only when it logically should**. A result that total is also what a broken ablation looks
like.

Two defects were in fact found in that instrument before this family was designed, and both are fixed
(commit `7c8083e`, and the harness commit beside this file):

1. **Deadness was asked of the plan, never of the program.** `reachability` took the requested domains
   and the order and never saw the emitted code, so its verdict was a pure function of
   `(plan, order)` — identical for every model and every realization. It also condemned a
   self-defending realization that genuinely contains no dead code.
2. **The expectations moved with the treatment.** Probe expectations were recomputed from the
   *presented* order, so the broken program was graded against a broken expectation. The probes agreed
   by construction, which is exactly why the original split was `dead-op 105, probe-fail 0` — one term
   analytic, the other blind.

Re-audited offline with deadness measured by execution and expectations held at the contract, the
original result is **unchanged: 105 to 0, rescued 0**. Every one of those dead operations is genuinely
dead in the emitted program. The row stands, and it now rests on a verdict about the artifact.

## Hypothesis

> The causal cost of ablating `DECIDE` concentrates **specifically** in transactions containing derived
> precedence constraints. Transactions whose operations are mutually disjoint must remain correct under
> an alternative legal order, because for them every order is legal.

## What DECIDE OFF means, frozen

`DECIDE OFF` = **assemble in the order the request was presented in**. It is a task-independent policy
with no access to the domain relation, exactly as `OBSERVE OFF` was frozen. It is **not** "choose a
wrong order", which would fail by construction and prove nothing.

The ablation is **paired on identical fragments**: the same generated code is assembled twice, once in
the derived order and once in the presented order. No regeneration, so nothing but the assembly differs.

**The expectations do not move.** Probe expectations are always computed from the derived order. This is
not grading the planner with the planner's own answers — it is grading against the **contract**. Two
requested behaviours whose domains are nested can only both be satisfied if the narrower wins where they
overlap; "below 0 gives micro" and "below 10 gives low" jointly determine the answer at `n = -5` however
the file is laid out.

## The cases, and the dose

Each case is **presented** in an order that violates every derived edge it has, so the number of
violated constraints is 0, 1, 2, 3 by construction.

    E0   micro (n<0), fifty (n==50), high (n>100)     0 ORDERED edges - all pairwise DISJOINT
    E1   low (n<10), micro (n<0), high (n>100)        1 ORDERED edge
    E2   low (n<10), micro (n<0), five (n==5)         2 ORDERED edges
    E3   mid (n<100), low (n<10), micro (n<0)         3 ORDERED edges - fully nested
    UND  low (n<10), plus (n>0), high (n>100)         intersecting without containment - NO GENERATION

## The specificity matrix

| relation | expected under DECIDE ON | expected under DECIDE OFF |
|---|---|---|
| strict containment (`E1`, `E2`, `E3`) | correct | **predicted degradation** |
| disjoint (`E0`) | correct | **must remain correct** |
| unresolved overlap (`UND`) | **refuse, no generation** | must not silently become ordered |

Reverse containment is covered inside `E1` to `E3`: the presented order places the **wider** domain first
in every constrained case, which is the reverse of the derived one.

## Endpoints

**Primary, specificity.** The paired quantity `broken_by_ablation / verified`: of the transactions
`DECIDE` got right, how many did the presented order break? Anything else confounds ablation cost with
proposal yield.

    E0            predicted ~0
    E1, E2, E3    predicted > 0

**Secondary, dose-response.** That fraction is predicted **monotone non-decreasing** in violated-edge
count, because surviving requires the realization to defend itself against *every* violated edge.

**Two things are frozen here so they cannot be claimed later as if the logic produced them:**

- On **perfect** fragments the response is a **step**, not a gradient: `E0` survives and `E1` to `E3` all
  fail. Any gradient observed in the run is therefore a property of **realization strategy**, not of the
  ordering logic. It is a statement about how often the model writes a self-defending guard.
- **Violated edges are not dead operations.** `E3` violates 3 edges but yields 2 dead operations,
  because one operation placed first can shadow several. The dose is the *edge* count.

## Falsification

- **If `E0` also collapses**, something other than ordering changed in the ablation and the 105/0
  interpretation needs revisiting rather than celebrating. This is the outcome the family exists to make
  visible, and it is why `E0` is in it at all.
- **If `E1` to `E3` do not degrade**, the cost of removing `DECIDE` does not concentrate where ordering
  was derived, and the necessity claim is not specific.
- **If `UND` generates anything**, an intersecting-without-containment pair has silently become ordered.

## Controls, all witnessed before any tokens were spent

**The ablation instrument can represent PASS and FAIL at every dose.** On hand-assembled perfect
fragments:

    E0   edges 0   DECIDE ON verified   DECIDE OFF verified            expected verified
    E1   edges 1   DECIDE ON verified   DECIDE OFF failed: micro       expected failed
    E2   edges 2   DECIDE ON verified   DECIDE OFF failed: micro,five  expected failed
    E3   edges 3   DECIDE ON verified   DECIDE OFF failed: low,micro   expected failed

An arm that failed everything would make `E0` unfalsifiable; one that passed everything could never show
damage at 3.

**The rescue path is proven to exist**, so the dose-response endpoint is measurable rather than void —
the defect that made the `W0` rung meaningless. A constructed self-defending realization survives the
presented order at 1, 2 **and** 3 violated edges:

    E1   guards needing self-defence 1   DECIDE OFF RESCUED
    E2   guards needing self-defence 1   DECIDE OFF RESCUED
    E3   guards needing self-defence 2   DECIDE OFF RESCUED

**Plus**: orders derive as `ORDERED` or `UNDETERMINED` as designed; every derived `ORDERED` pair is
respected by the committed order; each prompt is isolated from the other operations; both the `correct`
and `alt` realizations verify; and the reversed composition fails where ordering is derived and passes
where both orders are legal.

## Configuration

    models       qwen2.5-coder:1.5b, 7b, 14b        T4, one loaded at a time
    samples      20 transactions per case per model
    temperature  0.6
    cases        E0, E1, E2, E3 generate; UND refuses

---

# RESULT

**GPU stopped and verified (`legasus-scale`, state `stopped`, 0 tasks) before any of this was read.**

## Primary endpoint — CONFIRMED, and it is a clean separation

Paired on identical fragments: the same generated code assembled twice.

    case  violated edges   DECIDE ON   DECIDE OFF   broken by ablation
    E0          0              54          54            0/54     0%
    E1          1              51           0           51/51   100%
    E2          2              55           0           55/55   100%
    E3          3              56           0           56/56   100%

    E0 vs E1            p = 3.3e-31
    E0 vs E2            p = 2.0e-32
    E0 vs E3            p = 1.0e-32
    E0 vs E1+E2+E3      p = 2.8e-52

**Disjoint transactions survive the ablation completely; every constrained transaction fails.** The cost
of removing `DECIDE` lands exactly where derived precedence exists and nowhere else.

`E0` is not vacuous: its presented order `[micro, fifty, high]` differs from its derived order
`[fifty, high, micro]`, so the file really was assembled differently and verified anyway. That is the
anti-oracle property holding — for disjoint operations every order is legal, and the verifier admits
them all.

Every one of the 162 failures is a **named dead operation**, zero probe-only failures:
`micro x162, five x55, low x56`. Under `DECIDE OFF` the wider guard is placed first and the narrower
operation can never fire.

## Secondary endpoint — NOT OBSERVED, and the reason is measured

The predicted gradient did not appear. The response is a **step**: 0% at zero edges, 100% at one, two
and three. Monotone non-decreasing holds trivially; the interesting part does not.

The preregistration named the only mechanism that could have produced a gradient — a realization that
defends itself against a violated edge — and that mechanism is **absent from the data, not merely rare**:

    rescued (plan says dead, execution says alive)                          0 / 216

The models are not incapable of self-defence. They did it 167 times:

    EVERY extra clause written, beyond the operation's own requested domain:
        167x   n != 3     defends against the PRESERVED behaviour, which every prompt names
          0x   anything   defending against a SIBLING operation

And the split by capacity is the finding:

    model                guards   defends the NAMED fact   defends an UNNAMED sibling
    qwen2.5-coder:1.5b     168          28/58  (48%)                  0
    qwen2.5-coder:7b       240          62/80  (78%)                  0
    qwen2.5-coder:14b      240          77/80  (96%)                  0

**Defence against the fact the prompt names scales hard with capacity — 48% to 96% across a 9x parameter
range. Defence against the fact no prompt names is flat at zero.**

## What this establishes

> A realization can defend itself only against facts its own prompt names. Cross-operation precedence is
> exactly the fact that no single operation's prompt can contain, because it is a property of the
> **transaction**, not of any operation.

That is a stronger necessity claim than 105/0 was, and it is stronger in a specific way. The `OBSERVE`
middle family found the model's realization strategy substituting for the architecture 145 times, which
made correctness contingent on style and on capacity. Here the substitution is **structurally
unavailable**, and scaling does not begin to buy it. `DECIDE` is not doing work the model would
eventually learn to do for itself.

## Falsification conditions, as they stood

- `E0` collapsing would have meant something other than ordering changed in the ablation. **It did not
  collapse: 0/54.** The 105/0 interpretation survives contact with its own control.
- `E1` to `E3` failing to degrade would have meant the cost is not specific. **They degraded totally.**
- `UND` generating anything would have meant an intersecting pair silently became ordered. **It refused**,
  blocked by `low`/`plus` at `n=1`.

## Recorded honestly

The secondary endpoint is preserved as **not observed**. It was preregistered as a real prediction, the
apparatus was proven able to register it (a constructed self-defending realization was rescued at 1, 2
and 3 violated edges before any tokens were spent), and it did not occur. The step function is the
result; the explanation above is a measurement of why, not a repair of the endpoint.
