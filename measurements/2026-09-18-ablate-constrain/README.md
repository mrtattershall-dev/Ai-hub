# ABLATING CONSTRAIN — is the authority envelope redundant with the verifier?

**Offline audit on recorded artifacts. No GPU time. No preregistration required because no new
generation was performed — every output replayed was already on disk, and the question is about the
apparatus rather than about a model.**

## The question

The ordering ablation cost nothing and produced the largest separation in the project — 105 verified
under the derived order, 0 under presentation order. `CONSTRAIN` had never had that treatment. Its
value had only ever been shown by **accident**: an envelope defect that refused `elif` and suppressed
yield across every model at once.

So, for every output the envelope refused: **what would have happened if it had not?**

    PROVE_WOULD_CATCH   a permissive envelope admits it, the contract probes reject it
                        -> redundant but cheap: CONSTRAIN catches early what PROVE catches late
    PROVE_WOULD_MISS    a permissive envelope admits it, the contract probes ACCEPT it
                        -> CONSTRAIN refused a SEMANTICALLY CORRECT program: over-constraint
    UNASSEMBLABLE       no guard and return can be extracted at all
                        -> CONSTRAIN caught something PROVE could not be pointed at

Extracting a fragment from a refused output is **not** a proposal to repair unauthorized output. This
project refuses repair, because repairing moves authority back to the apparatus. It is a measurement of
what the refused outputs *contained*.

## The instrument validated itself, blind

Run against the **old** envelope's refusals — the shapes window, before the `elif` repair:

    reason                                refused   CATCH   MISS   unassemblable
    not exactly one guard and one return     61        8     45          8
    repeated a fixed line                    23       23      0          0
    returned a function                       5        5      0          0
    TOTAL                                    89       36     45          8

    the 45 MISSes, by extracted fragment
      37x  if n < 10: return "small"
       8x  if n > 100: return "big"

**Forty-five semantically correct programs discarded**, and the raws are unambiguous:

    ```python
        elif n < 10:
            return "small"
    ```

The ablation **rediscovered the `elif` defect from historical data without being told it existed.** It
was built to answer a different question and found a known defect on its own — which is the strongest
evidence available that it is measuring something real rather than confirming what it was shown.

## Under the repaired envelope, zero over-constraint

    reason                                refused   CATCH   MISS   unassemblable
    repeated a fixed line                    15       15      0          0
    returned a function                      10       10      0          0
    not exactly one guard and one return      3        0      0          3
    TOTAL                                    28       25      0          3

**Not one refused output would have verified.** Every refusal is either something `PROVE` would also
have caught, or something `PROVE` could not have been run on at all.

## The deflationary finding, recorded as one

> In this data, **`CONSTRAIN` is not adding safety beyond `PROVE`.** 25 of 28 refusals would have been
> caught anyway. Its measured value is **cost** — rejecting early instead of assembling, executing and
> probing — plus the 3 outputs `PROVE` could not be pointed at.

That is a weaker claim for the authority envelope than the architecture's framing implies, and it is
the claim the data supports. It does **not** contradict the standing result that *authorization is a
strong filter and not a sufficient one* — that remains true, and is why `PROVE` exists. What is new is
the converse: in this family, authorization is also **not necessary for safety**, only for efficiency.

**The scope of that is narrow and load-bearing.** It is measured against a **contract-derived** probe
set, which is unusually strong: boundary triples around every bound the contract names, every existing
behaviour's bound, and deep interiors into every open end. Against a weaker verifier — a handful of
hand-chosen probes, or a regression suite — `CONSTRAIN` would be carrying real safety rather than
overlapping with it. **The envelope looks redundant precisely because the verifier is good.**

## What this changes

1. **`CONSTRAIN`'s justification is cost and unrunnability, not safety** — in this family, against this
   verifier. That belongs in `LEGASUS.md` as a measured qualification rather than being left to the
   architectural diagram to imply.
2. **Ablation has now found a defect it was not built to find.** It is no longer just an instrument for
   confirming a component matters; it is a way of auditing components that have never been questioned.
3. The natural next ablation is `RENDER`, and it is the one that **cannot** be done offline — a
   rendering change requires regeneration. That is a real asymmetry between the stages and worth
   stating: `DECIDE` and `CONSTRAIN` can be ablated on recorded artifacts; `RENDER` and `PROPOSE`
   cannot.

---

# CORRECTION AND RESULT — ablating CONSTRAIN, revision 2

**Revision 1, above, is methodologically void.** It extracted a guard and a return from anywhere inside
the refused output — including from inside a returned function — and assembled *that*. Turning
`CONSTRAIN` off must mean removing its **rejection authority**, not repairing the proposal until the
assembler can consume it. Revision 1 measured `CONSTRAIN OFF + repair machinery`, a different and more
flattering configuration. Its category counts do not stand.

## The frozen rules, written before any raw was re-examined

    DECODING allowed      strip the fence, trim trailing whitespace - transport, not content
    EVERYTHING ELSE       repair. No extraction, no re-indentation, no dropping a line, no choosing a
                          fragment. The proposal is inserted VERBATIM, with its own indentation.

    A  UNASSEMBLABLE            does not load unchanged -> INTERFACE PROTECTION; PROVE cannot be aimed at it
    B  ASSEMBLABLE, PROVE FAILS -> CHEAP EARLY REJECTION; semantically redundant, saves a run
    C  ASSEMBLABLE, PROVE PASSES -> split, because the category as first stated is not a defect indicator:
       C_SCOPE     it also touches a DECLARED-FIXED line. Correct by content, but it took authority it
                   was not granted. Refusing it is CONSTRAIN doing its job.
       C_SEMANTIC  it stayed inside its authority AND satisfies the contract. The only defect category.
    D  UNDETERMINED             not evaluable without changing the proposal

Every `C` candidate is additionally held to a **dense sweep** — every integer across a wide band against
the contract's own expectation — because passing a probe list is not proof the gate was wrong.

## The results

    OLD envelope (shapes window, before the elif repair) — 89 refusals
      A  interface protection   47
      B  cheap early rejection   4
      C_SCOPE correct refusal    3
      C  FALSE REJECTION        32      21x `elif n < 10`, 7x `elif n > 100`, 4x bare `return "small"`
      D  undetermined            3

    REPAIRED envelope (rev2) — 28 refusals
      A  interface protection   14
      B  cheap early rejection   1
      C_SCOPE correct refusal    6
      C  FALSE REJECTION         2      both bare `return "small"`
      D  undetermined            5

**The instrument rediscovered the `elif` defect blind.** 28 of the 32 false rejections under the old
envelope are `elif` forms — the exact defect repaired between the two runs, found by an audit built to
answer a different question and never told the defect existed.

## A residual over-constraint, and it is not obviously worth fixing

The repaired envelope still falsely rejects **2 of 28**, and both are the same shape: an unconditional
`return "small"` with no guard at all. Inserted after the preserved guard in `S_STRADDLE`:

    def classify(n):
        if n > 5:
            return "big"
        return "small"       <- the refused proposal
        return "other"

It is **correct**. The preserved guard already absorbs everything from 6 upward, and everything
remaining is below 10, so an unconditional return satisfies the contract — on the probes and on the
dense sweep. This is the same shape as the earlier `n <= 10` discovery: the preserved guard makes the
model's guard unnecessary.

**Whether to admit it is a genuine design question, not a bug to patch.** Widening the envelope to
accept unconditional returns would admit a class whose correctness depends entirely on what precedes
it — and "a branchless conditional write is an unconditional write" is a hazard this project has
already paid for elsewhere. The envelope exists partly so that nothing downstream has to reason about
that dependence. **Recorded as an open design question with its 2/28 rate, not silently fixed.**

## What CONSTRAIN actually contributes, corrected

    interface protection   14 / 28   the dominant contribution
    cheap early rejection   1 / 28
    correct scope refusal   6 / 28
    false rejection         2 / 28
    undetermined            5 / 28

Revision 1 claimed `CONSTRAIN` was largely **semantically redundant** with `PROVE`. Under the corrected
ablation that is **wrong**: only 1 of 28 refusals is a case `PROVE` would have caught anyway. The
dominant contribution is **interface protection** — half of all refusals do not load at all unchanged,
so `PROVE` could not have been pointed at them. `CONSTRAIN` is not a cheap prefilter for the verifier;
it is what makes the verifier applicable.

## Three apparatus defects in one gate

1. **The repair machinery** — revision 1 extracted rather than ablated. Void, preserved, superseded.
2. **The decoder ate indentation.** `` ```python\s* `` consumed the first line's leading spaces, so a
   four-space `elif` arrived at column zero, could not be inserted into a function body, and was
   classified `UNASSEMBLABLE`. **Sixty-one refusals landed in category A for a reason that was entirely
   my decoder.** Caught by assembling one case by hand and running it — the same four-space `elif`
   loads fine and returns `"small"` — rather than by reasoning about the counts.
3. **Hazard 1, eighth occurrence.** The fix to that decoder was written through a Python heredoc, which
   ate the regex escapes and produced a syntax error. Rebuilt with character codes.

> A category decomposition is only as good as the assembly underneath it, and the way to check an
> assembly is to run it.
