# INTEGRATION-1 — the handoff contract, and the three bars it must clear

**Date:** 2026-09-29 · **Cost:** $0, local · **Status:** protocol built and dual-written; **one of three
bars cleared**, and the other two are open.

## The thesis, stated as a hypothesis

Every expensive failure in this project has been a **handoff failure** — a truth at one layer
reconstructed, weakened, misnamed or ignored at the next. Not arithmetic, not model quality:

| what happened | where the meaning was lost |
|---|---|
| a requirement effect paired to a test **by array position**, order inverted | emitter → graph |
| two "independent" nodes secretly reading **one measurement** | graph → mutants |
| an assertion repeated in a state where correct and dead behaviour look identical | emitter → checker |
| an acceptance recorded for a page that **threw at load** | checker → policy |
| a suffix-recovery rule nearly **retrofitted** onto results collected before it existed | analysis → history |
| a policy correctly authorising a path **no real controller used** | policy → executor |
| a harness blaming the model for **its own boundary bug** | harness → conclusion |

The hypothesis is that these are one class, and that the fix is a **portable, evidence-carrying handoff
record** rather than more components. This is a research hypothesis, not a claim of novelty: blackboard
systems, tuple spaces, W3C PROV, in-toto attestations, event sourcing, MAPE-K, runtime assurance and
assurance cases all cover parts of it. What is claimed here is only that these pieces have not been
made to compound *in this project*, and that the protocol is the precondition for finding out whether
they can.

## The one rule

    FACT  ≠  CLAIM  ≠  PERMISSION  ≠  EFFECT

A model completion is a **fact**. "The feature is complete" is a **claim**. A governed token is
**permission**. A file write is an **effect**. No layer may recreate one of these from another
downstream. In `server/changeRecord.mjs` this is enforced at append time, not audited later:

- a CLAIM citing nothing is refused — that is the shape of every finding later withdrawn
- an EFFECT with no PERMISSION is refused, and so is one whose "authority" is really a fact
- a PERMISSION with no scope is refused
- an UNCERTAINTY with an undeclared type is refused — typed absence, never silence
- a **FACT cannot be superseded at all**: it was observed

## The three bars

The user's own framing, and the honest status of each. *If it cannot clear these, it is elaborate
bookkeeping.*

### 1. An outside checker can recompute why an action was retained or restored — **CLEARED**

`node server/changeRecordRecompute.mjs legasus/records/dualwrite-g1` → **6/6**.

It reads only the TASK, BASELINE and PROPOSAL facts, resolves every cited digest to bytes, **checks the
bytes against the digest**, then re-runs the whole pipeline — observe, derive, verify — and compares its
own diagnosis to the recorded one. It never reads the recorded graph or diagnosis before computing its
own; otherwise it would be agreeing with itself.

**The first attempt could not clear this bar**, and that is the useful part: the record stored digests
only, which makes it *attributable* but not *replayable*. Content-addressed blobs were added because the
bar failed, not because the design anticipated it.

**The negative control matters more than the pass.** `--negative` recomputes each record against the
*other* record's candidate. Both diverge (REJECT↔ACCEPT, node for node), which is what rules out a
recomputation that always agrees — this project has shipped a branch that could not fail before.

### 2. A failure is preserved as usable causal evidence, not merely a log — **PARTIAL**

Preserved: typed refusals (`UNOBSERVABLE_REPEAT`, `NO_UPDATE_ROUTE`, `NO_PERTURBATION`, …), the full
correction sequence, and every superseded claim in its original wording. `STALE_CLAIM` answers *"which
claims must now be replayed, narrowed or withdrawn"* mechanically rather than from memory.

**Not established: "causal."** Nothing has yet used a preserved failure to change a later outcome. Until
a preserved failure demonstrably alters a subsequent run, this is careful preservation, not causal
evidence, and must not be described as the latter.

### 3. It predicts, on held-out tasks, when a configuration beats a fixed default — **NOT ATTEMPTED**

This needs a comparative run with arms and a null, not a schema. Claiming it now would be exactly the
unearned claim the protocol exists to refuse. The measurement, when it happens, is marginal value in
context — `Δ(A | B, c) = outcome(A+B, c) − outcome(B, c)` — and the literature's warning applies: pairwise
tests misread systems with three-way interactions, so the arms have to vary the configuration, not one
knob at a time.

## The build order, and where it stopped

1. **Freeze the minimal schema, no new behaviour** — done, v1.0.0.
2. **Dual-write from existing components** — done: `changeRecordDualWrite.mjs` on g1/g3, two candidates
   each (a working one and an inert control). The emitter, observer, derivation and checker are
   untouched.
3. **Read-only replay** — done: `changeRecordReplay.mjs`, projections recomputed and never stored.
4. **Verify it catches known historical contradictions** — done: 26/26, each reproduced as a record
   written *as it would have been at the time*, detected without a reader remembering the mistake.
5. **Let one narrow effect path require the record** — **NOT DONE, deliberately.** Gating `governedEdit`
   now would mean testing the protocol and trusting it simultaneously. The dual-write runs emit **no
   AUTHORITY and no WRITE event at all**, because nothing in them was authorised to touch a file, and
   inventing a permission to make a record look complete is precisely the confusion being prevented.

## The asynchronous-specialists idea: recorded, not built

The evidence-gated blackboard — workers exchanging fresh, scoped, independently checkable claims instead
of prompts and summaries — is a coherent extension of this record and is **not implemented**. It is
attractive for a reason that is also a warning: it would be easy to build, demo, and never falsify.

Before any of it is built, it needs the comparison that would make it a finding: **does it produce more
verified progress than a simpler sequential baseline on held-out work?** No such comparison exists.
Nothing in this document licenses building coordination machinery.

## The ceiling that still applies

`GRAPH-VALIDITY-1_RESULT.md` records it, and nothing here lifts it: the loop is **closed-world**. The
emitter defines the task and the same ontology defines what counts as solving it. A change record makes
handoffs honest; it does not make the ontology right. **Internal validity only** — construct and external
validity are both unestablished, and a protocol that faithfully carries a wrong construct carries it
faithfully.

## What would falsify the thesis

- The record cannot express what a component already produces without inventing fields. *(Tested on
  g1/g3; it could. Untested on the model-calling paths, `campaign`, `managerRun`, `governedEdit`.)*
- The contradictions only fire on records hand-built to trip them. *(The positive control is the guard:
  a clean record must produce zero. It does.)*
- Gating an effect path on the record blocks work without preventing any real defect.
- Bar 3 comes back null — the record predicts nothing about when a configuration is worth using.

## Named next work, in order

1. Dual-write a **model-calling** run, not just hand-written candidates. The model call is the FACT the
   protocol most needs to carry, and it has not been exercised.
2. Make bar 2 real: a preserved failure that measurably changes a later run.
3. Only then consider step 5, on one path.
