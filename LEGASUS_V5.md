# LEGASUS v5 — EVIDENCE PROVENANCE

**Milestone specification. Written before any v5 code, and before the family that will test it.**
Vocabulary in [`LEGASUS.md`](LEGASUS.md); findings in `measurements/`; the preceding milestone in
[`LEGASUS_V4.md`](LEGASUS_V4.md).

---

## What v4's holdout established

The first prospective run of the frozen selector against a sealed, unseen family:

    no-analogue non-overreach      3/3 abstained          supported, small sample
    positive applicability         2/3 applied
    exact reference positions      5 of 5 scored operations
    candidate precision            NOT established        2/4 and 3/5
    informative narrowing          effectively absent     0.00 bits throughout
    new representation defect      relation provenance collapse

Two of those deserve to stay uncomfortable.

**Exactness is not narrowing.** Five positions matched the reference while the legal-region analysis
contributed 0.00 bits. Landing on the reference position and having analytically preferred it are
different events, and the two-axis score exists so they cannot be reported as one number. *Textual
coincidence with the reference is not analytical narrowing.*

**Precision is unresolved.** Both applying tasks nominated roughly twice the sites the reference used.
LegaParse has learned something about where a concern lives and still hands LegaCore an overcomplete
region of authority — which is the same failure the whole project keeps meeting, one level in.

## The defect

c03 abstained AMBIGUOUS with `variant:click` and `variant:key` tied at two hits each. The relation text
alone separates them perfectly: `key` appears in it, `click` does not. `resolve()` concatenates the
named relation with the entire goal into one haystack, so a token from the phrase that NAMES the
relation carries exactly the authority of a token from the goal's preservation clause — "the click and
key event types must keep working exactly as they do now."

The information was present. The representation destroyed it. This is not a missing heuristic.

And the development set could not have found it: a03 has the identical shape, but its source defines a
handler for `quoted` and none for `plain`, so `variant:plain` never entered the graph and no competitor
existed. **a03 scored a win on a mechanism it never exercised.**

---

## Success criterion

> **Evidence carries its provenance, and authority follows provenance rather than surface form. The
> selector must resolve c03-shaped tasks for the right reason, and must still abstain on tasks where
> provenance does not actually settle the question.**

The second clause is the whole criterion. A change that simply prefers whichever concern the relation
phrase names will resolve c03 and will also resolve cases it has no business resolving. That is a
tiebreak wearing a principle's clothes.

### The provenance tiers

    RELATION evidence        "written the same way as the existing key event type"
        the clause that NAMES the analogy
        -> HIGH AUTHORITY for CONCERN IDENTITY

    GOAL / DELTA evidence    the behaviour being added
        -> informs REQUIREMENTS; does not by itself nominate a concern

    PRESERVATION evidence    "the click and key event types must keep working exactly as they do now"
        the behaviour that must REMAIN
        -> MUST NOT nominate the target concern at all

The third tier is the sharp one. A preservation clause names things precisely because they are *not*
the target; treating a mention there as evidence FOR a concern inverts its meaning. Today it counts the
same as any other mention.

### The rule this instantiates

> **Evidence is not interchangeable merely because its surface representation is the same.**

The same string in two clauses is two different facts. This is the same separation the v4 sweep made
between `CURRENT_PROGRAM_FACT`, `TRANSACTION_INFERENCE` and `ENGINEERING_CHOICE`: there, a value's
authority depended on how it was derived; here, on where it was said.

---

## Construction rules, frozen

1. **The clause segmentation is general.** Relation / delta / preservation are identified by clause
   structure, not by matching the specific wording of these six tasks. A rule that keys on "must keep
   working exactly as they do now" is an anchor.

2. **Provenance is recorded, not just used.** Every hit carries the clause it came from and that appears
   in the audit record. A resolution that cannot say which clause gave it authority is not admissible —
   the same standard already applied to roles and edges.

3. **Preservation evidence is excluded from nomination, not down-weighted.** No tunable coefficient.
   A weight is a threshold in disguise and becomes something to optimise against the holdout.

4. **Abstention reasons stay distinguishable.** `ABSTAIN_AMBIGUOUS` after provenance separation is a
   different finding from `ABSTAIN_AMBIGUOUS` before it, and must be reported as such.

5. **The family is authored BEFORE the fix is written.** Sealed and committed first. A family authored
   after the implementation measures the implementation's shape.

6. **v2 is not edited.** The frozen selector stays frozen and its prospective numbers stand. v5 is a new
   component with its own freeze.

---

## Controls the new family MUST contain

A family that only contains c03-shaped tasks will confirm any change that prefers the relation. These
exist so the criterion can fail.

| # | Control | What it refuses to let pass |
|---|---|---|
| 1 | **Provenance settles it.** Two rival concerns; relation names exactly one. | The c03 case. Must APPLY, and the audit must cite the relation clause. |
| 2 | **Provenance does NOT settle it.** Two rival concerns BOTH named in the relation clause. | Must still `ABSTAIN_AMBIGUOUS`. Kills "the relation always wins". |
| 3 | **Preservation-only mention.** A concern named ONLY in the preservation clause, and nowhere else. | Must never be nominated. Tests tier 3 as an exclusion rather than a discount. |
| 4 | **False relation.** A relation phrase naming something that is not a structural analogue at all. | Must abstain. Raising relation authority must not manufacture applicability. |
| 5 | **No-analogue, unchanged.** Tasks with no relation clause. | The 3/3 non-overreach result must not regress. Provenance work is the most likely way to break it. |
| 6 | **Rule 13 matching.** Operation counts matched across analogy classes. | Class must not be confounded with size. |

Control 4 is the risk this milestone actually carries. Every previous milestone's regression arrived
through the mechanism that was supposed to be an improvement, and *giving one clause more authority* is
exactly the shape of change that converts abstention into confident error.

---

## Anti-cheat

| Tempting move | Why it is disqualifying |
|---|---|
| Special-case a tie between two variant concerns | The defect is provenance collapse; a tiebreak leaves it intact and passes the test |
| Score relation hits higher by a constant | A threshold to tune against the holdout; rule 3 |
| Segment clauses by matching this family's phrasing | An anchor inside a parser; rule 1 |
| Report resolution without the clause that authorised it | Rule 2; a role without a witness was never admissible either |
| Re-run the family after adjusting the selector | The family is then spent, exactly as v4's now is |

---

## What v5 does NOT claim to address

**Precision.** Nominating twice the required sites is untouched by provenance: it is about which
participants of a resolved concern deserve to be sites, not which concern gets resolved. It stays open.

**Informative narrowing.** 0.00 bits is a statement about legal regions, not about resolution. Whether
site analysis can contribute information at all is a question for LegaCore and transaction topology.

**Ordering and semantic intent.** Still oracle.
