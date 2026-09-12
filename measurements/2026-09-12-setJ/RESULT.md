# Set J — RESULT: the fixes worked, and the instrument cannot show it

tatte: **"Run the moe again"** → **"Also run 14b and do the same"** → **"Just run 14b 32b and coder 3 all three. We need
a full comparison and data to build a mock model to make it better."** → **"I want 100 percent of the code looked at
now. There's something wrong here that isn't adding up."**

The last instruction is the one that mattered. The scores are the smaller half of this document.

## The scores

Each arm is scored over the goals it actually reached, against a target recomputed over that same range from the
baseline arm's own per-goal results. That rule was fixed before any set J number was visible.

| arm | reached | score | target | delta |
|---|---|---|---|---|
| 14B `Qwen2.5-Coder-14B-Instruct-AWQ`, A10G | 16/20 | **4** | 3 | **+1** |
| coder3 `Qwen3-Coder-30B-A3B-Instruct`, H100 | 18/20 | **14** | 15 | **−1** |
| dense `Qwen2.5-Coder-32B-Instruct`, H100 | 18/20 | **9** | 6 | **+3** |

Serving `ai-coding-hub-indent` @ `3d7a080`, `agent.js` md5 `d53b1f230cb0`, verified in each arm's own log. Goals and
checker byte-identical to sets H and I. Cost **$9.76** (set I was $2.90; $12.66 of the $20 budget).

## What the two fixes actually did

**`noChangeAt` never fired. Not once, on any arm.** It was installed on the two tolerant `NO CHANGE` sites, but the
traffic goes through `agent.js:714` (`find === replace`) — on set H's 14B that was **22 of 22**. Prediction 1's entire
mechanism never operated, so nothing about the 14B's +1 is evidence for it.

**`reindentTo` is dense-32B-only on this workload.** The FIND path is 55% of the dense arm's writes but 19% (14B) and
15% (MoE). Tolerant matches: dense **19**, 14B **4**, MoE **1** — the same ordering as the deltas (+3, +1, −1). That is
the pattern the mechanism predicts. It is also **three points**, and the design needs **+6** to detect an effect;
+3 gives **p = 0.24**. Consistent with, not evidence for.

## Why twenty-plus fixes across sets D–J have barely moved the score

Not "the fixes failed". **The fixes worked and the instrument cannot show it.**

Destruction of working code: **33% (set F) → 18% (set G) → 0 of 50 (set H)**. Duplicate-definition files: **10 → 2**.
Real, countable, and nearly exhausted. What suppresses the number is the measurement:

**Goal coupling.** Goals 11–20 are step 2 of goals 1–10's projects and each re-exercises the first pass's API. Over 8
arms × 10 projects:

- P(second pass | first **passed**) = **0.563**
- P(second pass | first **failed**) = **0.083**

A **6.8× penalty**, 4 recoveries in 48. So 20 goals are ~**10 independent tasks**, single defects are double-counted,
and a model right on 7 of 10 projects tops out near 11/20. Set J reproduces it: projects failing *both* passes — 14B 5,
dense 3, MoE 2. Worse, a file that does not parse fails all ten of its goals at once (set H's 14B control lost 48 of
100 that way), and `s10_desk.js` needs `s1` and `s7`, so one broken `s1_library.js` costs goals 1, 10, 11 and 20.

**Every percentage this project has published is against the wrong denominator.**

## The failure mode moved rather than vanished

| arm | budget | loop guard | clean | infra |
|---|---|---|---|---|
| 14B (baseline 0 / 13 / 5) | 1 | **7** | 7 | 1 |
| MoE (baseline 0 / 1 / 15) | 2 | **0** | 13 | 0 |
| dense (baseline 2 / 5 / 11) | 4 | **1** | 13 | 0 |

Loop deaths fell on every arm; budget deaths rose. And on the 14B the loop-death drop (13/20 → 7/16) bought almost
nothing: goals ending in a loop scored **1 of 7**, goals ending clean scored **3 of 7**. Fixing loop deaths is not the
lever that raises scores.

Per pass: 14B create 3/10, extend 1/6 · MoE create 8/10, extend 6/8 · dense create 5/10, extend 4/8.

## The audit — ten agents, 100% of the code

`audit/` holds ten reports (~216 KB). The load-bearing findings:

- **The scorer is sound.** Hand-written prose-faithful solutions score **8/8**; re-scoring reproduces byte-for-byte.
  Two of twenty goals do disagree with their prose (goal 7 silently requires `has()` not to count as a use; goal 12
  silently defines "blank" as whitespace-only). The instrument that, had it been broken, would have voided every
  measurement this project ever published — is not broken.
- **A wrong self-test zeroes correct code.** The goals *order* the model to write asserts. `neutral.cjs` rescues
  `require('assert')` and `console.assert`, but **not** a hand-rolled `if (…) throw new Error(…)` — that fails all ten
  steps of a chain. The auditor counted ~120 such rows across the archive.
- **`console.assert` cannot fail.** Verified: two failing assertions, then `All asserts passed!`, `EXIT CODE: 0`.
- **The loop guard disarms itself on success.** `recentAt` pairs each remembered reply with a `landed` count, so a
  model repeating one reply whose write lands every time can never match. Three runs reached `repeatCalls` 23–27 and
  died on the budget instead. Nothing in the file ever compares `repeatCalls` to a threshold.
- **The repeat warning is advisory and ignored**: fired 219 times, repeated on the very next call 164 times (75%).
- **The destructive-write guard's "Earlier steps depend on those" is a hardcoded string** that nothing checks; in 11
  of 12 refusals the named symbols had zero call sites.
- **tatte's hypothesis, confirmed and generalised.** Every worktree carries **2 files in `assets/` against 13,525 in
  the main checkout**, and none has `hub.json` or `vendor/godot` — because a git worktree does not carry gitignored
  files, while `ASSETS_ROOT` still points at main. Structural, and it will bite any ignored-but-required file in any
  future worktree run.

## Fixed tonight, and traced to the destination

Both committed at `141b634`; serving digest moves `d53b1f230cb0` → `8b2d02f4a9eb`. All 11 consumer tests match their
pre-change baseline exactly.

1. **`append_file` now captures `beforeSrc`.** Four guards gate on `beforeSrc !== null`, so leaving append out made
   all four unreachable for the one write tool the prompt calls *"the easiest and safest way to extend a file"*. Set J
   run `17cc6854`: 26 appends left `add_assignment` defined **23 times**, 826 → 8973 bytes, zero refusals.
   **Traced through a live hub after the change:** the second append answers `would have DUPLICATED 1 definition(s)
   g.py already has: add (1 -> 2)` and the file keeps one definition.
2. **`scanTolerant`'s region starts where FIND matched.** It skipped blanks while matching but anchored the region at
   the scan index, so the splice deleted a separator the caller never named — and because a swallowed blank guarantees
   `out !== content`, it also defeated `noChangeAt` in the exact case that refusal exists for. **Traced by lifting the
   shipped function out of `agent.js`:** region now starts on `"  b() {"`, and a resend is a true no-op.

## Two fixes deliberately NOT made

- **The EXIT anchor.** The repeat notice is appended after the trailing `EXIT: n` while the classifier is anchored to
  end-of-string, so annotating a failing command hides its failure. Real — but `batchStepFailed` only runs with
  `AGENT_BATCH_ACTIONS=1`, which no measurement set has used. A correct fix wired to a dead branch.
- **A stricter finish gate.** Nine runs finished `verified: true` carrying a non-zero exit. **Seven of those nine
  scored `impl=Y`.** Both that scored `n` failed on `test_s1_library.js:4 describe(…` — a mocha file run with plain
  `node` — which was unrelated to why they failed. A stricter gate would have blocked seven correct runs and caught
  zero. Dropped.

## What I got wrong

- **`targetOverRange` had zero call sites.** I wrote the truncation rule, documented it as fixed "before any number
  was visible", and never wired it in — so the 14B was printed against a full-20 target of 4 instead of 3/16. The
  silent-failure class I spent the night hunting, committed inside the tool built to prevent it.
- **Running three arms concurrently cost goals.** 116 s/goal solo (set I) vs 165–178 s/goal three-up; goal 9 went
  54 s → 344/377/579 s. Every arm truncated at 16–18 instead of 20. My call, justified as "same GPU-seconds, less wall
  time", without considering contention.
- **The design was underpowered before the window opened.** Fisher exact on my own pre-registered +3 for the 14B
  gives p = 0.24; detection needs +6. I wrote "only a clear margin counts" into the pre-registration and then
  predicted a margin the design could not resolve.
- Claimed a fix was stranded on an unmerged branch; the branch was fully contained in the serving tree.
- Claimed the 14B was time-starved from `tok/s min 0.7`; per-call timing was 20.7 s vs 13 s on H100, not 7×.

## What this does NOT settle

Twenty goals, one run per arm, three arms run concurrently on shared hardware. The dense arm's +3 is the only movement
outside noise, it is p = 0.24, and it is the one arm where the shipped fix could act. That is suggestive and no more.
The binding constraint is no longer in the hub: set H's MoE attempted 53, ran 50, destroyed 0, and scored 39 — leaving
eleven goals **written, run, survived, and simply wrong**.
