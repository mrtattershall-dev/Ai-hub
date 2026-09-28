# Witness requirement modes — T0..T8. Frozen 2026-09-21, before any mode code exists.

## A correction to my own framing, recorded first

I ended the multiplicity run by posing exhaustion and requirement modes as a **fork**. They are not
alternatives; they answer different questions.

| mechanism | question it answers |
|---|---|
| exhaustion | have all potentially relevant supports within the specified replay frontier been exposed? |
| requirement mode | what supports would satisfy **this consumer's** obligation? |

And my gloss was wrong in a second way: completeness does not matter *only* where a designated
source is demanded. **Designation reduces the search**; it is uniqueness- and
disagreement-sensitive requirements that need a complete candidate set.

## What S6 actually established, restated precisely

A declared claim never becomes a token, and it never did. But it **controls when the system stops
looking**, and therefore can change what is admitted. *A non-authoritative input that gates
termination is a consequential control input.* S6 stays exactly as it is, as a regression
demonstrating the old boundary. This experiment does not rewrite it.

**And S6's significance is contract-relative.** Under today's rule — several eligible supports means
refuse — early commitment conceals a condition that should have prevented admission. Under an
explicitly EXISTENTIAL rule, a second agreeing support would leave satisfaction unchanged and the
same early commitment would be harmless. **Introducing the mode would change the semantics; it would
not show that the old completeness mechanism worked.** No arm here may be read that way.

## The modes to be frozen

| mode | satisfied by | does completeness matter? |
|---|---|---|
| `DESIGNATED` | resolving **that exact source**, and nothing else | no — designation *reduces* the search |
| `EXISTENTIAL` | **any one** admissible support that actually binds | no — a further agreeing support changes nothing |
| `COMPLETE` | a decision over the **whole** candidate set (uniqueness- or disagreement-sensitive) | **yes**, and that is the unsolved part |
| *(absent)* | **today's behaviour, unchanged** | as today |

**The default is not one of these three, and naming that is part of the result.** What the code does
today is a hybrid: try the designated address within its own origin; failing that, fall back to
candidates found by claim, requiring exactly one eligible, else refuse. It has never had a name.
T1 pins it byte-for-byte so introducing vocabulary cannot quietly move it.

### `COMPLETE` is expressible and not satisfiable today, and that is the honest outcome

A stalled pass establishes that **nothing can advance under the current scheduling rules**. It does
not establish that every possible supplier has been exposed — replayability itself depends on
consumers whose resolution is being postponed. So a `COMPLETE` witness must **refuse**, naming that
gap. **No exhaustion mechanism is built in this run**, and the frontier boundary it would need is
therefore not frozen here either: that is its own preregistration.

## Where a mode comes from — and where it may never come from

**A mode is a property of the OBLIGATION, resolved from this runtime's registry. It may never be
read from the certificate.** A producer declaring `EXISTENTIAL` on its own witness would be choosing
its own burden of proof — the exact defect v1.2 removed when it stopped producers supplying
`requires`. T7 attacks this directly.

Because **no registry rule may be added or changed in this run**, the experiment supplies modes
through an explicit **runtime policy** argument. Recorded hazard, in the open: this moves the choice
from the registry to the call site, which is *weaker* than the registry and is accepted only because
the alternative is editing frozen rules. The runtime author can still choose the burden; the
producer still cannot.

## The prerequisite the eligibility probe now owes

The multiplicity fix decides eligibility by **running `adapt` on a trial**. Discarding the returned
token does not by itself establish that the trial left nothing behind. **T0 tests inertness
directly**, and until it passes the probe may not be treated as a pure question.

## The arms

| arm | required observation |
|---|---|
| **T0** probe inertness | an eligibility trial adds no store entry, changes no record or provenance, and leaves no authority reachable elsewhere; candidate order does not change the admission; probing repeatedly does not change it |
| **T1** default unchanged | with no mode declared, every outcome of the merge and multiplicity suites is identical to today's, field for field |
| **T2** `DESIGNATED` | satisfied **only** by that exact source; a different, genuinely admissible, genuinely binding support does **not** satisfy it |
| **T3** `EXISTENTIAL` | one admissible binding support satisfies; adding a second agreeing support leaves satisfaction **unchanged** — no refusal, no amplification |
| **T4** `COMPLETE` | refuses today, naming that a stalled pass shows only that nothing can advance under current scheduling |
| **T5** scheduling vs obligation | under every input and depth order, `DESIGNATED` and `EXISTENTIAL` outcomes are order-invariant |
| **T6** S6 regression | with no mode, the concealment S6 found still occurs, unchanged. **And under `EXISTENTIAL` the same attack is inert** — which is a change of semantics, not a repair |
| **T7** mode is not producer-declarable | a certificate carrying a mode on its witness cannot change the mode used; the registry/runtime value governs |
| **T8** no amplification under `EXISTENTIAL` | with two supports, the licensed claim, scope, extent and currency are identical to the one-support case |

## Predictions, committed now

- **T0 is the one I am least sure of.** `adapt` calls `derive()`, which mints. I expect no *store*
  entry, because only `admitToken` files anything and the trial never calls it — but I do not know
  that the calculus keeps no reachable record of a minted token, and if it does, the probe is not
  inert and the multiplicity fix must be reconsidered rather than defended.
- **T1, T2, T3, T5, T8** I expect to hold.
- **T4** will refuse by construction; the arm exists to make the refusal say the right thing.
- **T6** I expect both halves to hold, and the second half is the one that must not be misread: it
  shows the mode makes the defect irrelevant for that consumer, **not** that the defect is fixed.
- **T7** I expect to hold, because the adapter already refuses certificate-supplied authority
  vocabulary — but the mode field is new and is not in the forbidden set, so this may fail.

## Forbidden in this run

No new registry rules and no edits to existing ones (still **3 authored, 0/15**). No exhaustion
mechanism. No freshness rule. No repair of the F2 boundary. No change to the default. S6 is not
touched. If `COMPLETE` cannot be satisfied, it refuses and that is recorded — nothing is built to
make it pass.
