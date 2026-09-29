---
name: legasus-production-decision-2026-09-22
description: "tatte's decision 2026-09-22 — keep Legasus as an experimental framework; use the simpler hardened baseline in production. The TC control showed Legasus's stale-evidence protection came from 8 lines of adapter code, not from Legasus"
metadata: 
  node_type: memory
  type: project
  originSessionId: 84a10d37-807c-4f1e-91a9-791e4112e34d
  modified: 2026-09-22T06:25:51.733Z
---

Value comparison (`VALUE-COMPARISON_RESULT.md`, integration repo): for analyse → save → restart →
reuse, a hardened baseline met every requirement in 42 lines; the Legasus arm needed 144 — and the
**TC control** (Legasus replay + admission with the 8 lines of explicit world comparison removed)
reused stale evidence in every scenario. Legasus's safety there was mine, not Legasus's. This is
exactly the boundary REPLAY_RESULT froze: reproduction is not currency.

**Decision (tatte):** keep Legasus experimental; use the simpler production checks. "Demonstrating
value requires multiple parties" was withdrawn as unestablished — a hypothesis, not a finding; more
parties could mean more custom checks with no advantage.

**How to apply:** no more internal Legasus arms. The only route to standing is a real consumer with
evidence from separately *controlled* sources; the consumer search found one that struggles
(`score_run.mjs`, fixed independently — [[comparability-unestablished-2026-09-22]]) but its producers
are same-owner, different-deployment: version drift, not separate authority. Neither common ownership
nor independent deployment licenses an inference about control. Any future Legasus benefit claim must
survive a TC-style control: strip Legasus, keep the surrounding checks, and the benefit must vanish.
Credit safeguards in the adapter/application to those components. Registry is still 3 rules, 0/15;
the eslint external mapping succeeded but every finding was eslint's. Related: [[legasus-discovery-charter]].
