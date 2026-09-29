---
name: assist-1-ceiling-exists
description: ASSIST-1 step 1 2026-09-27 PASSED - the local 1.5B produced a working, independently verified, error-free planting handler at $0 under 7 human interventions; that ledger is now step 2's specification
metadata:
  type: project
---

2026-09-27, ASSIST-1 step 1, **$0 local**: the ceiling exists. `qwen2.5-coder:1.5b` produced a
planting handler that passes the unchanged gate, all three invocation paths, AND the stricter
no-error spec (steps 1-7, zero errors). **First accepted addition in this programme that is
also error-free.** Three accepted candidates, byte-identical, four lines:

    if (!tiles[k] && inventory.seeds > 0) { tiles[k] = { crop: 'wheat', stage: 0 }; inventory.seeds--; }

    round  intervention added                  attempts  accepted  regressions  code
      1    (I1-I5 carried in)                     5         0          0        2/5
      2    I6 hole becomes the handler BODY       5         0          4        5/5
      3    I7 trim at the suffix boundary         5         3          0        5/5

**What made the difference:** I6 - round 1 failed identically 5 times because the model bound
the file's own broken `plantSeed`, which never spends a seed, so no wiring could pass; shrinking
the hole to the logic moved insertion 2/5 -> 5/5. I7 - round 2 inserted code every time and broke
the page 4/5 by running past a small hole (15-147 lines where 4 were wanted); cutting at the
first line of the suffix took 0 accepted -> 3. And [[accepted-page-threw-during-required-behaviour]]'s
verified baseline: movement preserved 5/5 throughout.

**THE INTERVENTION LEDGER IS THE SPEC FOR STEP 2** (Legasus making these decisions itself, zero
interventions): I1 choose the unit of work, I2 choose the interface, I3 choose the instruction's
SHAPE, I4/I6/I7 observe how the output overshot its slot and move the boundary, I5 validate the
baseline first. I4/I6/I7 share a form a system can apply mechanically; I1-I3 are decomposition
and framing.

Counts to beat in step 2: 15 attempts, 3 accepted, 4 regressions all restored byte-exact, 766 s
generation, 1,247 s end to end, 7,524 tokens, $0.00, SEVEN human interventions.

**Why:** this settles that earlier "no accepted handler" results were about the tested
configurations, not the model - but only the specific claim holds: under THIS assistance, THIS
model does it. Nothing is established about less assistance, a second increment, or an
unfamiliar failure.

**How to apply:** when a model reuses a broken existing function, shrink the hole to the logic
instead of arguing with the prompt; when it overshoots a small hole, cut at the boundary it
crossed. Both are mechanical. See [[instruction-shape-dominated-the-result]],
[[active-diagnosis-engine]], [[one-handler-task-still-unbuilt]] (now superseded on its central
point).
