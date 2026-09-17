# Transaction substrate family — SEALED

Six tasks, authored under the fifteen frozen construction rules, validated, and sealed.

    ops   analogy_specified        no_supported_analogy
     2    a01 weighted tallies     b01 snapshot/undo
     3    a02 hourly buckets       b02 continuation lines
     4    a03 date column          b03 nested comments

Rule 13 holds on real data: both classes have n=3, mean operation_count 3.00, range 2-4, gap 0.00.
Applicability class is not confounded with authored complexity.

Every witness proven by EXECUTION at authoring time, never asserted: the no-op fails the delta, each
single-operation-omitted variant fails the delta, and the reference both preserves accumulated behaviour
and passes the delta.

`MANIFEST.sealed.json` records three hashes per task - task.json, source/, evidence/ - taken before any
model generation or applicability detection ran against this family.

## Before any run

    node seal.mjs verify ./family

## What may be shown to a system under test

    task.json    and    source/          yes
    evidence/                            NEVER

No task may be edited in response to any outcome. If the family turns out degenerate, that is a finding
about the construction procedure, recorded at family level (rule 9).
