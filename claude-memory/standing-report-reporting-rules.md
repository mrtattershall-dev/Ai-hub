---
name: standing-report-reporting-rules
description: "tatte's five standing corrections for the Legasus standing report — separate local prevention from campaign benefit, label failures by tense, never credit the calculus for d2's refusal"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: de899dc4-22bd-4614-9c74-c8768ac7b97d
  modified: 2026-09-22T17:56:53.796Z
---

2026-09-22, tatte's review of revision 5. Five rules for every future revision of the standing
report (and for any Legasus result write-up):

1. **Separate local prevention from campaign benefit.** One valid live intervention with
   independently confirmed damage supports prevention *in that episode*. Sustained productivity
   and economic advantage stay unknown. Never collapse them into "whether refusing helps is
   unknown".
2. **Narrow protocol conclusions to the tested configurations.** The ladder establishes early
   termination under what was run. "Structural, not stochastic" and "cannot host autonomous runs
   regardless of protocol" exceed it. If PROTOCOL-1 stalls, that falsifies *this*
   responsibility-narrowing intervention, not all protocols.
3. **Keep implemented / probes-passed / not-established as three separate columns.** Deleting a
   ref removes a name, not the objects; reduced discoverability is not access restriction.
4. **Label failures by tense:** historical failure → current containment or repair → residual
   limit. Preserve the failure, but state the current status beside it.
5. **A Legasus-owned enforcement gate is not a consumer of the authority calculus.** Verified in
   source: `server/d2.js` imports only node builtins and shells out to git — zero references to
   legaknow, calculus, isAuthority or delegate. Credit the *discipline*, not the calculus.

**Why:** revision 5 mixed historical results, current implementation and work in progress enough
to obscure a real category change, and over-credited in two directions at once.

**How to apply:** before sending any revision, check each of the five against the record — not
against the previous revision's prose. See [[legasus-phase1-integration-done]] and
[[detector-semantics-vs-route-governance]].
