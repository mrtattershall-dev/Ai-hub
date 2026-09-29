---
name: capability-vs-proof-artifact
description: "User guidance 2026-07-16 — RD records must measure the ARCHITECTURE capability independently of the demo project; Pong is a proof artifact, not the capability"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3161c6a8-a149-4e43-93eb-2cc6c20ab7f4
---

2026-07-16, user feedback on the RD-024 wrap-up: "I'd separate 'general-purpose
engine' from 'Pong ships.' Shipping Pong is an excellent demonstration that the
architecture generalizes, but the architectural milestone is really
'runtime-authored vocabulary works.' Pong is the proof artifact, not the
capability itself."

**Why:** conflating the two makes RD records murkier — the capability claim
should be falsified/confirmed by its own bars (as RD-024's three bars were),
and the demo is a separate, optional demonstration whose failure modes (game
design, tuning, UI) are not architecture failures. The project already paid for
this confusion once (the F2 retro: "proved the thesis" vs "you can build games
in it").

**How to apply:** when writing RD cards and STATE.md milestones, state the
capability bar and the proof artifact as separate line items; decide the RD on
the capability bars alone; ship the artifact as a demo with its own (non-RD)
success criteria. Applied first to: RD-024 (capability = runtime vocabulary,
decided) vs Pong (artifact, pending renderer/space/triggers). Related:
[[generalization-gate-open]].
