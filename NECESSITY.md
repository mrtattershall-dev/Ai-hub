# ARCHITECTURAL NECESSITY

> **A component is not proven necessary because good results occurred while it was enabled. It is
> proven load-bearing when removing only that component causes the predicted failure.**

This file records, per stage, what happens when that stage alone is removed. Every entry is an
ablation on **recorded artifacts** unless marked otherwise: same fragments, same everything else, one
component neutralized.

**Neutralized means removed, not replaced by a helpful transformation.** An ablation that repairs the
proposal until the pipeline works without the component is measuring `component OFF + repair`, which is
a different and more flattering configuration. That mistake was made once here and is recorded as
hazard 3f.

---

## A note on commit order

The OBSERVE ablation RESULT (commit 7eaa1c2) landed in git AFTER the middle-family preregistration
(7de80d9) that cites it, because the result commit was queued behind a long-running job. The data was
observed and the analysis written first; only the commit is out of order. Recorded here rather than
left to look like a preregistration written before the result it responds to.

## The table

| Stage | Status | Evidence |
|---|---|---|
| `OBSERVE` | **Load-bearing** (middle family) | derived 229/233; blind-top 145/233 failing 86x PRESERVATION_BROKEN; blind-bottom **0/233** failing 233x NEW_DEAD. Earlier top-heavy family could not separate it: derived 624/692 == blind-bottom 624/692 |
| `DECIDE` | **Load-bearing** | same 105 transactions: derived order 105/105, presentation order **0/105**, every failure a named dead operation |
| `RENDER` | **Causal, requires regeneration** | semantic plan held fixed; `EXTENT` vs `SILENT` moved authorization precision 0.775 → 0.986 at 7B and 0.677 → 0.969 at 14B |
| `PROPOSE` | Stochastic backend | yield and realization strategy depend on model and rendering; correctness of the composition does not |
| `CONSTRAIN` | **Load-bearing as interface protection** | of 28 refusals: 14 do not load unchanged, 1 is a case `PROVE` would also catch, 6 exceed granted authority, 2 in-scope equivalents, 5 undetermined |
| `PROVE` | **Independent backstop** | 14 well-formed authorization leaks across families, every one rejected by execution before persistence |
| `COMMIT` | Untested | transactional persistence and rollback have no direct test yet |

## The asymmetry, and it is a property of the architecture

`OBSERVE`, `DECIDE`, `CONSTRAIN` and `PROVE` can be ablated **offline** on fixed artifacts: they
consume proposals without changing what proposals exist.

`RENDER` and `PROPOSE` alter the **distribution of artifacts themselves**, so their causal tests
require regeneration. That is not an inconvenience to work around — it is what distinguishes the
stages that shape the candidate pool from the stages that judge it.

---

## OBSERVE — first not established, then earned

### The middle family settled it

    model   authorized   DERIVED   BLIND_TOP  (preservation-broken)   BLIND_BOTTOM  (new-dead)
    1.5B        73          73        19            54                     0            73
    7B          80          77        54            25                     0            80
    14B         80          79        72             7                     0            80
    TOTAL      233         229       145            86                     0           233

Both blind policies fail for their predicted and OPPOSITE reasons. But `BLIND_TOP` survives 145 times,
and the diagnostic says why: it survives **exactly when the model wrote a self-defending guard** —
`n < 10 and n != 3` rather than plain `n < 10`.

    self-defending guard    OK 145    FAIL  2
    plain guard             OK   0    FAIL 86        p = 1.7e-62

So part of what `OBSERVE` protects against is absorbed by the model's realization strategy, and how
often depends on capacity — 26% of the time at 1.5B, 90% at 14B. **Without `OBSERVE`, correctness
becomes contingent on a stylistic choice the architecture does not control.** That is a sharper
statement of necessity than a score gap: the derivation removes a dependency on the model that would
otherwise stay invisible while capacity happened to be high enough to hide it.

The substitution runs **one way only**. A self-defending guard rescues a bad placement; no placement
rescues a guard whose domain is wrong.

### The earlier family, and why it could not separate it


    shape        fragments   DERIVED   BLIND_TOP   BLIND_BOTTOM
    S_UPPER         180        174        113          174
    S_LOWER         177        125         64          125
    S_IVAL          168        167         88          167
    S_STRADDLE      167        158         30          158
    TOTAL           692        624        295          624

`OBSERVE OFF` was frozen before any perturbation as *replace the derived location with a
task-independent policy that has no access to the relevant program fact* — **not** "choose a wrong
site", which would fail by construction and prove nothing. Two blind policies were used so a single
failure could not be an unlucky choice.

**The preregistered prediction was confirmed on both halves.** `BLIND_TOP` fails broadly: placing the
new guard ahead of the preserved one shadows it wherever the domains overlap. And `BLIND_BOTTOM`
succeeds **exactly as often as the derivation, in every shape**.

> In this family, `OBSERVE`'s derivation is necessary against a naive *top* insertion and contributes
> **nothing measurable** against a naive *bottom* insertion.

The reason is structural and was visible only once the numbers matched: **in all four shapes the
preserved behaviour sits at the top of the function**, so "append before the last line" automatically
satisfies "do not precede the preserved behaviour". The family cannot tell the derivation apart from
appending.

**What would establish it:** a program where the correct insertion point is in the **middle** — a
preserved behaviour that is not first, and a later existing guard the new behaviour must precede.
Neither blind policy can find that position, and the derivation must. That family does not exist yet
and is the next gate.

This is the deflationary entry in the table and it stays that way until such a family is run. `DECIDE`
earned its entry with 105 against 0; `OBSERVE` has not earned one.
