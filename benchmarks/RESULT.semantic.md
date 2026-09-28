# r4 — SEMANTIC-1. RESULT: P-5 reached. A transform nobody pointed at was screened end to end.

Predictions frozen in `c66c89c`. Substrate: `legasus/legascreen/{semantic,contract}.mjs`, with the
observer made a parameter of `intervene.mjs`. Run: `node benchmarks/run-semantic.mjs` over the whole
existing test suite (90 files).

## P-5 — THE MILESTONE

    legaknow/calculus.mjs::derive
      DISCOVERED           by the brand-shape surface scan; no name supplied
      WITNESSED            from an existing test; no hand-written driver
      COUNTERFACTUALIZED   22 cells, all minted through the production constructors
      CONTRACT-RESOLVED    against legasus/legaknow/calculus.mjs @ 8988942c5701be7b
      SCREENED             INVARIANT_HELD

    coordinates measured   19      SCREENED  3   (held 3, violated 0)
    CHARACTERIZED          16      UNMAPPABLE 0

**"Human points to function" has left the pipeline.** What has NOT left it is the criterion: the
contract is still human testimony. The claim is precisely that the DRIVER is gone, not the contract.

## Roles, established from what each call DID

    transform                          PRODUCER TRANSDUCER CONSUMER NEITHER
    calculus.mjs::observe                    36          0        0       6
    calculus.mjs::derive                      0          8        9       1
    calculus.mjs::delegate                   11          7        7       0
    calculus.mjs::isAuthority                 0          0       21      13
    calculus.mjs::commit                      0          0        8       3
    calculus.mjs::tracesToIndependentRoot     0          0        2       1

`derive` is a TRANSDUCER on 8 calls and a CONSUMER on 9 - the same function, different roles, because
the role is a property of the call and not of the name. `observe` never consumes. `isAuthority` never
produces. None of that was told to the screen.

## Track C — consumer decisions, and the control that stops "always refuse" winning

    transform                          cells  measured  REQUIRED  IRRELEVANT
    calculus.mjs::derive                  74        26         4          22
    calculus.mjs::isAuthority             46        12         0          12
    calculus.mjs::delegate                37        13         6           7
    calculus.mjs::commit                  28         7         2           5
    calculus.mjs::narrow                  12         3         1           2
    calculus.mjs::tracesToIndependentRoot 15         2         0           2

    decisions UNCHANGED under a real perturbation : 50   C-2 CONTROL FIRED
    decisions CHANGED                             : 13

`isAuthority` at 0 REQUIRED / 12 IRRELEVANT is the positive control landing on real code: **no fact
of a token changes whether it IS a token.** A screen that convicted every perturbation would have
scored 12 findings there.

## THE FIRST RUN FAILED P-5, AND THE REASON WAS A DEFECT IN MY LAYER

    derive context.repository   observed SOME_OF(2/3)   UNMAPPABLE

I was counting the target's OWN configuration facts - `rule.name`, `claim` - as a third input group.
Two of three groups carried the coordinate, so every `derive` call in the repository came out
`SOME_OF(2/3)` and **ALL_OF was structurally unreachable**. The contract could never resolve.

The repair is structural, not a tuning: an input group is a node that a recorded call CONSTRUCTED and
handed in - the non-root nodes. The root's own scalars are facts about the operation, not premises of
an aggregation over premises. A regression test asserts the root really does carry leaves and that
they are still not a group.

**This is the sixth consecutive slice in which a control or a run found a defect in the instrument
rather than in the subject.**

## UNMAPPABLE is real, and had to be forced to fire

After the repair, UNMAPPABLE is 0 on the real tree - so it is a state never shown to work, which this
project does not accept. A control forces it: an observation of `SOME_OF(2/3)` against a specification
whose vocabulary has no such word resolves UNMAPPABLE, **not** coerced to UNKNOWN and **not** coerced
to the nearest available word. A capability gap in the specification is not evidence against the
subject.

    CHARACTERIZED   measured; no established contract says what it should be
    UNMAPPABLE      measured; the specification has no vocabulary for what we saw

## P-3 — self-ratification is blocked by construction

A contract carries `source`, `provenance`, `version`, `validAgainst`, and **is refused at
construction if any is missing**. `validAgainst` is a digest of the subject's bytes. Proven on real
bytes: a contract that convicts, then the implementation is edited, then the contract can neither
convict NOR absolve - it is STALE.

**The absolve half is the one usually forgotten.** Editing implementation and criterion together
cannot produce green, because editing the implementation invalidates the criterion by construction.

The structural gate still applies on top: an established, current contract asked to judge an
experiment that never ran returns INVARIANT_UNKNOWN.

## S-8 — module resolution as a coordinate, not an absence

    STATIC_LINKED   256
    DYNAMIC_LINKED    0
    UNRESOLVED        4      <- gray, not green
    RUNTIME_ONLY      NOT MEASURED

The four are `await import(<expression>)` call sites whose target acorn cannot establish. They are
UNRESOLVED, not absent. RUNTIME_ONLY is named and explicitly not measured by this slice.

## A note on a number that moved

The surface report now says 18 static candidates rather than SURFACE-1's 15. **The SUBJECT count is
unchanged at 10; the instrument grew from 5 to 8** because this slice added modules that call
`journey`. That is exactly why the subject/instrument split exists, and it is the screen counting
itself, not the repository changing.

## Not established

- **No differential comparison against the calculus as a specification, and no semantic bridge.**
  That architecture arrived mid-slice and is NOT in this frozen preregistration; it is preregistered
  separately rather than folded in after the fact.
- No backward/sink discovery, so the surface is still one-directional and CAVEAT stands.
- **The calculus is not wired into production**, and nothing here nudges it that way.
- The five prototypes remain unmerged.

    transforms SCREENED (mechanically, no driver)   1  (derive, 3 coordinates)
    transforms SCREENED (hand-driven, slice 2)      1
    previously unknown repository defects           0

Focused 15/15. Suite 661/661.
