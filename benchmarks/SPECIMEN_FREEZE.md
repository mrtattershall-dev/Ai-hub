# SPECIMEN FREEZE — what TRANSFER-2 was run against, preserved before any client branch exists

Recorded on owner decision: **the hub can remain a frozen specimen while a separate branch becomes a
client.** Importing the calculus does not retroactively invalidate TRANSFER-2. What changes is the
STATUS OF FUTURE RUNS, not the validity of the past one.

    screening the FROZEN specimen at this revision   independent evidence of transfer
    screening an INTEGRATED branch later             INTEGRATION TESTING, not transfer evidence

That distinction is manageable and is the whole reason this file exists. A CORRECTION TO MY OWN
CLAIM: I told the owner that importing the calculus would spend the independence irrecoverably. It
does not. It spends it for runs after the import, against the branch that imported it.

## The specimen

    subject repository   C:/Users/tatte/Projects/ai-coding-hub
    subject worktree     ai-coding-hub-indent, branch fix-tolerant-indent
    subject revision     143772c   (the commit that recorded RESULT.transfer-2.md)
    hub trunk at run     main, merge-base with the branch 3f1114f8a7d545a23799538d779fa2885f26b465

    mechanism            BACKWARD_2_FROZEN.txt, COMBINED 0784cd3f4e3970b3
    entry set            90 *.test.mjs under <clean room>/server
    clean room           a copy of server/ + shared/ + client/src/lib + package.json, outside the
                         hub repository, rebuilt fresh immediately before the run, discarded after
    environment          node v24.15.0, win32, 8-process baseline, AGENT_WORKSPACE redirected into
                         the clean room, PORT 39117, LGS_GRACE_MS 20000, LGS_ENTRY_MS 45000
    duration             456s

## The results, as recorded

    EFFECT_WITNESSED   4498     FILESYSTEM 4040   PROCESS_EXECUTION 298   NETWORK_EGRESS 160
    reachability       PRODUCTION_REACHED 1160   TEST_ONLY 2717   ANCESTRY_INCOMPLETE 621
    lifecycle          COMPLETE 25   REFUSED 1   SUBJECT_TERMINATED 64   swept 0   NO_RECORD 0
    observability      OBSERVABLE 148   UNOBSERVABLE_BY_THIS_INSTRUMENT 10   NO_MODULE_SYNTAX 17
    forward            UNOBSERVABLE (precondition absent: no identity brand)
    backward           40 candidates, 11 of them private
    intersection       UNDEFINED
    backdoors          1 of 4 (agent.js::__modelCallTest), cause measured: wrapper indirection

**64 of 90 entries are EFFECTS UNESTABLISHED**, so 4498 is a floor and "did this entry cause nothing"
is unanswerable for 71% of them. That caveat travels with the numbers.

## What this freeze does NOT license

- The 40 candidates are **LEADS**, not an enforcement boundary. Effects identify places worth
  inspecting. They do not establish which actions are destructive, which participants are NECESSARY
  dependencies rather than incidental participants, or whether EVERY route to an effect passes
  through any one point. A second correction to my own claim: I wrote that the queue/lock/ledger
  cluster "IS the hub's irreversible-action boundary". It is a set of places to look.
- Trunk is **unchanged** for the coming evaluation, and the merge is kept **separate from it**, so a
  behavioural change on the trunk side cannot move the baseline underneath a comparison. One
  overlapping file estimates TEXTUAL conflict only; 41 server files changed on the branch is a
  behavioural-compatibility question that a conflict count does not answer. Third correction to my
  own claim: "nearly free" was about text, and I presented it as though it were about risk.
