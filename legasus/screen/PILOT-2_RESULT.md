# PILOT-2 RESULT — the same frozen queue, on the 7B

Ran 2026-09-23 07:44:24Z → 07:50:38Z. **6m 14s of a 30-minute budget.** Unattended, no
interventions. Backend recorded beforehand in PILOT-2_BACKEND.md.

Only intended difference from PILOT-1: the model (local 1.5B → `Qwen2.5-Coder-7B-Instruct` on
A10G via Modal). Same five frozen tasks, checks, seeds, guidance, tool set and limits.

## Result

    queued 5 | accounted for 5 | complete: true
    COMPLETED 2 | FAILED 3 | INTERRUPTED 0 | UNATTEMPTED 0 | EVAL_ERROR 0

**2 of 5 verified completions**, confirmed by the independent evaluator — not by the model's own
claim. No task timed out; all five ENDED on their own.

| task | state | termination | requested | protected | start → surviving | elapsed | calls | tokens |
|---|---|---|---|---|---|---|---|---|
| t1-repair-node-average | FAILED | ENDED | FAIL | PASS | `373037f0` → **unchanged** | 29s | 7 | 39,072 |
| t2-repair-python-parse | **COMPLETED** | ENDED | **PASS** | PASS | `449e6af3` → `1a0cf6b1` | 47s | 9 | 50,590 |
| t3-add-node-median | **COMPLETED** | ENDED | **PASS** | PASS | `63a3a0fe` → `371edbe8` | 206s | 31 | 196,331 |
| t4-add-python-slugify | FAILED | ENDED | FAIL | PASS | `68e9e56c` → **unchanged** | 19s | 7 | 37,156 |
| t5-multifile-node-discount | FAILED | ENDED | FAIL | **FAIL** | `016e94fd` → `8591a392` | 37s | 11 | 62,240 |

t1 and t4 ended with the surviving tree **identical to the starting tree** — they finished
without changing anything, in 29s and 19s. That is the 12–19s stall shape, now ending cleanly
rather than consuming the budget.

## Against PILOT-1, same queue

| | PILOT-1 (1.5B) | PILOT-2 (7B) |
|---|---|---|
| verified completions | 0/5 | **2/5** |
| terminations | 5 TIMEOUT | 5 ENDED |
| wall clock | 26m06s (budget consumed) | **6m14s** |
| tool calls | 5 total | 7–31 per task |
| evaluator PASS path | never exercised | **exercised** |
| report | failed, reconstructed by hand | **generated automatically** |

**This is a configuration comparison, not a controlled one.** Parameter count, serving stack,
hardware and latency all changed together. It does not isolate model size.

## The two rows PILOT-1 left open are now closed

**Automatic reporting: WORKS.** Every required field is populated with no reconstruction — the
only nulls on a task are `partialPreservedAt` (nothing was preserved because nothing timed out)
and `d2`, for the reason below.

**Live evaluation: EXERCISED.** Two PASS verdicts through the evaluator's live path, and zero
EVALUATION_ERRORs. The instrument ran clean.

## t5 BROKE EXISTING BEHAVIOUR

The only protected-behaviour failure, and it is worth reading precisely. The model edited
`cart.js` to apply the discount unconditionally:

    function cartTotal(items, percent) {
      return round2(items.reduce((a, i) => a + i.price * i.qty, 0) * (1 - percent / 100));
    }

`cartTotal(items)` with no percent now returns **NaN**. It also never added `applyDiscount`, so
it failed the requested behaviour too: it broke the old thing without delivering the new one.

## CORRECTION: d2 was INERT in both pilots

Both records said "enforced configuration". `AGENT_D2_ENFORCE=1` was set — but
**`AGENT_D2_TARGETS` was never set**, so d2 had no target set to establish and evaluated
nothing. `d2` is null in every task of both reports for that reason.

**Neither pilot says anything about d2.** The claim is withdrawn from both.

## And d2 would NOT have caught t5 anyway

This matters more than the configuration slip. `cart.js` after the break:

    loads; cartTotal(items) = NaN

It **loads fine**. d2 guards load-time regressions — START=LOADS + FINISH=THROWS — and this is a
behavioural regression in a module that still loads. Even correctly targeted, d2 would have
passed t5.

The independent evaluator caught it. That is a concrete instance of the scope limit already on
record: **d2 protects the properties it checks, not every possible bug.** The two instruments
are complementary and neither substitutes for the other.

## What this supports

SUPPORTED
- The unattended runner now accounts for its work AND reports it automatically.
- The evaluator's live PASS path works, and separates verified completion from a model's claim.
- On this frozen queue, the 7B configuration produced 2 verified completions where the 1.5B
  produced 0, and finished in a fifth of the wall clock.

NOT SUPPORTED
- Nothing about PROTOCOL-1. Still one arm, still no causal comparison.
- Nothing about d2, which was inert.
- No attribution to model size: too many things changed at once.
- Nothing about longer runs. The queue was exhausted in 6 minutes; that the runner can consume
  a 30-minute window is a PILOT-1 finding, and more time producing more useful work remains
  untested.
