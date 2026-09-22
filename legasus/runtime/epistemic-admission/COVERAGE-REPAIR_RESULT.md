# Repairing the coverage bridge — result. R1..R9 against `COVERAGE-REPAIR_PREREG.md`.

    10 arms, all green after two disclosed corrections.  4 mutants, 4 caught.
    Run from external-linter/ after `npm install`: `node --test coverage-repair.test.mjs`

## The answer to the question that was actually asked

The question was whether **Legasus** can reliably prevent the translation error — an external
verifier's result becoming a stronger claim than the verifier made.

> **Legasus did not prevent it. The adapter was corrected to stop making it.**

Every refusal in this run comes from the production admission path, and every one of them is
correct — but only because the repaired adapter now emits certificates that **tell the truth about
coverage**. Legasus checks the derivation structure it is handed; it still accepts the coverage
premise on the adapter's word. **It cannot verify that the adapter's positive bases are real.** The
boundary where an external tool's output becomes evidence for a universal claim is exactly as good
as the adapter at that boundary, and no better. That is the same finding as the audit, now with the
adapter on the right side of it.

## What the repair is

Frozen around a **coverage obligation**, not the message filter. One permitted conclusion per
observation, and an **explicit, positive basis** for every coverage condition — each probed against
eslint 10.11.0 before the preregistration was written:

| condition | basis | arm |
|---|---|---|
| file linted at all | `isPathIgnored(file) === false` | R4 |
| rule ran | `calculateConfigForFile(file).rules[RULE]` present at error severity | R9 |
| analysis completed | no `fatal` message, `fatalErrorCount === 0`, no exception | R3 |
| no suppression touched the domain | no `suppressedMessages` for the rule, **and** no unused-directive report naming it | R1, R2, R5 |

**The intended domain is preserved.** A suppressed region stays in the domain; the certificate says
it was not evaluated. R5 asserts this directly: a directive over *clean* code — nothing suppressed —
still makes coverage incomplete, and the certificate still names the full domain.

**The adapter never short-circuits.** R-BASIS checks that every refusal is an admission state
(`FRONTIER_OPEN` / `CANDIDATE` / `OBSERVED`) on an emitted certificate. An excluded file emits **no**
certificate, and R4 checks that non-emission is not read as acceptance.

## Arm by arm

| arm | preserved adapter | repaired, via admission |
|---|---|---|
| **R1** file-level suppression | `ESTABLISHED` (specimen intact) | refused — *a suppression directive prevented evaluating part of the domain*; basis `suppressedForRule: 1` |
| **R2** line-level suppression | `ESTABLISHED` (specimen intact) | refused, same basis |
| **R3** parse failure | `ESTABLISHED` (specimen intact) | refused — *analysis failed: Parsing error*; basis `fatalErrorCount: 1`; linter decision `INCOMPLETE`, neither ACCEPT nor REJECT |
| **R4** excluded file | — | `EXCLUDED`, no certificate, `NO_CLAIM`; the same file un-ignored is a `REJECT` for a *different* reason |
| **R5** unused directive over clean code | — | refused with `suppressedForRule: 0`, `unusedDirectives: 1` |
| **R6** clean legitimate cases | — | **`ESTABLISHED`**, five files, every condition with a positive basis, coverage authority filed |
| **R7** real violation | — | refused, diagnostic verbatim, coverage **was** established — the refusal is the violation |
| **R8** by-reference callback | — | `ESTABLISHED` under the frozen domain, whose name now states the recognition scope |
| **R9** rule not in effective config | — | refused — *not enabled in the effective configuration*; basis `effectiveRule: null` |

## Two corrections made during the run, disclosed

**1. Misattributed evidential force.** The first run refused R1/R2/R3/R5/R9 through `observe()` with
the generic *PRODUCER_FAILED — authority cannot be inferred from its own absence*, swallowing the
legible condition. Cause: I had set `evidential_force: covered(rep)` on the *observation*. But
eslint genuinely ran and reported; a coverage failure is a failure of what the observation
**licenses**, not of the observation. Attributing it to the observation was the wrong-referent
species again. The observation now always carries force; the condition travels on the frontier and
the premise, and admission's refusal names it.

**2. The eight "untouched external files" were linted under a configuration that excludes them.**
eslint 10's default configuration ignores `node_modules/**`. The repaired adapter's `isPathIgnored`
check reported the eslint source files as `EXCLUDED` — correctly. The preserved adapter never
checked, so F5's acceptances were produced by forcing files through a configuration that does not
apply to them. The observed agreement stands; `EXTERNAL-LINTER_RESULT.md` now carries this note at
F5. R6 evaluates **byte-identical copies** moved outside the ignored path, with each digest asserted
against its original, and also asserts that the originals are `EXCLUDED`.

## Mutation table

| mutant | predicted | caught by |
|---|---|---|
| fatal messages ignored | R3 | R3, **R-BASIS** |
| `suppressedMessages` ignored | R1, R2 | R1, R2, **R-BASIS** |
| unused-directive messages ignored | R5 | R5 |
| effective-rule check removed | R9 | R9 |

All four applied (asserted) and all four died. **The prediction "and by no other" was wrong for two
of four.** R-BASIS is cross-cutting: it fires whenever a specimen file becomes `ESTABLISHED`,
regardless of which check was removed. That is not a defect in the suite — it is a second,
independent detector — but it is not what I predicted, and I am recording it as a miss rather than
as extra coverage.

## Recorded fragility

The unused-directive basis is **message text** — eslint reports it with `ruleId: null` and the rule
name inside the string. A future eslint that rewords the message silently disables R5's basis. Named
in the preregistration as the weakest of the four; unchanged by this run.

## What is and is not established

**Established:** for this obligation, under this pinned tool, the three conditions the audit found
now produce **legible refusals through production admission**, with a positive basis for each, and
clean cases still establish. The preserved specimens still fail as they did.

**Not established:** that Legasus can catch an adapter that lies about coverage — it cannot, and
this run did not change that; that the four bases are complete — G8's behavioural gap is unchanged
and the frozen domain remains narrow; that the repair generalises beyond eslint 10.11.0.

**Untouched:** the registry is still **3 authored rules, 0/15**. **S6, F2, `COMPLETE`, `INVALIDATE`**
untouched. The application-corpus refusal search has **not** been run; "no consequential external
refusal" stays open.
