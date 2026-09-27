# AUDIT-1 — what reached the model is now established, a baseline is validated through the full sequence, and every prior finding is marked supported, limited or invalidated

2026-09-27, **$0**, nothing deployed. Bounded offline audit, run before any further experiment.

## 1. What actually reached the model in DOM-EVIDENCE-1

Two of my record fields were defective in that run, and I then claimed the model-facing request was
unaffected. Those are statements about different things — the record versus the request — but **the
request was never saved, so the claim rested on a token delta, which is an inference.** Resolved:

The requests were rebuilt through the loop's own code path (`--dry-run-request`, the same
`evidenceMessage` and `renderDiagnosis`), then tokenized by the same server family and chat template
that served the run, and compared against the `promptTokens` each live round recorded.

    arm  seed  mode        plan in the rebuilt request  chars  counted  recorded  match
    E0    2    basic       none                          5487    1365     1365    YES
    E0    3    basic       none                          5800    1432     1432    YES
    E0    4    basic       none                          5849    1448     1448    YES
    E0    5    basic       none                          5596    1384     1384    YES
    E2    2    diagnosis   INTERFACE_NEVER_BUILT         7413    1759     1759    YES
    E2    3    diagnosis   INTERFACE_NEVER_BUILT         7726    1826     1826    YES
    E2    4    diagnosis   INTERFACE_NEVER_BUILT         7775    1842     1842    YES
    E2    5    diagnosis   INTERFACE_NEVER_BUILT         7522    1778      -      record lost

**Seven comparable seeds, seven exact matches, in both arms.** The diagnosis-mode requests carry the
structured plan. **So the diagnosis did reach the model, and the two defects were confined to the
record.** DOM-EVIDENCE-1's interpretation is resolved.

**The limits of that, stated:** token counts were taken from a model of the same family and template as
the one that ran, because the 7B is not resident locally. What is established is agreement of counts
under the same tokenizer and template, not a byte-level capture of the original HTTP request. A
byte-level record now exists going forward (`request: { system, user, sha256 }` per round); it cannot
be created for a past run.

**One defect this audit found in itself.** The first dry run produced diagnosis-mode requests
byte-identical to basic ones. Cause: round 0's acceptance restores the workspace to the baseline, so
the dry run was observing the baseline rather than the candidate. Had I not checked, the audit would
have "established" the opposite conclusion — by the same class of error it was auditing.

## 2. A baseline validated through the full required interaction sequence

    the page four experiments started from   passing [1,2,3,5]  failing [4,6,7]  errors 17
    the verified baseline                    passing [1,2,3,5]  failing [4,6]    errors  0
    the verified baseline, strict spec       passing [1,2,3,5,7] failing [4,6]   errors  0

The change is one element: the accepted page's `draw()` writes to `#day`, which did not exist. **No
behaviour was added and planting still fails**, so the task is not made vacuous. Checked: movement
passes, zero errors are raised anywhere in the run, the strict no-error step passes, planting still
fails, and the build is byte-stable.

    legasus/bench/farm/baseline-verified.html   sha256 2a87c27f510f2a7d…  3896 chars

**This matters beyond tidiness.** Every increment-2 experiment started from a page that threw on every
keypress. Candidates inherited those errors, and the strict check cannot pass while they occur. That
confound is now removed from future runs, and it was present in all of them.

"Verified" here means "passes these checks through the full sequence", not "correct".

## 3. Harness, baseline and checks frozen together

    bd734d0d9076e223   server/repairLoop.mjs
    ebe7e27e7b52cbe4   server/diagnose.mjs
    df56ddc018026230   server/judgeCandidate.mjs
    ea6239485a247733   server/localEdit.mjs
    f62fa26c96e5b589   server/playCheck.js
    64aa3b7bcb1ad51b   server/acceptance.js
    8a294080263b8424   server/evaluator.js
    e71459d44de30b2d   server/benchTasks.js
    c020655ba0f578be   legasus/bench/farm/play-plant.json
    8626b959e0940ea7   legasus/bench/farm/play-plant-v2.json
    2a87c27f510f2a7d   legasus/bench/farm/baseline-verified.html
    1ce6bfac00c88ddd   legasus/screen/NARROW-2_accepted_index.html   (the old, unverified baseline)

Any later result must name this set, or re-verify.

## 4. The findings ledger

**SUPPORTED — stands as measured**

    the GPU generated much faster under the tested backend   16.4 s -> 1.4-2.8 s per attempt, 10.6 ->
        114 tok/s. Prompt sensitivity limits what can be read into the CODING outcome; it does not
        touch the timing observation, which was measured directly.
    no accepted handler in the tested configurations         5 interfaces, 3 models/backends, ~60
        attempts, 0 accepted. This is the supported claim.
    ten restorations were byte-exact                         in those ten cases, IDENTICAL_TO_START.
    every clause of the plant spec has a mutant that breaks it  detection of THOSE mutations.
    the instruction's length moved code insertion            0 of 5 to 3 of 3, same site, same seeds.
    whole-file return echoed the input                       5 of 5, byte-identical but a newline.
    the diagnosis reached the model in DOM-EVIDENCE-1        section 1 above.

**LIMITED — true only as stated, and previously stated too strongly**

    "the model cannot write this handler"          NOT supported. What is supported is "no accepted
        handler in these tested configurations". Both model limits and interface/measurement limits
        remain live, and this session did not separate them.
    "the binding constraint has never been model capability"   NOT established, and I asserted it.
        Instrument defects explain or confound several failures; they do not establish that the model
        would succeed with a correct harness. Both can be limiting at once.
    "ten restores prove the protection works"      supports those ten restoration cases. It does not
        establish every protection claim.
    "the mutants validate the spec"               establishes detection of the selected mutations, not
        specification completeness. The movement check proved that: it measured position correctly
        while missing the exceptions raised during movement.
    "interface never built"                        a hypothesis. Absence in the observed states, plus a
        static reading of one file for creation machinery.
    "conditional diagnosis"                        the engine's answers follow its observations. Not
        evidence that a true cause was established.

**INVALIDATED — withdrawn**

    INC3-1's "0 of 5 inserted any code" for the 5-line fim cell   was a property of my 9-line
        instruction comment. With a one-line instruction the same model wrote code 3 of 3.
    "verification is about seven eighths of an attempt's clock"   driven by one 554-second outlier;
        typical verification is 13-24 s.
    the first cell-A run of INC4-1                               void: the instruction was hardcoded
        to the previous increment.
    "the buttons do not exist and never will"                    an absent id at readyState complete
        rules out "readiness will create it" in the observed state, not every later insertion.

**UNAFFECTED by the record defects, and kept**

    every DOM-EVIDENCE-1 outcome: acceptance 0 of 4 in both arms, applied edits 6 against 1, format
    compliance 8 rounds against 1, the token and timing figures, and the E2 seed-2 edit that moved to
    the interface the document actually has. Section 1 establishes the requests were as intended, and
    the defects touched only what was written down afterwards.

## 5. What I got wrong in how I reported all of this

I stated conditional findings as established ones, repeatedly, and the correction always came from
outside rather than from me. The three worth naming: a hardware result read as a coding result, "cannot"
substituted for "did not in these configurations", and a protection claim generalised from ten cases to
a property of the system. **The pattern matters more than any single instance**: when a result pointed
the way I expected, I wrote it one level stronger than the evidence carried.

Records: `AUDIT-1_request_{basic,diagnosis}_seed{2,3,4,5}.json` (the rebuilt requests, with sha256),
`server/requestAudit.mjs`, `server/makeVerifiedBaseline.mjs`.
