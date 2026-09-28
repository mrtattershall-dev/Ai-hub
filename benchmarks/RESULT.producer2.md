# r4 — producer #2 (git) against the evidence boundary. RESULT.

Predictions E1–E10 and the selection rule were frozen in `087ec67`, **before** any candidate was
inspected and before any candidate's behaviour was observed. This file is written after the fact and
changes neither.

Apparatus: `legasus/legaexternal/git-producer.mjs`, `legasus/legaexternal/producer2.test.mjs`,
`benchmarks/producer2-selection.mjs`. Suite at time of writing: **444 tests, 444 pass, 0 fail**.

## 1. Selection was mechanical, and the rule did not discriminate

`node benchmarks/producer2-selection.mjs`:

    tool          avail  axes differing  eligible
    git           true          7        true
    py_compile    true          7        true
    unittest      true          7        true
    symtable      true          7        true
    pip-check     true          7        true

    SELECTED: git  (differs on 7 of 7 axes; ties broken lexicographically)
    runner-up: pip-check (7)

**The "most axes" criterion selected nothing.** All five eligible candidates differ from doctest on all
seven declared axes, so the decision fell entirely to the lexicographic tiebreak. That is recorded as a
limitation of the frozen rule, not a virtue of it: a rule that ties everywhere is doing no discriminating
work, and the honest description of what happened is *the tiebreak chose the producer*. It was applied as
written rather than repaired mid-experiment, because rewriting a selection rule once the candidate list is
visible is exactly the failure the freeze exists to prevent.

The rule is still not vacuous — eligibility is a real filter (≥3 axes, a fact Legasus has reason to
consume, machine-readable output). But the *ordering* clause has no demonstrated power and must not be
quoted as if maximum ontological distance were established by measurement. **P2-SELECTION-ORDERING is
recorded as UNDISCRIMINATING on this candidate set.**

That said, git is a defensible producer on its merits, independently of how it was reached:

- it **does not execute the subject at all** — doctest's entire evidence model is execution;
- its identity is **content-addressed**, not a name plus an ordinal;
- its history is an **explicit DAG**, not "examples share one namespace, in order";
- it has **no notion of PASS or FAIL**.

And it is a fact Legasus genuinely consumes rather than one invented to be consumed:
THE COPY YOU MEASURE MUST BE THE COPY YOU EDITED is a byte-identity claim, and the provenance sidecar
committed in `087ec67` already leans on git facts.

## 2. All ten predictions held

| | prediction | evidence |
|---|---|---|
| E1 | raw evidence survives untranslated | `TRACKED_CLEAN` / `TRACKED_MODIFIED` / `UNTRACKED`, none of them a borrowed verdict word |
| E2 | producer-native identity stays authoritative | 40-hex oid; `document` and `ordinal` both `undefined`, not invented; two paths with identical content share an oid and the boundary does not override that |
| E3 | native distinctions survive with no Legasus equivalent | worktree-vs-committed divergence is preserved although nothing downstream models it |
| E4 | the adapter invents nothing | `UNTRACKED` maps to `UNKNOWN_MAPPING` — git does not say *why*, so neither does the boundary |
| E5 | producer failure is non-knowledge | a non-repo yields `producerFailed`, `records: undefined`, and "no evidential force" |
| E6 | a scoped Legasus claim legitimately derives | "the copy measured is the copy that was committed", scoped by git's own coordinates |
| E7 | a distinction stays producer-specific | git evidence is **not** expressible in a three-state verdict vocabulary |
| E8 | doctest evidence unchanged | `history` still `m.f#0`, unstripped `want` still `"x\n"`, `PASS` still `OBSERVED`/`HELD` |
| E9 | a malformed record is refused | coerced to nothing; `why` names the invented distinction |
| E10 | interpretable after subject **and** producer are gone | the subject directory is deleted, git is never called again, and re-adaptation is deterministic |

## 3. THE STRAIN — and it is the result, not an incident

The predictions were run against the **existing** adapter first, deliberately, so that any shape change
would be discovered rather than pre-empted. It was discovered within minutes.

The adapter hard-coded doctest's history shape:

    history: rec.identity.document + '#' + rec.identity.ordinal

Handed a git record — which has neither coordinate — it emitted the literal string:

    scope.criterion : "git 2.43"
    scope.history   : "undefined#undefined"

**A fabricated coordinate where the honest answer is that the dimension does not apply.** That is UNKNOWN
collapsing into a value, inside the very abstraction built to prevent exactly that, and it survived
producer #1 only because producer #1 always had both fields.

Repaired: a coordinate the producer cannot establish is now **absent** rather than invented, and git's own
coordinates are carried instead.

    git scope     {criterion: "git 2.43", implementation: <oid>, repository: <head>}
    doctest scope {criterion: "CPython doctest 3.13", history: "m.f#0"}

Absent is not the same as unknown, and neither is the same as a string that looks like data. The
regression is pinned by a test that asserts both `Object.hasOwn(scope, 'history') === false` **and**
`JSON.stringify(scope)` contains no `"undefined"`.

This is the stated desired outcome of the experiment, recorded rather than engineered away: the supposedly
generic evidence boundary was doctest-shaped in one place, and a second authority found the place.

## 4. What E6 shows that E1–E5 do not

E1–E5 show the boundary *tolerating* a foreign producer. E6 shows it **deriving** from one: git evidence
produces a scoped Legasus claim with `assertion: null`. git establishes **identity, not an assertion**, and
forcing an assertion field onto it would have been inventing a distinction the producer never made —
law 4 running in the direction that is easy to miss, because the invented value would have looked
harmless.

## 5. Scope and what is NOT established

- Two producers is not "generic". It is **one demonstrated instance of the boundary bending under a
  second authority**, plus a repair. A third producer may bend it again.
- `git 2.43` on win32 only. No POSIX run.
- The strain was found in **scope construction**. Nothing here tests whether `observability` /
  `assertion` are the right two fields; both producers so far happen to fit them, and git fits only by
  being allowed to decline the second one.
- The selection ordering clause is undiscriminating (§1) and must not be cited as evidence that git was
  the maximally distant choice.
- `legasus-freeze-r3` untouched; Repo C prospective numbers unchanged.
