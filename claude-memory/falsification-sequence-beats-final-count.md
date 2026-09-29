---
name: falsification-sequence-beats-final-count
description: Owner requires the failure sequence preserved in the record; a final green test count must never stand in for it
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a8160f8c-9099-46b5-8e59-75485c848e44
  modified: 2026-09-20T05:47:52.017Z
---

When reporting autonomous work, preserve the **sequence of falsifications**, not just the end state. On 2026-09-20 the owner asked explicitly that a 452/452 green suite — which was green *while the defect it was meant to fix survived one layer up* — not be replaced historically by the later 464/464.

**Why:** a green suite is not evidence that a pipeline is correct; it is evidence about the propositions someone thought to assert. The 452/452 state is the counterexample to its own reassurance. Without the sequence (green-but-wrong → pipeline-level falsification → repair the deciding layer → representation-loss defect → repair → authority-alias defect → repair → green), the final number "radically understates what those tests now mean."

**How to apply:** in commit messages, ledgers and summaries, write the chain with its intermediate failures and name which layer each one falsified. Give the passing count last and as the weakest claim. Never open a report with the final count. Related: [[measure-the-thing-itself]], [[silent-failures-are-the-class]], [[fix-the-deciding-path-not-the-advisory-one]].
