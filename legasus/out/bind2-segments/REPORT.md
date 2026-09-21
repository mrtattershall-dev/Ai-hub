# BIND-2 result — C:\Users\tatte\Projects\ai-coding-hub\server\approvalPolicy.js :: segments

Attempt: OBSERVED (within every preregistered limit; 4 samples; sampler legasus/loadSample.mjs (stand-in)). Controls: {"C1":true,"C2":true,"C3":true,"C4":true,"C5":true}.
Inputs recorded: 87 calls, 57 distinct; orphan calls 0. States: {"LICENSABLE":605,"NO_INPUT":204,"UNASSERTED":276,"UNOBSERVABLE":86,"NO_DIFFERENCE":1991}.

No obligation is named. S-classes are anonymous and relative to the recorded inputs. No supersession authority is granted.

## S-classes (rule 1: identical raw output on every recorded input)

- **S0** — PRISTINE, M000-IDENTITY, M010-DROP_BRANCH, M011-BOUNDARY, M012-BOUNDARY, M013-BOUNDARY, M014-DROP_EFFECT, M022-BOUNDARY, M023-BOUNDARY, M025-DROP_BRANCH, M028-DROP_EFFECT
- **S1** — M001-RETURN_EMPTY — differs from S0 on 57 input(s)
- **S2** — M002-RETURN_UNDEFINED — differs from S0 on 57 input(s)
- **S3** — M003-BOUNDARY — differs from S0 on 57 input(s)
- **S4** — M004-BOUNDARY — differs from S0 on 57 input(s)
- **S5** — M005-BOUNDARY — differs from S0 on 57 input(s)
- **S6** — M006-INVERT_COND, M018-INVERT_COND — differs from S0 on 16 input(s)
- **S7** — M007-DROP_BRANCH, M019-DROP_BRANCH, M020-DROP_EFFECT — differs from S0 on 5 input(s)
- **S8** — M008-DROP_EFFECT — differs from S0 on 10 input(s)
- **S9** — M009-INVERT_COND — differs from S0 on 8 input(s)
- **S10** — M015-INVERT_COND — differs from S0 on 6 input(s)
- **S11** — M016-DROP_BRANCH, M017-DROP_EFFECT — differs from S0 on 3 input(s)
- **S12** — M021-DROP_EFFECT — differs from S0 on 10 input(s)
- **S13** — M024-INVERT_COND — differs from S0 on 57 input(s)
- **S14** — M026-DROP_EFFECT — differs from S0 on 6 input(s)
- **S15** — M027-DROP_EFFECT — differs from S0 on 6 input(s)
- **S16** — M029-INVERT_COND — differs from S0 on 57 input(s)
- **S17** — M030-DROP_BRANCH — differs from S0 on 10 input(s)
- **S18** — M031-DROP_EFFECT — differs from S0 on 10 input(s)
- **S19** — M032-DROP_EFFECT — differs from S0 on 10 input(s)
- **S20** — M033-DROP_EFFECT — differs from S0 on 57 input(s)
- **S21** — M034-DROP_EFFECT — differs from S0 on 57 input(s)

## H1 — do BIND-1's identical-signature clusters split?

- {M001, M024, M029, M033} -> S1 + S13 + S16 + S20  **SPLITS**
- {M003, M004} -> S3 + S4  **SPLITS**
- {M006, M018} -> S6
- {M030, M032} -> S17 + S19  **SPLITS**
- {M007, M019, M020} -> S7
- {M016, M017} -> S11
- {M008, M021} -> S8 + S12  **SPLITS**
- {M010, M011, M012, M013, M014, M022, M023, M025, M028} -> S0

## H2 — the four dark mutants (held-out pressure)

- M022-BOUNDARY: S0; delta on 0 recorded input(s); per-case states NO_DIFFERENCE, NO_INPUT
- M023-BOUNDARY: S0; delta on 0 recorded input(s); per-case states NO_DIFFERENCE, NO_INPUT
- M025-DROP_BRANCH: S0; delta on 0 recorded input(s); per-case states NO_DIFFERENCE, NO_INPUT
- M028-DROP_EFFECT: S0; delta on 0 recorded input(s); per-case states NO_DIFFERENCE, NO_INPUT

## H3 — INCIDENTAL discrimination: 0 record(s)


## H4 — CLASS_INCONSISTENT: 87 (mutant-class, case) conflict(s) in 1 class(es)

- S0 on server/policy_test.mjs :: [strict] deny  rm -rf /: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [strict] deny  rm -rf node_modules: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [strict] deny  sudo apt install ffmpeg: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [strict] deny  git push origin main: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [strict] deny  npm publish: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [strict] deny  shutdown /s /t 0: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [strict] deny  reg add HKLM\Software\Foo /v Bar: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [build] deny  rm -rf /: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [build] deny  rm -rf node_modules: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}
- S0 on server/policy_test.mjs :: [build] deny  sudo apt install ffmpeg: {"M010-DROP_BRANCH":"NOT_EXECUTED","M011-BOUNDARY":"NOT_EXECUTED","M012-BOUNDARY":"NOT_EXECUTED","M013-BOUNDARY":"NOT_EXECUTED","M014-DROP_EFFECT":"NOT_EXECUTED","M022-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M023-BOUNDARY":"EXECUTED_NOT_DISCRIMINATED","M025-DROP_BRANCH":"NOT_EXECUTED","M028-DROP_EFFECT":"NOT_EXECUTED"}

## H5 — raw delta hidden by the witnesses' trim: 0 (mutant, input) pair(s)


## H6 — never-executed mutants with a replay delta: none


## Edges licensed: 568   refused: 1385

- S1 <- 71 witness case(s)
- S2 <- 1 witness case(s)
- S3 <- 54 witness case(s)
- S4 <- 54 witness case(s)
- S5 <- 16 witness case(s)
- S6 <- 21 witness case(s)
- S7 <- 6 witness case(s)
- S8 <- 3 witness case(s)
- S9 <- 6 witness case(s)
- S10 <- 7 witness case(s)
- S11 <- 4 witness case(s)
- S12 <- 3 witness case(s)
- S13 <- 71 witness case(s)
- S14 <- 2 witness case(s)
- S15 <- 6 witness case(s)
- S16 <- 71 witness case(s)
- S17 <- 15 witness case(s)
- S18 <- 3 witness case(s)
- S19 <- 15 witness case(s)
- S20 <- 71 witness case(s)
- S21 <- 68 witness case(s)

Refusals by state: {"NO_INPUT":126,"UNASSERTED":272,"UNOBSERVABLE":86,"NO_DIFFERENCE":901}

Full provenance: bind2.json (joined[], edges[], refused[]), replay.json, inputs.json, record.trace.jsonl.