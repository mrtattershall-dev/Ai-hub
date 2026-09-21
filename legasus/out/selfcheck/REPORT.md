# BIND-1 result — C:\Users\tatte\Projects\ai-coding-hub\legasus\selfcheck\toy.js :: clamp

Attempt: OBSERVED — every sample within the preregistered limits (count worst 10/40; calibration worst 41.7ms against a frozen reference of 35ms, limit 3x; 22 samples; sampler legasus/loadSample.mjs (stand-in)).

No obligation is named here. No supersession authority is granted. Every edge below is an experiment.

## Witness selection (frozen rules)

- case-level: legasus/selfcheck/toy_witness.mjs
- file-level: none
- UNOBSERVABLE (budget): none

## Per perturbation

| mutant | perturbation | discriminated (fail/error) | executed, not discriminated | not executed | baseline invalid | unobservable |
|---|---|---|---|---|---|---|
| M001-RETURN_EMPTY | body := return [] | 3 (3/0) | 0 | 1 | 1 | 0 |
| M002-RETURN_UNDEFINED | body := return undefined | 3 (3/0) | 0 | 1 | 1 | 0 |
| M003-INVERT_COND | invert test @220 | 2 (2/0) | 1 | 1 | 1 | 0 |
| M004-DROP_BRANCH | drop consequent @230 | 1 (1/0) | 0 | 3 | 1 | 0 |
| M005-DROP_BRANCH | drop else @255 | 0 (0/0) | 3 | 1 | 1 | 0 |
| M006-BOUNDARY | > := >= | 0 (0/0) | 3 | 1 | 1 | 0 |
| M007-BOUNDARY | 10 := 11 | 0 (0/0) | 3 | 1 | 1 | 0 |
| M008-BOUNDARY | 10 := 9 | 0 (0/0) | 3 | 1 | 1 | 0 |
| M009-DROP_EFFECT | drop AssignmentExpression @236 | 1 (1/0) | 0 | 3 | 1 | 0 |
| M010-BOUNDARY | 10 := 11 | 1 (1/0) | 0 | 3 | 1 | 0 |
| M011-BOUNDARY | 10 := 9 | 1 (1/0) | 0 | 3 | 1 | 0 |
| M012-DROP_EFFECT | drop AssignmentExpression @261 | 0 (0/0) | 2 | 2 | 1 | 0 |
| M013-BOUNDARY | 0 := 1 | 1 (1/0) | 1 | 2 | 1 | 0 |
| M014-BOUNDARY | 0 := -1 | 1 (1/0) | 1 | 2 | 1 | 0 |
| M015-EXCEPTION | swallow catch @370 | 1 (1/0) | 0 | 3 | 1 | 0 |
| M016-EXCEPTION | propagate catch @370 | 1 (0/1) | 0 | 2 | 1 | 1 |
| M017-INVERT_COND | invert test @296 | 3 (3/0) | 0 | 1 | 1 | 0 |
| M018-DROP_BRANCH | drop consequent @319 | 1 (1/0) | 0 | 3 | 1 | 0 |
| M019-BOUNDARY | 1 := 2 | 1 (1/0) | 0 | 3 | 1 | 0 |
| M020-BOUNDARY | 1 := 0 | 1 (1/0) | 0 | 3 | 1 | 0 |

## Discrimination candidates (anonymous)

- **D1** — M001-RETURN_EMPTY: body := return [] — discriminators: 3
- **D2** — M002-RETURN_UNDEFINED: body := return undefined — discriminators: 3
- **D3** — M003-INVERT_COND: invert test @220 — discriminators: 2
- **D4** — M004-DROP_BRANCH: drop consequent @230 — discriminators: 1
- **D5** — M009-DROP_EFFECT: drop AssignmentExpression @236 — discriminators: 1
- **D6** — M010-BOUNDARY: 10 := 11 — discriminators: 1
- **D7** — M011-BOUNDARY: 10 := 9 — discriminators: 1
- **D8** — M013-BOUNDARY: 0 := 1 — discriminators: 1
- **D9** — M014-BOUNDARY: 0 := -1 — discriminators: 1
- **D10** — M015-EXCEPTION: swallow catch @370 — discriminators: 1
- **D11** — M016-EXCEPTION: propagate catch @370 — discriminators: 1
- **D12** — M017-INVERT_COND: invert test @296 — discriminators: 3
- **D13** — M018-DROP_BRANCH: drop consequent @319 — discriminators: 1
- **D14** — M019-BOUNDARY: 1 := 2 — discriminators: 1
- **D15** — M020-BOUNDARY: 1 := 0 — discriminators: 1

## Executed, and no witness discriminated (dark to this family)

- M005-DROP_BRANCH — drop else @255 — executed by 3 witness(es), discriminated by none. Establishes: no witness in this set discriminated this perturbation. Does NOT establish absence of an obligation.
- M006-BOUNDARY — > := >= — executed by 3 witness(es), discriminated by none. Establishes: no witness in this set discriminated this perturbation. Does NOT establish absence of an obligation.
- M007-BOUNDARY — 10 := 11 — executed by 3 witness(es), discriminated by none. Establishes: no witness in this set discriminated this perturbation. Does NOT establish absence of an obligation.
- M008-BOUNDARY — 10 := 9 — executed by 3 witness(es), discriminated by none. Establishes: no witness in this set discriminated this perturbation. Does NOT establish absence of an obligation.
- M012-DROP_EFFECT — drop AssignmentExpression @261 — executed by 2 witness(es), discriminated by none. Establishes: no witness in this set discriminated this perturbation. Does NOT establish absence of an obligation.

## Per witness

| witness | label | discriminates | executed-not-discriminated | not executed |
|---|---|---|---|---|
| legasus/selfcheck/toy_witness.mjs :: big clamps | DISCRIMINATES | 8 | 4 | 8 |
| legasus/selfcheck/toy_witness.mjs :: small passes | DISCRIMINATES | 6 | 5 | 9 |
| legasus/selfcheck/toy_witness.mjs :: string is -1 | DISCRIMINATES | 8 | 8 | 4 |
| legasus/selfcheck/toy_witness.mjs :: untouched | NOT_EXECUTED | 0 | 0 | 19 |
| legasus/selfcheck/toy_witness.mjs :: deliberately wrong | BASELINE_INVALID | 0 | 0 | 0 |

Records: 100. Full matrix: matrix.json.
