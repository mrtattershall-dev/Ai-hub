# External applicability — E1 only. The frozen selection rule selected nothing.

    Rule frozen and committed at f3b0e0f, BEFORE any candidate was enumerated.
    `node enumerate-verifiers.mjs` reproduces this.

## The outcome

**No tool in this environment qualifies**, so under clause 5 of the frozen rule the experiment
**stops here** and the outcome is recorded rather than the rule relaxed.

| tool | installed | per-item decision | machine-readable reason id | qualifies |
|---|---|---|---|---|
| acorn | no | parse error or not | no | no |
| `ast` (python) | yes | source parses or not | no — prose | no |
| `git fsck` | yes | per **git object** | **yes** | no |
| `jsonschema` (python) | yes | per **JSON document** | **yes** | no |
| `node --check` | yes | source parses or not | no | no |
| `py_compile` | yes | source compiles or not | no — prose | no |
| `pytest` | yes | per **test** | no — prose repr | no |

**The two nearest misses fail on the same clause** — not the reason identifier, but *the item being
decided*. `jsonschema` decides about a JSON document; `git fsck` decides about a git object. Clause
(c) requires a decision **about source code**.

Everything that decides about source code here (`ast`, `py_compile`, `node --check`, `acorn`) reports
**prose**, not a rule identifier — so there is nothing to compare Legasus's *reasons* against, which
is the point of E5 and E6.

## This is a real result, and it is a small one

It says something about **this machine**, not about Legasus: no rule-identified source-code verifier
is installed here. It does **not** say the framework fails to transfer — that question is untested,
and remains untested.

**I did not relax the rule to manufacture a candidate**, and I did not quietly widen "source code" to
admit `jsonschema`, which would have been the convenient move and would have made the experiment
meaningless: I would have picked the tool after seeing which one my rule could be bent to reach.

## The decision this leaves to you

The milestone needs a rule-identified external verifier, and getting one needs your call:

1. **Authorize installing one** — e.g. a linter with documented rule ids. The frozen rule forbids
   installing, so this needs a **new rule, frozen before enumerating again**, not an amendment to
   the old one.
2. **Re-freeze a rule whose "item" is wider than source code** — `jsonschema` becomes eligible
   immediately, and its obligations (`required`, `type`, `additionalProperties`) are genuinely
   external, genuinely rule-identified, and were not written to fit Legasus. This is the cheapest
   honest path and it must be **chosen deliberately**, because I would be choosing it having already
   seen that it is what my first rule nearly reached.
3. **Point me at an external verifier you already trust**, in which case the selection is yours and
   the record says so.

**My recommendation is (2), with the bias disclosed**: `jsonschema`'s obligations are real external
obligations with machine-readable reasons, and the widening is defensible on its merits — an
inference obligation about a structured artefact is still an inference obligation. But the sequence
matters: this recommendation was made **after** the enumeration, so the new rule must be frozen and
committed before it is applied, exactly as the first one was.

## Unchanged

**E2..E6 are not attempted.** The registry still recognises **3 authored rules, 0/15**, reported
separately and unaffected by anything here. **S6, F2, `COMPLETE`, `INVALIDATE`** untouched.
