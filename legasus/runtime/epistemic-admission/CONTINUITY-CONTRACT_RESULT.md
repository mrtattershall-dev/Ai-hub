# The governance decision, closed — D1..D6, and the X1 reproduction package

    6 new arms, all green.  175 -> 181 tests in this directory.
    `node repro-x1/reproduce.mjs` reproduces X1 from the production entry point alone.

## The decision, made

> **History-specific continuity refuses when its intended history cannot be distinguished from a
> replacement.** Under today's inputs that condition is **always** satisfied, so the default
> `HISTORY_SPECIFIC` contract refuses unconditionally.

> **`CONTENT_MATCH` is preserved as a separately and explicitly chosen contract.** It asserts
> *whichever record carries exactly this content may continue* — a **different claim**, satisfied by
> a byte-identical replacement **by design**. A governor choosing it has **accepted X1, not avoided
> it**, and the outcome records `chosenBy: 'GOVERNOR'`, never that this is how things work.

The refusal is not a theorem that such transfers are unsafe in general. It follows from *these*
inputs and changes the moment an independent binding exists.

## The cost, measured

**Eight arms moved when the default changed** — every one of them a transfer arm:

    C3, L2, L4, L5, L7, L8, X1, X3

Each now names `CONTENT_MATCH` explicitly at its call site, including across the child-process
boundary in L2. That is the measure: **every continuity transfer previously exercised in this suite
is refused by the new default.** The cost is not presented as solved by naming the other contract.

**The P-suite did not move**, because it measures the preserved specimen, which predates the
contract distinction. That asymmetry is the evidence the specimen is still isolated.

**My D4 prediction was wrong in both directions**: I predicted L2, L4, L8, C3, X1, X3 *and the
P-suite*. L5 and L7 also moved; the P-suite did not.

## The arms

| arm | outcome |
|---|---|
| **D1** default refuses | **held** — `INDISTINGUISHABLE_FROM_REPLACEMENT`, nothing inherits, obligation left unattached |
| **D2** X1's construction under the default | **held** — B gains nothing; under `INVALIDATE` the run refuses outright |
| **D3** `CONTENT_MATCH` chosen and recorded | **held** — transfers, `chosenBy: GOVERNOR` |
| **D4** the measured cost | **held** — eight arms, listed |
| **D5** governed, never requested | **held** — a requested contract is recorded, `requestAccepted: false`, and `null` stays distinct from `false` |
| **D6** co-presence still refuses under both | **held** — choosing `CONTENT_MATCH` does not re-open the containment |

## The reproduction package

`repro-x1/` is designed to be run and challenged by someone who did not author the mechanism.

- **`build-history.mjs`** builds one journal record and prints it. Run in a **fresh process** each
  time, so the two histories are separate **by construction** — not by cloning.
- **`reproduce.mjs`** uses the **production entry point only** (`replayMerged`); it imports no test
  helper, no specimen and no test entry point. It prints observations first and **conclusions
  separately**, and ends with an explicit instruction for challenging it.
- **Prior governor selection** is part of the construction: step 2 exercises the authorization while
  A, and only A, exists, and writes that selection to disk before B is introduced. `A !== B` is
  printed and explicitly labelled as **not** the basis.

Observed output:

    byte-identical                 : true
    same object in memory          : false   <- NOT the basis of this reproduction
    under CONTENT_MATCH, A and B produce the SAME outcome : true
    under the DEFAULT, the transfer is refused            : true

### One normalisation in the package, disclosed

The store's `nextRef()` mixes `Math.random()` into every address, so two processes running the
identical procedure produce persisted records differing **only** in an internal address that plays
no part in this test. Without pinning it, the first version of the reproduction printed
*byte-identical: false* and **reproduced nothing**. Admission uses the **real** address; only the
**persisted copy** is pinned, and nothing else is touched. Anyone challenging the package should
start by removing that pin and confirming the difference it makes.

## What has NOT been done

- **Nobody who did not author the mechanism has run it yet.** The package exists to make that
  possible; it does not substitute for it.
- **No independent binding was invented.** The missing input stands.
- **The external applicability experiment has not been run.** It is a separate milestone, and the
  registry still recognises **3 authored rules, 0/15** — unchanged and reported separately.
- **S6 untouched. F2 untouched. `COMPLETE` unsatisfied. H-IDENTITY-AUTHORITY at NONE.**
