---
name: gate-teaches-finding
description: "2026-07-16 measured — the gate's error messages are a product surface; every silently-tolerated mistake is a missed teaching opportunity. Arm B 1/5→3/5 correct after adding two error classes."
metadata: 
  node_type: memory
  type: project
  originSessionId: 3161c6a8-a149-4e43-93eb-2cc6c20ab7f4
---

RD-029/030/031 (2026-07-16, live Qwen2.5-Coder-32B on Modal, Pong authored from
plain-English goals on a runtime-born vocabulary):

**The result:** safety generalized off-farm immediately (0 unsafe, refusals left the
world byte-identical) but AUTHORABILITY did not — the model produced gate-legal rules
that did not play. Two SAFE-but-WRONG classes: the inverted clamp
`min:[max:[e,255],0]` ≡ 0 (gated honestly — `[0,0]` IS in range), and hallucinated
structure at rule level silently ignored (`of:{near:14}` dropped → a bounce firing
every tick that LOOKS right). Adding two localized errors (`degenerate_expr`,
`unknown_key` with placement hints) took arm B from **1/5 → 3/5 correct with 100%
precision while gate-passes FELL** — the gate stopped emitting plausible lies.

**The generalizable lesson:** the validator's error messages are a PRODUCT SURFACE,
not diagnostics. Both failures were cases where the gate already knew — it computed
the `[0,0]` interval, it parsed the unknown key — and threw the knowledge away.
Whenever the validator knows more than it says, the author (human or model) pays for
the silence. Look for this pattern in every future gate work.

**Two related standing lessons, both re-learned the hard way this session:**
- A weak oracle launders a wrong rule. The first scorer reported B 3/5 by asserting
  only "y decreased" — passing a rule that slams y to 0. Controls (a step not a
  teleport; an idle input that must not move; a FAR ball that must not reverse) gave
  the real numbers. RD-004/005's "check the test", one layer up.
- Verify AFTER the change, not before. The Modal endpoint was smoke-tested before an
  A100 redeploy that silently never stuck; the next run returned all-zeros.

**Open frontier:** arithmetic on fields is authorable; AGGREGATION
(`count ... of:{near}`, aggregation-inversion) is not — both aggregation goals failed
in every arm and run. That is the next authorability card, and it is NOT a
gate-message problem. Related: [[generalization-gate-open]],
[[capability-vs-proof-artifact]], [[no-local-models-hard-rule]].
