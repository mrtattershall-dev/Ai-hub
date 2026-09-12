# Set J — do the two hub fixes move the number? (PRE-REGISTRATION, written before the window opens)

tatte: **"Run the moe again"**, then **"When you run the moe again make sure you watch EVERY step again. Also run 14b
and do the same"**, then **"Just run 14b 32b and coder 3 all three. We need a full comparison and data to build a mock
model to make it better."**

Three arms, one hub, the same twenty goals and a byte-identical checker. The only variable is the hub.

## The question

Set I answered "is it us or the model?" with **the model** — a dense 32B scored 6/20 where a ~3B-active MoE scored
15/20. But it also produced two *hub* defects with a measured cost, and set H's 14B arm lost **13 of its first 20
goals** to the loop guard. Set J asks the narrower, more useful question: **with those two defects fixed, does the
score move?**

## The independent variable — two fixes, both proven red-first

Serving tree `ai-coding-hub-indent` @ **`3d7a080`**, `agent.js` md5 **`d53b1f230cb0`**.

1. **`reindentTo()` + `regionAnchor()`** — a tolerant edit is re-indented TO the region it replaced. Set I goal 3: the
   model sent a *correct* edit at 2-space indent against a 4-space file; the splice lifted `shape()` out of its class
   and the destructive-write guard correctly refused a correct edit. Four identical retries, then the loop guard. The
   weaker MoE scored that same goal.
2. **`noChangeAt()`** — a no-op refusal now shows the region with line numbers and says the edit may **already have
   landed**. Set I goal 16: the model had landed its de-indent at call 14, re-sent it at calls 18-21, and was told
   "NO CHANGE" four times. The hub was right every time; it just never showed the region. **Four of that run's five
   loop-guard deaths were refusal-retry loops.**

Both are pinned by tests that were observed to FAIL first. `tolerantIndent.test.mjs` additionally had two assertions
that passed *vacuously* — they were repaired before the fix, and that repair is what caught the first version of the
fix being a silent no-op (it parsed, ran on both paths, and changed nothing, because `scanTolerant` anchors regions on
blank lines).

## Arms, with exact identifiers read from the deploy logs

| label | HF model | precision | goal-20 target |
|---|---|---|---|
| `coder14b-setj` | `Qwen/Qwen2.5-Coder-14B-Instruct-AWQ` | **AWQ 4-bit** | **4/20** (set H, checkpoint `42ebd75`) |
| `coder30b-setj` | `Qwen/Qwen3-Coder-30B-A3B-Instruct` | bf16 | **15/20** (set H, checkpoint `064e062`) |
| `coder32b-setj` | `Qwen/Qwen2.5-Coder-32B-Instruct` | bf16 | **6/20** (set I, its own 20 goals) |

**Stated confound, not discovered afterwards: the 14B is AWQ-quantised and the other two are bf16.** Any reading of
"the 14B is worse" is partly a statement about AWQ, not only about parameter count.

Every target was re-scored at that arm's **own goal-20 checkpoint**, rebuilt from its `workspace.bundle`, because the
checker scores the final workspace and the set H arms ran 100 goals. Both reconstructions moved +1 (MoE 14→15, 14B
3→4), which says the method is consistent rather than flattering either arm.

## Held constant

    goals    goals-J20.json — byte-identical to set I's goals-I20.json
    checker  tools/checks-J.mjs — md5 e3e9aaaa5811ee7a, byte-identical to sets F/G/H/I
    caps     AGENT_MAX_STEPS=30, AGENT_MAX_MINUTES=8, supervisor off, fresh empty workspace

**`AGENT_MAX_STEPS` stays 30 deliberately.** tatte asked whether to raise it to 60. On goals 1-20 the budget is not the
constraint — exhaustion is **0/20 (MoE), 0/20 (14B), 2/20 (dense)**. Set G's "the budget is the ceiling" was measured
over *100* goals, where the MoE hit it 21 of 53 times; that is a late-run effect. Raising it here would cost GPU time
and confound the only thing this run measures. Raise it for the next 100-goal run, where it demonstrably binds.

## The run serves the tree it measures — enforced, not assumed

`trialJ.mjs` used to spawn the hub from the **main checkout** while the provenance line reported `HUB_TREE`. Set J
would have served the *unpatched* hub, labelled it patched, and concluded the fixes changed nothing. Now:

- `HUB_ENTRY` and `fullAgent.mjs` both derive from `HUB_TREE`;
- `HUB_TREE` is an **inline prefix** on the `node` command, because a bare bash assignment is not exported to children;
- `run-setJ.sh` greps the served `agent.js` for `reindentTo`, `regionAnchor` and `noChangeAt` and **refuses to start**
  if any is missing — verified to refuse on the main checkout and accept on `-indent`;
- provenance records the serving tree's sha **and** the served `agent.js` md5, since a worktree can be dirty.

## Predictions, fixed before the window

1. **The 14B gains most.** It lost 13 of its first 20 goals to the loop guard, and four of set I's five loop-guard
   deaths were refusal-retry loops — exactly what `noChangeAt` targets. **Predict 14B ≥ 7/20** (from 4). Falsified at
   ≤5.
2. **The MoE moves least.** Its first 20 goals were already 15 clean / 1 loop-guard, so there is little for these
   fixes to recover. **Predict 15-17/20.** A large jump would suggest something other than the fixes is in play.
3. **The dense 32B gains, but stays last.** Goal 3 is directly addressed by the re-indent fix and goal 12 was an
   environment loss these fixes do not touch. **Predict 7-10/20** (from 6).
4. **No arm reaches 20.** These fixes remove tool-induced losses; they do nothing about a model that writes code
   contradicting its own asserts (the `<p>` regression, `if weight <= 0` without coercion).

## Recording — half the deliverable

tatte: *"We need a full comparison and data to build a mock model to make it better."* So the traces are corpus, not
by-product. Per arm: run files with every step's `args` and `result`; untrimmed transcripts (`{ts, n, kind, sent,
reply}`) because `run.history` is a pruned window; traces; `index.jsonl`; the scored workspace copy; and the workspace
git bundle with every checkpoint. The temp trial directory is preserved, since the records tar excludes `.git`.

## Cost

~$2.90 of the $20 went to set I. Three H100 arms at ~$4.40/hr for ~45 min each ≈ **$9-11**, run concurrently so wall
time is one window rather than three. Watchdogs armed before any GPU time; stops go through `stopApp.mjs` only
(Rule 7a). AC power verified.

## What will NOT be claimed

Twenty goals, one run per arm. Set H measured the run-to-run spread at ±1-2 over 54-59 goals, so proportional noise on
20 is larger. A 1-2 goal move means nothing; only a clear margin counts. And a gain here is a gain on *goals 1-20 of
this goal set* — not evidence that a 100-goal run holds together, which is the actual north star.
