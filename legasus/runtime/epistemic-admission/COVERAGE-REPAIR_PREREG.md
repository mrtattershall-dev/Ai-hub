# Repairing the coverage bridge — R1..R9. Frozen 2026-09-21, before the repaired adapter is run.

## What is being repaired, and what is not

The audit showed the adapter converting *"no diagnostic"* into *"every domain member satisfies the
obligation"* under three conditions where that conversion is unsupported. **The repair is frozen
around a coverage obligation, not around the message filter.** Changing the filter to read
`ruleId: null` is necessary for G4 and is **not** the repair: absence of errors is not itself proof
of coverage.

**The intended domain is preserved.** The repair reports **incomplete analysis** rather than silently
shrinking the domain around suppressed regions. A suppressed region is part of the domain the claim
is about; it was simply not evaluated, and the claim must say so.

## The table, frozen — one permitted conclusion per observation

| observation | permitted conclusion |
|---|---|
| analysis completed, rule ran, coverage established, no violations | establish the precisely scoped claim |
| rule reports a violation | refuse that claim, preserving the diagnostic |
| parsing failed or execution threw | **analysis incomplete**; no universal establishment |
| suppression prevents evaluating part of the domain | **coverage incomplete** |
| callback falls outside the frozen recognition domain | no conclusion about that callback's behaviour |
| file excluded by the configuration | **excluded** from the domain; no claim is made about it |

## An explicit basis for every coverage condition — measured, not assumed

Each condition needs a **positive** basis the pinned tool exposes. Probed against **eslint 10.11.0**
before this was written (`probe-bases.mjs`):

| condition | basis the tool exposes | probed |
|---|---|---|
| rule ran | `calculateConfigForFile(file).rules[RULE]` is present with error severity | yes — `[2, {...}]` when on, `undefined` when off |
| file linted at all | `isPathIgnored(file)` is false | yes — `true` for a config-ignored path |
| analysis completed | no message with `fatal: true`; `fatalErrorCount === 0`; no exception | yes — parse failure gives `fatal: true`, `fatalErrorCount: 1` |
| no suppression touched the domain | `suppressedMessages` has no entry for `RULE`, **and** with `reportUnusedDisableDirectives: 'error'` no unused-directive message names `RULE` or names no rule | yes — used directives appear in `suppressedMessages` with `kind: 'directive'`; an unused one is reported as a `ruleId: null` message naming the rule |

**Recorded fragility:** the unused-directive basis is the message *text*, because eslint reports it
with `ruleId: null`. A blanket `/* eslint-disable */` names no rule and disables ours, so it counts.
This is the weakest of the four bases and is named as such.

## How the repair reaches the production admission path

The repaired adapter does **not** short-circuit with its own verdict. It emits honest certificates
and lets admission decide:

- **full positive basis** → coverage certificate with `EXHAUSTIVE`, evidential force, licensed;
  ordinary certificate closed and settled. Admission: `ESTABLISHED`.
- **any condition failed** → coverage certificate **unlicensed** (`licensed_relation: NONE`,
  coverage `PARTIAL`, frontier naming the condition); **no coverage authority is filed**; ordinary
  certificate's premise **unsettled**, `open_frontier` naming the condition. Admission refuses on
  its own terms — the COVERAGE witness cannot bind because no authority exists to root it.
- **excluded** → **no certificate is emitted at all**, and the result says `excluded`. The test must
  check that non-emission is not read as acceptance.

The preserved adapter (`adapter-eslint.mjs`) is **not modified**. G1, G2 and G4 keep running against
it as specimens.

## The arms

| arm | condition | preserved adapter | repaired, via production admission |
|---|---|---|---|
| **R1** | G1 file-level suppression, violating file | `ESTABLISHED` (specimen) | refused, reason names coverage incomplete |
| **R2** | G2 line-level suppression | `ESTABLISHED` (specimen) | refused, reason names coverage incomplete |
| **R3** | G4 parse failure | `ESTABLISHED` (specimen) | refused, reason names analysis incomplete |
| **R4** | G3 file excluded by config | — | `excluded`, no certificate, not established |
| **R5** | unused directive over **clean** code | — | refused: coverage incomplete even though nothing was suppressed |
| **R6** | **clean legitimate cases** — b, d, and three untouched external files | — | **`ESTABLISHED`**. Refusal alone cannot satisfy this experiment |
| **R7** | c, a real violation | — | refused, diagnostic preserved verbatim |
| **R8** | G8 by-reference callback | — | `ESTABLISHED` under the frozen domain, and the certificate's **domain name states the recognition scope** |
| **R9** | rule absent from the effective configuration | — | refused: rule did not run. Reachable now because the repaired adapter takes its configuration as input |

## Controls, frozen

**Removing each coverage check must restore the corresponding unsupported admission.** Four
mutants, applied by textual patch to a copy of the repaired adapter, each expected to be caught by
the arm for its condition and by no other:

| mutant | must be caught by |
|---|---|
| fatal messages ignored | R3 |
| `suppressedMessages` ignored | R1, R2 |
| unused-directive messages ignored | R5 |
| effective-rule check removed | R9 |

An inert mutant is a broken harness, not evidence — every mutant run asserts the patch applied.

## Predictions, committed now

- **R1–R5, R7, R9 hold; R6 and R8 hold.** The bases were probed, so the mechanism is not in doubt;
  the uncertainty is in the plumbing between a failed basis and a legible production refusal.
- **R5 is the one most likely to fail**, because it depends on message text.
- **R6 is the arm that gives the others meaning.** If it fails, the repair is a disguised removal of
  the capability and the whole run is void.
- I expect every refusal reason to come **from admission**, not from the adapter. If any refusal is
  produced by the adapter short-circuiting, that arm is mis-wired and is reported as such.

## Forbidden

No registry rules (still **3 authored, 0/15**). The preserved adapter is not modified. The domain is
not shrunk around suppressed regions. No basis is inferred from *absence* alone. **S6, F2,
`COMPLETE`, `INVALIDATE`** untouched.
