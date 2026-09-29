---
name: generation-interface-masks-capability
description: "Five apparatus defects in a row each looked like a 1.5B capability limit; all found by dumping wire bytes, none by reading harness code"
metadata: 
  node_type: memory
  type: project
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-15T03:05:19.658Z
---

2026-09-14, setH 1.5B behavioural lane. Five defects in the model/harness interface, each of which
first presented as "the 1.5B cannot do semantic edits", and each found by reading actual request and
reply bytes rather than harness code or aggregate scores:

1. **No instruction channel.** `replaceBehaviour` called `fimFn(prefix, suffix)`; the goal text never
   reached the model at all.
2. **Colliding prompts.** Goals 64 and 74 target the same function, so both sent a byte-identical
   prompt (sha `fb9fb8a8…`/`4d1d0de0…`). Passing both was arithmetically impossible.
3. **Zero-width FIM hole in a complete program.** Prefix+suffix already formed valid code, so EOT was
   the honest completion and the model gave it (6 of 26 steps).
4. **No boundary on generation authority.** The correct first statement followed by up to 2430 bytes of
   unauthorised material; 14/31 steps continued the *instruction comment's own format* as a pattern.
5. **Under-specified body intent.** Told to add a branch and not to alter existing ones, the model ADDED
   a redundant branch shadowing them (`else: current.append(...)` on top of the existing accumulation →
   every line counted twice) and borrowed `codes`/`links`, which are locals of a *neighbouring*
   function visible in the prompt.

**The architectural principle that came out of it:** it is not enough to instruct the model. Shape the
context so the wanted fragment is the NATURAL CONTINUATION, and put everything beyond it outside the
model's write authority. Two separate obligations — prompt geometry and harness authority. This also
explains why v2's `def between(` worked: barely an instruction, but it made the wanted code the only
possible continuation.

**The design question this leaves** (more useful than any pass count): each fix moved work from the
model to the plan — locations, order, indentation, identifiers, scope/fall-through. If the plan must
specify that much, the hard problem is *generating the plan* and the generator's role shrinks toward
transcription. Ask that before spending another amendment.

Method that worked and should be standing practice: preserve every wire request and raw reply, then
recompute criteria post-hoc — twice this session a checker bug was fixed with zero new inference. And
distinguish the earliest causal BOUNDARY from a bad snippet with a 2×2 counterfactual replay
(reference-vs-model predecessors × reference-vs-model snippet at site k); four byte-identical endpoints
turned out to have two different causal sites, so an endpoint is not a diagnosis.

Related: [[measure-the-thing-itself]], [[contract-derivation-contaminated-treatment]],
[[over-strict-checkers-invisible-to-known-bad]], [[gate-prompt-suppressor]],
[[protocol-not-capability-ceiling]], [[qwen-coder-1p5b-fim-native]]
