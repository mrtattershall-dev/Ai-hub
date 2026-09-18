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
