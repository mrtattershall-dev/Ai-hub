# SUPPRESSION-1 — budget correction

**Date:** 2026-09-29 · **Cost:** $0, nothing rerun · Reproduce with
`node server/decodingConsistencyCheck.mjs`.

`SUPPRESSION-1_DEFINITION.md` states **"same token budget"** twice — once inside the frozen question
itself (line 7) and once in the design (line 27). **That is false as written.** The preserved records
say:

| arm | seed | temperature | token budget | ended `doneReason=length` |
|---|---|---|---|---|
| chat | 1 | **never recorded** | 3000 | 0 of 12 |
| operator | 1 | **never recorded** | 3000 | 0 of 12 |
| contract | 1 | **never recorded** | 400 | **4 of 12** |
| manager | **never recorded** | **never recorded** | **never recorded** (code default 400) | **3 of 12** |

Two separate problems, and they deserve different treatment.

## 1. The budgets were unequal, and the two small-budget arms are the two that hit their cap

7 of 48 attempts ended truncated. **All seven are in the 400-token arms; none of the 24 attempts at
3000 tokens hit its cap.**

The unequal budgets were not arbitrary — chat and operator return a whole file, contract and manager
return a localized insert, so the budgets were scaled to each arm's declared output shape. That is a
defensible design. **What is not defensible is the definition's claim that the budget was the same**,
because a reader comparing arms would take "same token budget" at face value.

## 2. What the truncation actually did, per arm — the preserved raw completions decide this

**Contract (4 truncated) — the judgement stands.** Every one of the four begins by restating the
instruction comment (`// when #clear-filter is clicked: ...`) instead of emitting insert lines, and all
four were scored `REFUSED_EMPTY` — "no extractable change", a judgement about *content*. The truncation
is downstream of the failure, not its cause. A larger budget would have produced more of the same thing.

**Manager (3 truncated) — up to three cells are confounded.**

- `s02-manager` and `s07-manager` were scored `REFUSED_NOT_PARSEABLE_JAVASCRIPT` **at
  `doneReason=length`**. Valid code cut mid-statement fails to parse: that is the classic truncation
  signature, and these two are plausibly apparatus artifacts rather than model failures.
- `s04-manager` produced real code (`const clearFilterButton = document.createElement('button'); …`) and
  was scored `REJECTED / NOTHING_WORKED` while truncated. It may have been cut off before completing the
  feature.

## The correction, stated narrowly

- **The manager arm's score is a LOWER BOUND.** Up to 3 of its 12 cells should carry
  `OUTPUT_CAP_EXHAUSTED` — an outcome class this project already defined for AUDIT-2 and **never applied
  here** — rather than counting as failures of the interface.
- **The contract arm's score stands**, on the content evidence above.
- **The chat-versus-manager comparison is confounded by output budget.** Chat had 7.5× the budget and
  never approached it; manager had 400 and hit it 3 times in 12.
- **SUPPRESSION-1's temperature is unrecoverable.** Not one of the 48 records carries it. The runner's
  default is 0.2 and nothing suggests otherwise, but the record cannot establish it, and an unrecorded
  parameter is not a matching one.

Nothing is rerun and no outcome is reinterpreted beyond the seven attempts named above. The other 41
cells are untouched.

## How this was found, because the route matters

Not by re-reading the result. By trying to **weld the decoding parameters** — the mechanism taken from
`PRECEDENT-1`, where a test patches hostile values into the environment and asserts the locked values
win anyway. Checking whether Legasus had that hole turned up something worse: no runner reads the
environment, but **every runner takes decoding from a command-line option**. Any invocation can pass
`--seed 7 --temperature 0.9`; each record then describes itself perfectly honestly while the comparison
across cells is silently broken.

That is the same shape as the `presentationAudit` finding earlier today — *the fact was fine, the
guarantee was absent* — except here the fact was **not** fine. The guarantee's absence had already cost
something.

## Named next work

1. **A named, frozen decoding profile per experiment**, resolved in code, with a CLI override refused
   rather than obeyed — and a hostile test that the refusal holds.
2. **Record temperature in every run record.** SUPPRESSION-1 could not be checked for it at all.
3. Give the manager arm's three truncated cells `OUTPUT_CAP_EXHAUSTED` in any future tally that cites
   SUPPRESSION-1, and cite the arm's score as a lower bound.
