# Cancer-screener dependency map — where representation becomes proposition becomes authority
2026-09-21 09:55. **Map only. Nothing is rebuilt, repaired or proposed.** Produced so LegaScreen
cannot silently inherit stronger claims than its inputs warrant.

## Scope, stated honestly

I own and can audit the BIND substrate (`legasus/` in the hub worktree). **LegaScreen's
internals are Session 0d's**, in the `ai-coding-hub-indent` worktree; I read them read-only and
map the *consumption interface*, not their implementation. Where a row concerns 0d's code it is
marked **[0d]** and is an observation for them, not a finding about them.

## The chain, with each promotion named

    REPRESENTATION              PROPOSITION                      AUTHORITY
    ------------------------------------------------------------------------------------
    PASS|FAIL line              "this case passed/failed"        per-case klass, discrimination
      ^ subject-controlled (step 15). Condition: the witness does not misreport.
    ------------------------------------------------------------------------------------
    V8 coverage entry           "this region executed"           executedSite, NOT_EXECUTED
      ^ corroborated independently for CJS (step 5) and against BIND-1's site counter (BIND-2 H6).
        Weakest point: coverage files were read as PROCESSES once and were not (step 6).
    ------------------------------------------------------------------------------------
    mechanism `served` record   "the mutant was supplied"        VALID_INTERVENTION
      ^ dies in both directions (step 14): a resolution logs as a serve; a removed log channel
        hides a real serve. Proposition itself is an evidence limit under C-BND (step 17).
    ------------------------------------------------------------------------------------
    marker identity string      "which implementation ran"       equivalence, preservation
      ^ self-reported by the served file (step 12 S5). An impostor is indistinguishable.
    ------------------------------------------------------------------------------------
    role / ppid                 "which process, whose child"     scope, membership
      ^ role is an env string; ancestry is a one-hop lookup that fails silently (step 9).
    ------------------------------------------------------------------------------------
    absence of a record         "it did not happen"              completeness claims
      ^ NOT licensed. A world with a hidden execution is byte-identical to one with none
        (step 11 P6). Any claim quantified over "all executions" inherits this.

## The four promotions LegaScreen must not make silently

1. **observed → complete.** No configuration in this branch supports "no other execution
   occurred". A screener that treats an unobserved region as clean is claiming P6.
2. **anomaly observed → defect.** Steps 7–10 rejected six relations between an observation and
   the action it is attributed to. An anomaly co-occurring with an intervention is not thereby
   caused by it (step 10, twice).
3. **test green → behaviour preserved.** The `PASS` line is subject-controlled (step 15), and
   TRANSFER-BIND arm B showed a *green suite* produced by an intervention that never happened.
4. **identical signatures → same requirement.** BIND-2 H1 split 4 of 7 identical-discriminator
   clusters once outputs were observed. Signature equality manufactured sameness.

## [0d] Observations at the consumption interface, offered not asserted

Read-only inspection shows LegaScreen already carries several of these distinctions explicitly —
`bridge.mjs` declines to license a verdict when two subjects "answer related but not
corresponding questions"; `erasure.mjs` states that "positives are SUSPICIONS for a diagnostic,
never verdicts"; `loss.mjs` throws on an entry that claims a verdict without naming all three
criteria; `contract.mjs` carries `INVARIANT_UNKNOWN`. **That is the right shape**, and this map
is not a criticism of it.

The two places worth 0d's own audit, framed as questions rather than findings:

- Does any path treat **absence of an observation** as evidence of absence? That is the one
  promotion this branch showed no configuration supports.
- When a verdict is licensed, is the **evidence configuration** it was evaluated under carried
  with it? Step 13 showed the same proposition flipping identifiability between two
  configurations differing by one record type.

## What must be true before a screener finding is interpretable

    execution opportunity established        coverage on the served identity
    relevant behaviour observed              recorded, with its configuration named
    invariant challenged                     frozen before the subject was inspected
    evidence supports / fails to support     the two kept distinct from "decider said so"
    independent confirmation                 not another Legasus session
    -> DEFECT ESTABLISHED, or UNKNOWN        UNKNOWN is a result, not an unfinished feature

Nothing in this branch blocks building that. The findings constrain what each arrow may claim;
they do not require solving epistemology first. **The screener is the next falsification
environment, and its failures will expose the next missing concepts in a real defect-discovery
problem rather than in synthetic micro-worlds.**
