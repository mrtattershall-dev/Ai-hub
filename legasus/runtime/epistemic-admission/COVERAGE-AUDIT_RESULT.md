# Auditing the coverage assumption — result. G1..G8 against `COVERAGE-AUDIT_PREREG.md`.

## The finding

> **Steering 3 is falsified. The adapter converts "no diagnostic" into "every domain member
> satisfies the obligation", and three distinct conditions make that conversion silently wrong.**

The risk named in the preregistration is the one that materialised: **the adapter supplies the very
premise Legasus appears to verify.**

## The table

| arm | condition | eslint | adapter saw | Legasus | outcome |
|---|---|---|---|---|---|
| **G1** | file-level `/* eslint-disable array-callback-return */` | 0 messages | 0 findings | `ESTABLISHED` | **SILENTLY ACCEPTED** |
| **G2** | line-level `// eslint-disable-next-line` | 0 messages | 0 findings | `ESTABLISHED` | **SILENTLY ACCEPTED** |
| **G4** | parse failure | **1 message**, `ruleId: null` | **0 findings** | `ESTABLISHED` | **SILENTLY ACCEPTED** |
| **G3** | file the config ignores | 1 message, *File ignored* | 1 | `FRONTIER_OPEN` | not accepted — but see below |
| **G5** | `Array.from(xs, cb)` | 1 finding | 1 | `FRONTIER_OPEN` | refused; **my prediction was wrong**, the rule *does* recognise `Array.from` |
| **G6** | module never linted | — | — | threw | refused |
| **G7** | rule absent from config | 1 message | — | — | cannot arise through the adapter, which hardcodes the rule on |
| **G8** | behavioural-domain gap | 0 findings | 0 | `ESTABLISHED` | **the gap, measured** |

## G1, G2, G4 — each false for a different reason, all indistinguishable to the adapter

Every one of these files **contains a callback that violates the obligation**, and in each case
Legasus **established the universal claim that no such callback exists**.

The mechanism is the adapter's own filter: it keeps messages with
`ruleId === 'array-callback-return'` and treats the empty list as *clean*. A suppression comment, a
line-level suppression and a **fatal parse error** all produce an empty filtered list for entirely
different reasons, and the adapter cannot tell them apart.

**G4 is the worst.** eslint *did* emit a message — `Parsing error: Unexpected token return`, with
`ruleId: null`. The adapter's filter discarded it, and Legasus then certified a universal claim
about a file **that does not parse**. Nothing in the run said the file had not been analysed.

## G8 — the measured gap between the frozen domain and the behavioural one

    const cb = (x) => { if (x > 0) return x; };
    export const viaVariable = (xs) => xs.map(cb);

The callback carries exactly the obligation, and the rule does not flag it — it recognises callbacks
written **in the call**, not passed by reference. So:

- under the **frozen (narrow) domain** — *callbacks the rule recognises* — the acceptance is
  **correct**;
- under the **behavioural domain** — *all callbacks carrying this obligation* — the acceptance is
  **wrong**.

The frozen domain was chosen before running this, and it is doing exactly the work it was chosen to
do: keeping the claim honest at the price of making it much weaker than its English reading. **The
gap is real and now measured on one case.**

## G3 — the configuration in the claim is the ADAPTER's, not the project's

The adapter never consults an `ignores` list; it lints whatever path it is handed. So a file the
project's own configuration excludes is still linted and still certified. That is not a silent
acceptance, but it means the frozen phrase *"this configuration"* refers to **the adapter's
configuration**, and a claim read as *"this project's lint gate passes"* would be false.

## What this does to the external experiment's result

The eleven evaluation cases contained **no suppression comments, no ignored files and no parse
failures**, so their acceptances were **correct**. But they were not correct *for the reason the
adapter gave*: the adapter would have accepted them identically had they been suppressed or
unparseable.

> **The acceptances were sound by the luck of the corpus, not warranted by the adapter's reasoning.**

`EXTERNAL-LINTER_RESULT.md` stands with that attached. Nothing in it is withdrawn — the agreement
counts are what they were — but *"agreed with the external verifier on 11 of 11"* must now be read
as *"agreed on a corpus that contained none of the three conditions under which the adapter agrees
with nothing at all."*

## Predictions

- **G1, G2, G4 predicted as silent acceptance — confirmed.**
- **G7 predicted as silent acceptance — cannot arise**, because the adapter hardcodes the rule on.
  A prediction about a path that does not exist.
- **G5 predicted as outside the domain — wrong.** The rule recognises `Array.from`. The genuine
  gap needed the by-reference form, which is G8.
- **G6 predicted as silent acceptance — wrong.** It throws, which is a refusal, though an
  unhelpfully shaped one.

## Not repaired here

The preregistration forbade repairing the adapter in this run, and it is **not repaired**. The three
silent conversions stand as specimens. A repair would need the adapter to distinguish *no
violations found* from *not analysed*, which means reading eslint's messages **including**
`ruleId: null`, and either excluding suppressed regions from the domain or reporting the coverage as
incomplete. That is a separate, separately frozen decision.

**No registry rules** (still 3 authored, 0/15). **S6, F2, `COMPLETE`, `INVALIDATE`** untouched.

## What this says about the larger question

On this obligation Legasus **agreed with the linter everywhere and found nothing the linter did not
find** — and this audit shows it would also have agreed where the linter said nothing because it had
not looked. **The adapter, not Legasus, was doing the epistemic work, and it was doing it wrongly.**
That is the most useful thing the external experiment has produced so far.
