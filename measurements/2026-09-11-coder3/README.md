# Base Qwen3-Coder-30B-A3B on the hub - the same 40 goals (PRE-REGISTRATION)

Written before the model produced anything. tatte, 2026-09-11: "We haven't reran coder3 in the hub
in a while. Let's try that base model first".

    model  Qwen/Qwen3-Coder-30B-A3B-Instruct (bf16, no adapter) on H100, vLLM, served as coder30b
    goals  goals-A/B.json, byte-identical to the 14B-vs-32B head-to-head and the 14B rerun
    hub    main 3eed8b7 (the harness starts its own isolated hubs from main)
    grade  the head-to-head's hand-graded scale: P / CT / NX / RM / INH / F

COMPARISON POINTS (hand-graded, "done exactly as asked" of 40):
    base 14B   22 (head-to-head, hub 725bf46)   21 (rerun, hub 454814a)
    base 32B   27 (head-to-head, hub 725bf46)
    Qwen3-Coder on the OLDER 35-goal set (2026-09-10): work done 34/35, done 32/35 - different goals

CAVEAT: the hub changed since those numbers (finish gate is page-aware and baseline-aware,
b467392; git_undo, ac51e19). That mostly touches the web/game goals (t5, t8, u5, u8), so a small
part of any difference may be the hub, not the model. One pass; run-to-run variance is large.

PREDICTION: at least 32B level, 27+/40 done as asked - a newer coder, and strong on the older set.
Recorded weakness to watch (memory: model-self-verification-gap): Qwen3-Coder writes correct code
and then a self-check that contradicts it - expect CT (correct code, own test wrong) cases.

tools/: run-coder3.sh (harness), watchdog.sh (stopApp.mjs only), compare-coder3.mjs (scorer view).
