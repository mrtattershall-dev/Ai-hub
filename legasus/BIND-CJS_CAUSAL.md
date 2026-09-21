# BIND-CJS step 10 — kill the causal intuition before it gets a name (frozen 2026-09-21 05:20)

## Position on the map

Removed so far, each by a constructed world:

    last execution identity                       NO   (step 7)
    every execution identity preserved            NO   (step 8)
    uniformity across identities                  NO   (step 8)
    process ancestry                              NO   (step 9, incl. not evaluable at all)

What that earned is narrow and is restated so it is not over-read: **no observation-local
property tested so far has been sufficient to establish that an execution belongs to the
intervention being judged.** It does NOT earn "therefore causation determines membership."

## The hypotheses under attack — stated to be killed, not proposed

    H-CAU: an observed execution belongs to an intervention iff the process under the mechanism
           issued a request and that execution followed it.

    H-POST: an observed execution belongs to an intervention iff it occurred within the
            intervention's window.

H-POST is the weaker sibling that a rule can fall back to when no request is recorded. Both are
evaluated as columns; neither is adopted.

## The worlds

**C-REQ — the positive control.** The worker does the work ONLY when asked. The witness asks. The
execution occurs. A genuine case: if the rules cannot say *belongs* here, they cannot fire at
all and nothing else in this experiment means anything.

**C-A — request present, causal responsibility absent.** The worker ignores requests entirely and
loads the target on its own timer. The witness still issues a request, which is recorded. The
execution follows the request in time. It would have happened without it.

**C-A0 — the counterfactual, and also C-B.** Identical to C-A with the request removed. If the
execution still occurs, C-A's succession is demonstrated inert **by evidence rather than by my
narration.** The same run is the object of H-POST's test: an execution inside the window with no
request at all. One world serving two purposes is stated here rather than discovered later.

## Predictions

**K0 (control).** In C-REQ both rules say *belongs*. FALSIFIER: either does not — then the rules
cannot fire and the experiment is void, not informative.

**K1.** In C-A, H-CAU says *belongs*, and C-A0 shows the same execution occurring with no
request. Succession after a request does not establish causation.
FALSIFIER: H-CAU declines C-A, or the execution fails to occur in C-A0.

**K2.** In C-A0, H-POST says *belongs* although no request was issued. Temporal containment does
not establish causation.
FALSIFIER: H-POST declines it.

**K3 is deliberately unpredicted.** Whether ANY recorded field distinguishes C-A's execution from
C-REQ's is left to the evidence. If the answer is "none", that is the finding, and it is not to
be repaired by adding a field chosen because it would have separated these two fixtures.

## What this expedition may not do

- It may not adopt a causal criterion, nor name one. `cause`, `attribution` and `responsibility`
  are English here, not proposed fields.
- It may not build the competing-causes world (R1 and R2 both plausibly responsible). That is a
  later expedition and must not contaminate this fixture by being solved in advance.
- It may not treat "no recorded field distinguishes them" as a defect.
- Mechanism (`legasus/cjs-preload.mjs` @ e41c1e3) and BIND's interpretation stay untouched.

## The observation this experiment may produce, flagged in advance so it is not mistaken for a plan

C-A and C-A0 differ in exactly one thing: whether a request was issued. The *execution* is the
same in both. If nothing within a single run separates them, then the distinguishing information
exists only ACROSS runs — which a live intervention does not have, because it performs one run
and cannot also observe the world in which it did nothing.

Should that be what the evidence shows, it is a finding about what retrospective observation can
support, **not** a licence to design an evidentiary structure that establishes the relation
during the action. That would be candidate #6, and it would have to be attacked like every other.

## Process hygiene

Every spawned pid recorded and swept BY PID; the sweep's result reported. Never by image name.
