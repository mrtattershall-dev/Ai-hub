# Set I — is the ceiling the hub or the model? (PRE-REGISTRATION, written before the window opens)

tatte: "Okay run a frontier model on 20 prompts. That'll really tell us if it's us or the model", then, on cost:
**"20 dollars. Best open source (free minus modal costs) that you think is best"**.

So: not a frontier API. The strongest open-weights model that fits the serving path we already have, on the
**same hub**, the **same goals**, and the **same checker** as set H — so the only variable is the model.

## The question this answers

Set H established that the hub was a real ceiling and is now lower: on goals actually attempted, the patched hub took
the 30B from **49% → 70%**, and stopped the decay across a run (control decayed 60→47→47→43%; treatment held
73→60→80→67%). The remaining 30% looked like model failures, not tool failures — 9 of 16 came from **two** defects
repeated (`NameError: _escape_html` five times, a missing `.s9-right` button four times), i.e. the model not verifying
its own output and then compounding the mistake.

If a materially stronger model on the identical hub clears those, the ceiling is the model. If it makes the same class
of mistake, the ceiling is still us.

## The pick, and why

Our "30B" is `Qwen3-Coder-30B-A3B-Instruct` — a **Mixture-of-Experts with only ~3B active parameters per token**. It is
fast and agentic but thin per token, and that thinness is the most plausible remaining ceiling.

**Chosen: `Qwen/Qwen2.5-Coder-32B-Instruct` — a DENSE 32B.** Every parameter participates in every token, roughly an
order of magnitude more active compute per token than the MoE, at the same nominal size. It is the strongest open coder
that fits the constraint set below.

Constraints that decided it, read from `modal_serve_vllm.py` rather than assumed:
- the script serves **one GPU** (`gpu=GPU`; no tensor-parallel argument), so multi-card models are out without a code
  change I will not make mid-experiment — that rules out the 480B-class agentic coders;
- it **refuses** 30B/32B/70B/72B on anything under 80GB, so: one H100;
- `MYCODER_QUANT` exists as a fallback if bf16 will not fit.

A 70B would need 4-bit on one card, adding both load time and a quantization confound. The dense 32B isolates
*capability*, which is the question.

## Cost

H100 measured at ~$7.00 per 95 min (~$4.40/hr) in set G. tatte's correction: **that estimate excluded download time**,
and a 64GB dense model is not cached on Modal. Budget with a cold pull:

    cold download + vLLM load (64GB, uncached)   25 min   ~$1.84
    Rule 3 identity                               2 min   ~$0.15
    20 goals @ ~90s                              30 min   ~$2.21
    capture + scoring                             5 min   ~$0.37
    TOTAL                                        62 min   ~$4.57      worst case (45 min pull) ~$6.04

Both prior 30B deploys reached a serving health check ~3.5 min after `modal deploy`, so 25 minutes is a conservative
allowance rather than a prediction. Against the $20 cap this leaves room for a second run if the first is ambiguous.
Watchdog armed before deploy (Rule 7a, `stopApp.mjs` only). Rule 3 identity proved against `/api/health` before any
goal runs.

## Design

    goals    goals-I20.json — goals 1-20 of goals-H.json, unmodified. All ten projects twice: ten "create" goals and
             ten "extend the EXISTING file" goals. The second half is where set H's compounding failures lived, so this
             is the honest slice, not a flattering one.
    checker  tools/checks-I.mjs, sha ea0d8b53535313ef — byte-identical to sets F, G and H. Scores 100 goals; only the
             first 20 results are read.
    hub      the set H TREATMENT hub (eaa70c1), pinned worktree, server/agent.js md5 6647c9479311 — the same patched
             hub the 30B scored 39/100 on.
    caps     AGENT_MAX_STEPS=30, AGENT_MAX_MINUTES=8, supervisor off, fresh empty workspace — all identical to set H.

## Recording — every edit, every tool call (tatte: "record every single thing that model does")

Verified against set H's records rather than assumed:

- **run files** `<id>.json` — every step with its `args` and `result`. `slimForDisk` truncates a single arg only beyond
  `RUN_ARG_MAX = 30_000` chars; **zero args were clipped** across set H's 30B arm (largest was 10,413).
- **transcripts** `<id>.transcript.jsonl` — "every model call, untrimmed": `{ ts, n, kind, sent, reply }`, where `sent`
  is every message new since the model last spoke. This exists because `run.history` is a context *window* and
  `pruneHistory` drops old messages in place — set C lost 248 of 568 replies that way. Largest line in set H: 34,189 chars.
- **traces** `traces.jsonl` — write/edit content up to 30,000 chars per step, plus the finish verdict.
- **run index** `index.jsonl` — one line per run.
- **the workspace git bundle** — every checkpoint commit, so any intermediate file state can be recovered.
- **additionally for this run**: the temp trial directory is preserved rather than left to be reaped, because the
  records tar excludes `.git` and that is the only copy of the live checkpoint history.

## Budget exhaustion must be recorded, not inferred

The caps are held identical to set H (`AGENT_MAX_STEPS=30`, `AGENT_MAX_MINUTES=8`) because comparability is the point.
But the MoE 30B hit the step budget on **21 of 54** runs, so a stronger model may also be cut off at 30 calls. If it is,
this run would be measuring the budget again rather than the model. Budget-exhaustion counts are therefore reported
alongside the score, so a "no better" result can be attributed to the right cause.

## Predictions, fixed before the window

1. **Dense 32B beats the MoE 30B on goals 1-20 attempted.** Set H's 30B treatment scored 15/20 on its first twenty
   (73% on goals 1-15, 60% on 16-30). **Predict 16+/20.** Falsified if it scores ≤15, which would say active parameter
   count is not the binding constraint.
2. **The compounding failures are the tell, and they are what I am actually watching.** `s4_markdown.py` cost the 30B
   five goals through one undefined `_escape_html`; `s9_board.html` cost four through one missing button. Goals 4 and
   14 (markdown) and 9 and 19 (board) are in this slice. **Predict the dense model does not repeat a single defect
   across both passes of the same project.** If it does, the ceiling is not model size — it is that nothing makes the
   model verify its own output, which is a HUB problem and my next fix.
3. **A null result is informative and must not be spun.** If the dense 32B scores about the same as the MoE, that is
   evidence the remaining 30% is not raw capability, and the effort should go to self-verification (run the file after
   writing; refuse a finish whose own imports do not resolve) rather than to bigger models.

## What will NOT be claimed

Twenty goals give each project two passes, so compounding has limited room to appear — a good score here shows
competence at single steps, **not** that the model survives 100 interleaved goals. Set H measured the run-to-run spread
as ±1-2 on score for the 30B, but that was over 54-59 goals; on 20 goals the proportional noise is larger, so only a
clear margin counts. No claim will be made from a 1-2 goal difference.
