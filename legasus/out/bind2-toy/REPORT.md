# BIND-2 result — C:\Users\tatte\Projects\ai-coding-hub\legasus\selfcheck\toy.js :: clamp

Attempt: OBSERVED (within every preregistered limit; 4 samples; sampler legasus/loadSample.mjs (stand-in)). Controls: {"C1":true,"C2":true,"C3":true,"C4":true,"C5":true}.
Inputs recorded: 4 calls, 4 distinct; orphan calls 0. States: {"LICENSABLE":22,"NO_INPUT":20,"BASELINE_INVALID":20,"NO_DIFFERENCE":38}.

No obligation is named. S-classes are anonymous and relative to the recorded inputs. No supersession authority is granted.

## S-classes (rule 1: identical raw output on every recorded input)

- **S0** — PRISTINE, M000-IDENTITY, M005-DROP_BRANCH, M006-BOUNDARY, M007-BOUNDARY, M008-BOUNDARY, M012-DROP_EFFECT
- **S1** — M001-RETURN_EMPTY — differs from S0 on 4 input(s)
- **S2** — M002-RETURN_UNDEFINED — differs from S0 on 4 input(s)
- **S3** — M003-INVERT_COND — differs from S0 on 3 input(s)
- **S4** — M004-DROP_BRANCH, M009-DROP_EFFECT — differs from S0 on 1 input(s)
- **S5** — M010-BOUNDARY — differs from S0 on 1 input(s)
- **S6** — M011-BOUNDARY — differs from S0 on 1 input(s)
- **S7** — M013-BOUNDARY — differs from S0 on 2 input(s)
- **S8** — M014-BOUNDARY — differs from S0 on 2 input(s)
- **S9** — M015-EXCEPTION, M018-DROP_BRANCH — differs from S0 on 1 input(s)
- **S10** — M016-EXCEPTION — differs from S0 on 1 input(s)
- **S11** — M017-INVERT_COND — differs from S0 on 4 input(s)
- **S12** — M019-BOUNDARY — differs from S0 on 1 input(s)
- **S13** — M020-BOUNDARY — differs from S0 on 1 input(s)

## H1 — do BIND-1's identical-signature clusters split?

- {M001, M024, M029, M033} -> S1
- {M010, M011, M012, M013, M014, M022, M023, M025, M028} -> S6 + S7  **SPLITS**

## H2 — the four dark mutants (held-out pressure)


## H3 — INCIDENTAL discrimination: 0 record(s)


## H4 — CLASS_INCONSISTENT: 1 (mutant-class, case) conflict(s) in 1 class(es)

- S0 on legasus/selfcheck/toy_witness.mjs :: big clamps: {"M005-DROP_BRANCH":"EXECUTED_NOT_DISCRIMINATED","M006-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M007-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M008-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M012-DROP_EFFECT":"NOT_EXECUTED"}

## H5 — raw delta hidden by the witnesses' trim: 0 (mutant, input) pair(s)


## H6 — never-executed mutants with a replay delta: M011-BOUNDARY, M013-BOUNDARY


## Edges licensed: 20   refused: 45

- S1 <- 3 witness case(s)
- S2 <- 3 witness case(s)
- S3 <- 2 witness case(s)
- S4 <- 1 witness case(s)
- S5 <- 1 witness case(s)
- S6 <- 1 witness case(s)
- S7 <- 1 witness case(s)
- S8 <- 1 witness case(s)
- S9 <- 1 witness case(s)
- S10 <- 1 witness case(s)
- S11 <- 3 witness case(s)
- S12 <- 1 witness case(s)
- S13 <- 1 witness case(s)

Refusals by state: {"NO_INPUT":13,"BASELINE_INVALID":13,"NO_DIFFERENCE":19}

Full provenance: bind2.json (joined[], edges[], refused[]), replay.json, inputs.json, record.trace.jsonl.