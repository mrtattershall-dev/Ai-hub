# RD-B8: Collapse-aware repair policy (mechanism closed; live validation in track 3)

**Question:** RD-B3 measured REPAIR-MODE COLLAPSE — Qwen3-Coder-30B-A3B does
WORSE with corrective feedback than blind resampling, because under re-prompting
it regenerates its dominant wrong completion near-deterministically (same bracket
typo every attempt). RD-B3 concluded "repair-vs-resample is a per-model knob
(FB_STYLE); enable it per model from a small probe." Can that be made AUTOMATIC —
detect collapse at run time and switch — instead of pre-configured per model?

**Decision (mechanism MEASURED):** yes. `core/repair.js
collapseAwareRepair(...)`. The collapse signature is unambiguous and cheap: a
rejected attempt whose whitespace/case-normalized text EQUALS an earlier
rejected attempt — the model reproduced its own wrong output verbatim, exactly
RD-B3's observed failure. On detection the policy LATCHES into RESAMPLE mode: it
re-prompts WITHOUT the prior attempt or its errors, at a RAISED temperature
(0.3→0.9 default), to break the deterministic regeneration — the "blind resample
beat feedback" result, applied automatically rather than chosen up front.

## Method (deterministic proof, `core/repair_test.js`, 14/14)

- **A — collapse rescued**: a model that reproduces the same wrong output under
  any feedback prompt but emits the fix under a resample (blind) prompt. The
  policy detects the repeat at attempt 2, switches to resample (temp 0.9) at
  attempt 3, and succeeds — where the same model under pure feedback loops to
  failure. **Honest control**: a model that repeats even under resample is NOT
  rescued — the policy only breaks deterministic regeneration that a blind/temp
  change can break; it is not magic, and the test asserts that plainly.
- **B — no false positive**: a model that makes progress (a different output
  each attempt, then correct) never trips the detector; feedback stays on;
  normal repair succeeds. The switch fires on repetition, not on "still wrong".
- **C — one-shot untouched**: a correct first attempt engages no machinery.
- **D — robust signature**: the normalized comparison catches a re-emit that
  differs only in whitespace/case (RD-B3's "same typo" rarely re-emits byte-
  identical), and still rescues it.

## Design notes

- **Latch, don't oscillate**: once collapsed, stay in resample for the remaining
  budget. A single blind attempt that also repeats shouldn't flip back to
  feedback (which is what collapsed in the first place).
- **Pure policy, no coupling**: takes `callModel(prompt,{attempt,temperature,
  resample})`, `buildPrompt({priorRaw,priorErrors,resample})`, `gate(raw)`. It
  wraps ANY propose→gate loop (data IR via `protocol.js`, rules via
  `behavior.js`), so it can back the editor's `rule`/`edit` loops and the live
  harnesses with an `FB_STYLE:"auto"`.

## Live validation (2026-07-15, on the track-3 harder-goal GPU run)

The collapse-aware loop ran per-rule in the HOMESTEAD rescue run
(`experiments/034_homestead_game/b3_rescue.js`) across both models.

- **The detector fires on the real signal:** collapse was detected in EVERY
  session of BOTH models — because the hard scoped-sum score rule provokes a
  repeated rejected output even in the capable 32B. So the trigger is
  per-rule-REPEAT, not a per-model label: any model that reproduces a wrong rule
  verbatim under repair is caught, which is the intended behaviour.
- **It composes cleanly and does no harm:** each rule's authoring is its own
  collapse-aware loop, so a collapse on the hard score rule is isolated — the
  32B still WON 2/3 sessions via the session-level rescue with the switch active.
  The auto-switch never broke a capable model's success.
- **It is a mechanism, not a capability substitute:** on the Qwen3-MoE (the
  RD-B3 collapse case) the switch did NOT manufacture a win on the hard goal —
  feedback + resample moved it from tally 0 → 100–160 (closer) but not to the
  300 threshold. The policy breaks deterministic regeneration; it cannot make a
  model author a rule it fundamentally can't.

## A/B follow-up (2026-07-15) — detector validated; SWITCH did not earn its keep

`experiments/034_homestead_game/b8_ab.js`: single hardest-rule authoring
(scoped-sum score), modes control / echo (fixed feedback) / auto (collapse-aware
switch), 8 trials, on both models.

| model | control | echo | auto | collapse-seen (auto) |
|---|---|---|---|---|
| 32B (non-collapse control) | 6/8 | 8/8 | 8/8 | **0/8** |
| Qwen3-MoE (collapse case) | 0/8 | **2/8** | **1/8** | **7/8** |

- **DETECTION is validated and SPECIFIC** — the core RD-B8 claim holds. The
  detector fired 7/8 on the MoE (which does reproduce rejected outputs) and 0/8
  on the 32B (which doesn't). "Collapse detected" tracks the real pathology, not
  a model label.
- **The SWITCH-to-resample intervention did NOT help live.** On the 32B it ties
  fixed feedback (both 8/8) — no harm, but it never triggered. On the MoE, auto
  (1/8) did NOT beat echo (2/8) — within n=8 noise, if anything slightly worse.
  RD-B3's "blind resample beats feedback" did NOT replicate on this single-rule
  task; here fixed feedback was marginally better.
- **Honest verdict:** detector sound and specific; the resample response is
  UNPROVEN (possibly counterproductive) at n=8. The mechanism catches the right
  thing, but "switch to blind resample" may be the wrong intervention — or the
  effect is too small to see here. RD-B3's contrary result was on a different
  (whole-behavior) task, so the intervention may be task-dependent. Do not cite
  RD-B8 as "collapse-aware repair improves win rate"; cite it as "collapse is
  reliably detectable and specific; the best RESPONSE to it is not yet
  established." A larger-n A/B on a task where the MoE's baseline is non-zero is
  the follow-up if this matters.

## Transferable principle

A model's failure MODE is observable in its output stream, not just its success
rate. "Reproduced its own rejected output verbatim" is a runtime signal a harness
can act on — turning a per-model configuration burden into an automatic policy.
Detect the pathology from evidence; don't pre-declare it.
