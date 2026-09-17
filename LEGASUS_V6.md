# LEGASUS v6 — TRANSACTION-CONSTRAINED NARROWING

**Milestone specification. Written before any v6 code and before the family that tests it.**
Preceding milestone and its failure in [`LEGASUS_V5.md`](LEGASUS_V5.md); findings in `measurements/`.

---

## What v6 inherits

**v5 failed its preregistered conjunction.** Four axes passed; site-region information gain was
positive for 1 of 19 operations. That number is permanent and is not reinterpreted here:

    LegaParse intrinsic gain    1/19 positive        FROZEN, historical

v6 does not try to improve it. It adds a **second, separately reported** measurement.

## Why squeezing `siteclass.mjs` is the wrong move

The intrinsic metric asks: *once the structural parent is known, how much does the CURRENT PROGRAM
constrain the exact legal region?* For many operations the truthful answer is **not much** — and the
18 zero-bit results are mostly correct answers, not missed ones.

Forcing that number upward inside LegaParse would mean inventing constraints that are really style
preferences. The parser would start reporting taste as legality, which is the precise failure the
`CURRENT_PROGRAM_FACT` / `TRANSACTION_INFERENCE` / `ENGINEERING_CHOICE` separation exists to prevent.

**The missing information is not in the current program. It is created by the transaction.**

    PROGRAM-ONLY REGION                       LegaParse, frozen at 1/19
          + transaction dependencies
          + execution-order requirements
          + ownership / lifecycle constraints
    TRANSACTION-CONSTRAINED REGION            LegaCore, this milestone
          canonical realization               an engineering choice, labelled as one

A worked case. LegaParse says, correctly:

    new helper   parent = module   legal region = entire module   gain = 0 bits

Then LegaCore learns what the transaction contains:

    op2 creates the helper
    op3 registers it          op3 requires op2
    op4 dispatches to it      op4 requires op3

The legal region for op3 and op4 now shrinks — **because of the transaction, not because the source
contained the answer.** That is where the bits must come from.

---

## Success criterion

> **Report transaction-constrained narrowing as its own measurement, with every bit attributable to a
> named, witnessed constraint; reach realized gain on at least 15 of the narrowable operations, while
> leaving genuinely position-independent operations at 0 bits.**

### Two denominators, so the result is auditable

A single "15/19" hides whether the remaining four were missed or were never narrowable.

    NARROWABLE OPS    of the 19, how many have an INDEPENDENTLY PROVABLE positional constraint?
    REALIZED GAIN     of those, how many did LegaCore actually derive?

**15/16 narrowable is a far stronger result than a manufactured 19/19.** Narrowability must be
established separately from the run — by construction in the family and by an executable witness, not
by asking the implementation what it managed to find.

### 19/19 is the wrong goal, explicitly

An operation with no initialization-order dependency, called only later at runtime, with no decorator
or import-time effects, valid anywhere at module scope, **has `gain = 0` as its correct answer**.
Forcing it positive makes Legasus less truthful to improve a score. A run that reports 0 bits for a
position-independent operation is doing its job.

---

## What counts as narrowing

Every reduction carries the same evidence discipline already built for roles, edges and exclusions:

    constraint   B must occur after A
    kind         transaction_dependency
    witness      B reads a symbol produced by A, and no other producer exists
    effect       legal boundaries 17 -> 6

Admissible constraint kinds — each needs a witness naming specific operations and lines:

| Kind | Witness shape |
|---|---|
| `transaction_dependency` | operation B consumes state introduced by operation A |
| `initialization_order` | initialization must execute before a mutation or read of the same state |
| `branch_reachability` | an inserted branch must precede an existing fall-through owner |
| `dominance` | a statement must dominate a downstream use |
| `lifecycle_order` | a cleanup must follow the last mutation and precede the return |
| `registration_before_use` | a registration must exist before an execution path that consumes it |
| `ownership_region` | an edit must remain inside the same ownership / control-flow region |
| `symbol_creation` | one planned operation creates a symbol another genuinely requires at execution time |

Information gain then becomes **accumulated evidence**, not a placement heuristic that happens to
agree with the reference.

## What is forbidden from counting as narrowing

None of these may reduce a legal region:

    "helpers usually go near other helpers"
    "put methods beside similar methods"
    "the reference did it here"
    "source order looks nicer this way"
    "place it after the analogue because that is conventional"

They belong to **canonical realization** — engineering choice, already a labelled concept — and to
output quality. They may make a model's code prettier. They cannot turn a zero-bit semantic region
into a positive-information one, and any of them appearing as a narrowing witness is a milestone
failure regardless of the score.

---

## Why this is LegaCore's job and not another LegaParse rule

The remaining oracle fields were never independent:

    site selection
      -> witnessed concern subgraph
        -> ordering / dependencies
          -> transaction-constrained legal regions
            -> semantic intent
              -> model

The division of labour this milestone fixes:

> **LegaParse:** *"here are the facts the program already contains."*
> **LegaCore:** *"given the change we are about to make, here are the new constraints the transaction
> creates."*

Which makes the reporting additive and every bit attributable to a source:

    intrinsic LegaParse gain        1/19      frozen
    + transaction topology          ??/19
    + execution semantics           ??/19
    ----------------------------------------
    final justified narrowing       15+/19

## Construction rules, frozen

1. **The v5 intrinsic number is never restated as improved.** It is a separate, historical measurement.
2. **Narrowability is established by construction and executable witness**, before the run, not by the
   implementation's own output.
3. **Every narrowing carries constraint / kind / witness / effect.** Unwitnessed narrowing is refused,
   exactly as an unwitnessed role or exclusion is.
4. **The forbidden list above is checked as a control**, not merely stated: at least one family task
   must be constructed so that a style-based narrowing WOULD fire and must be shown not to.
5. **The family is authored blind and sealed before implementation** — and, per the v5 caveat, so are
   any lexicons. A lexicon written with the tasks visible yields development evidence only, and must be
   reported that way.
6. **Position-independent operations must remain at 0 bits.** A run that narrows them has failed even
   if the headline improves.

## Outstanding from v5, carried forward

Prospective validation of the v5 lexicons. A third family, authored blind after the v5 freeze, must
separately answer whether the relation/provenance rules generalize, whether the operation-requirement
predicates generalize, and whether candidate inflation stays near 1.00 on tasks never seen. Until then
median inflation 1.00 is development evidence.
