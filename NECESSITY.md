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
| `OBSERVE` | **Load-bearing — robustness independence** | derived 229/233; blind-top 145/233 failing 86x PRESERVATION_BROKEN; blind-bottom **0/233** failing 233x NEW_DEAD. Earlier top-heavy family could not separate it: derived 624/692 == blind-bottom 624/692 |
| `DECIDE` | **Load-bearing, and the cost is SPECIFIC** | same 105 transactions: derived 105/105, presented **0/105**. And the specificity family, paired on identical fragments: **disjoint 0/54 broken, constrained 162/162 broken** (p = 2.8e-52). No realization ever substituted — 0/648 guards defended against a sibling operation, at any capacity |
| `RENDER` | **Causal in BOTH directions, requires regeneration** | semantic plan held fixed; `EXTENT` vs `SILENT` moved authorization precision 0.775 → 0.986 at 7B and 0.677 → 0.969 at 14B. And it can do the same damage in reverse: naming a true but unresolved sibling fact caused `DOMAIN COLLAPSE` and took `P(correct\|assembled)` from 1.000 to 0.050. **A rendering is not neutral, and more is not better** |
| `PROPOSE` | **Substitutable stochastic backend — no necessity claim, by design** | swapping 1.5B → 7B → 14B changes proposal yield, realization strategy and failure distribution while the downstream authority semantics stay fixed. A necessity result for any particular model would contradict the architecture rather than support it |
| `CONSTRAIN` | **Load-bearing as interface protection** | of 28 refusals: 14 do not load unchanged, 1 is a case `PROVE` would also catch, 6 exceed granted authority, 2 in-scope equivalents, 5 undetermined |
| `PROVE` | **Independent backstop** | 14 well-formed authorization leaks across families, every one rejected by execution before persistence. And the strongest case, which nobody designed: 110 transactions carrying the **wrong contract** (`DOMAIN COLLAPSE`) — `CONSTRAIN` refused 14, `PROVE` rejected 96, **leaked 0**, while `P(correct\|assembled)` fell to 0.050 |
| `COMMIT` | **Load-bearing for atomicity** | complete transaction persists the verified candidate; op2 failing returns the surface byte-for-byte to S0; with rollback ablated the independently correct op1 PERSISTS as unauthorized partial state |

## SEMANTIC LEAST PRIVILEGE — a first-class hypothesis, and it needs no capacity claim

The rendering ladder separated what about a sibling fact is harmful:

    condition          P(correct|assembled)   guards containing a sibling   captured
    ISOLATED                 1.000                     237                   0   0.0%
    SIBLING_EXISTS           0.996                     240                   0   0.0%
    SIBLING_NAMED            0.550                     236                 125  53.0%
    SIBLING_RESOLVED         0.772                     239                  68  28.5%

**Being told other operations exist is harmless. Being told what they MEAN is what does the damage**
(`p = 8.6e-49`). The hazard is foreign semantic content, not additional text.

**CROSS-OBLIGATION CAPTURE:** an operation with domain `D_A`, shown another operation's domain `D_B`,
begins implementing `D_B`. `low`, asked for `n < 10`, wrote `n < 0`. The defensive form the architecture
originally predicted occurred **once in 952** eligible guards.

Resolving the relationship repairs it **only above a capacity threshold** — a crossover interaction, with
both directions significant:

    P(correct|assembled)      1.5B       7B       14B
    ISOLATED                 1.000     1.000     1.000
    SIBLING_NAMED            0.328     0.925     0.338
    SIBLING_RESOLVED         0.023     0.975     0.975      capture 66/80, 2/79, 0/80

    1.5B   19/58 -> 1/43     p = 8.5e-5     significantly WORSE
    14B    27/80 -> 78/80    p = 2.9e-19    cured, capture to ZERO

The conclusion does not rest on any of that, though, which is what makes it solid: **`ISOLATED` is optimal
at every capacity tested and no condition exposing foreign semantics beats it anywhere.** A dominance
result, not a comparison of means.

> Legasus may know everything — domains, containment, precedence, ownership, preservation, transaction
> structure. Each `PROPOSE` call receives only the semantic facts required to discharge the authority it
> was granted. **Composition knowledge belongs to `DECIDE`, not automatically to `PROPOSE`.**

This reframes `R4`: proposing each operation in isolation was adopted as a simplification and now looks
like **necessary isolation** — no model was ever given the chance to confuse semantic ownership. And it
gives `RENDER` a second obligation mirroring the one `sufficiency.mjs` enforces:

    SUFFICIENCY      does the prompt contain every fact required for the authorized operation?
    NONINTERFERENCE  does it OMIT semantic facts belonging to other operations?

Both are now mechanized — `legarender/noninterference.mjs`, with admit cases taken from the prompts that
measured `1.000` and catch cases from the prompts that produced the capture.

### Capture is TWO phenomena, and which one you have is a property of the model

The counterfactual family stated the **same sibling domains** and changed only their relevance —
`IN_CHAIN` ("same function, same chain") against `ELSEWHERE` ("a different function; does not affect your
condition"), same shape, same position, near-identical length.

    capture              1.5B       7B        14B
    ISOLATED            0/79       0/80      0/80
    IN_CHAIN           51/78       5/80     63/80        replicates at 50.0%
    ELSEWHERE          40/79       0/80      0/80

    14B    63/80 -> 0/80     p = 8.2e-29    eliminated entirely, P(correct) back to 1.000
    1.5B   51/78 -> 40/79    p = 0.076      NOT significant - it persists

    composition-linked capture   the model misreads a REAL relationship   fixable by framing, at capacity
    surface capture              a narrower same-shape bound is COPIED    not fixable by framing

At 14B the model narrows itself because it believes the sibling constrains it, and stops the moment it is
told otherwise. At 1.5B, 33 guards still wrote `n < 0` for an operation asked for `n < 10` **after being
told in the same prompt that `n < 0` belongs to a different function**. Only the first is a reasoning
error; the second is interference, and no amount of correct explanation removes it.

**This does not weaken the rule — it is the third independent measurement of the same dominance.**
`ISOLATED` is 1.000 at every capacity again; the best rival reaches 1.000 only at 14B and 0.429 at 1.5B. A
rendering rule that works only above a capacity threshold is not one the architecture can rely on,
because the architecture's claim is that the proposal source is **substitutable**.

## The law that keeps emerging

> **Anything with the authority to reject must prove that it can admit legitimate alternatives.**

It has now been paid for four times. `PROVE` learned it when `n <= 10` turned out to be correct.
`CONSTRAIN` learned it when `elif` refusals suppressed yield across every model at once. The text guard
learned it when its first version flagged 25 things and all 25 were false positives. And `COMMIT`'s
own hard-failure invariant had to be witnessed directly rather than by arranging a real rollback
failure, because a guard whose firing can only be shown by breaking the thing it guards is a guard
whose firing is assumed.

## COMMIT — what the ablation shows

    complete transaction            -> state changes exactly to the verified candidate
    op1 succeeds, op2 fails         -> BYTE-FOR-BYTE return to S0, creation undone
    assembly fine, verification no  -> return to S0
    ROLLBACK ABLATED                -> the independently correct op1 REMAINS on disk

The fourth line is what makes the first three evidence rather than assumption: the experiment can
detect partial persistence, so its absence under atomic mode means something.

**`op1` is good code.** Had anyone asked for it alone it would be a fine change. Nobody did — and that
is the whole claim: *a locally correct change is still wrong to persist when it belongs to a
transaction that did not complete.* Without that, rollback would only be saying "we removed the broken
thing".

**An interface contract, not a caveat.** The manifest and the rollback see only the **declared writable
surface**. A file created outside it is invisible to both — it will not appear in the state comparison
and it will not be removed by a restore.

    COMMIT guarantees atomicity over the declared writable surface, and only over it.

That is a boundary with an owner: **completeness of the surface is an upstream obligation.** `COMMIT`
can atomically restore everything it was told exists; it cannot prove the caller told it everything.
Hiding that would make the atomicity claim broader than the mechanism. Stating it makes the obligation
assignable — and a test asserts the limitation explicitly, so it is documented behaviour rather than
something a later family discovers the hard way.

**The frozen boundary:** `PROVE` decides whether a candidate deserves persistence; `COMMIT` decides
whether persistence is atomic. `COMMIT` never computes a verdict — a test asserts it asks exactly once
and never second-guesses.

## DECIDE — why a perfect score needed a specificity test, and what it turned into

`105/105 → 0/105` showed that `DECIDE` **can** matter enormously. It could not show that `DECIDE`
matters **only when it logically should** — and a result that total is also what a broken ablation looks
like. Building the control found that it partly was: deadness was computed from the plan and never from
the program, and the probe expectations were recomputed from the presented order, so the broken program
was graded against a broken expectation. One term could not vary with the code; the other was blind.
Both are fixed, and the original result is unchanged under the repaired instrument.

Then the specificity family, four transactions presented in an order violating 0, 1, 2 and 3 derived
edges:

    violated edges      0        1        2        3
    DECIDE ON          54       51       55       56
    DECIDE OFF         54        0        0        0
    broken           0/54    51/51    55/55    56/56

**The damage lands exactly where derived precedence exists and nowhere else.** `E0`'s presented order
genuinely differs from its derived order, so the disjoint file really was rebuilt a different way and
verified anyway — the anti-oracle property holding in the place it matters.

### The dose-response was predicted and did NOT appear, which turned out to be the better result

The response is a step, not a gradient. The preregistration named the only mechanism that could produce
a gradient — a realization defending itself against a violated edge — and proved the apparatus could
register it before any tokens were spent. It never occurred: **rescued 0/216**.

Not because these models cannot defend a guard. They did it 167 times. Every single instance was the
same clause:

    167x   n != 3     defends the PRESERVED behaviour, which every prompt names
      0x              defending against a SIBLING operation

    model     guards   defends the NAMED fact   defends an UNNAMED sibling
    1.5B        168         28/58   48%                     0
    7B          240         62/80   78%                     0
    14B         240         77/80   96%                     0

> **A realization can defend itself only against facts its own prompt names. Cross-operation precedence
> is exactly the fact no single operation's prompt can contain, because it is a property of the
> transaction rather than of any operation.**

That is why this is a stronger necessity claim than the 105/0 was. `OBSERVE` found the model's
realization strategy substituting for the architecture 145 times, making correctness contingent on style
and on capacity. Here the substitution is **structurally unavailable**, and a 9x parameter range does not
begin to buy it while buying compliance with the named fact twice over.

### Then the law was tested and it was wrong

The obvious next move was to name the sibling facts and see whether defence appeared. It did not.
**Exclusion — carving a sibling's domain out of your own — occurred 0 times in 1429 guards, in every
condition and at every capacity.** What appeared instead was the opposite operation:

    guards whose own domain CONTAINS a sibling's   EXCLUDED it   ADOPTED it
    ISOLATED                        232                 0            0    0.0%
    SIBLING_NAMED                   239                 0          127   53.1%     p = 4.0e-48

**DOMAIN COLLAPSE.** Told that a narrower behaviour is requested inside its own domain, the wider
operation *replaces its own domain with the sibling's*. `low`, asked for `n < 10`, wrote `n < 0` 89
times. Never the reverse: `micro` wrote `n < 0` 235/235 in both conditions. The damage lands in the
**healthy** arm, because the derived order places the narrow operation first and the collapsed guard is
then unreachable — `P(correct|assembled)` fell from 1.000 to 0.050 at 14B on `E1`.

Capacity does not protect: 1.5B 73%, 7B 6%, 14B 80%. The largest model is the most affected. That
non-monotonicity is recorded as observed and **not explained**; one three-point curve does not earn a
mechanism.

> The missing thing was never the fact. Handing over `DECIDE`'s **inputs** without `DECIDE`'s
> **conclusion** does not give the model a usable premise — it gives it an **ambiguity**, and the model
> resolves that ambiguity by collapsing its own contract onto its neighbour's.

Two overlapping domains do not by themselves say whether an operation should narrow itself, exclude the
other, or do nothing. Choosing among those **is** `DECIDE`. So the stage is not a convenience supplying
information the model lacks, and it is not work a larger model absorbs — handing over its inputs made
every model worse and the largest model worst.

It also sharpens what `RENDER` owes: **stating more is not the same as stating what is decidable.** A
rendering that adds a true fact the model cannot resolve is not neutral. Here it cost up to 95% of
correctness.

### And it produced the best test of the whole architecture so far, by accident

`DOMAIN COLLAPSE` was not designed — the rendering produced it. It is a failure mode no previous family
had generated, because every earlier failure was a wrong *implementation* of the right contract, and this
is the right implementation of the **wrong contract**.

    transactions containing at least one collapsed contract
    SIBLING_NAMED   110     CONSTRAIN refused  14    PROVE rejected  96    LEAKED  0

**Zero leaks.** `P(correct | assembled)` fell as low as 0.050; `P(correct | verified)` stayed 1.000. The
proposal source got dramatically worse in a new way and the commit guarantee did not move — which is the
whole of `ATTEMPT AUTHORITY != COMMIT AUTHORITY`, tested under conditions nobody chose.

It is not circular: the probes come from the **contract**, never from the proposal. A collapsed `low`
fails because the contract requires an answer of `"low"` at `n = 5` and the program does not give one.

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
