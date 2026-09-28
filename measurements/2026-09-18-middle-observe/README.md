# PREREGISTRATION — the middle family: can OBSERVE earn its row?

**Committed before the GPU window opens. Nothing below is adjusted after seeing a result.**

## Why this family exists

The previous `OBSERVE` ablation returned **624 for the derivation and 624 for a structure-blind bottom
policy**, identical in every shape. The cause was benchmark geometry: in all four shapes the preserved
behaviour sat at the *top*, so appending at the end automatically satisfied "do not precede the
preserved behaviour". The family could not tell the derivation apart from appending, and
`NECESSITY.md` records `OBSERVE` as **not established** because of it.

This family can tell them apart, because the only correct position is **in the middle**:

    if n == 3:    return "special"      existing A — must stay reachable
    if n < 10:    return "tiny"         the new behaviour BELONGS HERE
    if n < 100:   return "ordinary"     existing B — must not shadow the new behaviour
    return "large"

    BLIND_TOP     before A  ->  A is shadowed          PRESERVATION BROKEN
    BLIND_BOTTOM  after  B  ->  the new guard is dead  NEW BEHAVIOUR DEAD
    DERIVED       between  ->  neither

## This must not accidentally re-test DECIDE

The semantic order is derived **once** and handed to all three arms identically:

    DECIDE    A > NEW > B     from preservation, and from the requested domain being strictly inside B's
    OBSERVE   A is at line i, B is at line j, therefore the legal region is between them

Only the second is varied. A control asserts `A > NEW` and `NEW > B` hold in every generating case, so a
failure cannot be a precedence failure wearing a placement costume.

## The cases

    C1   preserve n == 3,   new n < 10,  later n < 100     region 2..2 UNIQUE
    C2   preserve n == 12,  new n < 20,  later n < 200     region 2..2 UNIQUE
    C3   preserve n < 0     (a RANGE, not a point), new n < 50, later n < 500   region 2..2 UNIQUE
    C4   same geometry as C1, different source shape — the preserved behaviour is NOT first,
         a disjoint `n > 100000` guard precedes it        region 4..4 UNIQUE
    C5   NEGATIVE: later behaviour `n > 100` is DISJOINT from the requested one, so nothing forces the
         new guard to precede it                          region 2..4 OPEN — NO GENERATION

`C5` earns its place: an `OBSERVE` implementation that always manufactures a unique middle would have to
invent one here. The control asserts the region comes back **open**, and that `B` is not treated as
constraining. It is never sent to a model.

## The success criterion, stronger than a score

> **Derived placement must outperform both structure-blind extremes on the same recorded fragments,
> with each blind policy failing for its predicted and opposite reason.**

    BLIND_TOP     -> PRESERVATION_BROKEN
    BLIND_BOTTOM  -> NEW_DEAD
    DERIVED       -> neither

A run where the derivation merely scores higher does **not** satisfy this. The failure *modes* must
separate, which is why the harness classifies every outcome rather than counting failures. The controls
already confirm this holds for a perfect fragment in all four generating cases; the experiment asks
whether it holds across what models actually produce.

## Prediction, written before running

> The criterion is met in all four generating cases and at all three capacities. `DERIVED` tracks the
> authorized rate closely; `BLIND_TOP` is near zero and almost entirely `PRESERVATION_BROKEN`;
> `BLIND_BOTTOM` is near zero and almost entirely `NEW_DEAD`.
>
> **If a blind policy ties the derivation again**, the responsibility is still not isolated and
> `OBSERVE` keeps its "not established" row — which would be the more informative outcome, because it
> would mean two families in a row failed to make knowing the program necessary.
>
> **If a blind policy fails for the *wrong* reason** — `BLIND_TOP` producing dead behaviours, say — the
> geometry is not doing what the design claims and the family needs rebuilding rather than reporting.

## Models and power

1.5B, 7B, 14B under an identical contract. 4 generating cases x 20 samples x 3 models =
**240 generations**, each evaluated at three placements.

## Cost and safety

T4 under standing authorization. `scaledown_window` 5 min, AC confirmed, stop with `--yes` and verify.
**Rule 3** checks every model before any generation.

---

# RESULT — the middle family: OBSERVE earns its row, and the mechanism is not what I predicted

GPU window stopped and verified: one `legasus` row, `stopped`, 0 containers.

    model   authorized   DERIVED   BLIND_TOP  (preservation-broken)   BLIND_BOTTOM  (new-dead)
    1.5B        73          73        19            54                     0            73
    7B          80          77        54            25                     0            80
    14B         80          79        72             7                     0            80
    TOTAL      233         229       145            86                     0           233

    DERIVED 229/233 vs BLIND_TOP 145/233      p = 9.8e-26
    DERIVED 229/233 vs BLIND_BOTTOM 0/233     p = 3.6e-131

## The criterion is met

> *Derived placement must outperform both structure-blind extremes on the same recorded fragments, with
> each blind policy failing for its predicted and opposite reason.*

    BLIND_BOTTOM   fails 233 of 233, and every single failure is NEW_DEAD
    BLIND_TOP      fails  88 of 233, and 86 of those are PRESERVATION_BROKEN
    DERIVED        fails   4 of 233, none of them a placement failure

The two blind policies fail for **opposite** reasons, exactly as the geometry predicts, and the
derivation beats both. **`OBSERVE` earns its row in `NECESSITY.md`.**

The four `DERIVED` failures are fragment errors — invented lower bounds like `0 < n < 10 and n != 3` —
which fail at *any* placement. No placement failure occurred at the derived site.

## My prediction about BLIND_TOP is falsified, and the falsification is the finding

I predicted `BLIND_TOP` would be *near zero*. It is 145 of 233, and it **improves with capacity**:
19/73 at 1.5B, 54/80 at 7B, 72/80 at 14B (1.5B vs 14B, p = 1.2e-16).

The diagnostic is almost perfectly clean:

    BLIND_TOP outcome by whether the emitted guard carries its own exclusion

      self-defending    `n < 10 and n != 3`,  `n < 20 and n != 12`,  `0 <= n < 50`
                        OK 145    FAIL   2
      plain             `n < 10`,  `n < 20`,  `n < 50`
                        OK   0    FAIL  86                          p = 1.7e-62

> `BLIND_TOP` survives **exactly when the model wrote a guard that defends itself**, and fails whenever
> it wrote a plain one.

The two self-defending failures are `0 < n < 10 and n != 3` and `1 <= n < 10 and n != 3` — invented
lower bounds, wrong at every placement, not placement failures.

## What that actually means, and it is stronger than "necessary"

Placement derived from the program is necessary — `BLIND_BOTTOM` is 0 for 233. But **part of what that
derivation protects against can be absorbed by the model's realization strategy**, and whether it is
absorbed is a property of `RENDER` and capacity, not of the placement policy.

This is the exclusion-predicate result from the rendering windows reappearing in a new role. There,
naming the exclusion in the specification made the model write `n != 3` into its guard. Here, that same
habit is what lets a structure-blind top insertion survive.

> Without `OBSERVE`, correctness becomes **contingent on a stylistic choice the architecture does not
> control** — one the 1.5B makes 26% of the time and the 14B 90% of the time.

That is a sharper statement of necessity than a bare score gap. The derivation does not merely help;
it removes a dependency on the model that would otherwise be invisible while capacity happened to be
high enough to hide it.

## What this changes

1. **`OBSERVE` moves from "not established" to load-bearing**, on a family built specifically to be
   able to falsify it, with the failure modes separating as predicted.
2. **A new interaction is measured**: `RENDER` choices that induce self-defending guards partially
   substitute for `OBSERVE`'s placement. Two stages previously treated as independent are not, and the
   substitution runs one way only — a self-defending guard rescues a bad placement, but no placement
   rescues a guard whose domain is wrong.
3. **The previous family's null is explained rather than excused.** `BLIND_BOTTOM` tied the derivation
   there because the preserved behaviour sat at the top in every shape. Here it is 0 for 233. The
   earlier entry was a statement about that geometry, and the table said so.
