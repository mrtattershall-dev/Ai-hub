# TRANSFER-BIND step 1 — the foreign codebase's native shape, recorded (2026-09-21 00:55-01:05)

Question this whole experiment is frozen to (tatte, before step 1): *can the existing BIND
observation pipeline acquire its required evidence from a foreign CommonJS codebase without the
adapter inventing, repairing, or semantically interpreting that evidence?* Failure to attach is
a valid outcome.

Step 1 records what the foreign codebase IS. It does not say whether that satisfies anything.
No adapter exists. No requirement has been frozen yet. Nothing in the foreign tree was modified
(measured: 0 files touched under the root across all 33 runs).

Subject: `C:\Users\tatte\OneDrive\Documents\ai-native-engine`. Instrument:
`legasus/transfer/engine-shape.mjs`. Raw: `engine-shape.json`, `step1.log`. Load at start:
9 node processes, calibration 31.6ms (A2 limit 105ms).

## Static

    source files                     117   (33 test, 84 other)
    module system, test files        33/33 CommonJS      (hub: ESM)
    module system, other files       62 CJS, 22 no-imports; ESM exports anywhere: 0
    package.json                     NONE
    .git                             NONE
    third-party dependencies         NONE - node builtins only (path, fs, os, net, http)
    tests calling process.exit       24/33
    tests writing fs (static)        0/33
    tests spawning processes (static) 23/33
    tests touching net/http (static) 9/33
    per-case output template         `${c ? 'PASS' : 'FAIL'} ${m}`  in every file that has one
    exported names in non-test files 192 across 29 files (CJS `module.exports = {...}` and
                                     `exports.x =`); zero ESM exports anywhere

## Dynamic — each test file executed once, unmodified, from the foreign root, under NODE_V8_COVERAGE

    files run                        33
    exit code 0                      33/33
    timed out (120s budget)          0
    total wall time                  15.8s   (slowest 10.7s, next 662ms)
    files touched under the root      0       - the suite has no side effects on its own tree
    settled via `close`              33/33, max drain after `exit` 0ms - the pipe-holding
                                     hazard did not occur here
    per-case lines (PASS|FAIL <id>)  776 total
    DUPLICATED case ids              0, in every file, and 0 in total
    other case formats (TAP, ticks)  0
    files with zero case lines        1  (experiments/006_soa_world/memory_test.js)
    V8 coverage files per run        1 for 32 files; 266 for
                                     experiments/025_behavior_corpus/harness_test.js

## Facts worth keeping separate from any later claim

1. **Case identity is unambiguous, measured, not assumed.** 776 per-case lines, zero duplicated
   identifiers in any file. The format resembles the hub's, which is exactly why it was measured
   rather than inferred from the template.
2. **One witness is file-granularity only.** memory_test.js emits no per-case line. Heterogeneity
   inside the foreign suite, not an error.
3. **Static over-predicted spawning by 23x.** 23 files contain a spawn/exec call; exactly 1
   produced more than one coverage process. Static structure is not execution. Recorded as an
   instrument caution: had this been asserted rather than run, the shape would have been wrong.
4. **V8 coverage does emit for CommonJS** - one file per process, 266 for the multi-process one.
   Whether the emitted script URLs join to BIND's region counting is NOT tested here; it is a
   requirement question and belongs after the contract is frozen.
5. **No manifest, no VCS, no documented invocation.** BIND-1's DISCOVER catalogs witnesses by
   glob from a repo root and runs them by their documented invocation. Here there is no
   `package.json`, no test script, no `.git`. "Which files are witnesses and how are they run"
   is a fact BIND currently READS and would have to RECEIVE. This is the most likely place for
   an adapter to invent evidence and must appear in the step-2 contract with a named failure
   state (unsupported test framing / ambiguous witness identity).
6. **Module interception is unmeasured and is the live CANNOT_ATTACH candidate.** BIND substitutes
   a mutant through an ESM `resolve` hook. This codebase is 33/33 CJS with zero ESM exports.
   Whether that hook intercepts `require` at all on this Node is not tested here, deliberately:
   it is a BIND requirement, not a property of the foreign code. Per the frozen transport-
   equivalence prediction, if it does not, the result is CANNOT_ATTACH (unsupported module
   interception) - NOT a licence to patch `Module._load` into producing something E-shaped.

## Apparatus

One repair applied BEFORE the dynamic pass, from the existing hazard record rather than from
this run's outcome: the runner settles on `exit` plus a 2s drain window instead of `close`, and
kills the process tree, because 23/33 foreign files contain spawn calls and that is the exact
shape of the 53-minute hang in APPARATUS-NOTES 23/25/27/28. In the event it did not fire here
(33/33 settled via `close`, 0ms drain) - the fix cost nothing and the absence of the hazard is
now measured rather than hoped for.

No requirement is declared satisfied. No adapter is built. Step 2 (freeze the evidence contract,
the permitted native observations, the adapter prohibitions and the failure states) has not begun.

## CORRECTION (2026-09-21 03:25, measured at step 6) — coverage FILES are not processes

The dynamic table above records "V8 coverage files per run: 1 for 32 files; 266 for
harness_test.js", and finding 3 then reads that as "1 file produced more than one coverage
PROCESS". Recounting the same stored coverage by the pid in each filename:

    witnesses with more than one process   0 of 33
    total coverage files                   298
    total distinct pids                     33      (exactly one per witness)

harness_test.js is ONE process that wrote 266 coverage snapshots. This codebase contains no
multiprocess witness. The counts above are correct; the inference drawn from them was not, and
it propagated into APPARATUS-NOTES 23/27/28 and into the step-5 preregistration's rationale for
P-F2. Left in place rather than edited, so the inference and its correction are both legible.
