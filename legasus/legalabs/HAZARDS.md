# APPARATUS HAZARD LEDGER

Every entry here first presented as a result. That is the point: these are the ways this project's
instruments have produced confident, plausible, wrong numbers.

**A hazard is only closed when a MECHANISM catches it.** A written rule is a reminder, and this ledger
exists because reminders failed — the heredoc rule was written down after occurrences one, two and
three, and occurrence four still happened. Each entry therefore carries its status honestly:

    MECHANIZED   a check exists and fails loudly
    RULE ONLY    still relies on remembering

---

## 1. Heredoc backslash-eating - MECHANIZED IN CODE AND, AS OF OCCURRENCE NINE, IN PROSE — MECHANIZED

**Occurrences: 11 — and occurrences TEN and ELEVEN were the first ever caught by the mechanism instead
of by a human noticing.** A Python heredoc turned `\b` into a raw `U+0008` inside a regex in
`run-decide-rendering.mjs`, and `escape-guard` failed the test run before the commit. Then **the repair
introduced occurrence eleven**: writing the corrected line through `node -e` in the same shell collapsed
the escapes again, and the second attempt stripped them entirely (`>=\s*0` arrived as `>=s*0`). The guard
caught that too, and then caught the third attempt.

That is the whole argument for mechanizing this, in one sitting: **knowing about the hazard, while
actively repairing the hazard, was not enough to avoid re-introducing the hazard twice.** The rule is
therefore absolute rather than advisory — a line containing a backslash escape is written with a **file
editor**, never through any shell, not in a heredoc, not in `node -e`, not in `python -`. The repaired
line now says so in a comment beside it, and its regex is a named constant so nothing has to re-type it.

A shell heredoc collapses doubled backslashes, so JS written that way lands with
`'\\s'` turned into `'\s'`. In a JS string literal `\s` is simply `s`: the file stays **syntactically
valid**, the regex silently changes meaning, and the program returns a plausible wrong answer with no
error anywhere.

The fourth occurrence produced a probe that disagreed with a correct scorer about an information-gain
number, and was only caught because a *favourable* result was distrusted.

**Mechanism:** `escape-guard.mjs` scans for the signature — a lone backslash escape whose escaped
character is a regex metacharacter and not a JS one, inside a quoted string literal — skipping
comments, template literals and regex literals.

```bash
node legasus/legalabs/escape-guard.test.mjs
```

Six witnesses, two of them positive controls, so a scanner that flags everything fails the clean cases
and one that flags nothing fails the corrupted ones.

**FIFTH occurrence, 2026-09-18, and in a tool this entry had not met.** A PYTHON heredoc, not a shell
one. Python treats backslash-b as a valid escape - it is a backspace - so a regex ending in a word
boundary, written into the file through that heredoc, landed as a regex containing a RAW BACKSPACE
(0x08). No warning from Python, no syntax error from JS, the regex simply stopped matching - and the
visibility ladder counted every source line as its own statement, producing a wrong window size with
nothing reporting it. The existing scan missed it because a regex literal was this guard's
DOCUMENTED blind spot.

**Mechanism extended, and the blind spot is closed:** `scanControlChars` flags any raw control
character outside tab/LF/CR, anywhere in a file — string literal, regex literal, template or comment —
without needing to know which context it is in, because a raw control character in source is never an
intention. Proven both directions: a synthetic corrupted regex literal is CAUGHT, clean source with a
real `\w` and a template literal is ADMITTED. Sweep of all 85 `.mjs` files in `legasus/`: clean.

**SIXTH occurrence, same day, third delivery mechanism.** A shell-quoted `node -e` this time. The
escapes in a regex literal collapsed into ORDINARY CHARACTERS rather than control characters, so the
regex stayed syntactically valid, matched nothing, and the derived parameter name came out undefined.
The prompt then read "The function takes one parameter, named undefined." Neither scan sees this:
scanControlChars finds no control character, and the string-literal scan does not walk regex literals.

**What caught it, and the rule that generalizes:** the SUFFICIENCY control, which had been built
fifteen minutes earlier for an unrelated reason and reported that the prompt never supplies the
parameter. A guard built for one failure caught another because both are the same underlying shape -
a fact the apparatus believes it rendered and did not.

**New sub-rule, mechanized per-site:** every DERIVED fact rendered into a prompt asserts itself before
rendering. A derivation that yields undefined and is interpolated anyway becomes the string
"undefined" in the prompt, which is this project’s signature silent failure - plausible output, no
error, lost work.

**Mechanism extended to text artifacts:** `text-guard.mjs` scans prose for raw control characters,
unquoted shell stderr, an odd document-wide backtick count, empty inline spans, and the bare empty
parentheses occurrence nine left behind. Its first version flagged 25 things and all 25 were false
positives, because it checked backtick balance per line and this project's prose wraps spans across
lines. The repair was not tuning - it was replacing invented admit cases with ones taken verbatim from
the real corpus. 114 tracked markdown files now sweep to zero.

```bash
node --test legasus/legalabs/text-guard.test.mjs
```

**Standing rule it replaces:** JS containing a regex is written with a file writer, never a heredoc —
*including one-off probes*, which is exactly where the discipline slipped every time. OCCURRENCE NINE was a MARKDOWN write, not code: a necessity-table section written through a
shell-quoted node -e, whose backtick span was executed as a command substitution and silently deleted
the example it contained. The sentence stayed fluent, the commit was already made, and the only
diagnostic was a shell line reading "10: No such file or directory" - noise, unless you know to look.
escape-guard scans .mjs files and has never scanned a markdown write, because markdown was not where
the discipline was expected to slip. Occurrences SEVEN
and EIGHT were both one-off probes - an invisible sentinel written by hand, and a Python heredoc eating
the escapes out of a regex it was fixing. The fifth
occurrence adds: this applies to PYTHON heredocs too, and Python eats a different set of escapes than
the shell does.

**Occurrence 14 (2026-09-20) is a DIFFERENT loss path caught by the SAME guard.** A commit message
written to a file, with the trailer, committed with `-F` - the rule followed to the letter - was refused
as "does not match the file". No shell had touched it. One line of prose had wrapped onto a leading `#`,
and git's message cleanup drops such lines as comments before any hook runs. The message reached git
one line short and the file was intact. The guard fired correctly and blamed the shell; it now names
this cause when a `#`-initial line is present in the file. The lesson is the guard's own: a comparison
against the bytes you meant to send catches losses you did not know existed, and the diagnosis text
should not pretend to know the mechanism.

And **occurrence 15**, the same day, minutes later: a regex probed through `node -e` inside a shell
argument printed `froms+` for `from\s+` - the probe's own regex had collapsed. The scanner under
investigation was written with the editor and intact; its own control was trusted and the probe was not.

**Occurrence 16**, minutes after that: five commit-message files pushed through one shell call as
heredocs failed to parse at line 111 with an unmatched quote - none was written - and the messages
were written with the editor instead. The rule already said so. Three occurrences in one hour, each
while recording the previous one, is the argument for the mechanism restated.

---

## 2. Pipe truncation reporting success — RULE ONLY

A sweep run as `node long-job.mjs | head -8` stopped a quarter of the way through: `head` closed the
pipe, node died on EPIPE, and the shell reported the **pipeline's** exit code, which is `head`'s `0`.
Partial output, no error, no summary, exit 0.

This is the project's tracked silent-failure shape — it reports OK while the work is lost — and it sits
next to the heredoc bug because both leave everything looking successful.

**Rule:** long sweeps write to a file and the file is read afterwards. Never `| head`, `| tail` or
`| grep` on a job whose completion matters. `set -o pipefail` catches some of it and is not a
substitute for not truncating the job.

---

## 3. A control that could not fire — RULE ONLY

**Occurrences: 2, one of them in a published write-up.**

`a03` scored a clean win on concern disambiguation while its source contained **no rival concern to
disambiguate** — the mechanism never ran. Later, the v4 holdout's "3/3 non-overreach" was reported as
evidence the selector declines false relations; all three tasks had **no relation clause at all**, so
each abstained before resolution was attempted. The first family containing a genuine false relation
showed the selector applies to it.

**THIRD occurrence, 2026-09-18.** A task built to test an UNRESOLVED requirement recovered fully -
but only because a second, resolvable requirement in the same operation produced the same region on
its own. The unresolved symbol was silently dropped exactly as predicted, and the task could not tell
that apart from success. The two halves of the pair printed identical figures, which is the signature.

**Rule:** a passing control proves a mechanism ran only if the input could have made it fail. For any
selection, disambiguation or ranking step, name the RIVAL in each case and confirm at least one case
has one. For a control testing a FALLBACK or FAILURE path, confirm the path under test is the ONLY
thing that can produce the result - a co-occurring mechanism that subsumes it makes the control
vacuous no matter how the number looks.

---

### The pattern behind all three occurrences

    a03    the competitor concern was absent
    v4     the false-relation case was absent
    h07    the unresolved requirement was MASKED by a co-occurring resolvable one

All three are one thing: **a negative or fallback mechanism was declared tested, while another path
made the expected outcome achievable without exercising it.**

> **For a test of fallback, refusal, unresolved or negative behaviour, prove BEFOREHAND that the target
> mechanism is NECESSARY to obtain the expected outcome.**

That is a path-sensitivity requirement for controls, and it is stronger than "make sure a rival
exists" because h07 had a rival - it just had a second mechanism that reached the same answer first.

---

## 3d. An apparatus control proves the ASSEMBLER, not the PROMPT - MECHANIZED

**Occurrences: 1, and it cost a whole rung.** Every arm of the visibility ladder passed its apparatus
control: feed a perfect fragment, it assembles, it verifies, so the arm can reach 10/10 if the model
cooperates. The `W0` arm passed that control and then scored **0/20**.

The reason was not the model. With zero source lines visible, `W0`'s prompt never says the parameter is
called `n` - the delta says "values below 10" - so the model wrote `value < 10`, `size < 10`, and whole
functions named `get_size` to hang them on. It could not have produced the fragment the control fed.

    an apparatus control proves the ASSEMBLER works
    it says nothing about whether the PROMPT is sufficient

Two different questions, and this project had a mechanism for only one.

**Mechanism:** `sufficiency.mjs` - every identifier the expected output depends on must be obtainable
from the prompt as a whole word. String contents are values, not facts; Python keywords and builtins
need no source. Proven on the REAL prompts replayed byte-for-byte: it rejects `W0` naming `n` as the
missing fact, and admits `W1`. A substring test is explicitly refused, since "function" contains an `n`
and would have called `W0` sufficient.

```bash
node --test legasus/legalabs/sufficiency.test.mjs
```

**Rule:** every family runs three controls, not two.

    can the apparatus express a pass?        assembler control
    can the apparatus express a failure?     inversion / off-by-one control
    can the model obtain the facts?          sufficiency control

---

## 3f. An ablation that REPAIRS the proposal is not an ablation - RULE ONLY

**Occurrences: 1, and it reached the opposite conclusion.** Ablating a component means removing its
authority, not making the pipeline work without it. The first CONSTRAIN ablation extracted a guard and
a return from anywhere inside each refused output - including from inside a returned function - and
assembled that. It was measuring

    CONSTRAIN OFF + repair machinery

which is a different configuration, and a more flattering one, because repair does for free exactly
what the removed component was there to make unnecessary. It concluded CONSTRAIN was largely redundant
with the verifier. The corrected version concluded the opposite: half of all refusals do not load at
all unchanged, so the verifier could not have been pointed at them.

**A second defect rode in on the first.** The corrected version's DECODER ate leading indentation - the
fence pattern consumed the first line's spaces - so a four-space guard arrived at column zero, could
not enter a function body, and sixty-one refusals were classified unassemblable for a reason that was
entirely the decoder. It was caught by ASSEMBLING ONE CASE BY HAND AND RUNNING IT, not by reasoning
about the counts.

**Rule:** before an ablation is believed, write down what counts as DECODING and what counts as REPAIR,
freeze it, and then assemble one case of each category by hand and run it. A category decomposition is
only as good as the assembly underneath it, and the way to check an assembly is to run it.

---

## 3e. The apparatus penalizing a LEGAL realization - MECHANIZED at PROVE and at CONSTRAIN

**Occurrences: 2, and the second cost a whole cell block.** A contract admits more than one
implementation. Any stage that rejects one of them is measuring itself, and it does so INVISIBLY until
a model happens to prefer the style being rejected.

    at PROVE       `n <= 10` survives the probes on S_STRADDLE and is genuinely CORRECT - the preserved
                   guard absorbs the off-by-one, so it is unreachable. Counting it as a probe-set gap
                   would have driven a "fix" that rejects a correct answer. Caught by a control before
                   the window opened.

    at CONSTRAIN   the 14B writes `elif n < 10:` where smaller models write `if`. After a returning
                   branch these are equivalent. The envelope accepted only `if` and refused 54 of 60
                   outputs on one shape, which read as a catastrophic model failure - 6/60 against the
                   7B's 48/60, p = 2.7e-15 - and was entirely the apparatus. Caught only in the RESULT.

**Why the second one hid:** the acceptor was internally inconsistent. The normalizer split one-line
`if` AND `elif`, the condition extractor read `(?:el)?if`, and only the acceptor insisted on `if`.
Three functions, two opinions, and the disagreement is invisible while every model prefers the same
keyword.

**Mechanism:** `legasus/legagate/envelope.mjs` is the single authority envelope, and
`envelope.test.mjs` is the anti-oracle control it never had - **ten fragments that must be ADMITTED**,
all legal realizations differing only in surface, and six that must be REFUSED, with negative controls
in both directions so neither list can become vacuous. `PROVE` has had its equivalent since window 10
(two legal realizations must pass) plus a dense 605-input equivalence sweep to adjudicate survivors.

**Rule:** every stage that can REJECT needs an admit list of legal realizations, not only a refuse list
of violations. A stage with only a refuse list is tested against what it should stop and never against
what it must let through.

---

## 3b. Reporting code that cannot express what it is measuring — RULE ONLY

**Occurrences: 5.** Five times a report marked a working rule as failed because the report could not
represent the thing under test.

    inventory      counted a kind as "fired" only when it NARROWED, so the three rules whose
                   correctness IS their silence read as untested
    scorer         same criterion, same consequence, on j01 and j02
    emitted_as     a declared `kind` names a MECHANISM; self-reference is implemented by a
                   symbol_availability constraint, so the report hunted a kind never emitted
    account        k04's negative is "DOUBLE must not require itself" - not expressible as
                   "this kind did not fire", since symbol_availability legitimately fires for STEP
    P3 / oracle    `failing_positions` is BEHAVIOURAL in V1 families and BOTH CHANNELS in V2 ones,
                   and the conformance audit had no way to say which it was reading. A structural
                   rule that correctly removes a position which executes fine therefore scored as an
                   over-constraint, and the audit could not distinguish that from a real one

**Rule:** before trusting a FAIL, check that the report can represent a PASS. A criterion that a
correct implementation cannot satisfy is measuring the reporter.

**And the corollary the fifth occurrence added.** The fix must not be the recorded failure quietly
becoming a pass. P3 keeps its frozen behavioural meaning and keeps failing on `scopecont/j01:op3`;
the new adjudication is a SEPARATE property, `P8 CHANNEL COMPLETE`, reporting which channel answered
and carrying the witness. A recorded failure that disappears the moment its adjudication improves is
a score obtained by changing the rule after seeing the result, which is the one thing this project's
marching orders forbid outright. Add the instrument; never retire the record.

---

## 3c. JSON silently inverting an unbounded domain - MECHANIZED after it was finally used

`JSON.stringify({ lo: -Infinity })` yields `null`, and `-5 > null` is `false`. An unbounded domain
round-tripped through JSON therefore INVERTS: `n < 10` stops matching negative numbers, with no error
anywhere.

Found while reading a test's own output before anything depended on it - nothing serialised a domain
yet, and gate 12D is where it would first have bitten.

**SECOND occurrence, 2026-09-18, and this time it was USED.** This entry said "caught before use".
It has now been used. `parseCondition` returns lo: -Infinity for `n < 10`; JSON.stringify turns that
into null; and LegaVerify's contract-probe generator tested `lo === -Infinity` to decide whether to emit
DEEP INTERIOR probes. A domain that had been through a file or a saved artifact arrived with lo: null,
the deep probes never fired, and the probe set silently dropped from four negative probes to one -
losing exactly the probes that kill an invented lower bound like `0 < n < 10`.

Measured before repair, not supposed: live domain 4 negative probes, round-tripped 1.

**Mechanism:** `normalizeDomain` treats null and undefined as unbounded at every entry point, and
`auditProbeSet` REFUSES to return a probe set that lacks a deep probe into an end the contract left
open - a weaker probe set is now an exception rather than a quieter answer. Witnessed both ways: a
round-tripped domain produces the identical probe set and still kills `0 < n < 10`, and a deliberately
truncated probe set is reported.

**Rule:** any value that can be infinite is encoded explicitly on the way out and decoded on the way
back, with a round-trip witness. JSON's defaults are not a safe representation for a numeric domain.

---

## 4. A checker reading its own file format — RULE ONLY

The leakage scanner treated the patch serializer's own header lines — `--- op op1 after: "<anchor>"` —
as implementation content, so the format word `after` counted as an identifier the reference
introduced. A task whose goal legitimately said "after normalization" was refused. The refusal is
indistinguishable from a badly authored task, and the natural response is to reword a perfectly good
input to appease the checker.

**Rule:** strip the apparatus's own emissions before scanning, and keep a positive control proving the
strip did not loosen the guard.

---

## 5. The wrong denominator — RULE ONLY

**Occurrences: 3.**

Goal coupling made 20 goals into ~10 tasks, so every published percentage used the wrong denominator.
Candidate inflation was measured against reference *operation count* when one operation can cover two
analogous positions. Intra-line operations were swept over line boundaries, failed at all 27
candidates, and were reported as `0 of 27 passing` — a property of the instrument reported as a
property of the program.

**Rule:** state the denominator and what it excludes, before reporting the ratio. Categories that do
not share a coordinate system are never averaged together.

---

## 6. Records typed, not inferred from matching strings — RULE ONLY

A `grep VERIFIED` counted `REFERENCE VERIFIED` control lines as experimental results and reported
"2 verified" when the truth was 0 of 48.

**Rule:** control records and experimental records are typed fields (`record_kind`, `generator`),
never distinguished by substring.

---

## 7. Module-scope CLI executing on import — MECHANIZED BY PATTERN

`seal.mjs` and `validate-task.mjs` ran their CLI at module scope, so importing either one executed it
and swallowed the importer's output.

**Mechanism:** every tool file guards its CLI with an `isMain` check against `process.argv[1]`. Present
in `seal.mjs`, `validate-task.mjs` and `narrowability.mjs`.

---

## 8. The instrument's coordinate assumption — RULE ONLY

A scorer computed reference line `-1` for every anchor that stops mid-line, having assumed all anchors
were newline-terminated. It reported a scorer bug as a selector input.

**Rule:** when a measurement maps text to positions, test it against the *irregular* case — mid-line,
empty, end-of-file — before trusting any number it produces.

---

## 9. Two reconstructions of one artifact — MECHANIZED

A scorer and the ground-truth prover each rebuilt the same patch blocks from the same file, and
normalized trailing newlines differently. The two texts then disagreed, every line number shifted, and
an entire scoring run compared misaligned positions — reporting 4 of 26 recovered when the truth was
26 of 26. Nothing failed. The numbers looked reasonable in both directions.

**Mechanism:** one exported `reconstruct()` / `baseFor()` that every consumer calls, plus an alignment
assertion — the ground truth records `base_lines` and the scorer **refuses to score** on a mismatch
rather than producing a number.

**SECOND occurrence, 2026-09-18.** The conformance audit reported seven over-constraints the scorer
reported as clean. The deriver was not at fault: the audit built the operation's `parentRange` as the
whole file while the scorer computed the enclosing unit, so `control_flow_boundary` scanned past the
operation's real block and found a terminator belonging to a different function. Plausible numbers in
both directions, again.

Fixed by `opcontext.mjs`: one `buildContext()` every consumer calls, and the scorer's local copy
DELETED rather than left unused, because a stale duplicate is what invites the next consumer to copy
the wrong one. It also surfaced a property worth stating in the contract - `control_flow_boundary` is
sound only RELATIVE to a correct parent range, which is an input the deriver trusts and no consumer
may improvise.

**Rule it replaces:** "normalize carefully in both places" is not a rule, it is a wish. If two pieces
of code must agree on a derived artifact, there is one implementation of it.

---

## Known blind spot in hazard 1's mechanism

`escape-guard.mjs` scans **string literals** and not **regex literals**. A newline escape that passed
through a heredoc and a second layer of unescaping landed as a raw newline inside a regex literal, and
the guard did not see it.

This is recorded as understood rather than patched: a raw newline in a regex literal is a **syntax
error**, so the interpreter catches it immediately and loudly. The silent case — valid code with
changed meaning — is the string literal, which the guard covers. Extending it to regex literals would
add false positives for no safety gain.

---

## 10. A shell builtin truncating a message while the command succeeds — RULE ONLY

`git commit -m "$(printf '...93.8%%...')"` - printf aborted on the percent sign, emitted only the text
before it, and **git committed the truncated message and exited 0**. The files were correct; the record
was cut off mid-sentence. Same silent shape as hazard 2: the job reports success while part of the
work is gone.

**Rule:** commit messages and any other multi-paragraph text go to a file and are passed with `-F`.
Never build them with `printf` in a command substitution.

---

## 11. A verdict computed from the PLAN and reported as a measurement — MECHANIZED

`reachability` decided whether an operation was dead from the requested domains and the committed order.
It never saw the emitted code. Its verdict was therefore a pure function of `(plan, order)` — the same
for every model, every temperature and every realization — and it produced the headline `DECIDE` result:
**dead-op 105, probe-fail 0**. A number that cannot vary with the artifact is not a measurement of the
artifact.

It also **rejected a legitimate alternative**, which is how it was caught. A self-defending realization
(`n < 10 and n >= 0` beside `n < 0`) contains no dead code at all, and executing it proves every branch
fires. The planned check condemned it anyway.

**Mechanized:** `reachabilityExecuted` asks the artifact — an operation is dead when no input produces
its result. `auditResultLabels` refuses rather than guesses when an observation could not be attributed.
The planned version is **kept**, because the gap between plan-dead and execution-alive is exactly what a
self-defending realization looks like, and that gap is the only way a rescue rate can be measured.

**The tell to remember:** a failure count that is *identical across models of very different capacity*,
with one mechanism at 100% and every other mechanism at 0.

---

## 12. An ablation that moves its own EXPECTATIONS with the treatment — RULE ONLY

The same `DECIDE` ablation recomputed probe expectations from the **presented** order while also
assembling in it. The broken program was graded against a broken expectation, the probes agreed by
construction, and the only term left that could fire was the analytic one from hazard 11. The two
defects together fully explain a result that read as decisive.

This is hazard 3f's sibling. 3f is *an ablation that repairs the proposal until the pipeline works*;
this is *an ablation that lowers the bar until the damaged output passes*. Both make the treatment arm
measure something more flattering than the treatment.

**Rule:** in an ablation, exactly one thing moves. Ground truth is derived from the **contract** and
computed identically in both arms. Two requested behaviours whose domains are nested can only both be
satisfied if the narrower wins where they overlap — that holds however the file is laid out, so the
expectation may never be recomputed from the arm's own assembly.

---

## 13. A metric defined as "not the expected value" instead of as the property itself — MECHANIZED

The rendering family's primary endpoint was *sibling defence*. It was implemented as **any clause that is
not the canonical own-domain**, which is not the same thing at all: an operation that simply wrote the
wrong guard (`n == 3`) scored as *defending against a sibling*. The console reported
`defends SIBLING 44` in a condition where the true count was **zero**.

The property has a direction, and the two directions are opposites:

    EXCLUDED   the guard carves the sibling's domain OUT of its own     n < 10 and n >= 0
    ADOPTED    the guard REPLACES its own domain with the sibling's     n < 0, when n < 10 was asked

Defining the metric as "not the expected string" collapsed both of those — plus ordinary noise — into one
number, and the number that mattered ran the *opposite* way from the label on it.

**Mechanized:** `siblingRelation` returns `EXCLUDED`, `ADOPTED` or nothing, and the denominator is only
guards whose domain actually contains a sibling. Replayed on the recorded rows it reproduces the hand
analysis exactly.

**Why it did no damage, and this is the point:** the conclusion came from reading the actual guard
conditions, not from the summary line. The rule *inspect raw artifacts, not summaries* is what caught a
metric that was confidently reporting the reverse of the truth.

**Rule:** a metric must be defined as the property it claims to measure, with its direction explicit.
"Different from what I expected" is not a measurement of anything.

---

## A PERMANENT rule, promoted out of the preference probe

> **A bug does not need to have changed yesterday's result to be dangerous to tomorrow's autonomy.**

`placementRobustness` decided legality **per candidate**: each realization was assembled at each position
and the ones it failed to parse at were dropped from *its own* denominator. That rewards a candidate for
being compatible with fewer environments —

    A   compiles at 2 of 4, correct at 2   ->  2/2 = 1.00
    B   compiles at 4 of 4, correct at 3   ->  3/4 = 0.75

— which is the opposite of the property the dimension is named for.

**Re-running after the fix changed nothing.** In that family every compared candidate had the same
syntactically legal placement set, so the two denominators coincided. The two facts are kept separate
rather than collapsed into "harmless":

    APPARATUS DEFECT    legality was candidate-conditioned, creating an incentive for incompatibility
    OBSERVED IMPACT     none in this experiment, because the legal placement sets happened to coincide

**Rule:** a threat to validity is fixed when it is found, not when it is shown to have bitten. "It did not
change the headline" is evidence about one dataset. A measure that can be gamed by the thing it scores is
a measure that *will* be gamed once something is allowed to search against it for ten thousand iterations —
and the whole point of this apparatus is to be trustworthy before that happens, not after.

Mechanized: legality now comes from the HOST, via a neutral representative of the operation kind, and two
controls assert that every candidate reports the same legal count and that a candidate parsing nowhere is
charged at every legal position rather than excused into `0/0`.

---

## A PERMANENT LegaLabs rule, promoted out of the rendering ladder

> **JSON artifacts are authoritative. Console output is NON-EVIDENTIARY.**

The console may show progress while a run is in flight. **No scientific conclusion is drawn from it**, and
every number in a write-up is generated from the finalized artifact.

One run produced two plausible wrong readings, neither of them a measurement error:

- `padEnd(15)` cannot pad the 16-character label `SIBLING_RESOLVED`, so it ran into its case name,
  `grep` stopped matching, and **an entire experimental condition appeared to be missing from the run**;
- a greedy `sed` crossed logical record boundaries and reported `0.900` for a cell whose true value was
  `0.000`, contradicting a correct earlier reading of the same cell.

Both were **reporting** defects wearing the shape of measurements. The fix is structural rather than
careful: `report-ladder.mjs` generates the summary **from the artifact**, so there is one reporting path
instead of two that can disagree. This is the same lesson as the permanent rule below — duplicated
reconstruction of one artifact has now cost this project three times.

---

## A PERMANENT LegaLabs rule, promoted out of hazard 9

> **Any artifact whose coordinates are compared across components must have exactly one canonical
> reconstruction implementation, and scoring must REFUSE TO PROCEED if the representations disagree.**

Keeping two parsers synchronized by discipline is not a control. The alignment assertion is, because it
converts a silent misalignment into a loud refusal. This applies to any future component that compares
positions, spans, hashes or ids against an artifact another component derived.

---

## The pattern behind all of them

Every one of these produced **output that looked like a result**. None threw. The costly failures in
this project do not crash; they report OK while the work is lost, which is why the response to a
repeated hazard is a mechanism rather than another sentence in a document.

---

## Hazard 13 — EXECUTION IDENTITY ALIASING (four occurrences, recognised as one)

**Symptom.** Evidence produced by one executable object satisfies a claim about a different one that
happens to share a source coordinate, a name, or a file path.

**Occurrences, which were mistaken for four unrelated bugs:**

1. `from packaging.utils import ...` imported the **installed** package from site-packages while the
   witness claimed to be measuring the corpus. Caught by a nonexistent-root control.
2. `bisect.insort_right` was answered by the **C accelerator**; the Python source never ran, and a
   mutation to it was inert while the public call kept succeeding.
3. A macOS platform branch was read as *the source lacking authority* rather than *the path not being
   exercised on this host*.
4. The module code object's `def foo(` **statement** (executed at import) was indistinguishable from a
   site inside `foo`, because both project onto `module:line`. Numerator and denominator were each
   contaminated, in opposite directions.

**The invariant, now mechanized in `legasus/legaexercise/pysite.mjs`:**

> **EXECUTION_IDENTITY_NONALIASING — evidence belongs to the exact executable identity that produced it.
> Similar source is not transferable authority.**

Source coordinates describe **where** a site came from; the executable object establishes **what site it
is**. Identity is a fingerprint over the executable object; `co_qualname` is descriptive metadata only,
because names have already misled this project once.

**Control:** `legasus/legaexercise/identity.test.mjs` builds one physical source line carrying two
executable identities and asserts that under `(module, line)` they are indistinguishable while their
fingerprints differ — plus both directions of the import/call asymmetry, and a lambda case.

**Cost:** it silently compromised the *proof ancestry* of two published figures (21.9% observability, the
25/43 connectivity split) without making either arithmetically wrong. Both survived recomputation
(20.3%, 27/48) — but that could not be known without redoing them.

---

## Hazard 14 — FIXING A DENOMINATOR BY REASONING INSTEAD OF MEASURING

Twice in one hour I derived a denominator correction from an argument about CPython rather than from
observation, and both were wrong:

1. "A function's `def` line is in `co_lines()` but can never emit a line event." Predicted 212 phantom
   lines; **25 had actually been traced**.
2. Re-tested under code-object identity: of 518 function `def` lines, **21 are emitted** — every one a
   `<genexpr>`, whose first line genuinely executes.

**Rule:** a denominator is an empirical claim about what the apparatus can observe. Derive it from
observed traces, or state it as an assumption in the justification graph — never from a confident
account of the runtime's internals.

---

## Hazard 15 — A REFUSAL THAT IS CORRECT FOR THE WRONG REASON

Re-running the connectivity audit on corrected identities, prediction P3 (`tags` must NOT be admitted)
reported HELD — while **every** subject in every module had fallen OUT, because entry points were passed
in a different key space than the connectivity graph. The mechanism was dead and the prediction still
passed.

> **A correct refusal for the wrong reason proves the safety of the outcome, not the correctness of the
> authority mechanism.**

**Control:** every exclusion prediction must be paired with a live admission in the same run. P3 is only
meaningful beside P1 showing `specifiers` at 60/60 IN_DOMAIN.

---

## Hazard 16 — AN ARTIFACT THAT TRUNCATES ITS OWN EVIDENCE

**Symptom.** A replay of a historical run contradicts the run's own recorded outcome, in a way that is
logically impossible: `PARSES = false` for code that the run committed and a differential oracle scored
16/16.

**Cause.** `run-arms.mjs` recorded `code.slice(0, 400)`. Every candidate at exactly the cap was a PREFIX.
T03's stored text ended mid-string-literal. The replay parsed a string that had never existed.

**Rule.** *An artifact is authoritative for the decisions it records, and NOT for any field it summarised
on the way in.* This qualifies the standing rule that JSON artifacts are authoritative and console output
is non-evidentiary — a recording cap is indistinguishable from complete data at read time.

**Mechanism, not a sentence:** every recorded text field now carries a digest of the FULL text and its
length, so truncation is detectable rather than invisible.

**Method that caught it:** HASH BEFORE SEMANTICS. When a replay contradicts a historical record, establish
that both sides are looking at the same bytes before reasoning about meaning. The lineage walk found it in
one step; a semantic investigation would have gone looking for a parser difference that did not exist.

**Preserved:** `benchmarks/devrepo/RESULT.r2-subsumption-run0-FAILED.md`. The failed run was not deleted
or re-scored. An experiment about justification that rewrote its own history after finding its evidence
was bad would be self-refuting.

---

## Hazard 1, occurrence 13 — and it was in the write-up of hazard 16

The commit message recording the truncation discovery was itself passed through a double-quoted shell
argument. The backticked spans naming the defect were eaten, leaving `T03's tail is ,` in the permanent
record. The rule against passing prose through a shell argument already existed, with twelve prior
occurrences, and I broke it again while documenting a different recording defect.

Amended from a file. The lesson is unchanged and apparently needs a mechanism rather than a rule.
