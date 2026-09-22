# Auditing the coverage assumption — G1..G8. Frozen 2026-09-21, before any attack is run.

## Why this comes before a bigger corpus

Steering 3 of the external experiment — *"eslint visited the whole file, therefore the domain was
covered exhaustively"* — is the premise **every acceptance rests on**. Finding an external violation
would satisfy a different requirement and would not touch this one.

**The immediate risk is that the adapter supplies the very premise Legasus appears to verify.**

## The exact meaning of the accepted claim, frozen

> Under **this** eslint version, **this** parser, **this** configuration and **this** enabled rule,
> **every member of the explicitly defined domain** satisfies the selected obligation.

## The domain, defined and frozen — and it is the narrow one

> **DOMAIN = the array-method callbacks that `array-callback-return` RECOGNISES, in files this
> configuration actually linted, under the pinned setup.**

Said plainly: it is **not** *all callbacks carrying this behavioural obligation*. A callback the rule
does not recognise is **outside the domain**, so the claim says nothing about it — and the claim is
correspondingly weaker than its English reading suggests.

**The domain is NOT defined from emitted diagnostics.** Defining it as "the callbacks that produced
no diagnostic" would make every clean result vacuously exhaustive, which is the failure mode this
audit exists to detect.

That leaves a gap which is now explicit rather than hidden: **the difference between the frozen
domain and the behavioural one is unmeasured**, and G8 measures it.

## The bridge under attack

    "eslint emitted no diagnostic for this rule"   ==>   "every domain member satisfies the obligation"

For each condition below the question is exactly one of three: **excluded** from the domain,
**reported as incomplete**, or **silently converted into acceptance**.

| arm | condition |
|---|---|
| **G1** | a file-level suppression comment disabling the rule |
| **G2** | a line-level suppression comment on the violating line |
| **G3** | a file excluded by the configuration's `ignores` |
| **G4** | a parse failure (the file is not valid JS under the pinned parser) |
| **G5** | a callback form the rule does not recognise, carrying the same behavioural obligation |
| **G6** | a file the caller never passed in — coverage asserted over a module that was not linted |
| **G7** | the rule is silently absent from the effective configuration |
| **G8** | the measured gap between the frozen domain and the behavioural domain, on one hand-built case |

## Predictions, committed now

- **G1, G2, G3, G4, G7: I expect SILENT CONVERSION INTO ACCEPTANCE.** The adapter filters eslint's
  messages to `ruleId === 'array-callback-return'` and treats an empty list as clean. A suppression,
  an ignore, a parse failure and a missing rule all produce an empty list for different reasons, and
  the adapter cannot tell them apart. **If that is what happens, steering 3 is falsified as stated
  and every acceptance in the external experiment is unwarranted as reported.**
- **G4 is the worst of them**, because a fatal parse error is a message with `ruleId: null` — the
  adapter's own filter discards it.
- **G5**: excluded from the frozen domain by definition, and that is precisely why the frozen domain
  is narrow. The arm records the gap rather than calling it a pass.
- **G6**: I expect the adapter to happily certify coverage of a module it never linted, because the
  coverage certificate is built from the file *name*.

## What this run may and may not do

- It **may not** repair the adapter. Whatever the attacks show is recorded first; a repair is a
  separate, separately frozen decision.
- It **may not** redefine the domain after seeing results.
- **No registry rules** (still 3 authored, 0/15). **S6, F2, `COMPLETE`, `INVALIDATE`** untouched.

## Also corrected in this run

The external result reported *"11 of 11 cases"*. **The denominator is 3 reserved cases + 8 untouched
external files = 11, and the development case is explicitly OUTSIDE it.** That is stated where the
count appears.
