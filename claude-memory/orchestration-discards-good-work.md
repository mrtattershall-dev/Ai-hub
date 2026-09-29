---
name: orchestration-discards-good-work
description: "the agent protocol costs a 1.5B in TWO separate ways - it SUPPRESSES generation (body produced 4/10 with protocol vs 10/10 content-only, p=.031) and it DISCARDS finished files over a tool name (3 loading, contract-meeting artifacts lost to `ACTION: create_file`)"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-14T06:55:53.177Z
---

2026-09-14, qwen2.5-coder:1.5b and qwen2.5:1.5b, setH chain-opener goals, one attempt each,
decoding pinned, every raw reply preserved to disk *before* scoring. Two mechanisms, measured
separately. **I first found the second one and wrote it up as the whole story; the first is larger.**

## 1. SUPPRESSION - the protocol stops the model attempting the file at all

Three prompt shapes, paired by goal, same model, same decoding:

    A  THOUGHT / ACTION / PATH / fenced body     body produced  4/10   contract 1/10
    B          ACTION / PATH / fenced body       body produced  2/10   contract 1/10
    C  fenced body only (harness supplies both)  body produced 10/10   contract 5/10

On the endpoint *was a code body produced at all*, upstream of any parsing:

    A vs C   4/10 -> 10/10   6 discordant, 6 rescued, 0 reversed   exact McNemar p = 0.031
    B vs C   2/10 -> 10/10   8 discordant, 8 rescued, 0 reversed   exact McNemar p = 0.0078

In A and B the model emits a header and stops - **seven of B's ten replies were 35-39 characters.**
The contract endpoint (1/10 -> 5/10) is p = 0.219 and is NOT significant at that N: what is
established is that it attempts and delivers a loading file far more often, not that this converts.

**Replicated at N=20: reach 8/20 -> 20/20, 12 discordant, 0 reversed, exact McNemar p = 0.0005.**

**REPLICATED A THIRD TIME UNDER A CORRECTED INSTRUMENT (2026-09-14): 9/20 -> 20/20, 11 discordant,
0 reversed, p = 0.0010** - with the typed contract AND corrected prompts, so neither the scorer nor
the instruction is the one that was contaminated ([[contract-derivation-contaminated-treatment]]).

    4/10 -> 10/10  p = 0.031    old apparatus
    8/20 -> 20/20  p = 0.0005   old apparatus
    9/20 -> 20/20  p = 0.0010   corrected contract and prompts

Zero reversals in all three runs. Conversion on the common support was null all three times
(5/8 vs 5/8; 1/4 vs 1/4; 5/9 vs 4/9, every p = 1.000).

**CONVERSION IS FLAT, and the right way to show that is the COMMON SUPPORT.** Comparing 5/8 (62.5%)
against 12/20 (60.0%) is wrong twice over: Fisher p=1.0 shows no difference DETECTED, never
equivalence; and the denominators are differently selected, because the extra bodies in the
unrestricted arm are exactly the goals the other arm was prevented from attempting. Restrict to the
goals where BOTH arms produced a body, and pair there:

    N=20  common support n=8   5/8  vs 5/8    2 discordant, 1 each way   p = 1.000
    N=10  common support n=4   1/4  vs 1/4    2 discordant, 1 each way   p = 1.000
    pooled               n=12  6/12 vs 6/12   4 discordant, 2 each way   p = 1.000

The bounded claim: *under a ONE-SHOT implementation condition, removing deterministic orchestration
changed reach dramatically and produced no evidence of improved conditional correctness on the goals
both conditions reached.* It survives a repair loop later moving conversion.

**RETRACTED: "60% conversion is a genuine model property no harness cleverness will close."** A
repair loop IS harness architecture, and so are prompt decomposition, proof feedback and constrained
edits. Never write a floor claim while an experiment that could falsify it is still running.

**Removing THOUGHT made it worse, not better (4/10 -> 2/10 bodies, p = 0.625).** That was my
hypothesis and it is unsupported - do not "fix" the template by deleting THOUGHT.

## 2. DISCARD - the harness throws away finished files over the tool name

Re-scoring IDENTICAL preserved replies with the harness supplying tool and path:

    qwen2.5-coder:1.5b   contract  1/10 -> 3/10     rescued goals 1, 6
    qwen2.5:1.5b         contract  2/10 -> 3/10     rescued goal 8
    rescued 3, lost 0 across 20 replies (McNemar p = 0.25, NOT significant)

Those three bodies were extracted and executed: they **load and meet their export contract**. They
scored zero because the model wrote `ACTION: create_file` (twice) and `ACTION: Write`, or emitted no
`PATH:` line. Other invented names seen: `assert_all`, `include`, `define`, `export`.

**This mechanism did not reproduce in the three-cell run - the tax was 0 in all three cells there.**
Both are real; which one dominates varies run to run. Measure both, never assume.

**Why:** the orchestration language is a second task layered on the coding task. The harness already
knows the operation (it is a write gate) and the target path (`deriveGate` resolves the lead file
100/100). Requiring the model to restate both, in an exact vocabulary, costs it the goal twice over.

**How to apply:** record the chain stage by stage - *generated -> body detectable -> parser accepts
-> written -> loads -> contract* - and report TWO bottom lines: harness-observed (what the
architecture achieves) and artifact-available (what the bytes achieve with orchestration supplied).
The gap is the harness's own tax. Before concluding anything about a model from a low score,
re-score its preserved replies content-only.

**What content-only did NOT rescue, the honesty check that this is not just the harness typing for
the model:** `assert is not defined` (top-level asserts run at import), a file that loads but never
exports the required name (twice), an HTML page loading a script it never wrote, an unterminated
triple-quoted string, and `Identifier 'Cache' has already been declared`. Those are real defects and
they survive every scoring rule. Cell C also BROKE one goal that passed under full protocol.

**The token budget was never binding:** longest reply 1,918 chars against ~8,750. Every stop was the
model ending its own turn, so raising `num_predict` cannot fix any of it.

**Replication warning.** An earlier run of the same specialisation experiment gave the coder protocol
5/10; the corrected re-run gave 2/10, with nothing changed upstream of `parseAction`. Pure sampling
on a bimodal phenomenon ([[gate-prompt-suppressor]]). Under content-only scoring **both models land
on 3/10** - the "code specialisation is 5x better" reading of the first run is gone. Do not build a
per-model topology story on one N=10 run. See [[checker-branch-that-cannot-fail]] for the instrument
defects that inflated the first one.
