# BIND-2 result record — approvalPolicy.js::segments (read once, 2026-09-21 00:25)

Preregistration: legasus/BIND-2_PREREG.md (b26c9e7). Raw artifacts: this directory, committed
before this file was written (51b9e33); bind2.json sha256 ac0da7dc9447176e82b33049fca749631c8d7a3bc75ef3249a4bda22dd7c0a5d.
Attempt OBSERVED (4 load samples, count 9, calibration 29.9-32.5ms of 105). Controls C1-C5 all held.
Apparatus dry run on the toy (legasus/out/bind2-toy): OBSERVED, controls held, known answers reproduced.

## Exact preregistered claim

That a provenance-bearing support representation can be derived mechanically from BIND-1's
discrimination matrix plus ONE additional mechanical evidence source - the subject's observed
input->output behaviour under each perturbation, on exactly the inputs the witnesses pass -
without a human naming any obligation; with six predictions (H1-H6), five controls (C1-C5),
and typed refusals that never collapse to false/0/empty.

## Raw observations

- Recorder: 93/93 PASS, exit 0, identical per-case outcomes to BIND-1's baseline (C1). 87 calls
  to segments() recorded, 57 distinct argument strings, 0 orphan calls. Every case BIND-1 marked
  executed recorded >=1 call; every NOT_EXECUTED case recorded 0 (C4).
- Replay: 36 served files (pristine, M000 identity, 34 mutants) x 57 inputs, fresh process each,
  0 APPARATUS_FAILURE. Identity copy identical to pristine on all 57 (C2). M001 shows a raw
  delta in every case BIND-1 discriminated it (C3).
- Joined states over 3162 (mutant, case) records: LICENSABLE 605, UNASSERTED 276,
  NO_DIFFERENCE 1991, NO_INPUT 204, UNOBSERVABLE 86 (M002's post-death cases, carried through).
  INCIDENTAL 0. DELTA_WITHOUT_EXECUTION 0.
- 22 S-classes. S0 = {pristine, M000, M010-M014, M022, M023, M025, M028}. Twenty-one non-S0
  classes: 18 singletons, and three multi-member classes S6 {M006, M018}, S7 {M007, M019, M020},
  S11 {M016, M017}.

## Predictions, scored against the frozen wording

H1 CONFIRMED. 4 of 7 multi-member BIND-1 clusters SPLIT under the output instrument:
   {M001,M024,M029,M033} -> 4 classes (pairwise they differ on 3-18 of 57 inputs);
   {M003,M004} -> 2; {M030,M032} -> 2; {M008,M021} -> 2. Identical discriminator sets were
   hiding behaviourally distinct perturbations in more than half the clusters. Three clusters
   did not split (S6, S7, S11).
H2 FALSIFIED (blind for M022/M023). All four dark mutants are in S0: NO_DIFFERENCE on every
   recorded input, including M022/M023, whose site 87 cases execute. My prediction that at least
   one would be UNASSERTED was wrong. This mechanically settles BIND-1's open question in the
   direction "equivalent under the recorded inputs, not an apparatus miss" - and only that far:
   nothing here says they are equivalent on inputs the witnesses never pass.
H3 CONFIRMED. 0 INCIDENTAL: every DISCRIMINATED_BY_FAIL record coincides with a raw output change
   on that case's own recorded inputs. On this subject, witness failure is explained by the
   return value in 604/604 cases.
H4 FALSIFIED AS WORDED - AND THE WORDING WAS MY DEFECT. 87 conflicts, all in S0, all of one kind:
   NOT_EXECUTED vs EXECUTED_NOT_DISCRIMINATED among output-identical mutants. The frozen text
   said "identical BIND-1 klass", which conflates execution status with discrimination.
   Post-hoc view, labelled as such: on discrimination alone there are 0 conflicts in any class.
   S0 was never an edge target, so no edge was blocked either way. Same species as BIND-1's P4:
   a prediction that could not be cleanly scored from the artefact it names.
H5 FALSIFIED. 0 (mutant, input) pairs where the witnesses' trim hides a raw delta.
H6 CONFIRMED. M010-M014 (NOT_EXECUTED in all 93 cases by BIND-1's V8 site counter) show zero
   delta on all 57 inputs. An independent instrument agrees with BIND-1's execution claim.

## Support relations established (mechanically, with provenance; no meaning attached)

568 licensed edges (case c --supports--> S_k), each carrying: the class's mutants, the case's
recorded inputs, O_0 and O_m per input, the BIND-1 record, and both executable identities.
Per class: S1 71, S2 1, S3 54, S4 54, S5 16, S6 21, S7 6, S8 3, S9 6, S10 7, S11 4, S12 3,
S13 71, S14 2, S15 6, S16 71, S17 15, S18 3, S19 15, S20 71, S21 68.

The nontrivial ones - the ones that are NOT a restatement of the matrix:
  S6  {M006, M018}       identical outputs on all 57 inputs AND identical discrimination (21 cases)
  S7  {M007, M019, M020} identical outputs on all 57 inputs AND identical discrimination (6 cases)
  S11 {M016, M017}       identical outputs on all 57 inputs AND identical discrimination (4 cases)
Two independent lines of mechanical evidence agree that, as observable by this witness set,
these perturbations are the same. They survived H1, which broke four of their siblings. That is
the "at least one nontrivial support relation derived mechanically that survives an
independently specified challenge" the task asked for - three of them.

## Support relations refused (typed)

1385 refusals: NO_DIFFERENCE 901, UNASSERTED 272, NO_INPUT 126, UNOBSERVABLE 86, CLASS_INCONSISTENT 0
(post-hoc view; 87 under the defective H4 wording, all in S0).
UNASSERTED concentrates in the `ask` cases (8-11 each) and in S5 (71): the output of segments
changed in those cases' view and the classification they assert on did not. Recorded as a fact
about the witnesses; it is NOT an obligation and NOT the absence of one.

## Dark / unknown

- S0's nine mutants: indistinguishable from the subject on every input any witness passes. Whether
  any input distinguishes them is UNKNOWN; this experiment cannot say "equivalent".
- The meaning of every S_k: UNKNOWN by rule. Whether S6/S7/S11 are one requirement each or several:
  UNKNOWN. Whether two singleton classes are one requirement: UNKNOWN (the attack "one requirement,
  multiple signatures" is not resolvable by this design and was declared so).
- Anything about inputs never recorded.

## Controls

C1 recorder validity: held (93 PASS, per-case outcomes identical, outputs byte-identical to the
pristine replay on all 87 calls). C2 identity: held. C3 must-fire: held (71/71). C4 attribution:
held. C5 load: held. Apparatus dry run on the toy: known answers reproduced (M001 licensable on
exactly the three calling cases; never-calling case NO_INPUT; baseline-failing case BASELINE_INVALID).

## Apparatus failures

None in the run. Two during construction, before any real run: locateFunction's fnStart excludes
the `export ` keyword (recorder anchor fixed); the H1/H2/H6 lists are segments-specific and crashed
the toy dry run (guarded). The synchronous case marker added to preload.mjs is env-gated and absent
from every BIND-1 run.

## What this establishes

1. Discrimination alone is NOT sufficient to derive support: identical bit-vectors hid distinct
   behaviour in 4 of 7 clusters (H1). Clustering the matrix would have manufactured sameness.
2. Discrimination PLUS observed outputs on the witnesses' own inputs IS sufficient to derive a
   provenance-bearing, anonymous support map on this region, with three multi-member classes that
   survived the finer instrument and 18 singletons.
3. The four dark mutants are dark because the witnesses' INPUTS never exercise a difference, not
   because assertions are missing (H2, blind for two of them).
4. BIND-1's site-level execution claims are corroborated by an independent instrument (H6).
5. On this subject, every witness failure was explained by the return value (H3); nothing was
   incidental.

## What this explicitly does NOT establish

- Any obligation, requirement, or meaning. S-numbers are coordinates, not names.
- Equivalence of anything beyond the 57 recorded inputs.
- That S6/S7/S11 would remain classes under new inputs (see next falsification).
- Anything about supersession, replacement, or retirement. Not attempted, not licensed.
- Generality: one region, one witness file, one mutation family.

## Commits / artifacts

91c4f41 BIND-1 artifacts; b26c9e7 BIND-2 prereg; 51b9e33 apparatus + raw run; this record in the
following commit. Files: legasus/bind2.mjs, legasus/bind2-replay-child.mjs, legasus/preload.mjs
(case marker), legasus/out/bind2-segments/{bind2.json, replay.json, inputs.json,
record.trace.jsonl, record.witness.log, R000-RECORDER.js, M000-IDENTITY.js, REPORT.md},
legasus/out/bind2-toy/*, legasus/out/bind2-segments.log.

## The single strongest next falsification

Feed S6, S7 and S11 inputs the witnesses never pass - mechanically sourced (the command strings
that appear in the other 96 catalogued test files, or a generic string fuzz), never authored to a
meaning - and replay every member. One input on which two members of a class differ falsifies the
class as an artefact of the witness input set. The same probe applied to S0 tests whether any dark
mutant is distinguishable at all. Preregister the input source before drawing it.

No obligation is named. No supersession authority is granted. BIND-2 stops here.
