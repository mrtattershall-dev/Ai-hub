---
name: bind-2-support-result
description: 2026-09-21 BIND-2 on segments(): discrimination alone is insufficient (4/7 bit-vector clusters split under observed outputs); discrimination + outputs on the witnesses' own inputs yields 568 provenance-bearing anonymous edges and 3 multi-member S-classes that survived; dark mutants are dark by inputs not assertions; H4 wording defect
metadata:
  type: project
---

BIND-2 (legasus/BIND-2_PREREG.md, result legasus/out/bind2-segments/BIND-2_RESULT.md, commits
b26c9e7 / 51b9e33) added one mechanical evidence source to BIND-1: the subject's raw
input->output under each mutant, replayed on exactly the 57 inputs the witnesses pass.
Findings: H1 confirmed (identical discriminator sets hid distinct behaviour in 4 of 7
clusters); S6 {M006,M018}, S7 {M007,M019,M020}, S11 {M016,M017} survived as observationally
equivalent classes; all four dark mutants are output-identical on every recorded input (H2
falsified, blind for M022/M023); 0 incidental discrimination; BIND-1's site counter
corroborated. H4 as frozen conflated execution status with discrimination — second
prereg-wording defect (after P4).

**Why:** this is the prerequisite half for COVER/SUPERSEDE: support can be derived
mechanically WITH outputs, not from the matrix alone. SUPERSEDE remains forbidden.
**How to apply:** next falsification = replay S6/S7/S11/S0 on mechanically sourced inputs the
witnesses never pass (preregister the source first). Score every prediction against a dry-run
artefact before freezing a prereg. See [[bind-1-segments-result]].
