# Concern graph — Site Selection v2 foundation

**Development status. Not frozen, not validated.** The six sealed tasks are spent prospective evidence
and are now development/challenge data; nothing measured against them may be presented as validation.

## Why v1's abstraction was wrong

`featureGroups` assumed a feature lives inside one module-level function body. That was true of goals 64
and 74 and of nothing in the sealed substrate, so v1 abstained 6/6 and derived nothing at all.

A **concern** is program state plus every location that participates in it, with roles derived from what
each location DOES to the state:

    OWNER      declares or initialises it
    MUTATOR    writes to it
    CONSUMER   reads it
    REGISTRY   a module-level collection enumerating variants of it

Module level is a unit like any other, so module state and registries participate on the same footing as
functions — the generalization v1 lacked.

## What it now sees, where v1 saw nothing

    a01   OWNER Tally.__init__   MUTATOR Tally.add    CONSUMER Tally.count, Tally.total
    a02   OWNER Metrics.__init__ MUTATOR record_day   CONSUMER day_total, busiest_day
    b01   OWNER Stack.__init__   MUTATOR push, pop    CONSUMER peek, size

## Development numbers, on spent evidence

    a01  refs 2  cands 4  recovered 2/2  precision 0.50
    a02  refs 3  cands 4  recovered 3/3  precision 0.75
    a03  refs 4  cands 2  recovered 1/4  precision 0.50
    b01  refs 2  cands 5  recovered 2/2  precision 0.40
    b02  refs 3  cands 0  recovered 0/3   no concern found
    b03  refs 4  cands 0  recovered 0/4   no concern found

    pooled recall 8/18 = 0.444    inflation 0.83x      (v1: nothing derived at all)

## What the remaining failures say

**a03 (1/4).** Its concern is a VARIANT — the string `"quoted"` appearing in a registry, a formatter and
a dispatch branch — not a state symbol. Variant concerns are a second concern KIND the graph does not yet
model.

**b02, b03 (0 concerns).** Their state is a plain local (`result`, `out`, `pending`, `depth`) inside one
function, not an attribute or module constant. `stateSymbols` does not look there. These are also the
no-analogy tasks, so a v2 selector should ABSTAIN on them regardless — but it must abstain because no
relation is named, not because the graph is blind.

Both are missing generality, not missing special cases. Neither is fixed by naming a task.

## Two general defects found and fixed while building this

  * a class was listed as a participant alongside its own methods, double-counting the same lines. A
    container only participates if it touches the state outside its nested units.
  * `busiest_day` was classified MUTATOR because a loose "line contains `=`" test matched `key=lambda`.
    A keyword argument is not a write. A write is an assignment to the symbol, an indexed assignment into
    it, or a mutating method call on it.

## Before v2 can be measured

    1  model variant concerns and function-local state, as concern KINDS
    2  derive candidate sites from participant roles, with calibrated abstention
    3  FREEZE and hash the selector
    4  author a NEW holdout family under the construction rules, sealed before the selector sees it
    5  only then report coverage, true/false-apply, recall, precision, exact match, inflation

Coverage remains the critical metric. A cautious parser that abstains beautifully has not migrated
anything.

---

## Concern KINDS with role witnesses (`concernkinds.mjs`)

Every role now carries a deterministic witness naming the syntactic fact that produced it, so a role is
an auditable claim rather than a label:

    OWNER     binding assignment to the symbol
    MUTATOR   indexed assignment into the symbol / mutating method call on it
    CONSUMER  reference to the symbol with no write on the line
    REGISTRY  literal listed in a collection
    DISPATCH  literal compared in a branch test
    HANDLER   unit name carries the variant

Two kinds were added as KINDS, not cases. Nothing in the module knows about columns, comments, tallies
or stacks:

  * **variant / dispatch concerns** - a literal a program treats as a case. Admitted only when it
    participates in at least two DIFFERENT roles, which keeps ordinary repeated strings out.
  * **function-local state** - unified with attribute and module state. For local scope the participants
    are per-WITNESS, because the whole concern lives inside one unit and unit-level counting could never
    reach two.

### Three further general defects found and fixed

  * local symbols leaked across units: b03's loop index `i` matched another function's parameter `i` and
    fabricated a concern out of a coincidence. A local name is now confined to its declaring unit.
  * local concerns were discarded entirely, because one unit cannot be two participants.
  * one candidate per unit lost a unit participating at several lines - a03's module holds both the
    registry and the label map.

### A number that must NOT be banked

    pooled recall 13/18 = 0.722    inflation 1.61x     (v1: 0/18.  first concern graph: 8/18)

**This is not the metric, and it overstates.** Concern SELECTION is currently "the concern with the most
participants", which is task-free. On b03 that picks `state:i` - a loop index - and recovers 4/4 by
coincidence. Recall bought by an unrelated symbol is luck, and reported alone it would read as progress.

The selection rule is not a ranking heuristic to tune. **The concern must be chosen by the task's named
relation**, which is applicability's job - and b03 names no relation, so it should abstain and contribute
nothing at all.

### Order of remaining work

    1  applicability selects the concern from the named relation, or abstains with its reason
    2  candidate sites project from the selected concern's participant roles
    3  FREEZE and hash
    4  author a NEW holdout, sealed before the selector sees it
    5  report coverage, true/false-apply, recall, precision, exact match, inflation

Until step 1, any recall figure is measuring the wrong thing.

---

## Site Selection v2 pipeline (`selectv2.mjs`)

    task text
       -> RELATION EXTRACTION       "the same way as X" / "written like X" / analogy field
          no supported relation     -> ABSTAIN_NO_RELATION
       -> CONCERN RESOLUTION        map the named relation onto the concern graph
          none                      -> ABSTAIN_UNRESOLVED
          ambiguous                 -> ABSTAIN_AMBIGUOUS
       -> ROLE PROJECTION           OWNER / MUTATOR / CONSUMER / REGISTRY / HANDLER / DISPATCH
       -> participants + edges + candidate sites

**No fallback to "best concern".** If relation resolution fails, selection fails. Ranking concerns by
size is task-free and let a loop index nominate sites and score 4/4 by coincidence; removing the fallback
kills that at the right level, because `i` has no evidentiary relationship to the request and so never
earns authority to nominate anything.

### Informed abstention is now distinguishable from blindness

    b03   decision        ABSTAIN_NO_RELATION
          graph_visible   true
          concerns_found  ["state:i", "state:out"]
          named_relation  none

versus v1's `graph_visible: false, decision: ABSTAIN`. Both produce zero sites; only one of them knows
why. The audit record carries `graph_visible`, `concerns_found`, `named_relation`, `relation_source`,
`resolved_concern`, `resolution_witness` and `decision`, so correct-abstention-for-the-wrong-reason is
visible in the evidence rather than hidden behind an identical metric.

### The output is a SUBGRAPH, not a list

`sites = [A,B,C,D]` throws away what LegaCore needs next. A site set can be entirely correct and the
transaction still fail because the sequence is wrong - this project has already seen a technically
correct insertion placed after a `continue` and be dead. So v2 returns participants with roles and
witnesses, plus dependency edges derived from those roles:

    every non-OWNER participant depends on the OWNER    state must exist before it is written or read
    DISPATCH depends on HANDLER                         the branch calls the handler

Legal orders are topological orders of that graph - 6, 8 and 3 of them on a01/a02/a03. **Source order is
not the rule.** A helper may have to exist before its caller, state before its mutation.

### Ordering anti-cheat, fixed now rather than when ordering is tested

> Ordering is scored as *"did LegaCore produce a LEGAL TOPOLOGICAL ORDER of the derived dependency
> graph"*, never as *"did it reproduce the reference sequence"*.

The reference patch's authoring sequence is one legal order among several. Treating it as THE order
would smuggle the authoring accident in as a new oracle.

### Development numbers on spent evidence — NOT validation

    a01  APPLY   recall 2/2   precision 0.50   inflation 2.00x
    a02  APPLY   recall 3/3   precision 0.60   inflation 1.67x
    a03  APPLY   recall 2/4   precision 0.50   inflation 1.00x
    b01  ABSTAIN_NO_RELATION   correct
    b02  ABSTAIN_NO_RELATION   correct
    b03  ABSTAIN_NO_RELATION   correct

    applied 3/6    pooled recall 7/9 = 0.778    inflation 1.44x    system coverage 2/6

Every abstention is now correct AND correctly reasoned; every APPLY resolved the concern the task
actually names - a03 selects `variant:quoted` over the spurious `state:out` that size-ranking preferred.
Coverage is 2/6 because a03's set, while perfectly sized, misses two of its four reference lines.

## The scoreboard is not three independent boxes

    site selection  --feeds-->  ordering / dependencies  --feeds-->  local semantic intent

If LegaParse derives WHY each site participates, that explanation is where much of the ordering
information already lives. The roles and edges above are not a bonus output; they are the input to the
next migration.

---

## Multiplicity, extents, and witnessed edges

Three general rules added, none of them a task-specific case:

  * **participant multiplicity** — a participant is every independently witnessed occurrence performing
    a role, not one representative per role/unit. One unit may participate at several sites in the same
    role; compressing them is not recoverable downstream.
  * **extent projection** — a participant occupies a syntactic EXTENT, not a point. A new sibling belongs
    AFTER that extent ends (after a def's body, after a branch's body), not on the existing construct's
    header line.
  * **witnessed dependency edges** — every edge carries `dependency_kind` and `dependency_witness`, and
    an edge whose witness cannot be established is NOT emitted:

        state-before-use          line N accesses `sym`, bound at line M
        handler-before-dispatch   the branch at line N invokes `h`, defined at line M

    "all NON_OWNER depends on OWNER" is a heuristic that happens to produce reasonable topologies on
    development tasks. An edge is a claim about the program and needs the same evidentiary standard as a
    role, so LegaCore's future ordering computation sorts witnessed dependencies rather than role labels.

### Development numbers (spent evidence, NOT validation)

    a01  APPLY  recall 2/2   sites [2,5,8,11]    refs [3,12]
    a02  APPLY  recall 3/3   sites [2,5,8,12,13] refs [3,6,14]
    a03  APPLY  recall 3/4   sites [0,2,8,22]    refs [0,2,11,23]
    b01/b02/b03  ABSTAIN_NO_RELATION, all correct and correctly reasoned

    applied 3/6    pooled recall 8/9 = 0.889    COVERAGE 2/6

### A silent defect, and how it was found

`extentEnd` was non-functional from the moment it was written: its regex read `/^s*(?:def|class|...)/`
instead of `/^\s*(?:def|class|...)\b/`, because the backslashes were eaten passing through
shell-embedded JavaScript. It matched nothing and silently returned the input line, so the projection
rule was never in effect while appearing to be.

**I guessed at a03's cause twice before looking at the data.** Both guesses were plausible and both were
wrong; printing the source with line numbers next to the reference and derived sites found it in one
step. The instrument was reporting a number the whole time, which is what made guessing feel reasonable.

### The remaining a03 miss is a SCORING question, not obviously a defect

    derived site 8    after `_fmt_quoted`'s extent
    reference   11    after `label`'s body

Both are legal positions for a new module-level def. The reference's choice is an authoring accident,
exactly like the reference patch's operation SEQUENCE being one legal order among several.

**Recorded, not fixed.** Widening the tolerance until a03 scores 4/4 would be fitting to the holdout.
Site equivalence needs the same treatment ordering got — a definition of when two positions are
interchangeable, fixed BEFORE the next prospective run — and that definition must not be written by
looking at which positions a03 happens to need.

Until it exists, a03 is scored as 3/4 and coverage as 2/6.

---

## Site semantics: a site is a legal REGION, not a line (`siteclass.mjs`)

> Two candidate positions are SITE-EQUIVALENT for an operation when placing that operation at either
> position gives it the same structural parent, satisfies the same prerequisite/dependency constraints,
> grants the same scope visibility, preserves the same ownership and control-flow invariants, and does
> not change the externally observable semantics relevant to the contract.

**Anti-cheat:** `legalRegion` takes the program and the OPERATION'S REQUIREMENTS. It never sees the
selector's proposed position, so the class cannot be widened after the fact until the answer fits.

**Two metrics, never collapsed:**

    EXACT_POSITION_MATCH      derived boundary == reference boundary
    SITE_EQUIVALENCE_MATCH    derived boundary lies in the same legal region

Reporting only the second would hide that a03 was placed differently; reporting only the first pretends
textual identity is semantic correctness. This mirrors the ordering rule exactly: the reference sequence
is one legal topological order, and the reference position is one legal member of a site class.

### Witnesses — 8, both directions

    ADMIT   sibling def at two interchangeable module boundaries
    ADMIT   branch sibling at two boundaries inside one legal region
    ADMIT   after the last line of a body, at the outer indent == after that body
    REJECT  crosses a scope boundary (inside helper_a vs module body)
    REJECT  crosses a required definition/use dependency
    REJECT  placed after the provided symbol is already consumed
    REJECT  moves past a terminator, changing reachability
    REJECT  branch placed after the fall-through owner never runs

**Structural-parent identity had to become its own predicate.** A range check alone called positions
equivalent that belonged to different blocks - line 10 of a function is numerically inside a loop's legal
range and structurally in the function body. The terminator witness now rejects with
`different structural parent: for x in items: vs def run(items):` rather than by numeric luck.

**One of my own witnesses was mislabelled.** I wrote "crosses a scope boundary" for a case that was
actually an ADMIT: inserting after the last line of `helper_a`'s body *at module indent* IS the position
after that body. A real scope witness needs the insertion INDENT to differ, not just the line. It is now
both - an ADMIT for the boundary case and a REJECT for the genuine scope crossing.

### a03 rescored, with the caveat that matters

    derived 8   reference 11
    EXACT_POSITION_MATCH     false
    SITE_EQUIVALENCE_MATCH   true
    legal region             [0,25]  = the entire module

The equivalence is genuine: `_fmt_date` has no prerequisites and no existing consumer, so nothing bounds
it and any module-level position is legal. But **a region spanning the whole parent is a weak
equivalence claim**, very different from the branch case where the region was [2,8]. Region WIDTH should
be reported alongside the match, or "equivalent" quietly stops meaning much.

**The historical result is not rewritten.** a03 remains 3/4 and coverage 2/6 under the exact-coordinate
metric that was in force when it was measured. Rescoring under the new metric is a separate, explicitly
named number - and the scoring rule must be frozen before the next holdout exists.

---

## FROZEN: the two-axis scoring model

Frozen before the next holdout exists. Two questions the single flag was collapsing:

    is the proposed position semantically legal?   ->  POSITION RESULT, categorical
    how much did the analysis narrow the search?   ->  SELECTIVITY, continuous

    POSITION RESULT     EXACT | EQUIVALENT | INVALID
    SELECTIVITY         1 - legal_boundaries / parent_boundaries
    INFORMATION GAIN    log2(parent_boundaries / legal_boundaries)   in bits

A boundary is a position whose structural parent matches the operation's, so the denominator is the
search space the analysis actually faced rather than a raw line count.

**No third "WEAK_EQUIVALENT" state**, deliberately. That would need an arbitrary cutoff - is 90% of the
parent weak? 70%? - and the threshold would become the thing people optimise around. Semantic validity
stays categorical; selectivity stays continuous; neither needs a line drawn through it.

### Measured

    task                result       legal/parent   selectivity   info gain
    a03 new formatter   EQUIVALENT   26/26          0.000         0.00 bits
    branch in loop      EQUIVALENT    6/7           0.143         0.22 bits

a03: semantically valid, and the analysis supplied **no narrowing information**. Both facts reported
together, so nobody can read "equivalent" as "site selection nailed it" and nobody can call a valid
placement wrong for differing from the reference.

### A property of the denominator, stated rather than left to inflate later

Selectivity is measured **relative to the parent region**, so it excludes the information contributed by
identifying the parent. The branch case scores only 0.22 bits because, once you know it belongs in that
loop, the constraint removes one boundary - most of the narrowing happened when the loop was selected.
A whole-file denominator would credit that and report a much larger number.

The parent-relative denominator is the conservative choice and it is what is frozen. Anyone quoting a
larger figure later must say which denominator they used.

### Legal region vs canonical realization

    legal region            a PROGRAM FACT        "this helper may go anywhere at module scope"
    canonical realization   an ENGINEERING CHOICE  "place it immediately before the first dependent
                                                    construct"

Exactly analogous to ordering: there can be several legal topological orders, and LegaCore may pick one
deterministically without claiming the others are wrong. `canonicalRealization` implements the
convention and reports the region it came from, so the convention never gets mistaken for a constraint.

### Two coverage concepts, kept separate

    SEMANTIC COVERAGE     could LegaParse derive a legal site/region at all?
    INFORMATIVE COVERAGE  how much uncertainty did that derivation remove?

The second is not binarized. "This helper can go anywhere at module scope" is genuine program knowledge:
it tells LegaCore it need not care which boundary is chosen.

---

## Abstraction-defect sweep: three kinds of fact, kept separate

The sweep asked whether the implementation ever conflates:

    1  CURRENT PROGRAM FACT    scope, parent, ownership, reads/writes, existing control flow
    2  TRANSACTION FACT        operation B requires an artifact produced by operation A
    3  ENGINEERING CHOICE      among legal alternatives, place it here

### a03's unbounded region is NOT a LegaParse defect

`firstUse` returning "no bound" for `_fmt_date` is the correct current-program answer: the symbol does
not exist and nothing consumes it, so the whole module really is legal **at this stage of analysis**.
The remaining constraint comes from TRANSACTION topology - another planned operation dispatching to it -
which LegaParse deliberately does not know. Teaching the parser to anticipate future operations would
drag site selection into ordering and smuggle oracle knowledge back in.

So a03's 0.00 bits reads as: *current-program structure contributes no additional placement information;
transaction topology must supply the rest.* That is useful output, not a failure.

The three layers, now explicit:

    INTRINSIC LEGAL REGION        from the current program only
       intersect
    TRANSACTION-CONSTRAINED       requirements created by other planned operations   (LegaCore, later)
       then
    CANONICAL REALIZATION         one deterministic boundary from what remains

### Absence of constraint is now distinguishable from a constraint at EOF

`existingFirstUse` returns **null** when nothing bounds the symbol, instead of silently returning
`lines.length`. "No existing consumer imposes a bound" and "the bound happens to be the end of file" are
different facts and were being represented identically.

### A defect the sweep found — in a witness, not the code

One REJECT witness asserted that a module-level definition must precede a mention of it inside another
function's body. **That is false in Python**: a name is resolved when the enclosing function RUNS, so

    def use_it():  return helper()
    def helper():  return 42

is legal, and both placements are equivalent. The witness was manufacturing a false dependency from a
textual mention, and the code was right to reject it.

Fixed by distinguishing DEFERRED mentions from IMPORT-TIME uses, and the single bad witness became two
good ones:

    ADMIT    definition after a DEFERRED mention (resolved at call time)
    REJECT   definition after an IMPORT-TIME use (`RESULT = helper_a(1)` really does execute first)

Nine witnesses, four ADMIT, five REJECT, all passing.

### One conflation still open, recorded not fixed

`edgesFor` derives dependency edges among the EXISTING concern's participants, and those edges are then
used to reason about the ORDER of the NEW operations. The transfer is an inference - "the new feature's
parts depend on each other the way the existing feature's parts do" - not a program fact about
operations that do not exist yet. It is sound for parallel-feature tasks and should be labelled as a
transaction-level inference rather than a parse-level fact when LegaCore consumes it.

---

## Sweep results, run against the six substrate sources rather than asserted

Three suspects. Each was checked on real data, because "I read the code and it looks fine" is how the
last several defects survived.

### SUSPECT A — an engineering choice riding inside an evidence object. REAL, fixed.

A witness carried `line` (the program really does write the symbol here) and `site` (a new sibling
would go after the extent) as two peer fields. The first is checkable; the second is merely
defensible, and nothing in the shape said so. On the six sources the two values differ at **4 of 41
witnesses**, so the convention was doing real work while dressed as an observation.

Fixed by splitting them:

    line          fact_kind CURRENT_PROGRAM_FACT
    realization   fact_kind ENGINEERING_CHOICE + the rule it applied

The rename touches a field the selector reads, and the old reader had a silent fallback
(`w.site === undefined ? w.line : w.site`) that would have degraded quietly rather than failed. So
old and new trees were loaded side by side and compared: **6 of 6 tasks identical** in decision,
resolved concern and sites. Labels changed; behaviour did not.

### SUSPECT B — strongest-role summarization. UNDETERMINED, labelled, not fixed.

A unit whose witnesses support several roles is reported under the strongest one, so a unit that both
binds and reads the symbol shows as OWNER and its CONSUMER witness vanishes from `role`. The full list
survives in `witnesses`, so nothing is destroyed - but `role` alone is a convention, not the unit's
complete relationship.

The first measurement said **0 of 36 participants** collapsed, which reads as clean. It is not:

    participants with 1 witness    35
    participants with 2+ witnesses  1   <- only these could expose a collapse

The test could fire at most once and did not. **Zero observed collapses is not evidence of
correctness here**; it is an underpowered test reporting its own inability to fire. Recorded as
UNDETERMINED and settled by a source containing a genuine read-and-write unit, not by re-reading this
number.

### SUSPECT C — transaction inference presented as program structure. REAL, labelled.

`edgesFor` derives edges over the EXISTING concern's participants. Those edges are current program
facts and cite checkable lines. Applying them to the NEW operations - "the new feature's parts depend
on each other the way the existing feature's parts do" - is an inference about a transaction whose
operations do not exist yet. Sound for parallel-feature tasks, and not a parse-level fact. The output
now says so in `edge_scope`, so the inference cannot arrive downstream wearing the authority of
derived program structure.

### Freeze

`LEGAPARSE.frozen` seals eight files. a03 stands at EQUIVALENT, 0.00 bits.
