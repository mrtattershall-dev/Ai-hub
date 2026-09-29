---
name: monolithic-protocol-ceiling-7b
description: "2026-09-22 — 7B AND 1.5B both fail the hub's monolithic ACTION loop the same way; 7B used 12-19s of a 600s budget with identical trajectory at 60s and 600s, so the Legasus 60m campaign was stopped unrun"
metadata: 
  node_type: memory
  type: project
  originSessionId: 784f5dee-d411-40db-b5ec-cf91b8f4605f
  modified: 2026-09-22T17:12:11.512Z
---

2026-09-22, Phase 2 qualification ladder on Modal A10G. **The Legasus 60-minute paired campaign
was NOT run**, at its own frozen stopping criterion.

    RUNG   ARM  effective/budget      productive target writes   terminated by
    1m      A   15s / 60s             0                          repetition
    1m      B   19s / 60s             1 (+2 refused)             repeated refusal
    10m     A   12s / 600s  (2%)      0                          repetition
    10m     B   18s / 600s  (3%)      1 (+2 refused)             repeated refusal

**A 10x budget increase produced a near-identical trajectory** — same tool sequences, same
terminal reasons, same step counts. The stall is structural, not stochastic.

    ARM A  outline_file x6 on a 3-LINE file, after the hub handed it the contents
    ARM B  ONE valid edit to lib.js, then a hallucinated FIND ("console.log('Hello World!');",
           0 occurrences) on a file it never read, then the SAME FIND again

**Why:** this is NOT "7B is bad". ~11 calls/min was available and only 6-7 were used. The tools
worked; both refusals were legitimate; the repeat guards are correct mechanical recovery. What
failed is sustained operation under the interaction protocol. The 1.5B failed the SAME way one
size down (~20 calls, ZERO protected-target writes) — [[protocol-not-capability-ceiling]]
reproduced twice.

Careful on interpretation: what is established is that the failures occurred DESPITE the hub
supplying the required information, and are CONSISTENT WITH state-tracking / action-selection /
exact-text bookkeeping failures — NOT that a lack of coding knowledge has been ruled out.
Re-requesting an already-seen file could still be an attention or planning limit. PROTOCOL-1 is
what decides it; do not assert the bookkeeping reading as established before then.

**How to apply:**
- Do NOT weaken the repeat guards, loosen edit semantics, or upgrade to 14B to escape this.
  Do not tune prompts around the two specimens.
- The next experimental variable is PROTOCOL ARCHITECTURE: `legasus/screen/PROTOCOL-1_PREREG.md`
  — gated micro-loop (OBSERVE/DECIDE/PRODUCE/APPLY/VERIFY), model keeps intent authority, the
  controller takes bookkeeping authority. Baseline to beat: 12-19s, 6-7 calls, 0-1 writes.
- Before any long autonomous campaign on this hub, run a SHORT eligibility rung first and
  compare effective-runtime-used against budget. 2-3% used means a longer budget buys nothing.

Phase 2 standing at close: mechanism ESTABLISHED (36/36 real-hub control, c506b90); Legasus
autonomous benefit NOT MEASURED. See [[legasus-phase1-integration-done]] and
`legasus/screen/PHASE2-INTERVENTION_PREREG.md` Amendment 14.
