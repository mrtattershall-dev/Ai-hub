# run5 on the hub - does the fine-tune beat the base 14B? (PRE-REGISTRATION)

Written before run5 produced anything.

tatte, 2026-09-10: "Let's try my run five again then" / "It should be saved to modal".

    base  Qwen/Qwen2.5-Coder-14B-Instruct-AWQ on A10G, vLLM          (../2026-09-10-14b-rerun)
    run5  the SAME AWQ weights + LoRA /adapters/run5 (r=16, alpha=16, the 7 proj layers)
Both arms: same 40 goals (goals-A/B.json byte-identical to the rerun's), same harness and
scorer (trial35), same hub (main 454814a, with tonight's three fixes), same served name
(coder14b), same 70-min cap, run in the SAME time window. The adapter is the only variable.

IDENTITY (Rule 3), before any number counts:
  - /api/health on coder14b-run5 shows "lora": "/adapters/run5"
  - a temperature-0 reply to one fixed prompt differs between the two apps (adapter active)

PREDICTION, from the 2026-09-09 execution-scored eval (code: base 7/9, run5 5/9; run5's
replies about half as long): run5 does NOT beat the base on these general coding goals.
If it wins on "worked" by 3+ goals across both sets, that prediction was wrong.

CAVEATS
  - run5 was trained on the bnb-4bit (NF4) base and is served here on AWQ weights, so it is
    applied to slightly different 4-bit weights than it learned against. Chosen so the
    adapter is the only difference from the base arm. If run5 loses, this mismatch is not
    excluded; serving on bf16 (L40S) would settle it.
  - One pass per arm. Run-to-run variance on identical prompts is large (5/10 vs 8/10 seen);
    read goal by goal, and hand-verify before believing the scorer (it misled both ways in
    the head-to-head).

tools/: run-run5.sh (harness), watchdog.sh (stopApp.mjs only), compare-run5.mjs (scorer view).
