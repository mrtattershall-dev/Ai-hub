# Mode authorization — result. A1..A6 against `MODE-AUTHORIZATION_PREREG.md`.

    6 arms, all green.  132 -> 138 tests in this directory.  5 mutants run, 5 caught.

## The answer, with its boundary attached

> **Under the tested separation, a requester cannot override the governing obligation supplied by
> the call-site governor.**

That is the whole claim. It does **not** establish who may act as governor, nor that governance
remains attached to the intended record across runs — the latter is now the named next boundary.

A requested mode that differs from the governing one is refused as a substitution and recorded as
refused, in words: *the party seeking admission does not choose which burden applies*.

**What "asking changes nothing" means, exactly.** It is the **admission projection** — state,
minting, binding, supply and the enforced mode — that is identical whether or not a request was
made. The obligation record is deliberately *not* identical: the request is documented. And
**refusing the request is not refusing the admission**: A1 carries a case where the admission
succeeds while the request to change the burden is still refused.

## The trust decision, and the claim it does and does not support

The preregistration took **position 2** — the runtime enforces an independently fixed obligation —
because every step of this sequence has removed a path by which the admitting party chooses its own
burden (`requires` in v1.2, rule authority in v1.3, the producer-declared mode in T7). A caller sits
closer to the producer than to the registry.

**The honest limit, restated because it is easy to overclaim:** no registry rule could be added or
changed in this run, so the governing obligation is still supplied at the call site. What was built
is **separation** — two channels, only one of which decides, with the deciding one named in every
outcome. **That is a smaller claim than registry ownership and is not reported as it.** Moving the
field into a registry would help only if the registry's ownership and enforcement actually establish
the boundary, and that is not established here.

**No strength lattice was invented.** `DESIGNATED`, `EXISTENTIAL` and `COMPLETE` are not totally
ordered. The rule is not "refuse weaker requests" but "refuse any request that differs". Sameness is
decidable; strength is not.

## Arm by arm

| arm | outcome |
|---|---|
| **A1** `DESIGNATED` → `EXISTENTIAL` by asking | **held** — the substitute is genuine authority for exactly the needed claim and still cannot satisfy a designated obligation. `obligation.mode = DESIGNATED`, `requested = EXISTENTIAL`, `requestAccepted = false` |
| **A2** caller omits the mode | **held** — silence does not fall back to the unnamed default, and `requestAccepted` is `null` rather than `false`: *no request* is not the same value as *request refused*. With a **control** proving the refusal is the obligation doing work: without governance the same journal succeeds |
| **A3** replay under a different obligation | **held** — a contract fingerprint over the governing tables; identical states under different obligations are **not** presentable as the same admission |
| **A4** merge combines different modes | **held**, and it needed the work predicted: governance is now keyed per record by `(origin, ref)`, which is **merger-assigned**, so a consumer cannot name its own key. Two consumers needing the same claim string, governed differently, are enforced separately |
| **A5** honored in only one branch | **held** across all five paths — `REFERENCE`, single-candidate `CLAIM`, multi-candidate `CLAIM`, the default refusal and the `COMPLETE` refusal. The default reports `mode: null`: *the default is not a mode and is not named one* |
| **A6** origin stability | **hazard demonstrated, not repaired** — see below |

## A prediction I could not actually test, and how it was tested instead

I predicted **A3 would fail** because nothing recorded which obligation contract an outcome was
produced under. It passed — because I implemented the contract fingerprint in the same change, so
the arm never observed the state I predicted. **That is a prediction about code I then wrote, which
is not a prediction.**

The predicted failure is instead demonstrated by a mutant: *obligation contract not recorded*
reproduces exactly the pre-implementation state, and A3 catches it. That is weaker evidence than
observing the failure in a real run, and is labelled as such.

## A6: the hazard T5's fix depends on, demonstrated

T5 fixed provenance drift by choosing supports in a stable order over `(origin, ref)`. **Origins are
merger-assigned**, so that order is only as stable as the assignment. With hand-chosen labels the
chosen support does not move under permutation. With **position-derived** origins it moves again —
the same provenance dependence T5 removed, wearing different labels.

And the sharpest part: **the origin label was identical in both runs (`origin-0`) while the record
it named was different.** A position-derived label conceals the very movement it causes, so the
provenance *reads* stable while the support underneath has changed. Recorded as a hazard of origin
assignment — which the merger owns and this contract does not constrain — and not repaired here.

## Mutation table

| mutant | caught by |
|---|---|
| the requested mode governs when supplied | A1 |
| `requestAccepted` always true | A1, A2 |
| obligation contract not recorded | A3 |
| per-record governance ignored (collapse by relation) | A4 |
| obligation dropped from the `REFERENCE` path | A3, A5 |

## One apparatus defect, preserved

A6's first version compared `supply[0].origin` and got `origin-0` both times, reporting no
difference where the record had plainly moved. **Tenth wrong-referent instance**, and the one that
made the finding sharper rather than weaker: measuring the label instead of the record is precisely
the mistake the hazard itself induces in anyone reading the provenance.

## What is still not shown

- **Registry ownership is not established.** Governance is separated from request, not relocated to
  an owner whose authority is itself demonstrated.
- `COMPLETE` remains vocabulary without a mechanism, and its frontier boundary is still unfrozen.
- **S6 is untouched and still stands**: the declared claim still gates termination, for
  multiplicity-sensitive decisions *and* for existential search termination.
- Origin assignment is unconstrained, and A6 shows what that costs.
- The registry is still **3 authored rules, 0/15**. No freshness rule. F2 untouched.
  H-IDENTITY-AUTHORITY stays at **NONE**.
