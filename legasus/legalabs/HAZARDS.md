# APPARATUS HAZARD LEDGER

Every entry here first presented as a result. That is the point: these are the ways this project's
instruments have produced confident, plausible, wrong numbers.

**A hazard is only closed when a MECHANISM catches it.** A written rule is a reminder, and this ledger
exists because reminders failed — the heredoc rule was written down after occurrences one, two and
three, and occurrence four still happened. Each entry therefore carries its status honestly:

    MECHANIZED   a check exists and fails loudly
    RULE ONLY    still relies on remembering

---

## 1. Heredoc backslash-eating — MECHANIZED

**Occurrences: 4.** A shell heredoc collapses doubled backslashes, so JS written that way lands with
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

**Standing rule it replaces:** JS containing a regex is written with a file writer, never a heredoc —
*including one-off probes*, which is exactly where the discipline slipped every time.

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

**Rule:** a passing control proves a mechanism ran only if the input could have made it fail. For any
selection, disambiguation or ranking step, name the RIVAL in each case and confirm at least one case
has one.

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
