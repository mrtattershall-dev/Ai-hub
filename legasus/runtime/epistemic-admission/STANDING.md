# Standing of the epistemic-admission work — what is established, and at what strength

Written 2026-09-21 after an external review of a summary report found that it **graded its evidence
more strongly than its own definitions allow**. The four corrections below are applied here and are
the authoritative statement where they conflict with a heading elsewhere in this directory. The
reviewed report itself is not in this repository; these corrections are recorded against the
underlying claims, which are.

    159 tests across fourteen suites in this directory. All green.

## Correction 1 — "MECHANIZED" means a check that prevents the mistake, nothing less

This work uses **MECHANIZED** for the moment a rule stops being a rule and becomes a gate. By that
definition:

| act | what it is |
|---|---|
| a commit hook refusing a message whose file does not match | **mechanized** — the mistake cannot recur silently |
| an arm that fails if an outcome's subject was never produced | **mechanized** |
| a mutant run that asserts the mutation applied before running | **mechanized** |
| **preserving a failed prediction** | honest practice, **not** mechanized |
| **narrowing a claim after review** | honest practice, **not** mechanized |
| **recording a hazard in a result document** | honest practice, **not** mechanized |

Several places in these documents describe the second group in language borrowed from the first.
They are valuable and they are not safeguards: nothing prevents the next document from overclaiming
again. **Preserved failures are evidence about this run; they are not protection against the next
one.**

## Correction 2 — headings that exceed their evidence, restated with their qualifiers

**"A replacement copying identity inherits nothing" → requires L3's content qualification.**
L3's impostor is a *revision*: it copies the ref, the origin label and the whole continuity
assertion, and its content differs. The mutation table shows L3 is **not** sensitive to the origin
check — the *origin ignored* mutant is caught by **L6 only**. So the demonstrated claim is: *a
replacement whose content differs from the authorized content inherits nothing.* Whether a
**byte-identical** replacement is excluded rests on the origin, and that is L6's evidence, not L3's.

**"Merging manufactures nothing" → the tested-arm boundary belongs beside the headline.**
The established claim is: *under M1..M10, no combination of journals produced authority neither
history justified, and every new establishment traced to a named, independently admissible record.*
Merging was tested with two or three journals of one or two records each. Nothing establishes the
behaviour at a scale where readiness waves interact with many claim-level candidates.

**"Replay recovers exactly what re-execution justifies" → in this process family.** Nothing crossed
a language boundary; the bridges remain a research instrument, not transport.

## Correction 3 — historical mutant survival is not current coverage, and an inert mutant is neither

Both facts are preserved, and they are different facts:

| mutant | then | now |
|---|---|---|
| *several records establish the claim: pick the first* | **survived** the frozen M1..M9 arms | **caught by M10**, added afterwards and labelled as added afterwards |
| *remap keyed by bare ref* (first attempt) | reported as surviving | **it never applied** — a NUL separator made the replacement miss. Not evidence of anything about the suite |

Two distinct conclusions follow and must not be merged:

- A gap in the **frozen** arms is a fact about the preregistration's coverage. It stays on the record
  even after a later arm closes it.
- **An inert mutation is not evidence of suite insensitivity.** It is evidence of a broken harness.
  Every mutant run now asserts the mutation applied before the suite runs; that assertion *is*
  mechanized, in the strict sense of Correction 1.

Nothing here should be summarised as "one surviving mutant, OPEN". The accurate form is: *one gap in
the frozen merge arms, since exercised by M10; one harness failure, since mechanized.*

## Correction 4 — what disclosure does and does not establish

Disclosing failed predictions, preserving ugly results and narrowing claims **improve the
credibility of the reports**. They do **not** independently validate the mechanisms. The evidence
for the mechanisms is the arms, the controls and the mutants — all of them internal experiments on
fixtures and code authored here. **External generalization is unestablished.**

## The most consequential weakness, stated plainly

**Enforcement quality and practical coverage are different things, and only the first has been
built.** There are substantial checks — obligation modes, governing versus requested channels,
occurrence-bound governance, authorized continuity, whole-run invalidation — around a registry that
recognises **3 authored rules and 0 of the 15 sampled historical inference obligations**.

Expanding independently tested applicability is therefore a **different milestone** from
strengthening enforcement, and progress on the second should never be reported as progress on the
first.

## What would actually raise the standing of this work

Applying it successfully to obligations and systems **not designed to fit it**. More internal arms
increase confidence in the arms. They do not increase the range of things the machinery has been
shown to govern.

## Named limits currently on the record

- **U8** establishes *no observed filing and no address exposure through the supplied store and the
  returned result*, and its suppression mutant shows invalidation precedes those effects. It does
  **not** exclude every transient mint or other escape channel; that would require observing those
  channels.
- **The L5 fork arm tests defensive behaviour on a synthetic state.** Under the current construction
  rules, naturally arising competing successors were **not** demonstrated — content includes the ref
  and merge collapses identical entries under one origin. That is a representational boundary, not
  evidence that real forks are resolved.
- **S6 stands**: a declared claim still gates termination, for multiplicity-sensitive decisions and
  for existential search termination.
- **`COMPLETE`** is vocabulary without a mechanism.
- **Registry ownership is not established**; the governor is still the call site.
- **Origin assignment is unconstrained**, and A6 shows what that costs.
- **H-IDENTITY-AUTHORITY** stays at **NONE**. **F2's undecidable premise** is untouched.
- The threat model is **carelessness**. No claim is made against a malicious governor or against
  cryptographic impersonation, and no signature scheme was invented to imply one.
