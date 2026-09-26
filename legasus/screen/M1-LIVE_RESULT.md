# M1-LIVE-1 and M1-LIVE-2 — the milestone attempted live on this desktop with the local 1.5B: not reached; the loop's software held; the model did not act

2026-09-26, $0 (ollama qwen2.5-coder:1.5b on the i3-1315U / 7.6 GB laptop, no GPU). Both runs
through the campaign entry point with the play diagnostic and the recovery controller on.
Hub commits 116467a (live-1) and 3f8e4ae (live-2).

## M1-LIVE-1: the whole game asked at once

    plan call     COMPLETED, 2,319 chars: a reasonable 13-item plan
    first action  DEADLINE_LOCAL_ABORT at 836 s with 21,133 chars ARRIVED and no end in sight
    edits 0       HELD (evaluation error: nothing to judge)
    desktop       node peak 360 MB, chrome (play checks) peak 570 MB, CPU mean 73 %;
                  ollama's memory was not captured (wrong process name; fixed for live-2)

Reading: asked for everything at once, the model produced an unbounded reply; on this CPU
that is ~25 chars/s, so no sane call bound fits a whole-page answer. Decision taken: build
in increments (farm-i1..i4), each a small request with a subset of the play as its check and
every earlier step protected (farmChain.test 14/14, farmIncrement.test 11/11 with a
scripted builder).

## M1-LIVE-2: increment 1 alone (movement + the state contract)

    plan call     COMPLETED, 780 chars (95 s)
    actions       three identical 194-char replies (21 s each): the model ECHOED two lines of
                  the guidance ("Outline the plan first, then read_file the slice you need...
                  Mark a task done as soon as it works (ACTION: task_done)...") - parsed as
                  task_done, refused twice, the run stopped by the repeat guard after 167 s
    edits 0       HELD; increments 2-4 BLOCKED with the reason (prerequisite not accepted)
    desktop       node peak 331 MB, ollama peak 1,827 MB (the model resident), chrome peak
                  453 MB, combined peak 2.2 GB of 7.6; CPU mean 75 %, peak 91 %;
                  2.3 output tokens/s median; 15,290 prompt tokens over 3 calls

Reading: the 1.5B never attempted a write. It reproduced the instruction text instead of
following it - the same failure class recorded before for this model under the single
large prompt ("protocol, not capability, is the ceiling"; "make the wanted fragment the
natural continuation"). The controller had nothing to judge; the chain blocked the rest
correctly; the accounting is complete.

## What the two runs establish

    the loop's software around the model   held: opening diagnostic on an empty target,
                                           controller from nothing, bounded calls, chain
                                           blocking, complete accounting, $0
    the model on this desktop              does not build increment 1 under the current
                                           prompt protocol: an unbounded reply when asked for
                                           the whole game, an echo when asked for a piece
    M1-M4                                  NOT REACHED live. All four shapes are proven only
                                           with a scripted builder.
    M5                                     measured (above): the whole stack fits in ~2.2 GB
                                           peak; the CPU is the limit, at ~2.3 tokens/s

## The two ways forward (no spend involved in the first)

1. **A small-model protocol for building increments** ($0): the hub's one-prompt-per-gate
   protocol gave the 1.5B 36/36 on gated tasks where the monolithic prompt failed. An
   increment could be asked as a single bounded request whose only valid reply is the file
   in a fenced block, with the play's result as the gate. That is protocol work on the
   builder, measurable with the same play and controller.
2. **The hosted 7B as the capability control** (spend): the model that produced every
   accepted repair in the campaigns. A four-increment chain is ~4 units; with deploy and
   shutdown at the observed rates it is well under $1 per attempt. Needs authorization.

Records: `M1-LIVE-1_summary.jsonl`, `M1-LIVE-1_console.log`, `M1-LIVE-1_desktop.json`,
`M1-LIVE-2_summary.jsonl`, `M1-LIVE-2_console.log`, `M1-LIVE-2_desktop.json`. Roots
`autodiag1-ORpkzL` (live-1) and the live-2 root named in its console log.
