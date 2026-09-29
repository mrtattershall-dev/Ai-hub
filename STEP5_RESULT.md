# STEP 5 RESULT — attenuation holds where it was tested, and a third boundary loses authority entirely

Against `STEP5_AUTHORITY_CONTINUITY_PREREG.md` and its Amendment 1. Component evidence and composition
evidence are kept separate below, deliberately: **component evidence is not inherited as evidence of
composition.**

## COMPONENT EVIDENCE (mechanisms exercised alone)

    W6a  authorityScope.test.mjs            17 passed / 0 failed
         attenuate(attenuate(S,A),B) ⊆ attenuate(S,A) over 4000 random inputs, 0 counterexamples.
         Non-amplification and monotonicity likewise. The brief's case holds: parent {a},
         request {a,b,c,d,everything} -> {a}.
         MUST-FIRE CONTROL: a UNION implementation is caught amplifying on 3007 of 4000 inputs.
         This is evidence about the FUNCTION. It is not evidence about the live path.

    governed-dispatch.test.mjs              30 passed / 0 failed  (from the earlier slice commit)
    e0/e1/e3/effect-readback                4 suites, all pass, BEFORE any wiring

## COMPOSITION EVIDENCE (mechanisms exercised together, in one live path)

    W9  queuedAuthority.test.mjs            29 passed / 0 failed
        Seven worlds through a real `POST /agent/queue/run` dequeue, each in its own isolated hub.

        V1  parent {a,b} -> requests {a}    descendant installed {a}; its OWN RECORD shows
                                            write_file a.py OK and write_file b.py REFUSED
        V2  parent {a}   -> requests {b}    nothing delegated; b.py absent
        V3  parent {a}   -> requests {a,b}  delegated {a}; a.py written, b.py refused - THE LIE
                                            BOUGHT NOTHING
        V4  parent {}    -> requests {a}    nothing delegated; authority cannot be created at the
                                            boundary
        V5  forged AUTHORITY line naming b  delegated nothing; the line is not even representable,
                                            because the parser builds queue_task args itself
        SPEC owner authorizes b directly    the DESCENDANT wrote b.py, so every refusal above is
                                            authority and not a broken write path
        OFF  governance disabled            the same unauthorized descendant write LANDS

    W6b  attenuationComposes.test.mjs       9 passed / 3 failed — PARTIAL, and the failure is below
        hop 1: parent held {a,b}, delegated {a}; child INSTALLED {a}
        hop 2: child had {a} available, REQUESTED {a,b}, delegated {a}, b.py recorded as refused
               -> ATTENUATION COMPOSED ACROSS TWO REAL CROSSINGS, in separate processes, via a
                  queue item, and the narrowing was not undone by depth
        hop 3: NOT OBSERVED. See below.

    generationChain.test.mjs                2 passed / 0 failed
        Measured, not read off the source: generations [1,2] after the `_activeRun` fix and [1,1]
        before it. The pre-fix state is the must-fire control for the claim.

## THE COMPOSITION FAILURE, PRESERVED AND NOT FIXED

W6b's third hop never ran. The diagnostic:

    run 2  goal "A previous attempt at this g..."  gen=2  received {installed: [], delegated: null}
    queue  55eae191  "HOP3 work"  gen 2  status QUEUED  auth ["a.py"]      <- never dequeued

The child run ended `stopped`, which triggered the hub's own REPAIR path. That path calls
`workQueue.enqueue` from the run-failure handler and **passes no authority**, so the repair item
carries `authority: null`. Dequeue took the repair item before `HOP3`, and the run I measured as a
grandchild was an auto-generated retry that correctly refused everything because it held nothing.

**THE FINDING: there is a THIRD boundary that loses authority, and it was not in the prereg.**

    spawn_subtask   authority crosses AMBIENTLY, unrecorded        too much (measured earlier)
    queue_task      authority crosses by ATTENUATION, recorded     works (W9, W6b hops 1-2)
    repair/retry    authority DOES NOT CROSS AT ALL                too little - a retry of
                                                                   authorized work arrives
                                                                   unauthorized and can do nothing

This is a P4 (non-loss) failure on a route nobody enumerated, and it is the shape the owner named in
advance: *persistence loses authority lineage*. An autonomous system that retries its own failed work
cannot do so, under governance, because the retry is not a delegation and nothing makes it one.

It is recorded and **not repaired here.** The prereg says a failure is preserved rather than rescued
inside the same experiment, and this is a different boundary from the one under test rather than a
defect in attenuation - attenuation composed correctly at both crossings it was given.

**Observability is what made this diagnosable.** The repair run's `authority_received` step fired with
`installed: []` and the sentence "no crossing record accompanied this queued item, so NO authority was
installed - every governed write in this run will refuse". Without that step the run would have looked
like a grandchild that governance refused, which is exactly the wrong conclusion. P5 earned its place.

## THE FROZEN PROPERTIES, SCORED

    P1  INDEPENDENT ROOT       HELD. Root read from token ancestry (OWNER), never asserted. V4: an
                               unauthorized parent delegates nothing. V5: a forged grant is
                               unrepresentable at this boundary.
    P2  NON-AMPLIFICATION      HELD across two live crossings (W6b hop 2) and 4000 random inputs
                               (W6a). No observed case where a descendant held what an ancestor did
                               not.
    P3  LEAST AUTHORITY        HELD when the descendant asks (V1, W6b hop 1). When it does NOT ask,
                               the parent's set passes unchanged and the record says
                               `leastAuthority: false` rather than pretending otherwise.
    P4  NON-LOSS               HELD on queue_task (V1, SPEC: descendants wrote what they were
                               authorized for). FAILED on the repair/retry path - see above.
    P5  ACCOUNTABILITY         HELD. `authority_delegated` on the delegator and `authority_received`
                               on the receiver carry root, availableBefore, requested, delegated,
                               refusedFromRequest; refusals appear in the descendant's own record.
    P6  REVOCATION RESPONSE    NOT TESTED. No world revokes a grant between enqueue and dequeue. The
                               crossing is decided at queue time and stored, so a grant revoked
                               afterwards would NOT be noticed. Stated as a known gap, not a pass.

## APPARATUS FAULTS ALONG THE WAY, RECORDED BECAUSE THEY EACH LOOKED LIKE A RESULT

    1  routing the mock on a goal MARKER          the marker leaks into the parent's own queue_task
                                                  reply and tool result, so the PARENT was served the
                                                  CHILD's script and wrote both files itself. 22/2,
                                                  and the passes were worse than the failures.
    2  routing on the first `GOAL:` line          the SYSTEM PROMPT contains `GOAL: write the
                                                  level-loading module ...` as an EXAMPLE at
                                                  messages[0], so both runs matched the same text and
                                                  the CHILD got the parent's script. 21/7, including a
                                                  FLAG-OFF control failure - which is the tell, since
                                                  a control that fails with the mechanism switched off
                                                  can only be apparatus.
    3  assuming dequeue order                     a repair item preempted HOP3, and the run measured
                                                  as a grandchild was an unauthorized retry.

Fix 1 and 2: one mock per run on its own port, with the hub repointed between them (`loadDb()`
re-reads HUB_DB per request). No text matching anywhere. Plus three controls that make an apparatus
fault announce itself - the child's mock must have been CALLED, the parent must have attempted ZERO
writes, and attribution is read from the run record rather than from final file state.

Fault 3 is not yet fixed. W6b hop 3 therefore remains UNOBSERVED, and the composition claim stops at
two crossings.

## WHAT IS NOT CLAIMED

- **Not that the assembled slice works as a system.** What was exercised together is listed under
  COMPOSITION EVIDENCE and nothing else. Component evidence above is not inherited upward.
- **Not that governance should be enabled anywhere.** The flag is off. Queue and supervisor runs that
  pass no scope, and now the repair path, would refuse every write.
- **Not P6**, and not W6b's third hop.
- **Nothing about performance, cost, completion, or a score.** None measured.
