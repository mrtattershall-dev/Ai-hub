# LegaParse

Deterministic program analysis. Facts extractable from source **without asking a model to guess them**.

    source code -> deterministic facts -> LegaCore planning constraints

See [`../../LEGASUS.md`](../../LEGASUS.md) for the component vocabulary and
[`../../LEGASUS_V4.md`](../../LEGASUS_V4.md) for the oracle-reduction milestone this serves.

## Modules

| module | derives | status |
|---|---|---|
| `scope.mjs` | identifiers in scope at a point; identifiers owned by other functions | migrated, in use |
| `ownership.mjs` | loop ownership: iteration variable, fall-through owner, exclusive branches, the invariant, and the clause an edit contract should carry | migrated, in use |
| `siteselect.mjs` | candidate edit sites, by locating the positions an analogous existing feature occupies | **development only — see result below** |

## Provenance

`scope.mjs` and `ownership.mjs` were developed as experiment artifacts during the 2026-09 feasibility
work and are copied here unchanged. The originals remain under
`measurements/2026-09-13-setH-1p5b/results-feasibility/` as frozen evidence; those copies are the record,
these are the subsystem. If they diverge, the measurement copy is what the published results were
produced with.

## Site selection: development result, not validation

Measured against the endpoint frozen in `LEGASUS_V4.md` **before** `siteselect.mjs` was written.
Goals 64 and 74 are one historical development challenge: their reference sites predate this deriver, so
they cannot have been authored to suit it.

    goal 64   recall 1.000   precision 1.000   inflation 0.86x    containment HOLDS
    goal 74   recall 0.333   precision 0.111   inflation 3.00x    FAILS

    degenerate "propose every line"
              recall 1.000   precision 0.51 / 0.24   inflation 5.3x / 12.3x   correctly FAILS

Goal 64's seven reference sites were recovered from six derived candidates with nothing wasted, without
the oracle being read. **Site selection is computable where an analogous feature exists.**

Goal 74 has **no analogue**. A fenced code block is a stateful multi-line construct with a loop-top
handler, and no existing feature in that file has that shape; the deriver selected the closest available
group and was wrong.

**The correct response is refusal, not a better guess.** A planner that emits confident sites for a task
it has no basis to analyse is worse than one that declines - the same unsafe-versus-uncertain
distinction LegaGate needed, one layer up. Adding a second heuristic until goal 74 passes would be
fitting to the development set, which is what the frozen endpoint exists to prevent.

**This is development evidence.** Validation requires the frozen selector run on the untouched
transaction substrate, which does not exist yet.

## Running

    node siteselect.eval.mjs      # requires the frozen seed/ and seed60/ worlds and oraclesites.mjs
