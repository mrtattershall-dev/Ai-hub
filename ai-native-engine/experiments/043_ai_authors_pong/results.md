# RD-029 results — can the AI author a NON-FARM game? (2026-07-16)

Live run: Qwen2.5-Coder-32B on Modal A100 (remote only — pinned laptop rule), the
real `runRuleLoop` gate+repair loop, 4 attempts max, goals in plain English with no
JSON and no encoding hints. Raw proposals + reject codes for both arms:
`artifacts.json` (house rule — this run is replayable for free, and was: the scorer
below re-ran it three times at zero GPU cost).

## Headline — TWO RUNS, and the second one is the finding

The first run (below) exposed two SAFE-but-WRONG failure classes. Those became
**RD-030 (strict keys)** and **RD-031 (degenerate interval)** — two new localized
gate errors, built from the model's own captured transcripts. The A/B was then rerun
IDENTICALLY (same model, temperature, goals, loop, attempt cap):

| run | arm | gated | **plays correctly** | precision (correct / gated) |
|---|---|---|---|---|
| pre-hardening | A — unsigned | 3/5 | **0/5** | 0% |
| pre-hardening | B — signed+`mul` | 4/5 | **1/5** | 25% |
| **post-hardening** | A — unsigned | 2/5 | **0/5** | 0% |
| **post-hardening** | B — signed+`mul` | 3/5 | **3/5** | **100%** |

**Arm B tripled: 1/5 → 3/5 correct — while gate-passes DROPPED 4 → 3.** That is the
gate working as designed: it stopped issuing plausible lies and started either
teaching the model or honestly refusing. Every rule that now installs in arm B plays
correctly (3/3). Arm A stayed at 0/5 across both runs — the offset encoding defeats
the model no matter how good the error messages are.

Two claims land together:
- **RD-028's premise is now decisively supported, not "directional".** Signed+`mul`
  vs unsigned: **3/5 vs 0/5 correct.** The encodings were not a nicety; they were the
  difference between a model that can author this game and one that cannot.
- **RD-018.1's thesis (localized errors repair weak models) extends to two brand-new
  error classes** discovered by watching a live model fail six hours earlier. The
  inverted clamp `min:[max:[e,255],0]` — written in BOTH arms, multiple goals, first
  run — is GONE from the second run: the model now writes `min:[max:[e,0],255]`.

Safety was never in question and still isn't: zero unsafe events across all four
arm-runs; every refusal left the world byte-identical.

**What still fails (both arms, both runs): `paddle_bounce` and `scoring`** — the two
goals requiring aggregation (`count ... of:{near}` and aggregation-inversion). The
model reaches for structure it half-remembers (that is exactly what the misplaced
`of:{near:14}` was) but cannot assemble it in 4 attempts. That is the honest frontier:
arithmetic on fields is authorable; **aggregation is not, yet**.

## Verdicts against the pre-registered hypotheses

- **H1 (the prompt was the gap): PARTIALLY REFUTED.** Making `RULE_GRAMMAR`
  schema-derived was *necessary* — before it, the model was told the world contained
  `crop|enemy|zone` and could not have authored Pong at all — but it is not
  *sufficient*. With a correct, self-describing prompt the model still authors
  mostly-wrong rules.
- **H2 (RD-028 helps): WEAKLY SUPPORTED, small sample.** B beats A on every axis
  (gate 4 vs 3, correct 1 vs 0, attempts 9 vs 12) and the direction matches the
  card's prediction — but "1/5 vs 0/5" is not a victory, it is two failures with a
  gradient. RD-028 keeps its measured authoring-delta win (16→11 rules, human-authored);
  its AI-authorability claim is **supported in direction, unproven in magnitude**.
- **H3 (safety holds off-farm): CONFIRMED.** Zero unsafe events across both arms.
  Every refusal (7 of 10 goal-runs hit the gate) left the world byte-identical. The
  safety boundary is not farm-shaped.

## The two systematic failure modes (both SAFE-but-WRONG — the B2-LIVE lesson, off-farm)

**1. The inverted clamp.** In BOTH arms, on multiple goals, the model wrote:

    {"min":[{"max":[<expr>,255]},0]}        // max with 255 THEN min with 0

which is identically **0** for every input. It meant `min:[max:[e,0],255]`. The gate
accepts it because its provable interval `[0,0]` really is inside the field range —
the rule is perfectly safe and completely useless. `ball_move` "moved" the ball to
x=0; `paddle_input` "moved" the paddle to y=0 (a decrease of 128).

**2. Hallucinated structure, silently ignored.** Arm B's paddle_bounce:

    {"name":"bounce","match":{"type":"ball"},"effects":[{"set":"vx","to":{"mul":[{"field":"vx"},-1]}}],
     "where":{...},"of":{"near":14},"type":"paddle"}          <-- at RULE level, not inside a count

The model knew it needed `near` and put it at the top level, where **the gate ignores
unknown keys**. The rule installs and reverses vx *every tick regardless of paddles*.
It looks like it does the right thing and does not.

## The scorer needed a control arm too (recorded honestly)

The first scoring pass reported A 1/5 and B 3/5. It was wrong: `paddle_input` asserted
only "y decreased" (so the y→0 rule passed) and `paddle_bounce` tested only the
positive case (so the reverse-every-tick rule oscillated into a reversed state by
tick 3 and passed). Hardened oracles — a paddle must move a STEP not teleport, an
idle-input control must not move, and a ball FAR from any paddle must NOT reverse —
dropped the scores to the numbers above. **A weak oracle launders a wrong rule**; this
project's own RD-004/RD-005 lesson ("check the test") recurring at the scoring layer.

## What this buys — two evidence-backed cards (not guesses)

- **RD-030 strict-key gate.** Reject unknown keys in a rule object instead of
  ignoring them. The model's misplaced `of:{near:14}` would have become a LOCALIZED,
  REPAIRABLE error ("`of` belongs inside a count/sum/min/max, not on the rule") and
  the repair loop had 3 attempts left to use it. Silent ignoring converts a fixable
  mistake into a plausible lie.
- **RD-031 degenerate-interval check.** When an effect's provable interval collapses
  to a single constant while its expression references fields, that is almost
  certainly an inverted clamp. The gate KNOWS the interval is `[0,0]` — it computed
  it. Saying "this always evaluates to 0; your min/max are likely swapped" is a
  localized error the loop can repair.

Both are cheap, both come with a captured failing transcript, and both target the
exact class of error a live model actually made — which is the only reason to build
them.

## Caveats

- One model, one temperature (0.2), 4 attempts, 5 goals, 2 arms. Directional, not
  definitive. The B2-LIVE precedent (terse goals 0/3 → unambiguous goals 2/3)
  suggests goal phrasing alone could move these numbers; that is a separate arm.
- `scoring` failed in BOTH arms after 4 attempts — the one goal needing aggregation
  inversion ("the PADDLE counts balls in the goal"), which is the least intuitive
  shape in the grammar and the one a renderer-shaped mental model fights hardest.
