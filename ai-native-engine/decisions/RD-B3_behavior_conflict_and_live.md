# RD-B3: Behavior Conflict + Live-Model Authoring (Closed) — the payoff measurement

**Question:** With the representation (RD-B1) and invariants (RD-B2) in place: (1) does behavior conflict need any machinery the data layer doesn't already have, and (2) can a real model actually author working behavior into a *running* simulation through the validate-before-execute gate — and what does the repair loop do at this level?

## Part 1 — Conflict falls out (deterministic; the RD-005.3 pattern again)
`experiments/027_behavior_live/behavior_conflict.js` (9/9): an installed rule is just another actor. A rule and a player watering one crop the same tick **max-fold losslessly, byte-identical to the player-vs-player twin**; a rule contesting a label with a player **defers** (written by neither — no LWW between AI and human); two AI rules contesting a label defer with **no special case**; a mixed tick (rule + player edits) reverses as **one undo step**. Zero new machinery.

## Part 2 — Live models author behavior (Modal H100, transformers shim, real Node harness)
`experiments/027_behavior_live/behavior_live.js` + `experiments/028_behavior_model_curve/modal_behavior_curve.py`. Goal battery (machine-checked *observables*, the RD-014 contract discipline for behavior): **grow** (demands a stated clamp — the range proof), **flee** (structural reparent), **score** (the novel bounded-`count` aggregation), **wilt** (clamp at 0). Success = rule passes the gate AND the sim *does the thing* within 6 ticks. Two arms per RD-018.1: CONTROL (blind retry) vs FEEDBACK (localized errors re-prompted). Mock apparatus proof is deterministic (control 0/4, feedback 4/4 @ exactly 2 attempts).

| model | arm | grow | flee | score | wilt | TOTAL |
|---|---|---|---|---|---|---|
| Qwen2.5-Coder-32B | CONTROL | 2/2 @1.0 | 2/2 @1.0 | 0/2 | 2/2 @1.0 | 6/8 |
| Qwen2.5-Coder-32B | FEEDBACK | 2/2 @1.0 | 2/2 @1.0 | **2/2 @2.5** | 2/2 @1.0 | **8/8** |
| Qwen3-Coder-30B-A3B | CONTROL (n=4) | 3/4 | 4/4 | 0/4 | 3/4 | **10/16** |
| Qwen3-Coder-30B-A3B | FEEDBACK echo | 1/4 | 4/4 | 0/4 | 2/4 | 7/16 |
| Qwen3-Coder-30B-A3B | FEEDBACK errors-only | 2/4 | 4/4 | 0/4 | 2/4 | 8/16 |

(qwen2.5-coder:7b local-CPU point abandoned honestly: ~20 min/call and the sustained load crashed the laptop; only cell completed was grow-C 0/3 — not a usable datum.)

### Findings (measured)
1. **The headline: SAFETY held absolutely.** Across ~120 live GPU proposals (two models, three configurations, dozens of malformed/wrong attempts): **zero unsafe events**. Every bad behavior was rejected *before it ran*; the simulation never corrupted, hung, or desynced. The RD-B1/B2 gate does at the logic level what RD-018 did at the data level.
2. **The 32B replicates the RD-018.1 shape one level up:** it one-shots everything the grammar makes familiar, fails *only* the novel corner (`count` aggregation — blind retry 0/6 across runs), and the localized error rescues exactly that corner (2/2 @ mean 2.5). Feedback is worth precisely the novel part of the grammar and is a no-op elsewhere.
3. **The repair loop is NOT a universal win — new, and it complicates RD-018.1's story honestly.** Qwen3-Coder-30B-A3B scores *worse* with feedback than blind retry, replicated at n=4 and in both feedback styles. Diagnosis from logged attempts: **repair-mode collapse** — under a corrective re-prompt (with or without the prior attempt echoed) the model regenerates its dominant wrong completion near-deterministically: the *same* bracket typo (`...},0]}]}`) attempt after attempt, the *same* `id`-scoping loop on score. Blind resampling keeps temperature diversity and sometimes escapes; guided repair locks in. The initial "echo trap" hypothesis was **refuted by the errors-only probe** (8/16 ≈ echo 7/16, both < control 10/16) — the collapse is conditioning on corrective framing itself, not on seeing its own output.
   ⇒ Combined curve across the project: llama-1B **+75pts** with feedback (RD-018.1), 32B **+2** (exactly the novel corner), Qwen3-30B-A3B **−2/−3** (collapse). **Repair-vs-resample is a per-model policy knob, not an architecture constant.** The boundary's localized errors remain load-bearing for safety and for teachable models; the loop that replays them must be configurable (`FB_STYLE` exists; a resample-on-collapse policy is the natural next card).
4. **Live models exposed a real grammar gap in minutes:** on `score`, *both* models' first instinct is to scope the rule to *the specific zone* (`where {field:"id"/"name"/"root"}` — even a shorthand `{"where":{"id":"u0"}}`), and the count-expression itself was **correct in every rejected attempt**. The grammar cannot express entity-scoped match; the 32B inferred "drop the where" from `unknown_field: known: water,growth,hp,tally`, Qwen3 never did. → **`match.uuid` card** (statically checkable at parse; also fixes the error text: "you cannot target an entity in `where`; use match.uuid").

### Infra lessons (recorded because they cost real time)
- Ollama `stream:false` + Node undici = `UND_ERR_HEADERS_TIMEOUT` on any >5-min generation (headers held until completion; hard 300s cap). Stream and accumulate.
- The first sandbox-timeout draft in RD-B1 and this bug make the same point twice: **runtime guards are easy to hold wrong; static rejection has no such failure mode.**
- `modal run` without `--detach` dies with the client (a laptop crash killed a finished-loading run); results now also persist inside the volume (`results/*.json`), runs launch detached.

## Decision
- Behavior conflict policy: **nothing to decide** — RD-005 fold/defer covers rules-vs-players and rules-vs-rules unchanged (measured, part 1).
- The live loop ships with **FB_STYLE as a first-class knob** (echo / errors-only), and the record states plainly: enable the repair loop per model based on a small probe, because a collapsing model does better with blind resampling.
- The behavior spine (RD-B1 → B2 → B3) is **closed as measured**: an untrusted model authors logic that runs every tick against live players, gated before execution, with data-grade guarantees intact and zero unsafe events observed.

## Transferable principle
A repair loop is a *bet on the model's posterior*: feedback helps a model whose errors are correctable perturbations (1B structure slips, 32B novel-grammar gaps) and actively hurts a model whose errors are its mode (collapse under corrective framing). Measure which one you have before wiring repair into the loop — the safety gate is unconditional, the *teaching* loop is not.

## What remains open
- **`match.uuid`** entity-scoped rules (the gap both models demanded) + richer aggregations (`sum`, `nearest`).
- **Resample-on-collapse repair policy** (detect repeated near-identical rejected attempts → drop feedback, raise temperature).
- Higher-n runs and more model families to firm the collapse finding (n=4×3 runs is convincing but not large); a higher-temperature resample-only control (same caveat RD-018.1 carries).
- Multi-rule authoring sessions (a model composing several interacting rules toward a game-level goal) — the next payoff experiment.
