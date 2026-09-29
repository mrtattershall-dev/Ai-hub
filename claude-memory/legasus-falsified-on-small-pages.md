---
name: legasus-falsified-on-small-pages
description: 2026-09-28/29 — Legasus manager falsified on small pages; no narrowed interface has a surviving acceptance anywhere; instruction LOCATION moves the failure mode but not the outcome; the defensible goal is recorded in LEGASUS-GOAL.md
metadata: 
  node_type: memory
  type: project
  originSessionId: 784f5dee-d411-40db-b5ec-cf91b8f4605f
  modified: 2026-09-29T07:22:39.368Z
---

Worktree `ai-coding-hub-phase1`, branch `phase2-d2-intervention`. Records: `FALSIFICATION-1.md`,
`AUDIT-2_STAGE4_RESULT.md`, `FARM-GATE-CORRECTION.md`, `PRESENTATION-1_RESULT.md`, `LEGASUS-GOAL.md`,
`MODEL-DOSSIER-1.md`.

**AUDIT-2 ($0.417 of a $5 cap from Micheal): the manager was falsified.** Direct whole-page 7B matched
it 6/6 in 6 calls against 13, and on the accumulating ladder completed every generation in one call
while the manager needed 2-4 and could not attempt a `type`-triggered rung at all. **Zero regressions
from either arm**, so the safety machinery had no danger to prevent.

**No narrowed generation interface has a surviving acceptance on ANY family.** NARROW-1 was 0/5;
NARROW-2's single acceptance **fails the corrected gate** — the farm subset had dropped step 8's
trailing `noErrors`, so throws during the movement it was accepted for were invisible. Also: NARROW-1/2
were **whole-artifact** protocols ("Return the complete index.html… not a patch"), so "bounded edits won
on farm" was never a contest anyone ran.

**PRESENTATION-1 (12 pages x N/H/S, $0):** with intent in an inline comment the model **closed the
document** 24/24; with intent in a separated section it produced page-aware executable code 12/12 —
then overran the hole 6/12. **Instruction location moved WHERE it fails, not whether it succeeds:
0 accepted in all three.** Live heuristic and state-verified re-score agreed exactly.

**The package is not "the raw 1.5B":** Q4_K_M, a baked-in helpful-assistant persona, and a template
that routes to FIM **only when a suffix is present** — so every experiment was also an undeclared
template-path choice. Verified on the wire by token accounting *plus* behavioural identity under a
discriminating control.

**Standing rules earned the hard way:** controls caught three instruments of mine that proved nothing
(an `|| true` assertion, a kill test that killed an unrelated pid, a re-score probe missing its
prerequisite closure). Freeze re-scorers *before* inspecting outputs. Never let one measurement carry
two claims. The mission is **crowded, not untouched** — see [[legasus-production-decision-2026-09-22]],
[[product-north-star-autonomous-builder]].
