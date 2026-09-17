# LEGASUS v5 — A JUSTIFIED BATTLEFIELD

**Milestone specification. Written before any v5 code, and before the family that tests it.**
Vocabulary in [`LEGASUS.md`](LEGASUS.md); findings in `measurements/`; preceding milestone in
[`LEGASUS_V4.md`](LEGASUS_V4.md).

---

## The bar this milestone is held to

Site selection is not solved. What v4 proved prospectively is weaker than it sounds:

> *"I can sometimes identify the right concern, and avoid confidently guessing when I have no basis."*

What Legasus needs is:

> *"I can identify the relevant concern, derive the participating operations, narrow those to the sites
> this specific delta actually requires, explain why each site belongs AND why each excluded
> participant does not, and hand LegaCore a search space small enough that the model is no longer
> doing global discovery."*

Because site selection is ultimately an **authority decision** — which parts of this program is
Legasus willing to let a model touch. *"Probably around here"* does not answer that question.

### What v4 measured, stated without generosity

    no-analogue non-overreach      3/3 abstained        supported; small sample
    positive applicability         2/6 tasks usable
    candidate precision            2/4 and 3/5          roughly 2x inflation
    informative narrowing          0.00 bits            the legal-region layer contributed nothing
    exact reference positions      5 of 5 scored

Five exact positions do not rescue this. **Textual coincidence with the reference is not analytical
narrowing** — that is precisely why the two axes are kept apart. Coverage, precision and information
gain are all still failing, and only one of the three has a diagnosed cause.

---

## The diagnosed cause (coverage): provenance collapse

c03 abstained AMBIGUOUS with `variant:click` and `variant:key` tied at two hits each. The relation text
alone separates them perfectly: `key` is in it, `click` is not. `resolve()` concatenates the named
relation with the entire goal into one haystack, so a token from the clause that NAMES the analogy
carries exactly the authority of one from the preservation clause — *"the click and key event types
must keep working exactly as they do now."*

A preservation clause names things **because they are not the target**. Counting a mention there as
evidence FOR a concern inverts its meaning.

    RELATION evidence       the clause naming the analogy    -> HIGH AUTHORITY for CONCERN IDENTITY
    DELTA evidence          the behaviour being added        -> informs REQUIREMENTS; never nominates
    PRESERVATION evidence   the behaviour that must remain   -> MUST NOT nominate, at all
    INCIDENTAL goal text    everything else                  -> no nominating authority

> **Evidence is not interchangeable merely because its surface representation is the same.**

The same separation the v4 sweep made between `CURRENT_PROGRAM_FACT`, `TRANSACTION_INFERENCE` and
`ENGINEERING_CHOICE`: there a value's authority followed how it was derived, here it follows where it
was said.

And development could not have found this: a03 has the identical shape but its source defines a
handler for `quoted` and none for `plain`, so `variant:plain` never entered the graph. **a03 scored a
win on a mechanism it never exercised.**

## The undiagnosed cause (precision): participation is not requirement

This is the larger half of the milestone, and it is a different question from provenance.

LegaParse currently says *"these places participate in the concern."* Legasus needs *"these places
participate in the concern, **and these specific roles must change for this requested delta**."* A
concern may hold

    OWNER   MUTATOR-a   MUTATOR-b   CONSUMER-a   CONSUMER-b

while a particular delta requires only

    OWNER   MUTATOR-a   CONSUMER-b

Handing all five to LegaCore finds the neighbourhood and not the address. **That is where the ~2x
inflation lives**, and no amount of provenance work touches it.

The exclusions matter as much as the inclusions. *Why a relevant participant does not require an edit*
is a claim about the delta, and under this project's standing rule it needs a witness like any other.

---

## The resolution object

Every layer either produces a witnessed result or abstains. A layer that cannot justify its output does
not get to guess on behalf of the ones below it.

    TASK RELATION            which existing concept is explicitly referenced, and in WHICH CLAUSE
    CONCERN                  which program concern satisfies that relation
    ROLE PARTICIPANTS        owner / mutators / consumers / registry / dispatch / handlers
    OPERATION REQUIREMENTS   which of those roles must change for THIS delta      <- new in v5
    LEGAL SITES              where those operations may legally occur
    DEPENDENCIES             what must exist before what
    ABSTAIN                  at any step lacking sufficient evidence

Target output shape:

    APPLY
      relation:            "new X behaves like existing Y"        clause: RELATION
      resolved concern:    variant:Y                              witness: ...
      required roles:      REGISTRY, HANDLER, DISPATCH
      sites:
        site_1  role REGISTRY  witness ...  reason_required ...
        site_2  role HANDLER   witness ...  reason_required ...
        site_3  role DISPATCH  witness ...  reason_required ...
      dependencies:        site_1 -> site_3,  site_2 -> site_3
      excluded participants:
        Y.label_map  role REGISTRY  reason_not_required ...

---

## Success criterion

> **Prospectively, on a sealed family the implementation has never seen: non-overreach maintained,
> coverage materially improved, candidate inflation materially reduced, and information gain
> positive — all four at once.**

Any three of four is a failure of this milestone. They trade against each other trivially: applying
more often buys coverage with overreach, nominating fewer sites buys precision with coverage. Only the
conjunction is evidence that the architecture is doing work.

### Pre-registered targets, fixed before the baseline is measured

Registered now, before the v2 baseline on this family is run, so the bar cannot be set to whatever the
gap turns out to be.

| Axis | v4 holdout | v5 target |
|---|---|---|
| non-overreach (abstain-expected tasks that abstain) | 3/3 | **≥ 5/6** — must not regress |
| coverage (apply-expected tasks that APPLY correctly) | 2/3 | **≥ 4/6** |
| candidate inflation (sites nominated / sites required) | 2.00, 1.67 | **median ≤ 1.25** |
| information gain | 0.00 bits everywhere | **> 0 bits on ≥ half of scored operations** |
| exact or equivalent position | 5/5 | **must not regress below 80%** |

**On power, stated before the fact:** with six apply-expected tasks, a one-task change in coverage is
not a rate estimate and will not be reported as one. This family is a MECHANISM CHECK — it can show
that a mechanism fires, fires for the right reason, and does not fire when it should not. It cannot
support a claim about how often. The project has already paid once for designing around a rate seen
in sixteen trials.

---

## Construction rules, frozen

1. **Clause segmentation is general.** Relation / delta / preservation are identified by clause
   structure, not by matching this family's wording. A rule keyed to "must keep working exactly as
   they do now" is an anchor inside a parser.
2. **Provenance is recorded, not merely used.** Every hit carries its clause, and that appears in the
   audit record. A resolution that cannot name the clause that authorised it is inadmissible — the
   standard already applied to roles and edges.
3. **Preservation evidence is EXCLUDED from nomination, not down-weighted.** No coefficient. A weight
   is a threshold in disguise and becomes something to optimise against the holdout.
4. **Requirement is derived from the delta, not from the reference.** The operation-requirements layer
   may read the task's requested behaviour. It may not read the reference patch, the oracle, or the
   operation count. If it needs to know how many operations there are, it has become an oracle.
5. **Every included site carries `reason_required`; every excluded participant carries
   `reason_not_required`.** An exclusion without a witness is a guess that happens to be conservative.
6. **Abstention reasons stay distinguishable.** `ABSTAIN_AMBIGUOUS` after provenance separation is a
   different finding from the same token before it.
7. **The family is authored and sealed BEFORE the implementation.** A family written afterwards
   measures the implementation's shape.
8. **v2 is not edited.** Its prospective numbers stand. v5 is a new component with its own freeze.

---

## Controls the family MUST contain

A family of c03-shaped tasks would confirm any change that prefers the relation clause. These exist so
the criterion can fail.

| # | Control | What it refuses to let pass |
|---|---|---|
| 1 | **Provenance settles a genuine tie.** Two rivals, relation names one. | Must APPLY, citing the relation clause. |
| 2 | **Preservation distractor OUTSCORES the target.** | The wrong concern must not win. Tests exclusion, not discount. |
| 3 | **Provenance does NOT settle it.** Both rivals named in the relation. | Must still ABSTAIN. Kills "the relation always wins". |
| 4 | **False relation.** A relation naming a non-analogue, plus an unrelated goal hit. | Must abstain. Raising relation authority must not manufacture applicability. |
| 5 | **Strict subset.** Concern has more participants than the delta requires. | The inflation control. Must nominate the required subset and justify each exclusion. |
| 6 | **No relation clause.** | The 3/3 non-overreach must not regress. |
| 7 | **Baseline positive.** One concern, no rival, plain analogy. | Provenance work must not break ordinary resolution. |
| 8 | **Rule 13 matching.** Operation counts matched across expected outcomes. | Outcome must not be confounded with transaction size. |

Controls 4 and 5 carry this milestone's real risk. Every previous regression arrived through the
mechanism that was supposed to be the improvement: **granting one clause more authority** is the shape
that converts abstention into confident error, and **pruning participants** is the shape that converts
coverage into misses.

---

## Anti-cheat

| Tempting move | Why it is disqualifying |
|---|---|
| Special-case a tie between two variant concerns | The defect is provenance collapse; a tiebreak leaves it intact and passes the test |
| Weight relation hits by a constant | A threshold to tune against the holdout; rule 3 |
| Segment clauses by this family's phrasing | An anchor inside a parser; rule 1 |
| Derive required roles from the reference patch or operation count | Rule 4 — that is the oracle returning through the precision layer |
| Prune participants by a similarity score | The same threshold problem, now deciding what a model may touch |
| Report sites without `reason_required` | Rule 5; a role without a witness was never admissible |
| Re-run the family after adjusting the selector | The family is then spent, exactly as v4's now is |

---

## What v5 still does not address

**Ordering and semantic intent.** Still oracle.

**Whether the legal-region layer can contribute information at all.** v5 targets positive information
gain, but if the honest answer for these program shapes is that current-program structure does not
narrow placement, the gain belongs to transaction topology in LegaCore and not here. That result would
be a finding, not a failure — and it must be reported as the former rather than engineered away.
